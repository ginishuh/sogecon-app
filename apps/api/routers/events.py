from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/", response_model=list[schemas.EventRead])
def list_events(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[schemas.EventRead]:
    events = (
        db.query(models.Event)
        .order_by(models.Event.starts_at.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [schemas.EventRead.model_validate(event) for event in events]


@router.get("/{event_id}", response_model=schemas.EventRead)
def get_event(event_id: int, db: Session = Depends(get_db)) -> schemas.EventRead:
    event = db.get(models.Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return schemas.EventRead.model_validate(event)


@router.post("/", response_model=schemas.EventRead, status_code=201)
def create_event(
    payload: schemas.EventCreate,
    db: Session = Depends(get_db),
) -> schemas.EventRead:
    event = models.Event(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return schemas.EventRead.model_validate(event)


@router.post("/{event_id}/rsvp", response_model=schemas.RSVPRead, status_code=201)
def create_rsvp(
    event_id: int,
    payload: schemas.RSVPStatusUpdate,
    db: Session = Depends(get_db),
) -> schemas.RSVPRead:
    event = db.get(models.Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    member = db.get(models.Member, payload.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    rsvp = db.get(models.RSVP, (payload.member_id, event_id))
    if not rsvp:
        rsvp = models.RSVP(member_id=payload.member_id, event_id=event_id)
        db.add(rsvp)

    rsvp.status = models.RSVPStatus(payload.status)
    db.commit()
    db.refresh(rsvp)
    return schemas.RSVPRead.model_validate(rsvp)
