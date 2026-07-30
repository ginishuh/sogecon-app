from __future__ import annotations

from collections.abc import Sequence
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..errors import ApiError
from ..repositories import events as events_repo
from ..repositories import members as members_repo
from ..repositories import rsvps as rsvps_repo
from .events_service import normalize_rsvp_status_for_capacity


async def list_rsvps(
    db: AsyncSession, *, member_id: int, limit: int, offset: int
) -> Sequence[models.RSVP]:
    return await rsvps_repo.list_rsvps(
        db, member_id=member_id, limit=limit, offset=offset
    )


async def get_rsvp(
    db: AsyncSession,
    *,
    requested_member_id: int,
    actor_member_id: int,
    event_id: int,
) -> models.RSVP:
    if requested_member_id != actor_member_id:
        raise ApiError(
            code="rsvp_forbidden",
            detail="Cannot access another member's RSVP",
            status=403,
        )
    return await rsvps_repo.get_rsvp(db, actor_member_id, event_id)


async def create_rsvp(
    db: AsyncSession,
    *,
    member_id: int,
    payload: schemas.RSVPCreate,
) -> models.RSVP:
    event_obj = await events_repo.get_event(db, payload.event_id)  # 존재 확인
    _ = await members_repo.get_member(db, member_id)  # 존재 확인
    final_status = await normalize_rsvp_status_for_capacity(
        db,
        event_id=int(payload.event_id),
        capacity=cast(int, event_obj.capacity),
        requested=payload.status,
        existing=None,
    )
    return await rsvps_repo.create_rsvp(
        db,
        member_id=member_id,
        event_id=payload.event_id,
        status=final_status.value,
    )
