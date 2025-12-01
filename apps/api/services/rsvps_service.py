from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..repositories import events as events_repo
from ..repositories import members as members_repo
from ..repositories import rsvps as rsvps_repo


async def list_rsvps(
    db: AsyncSession, *, limit: int, offset: int
) -> Sequence[models.RSVP]:
    return await rsvps_repo.list_rsvps(db, limit=limit, offset=offset)


async def get_rsvp(db: AsyncSession, member_id: int, event_id: int) -> models.RSVP:
    return await rsvps_repo.get_rsvp(db, member_id, event_id)


async def create_rsvp(db: AsyncSession, payload: schemas.RSVPCreate) -> models.RSVP:
    _ = await events_repo.get_event(db, payload.event_id)  # 존재 확인
    _ = await members_repo.get_member(db, payload.member_id)  # 존재 확인
    return await rsvps_repo.create_rsvp(db, payload)
