from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..services import hero_service
from ..services.auth_service import is_admin

router = APIRouter(prefix="/hero", tags=["hero"])


@router.get("/", response_model=list[schemas.HeroSlide])
async def list_hero_slides(
    request: Request,
    limit: int = Query(5, ge=1, le=10),
    include_unpublished: bool = Query(False),
    db: AsyncSession = Depends(get_db),
) -> list[schemas.HeroSlide]:
    allow_unpublished = include_unpublished and is_admin(request)
    return await hero_service.list_hero_slides(
        db, limit=limit, allow_unpublished=allow_unpublished
    )
