from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import asc, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from .. import models, schemas
from ..errors import NotFoundError
from . import escape_like


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


async def list_admin_events_with_total(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    filters: schemas.AdminEventListFilters | None = None,
) -> tuple[Sequence[tuple[models.Event, int, int, int]], int]:
    """관리자 행사 목록(필터/검색/참여 집계 포함).

    - q: 제목 부분 검색(대소문자 무시)
    - date_from/date_to: starts_at/ends_at 범위 필터
    - status: upcoming|ongoing|ended (현재 시각 기준)
    """
    q = filters["q"] if filters and "q" in filters else None
    date_from = filters["date_from"] if filters and "date_from" in filters else None
    date_to = filters["date_to"] if filters and "date_to" in filters else None
    status = filters["status"] if filters and "status" in filters else None

    conditions: list[ColumnElement[bool]] = []
    if q:
        like = f"%{escape_like(q.strip().lower())}%"
        conditions.append(func.lower(models.Event.title).like(like, escape="\\"))
    if date_from is not None:
        conditions.append(models.Event.starts_at >= date_from)
    if date_to is not None:
        conditions.append(models.Event.ends_at <= date_to)

    now_expr = func.now()
    if status == "upcoming":
        conditions.append(models.Event.starts_at > now_expr)
    elif status == "ongoing":
        conditions.extend(
            [models.Event.starts_at <= now_expr, models.Event.ends_at >= now_expr]
        )
    elif status == "ended":
        conditions.append(models.Event.ends_at < now_expr)

    going_count = func.coalesce(
        func.sum(
            case(
                (models.RSVP.status == models.RSVPStatus.GOING, 1),
                else_=0,
            )
        ),
        0,
    )
    waitlist_count = func.coalesce(
        func.sum(
            case(
                (models.RSVP.status == models.RSVPStatus.WAITLIST, 1),
                else_=0,
            )
        ),
        0,
    )
    cancel_count = func.coalesce(
        func.sum(
            case(
                (models.RSVP.status == models.RSVPStatus.CANCEL, 1),
                else_=0,
            )
        ),
        0,
    )

    stmt = (
        select(models.Event, going_count, waitlist_count, cancel_count)
        .outerjoin(models.RSVP, models.RSVP.event_id == models.Event.id)
        .group_by(models.Event.id)
        .order_by(asc(models.Event.starts_at))
        .offset(offset)
        .limit(limit)
    )
    if conditions:
        stmt = stmt.where(*conditions)

    result = await db.execute(stmt)
    rows: list[tuple[models.Event, int, int, int]] = []
    for evt, going, waitlist, cancel in result.all():
        rows.append((evt, int(going), int(waitlist), int(cancel)))

    count_stmt = select(func.count(models.Event.id))
    if conditions:
        count_stmt = count_stmt.where(*conditions)
    total = (await db.execute(count_stmt)).scalar_one()

    return rows, int(total)


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
