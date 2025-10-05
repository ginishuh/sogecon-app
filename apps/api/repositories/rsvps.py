from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..errors import AlreadyExistsError, NotFoundError


def list_rsvps(db: Session, *, limit: int, offset: int) -> Sequence[models.RSVP]:
    stmt = select(models.RSVP).offset(offset).limit(limit)
    return db.execute(stmt).scalars().all()


def get_rsvp(db: Session, member_id: int, event_id: int) -> models.RSVP:
    rsvp = db.get(models.RSVP, (member_id, event_id))
    if rsvp is None:
        raise NotFoundError("rsvp not found")
    return rsvp


def create_rsvp(db: Session, payload: dict) -> models.RSVP:
    # 복합 PK 중복 방지
    exists = db.get(models.RSVP, (payload["member_id"], payload["event_id"]))
    if exists is not None:
        raise AlreadyExistsError("rsvp exists")
    rsvp = models.RSVP(**payload)
    db.add(rsvp)
    db.commit()
    db.refresh(rsvp)
    return rsvp
