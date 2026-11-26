from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import cast

from fastapi import HTTPException
from itsdangerous import (
    BadData,
    BadSignature,
    SignatureExpired,
    URLSafeTimedSerializer,
)
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..config import get_settings
from ..errors import NotFoundError
from ..repositories import members as members_repo
from ..repositories import signup_requests as signup_requests_repo

ACTIVATION_SIGNER_NAMESPACE = "member-activate-v2"
ACTIVATION_TOKEN_MAX_AGE_SECONDS = 72 * 60 * 60


@dataclass(frozen=True)
class ActivationPayload:
    signup_request_id: int
    student_id: str
    # 발급 당시 회원 이메일의 지문. 이 값이 없는 토큰은 이전 버전이 발급한 것이다.
    email_fingerprint: str | None = None


def email_fingerprint(email: str | None) -> str:
    """이메일(대소문자·앞뒤 공백 무시)의 짧은 지문. 주소가 바뀌었는지만 비교한다."""
    normalized = (email or "").strip().lower()
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]


def create_member_activation_token(
    *,
    signup_request_id: int,
    student_id: str,
    cohort: int,
    name: str,
    email: str | None,
) -> str:
    """활성화 토큰을 만든다. `email`은 링크를 받을 회원의 현재 이메일이다.

    토큰은 이 주소에 묶인다. 회원 이메일이 바뀌면 그 전에 발급한 링크는
    `ensure_token_matches_member_email`에서 거절된다.
    """
    settings = get_settings()
    serializer = URLSafeTimedSerializer(
        settings.jwt_secret,
        salt=ACTIVATION_SIGNER_NAMESPACE,
    )
    return serializer.dumps(
        {
            "signup_request_id": signup_request_id,
            "student_id": student_id,
            "cohort": cohort,
            "name": name,
            "email_fp": email_fingerprint(email),
        }
    )


def load_activation_payload(token: str) -> ActivationPayload:
    settings = get_settings()
    serializer = URLSafeTimedSerializer(
        settings.jwt_secret,
        salt=ACTIVATION_SIGNER_NAMESPACE,
    )
    try:
        data_raw: object = serializer.loads(
            token,
            max_age=ACTIVATION_TOKEN_MAX_AGE_SECONDS,
        )
    except (SignatureExpired, BadSignature, BadData) as err:
        raise HTTPException(
            status_code=401,
            detail="invalid_or_expired_activation_token",
        ) from err

    if not isinstance(data_raw, dict):
        raise HTTPException(status_code=422, detail="invalid_payload")
    data = cast(dict[str, object], data_raw)
    signup_request_id_obj = data.get("signup_request_id")
    student_id_obj = data.get("student_id")
    if not isinstance(signup_request_id_obj, int) or not isinstance(
        student_id_obj, str
    ):
        raise HTTPException(status_code=422, detail="invalid_payload")

    email_fp_obj = data.get("email_fp")
    return ActivationPayload(
        signup_request_id=signup_request_id_obj,
        student_id=student_id_obj,
        email_fingerprint=email_fp_obj if isinstance(email_fp_obj, str) else None,
    )


def token_matches_member_email(
    payload: ActivationPayload,
    *,
    request_email: str | None,
    member_email: str | None,
) -> bool:
    """토큰이 회원의 현재 이메일에 대해 발급된 것인지.

    승인 뒤 관리자가 회원 이메일을 고치면(오타, 다른 사람의 주소) 옛 주소로 나간
    링크는 더 쓸 수 없어야 한다. 지문이 없는 이전 버전 토큰은 항상 신청서
    주소로만 발송됐으므로 신청서 주소를 발급 당시 주소로 본다.
    """
    issued_for = (
        payload.email_fingerprint
        if payload.email_fingerprint is not None
        else email_fingerprint(request_email)
    )
    return issued_for == email_fingerprint(member_email)


async def resolve_activation_signup_request(
    db: AsyncSession,
    payload: ActivationPayload,
    *,
    for_update: bool = False,
) -> models.SignupRequest:
    """토큰의 가입신청을 찾아 사용 가능한 상태인지 확인한다.

    `for_update`면 신청 행을 트랜잭션 끝까지 잠근다(활성화가 재발급·다른 활성화와
    겹치지 않게).
    """
    if for_update:
        row = await signup_requests_repo.get_signup_request_for_update(
            db, payload.signup_request_id
        )
    else:
        row = await signup_requests_repo.get_signup_request_by_id(
            db, payload.signup_request_id
        )
    if row is None:
        raise HTTPException(
            status_code=401,
            detail="invalid_or_expired_activation_token",
        )
    if cast(str, row.student_id) != payload.student_id:
        raise HTTPException(
            status_code=401,
            detail="invalid_or_expired_activation_token",
        )

    row_status = cast(str, row.status)
    if row_status == "activated":
        raise HTTPException(status_code=409, detail="activation_already_used")
    if row_status != "approved":
        raise HTTPException(
            status_code=401,
            detail="invalid_or_expired_activation_token",
        )
    return row


async def resolve_activation_member(
    db: AsyncSession,
    student_id: str,
    *,
    for_update: bool = False,
) -> models.Member:
    """활성화할 회원. `for_update`면 회원 행을 잠그고 현재 값으로 다시 읽는다."""
    try:
        member = await members_repo.get_member_by_student_id(db, student_id)
    except NotFoundError:
        raise HTTPException(
            status_code=409,
            detail="activation_member_missing",
        ) from None
    if for_update:
        locked = await members_repo.get_member_for_update(db, cast(int, member.id))
        if locked is None:
            raise HTTPException(status_code=409, detail="activation_member_missing")
        member = locked
    # 승인 후 활성화 직전 상태 변경(예: suspended) 방어
    if cast(str, member.status) != "active":
        raise HTTPException(status_code=403, detail="member_not_active")
    return member
