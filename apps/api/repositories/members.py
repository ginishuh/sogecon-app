from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Any, cast

from sqlalchemy import and_, exists, func, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from sqlalchemy.sql.elements import ColumnElement

from .. import models, schemas
from ..errors import NotFoundError
from ..models_directory_view import DirectoryViewRequest
from . import escape_like

_SUPER_ADMIN_ROLE_LOCK_ID = 0x534F4745434F4E


def _viewer_aliases(
    viewer_student_id: str,
) -> tuple[Any, ColumnElement[Any], ColumnElement[Any]]:
    viewer = aliased(models.Member)
    viewer_cohort = (
        select(viewer.cohort)
        .where(viewer.student_id == viewer_student_id)
        .scalar_subquery()
    )
    viewer_id = (
        select(viewer.id)
        .where(viewer.student_id == viewer_student_id)
        .scalar_subquery()
    )
    return viewer, viewer_cohort, viewer_id


def _details_visible_clause(viewer_student_id: str) -> ColumnElement[bool]:
    _viewer, viewer_cohort, viewer_id = _viewer_aliases(viewer_student_id)
    grant = aliased(DirectoryViewRequest)
    granted = exists(
        select(grant.id).where(
            grant.requester_id == viewer_id,
            grant.target_id == models.Member.id,
            grant.status == "accepted",
        )
    )
    return or_(
        models.Member.student_id == viewer_student_id,
        models.Member.visibility == models.Visibility.ALL,
        and_(
            models.Member.visibility == models.Visibility.COHORT,
            models.Member.cohort == viewer_cohort,
        ),
        granted,
    )


def _build_member_conditions(
    filters: schemas.MemberListFilters,
    *,
    viewer_student_id: str | None = None,
) -> list[ColumnElement[bool]]:
    conds: list[ColumnElement[bool]] = []
    visible = (
        _details_visible_clause(viewer_student_id)
        if viewer_student_id is not None
        else None
    )
    qv = filters.get('q')
    if qv:
        like = f"%{escape_like(qv)}%"
        identity_match = or_(
            models.Member.email.ilike(like, escape="\\"),
            models.Member.student_id.ilike(like, escape="\\"),
        )
        if visible is not None:
            conds.append(
                or_(
                    models.Member.name.ilike(like, escape="\\"),
                    and_(visible, identity_match),
                )
            )
        else:
            conds.append(
                or_(
                    models.Member.name.ilike(like, escape="\\"),
                    identity_match,
                )
            )

    cohort = filters.get('cohort')
    if cohort is not None:
        conds.append(models.Member.cohort == int(cohort))

    for key, column in (
        ('major', models.Member.major),
        ('company', models.Member.company),
        ('industry', models.Member.industry),
    ):
        value = filters.get(key)
        if value:
            match = column.ilike(f"%{escape_like(value)}%", escape="\\")
            conds.append(and_(visible, match) if visible is not None else match)

    region = filters.get('region')
    if region:
        like = f"%{escape_like(region)}%"
        match = or_(
            models.Member.addr_personal.ilike(like, escape="\\"),
            models.Member.addr_company.ilike(like, escape="\\"),
        )
        conds.append(and_(visible, match) if visible is not None else match)

    job_title = filters.get('job_title')
    if job_title:
        match = models.Member.job_title.ilike(
            f"%{escape_like(job_title)}%", escape="\\"
        )
        conds.append(and_(visible, match) if visible is not None else match)

    if viewer_student_id is not None:
        _viewer, viewer_cohort, _viewer_id = _viewer_aliases(viewer_student_id)
        conds.append(viewer_cohort.is_not(None))
    elif filters.get('exclude_private', True):
        conds.append(models.Member.visibility != models.Visibility.PRIVATE)
    return conds


def _order_columns(sort_value: str | None) -> list[ColumnElement[Any]]:
    mapping: dict[str, list[ColumnElement[Any]]] = {
        'cohort_desc': [models.Member.cohort.desc(), models.Member.name.asc()],
        'cohort_asc': [models.Member.cohort.asc(), models.Member.name.asc()],
        'name': [models.Member.name.asc()],
        'recent': [models.Member.updated_at.desc(), models.Member.name.asc()],
    }
    if not sort_value:
        return mapping['recent']
    key = sort_value.lower()
    return mapping.get(key, mapping['recent'])


async def list_members(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    filters: schemas.MemberListFilters | None = None,
    viewer_student_id: str | None = None,
) -> Sequence[models.Member]:
    """회원 목록 조회(기본 필터 지원).

    - q: 이름/이메일 부분 일치
    - cohort: 기수 정확히 일치
    - major: 전공 부분 일치
    - exclude_private: visibility=PRIVATE을 기본 제외
    """
    stmt = select(models.Member)
    f = filters or {}
    conds = _build_member_conditions(f, viewer_student_id=viewer_student_id)
    if conds:
        stmt = stmt.where(and_(*conds))
    stmt = stmt.order_by(*_order_columns(f.get('sort')))
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


async def count_members(
    db: AsyncSession, *, filters: schemas.MemberListFilters | None = None,
    viewer_student_id: str | None = None,
) -> int:
    stmt = select(func.count()).select_from(models.Member)
    f = filters or {}
    conds = _build_member_conditions(f, viewer_student_id=viewer_student_id)
    if conds:
        stmt = stmt.where(and_(*conds))
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


async def count_active_members_with_role(
    db: AsyncSession,
    *,
    role: str,
    serialize_super_admin_changes: bool = False,
) -> int:
    """쉼표 구분 역할 토큰을 정확히 세고 필요 시 역할 변경을 직렬화한다."""
    if serialize_super_admin_changes:
        if role != "super_admin":
            raise ValueError(
                "serialized role changes are only supported for super_admin"
            )
        await db.execute(select(func.pg_advisory_xact_lock(_SUPER_ADMIN_ROLE_LOCK_ID)))

    # LIKE wildcards (`_` / `%`) must not match arbitrary role tokens.
    escaped_role = (
        role.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    )
    roles_with_boundaries = func.concat(
        literal(","), models.Member.roles, literal(",")
    )
    stmt = (
        select(func.count())
        .select_from(models.Member)
        .where(
            roles_with_boundaries.like(f"%,{escaped_role},%", escape="\\"),
            models.Member.status == "active",
        )
    )
    result = await db.execute(stmt)
    return int(result.scalar_one())


async def get_member(db: AsyncSession, member_id: int) -> models.Member:
    member = await db.get(models.Member, member_id)
    if member is None:
        raise NotFoundError(code="member_not_found", detail="Member not found")
    return member


async def get_directory_member(
    db: AsyncSession,
    *,
    member_id: int,
    viewer_student_id: str,
) -> tuple[models.Member, str | None, int]:
    row = await _get_directory_row(
        db, member_id=member_id, viewer_student_id=viewer_student_id
    )
    if row is None:
        raise NotFoundError(code="member_not_found", detail="Member not found")
    return row


def _directory_request_query(
    *,
    viewer_student_id: str,
    filters: schemas.MemberListFilters,
):
    viewer = aliased(models.Member)
    stmt = (
        select(models.Member, DirectoryViewRequest.status, viewer.cohort)
        .select_from(models.Member)
        .join(viewer, viewer.student_id == viewer_student_id)
        .outerjoin(
            DirectoryViewRequest,
            and_(
                DirectoryViewRequest.target_id == models.Member.id,
                DirectoryViewRequest.requester_id == viewer.id,
            ),
        )
    )
    conds = _build_member_conditions(filters, viewer_student_id=viewer_student_id)
    if conds:
        stmt = stmt.where(and_(*conds))
    return stmt


async def list_directory_rows(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    filters: schemas.MemberListFilters,
    viewer_student_id: str,
) -> Sequence[tuple[models.Member, str | None, int]]:
    stmt = _directory_request_query(
        viewer_student_id=viewer_student_id, filters=filters
    )
    stmt = stmt.order_by(*_order_columns(filters.get("sort")))
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    rows = result.all()
    return [
        (member, status if isinstance(status, str) else None, int(cast(int, cohort)))
        for member, status, cohort in rows
    ]


async def _get_directory_row(
    db: AsyncSession,
    *,
    member_id: int,
    viewer_student_id: str,
) -> tuple[models.Member, str | None, int] | None:
    stmt = _directory_request_query(
        viewer_student_id=viewer_student_id, filters={}
    ).where(models.Member.id == member_id)
    result = await db.execute(stmt)
    row = result.first()
    if row is None:
        return None
    member, status, cohort = row
    return member, status if isinstance(status, str) else None, int(cast(int, cohort))


async def create_member(
    db: AsyncSession, payload: schemas.MemberCreate
) -> models.Member:
    data = payload.model_dump()
    if "visibility" in data:
        data["visibility"] = models.Visibility(data["visibility"])  # normalize enum
    member = models.Member(**data)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


async def get_member_by_student_id(db: AsyncSession, student_id: str) -> models.Member:
    stmt = select(models.Member).where(models.Member.student_id == student_id)
    result = await db.execute(stmt)
    row = result.scalars().first()
    if row is None:
        raise NotFoundError(code="member_not_found", detail="Member not found")
    return row


async def list_members_by_student_ids(
    db: AsyncSession, student_ids: Sequence[str]
) -> Sequence[models.Member]:
    if not student_ids:
        return []
    stmt = select(models.Member).where(models.Member.student_id.in_(student_ids))
    result = await db.execute(stmt)
    return result.scalars().all()


async def update_member_roles(
    db: AsyncSession, *, member: models.Member, roles: str
) -> models.Member:
    setattr(member, "roles", roles)
    await db.commit()
    await db.refresh(member)
    return member


async def update_member_profile_admin(
    db: AsyncSession, *, member_id: int, data: schemas.AdminMemberUpdate
) -> models.Member:
    member = await db.get(models.Member, member_id)
    if member is None:
        raise NotFoundError(code="member_not_found", detail="Member not found")

    updates = data.model_dump(exclude_unset=True)
    if "visibility" in updates and updates["visibility"] is not None:
        updates["visibility"] = models.Visibility(updates["visibility"])
    if "birth_lunar" in updates and updates["birth_lunar"] is not None:
        updates["birth_lunar"] = bool(updates["birth_lunar"])

    if updates:
        for k, v in updates.items():
            setattr(member, k, v)
        await db.commit()
        await db.refresh(member)
    return member


async def update_member_profile(
    db: AsyncSession, *, member_id: int, data: schemas.MemberUpdate
) -> models.Member:
    member = await db.get(models.Member, member_id)
    if member is None:
        raise NotFoundError(code="member_not_found", detail="Member not found")

    updates = data.model_dump(exclude_unset=True)
    if "visibility" in updates and updates["visibility"] is not None:
        updates["visibility"] = models.Visibility(updates["visibility"])  # normalize
    if "birth_lunar" in updates and updates["birth_lunar"] is not None:
        updates["birth_lunar"] = bool(updates["birth_lunar"])  # explicit cast

    if updates:
        for k, v in updates.items():
            setattr(member, k, v)
        await db.commit()
        await db.refresh(member)
    return member


async def save_directory_consent(
    db: AsyncSession,
    *,
    member_id: int,
    visibility: models.Visibility,
    consented_at: datetime,
) -> models.Member:
    member = await get_member(db, member_id)
    setattr(member, "visibility", visibility)
    setattr(member, "directory_consent_at", consented_at)
    await db.commit()
    await db.refresh(member)
    return member
