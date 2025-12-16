from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..errors import NotFoundError


async def list_hero_items(
    db: AsyncSession,
    *,
    limit: int,
    offset: int,
    enabled_only: bool = False,
) -> Sequence[models.HeroItem]:
    stmt = select(models.HeroItem)
    if enabled_only:
        stmt = stmt.where(models.HeroItem.enabled.is_(True))
    stmt = (
        stmt.order_by(desc(models.HeroItem.pinned), desc(models.HeroItem.updated_at))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def list_hero_items_by_targets(
    db: AsyncSession,
    *,
    target_type: schemas.HeroTargetTypeLiteral,
    target_ids: Sequence[int],
) -> Sequence[models.HeroItem]:
    if not target_ids:
        return []
    stmt = select(models.HeroItem).where(
        models.HeroItem.target_type == target_type,
        models.HeroItem.target_id.in_(list(target_ids)),
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def count_hero_items(db: AsyncSession, *, enabled_only: bool = False) -> int:
    stmt = select(func.count(models.HeroItem.id))
    if enabled_only:
        stmt = stmt.where(models.HeroItem.enabled.is_(True))
    result = await db.execute(stmt)
    count = result.scalar()
    return count if count is not None else 0


async def get_hero_item(db: AsyncSession, hero_item_id: int) -> models.HeroItem:
    stmt = select(models.HeroItem).where(models.HeroItem.id == hero_item_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if item is None:
        raise NotFoundError(code="hero_item_not_found", detail="Hero item not found")
    return item


async def create_hero_item(
    db: AsyncSession, payload: schemas.HeroItemCreate
) -> models.HeroItem:
    data = payload.model_dump()
    item = models.HeroItem(**data)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_hero_item(
    db: AsyncSession, hero_item_id: int, payload: schemas.HeroItemUpdate
) -> models.HeroItem:
    item = await get_hero_item(db, hero_item_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


async def delete_hero_item(db: AsyncSession, hero_item_id: int) -> int:
    item = await get_hero_item(db, hero_item_id)
    await db.delete(item)
    await db.commit()
    return hero_item_id
