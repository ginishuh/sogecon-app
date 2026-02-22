"""관리자 프로필 변경 요청 심사 API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..services import profile_change_service
from ..services.auth_service import (
    CurrentUser,
    require_permission,
)

router = APIRouter(
    prefix="/admin/profile-change-requests",
    tags=["admin-profile-changes"],
)


class ProfileChangeRequestListParams(BaseModel):
    limit: int = Query(20, ge=1, le=100)
    offset: int = Query(0, ge=0)
    status: schemas.ProfileChangeRequestStatusLiteral | None = Query(default=None)
    member_id: int | None = Query(default=None)


class ProfileChangeRequestListResponse(BaseModel):
    items: list[schemas.ProfileChangeRequestRead]
    total: int


@router.get("/", response_model=ProfileChangeRequestListResponse)
async def list_profile_change_requests(
    params: ProfileChangeRequestListParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(
        require_permission("admin_profile", allow_admin_fallback=False)
    ),
) -> ProfileChangeRequestListResponse:
    rows, total = await profile_change_service.list_requests_with_member(
        db,
        limit=params.limit,
        offset=params.offset,
        status=params.status,
        member_id=params.member_id,
    )
    return ProfileChangeRequestListResponse(
        items=[
            schemas.ProfileChangeRequestRead.model_validate(row) for row in rows
        ],
        total=total,
    )


@router.post(
    "/{request_id}/approve",
    response_model=schemas.ProfileChangeRequestRead,
)
async def approve_profile_change_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(
        require_permission("admin_profile", allow_admin_fallback=False)
    ),
) -> schemas.ProfileChangeRequestRead:
    row = await profile_change_service.approve_request(
        db,
        request_id=request_id,
        decided_by_student_id=user.student_id,
    )
    return schemas.ProfileChangeRequestRead.model_validate(row)


@router.post(
    "/{request_id}/reject",
    response_model=schemas.ProfileChangeRequestRead,
)
async def reject_profile_change_request(
    request_id: int,
    payload: schemas.ProfileChangeRequestReject,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(
        require_permission("admin_profile", allow_admin_fallback=False)
    ),
) -> schemas.ProfileChangeRequestRead:
    row = await profile_change_service.reject_request(
        db,
        request_id=request_id,
        decided_by_student_id=user.student_id,
        reason=payload.reason,
    )
    return schemas.ProfileChangeRequestRead.model_validate(row)
