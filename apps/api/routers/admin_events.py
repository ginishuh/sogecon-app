"""관리자 행사 관리 API."""

from __future__ import annotations

from datetime import datetime
from typing import cast

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..services import events_service
from .auth import CurrentUser, require_permission

router = APIRouter(prefix="/admin/events", tags=["admin-events"])


class AdminEventQueryParams(BaseModel):
    """관리자 행사 목록 쿼리 파라미터."""

    limit: int = Query(20, ge=1, le=100)
    offset: int = Query(0, ge=0)
    q: str | None = Query(
        default=None,
        description="제목 검색어(부분 일치, 대소문자 무시)",
        min_length=1,
        max_length=100,
    )
    date_from: datetime | None = Query(
        default=None, description="시작일(ISO8601) — starts_at 이상"
    )
    date_to: datetime | None = Query(
        default=None, description="종료일(ISO8601) — ends_at 이하"
    )
    status: schemas.EventStatusLiteral | None = Query(
        default=None,
        description="상태 필터: upcoming|ongoing|ended (현재 시각 기준)",
    )


def get_admin_event_params(
    params: AdminEventQueryParams = Depends(),
) -> AdminEventQueryParams:
    return params


class AdminEventListResponse(BaseModel):
    items: list[schemas.EventAdminRead]
    total: int


@router.get("/", response_model=AdminEventListResponse)
async def list_admin_events(
    params: AdminEventQueryParams = Depends(get_admin_event_params),
    db: AsyncSession = Depends(get_db),
    _admin: CurrentUser = Depends(
        require_permission("admin_events", allow_admin_fallback=False)
    ),
) -> AdminEventListResponse:
    filters: schemas.AdminEventListFilters = {}
    if params.q is not None:
        filters["q"] = params.q
    if params.date_from is not None:
        filters["date_from"] = params.date_from
    if params.date_to is not None:
        filters["date_to"] = params.date_to
    if params.status is not None:
        filters["status"] = params.status

    rows, total = await events_service.list_admin_events_with_total(
        db, limit=params.limit, offset=params.offset, filters=filters or None
    )
    items: list[schemas.EventAdminRead] = []
    for evt, going, waitlist, cancel in rows:
        items.append(
            schemas.EventAdminRead(
                id=cast(int, evt.id),
                title=cast(str, evt.title),
                description=cast(str | None, evt.description),
                starts_at=cast(datetime, evt.starts_at),
                ends_at=cast(datetime, evt.ends_at),
                location=cast(str, evt.location),
                capacity=cast(int, evt.capacity),
                rsvp_counts=schemas.RSVPCounts(
                    going=going, waitlist=waitlist, cancel=cancel
                ),
            )
        )
    return AdminEventListResponse(items=items, total=total)


@router.patch("/{event_id}", response_model=schemas.EventRead)
async def update_admin_event(
    event_id: int,
    payload: schemas.EventUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: CurrentUser = Depends(
        require_permission("admin_events", allow_admin_fallback=False)
    ),
) -> schemas.EventRead:
    event = await events_service.update_event(db, event_id, payload)
    return schemas.EventRead.model_validate(event)


@router.delete("/{event_id}", status_code=204)
async def delete_admin_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: CurrentUser = Depends(
        require_permission("admin_events", allow_admin_fallback=False)
    ),
) -> None:
    await events_service.delete_event(db, event_id)
