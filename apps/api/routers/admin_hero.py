"""관리자 홈 히어로 배너(추천 슬롯) 관리 API."""

from __future__ import annotations

from typing import cast

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..services import hero_service
from .auth import CurrentUser, require_permission

router = APIRouter(prefix="/admin/hero", tags=["admin-hero"])


class AdminHeroQueryParams(BaseModel):
    """관리자 히어로 목록 쿼리 파라미터."""

    limit: int = Query(20, ge=1, le=100)
    offset: int = Query(0, ge=0)


class AdminHeroListResponse(BaseModel):
    items: list[schemas.HeroItemRead]
    total: int


@router.get("/", response_model=AdminHeroListResponse)
async def list_admin_hero_items(
    params: AdminHeroQueryParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _admin: CurrentUser = Depends(
        require_permission("admin_hero", allow_admin_fallback=False)
    ),
) -> AdminHeroListResponse:
    items, total = await hero_service.list_admin_hero_items_with_total(
        db, limit=params.limit, offset=params.offset
    )
    return AdminHeroListResponse(
        items=[schemas.HeroItemRead.model_validate(item) for item in items],
        total=total,
    )


@router.post("/lookup", response_model=schemas.HeroTargetLookupResponse)
async def lookup_admin_hero_items(
    payload: schemas.HeroTargetLookupRequest,
    db: AsyncSession = Depends(get_db),
    _admin: CurrentUser = Depends(
        require_permission("admin_hero", allow_admin_fallback=False)
    ),
) -> schemas.HeroTargetLookupResponse:
    """대상(게시글/행사) ID 목록으로 hero_item 상태를 조회한다."""
    items = await hero_service.list_admin_hero_items_by_targets(
        db,
        target_type=payload.target_type,
        target_ids=payload.target_ids,
    )
    out: list[schemas.HeroTargetLookupItem] = []
    for item in items:
        out.append(
            schemas.HeroTargetLookupItem(
                target_id=cast(int, item.target_id),
                hero_item_id=cast(int, item.id),
                enabled=cast(bool, item.enabled),
                pinned=cast(bool, item.pinned),
            )
        )
    return schemas.HeroTargetLookupResponse(items=out)


@router.get("/{hero_item_id}", response_model=schemas.HeroItemRead)
async def get_admin_hero_item(
    hero_item_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: CurrentUser = Depends(
        require_permission("admin_hero", allow_admin_fallback=False)
    ),
) -> schemas.HeroItemRead:
    item = await hero_service.get_admin_hero_item(db, hero_item_id)
    return schemas.HeroItemRead.model_validate(item)


@router.post("/", response_model=schemas.HeroItemRead, status_code=201)
async def create_admin_hero_item(
    payload: schemas.HeroItemCreate,
    db: AsyncSession = Depends(get_db),
    _admin: CurrentUser = Depends(
        require_permission("admin_hero", allow_admin_fallback=False)
    ),
) -> schemas.HeroItemRead:
    item = await hero_service.create_admin_hero_item(db, payload)
    return schemas.HeroItemRead.model_validate(item)


@router.patch("/{hero_item_id}", response_model=schemas.HeroItemRead)
async def update_admin_hero_item(
    hero_item_id: int,
    payload: schemas.HeroItemUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: CurrentUser = Depends(
        require_permission("admin_hero", allow_admin_fallback=False)
    ),
) -> schemas.HeroItemRead:
    item = await hero_service.update_admin_hero_item(db, hero_item_id, payload)
    return schemas.HeroItemRead.model_validate(item)


@router.delete("/{hero_item_id}")
async def delete_admin_hero_item(
    hero_item_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: CurrentUser = Depends(
        require_permission("admin_hero", allow_admin_fallback=False)
    ),
) -> dict[str, bool | int]:
    deleted_id = await hero_service.delete_admin_hero_item(db, hero_item_id)
    return {"ok": True, "deleted_id": deleted_id}
