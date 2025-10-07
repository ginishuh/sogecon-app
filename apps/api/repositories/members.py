from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..errors import NotFoundError


def list_members(db: Session, *, limit: int, offset: int) -> Sequence[models.Member]:
    """회원 목록 조회.

    - 정렬 조건은 향후 요구에 따라 추가.
    """
    stmt = select(models.Member).offset(offset).limit(limit)
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
