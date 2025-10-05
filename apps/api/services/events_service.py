from __future__ import annotations

from collections.abc import Sequence

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
    """
    _ = events_repo.get_event(db, event_id)
    _ = members_repo.get_member(db, member_id)

    rsvp = db.get(models.RSVP, (member_id, event_id))
    if rsvp is None:
        payload = schemas.RSVPCreate(
            member_id=member_id, event_id=event_id, status=status
        )
        rsvp = rsvps_repo.create_rsvp(db, payload)
    else:
        # 타입체커 호환을 위해 setattr 사용
        setattr(rsvp, "status", models.RSVPStatus(status))
        db.commit()
        db.refresh(rsvp)
    return rsvp
