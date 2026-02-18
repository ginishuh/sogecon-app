from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import cast

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..errors import ConflictError, NotFoundError
from ..repositories import signup_requests as signup_requests_repo


@dataclass(frozen=True)
class SignupActivationContext:
    signup_request_id: int
    student_id: str
    email: str
    name: str
    cohort: int


async def create_signup_request(
    db: AsyncSession,
    payload: schemas.SignupRequestCreate,
) -> models.SignupRequest:
    member_stmt = select(models.Member).where(
        models.Member.student_id == payload.student_id
    )
    existing_member = (await db.execute(member_stmt)).scalars().first()
    if existing_member is not None and cast(str, existing_member.status) == "active":
        raise ConflictError(
            code="member_already_active",
            detail="이미 활성화된 회원입니다.",
        )

    pending_row = await signup_requests_repo.get_pending_by_student_id(
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


async def approve_signup_request(
    db: AsyncSession,
    *,
    signup_request_id: int,
    decided_by_student_id: str,
) -> tuple[models.SignupRequest, SignupActivationContext]:
    row = await signup_requests_repo.get_signup_request_by_id(db, signup_request_id)
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

    member_stmt = select(models.Member).where(
        models.Member.student_id == row.student_id
    )
    member = (await db.execute(member_stmt)).scalars().first()
    if member is None:
        member = models.Member(
            student_id=row.student_id,
            email=row.email,
            name=row.name,
            cohort=row.cohort,
            major=row.major,
            roles="member",
            status="active",
            visibility=models.Visibility.ALL,
        )
        db.add(member)
    else:
        if cast(str, member.status) == "active":
            raise ConflictError(
                code="member_already_active",
                detail="이미 활성화된 회원입니다.",
            )
        setattr(member, "email", cast(str, row.email))
        setattr(member, "name", cast(str, row.name))
        setattr(member, "cohort", cast(int, row.cohort))
        setattr(member, "major", cast(str | None, row.major))
        setattr(member, "status", "active")

    setattr(row, "status", "approved")
    setattr(row, "decided_at", datetime.now(tz=UTC))
    setattr(row, "decided_by_student_id", decided_by_student_id)
    setattr(row, "reject_reason", None)

    row = await signup_requests_repo.save_signup_request(db, row)
    context = SignupActivationContext(
        signup_request_id=cast(int, row.id),
        student_id=cast(str, row.student_id),
        email=cast(str, row.email),
        name=cast(str, row.name),
        cohort=cast(int, row.cohort),
    )
    return row, context


async def reject_signup_request(
    db: AsyncSession,
    *,
    signup_request_id: int,
    decided_by_student_id: str,
    reject_reason: str,
) -> models.SignupRequest:
    row = await signup_requests_repo.get_signup_request_by_id(db, signup_request_id)
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
