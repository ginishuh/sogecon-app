from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import cast

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
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

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AdminRoleView:
    student_id: str
    email: str | None
    name: str | None
    has_member_record: bool
    roles: list[str]
    grade: RoleGradeLiteral
    permissions: list[str]


@dataclass(frozen=True)
class AdminUserCreateCommand:
    student_id: str
    email: str
    name: str
    cohort: int
    temporary_password: str
    roles: list[str]


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


async def _find_member_by_student_id(
    db: AsyncSession, student_id: str
) -> models.Member | None:
    stmt = select(models.Member).where(models.Member.student_id == student_id)
    result = await db.execute(stmt)
    return result.scalars().first()


async def _find_member_by_email(
    db: AsyncSession, email: str
) -> models.Member | None:
    stmt = select(models.Member).where(models.Member.email == email)
    result = await db.execute(stmt)
    return result.scalars().first()


async def create_admin_user(
    db: AsyncSession,
    *,
    actor_student_id: str,
    command: AdminUserCreateCommand,
) -> AdminRoleView:
    if await auth_repo.get_admin_by_student_id(db, command.student_id) is not None:
        raise ApiError(
            code="admin_user_already_exists",
            detail="AdminUser already exists",
            status=409,
        )

    normalized_roles = normalize_assignable_roles(command.roles)
    if "admin" not in normalized_roles and "super_admin" not in normalized_roles:
        raise ApiError(
            code="admin_grade_required",
            detail="At least one of admin/super_admin is required",
            status=422,
        )
    serialized_roles = serialize_roles(normalized_roles)
    bcrypt = __import__("bcrypt")
    password_hash = bcrypt.hashpw(
        command.temporary_password.encode(), bcrypt.gensalt()
    ).decode()

    member = await _find_member_by_student_id(db, command.student_id)
    if member is None:
        member_with_email = await _find_member_by_email(db, command.email)
        if member_with_email is not None:
            raise ApiError(
                code="member_email_already_in_use",
                detail="Email is already used by another member",
                status=409,
            )
        member = models.Member(
            student_id=command.student_id,
            email=command.email,
            name=command.name,
            cohort=command.cohort,
            roles=serialized_roles,
            status="active",
            visibility=models.Visibility.ALL,
        )
        db.add(member)
        await db.flush()
    else:
        member_email = cast(str | None, member.email)
        if isinstance(member_email, str) and member_email != command.email:
            raise ApiError(
                code="member_email_mismatch",
                detail="Existing member email does not match payload",
                status=409,
            )
        if member_email is None:
            setattr(member, "email", command.email)
        setattr(member, "roles", serialized_roles)
        setattr(member, "status", "active")

    admin_user = models.AdminUser(
        student_id=command.student_id,
        email=command.email,
        password_hash=password_hash,
    )
    db.add(admin_user)

    auth_row = await auth_repo.get_member_auth_by_student_id(db, command.student_id)
    if auth_row is None:
        db.add(
            models.MemberAuth(
                member_id=cast(int, member.id),
                student_id=command.student_id,
                password_hash=password_hash,
            )
        )
    else:
        setattr(auth_row, "member_id", cast(int, member.id))
        setattr(auth_row, "password_hash", password_hash)

    try:
        await db.commit()
    except IntegrityError as err:
        await db.rollback()
        raise ApiError(
            code="admin_user_create_conflict",
            detail="Failed to create admin user due to conflict",
            status=409,
        ) from err

    await db.refresh(admin_user)
    await db.refresh(member)
    logger.info(
        "admin_user_created target=%s by=%s",
        command.student_id,
        actor_student_id,
    )
    return _build_admin_role_view(admin_user, member)


async def update_admin_user_roles(
    db: AsyncSession,
    *,
    target_student_id: str,
    actor_student_id: str,
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

    previous_roles = cast(str, member.roles)
    previous_profile = parse_roles(previous_roles)
    normalized_roles = normalize_assignable_roles(roles)

    if (
        target_student_id == actor_student_id
        and "super_admin" not in normalized_roles
    ):
        raise ApiError(
            code="self_demotion_forbidden",
            detail="Cannot remove super_admin from yourself",
            status=422,
        )

    if "admin" not in normalized_roles and "super_admin" not in normalized_roles:
        raise ApiError(
            code="admin_grade_required",
            detail="At least one of admin/super_admin is required",
            status=422,
        )

    if (
        previous_profile.grade == "super_admin"
        and "super_admin" not in normalized_roles
    ):
        views = await list_admin_role_views(db)
        super_admin_count = len(
            [view for view in views if view.grade == "super_admin"]
        )
        if super_admin_count <= 1:
            raise ApiError(
                code="last_super_admin_forbidden",
                detail="Cannot remove the last super_admin",
                status=422,
            )

    serialized = serialize_roles(normalized_roles)
    updated = await members_repo.update_member_roles(
        db, member=member, roles=serialized
    )
    logger.info(
        "roles_updated target=%s by=%s old=%s new=%s",
        target_student_id,
        actor_student_id,
        previous_roles,
        serialized,
    )
    return _build_admin_role_view(admin_user, updated)
