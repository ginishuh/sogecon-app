from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import asc, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..errors import NotFoundError


def list_events(db: Session, *, limit: int, offset: int) -> Sequence[models.Event]:
    stmt = (
        select(models.Event)
        .order_by(asc(models.Event.starts_at))
        .offset(offset)
        .limit(limit)
    )
    return db.execute(stmt).scalars().all()


def get_event(db: Session, event_id: int) -> models.Event:
    event = db.get(models.Event, event_id)
    if event is None:
        raise NotFoundError(code="event_not_found", detail="Event not found")
    return event


def create_event(db: Session, payload: schemas.EventCreate) -> models.Event:
    data = payload.model_dump()
    event = models.Event(**data)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
