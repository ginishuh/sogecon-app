from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..errors import AlreadyExistsError, NotFoundError
from ..services import rsvps_service

router = APIRouter(prefix="/rsvps", tags=["rsvps"])


@router.get("/", response_model=list[schemas.RSVPRead])
def list_rsvps(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[schemas.RSVPRead]:
    rsvps = rsvps_service.list_rsvps(db, limit=limit, offset=offset)
    return [schemas.RSVPRead.model_validate(rsvp) for rsvp in rsvps]


@router.get("/{member_id}/{event_id}", response_model=schemas.RSVPRead)
def get_rsvp(
    member_id: int,
    event_id: int,
    db: Session = Depends(get_db),
) -> schemas.RSVPRead:
    try:
        rsvp = rsvps_service.get_rsvp(db, member_id, event_id)
    except NotFoundError as err:
        raise HTTPException(status_code=404, detail="RSVP not found") from err
    return schemas.RSVPRead.model_validate(rsvp)


@router.post("/", response_model=schemas.RSVPRead, status_code=201)
def create_rsvp(
    payload: schemas.RSVPCreate,
    db: Session = Depends(get_db),
) -> schemas.RSVPRead:
    try:
        rsvp = rsvps_service.create_rsvp(db, payload.model_dump())
    except NotFoundError as err:
        raise HTTPException(status_code=404, detail="Not found") from err
    except AlreadyExistsError as err:
        raise HTTPException(status_code=409, detail="RSVP already exists") from err
    return schemas.RSVPRead.model_validate(rsvp)
