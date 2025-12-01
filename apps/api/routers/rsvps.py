from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..services import rsvps_service

router = APIRouter(prefix="/rsvps", tags=["rsvps"])


@router.get("/", response_model=list[schemas.RSVPRead])
async def list_rsvps(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[schemas.RSVPRead]:
    rsvps = await rsvps_service.list_rsvps(db, limit=limit, offset=offset)
    return [schemas.RSVPRead.model_validate(rsvp) for rsvp in rsvps]


@router.get("/{member_id}/{event_id}", response_model=schemas.RSVPRead)
async def get_rsvp(
    member_id: int,
    event_id: int,
    db: AsyncSession = Depends(get_db),
) -> schemas.RSVPRead:
    rsvp = await rsvps_service.get_rsvp(db, member_id, event_id)
    return schemas.RSVPRead.model_validate(rsvp)


@router.post("/", response_model=schemas.RSVPRead, status_code=201)
async def create_rsvp(
    payload: schemas.RSVPCreate,
    db: AsyncSession = Depends(get_db),
) -> schemas.RSVPRead:
    rsvp = await rsvps_service.create_rsvp(db, payload)
    return schemas.RSVPRead.model_validate(rsvp)
