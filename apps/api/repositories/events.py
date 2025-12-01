from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import asc, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..errors import NotFoundError


async def list_events(
    db: AsyncSession, *, limit: int, offset: int
) -> Sequence[models.Event]:
    stmt = (
        select(models.Event)
        .order_by(asc(models.Event.starts_at))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_event(db: AsyncSession, event_id: int) -> models.Event:
    event = await db.get(models.Event, event_id)
    if event is None:
        raise NotFoundError(code="event_not_found", detail="Event not found")
    return event


async def create_event(db: AsyncSession, payload: schemas.EventCreate) -> models.Event:
    data = payload.model_dump()
    event = models.Event(**data)
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event
