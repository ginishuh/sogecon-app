"""관리자 회원 관리 라우터.

직접 회원 생성 및 역할 변경 엔드포인트를 제공한다.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..services import members_service
from ..services.roles_service import normalize_roles
from .auth import CurrentUser, require_super_admin

router = APIRouter(prefix="/admin/members", tags=["admin-members"])


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
