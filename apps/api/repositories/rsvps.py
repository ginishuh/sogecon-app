from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..errors import AlreadyExistsError, NotFoundError


async def list_rsvps(
    db: AsyncSession, *, member_id: int, limit: int, offset: int
) -> Sequence[models.RSVP]:
    stmt = (
        select(models.RSVP)
        .where(models.RSVP.member_id == member_id)
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_rsvp(db: AsyncSession, member_id: int, event_id: int) -> models.RSVP:
    key: tuple[int, int] = (member_id, event_id)
    rsvp = await db.get(models.RSVP, key)
    if rsvp is None:
        raise NotFoundError(code="rsvp_not_found", detail="RSVP not found")
    return rsvp


async def create_rsvp(
    db: AsyncSession,
    *,
    member_id: int,
    event_id: int,
    status: schemas.RSVPLiteral,
) -> models.RSVP:
    # 복합 PK 중복 방지
    key: tuple[int, int] = (member_id, event_id)
    exists = await db.get(models.RSVP, key)
    if exists is not None:
        raise AlreadyExistsError(code="rsvp_exists", detail="RSVP already exists")
    rsvp = models.RSVP(
        member_id=member_id,
        event_id=event_id,
        status=models.RSVPStatus(status),
    )
    db.add(rsvp)
    await db.commit()
    await db.refresh(rsvp)
    return rsvp
