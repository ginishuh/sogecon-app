"""관리자 홈 히어로 배너(추천 슬롯) 관리 API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..services import hero_service
from .auth import require_admin

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
    request: Request,
    params: AdminHeroQueryParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> AdminHeroListResponse:
    require_admin(request)
    items, total = await hero_service.list_admin_hero_items_with_total(
        db, limit=params.limit, offset=params.offset
    )
    return AdminHeroListResponse(
        items=[schemas.HeroItemRead.model_validate(item) for item in items],
        total=total,
    )


@router.get("/{hero_item_id}", response_model=schemas.HeroItemRead)
async def get_admin_hero_item(
    request: Request,
    hero_item_id: int,
    db: AsyncSession = Depends(get_db),
) -> schemas.HeroItemRead:
    require_admin(request)
    item = await hero_service.get_admin_hero_item(db, hero_item_id)
    return schemas.HeroItemRead.model_validate(item)


@router.post("/", response_model=schemas.HeroItemRead, status_code=201)
async def create_admin_hero_item(
    request: Request,
    payload: schemas.HeroItemCreate,
    db: AsyncSession = Depends(get_db),
) -> schemas.HeroItemRead:
    require_admin(request)
    item = await hero_service.create_admin_hero_item(db, payload)
    return schemas.HeroItemRead.model_validate(item)


@router.patch("/{hero_item_id}", response_model=schemas.HeroItemRead)
async def update_admin_hero_item(
    request: Request,
    hero_item_id: int,
    payload: schemas.HeroItemUpdate,
    db: AsyncSession = Depends(get_db),
) -> schemas.HeroItemRead:
    require_admin(request)
    item = await hero_service.update_admin_hero_item(db, hero_item_id, payload)
    return schemas.HeroItemRead.model_validate(item)


@router.delete("/{hero_item_id}")
async def delete_admin_hero_item(
    request: Request,
    hero_item_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool | int]:
    require_admin(request)
    deleted_id = await hero_service.delete_admin_hero_item(db, hero_item_id)
    return {"ok": True, "deleted_id": deleted_id}

