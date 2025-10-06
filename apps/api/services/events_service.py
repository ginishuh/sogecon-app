from __future__ import annotations

from collections.abc import Sequence
from typing import cast

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..repositories import events as events_repo
from ..repositories import members as members_repo
from ..repositories import rsvps as rsvps_repo


def list_events(db: Session, *, limit: int, offset: int) -> Sequence[models.Event]:
    return events_repo.list_events(db, limit=limit, offset=offset)


def get_event(db: Session, event_id: int) -> models.Event:
    return events_repo.get_event(db, event_id)


def create_event(db: Session, payload: schemas.EventCreate) -> models.Event:
    return events_repo.create_event(db, payload)


def upsert_rsvp_status(
    db: Session, *, event_id: int, member_id: int, status: schemas.RSVPLiteral
) -> models.RSVP:
    """RSVP 상태를 생성/갱신.

    - 회원/이벤트 존재 여부 확인 후 생성 또는 상태 갱신.
    - capacity v1: `going` 요청 시 정원이 가득 찼다면 `waitlist`로 강제.
    """
    _ = events_repo.get_event(db, event_id)
    _ = members_repo.get_member(db, member_id)

    def _normalize_status(
        req: schemas.RSVPLiteral, existing: models.RSVP | None
    ) -> models.RSVPStatus:
        if req != "going":
            return models.RSVPStatus(req)
        # going인 경우 정원 검사
        going_count = db.execute(
            select(func.count(models.RSVP.member_id)).where(
                models.RSVP.event_id == event_id,
                models.RSVP.status == models.RSVPStatus.GOING,
            )
        ).scalar_one()
        event_obj = db.get(models.Event, event_id)
        assert event_obj is not None
        capacity_int: int = cast(int, event_obj.capacity)
        # 업데이트 시 본인 카운트는 제외하여 재요청으로 인한 부당한 대기열 강등을 방지
        effective = int(going_count)
        if existing is not None and existing.status == models.RSVPStatus.GOING:
            effective -= 1
        if effective >= capacity_int:
            return models.RSVPStatus.WAITLIST
        return models.RSVPStatus.GOING

    rsvp = db.get(models.RSVP, (member_id, event_id))
    if rsvp is None:
        final_status = _normalize_status(status, None)
        payload = schemas.RSVPCreate(
            member_id=member_id, event_id=event_id, status=final_status.value
        )
        rsvp = rsvps_repo.create_rsvp(db, payload)
    else:
        # 타입체커 호환을 위해 setattr 사용
        setattr(rsvp, "status", _normalize_status(status, rsvp))
        db.commit()
        db.refresh(rsvp)
    return rsvp
