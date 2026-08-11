"""Reference checks for managed upload image paths."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..media_utils import normalize_media_path


def _stored_path_matches(value: str | None, relative_path: str) -> bool:
    if not value:
        return False
    normalized = normalize_media_path(value)
    return normalized == relative_path


async def is_managed_path_referenced(
    db: AsyncSession,
    relative_path: str,
    *,
    exclude_post_id: int | None = None,
    exclude_hero_id: int | None = None,
) -> bool:
    """Return True when another post/hero still references the managed path."""
    post_stmt = select(models.Post.id, models.Post.cover_image, models.Post.images)
    if exclude_post_id is not None:
        post_stmt = post_stmt.where(models.Post.id != exclude_post_id)
    post_rows = (await db.execute(post_stmt)).all()
    for _post_id, cover_image, images in post_rows:
        if _stored_path_matches(cover_image, relative_path):
            return True
        if images:
            for image in images:
                if _stored_path_matches(image, relative_path):
                    return True

    hero_stmt = select(models.HeroItem.image_override)
    if exclude_hero_id is not None:
        hero_stmt = hero_stmt.where(models.HeroItem.id != exclude_hero_id)
    hero_rows = (await db.execute(hero_stmt)).scalars().all()
    for image_override in hero_rows:
        if _stored_path_matches(image_override, relative_path):
            return True

    return False
