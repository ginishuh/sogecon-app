from __future__ import annotations

from collections.abc import Sequence
from typing import cast

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..repositories import events as events_repo
from ..repositories import members as members_repo
from ..repositories import rsvps as rsvps_repo


async def list_events(
    db: AsyncSession, *, limit: int, offset: int
) -> Sequence[models.Event]:
    return await events_repo.list_events(db, limit=limit, offset=offset)


async def get_event(db: AsyncSession, event_id: int) -> models.Event:
    return await events_repo.get_event(db, event_id)


async def create_event(db: AsyncSession, payload: schemas.EventCreate) -> models.Event:
    return await events_repo.create_event(db, payload)


async def list_events_with_total(
    db: AsyncSession, *, limit: int, offset: int
) -> tuple[Sequence[models.Event], int]:
    return await events_repo.list_events_with_total(db, limit=limit, offset=offset)


async def update_event(
    db: AsyncSession, event_id: int, payload: schemas.EventUpdate
) -> models.Event:
    return await events_repo.update_event(db, event_id, payload)


async def delete_event(db: AsyncSession, event_id: int) -> int:
    return await events_repo.delete_event(db, event_id)


async def _promote_waitlist_candidate(db: AsyncSession, event_id: int) -> None:
    """대기열 최상위 1인을 going으로 승급(경합 완화 포함)."""
    # SAVEPOINT 사용 (async version)
    async with db.begin_nested():
        stmt = (
            select(models.RSVP)
            .where(
                models.RSVP.event_id == event_id,
                models.RSVP.status == models.RSVPStatus.WAITLIST,
            )
            .order_by(models.RSVP.created_at.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        result = await db.execute(stmt)
        candidate = result.scalars().first()

        if candidate is not None:
            setattr(candidate, "status", models.RSVPStatus.GOING)

    if candidate is not None:
        await db.commit()
        await db.refresh(candidate)


async def upsert_rsvp_status(
    db: AsyncSession, *, event_id: int, member_id: int, status: schemas.RSVPLiteral
) -> models.RSVP:
    """RSVP 상태를 생성/갱신.

    - 회원/이벤트 존재 여부 확인 후 생성 또는 상태 갱신.
    - capacity v1: `going` 요청 시 정원이 가득 찼다면 `waitlist`로 강제.
    """
    event_obj = await events_repo.get_event(db, event_id)
    _ = await members_repo.get_member(db, member_id)

    async def _normalize_status(
        req: schemas.RSVPLiteral, existing: models.RSVP | None, capacity_int: int
    ) -> models.RSVPStatus:
        if req != "going":
            return models.RSVPStatus(req)
        # going인 경우 정원 검사
        count_stmt = select(func.count(models.RSVP.member_id)).where(
            models.RSVP.event_id == event_id,
            models.RSVP.status == models.RSVPStatus.GOING,
        )
        result = await db.execute(count_stmt)
        going_count = result.scalar_one()
        # 업데이트 시 본인 카운트는 제외하여 재요청으로 인한 부당한 대기열 강등을 방지
        effective = int(going_count)
        if existing is not None:
            current: models.RSVPStatus = cast(models.RSVPStatus, existing.status)
            if current == models.RSVPStatus.GOING:
                effective -= 1
        if effective >= capacity_int:
            return models.RSVPStatus.WAITLIST
        return models.RSVPStatus.GOING

    rsvp = await db.get(models.RSVP, (member_id, event_id))
    cap_int = cast(int, event_obj.capacity)
    if rsvp is None:
        final_status = await _normalize_status(status, None, cap_int)
        payload = schemas.RSVPCreate(
            member_id=member_id, event_id=event_id, status=final_status.value
        )
        rsvp = await rsvps_repo.create_rsvp(db, payload)
    else:
        # 타입체커 호환을 위해 setattr 사용
        new_status = await _normalize_status(status, rsvp, cap_int)
        setattr(rsvp, "status", new_status)
        await db.commit()
        await db.refresh(rsvp)
        # RSVP v2: cancel 시 대기열 최상위 1인을 going으로 승급
        if new_status == models.RSVPStatus.CANCEL:
            # Postgres: SKIP LOCKED로 경쟁 중복 승급 방지
            await _promote_waitlist_candidate(db, event_id)
    return rsvp
