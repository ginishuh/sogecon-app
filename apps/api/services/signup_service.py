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
    commit: bool = True,
) -> SignupActivationIssueResult:
    context = _build_activation_context(row)
    token = create_member_activation_token(
        signup_request_id=context.signup_request_id,
        student_id=context.student_id,
        cohort=context.cohort,
        name=context.name,
    )
    issue_log = await signup_requests_repo.create_activation_issue_log(
        db,
        signup_requests_repo.ActivationIssueLogWrite(
            signup_request_id=context.signup_request_id,
            issued_type=issued_type,
            issued_by_student_id=issued_by_student_id,
            token=token,
        ),
        commit=commit,
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
    # 학번 표기만 다른 재신청(`S61041` ↔ `61041`)도 같은 사람으로 본다.
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


async def reissue_signup_activation_token(
    db: AsyncSession,
    *,
    signup_request_id: int,
    issued_by_student_id: str,
) -> tuple[models.SignupRequest, SignupActivationIssueResult]:
    row = await signup_requests_repo.get_signup_request_by_id(db, signup_request_id)
    if row is None:
        raise NotFoundError(
            code="signup_request_not_found",
            detail="가입신청을 찾을 수 없습니다.",
        )

    if cast(str, row.status) != "approved":
        raise ConflictError(
            code="signup_request_not_approved",
            detail="승인 완료된 신청만 토큰을 재발급할 수 있습니다.",
        )

    issue = await issue_activation_token(
        db,
        row=row,
        issued_by_student_id=issued_by_student_id,
        issued_type="reissue",
    )
    return row, issue


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
    to_email = cast(str, row.email).strip()
    if not to_email:
        raise ConflictError(code="email_recipient_missing")

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
