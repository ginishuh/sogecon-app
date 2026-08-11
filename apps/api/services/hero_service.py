from __future__ import annotations

from collections.abc import Sequence
from typing import cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..post_visibility import is_post_public, post_public_href
from ..repositories import events as events_repo
from ..repositories import hero_items as hero_items_repo
from ..repositories import posts as posts_repo
from . import upload_service


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
            unpublished = not is_post_public(post)
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
                    href=post_public_href(post),
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


async def list_admin_hero_items_by_targets(
    db: AsyncSession,
    *,
    target_type: schemas.HeroTargetTypeLiteral,
    target_ids: Sequence[int],
) -> Sequence[models.HeroItem]:
    return await hero_items_repo.list_hero_items_by_targets(
        db, target_type=target_type, target_ids=target_ids
    )


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
    db: AsyncSession,
    payload: schemas.HeroItemCreate,
    *,
    actor_member_id: int,
) -> models.HeroItem:
    await _ensure_target_exists(
        db, target_type=payload.target_type, target_id=payload.target_id
    )
    attach_paths = upload_service.collect_managed_image_paths(
        image_override=payload.image_override,
    )
    await upload_service.validate_actor_owns_attach_paths(
        db, actor_member_id=actor_member_id, attach_paths=attach_paths
    )
    return await hero_items_repo.create_hero_item(db, payload)


async def update_admin_hero_item(
    db: AsyncSession,
    hero_item_id: int,
    payload: schemas.HeroItemUpdate,
    *,
    actor_member_id: int,
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
    old_paths = upload_service.collect_managed_image_paths(
        image_override=cast(str | None, current.image_override),
    )
    new_override = (
        payload.image_override
        if "image_override" in payload.model_fields_set
        else cast(str | None, current.image_override)
    )
    new_paths = upload_service.collect_managed_image_paths(
        image_override=new_override,
    )
    updated_holder: list[models.HeroItem] = []

    async def apply_update() -> None:
        updated_holder.append(
            await hero_items_repo.apply_hero_item_update(
                db, hero_item_id, payload
            )
        )

    await upload_service.apply_resource_image_lifecycle(
        db,
        upload_service.ResourceImageTransition(
            actor_member_id=actor_member_id,
            old_paths=old_paths,
            new_paths=new_paths,
            exclude_hero_id=hero_item_id,
        ),
        apply_update,
    )
    return updated_holder[0]


async def delete_admin_hero_item(
    db: AsyncSession, hero_item_id: int, *, actor_member_id: int
) -> int:
    item = await hero_items_repo.get_hero_item(db, hero_item_id)
    paths = upload_service.collect_managed_image_paths(
        image_override=cast(str | None, item.image_override),
    )

    async def apply_delete() -> None:
        await hero_items_repo.apply_hero_item_delete(db, hero_item_id)

    await upload_service.apply_resource_image_lifecycle(
        db,
        upload_service.ResourceImageTransition(
            actor_member_id=actor_member_id,
            old_paths=paths,
            new_paths=set(),
            exclude_hero_id=hero_item_id,
        ),
        apply_delete,
    )
    return hero_item_id
