"""프로필 변경 요청 서비스 (이름/기수 — 관리자 승인 기반)."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from typing import cast

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..errors import ConflictError, NotFoundError
from ..repositories import profile_change_requests as pcr_repo

_COHORT_MAX = 2_147_483_647  # PostgreSQL INT4 상한


async def create_change_request(
    db: AsyncSession,
    *,
    member: models.Member,
    data: schemas.ProfileChangeRequestCreate,
) -> models.ProfileChangeRequest:
    """변경 요청 생성."""
    field = data.field_name
    if field == "name":
        old_value = cast(str, member.name)
    else:
        old_value = str(member.cohort)

    if data.new_value == old_value:
        raise ConflictError(
            code="profile_change_same_value",
            detail="현재 값과 동일한 값으로는 변경할 수 없습니다.",
        )

    # 기수인 경우 정수 변환 + INT4 범위 검증
    if field == "cohort":
        try:
            cohort_int = int(data.new_value)
        except ValueError as exc:
            raise ConflictError(
                code="profile_change_invalid_cohort",
                detail="기수는 숫자로 입력해주세요.",
            ) from exc
        if cohort_int < 1 or cohort_int > _COHORT_MAX:
            raise ConflictError(
                code="profile_change_invalid_cohort",
                detail="기수 값이 허용 범위를 초과합니다.",
            )

    # 동일 필드 pending 중복 검사
    existing = await pcr_repo.get_pending_by_member_and_field(
        db, cast(int, member.id), field
    )
    if existing is not None:
        raise ConflictError(
            code="profile_change_already_pending",
            detail="이미 대기 중인 변경 요청이 있습니다.",
        )

    row = models.ProfileChangeRequest(
        member_id=member.id,
        field_name=field,
        old_value=old_value,
        new_value=data.new_value,
    )

    try:
        return await pcr_repo.create(db, row)
    except IntegrityError as exc:
        await db.rollback()
        if "uq_profile_change_requests_member_field_pending" in str(exc.orig):
            raise ConflictError(
                code="profile_change_already_pending",
                detail="이미 대기 중인 변경 요청이 있습니다.",
            ) from exc
        raise


async def list_my_requests(
    db: AsyncSession,
    member_id: int,
) -> Sequence[models.ProfileChangeRequest]:
    """본인 변경 요청 목록."""
    return await pcr_repo.list_by_member(db, member_id)


async def list_requests_with_total(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    status: str | None = None,
    member_id: int | None = None,
) -> tuple[Sequence[models.ProfileChangeRequest], int]:
    """목록 (필터, 페이지네이션)."""
    return await pcr_repo.list_with_total(
        db,
        limit=limit,
        offset=offset,
        status=status,
        member_id=member_id,
    )


async def list_requests_with_member(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    status: str | None = None,
    member_id: int | None = None,
) -> tuple[Sequence[models.ProfileChangeRequest], int]:
    """관리자용 목록 (회원 정보 포함)."""
    return await pcr_repo.list_with_total_and_member(
        db,
        limit=limit,
        offset=offset,
        status=status,
        member_id=member_id,
    )


async def approve_request(
    db: AsyncSession,
    *,
    request_id: int,
    decided_by_student_id: str,
) -> models.ProfileChangeRequest:
    """변경 요청 승인 → member 프로필 반영."""
    row = await pcr_repo.get_by_id(db, request_id)
    if row is None:
        raise NotFoundError(
            code="profile_change_request_not_found",
            detail="변경 요청을 찾을 수 없습니다.",
        )

    if cast(str, row.status) != "pending":
        raise ConflictError(
            code="profile_change_not_pending",
            detail="대기 중인 요청만 처리할 수 있습니다.",
        )

    member = await db.get(models.Member, row.member_id)
    if member is None:
        raise NotFoundError(
            code="member_not_found",
            detail="회원을 찾을 수 없습니다.",
        )

    # member 프로필 + 요청 상태를 같은 세션에서 변경 → 단일 트랜잭션으로 커밋
    field = cast(str, row.field_name)
    new_value: str | int = cast(str, row.new_value)
    if field == "cohort":
        new_value = int(new_value)
    setattr(member, field, new_value)

    setattr(row, "status", "approved")
    setattr(row, "decided_at", datetime.now(tz=UTC))
    setattr(row, "decided_by_student_id", decided_by_student_id)

    return await pcr_repo.save(db, row)


async def reject_request(
    db: AsyncSession,
    *,
    request_id: int,
    decided_by_student_id: str,
    reason: str,
) -> models.ProfileChangeRequest:
    """변경 요청 반려."""
    row = await pcr_repo.get_by_id(db, request_id)
    if row is None:
        raise NotFoundError(
            code="profile_change_request_not_found",
            detail="변경 요청을 찾을 수 없습니다.",
        )

    if cast(str, row.status) != "pending":
        raise ConflictError(
            code="profile_change_not_pending",
            detail="대기 중인 요청만 처리할 수 있습니다.",
        )

    setattr(row, "status", "rejected")
    setattr(row, "decided_at", datetime.now(tz=UTC))
    setattr(row, "decided_by_student_id", decided_by_student_id)
    setattr(row, "reject_reason", reason)

    return await pcr_repo.save(db, row)
