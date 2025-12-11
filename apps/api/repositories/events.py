from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import asc, func, select
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


async def list_events_with_total(
    db: AsyncSession, *, limit: int, offset: int
) -> tuple[Sequence[models.Event], int]:
    """관리용: 전체 개수와 함께 반환."""
    stmt = (
        select(models.Event)
        .order_by(asc(models.Event.starts_at))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    events = result.scalars().all()

    count_stmt = select(func.count(models.Event.id))
    total = (await db.execute(count_stmt)).scalar_one()
    return events, int(total)


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


async def update_event(
    db: AsyncSession, event_id: int, payload: schemas.EventUpdate
) -> models.Event:
    event = await get_event(db, event_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(event, key, value)
    await db.commit()
    await db.refresh(event)
    return event


async def delete_event(db: AsyncSession, event_id: int) -> int:
    event = await get_event(db, event_id)
    await db.delete(event)
    await db.commit()
    return int(event_id)
