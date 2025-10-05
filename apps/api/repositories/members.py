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
    member = models.Member(**data)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member
