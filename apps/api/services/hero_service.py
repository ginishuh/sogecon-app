from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from typing import cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..repositories import events as events_repo
from ..repositories import hero_items as hero_items_repo
from ..repositories import posts as posts_repo

_BOARD_POST_CATEGORIES = {"discussion", "question", "share", "congrats"}


def _is_post_public(post: models.Post) -> bool:
    category = cast(str | None, post.category)
    if category in _BOARD_POST_CATEGORIES:
        return True

    published_at = cast(datetime | None, post.published_at)
    if published_at is None:
        return False
    now = datetime.now(UTC)
    return published_at <= now


def _post_href(post: models.Post) -> str:
    post_id = cast(int, post.id)
    category = cast(str | None, post.category)
    if category in _BOARD_POST_CATEGORIES:
        return f"/board/{post_id}"
    return f"/posts/{post_id}"


async def _get_posts_by_ids(
    db: AsyncSession, ids: Sequence[int]
) -> dict[int, models.Post]:
    if not ids:
        return {}
    stmt = select(models.Post).where(models.Post.id.in_(list(ids)))
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return {cast(int, row.id): row for row in rows}


async def _get_events_by_ids(
    db: AsyncSession, ids: Sequence[int]
) -> dict[int, models.Event]:
    if not ids:
        return {}
    stmt = select(models.Event).where(models.Event.id.in_(list(ids)))
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return {cast(int, row.id): row for row in rows}


async def list_hero_slides(
    db: AsyncSession, *, limit: int, allow_unpublished: bool = False
) -> list[schemas.HeroSlide]:
    # invalid/missing target을 건너뛰는 경우를 고려해 여유 있게 조회
    fetch_limit = min(limit * 3, 50)
    items = await hero_items_repo.list_hero_items(
        db, limit=fetch_limit, offset=0, enabled_only=True
    )

    post_ids = [
        cast(int, i.target_id) for i in items if cast(str, i.target_type) == "post"
    ]
    event_ids = [
        cast(int, i.target_id) for i in items if cast(str, i.target_type) == "event"
    ]

    posts = await _get_posts_by_ids(db, post_ids)
    events = await _get_events_by_ids(db, event_ids)

    slides: list[schemas.HeroSlide] = []
    for item in items:
        target_type = cast(str, item.target_type)
        target_id = cast(int, item.target_id)

        if target_type == "post":
            post = posts.get(target_id)
            if post is None:
                continue
            unpublished = not _is_post_public(post)
            if unpublished and not allow_unpublished:
                continue

            slides.append(
                schemas.HeroSlide(
                    id=cast(int, item.id),
                    target_type="post",
                    target_id=target_id,
                    title=cast(str, item.title_override or post.title),
                    description=cast(str, item.description_override or post.content),
                    image=cast(str | None, item.image_override or post.cover_image),
                    href=_post_href(post),
                    unpublished=unpublished,
                )
            )
        elif target_type == "event":
            event = events.get(target_id)
            if event is None:
                continue
            slides.append(
                schemas.HeroSlide(
                    id=cast(int, item.id),
                    target_type="event",
                    target_id=target_id,
                    title=cast(str, item.title_override or event.title),
                    description=cast(
                        str,
                        item.description_override
                        or event.description
                        or "행사 안내",
                    ),
                    image=cast(str | None, item.image_override),
                    href=f"/events/{target_id}",
                    unpublished=False,
                )
            )
        else:
            # 스키마/검증에서 걸러져야 하지만, 안전하게 skip
            continue

        if len(slides) >= limit:
            break

    return slides


async def list_admin_hero_items_with_total(
    db: AsyncSession, *, limit: int, offset: int
) -> tuple[Sequence[models.HeroItem], int]:
    items = await hero_items_repo.list_hero_items(
        db, limit=limit, offset=offset, enabled_only=False
    )
    total = await hero_items_repo.count_hero_items(db, enabled_only=False)
    return items, total


async def get_admin_hero_item(db: AsyncSession, hero_item_id: int) -> models.HeroItem:
    return await hero_items_repo.get_hero_item(db, hero_item_id)


async def _ensure_target_exists(
    db: AsyncSession, *, target_type: schemas.HeroTargetTypeLiteral, target_id: int
) -> None:
    if target_type == "post":
        _ = await posts_repo.get_post(db, target_id)
        return
    _ = await events_repo.get_event(db, target_id)


async def create_admin_hero_item(
    db: AsyncSession, payload: schemas.HeroItemCreate
) -> models.HeroItem:
    await _ensure_target_exists(
        db, target_type=payload.target_type, target_id=payload.target_id
    )
    return await hero_items_repo.create_hero_item(db, payload)


async def update_admin_hero_item(
    db: AsyncSession, hero_item_id: int, payload: schemas.HeroItemUpdate
) -> models.HeroItem:
    current = await hero_items_repo.get_hero_item(db, hero_item_id)
    next_type = (
        payload.target_type
        if payload.target_type is not None
        else cast(schemas.HeroTargetTypeLiteral, current.target_type)
    )
    next_id = (
        payload.target_id
        if payload.target_id is not None
        else cast(int, current.target_id)
    )
    if payload.target_type is not None or payload.target_id is not None:
        await _ensure_target_exists(db, target_type=next_type, target_id=next_id)
    return await hero_items_repo.update_hero_item(db, hero_item_id, payload)


async def delete_admin_hero_item(db: AsyncSession, hero_item_id: int) -> int:
    return await hero_items_repo.delete_hero_item(db, hero_item_id)
