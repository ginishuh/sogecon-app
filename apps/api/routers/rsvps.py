from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/rsvps", tags=["rsvps"])


@router.get("/", response_model=list[schemas.RSVPRead])
def list_rsvps(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[schemas.RSVPRead]:
    rsvps = (
        db.query(models.RSVP)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [schemas.RSVPRead.model_validate(rsvp) for rsvp in rsvps]


@router.get("/{member_id}/{event_id}", response_model=schemas.RSVPRead)
def get_rsvp(
    member_id: int,
    event_id: int,
    db: Session = Depends(get_db),
) -> schemas.RSVPRead:
    rsvp = db.get(models.RSVP, (member_id, event_id))
    if not rsvp:
        raise HTTPException(status_code=404, detail="RSVP not found")
    return schemas.RSVPRead.model_validate(rsvp)


@router.post("/", response_model=schemas.RSVPRead, status_code=201)
def create_rsvp(
    payload: schemas.RSVPCreate,
    db: Session = Depends(get_db),
) -> schemas.RSVPRead:
    member = db.get(models.Member, payload.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    event = db.get(models.Event, payload.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    existing = db.get(models.RSVP, (payload.member_id, payload.event_id))
    if existing:
        raise HTTPException(status_code=409, detail="RSVP already exists")

    rsvp = models.RSVP(**payload.model_dump())
    db.add(rsvp)
    db.commit()
    db.refresh(rsvp)
    return schemas.RSVPRead.model_validate(rsvp)
