from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..services import admin_roles_service
from .auth import CurrentUser, require_permission, require_super_admin

router = APIRouter(prefix="/admin/admin-users", tags=["admin-roles"])


@router.get("/", response_model=schemas.AdminUserRolesListResponse)
async def list_admin_users(
    _admin: Annotated[
        CurrentUser,
        Depends(require_permission("admin_roles", allow_admin_fallback=False)),
    ],
    db: AsyncSession = Depends(get_db),
) -> schemas.AdminUserRolesListResponse:
    rows = await admin_roles_service.list_admin_role_views(db)
    items = [
        schemas.AdminUserRolesRead(
            student_id=row.student_id,
            email=row.email,
            name=row.name,
            has_member_record=row.has_member_record,
            roles=row.roles,
            grade=row.grade,
            permissions=row.permissions,
        )
        for row in rows
    ]
    return schemas.AdminUserRolesListResponse(items=items, total=len(items))


@router.patch(
    "/{student_id}/roles",
    response_model=schemas.AdminUserRolesUpdateResponse,
)
async def patch_admin_user_roles(
    student_id: str,
    payload: schemas.AdminUserRolesUpdatePayload,
    actor: Annotated[CurrentUser, Depends(require_super_admin)],
    db: AsyncSession = Depends(get_db),
) -> schemas.AdminUserRolesUpdateResponse:
    updated = await admin_roles_service.update_admin_user_roles(
        db,
        target_student_id=student_id,
        actor_student_id=actor.student_id,
        roles=payload.roles,
    )
    updated_read = schemas.AdminUserRolesRead(
        student_id=updated.student_id,
        email=updated.email,
        name=updated.name,
        has_member_record=updated.has_member_record,
        roles=updated.roles,
        grade=updated.grade,
        permissions=updated.permissions,
    )
    return schemas.AdminUserRolesUpdateResponse(
        updated=updated_read,
        decided_by_student_id=actor.student_id,
    )


@router.post(
    "/",
    response_model=schemas.AdminUserCreateResponse,
    status_code=201,
)
async def create_admin_user(
    payload: schemas.AdminUserCreatePayload,
    actor: Annotated[CurrentUser, Depends(require_super_admin)],
    db: AsyncSession = Depends(get_db),
) -> schemas.AdminUserCreateResponse:
    created = await admin_roles_service.create_admin_user(
        db,
        actor_student_id=actor.student_id,
        command=admin_roles_service.AdminUserCreateCommand(
            student_id=payload.student_id,
            email=str(payload.email),
            name=payload.name,
            cohort=payload.cohort,
            temporary_password=payload.temporary_password,
            roles=payload.roles,
        ),
    )
    created_read = schemas.AdminUserRolesRead(
        student_id=created.student_id,
        email=created.email,
        name=created.name,
        has_member_record=created.has_member_record,
        roles=created.roles,
        grade=created.grade,
        permissions=created.permissions,
    )
    return schemas.AdminUserCreateResponse(
        created=created_read,
        created_by_student_id=actor.student_id,
    )
