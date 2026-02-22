from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from .. import models, schemas
from ..errors import NotFoundError
from . import escape_like


def _build_member_conditions(
    filters: schemas.MemberListFilters,
) -> list[ColumnElement[bool]]:
    conds: list[ColumnElement[bool]] = []
    qv = filters.get('q')
    if qv:
        like = f"%{escape_like(qv)}%"
        conds.append(
            or_(
                models.Member.name.ilike(like, escape="\\"),
                models.Member.email.ilike(like, escape="\\"),
                models.Member.student_id.ilike(like, escape="\\"),
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
            conds.append(column.ilike(f"%{escape_like(value)}%", escape="\\"))

    region = filters.get('region')
    if region:
        like = f"%{escape_like(region)}%"
        conds.append(
            or_(
                models.Member.addr_personal.ilike(like, escape="\\"),
                models.Member.addr_company.ilike(like, escape="\\"),
            )
        )

    job_title = filters.get('job_title')
    if job_title:
        conds.append(
            models.Member.job_title.ilike(f"%{escape_like(job_title)}%", escape="\\")
        )

    if filters.get('exclude_private', True):
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
) -> Sequence[models.Member]:
    """회원 목록 조회(기본 필터 지원).

    - q: 이름/이메일 부분 일치
    - cohort: 기수 정확히 일치
    - major: 전공 부분 일치
    - exclude_private: visibility=PRIVATE을 기본 제외
    """
    stmt = select(models.Member)
    f = filters or {}
    conds = _build_member_conditions(f)
    if conds:
        stmt = stmt.where(and_(*conds))
    stmt = stmt.order_by(*_order_columns(f.get('sort')))
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


async def count_members(
    db: AsyncSession, *, filters: schemas.MemberListFilters | None = None
) -> int:
    stmt = select(func.count()).select_from(models.Member)
    f = filters or {}
    conds = _build_member_conditions(f)
    if conds:
        stmt = stmt.where(and_(*conds))
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


async def get_member(db: AsyncSession, member_id: int) -> models.Member:
    member = await db.get(models.Member, member_id)
    if member is None:
        raise NotFoundError(code="member_not_found", detail="Member not found")
    return member


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


async def get_member_by_email(db: AsyncSession, email: str) -> models.Member:
    stmt = select(models.Member).where(models.Member.email == email)
    result = await db.execute(stmt)
    row = result.scalars().first()
    if row is None:
        raise NotFoundError(code="member_not_found", detail="Member not found")
    return row


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
