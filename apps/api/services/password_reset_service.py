"""회원 비밀번호 재설정 서비스.

재설정 토큰은 서버 상태 없이 서명만으로 검증한다. 토큰에는 발급 시점
비밀번호 해시의 HMAC 지문을 담아, 비밀번호가 한 번 바뀌면(재설정 완료 포함)
같은 토큰을 다시 쓸 수 없게 한다.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
from dataclasses import dataclass
from email.message import EmailMessage
from typing import cast

from fastapi import Request
from itsdangerous import (
    BadData,
    BadSignature,
    SignatureExpired,
    URLSafeTimedSerializer,
)
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import Settings, get_settings
from ..errors import ApiError, ConflictError
from ..passwords import hash_password
from ..ratelimit import consume_limit
from ..repositories import auth as auth_repo
from . import email_service
from .auth_service import limiter_login, logout

logger = logging.getLogger(__name__)

PASSWORD_RESET_SIGNER_NAMESPACE = "member-password-reset-v1"
PASSWORD_RESET_TOKEN_MAX_AGE_SECONDS = 60 * 60
INVALID_RESET_TOKEN = "invalid_or_expired_reset_token"


@dataclass(frozen=True)
class PasswordResetPayload:
    student_id: str
    fingerprint: str


def _serializer(settings: Settings) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(
        settings.jwt_secret,
        salt=PASSWORD_RESET_SIGNER_NAMESPACE,
    )


def password_hash_fingerprint(password_hash: str, settings: Settings) -> str:
    """비밀번호 해시를 노출하지 않는 지문. 해시가 바뀌면 지문도 바뀐다."""
    digest = hmac.new(
        settings.jwt_secret.encode("utf-8"),
        f"{PASSWORD_RESET_SIGNER_NAMESPACE}:{password_hash}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return digest[:32]


def create_password_reset_token(
    *, student_id: str, password_hash: str, settings: Settings | None = None
) -> str:
    current = settings or get_settings()
    return _serializer(current).dumps(
        {
            "student_id": student_id,
            "fp": password_hash_fingerprint(password_hash, current),
        }
    )


def _invalid_token() -> ApiError:
    return ApiError(code=INVALID_RESET_TOKEN, detail=INVALID_RESET_TOKEN, status=400)


def load_password_reset_payload(
    token: str, settings: Settings | None = None
) -> PasswordResetPayload:
    current = settings or get_settings()
    try:
        data_raw: object = _serializer(current).loads(
            token,
            max_age=PASSWORD_RESET_TOKEN_MAX_AGE_SECONDS,
        )
    except (SignatureExpired, BadSignature, BadData) as err:
        raise _invalid_token() from err
    if not isinstance(data_raw, dict):
        raise _invalid_token()
    data = cast(dict[str, object], data_raw)
    student_id = data.get("student_id")
    fingerprint = data.get("fp")
    if not isinstance(student_id, str) or not isinstance(fingerprint, str):
        raise _invalid_token()
    return PasswordResetPayload(student_id=student_id, fingerprint=fingerprint)


def _normalize_email(value: str | None) -> str:
    return (value or "").strip().lower()


async def prepare_password_reset_email(
    db: AsyncSession,
    request: Request,
    *,
    student_id: str,
    email: str,
) -> EmailMessage | None:
    """재설정 메일을 준비한다.

    학번·이메일이 활성 회원과 일치하고 비밀번호가 이미 만들어진 경우에만
    메시지를 돌려준다. 일치 여부는 응답으로 드러내지 않는다.
    """
    settings = get_settings()
    consume_limit(
        limiter_login,
        request,
        settings.rate_limit_password_reset,
        scope="password-reset-request",
    )
    if not email_service.smtp_configured(settings):
        raise ConflictError(code="email_not_configured")

    member, creds = await auth_repo.get_member_with_auth_by_student_id(
        db, student_id.strip()
    )
    if member is None or creds is None:
        return None
    if cast(str, member.status) != "active":
        return None
    member_email = cast(str | None, member.email)
    target = _normalize_email(member_email)
    # compare_digest는 비ASCII str을 거부하므로 UTF-8 바이트로 비교한다.
    if not target or not hmac.compare_digest(
        target.encode("utf-8"), _normalize_email(email).encode("utf-8")
    ):
        return None

    token = create_password_reset_token(
        student_id=cast(str, member.student_id),
        password_hash=cast(str, creds.password_hash),
        settings=settings,
    )
    return email_service.build_password_reset_message(
        to_email=cast(str, member_email),
        name=cast(str, member.name),
        reset_url=email_service.build_password_reset_url(
            token, site_url=settings.public_site_url
        ),
        settings=settings,
    )


def deliver_password_reset_email(message: EmailMessage) -> None:
    """응답 이후 백그라운드에서 발송한다. 실패는 기록만 하고 숨긴다."""
    try:
        email_service.deliver_message(message)
    except ApiError as exc:
        logger.warning(
            "password_reset_email_failed code=%s to=%s",
            exc.code,
            email_service.mask_email_address(str(message["To"] or "")),
        )


async def confirm_password_reset(
    db: AsyncSession,
    request: Request,
    *,
    token: str,
    new_password: str,
) -> dict[str, str]:
    settings = get_settings()
    consume_limit(limiter_login, request, settings.rate_limit_login)

    payload = load_password_reset_payload(token, settings)
    member, creds = await auth_repo.get_member_with_auth_by_student_id(
        db, payload.student_id
    )
    if member is None or creds is None:
        raise _invalid_token()
    expected = password_hash_fingerprint(cast(str, creds.password_hash), settings)
    if not hmac.compare_digest(expected, payload.fingerprint):
        raise _invalid_token()
    if cast(str, member.status) != "active":
        raise ApiError(code="member_not_active", detail="member_not_active", status=403)

    replaced = await auth_repo.replace_member_auth_password_if_unchanged(
        db,
        creds,
        expected_hash=cast(str, creds.password_hash),
        password_hash=hash_password(new_password),
    )
    if not replaced:
        # 같은 토큰의 다른 요청이 먼저 비밀번호를 바꿨다.
        raise _invalid_token()
    # 재설정 브라우저에 남은 세션은 정리하고, 새 비밀번호로 다시 로그인하게 한다.
    logout(request)
    return {"ok": "true"}
