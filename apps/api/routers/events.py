from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..errors import NotFoundError
from ..services import events_service

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/", response_model=list[schemas.EventRead])
def list_events(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[schemas.EventRead]:
    events = events_service.list_events(db, limit=limit, offset=offset)
    return [schemas.EventRead.model_validate(event) for event in events]


@router.get("/{event_id}", response_model=schemas.EventRead)
def get_event(event_id: int, db: Session = Depends(get_db)) -> schemas.EventRead:
    try:
        event = events_service.get_event(db, event_id)
    except NotFoundError as err:
        raise HTTPException(status_code=404, detail="Event not found") from err
    return schemas.EventRead.model_validate(event)


@router.post("/", response_model=schemas.EventRead, status_code=201)
def create_event(
    payload: schemas.EventCreate,
    db: Session = Depends(get_db),
) -> schemas.EventRead:
    event = events_service.create_event(db, payload)
    return schemas.EventRead.model_validate(event)


@router.post("/{event_id}/rsvp", response_model=schemas.RSVPRead, status_code=201)
def create_rsvp(
    event_id: int,
    payload: schemas.RSVPStatusUpdate,
    db: Session = Depends(get_db),
) -> schemas.RSVPRead:
    try:
        rsvp = events_service.upsert_rsvp_status(
            db, event_id=event_id, member_id=payload.member_id, status=payload.status
        )
    except NotFoundError as err:
        # 도메인 예외 메시지에 의존하지 않고 404로 통일
        raise HTTPException(status_code=404, detail="Not found") from err
    return schemas.RSVPRead.model_validate(rsvp)
