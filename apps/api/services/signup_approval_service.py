"""가입 신청 승인·토큰 재발급: 충돌 판정, 회원 생성/재사용, 안내 메일 자동 발송.

잠금 순서(교착 방지): 신청 행(`FOR UPDATE`) → 학번 키 advisory lock → 이메일
advisory lock → 재사용 후보 회원 행(`FOR UPDATE`). 공개 접수는 학번 키 잠금만,
반려는 신청 행 잠금만 잡는다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from typing import Literal, cast

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..error_messages import looks_like_stable_code
from ..errors import ApiError, ConflictError, NotFoundError
from ..logging_utils import log_json
from ..repositories import auth as auth_repo
from ..repositories import members as members_repo
from ..repositories import signup_requests as signup_requests_repo
from .roles_service import normalize_roles
from .signup_service import (
    SignupActivationContext,
    issue_activation_token,
    resolve_activation_recipient,
    send_signup_activation_email,
)

logger = logging.getLogger(__name__)

_UNIQUE_VIOLATION = "23505"

ActivationEmailStatus = Literal["sent", "failed"]


@dataclass(frozen=True)
class SignupActivationEmailOutcome:
    """승인·재발급 직후 자동 발송 결과."""

    status: ActivationEmailStatus
    sent_to: str | None = None
    error_code: str | None = None


@dataclass(frozen=True)
class SignupActivationIssueOutcome:
    """발송 전에 확보한 응답 스냅샷. 발송 단계가 실패해도 재조회 없이 응답한다."""

    request: schemas.SignupRequestRead
    context: SignupActivationContext
    token: str
    issue_log: schemas.SignupActivationIssueLogRead
    email: SignupActivationEmailOutcome


async def approve_signup_request(
    db: AsyncSession,
    *,
    signup_request_id: int,
    decided_by_student_id: str,
) -> SignupActivationIssueOutcome:
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
            detail="대기 중인 신청만 승인할 수 있습니다.",
        )

    await signup_requests_repo.lock_student_key(db, cast(str, row.student_id))
    await signup_requests_repo.lock_email(db, cast(str, row.email))

    member = await _resolve_member_for_approval(db, row)
    if member is None:
        member = models.Member(
            student_id=row.student_id,
            email=row.email,
            name=row.name,
            cohort=row.cohort,
            major=row.major,
            roles="member",
            status="active",
            visibility=models.Visibility.PRIVATE,
        )
        db.add(member)
    else:
        # 재사용 판정에서 기존 이메일은 비어 있거나 신청 이메일과 같다(대소문자·공백
        # 무시). 같으면 저장된 표기를 유지하고, 비어 있을 때만 채운다.
        if not _normalized_email(cast(str | None, member.email)):
            setattr(member, "email", cast(str, row.email))
        setattr(member, "name", cast(str, row.name))
        setattr(member, "cohort", cast(int, row.cohort))
        setattr(member, "major", cast(str | None, row.major))
        setattr(member, "status", "active")
        if cast(datetime | None, member.directory_consent_at) is None:
            setattr(member, "visibility", models.Visibility.PRIVATE)

    setattr(row, "status", "approved")
    setattr(row, "decided_at", datetime.now(tz=UTC))
    setattr(row, "decided_by_student_id", decided_by_student_id)
    setattr(row, "reject_reason", None)

    try:
        issue = await issue_activation_token(
            db,
            row=row,
            issued_by_student_id=decided_by_student_id,
            issued_type="approve",
            member_email=cast(str | None, member.email),
        )
        await db.refresh(row)
        request_snapshot = schemas.SignupRequestRead.model_validate(row)
        issue_snapshot = schemas.SignupActivationIssueLogRead.model_validate(
            issue.issue_log
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if getattr(exc.orig, "sqlstate", None) != _UNIQUE_VIOLATION:
            raise
        # 사전 확인 이후 다른 경로의 쓰기로 학번/이메일이 겹친 경우(500 금지).
        raise ConflictError(
            code="signup_approve_conflict",
            detail=(
                "다른 회원 정보와 학번 또는 이메일이 겹쳐 승인하지 못했습니다. "
                "목록을 새로 고친 뒤 같은 분인지 확인해 주세요."
            ),
        ) from exc

    email = await _send_activation_email_after_commit(
        db,
        signup_request_id=signup_request_id,
        activation_token=issue.token,
        sent_by_student_id=decided_by_student_id,
    )
    return SignupActivationIssueOutcome(
        request=request_snapshot,
        context=issue.context,
        token=issue.token,
        issue_log=issue_snapshot,
        email=email,
    )


async def reissue_signup_activation_token(
    db: AsyncSession,
    *,
    signup_request_id: int,
    issued_by_student_id: str,
) -> SignupActivationIssueOutcome:
    """토큰을 재발급하고 새 링크를 회원의 현재 이메일로 바로 보낸다.

    신청 행을 잠근 뒤 상태를 판정하고, 응답 스냅샷을 커밋 전에 확보한다. 발송
    실패는 재발급을 되돌리지 않는다. 응답의 토큰으로 다시 보내거나 링크를 복사해
    전달할 수 있다.
    """
    row = await signup_requests_repo.get_signup_request_for_update(
        db, signup_request_id
    )
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

    recipient = await _current_recipient(db, row)
    issue = await issue_activation_token(
        db,
        row=row,
        issued_by_student_id=issued_by_student_id,
        issued_type="reissue",
        member_email=recipient,
    )
    request_snapshot = schemas.SignupRequestRead.model_validate(row)
    issue_snapshot = schemas.SignupActivationIssueLogRead.model_validate(
        issue.issue_log
    )
    # 화면의 "보낼 주소"는 실제 수신 주소다. 보낼 수 없으면 비워 둔다.
    context = replace(issue.context, email=recipient or "")
    await db.commit()

    email = await _send_activation_email_after_commit(
        db,
        signup_request_id=signup_request_id,
        activation_token=issue.token,
        sent_by_student_id=issued_by_student_id,
    )
    return SignupActivationIssueOutcome(
        request=request_snapshot,
        context=context,
        token=issue.token,
        issue_log=issue_snapshot,
        email=email,
    )


async def _current_recipient(
    db: AsyncSession, row: models.SignupRequest
) -> str | None:
    """회원의 현재 이메일. 보낼 수 없는 상태(회원 없음·비활성·이메일 없음)면 None."""
    try:
        return await resolve_activation_recipient(db, row)
    except ApiError:
        return None


def _normalized_email(value: str | None) -> str:
    return (value or "").strip().lower()


async def _is_reusable_member(db: AsyncSession, member: models.Member) -> bool:
    """일반 가입 승인으로 재사용해도 되는 사전 등록 회원인지(잠근 최신 행 기준).

    `pending` 상태이고, 비밀번호(`member_auth`)가 없고, 역할이 일반 `member`뿐인
    경우만 허용한다. 정지·반려 회원이나 비밀번호·운영 역할이 있는 계정을
    신청서 이메일로 활성화하면 그 주소 수신인이 기존 계정을 넘겨받게 된다.
    """
    if cast(str, member.status) != "pending":
        return False
    if set(normalize_roles(cast(str, member.roles))) - {"member"}:
        return False
    return not await auth_repo.member_has_auth(db, cast(int, member.id))


def _member_exists_error(student_id: str) -> ConflictError:
    return ConflictError(
        code="signup_member_exists",
        detail=(
            f"이미 가입된 회원(학번 {student_id})이 있습니다. 같은 분이면 이 "
            "신청은 반려하고, 첫 로그인 설정 전이라면 기존 승인 건에서 안내 "
            "메일을 다시 보내 주세요."
        ),
    )


async def _resolve_member_for_approval(
    db: AsyncSession,
    row: models.SignupRequest,
) -> models.Member | None:
    """재사용할 기존 회원(학번 완전 일치·사전 등록)을 찾고 충돌은 409로 거절한다."""
    student_id = cast(str, row.student_id)
    members = await members_repo.list_members_by_student_key(db, student_id)
    for candidate in members:
        if cast(str, candidate.status) == "active":
            raise _member_exists_error(cast(str, candidate.student_id))
    exact = next(
        (m for m in members if cast(str, m.student_id) == student_id), None
    )
    variant = next((m for m in members if m is not exact), None)
    if variant is not None:
        # 활성화·로그인은 학번 완전 일치로 회원을 찾으므로, 표기가 다른 회원을
        # 이 신청 학번으로 활성화하면 첫 로그인 설정이 실패한다.
        raise ConflictError(
            code="signup_member_student_id_variant",
            detail=(
                f"학번 표기만 다른 기존 회원 정보(학번 "
                f"{cast(str, variant.student_id)})가 있어 승인할 수 없습니다. "
                "같은 분인지 확인한 뒤 회원 정보를 정리하거나 이 신청을 "
                "반려해 주세요."
            ),
        )
    if exact is not None:
        # 회원 관리의 정지·권한 부여가 판정과 쓰기 사이에 끼어들지 못하게 잠그고
        # 최신 값으로 다시 판정한다(잠금 순서의 마지막).
        exact = await members_repo.get_member_for_update(db, cast(int, exact.id))
    if exact is not None:
        if cast(str, exact.status) == "active":
            raise _member_exists_error(student_id)
        if not await _is_reusable_member(db, exact):
            raise ConflictError(
                code="signup_member_account_exists",
                detail=(
                    f"이 학번(학번 {student_id})으로 이미 만들어진 계정이 있어 "
                    "일반 가입 승인으로 처리할 수 없습니다. 회원 관리에서 계정 "
                    "상태를 확인해 처리하고, 이 신청은 반려해 주세요."
                ),
            )
        existing_email = _normalized_email(cast(str | None, exact.email))
        if existing_email and existing_email != _normalized_email(
            cast(str, row.email)
        ):
            # 사전 등록 행의 프로필(연락처·주소 등)을 다른 주소 수신인에게
            # 넘기지 않도록, 본인 확인 후 운영자가 이메일을 정정하게 한다.
            raise ConflictError(
                code="signup_member_email_mismatch",
                detail=(
                    f"기존 회원 정보(학번 {student_id})의 이메일과 신청 이메일이 "
                    "다릅니다. 회원 관리에서 본인 확인 후 이메일을 정정한 뒤 "
                    "다시 승인해 주세요."
                ),
            )

    email_owner = await members_repo.find_member_by_email_ci(
        db,
        cast(str, row.email),
        exclude_member_id=cast(int, exact.id) if exact is not None else None,
    )
    if email_owner is not None:
        raise ConflictError(
            code="signup_email_in_use",
            detail=(
                f"신청 이메일을 이미 다른 회원(학번 "
                f"{cast(str, email_owner.student_id)})이 사용하고 있습니다. "
                "같은 분인지 확인한 뒤 이 신청을 반려하거나, 회원 정보의 "
                "이메일을 정리한 뒤 다시 승인해 주세요."
            ),
        )
    return exact


# 승인 커밋 이후 발송·감사 기록에서 날 수 있는 예외. 넓은 except 대신 명시한다.
# SMTP 오류(smtplib.SMTPException)는 OSError, 인코딩 오류는 ValueError에 속한다.
_POST_COMMIT_SEND_ERRORS = (
    SQLAlchemyError,
    OSError,
    ValueError,
    TypeError,
    LookupError,
    RuntimeError,
)


async def _send_activation_email_after_commit(
    db: AsyncSession,
    *,
    signup_request_id: int,
    activation_token: str,
    sent_by_student_id: str,
) -> SignupActivationEmailOutcome:
    """승인·재발급 커밋 이후 안내 메일을 보낸다.

    `ApiError`·`HTTPException`과 `_POST_COMMIT_SEND_ERRORS`에 든 예외는 `failed`
    결과로 격리해 응답(200)을 지킨다. 그 밖의 예상 밖 예외는 500이 될 수 있으며,
    이때도 승인·발급은 이미 커밋돼 있으므로 토큰 재발급으로 복구한다.
    """
    try:
        result = await send_signup_activation_email(
            db,
            signup_request_id=signup_request_id,
            activation_token=activation_token,
            sent_by_student_id=sent_by_student_id,
        )
        return SignupActivationEmailOutcome(status="sent", sent_to=result.sent_to)
    except ApiError as exc:
        error_code = exc.code
        error_type = type(exc).__name__
    except HTTPException as exc:
        # 토큰·신청 상태 확인 실패(invalid_or_expired_activation_token 등).
        error_code = (
            exc.detail if looks_like_stable_code(exc.detail) else "email_send_failed"
        )
        error_type = type(exc).__name__
    except _POST_COMMIT_SEND_ERRORS as exc:
        # 이미 커밋된 승인·발급을 500으로 바꾸지 않는다(DB 장애, 메일 생성 오류 등).
        logger.exception(
            "activation_email_auto_send_unexpected_error",
            extra={"signup_request_id": signup_request_id},
        )
        error_code = "email_send_failed"
        error_type = type(exc).__name__
        await _rollback_quietly(db, signup_request_id=signup_request_id)
    log_json(
        logger,
        logging.WARNING,
        "activation_email_auto_send_failed",
        signup_request_id=signup_request_id,
        error_code=error_code,
        error_type=error_type,
    )
    return SignupActivationEmailOutcome(status="failed", error_code=error_code)


async def _rollback_quietly(db: AsyncSession, *, signup_request_id: int) -> None:
    try:
        await db.rollback()
    except (SQLAlchemyError, OSError):
        logger.exception(
            "activation_email_auto_send_rollback_failed",
            extra={"signup_request_id": signup_request_id},
        )
