from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from .. import models, schemas
from ..errors import NotFoundError


def _build_member_conditions(
    filters: schemas.MemberListFilters,
) -> list[ColumnElement[bool]]:
    conds: list[ColumnElement[bool]] = []
    qv = filters.get('q')
    if qv:
        like = f"%{qv}%"
        conds.append(
            or_(models.Member.name.ilike(like), models.Member.email.ilike(like))
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
            conds.append(column.ilike(f"%{value}%"))

    region = filters.get('region')
    if region:
        like = f"%{region}%"
        conds.append(
            or_(
                models.Member.addr_personal.ilike(like),
                models.Member.addr_company.ilike(like),
            )
        )

    job_title = filters.get('job_title')
    if job_title:
        conds.append(models.Member.job_title.ilike(f"%{job_title}%"))

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


def list_members(
    db: Session,
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
    return db.execute(stmt).scalars().all()


def count_members(
    db: Session, *, filters: schemas.MemberListFilters | None = None
) -> int:
    stmt = select(func.count()).select_from(models.Member)
    f = filters or {}
    conds = _build_member_conditions(f)
    if conds:
        stmt = stmt.where(and_(*conds))
    return int(db.execute(stmt).scalar() or 0)


def get_member(db: Session, member_id: int) -> models.Member:
    member = db.get(models.Member, member_id)
    if member is None:
        raise NotFoundError(code="member_not_found", detail="Member not found")
    return member


def create_member(db: Session, payload: schemas.MemberCreate) -> models.Member:
    data = payload.model_dump()
    if "visibility" in data:
        data["visibility"] = models.Visibility(data["visibility"])  # normalize enum
    member = models.Member(**data)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def get_member_by_email(db: Session, email: str) -> models.Member:
    row = db.query(models.Member).filter(models.Member.email == email).first()
    if row is None:
        raise NotFoundError(code="member_not_found", detail="Member not found")
    return row


def update_member_profile(
    db: Session, *, member_id: int, data: schemas.MemberUpdate
) -> models.Member:
    member = db.get(models.Member, member_id)
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
        db.commit()
        db.refresh(member)
    return member
