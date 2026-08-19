from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Literal, cast

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..directory_schemas import DirectoryViewRequestRead, ViewRequestStatusLiteral
from ..errors import ConflictError, ForbiddenError, NotFoundError
from ..models_directory_view import DirectoryViewRequest
from ..repositories import directory_view_requests as view_repo
from ..repositories import members as members_repo
from .members_service import is_directory_details_visible

ViewDecision = Literal["accepted", "declined"]


def _to_read(
    row: DirectoryViewRequest, requester: models.Member
) -> DirectoryViewRequestRead:
    status = cast(str, row.status)
    status_value: ViewRequestStatusLiteral
    if status in ("pending", "accepted", "declined", "revoked"):
        status_value = status
    else:
        status_value = "pending"
    return DirectoryViewRequestRead(
        id=int(cast(int, row.id)),
        requester_id=int(cast(int, row.requester_id)),
        requester_name=cast(str, requester.name),
        requester_cohort=cast(int, requester.cohort),
        target_id=int(cast(int, row.target_id)),
        status=status_value,
        created_at=cast(datetime, row.created_at),
        decided_at=cast(datetime | None, row.decided_at),
    )


async def create_view_request(
    db: AsyncSession,
    *,
    requester: models.Member,
    target_id: int,
) -> DirectoryViewRequestRead:
    requester_id = int(cast(int, requester.id))
    if requester_id == target_id:
        raise ForbiddenError(
            code="view_request_self_not_allowed",
            detail="본인 정보는 요청 없이 확인할 수 있습니다.",
        )
    target = await members_repo.get_member(db, target_id)
    if is_directory_details_visible(
        target,
        viewer_student_id=cast(str, requester.student_id),
        viewer_cohort=cast(int, requester.cohort),
        request_status=None,
    ):
        raise ConflictError(
            code="view_request_not_needed",
            detail="이미 공개된 정보입니다.",
        )
    existing = await view_repo.get_pair(
        db, requester_id=requester_id, target_id=target_id
    )
    if existing is not None:
        current = cast(str, existing.status)
        if current == "pending":
            raise ConflictError(
                code="view_request_already_pending",
                detail="이미 보기 요청을 보냈습니다.",
            )
        if current == "accepted":
            raise ConflictError(
                code="view_request_not_needed",
                detail="이미 공개된 정보입니다.",
            )
        if current not in ("declined", "revoked"):
            raise ConflictError(
                code="view_request_already_pending",
                detail="이미 보기 요청을 보냈습니다.",
            )
        setattr(existing, "status", "pending")
        setattr(existing, "decided_at", None)
        setattr(existing, "created_at", datetime.now(tz=UTC))
        saved = await view_repo.save(db, existing)
        return _to_read(saved, requester)

    row = DirectoryViewRequest(
        requester_id=requester_id,
        target_id=target_id,
        status="pending",
    )
    try:
        saved = await view_repo.create(db, row)
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError(
            code="view_request_already_pending",
            detail="이미 보기 요청을 보냈습니다.",
        ) from exc
    return _to_read(saved, requester)


async def list_incoming_requests(
    db: AsyncSession, *, target_id: int
) -> Sequence[DirectoryViewRequestRead]:
    rows = await view_repo.list_incoming_with_requester(db, target_id=target_id)
    return [_to_read(row, requester) for row, requester in rows]


async def decide_view_request(
    db: AsyncSession,
    *,
    target: models.Member,
    request_id: int,
    decision: ViewDecision,
) -> DirectoryViewRequestRead:
    row = await view_repo.get_by_id(db, request_id)
    if row is None or int(cast(int, row.target_id)) != int(cast(int, target.id)):
        raise NotFoundError(
            code="view_request_not_found",
            detail="보기 요청을 찾을 수 없습니다.",
        )
    if cast(str, row.status) != "pending":
        raise ConflictError(
            code="view_request_not_pending",
            detail="대기 중인 요청만 처리할 수 있습니다.",
        )
    setattr(row, "status", decision)
    setattr(row, "decided_at", datetime.now(tz=UTC))
    saved = await view_repo.save(db, row)
    requester = await members_repo.get_member(db, int(cast(int, saved.requester_id)))
    return _to_read(saved, requester)


async def revoke_view_request(
    db: AsyncSession,
    *,
    target: models.Member,
    request_id: int,
) -> DirectoryViewRequestRead:
    row = await view_repo.get_by_id(db, request_id)
    if row is None or int(cast(int, row.target_id)) != int(cast(int, target.id)):
        raise NotFoundError(
            code="view_request_not_found",
            detail="보기 요청을 찾을 수 없습니다.",
        )
    if cast(str, row.status) != "accepted":
        raise ConflictError(
            code="view_request_not_accepted",
            detail="허용 중인 요청만 철회할 수 있습니다.",
        )
    setattr(row, "status", "revoked")
    setattr(row, "decided_at", datetime.now(tz=UTC))
    saved = await view_repo.save(db, row)
    requester = await members_repo.get_member(db, int(cast(int, saved.requester_id)))
    return _to_read(saved, requester)
