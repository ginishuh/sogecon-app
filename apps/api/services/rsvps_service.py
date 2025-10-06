from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy.orm import Session

from .. import models, schemas
from ..repositories import events as events_repo
from ..repositories import members as members_repo
from ..repositories import rsvps as rsvps_repo


def list_rsvps(db: Session, *, limit: int, offset: int) -> Sequence[models.RSVP]:
    return rsvps_repo.list_rsvps(db, limit=limit, offset=offset)


def get_rsvp(db: Session, member_id: int, event_id: int) -> models.RSVP:
    return rsvps_repo.get_rsvp(db, member_id, event_id)


def create_rsvp(db: Session, payload: schemas.RSVPCreate) -> models.RSVP:
    _ = events_repo.get_event(db, payload.event_id)  # 존재 확인
    _ = members_repo.get_member(db, payload.member_id)  # 존재 확인
    return rsvps_repo.create_rsvp(db, payload)
