from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..errors import AlreadyExistsError
from ..repositories import members as members_repo


def list_members(
    db: Session,
    *,
    limit: int,
    offset: int,
    filters: schemas.MemberListFilters | None = None,
) -> Sequence[models.Member]:
    return members_repo.list_members(
        db, limit=limit, offset=offset, filters=filters
    )


def get_member(db: Session, member_id: int) -> models.Member:
    return members_repo.get_member(db, member_id)


def create_member(db: Session, payload: schemas.MemberCreate) -> models.Member:
    # 이메일 중복 방지(사전 검사)
    exists = db.execute(
        select(models.Member).where(models.Member.email == payload.email)
    )
    if exists.scalars().first() is not None:
        raise AlreadyExistsError(code="member_exists", detail="Email already in use")
    return members_repo.create_member(db, payload)


def get_member_by_email(db: Session, email: str) -> models.Member:
    return members_repo.get_member_by_email(db, email)


def update_member_profile(
    db: Session, *, member_id: int, data: schemas.MemberUpdate
) -> models.Member:
    return members_repo.update_member_profile(db, member_id=member_id, data=data)
