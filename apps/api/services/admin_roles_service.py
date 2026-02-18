from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..errors import ApiError, NotFoundError
from ..repositories import auth as auth_repo
from ..repositories import members as members_repo
from .roles_service import (
    RoleGradeLiteral,
    normalize_assignable_roles,
    normalize_roles,
    parse_roles,
    serialize_roles,
)


@dataclass(frozen=True)
class AdminRoleView:
    student_id: str
    email: str | None
    name: str | None
    has_member_record: bool
    roles: list[str]
    grade: RoleGradeLiteral
    permissions: list[str]


def _build_admin_role_view(
    admin_user: models.AdminUser,
    member: models.Member | None,
) -> AdminRoleView:
    if member is None:
        return AdminRoleView(
            student_id=cast(str, admin_user.student_id),
            email=cast(str | None, admin_user.email),
            name=None,
            has_member_record=False,
            roles=[],
            grade="member",
            permissions=[],
        )

    profile = parse_roles(cast(str, member.roles))
    normalized_roles = normalize_roles(cast(str, member.roles))
    return AdminRoleView(
        student_id=cast(str, admin_user.student_id),
        email=cast(str | None, admin_user.email),
        name=cast(str | None, member.name),
        has_member_record=True,
        roles=normalized_roles,
        grade=profile.grade,
        permissions=sorted(list(profile.permissions)),
    )


async def list_admin_role_views(db: AsyncSession) -> Sequence[AdminRoleView]:
    admin_users = await auth_repo.list_admin_users(db)
    student_ids = [cast(str, row.student_id) for row in admin_users]
    members = await members_repo.list_members_by_student_ids(db, student_ids)
    by_student_id = {
        cast(str, member.student_id): member
        for member in members
    }
    return [
        _build_admin_role_view(
            admin_user,
            by_student_id.get(cast(str, admin_user.student_id)),
        )
        for admin_user in admin_users
    ]


async def update_admin_user_roles(
    db: AsyncSession,
    *,
    target_student_id: str,
    roles: object,
) -> AdminRoleView:
    admin_user = await auth_repo.get_admin_by_student_id(db, target_student_id)
    if admin_user is None:
        raise NotFoundError(
            code="admin_user_not_found",
            detail="AdminUser not found",
        )

    try:
        member = await members_repo.get_member_by_student_id(db, target_student_id)
    except NotFoundError:
        raise ApiError(
            code="admin_member_record_missing",
            detail="Member record for admin user not found",
            status=409,
        ) from None

    normalized_roles = normalize_assignable_roles(roles)
    if "admin" not in normalized_roles and "super_admin" not in normalized_roles:
        raise ApiError(
            code="admin_grade_required",
            detail="At least one of admin/super_admin is required",
            status=422,
        )

    serialized = serialize_roles(normalized_roles)
    updated = await members_repo.update_member_roles(
        db, member=member, roles=serialized
    )
    return _build_admin_role_view(admin_user, updated)
