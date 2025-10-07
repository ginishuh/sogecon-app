from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from .. import models, schemas
from ..errors import NotFoundError


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
    conds: list[ColumnElement[bool]] = []
    f = filters or {}
    qv = f.get('q')
    if qv:
        like = f"%{qv}%"
        conds.append(
            or_(models.Member.name.ilike(like), models.Member.email.ilike(like))
        )
    coh = f.get('cohort')
    if coh is not None:
        conds.append(models.Member.cohort == int(coh))
    maj = f.get('major')
    if maj:
        conds.append(models.Member.major.ilike(f"%{maj}%"))
    if f.get('exclude_private', True):
        conds.append(models.Member.visibility != models.Visibility.PRIVATE)
    if conds:
        stmt = stmt.where(and_(*conds))
    stmt = stmt.offset(offset).limit(limit)
    return db.execute(stmt).scalars().all()


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
    changed = False
    if data.name is not None:
        setattr(member, "name", data.name)
        changed = True
    if data.major is not None:
        setattr(member, "major", data.major)
        changed = True
    if data.visibility is not None:
        setattr(member, "visibility", models.Visibility(data.visibility))
        changed = True
    if changed:
        db.commit()
        db.refresh(member)
    return member
