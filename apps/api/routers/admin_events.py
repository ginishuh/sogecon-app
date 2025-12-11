"""관리자 행사 관리 API."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..services import events_service
from .auth import require_admin

router = APIRouter(prefix="/admin/events", tags=["admin-events"])


@dataclass
class AdminEventQueryParams:
    """관리자 행사 목록 쿼리 파라미터."""

    limit: int = 20
    offset: int = 0


def get_admin_event_params(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> AdminEventQueryParams:
    return AdminEventQueryParams(limit=limit, offset=offset)


class AdminEventListResponse(BaseModel):
    items: list[schemas.EventRead]
    total: int


@router.get("/", response_model=AdminEventListResponse)
async def list_admin_events(
    request: Request,
    params: AdminEventQueryParams = Depends(get_admin_event_params),
    db: AsyncSession = Depends(get_db),
) -> AdminEventListResponse:
    require_admin(request)
    events, total = await events_service.list_events_with_total(
        db, limit=params.limit, offset=params.offset
    )
    items = [schemas.EventRead.model_validate(evt) for evt in events]
    return AdminEventListResponse(items=items, total=total)


@router.patch("/{event_id}", response_model=schemas.EventRead)
async def update_admin_event(
    request: Request,
    event_id: int,
    payload: schemas.EventUpdate,
    db: AsyncSession = Depends(get_db),
) -> schemas.EventRead:
    require_admin(request)
    event = await events_service.update_event(db, event_id, payload)
    return schemas.EventRead.model_validate(event)


@router.delete("/{event_id}", status_code=204)
async def delete_admin_event(
    request: Request,
    event_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    require_admin(request)
    await events_service.delete_event(db, event_id)
