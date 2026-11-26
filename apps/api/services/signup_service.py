from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import cast

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..errors import ApiError, ConflictError, NotFoundError
from ..logging_utils import log_json
from ..repositories import auth as auth_repo
from ..repositories import members as members_repo
from ..repositories import signup_requests as signup_requests_repo
from ..student_id_key import clean_student_id
from . import email_service
from .activation_service import (
    create_member_activation_token,
    load_activation_payload,
    resolve_activation_signup_request,
    token_matches_member_email,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SignupActivationContext:
    signup_request_id: int
    student_id: str
    email: str
    name: str
    cohort: int


@dataclass(frozen=True)
class SignupActivationEmailResult:
    sent_to: str


@dataclass(frozen=True)
class SignupActivationIssueResult:
    context: SignupActivationContext
    token: str
    issue_log: models.SignupActivationIssueLog


def _build_activation_context(row: models.SignupRequest) -> SignupActivationContext:
    return SignupActivationContext(
        signup_request_id=cast(int, row.id),
        student_id=cast(str, row.student_id),
        email=cast(str, row.email),
        name=cast(str, row.name),
        cohort=cast(int, row.cohort),
    )


async def issue_activation_token(
    db: AsyncSession,
    *,
    row: models.SignupRequest,
    issued_by_student_id: str,
    issued_type: schemas.SignupActivationIssueTypeLiteral,
    member_email: str | None,
) -> SignupActivationIssueResult:
    """`member_email`(회원의 현재 이메일)에 묶인 활성화 토큰을 발급한다.

    커밋하지 않는다. 호출자가 응답 스냅샷을 확보한 뒤 커밋한다.
    """
    context = _build_activation_context(row)
    token = create_member_activation_token(
        signup_request_id=context.signup_request_id,
        student_id=context.student_id,
        cohort=context.cohort,
        name=context.name,
        email=member_email,
    )
    issue_log = await signup_requests_repo.create_activation_issue_log(
        db,
        signup_requests_repo.ActivationIssueLogWrite(
            signup_request_id=context.signup_request_id,
            issued_type=issued_type,
            issued_by_student_id=issued_by_student_id,
            token=token,
        ),
        commit=False,
    )
    return SignupActivationIssueResult(
        context=context,
        token=token,
        issue_log=issue_log,
    )


async def create_signup_request(
    db: AsyncSession,
    payload: schemas.SignupRequestCreate,
) -> models.SignupRequest:
    # 학번 표기만 다른 재신청(`S90041` ↔ `90041`)도 같은 사람으로 본다.
    # 이메일만 겹치는 경우는 공개 엔드포인트에서 거절하지 않는다(계정 열거 방지,
    # 같은 사람인지는 승인 단계에서 사무국이 판단).
    # 같은 학번 키의 동시 접수·승인을 트랜잭션 잠금으로 직렬화한 뒤 조회한다.
    # 웹 폼이 보내던 것처럼 앞뒤 공백만 지워 저장한다(내부 표기·비ASCII 원문 유지).
    payload = payload.model_copy(
        update={"student_id": clean_student_id(payload.student_id)}
    )
    if not payload.student_id:
        # 공백뿐인 학번은 로그인할 수 없는 회원을 만든다. 자유 입력(한글 등)은 허용.
        raise ApiError(
            code="student_id_required",
            detail="학번을 입력해 주세요.",
            status=422,
        )
    await signup_requests_repo.lock_student_key(db, payload.student_id)
    members = await members_repo.list_members_by_student_key(db, payload.student_id)
    active_members = [m for m in members if cast(str, m.status) == "active"]
    for member in active_members:
        if await auth_repo.member_has_auth(db, cast(int, member.id)):
            raise ConflictError(
                code="member_already_active",
                detail="이미 활성화된 회원입니다.",
            )
    if active_members:
        raise ConflictError(
            code="member_activation_pending",
            detail=(
                "가입 승인이 이미 완료되었습니다. "
                "안내 메일의 링크로 첫 로그인 설정을 진행해 주세요."
            ),
        )

    pending_row = await signup_requests_repo.get_pending_by_student_key(
        db, payload.student_id
    )
    if pending_row is not None:
        raise ConflictError(
            code="signup_already_pending",
            detail="이미 심사 대기 중인 신청이 있습니다.",
        )

    try:
        return await signup_requests_repo.create_signup_request(db, payload)
    except IntegrityError as exc:
        await db.rollback()
        if "uq_signup_requests_student_id_pending" in str(exc.orig):
            raise ConflictError(
                code="signup_already_pending",
                detail="이미 심사 대기 중인 신청이 있습니다.",
            ) from exc
        raise


async def list_signup_requests_with_total(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    filters: schemas.SignupRequestListFilters | None = None,
) -> tuple[Sequence[models.SignupRequest], int]:
    return await signup_requests_repo.list_signup_requests_with_total(
        db,
        limit=limit,
        offset=offset,
        filters=filters,
    )


async def list_signup_activation_issue_logs(
    db: AsyncSession,
    *,
    signup_request_id: int,
    limit: int,
) -> Sequence[models.SignupActivationIssueLog]:
    row = await signup_requests_repo.get_signup_request_by_id(db, signup_request_id)
    if row is None:
        raise NotFoundError(
            code="signup_request_not_found",
            detail="가입신청을 찾을 수 없습니다.",
        )
    return await signup_requests_repo.list_activation_issue_logs(
        db,
        signup_request_id=signup_request_id,
        limit=limit,
    )


async def reject_signup_request(
    db: AsyncSession,
    *,
    signup_request_id: int,
    decided_by_student_id: str,
    reject_reason: str,
) -> models.SignupRequest:
    # 동시 승인·반려가 같은 대기 상태를 읽지 않도록 신청 행을 잠근 뒤 판정한다.
    row = await signup_requests_repo.get_signup_request_for_update(
        db, signup_request_id
    )
    if row is None:
        raise NotFoundError(
            code="signup_request_not_found",
            detail="가입신청을 찾을 수 없습니다.",
        )

    if cast(str, row.status) != "pending":
        raise ConflictError(
            code="signup_request_not_pending",
            detail="대기 중인 신청만 반려할 수 있습니다.",
        )

    setattr(row, "status", "rejected")
    setattr(row, "decided_at", datetime.now(tz=UTC))
    setattr(row, "decided_by_student_id", decided_by_student_id)
    setattr(row, "reject_reason", reject_reason)
    return await signup_requests_repo.save_signup_request(db, row)


async def resolve_activation_member_for_send(
    db: AsyncSession, row: models.SignupRequest
) -> models.Member:
    """안내 메일을 받을 회원: 활성화가 찾는 회원(학번 완전 일치, 활성)의 현재 값.

    같은 세션이 먼저 읽어 둔 값이 아니라 지금 저장된 값으로 판정한다.
    """
    try:
        member = await members_repo.get_member_by_student_id(
            db, cast(str, row.student_id)
        )
    except NotFoundError:
        raise ConflictError(code="activation_member_missing") from None
    await db.refresh(member)
    if cast(str, member.status) != "active":
        raise ConflictError(code="member_not_active")
    return member


async def resolve_activation_recipient(
    db: AsyncSession, row: models.SignupRequest
) -> str:
    """안내 메일을 받을 주소: 활성화될 회원의 현재 이메일.

    신청서의 이메일은 접수 시점 값이다. 승인 뒤 관리자가 회원 이메일을 고쳤다면
    (오타, 다른 사람의 주소 등) 신청서 주소가 아니라 고친 주소로만 보낸다.
    """
    member = await resolve_activation_member_for_send(db, row)
    return _member_recipient(member)


def _member_recipient(member: models.Member) -> str:
    to_email = (cast(str | None, member.email) or "").strip()
    if not to_email:
        raise ConflictError(code="email_recipient_missing")
    return to_email


async def send_signup_activation_email(
    db: AsyncSession,
    *,
    signup_request_id: int,
    activation_token: str,
    sent_by_student_id: str,
) -> SignupActivationEmailResult:
    payload = load_activation_payload(activation_token)
    if payload.signup_request_id != signup_request_id:
        raise ApiError(
            code="invalid_or_expired_activation_token",
            detail="invalid_or_expired_activation_token",
            status=401,
        )

    row = await resolve_activation_signup_request(db, payload)
    # 같은 세션이 먼저 읽어 둔 값이 아니라 현재 상태로 판정한다(그사이 활성화 완료 등).
    await db.refresh(row)
    row_status = cast(str, row.status)
    if row_status == "activated":
        raise ConflictError(code="activation_already_used")
    if row_status != "approved":
        raise ConflictError(code="signup_request_not_approved")
    member = await resolve_activation_member_for_send(db, row)
    to_email = _member_recipient(member)
    if not token_matches_member_email(
        payload,
        request_email=cast(str | None, row.email),
        member_email=to_email,
    ):
        # 발급 뒤 회원 이메일이 바뀌었다. 이 링크는 활성화에서 거절되므로 보내지 않는다.
        raise ConflictError(
            code="activation_link_outdated",
            detail="회원 이메일이 바뀌어 이 링크는 더 쓸 수 없습니다. 재발급해 주세요.",
        )

    sent_to = await email_service.send_activation_email(
        to_email=to_email,
        name=cast(str, row.name),
        student_id=cast(str, row.student_id),
        token=activation_token,
    )
    await _record_activation_email_send(
        db,
        signup_request_id=signup_request_id,
        activation_token=activation_token,
        sent_by_student_id=sent_by_student_id,
        to_email=to_email,
    )
    return SignupActivationEmailResult(sent_to=sent_to)


async def _record_activation_email_send(
    db: AsyncSession,
    *,
    signup_request_id: int,
    activation_token: str,
    sent_by_student_id: str,
    to_email: str,
) -> None:
    recipient_masked = email_service.mask_email_address(to_email)
    try:
        token_hash, _token_tail = signup_requests_repo.hash_activation_token(
            activation_token
        )
        related_issue_id = (
            await signup_requests_repo.find_latest_issue_log_id_for_token(
                db,
                signup_request_id=signup_request_id,
                token_hash=token_hash,
            )
        )
        await signup_requests_repo.create_activation_issue_log(
            db,
            signup_requests_repo.ActivationIssueLogWrite(
                signup_request_id=signup_request_id,
                issued_type="send",
                issued_by_student_id=sent_by_student_id,
                token=activation_token,
                recipient_masked=recipient_masked,
                related_issue_id=related_issue_id,
            ),
        )
    except SQLAlchemyError as exc:
        log_json(
            logger,
            logging.ERROR,
            "activation_email_audit_failed",
            signup_request_id=signup_request_id,
            sent_by_student_id=sent_by_student_id,
            recipient_masked=recipient_masked,
            error_type=type(exc).__name__,
        )
        try:
            await db.rollback()
        except SQLAlchemyError as rollback_exc:
            log_json(
                logger,
                logging.ERROR,
                "activation_email_audit_rollback_failed",
                signup_request_id=signup_request_id,
                error_type=type(rollback_exc).__name__,
            )
