"""관리자 회원 관리 라우터.

직접 회원 생성, 역할 변경, 목록 조회, 수정 엔드포인트를 제공한다.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..services import members_service
from ..services.roles_service import normalize_roles
from .auth import CurrentUser, require_permission, require_super_admin

router = APIRouter(prefix="/admin/members", tags=["admin-members"])

_require_admin_roles = require_permission(
    "admin_roles", allow_admin_fallback=False
)


@dataclass(frozen=True)
class _AdminListParams:
    q: str | None
    cohort: int | None
    sort: str | None
    limit: int
    offset: int


def _parse_admin_list_params(
    q: str | None = Query(None),
    cohort: int | None = Query(None),
    sort: str | None = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> _AdminListParams:
    return _AdminListParams(q=q, cohort=cohort, sort=sort, limit=limit, offset=offset)


def _build_admin_filters(
    p: _AdminListParams,
) -> schemas.MemberListFilters:
    filters: schemas.MemberListFilters = {"exclude_private": False}
    if p.q:
        filters["q"] = p.q
    if p.cohort is not None:
        filters["cohort"] = p.cohort
    if p.sort:
        filters["sort"] = p.sort
    return filters


@router.get("/", response_model=list[schemas.MemberRead])
async def list_members_admin(
    _actor: Annotated[CurrentUser, Depends(_require_admin_roles)],
    params: _AdminListParams = Depends(_parse_admin_list_params),
    db: AsyncSession = Depends(get_db),
) -> list[schemas.MemberRead]:
    """관리자용 회원 목록 (비공개 포함)."""
    filters = _build_admin_filters(params)
    rows = await members_service.list_members(
        db, limit=params.limit, offset=params.offset, filters=filters
    )
    return [schemas.MemberRead.model_validate(r) for r in rows]


@router.get("/count")
async def count_members_admin(
    _actor: Annotated[CurrentUser, Depends(_require_admin_roles)],
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(None),
    cohort: int | None = Query(None),
) -> dict[str, int]:
    """관리자용 회원 수."""
    filters: schemas.MemberListFilters = {"exclude_private": False}
    if q:
        filters["q"] = q
    if cohort is not None:
        filters["cohort"] = cohort
    count = await members_service.count_members(db, filters=filters)
    return {"count": count}


@router.post(
    "/",
    response_model=schemas.DirectMemberCreateResponse,
    status_code=201,
)
async def create_member_direct(
    payload: schemas.DirectMemberCreatePayload,
    _actor: Annotated[CurrentUser, Depends(require_super_admin)],
    db: AsyncSession = Depends(get_db),
) -> schemas.DirectMemberCreateResponse:
    """관리자 직접 회원 생성 + 활성화 링크 발급."""
    member, activation_token = await members_service.create_member_direct(
        db, payload
    )
    return schemas.DirectMemberCreateResponse(
        member=schemas.MemberRead.model_validate(member),
        activation_token=activation_token,
    )


@router.patch(
    "/{member_id}",
    response_model=schemas.MemberRead,
)
async def update_member_admin(
    member_id: int,
    payload: schemas.AdminMemberUpdate,
    _actor: Annotated[CurrentUser, Depends(require_super_admin)],
    db: AsyncSession = Depends(get_db),
) -> schemas.MemberRead:
    """관리자 회원 정보 수정 (roles 제외)."""
    updated = await members_service.update_member_profile_admin(
        db, member_id=member_id, data=payload
    )
    return schemas.MemberRead.model_validate(updated)


@router.patch(
    "/{member_id}/roles",
    response_model=schemas.MemberRolesUpdateResponse,
)
async def update_member_roles(
    member_id: int,
    payload: schemas.MemberRolesUpdatePayload,
    actor: Annotated[CurrentUser, Depends(require_super_admin)],
    db: AsyncSession = Depends(get_db),
) -> schemas.MemberRolesUpdateResponse:
    """회원 역할 변경 (승격/강등)."""
    updated = await members_service.update_member_roles(
        db,
        member_id=member_id,
        actor_student_id=actor.student_id,
        roles=payload.roles,
    )
    return schemas.MemberRolesUpdateResponse(
        student_id=str(updated.student_id),
        roles=normalize_roles(str(updated.roles)),
    )
