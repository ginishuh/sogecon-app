from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..errors import AlreadyExistsError
from ..repositories import members as members_repo


def list_members(db: Session, *, limit: int, offset: int) -> Sequence[models.Member]:
    return members_repo.list_members(db, limit=limit, offset=offset)


def get_member(db: Session, member_id: int) -> models.Member:
    return members_repo.get_member(db, member_id)


def create_member(db: Session, payload: dict) -> models.Member:
    # 이메일 중복 방지(사전 검사)
    exists = db.execute(
        select(models.Member).where(models.Member.email == payload["email"])
    )
    if exists.scalars().first() is not None:
        raise AlreadyExistsError("email exists")
    return members_repo.create_member(db, payload)
