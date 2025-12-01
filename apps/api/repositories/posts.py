from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .. import models, schemas
from ..errors import NotFoundError


async def list_posts(
    db: AsyncSession, *, limit: int, offset: int, category: str | None = None
) -> Sequence[models.Post]:
    stmt = select(models.Post).options(selectinload(models.Post.author))
    if category:
        stmt = stmt.where(models.Post.category == category)
    stmt = (
        stmt.order_by(desc(models.Post.pinned), desc(models.Post.published_at))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_post(db: AsyncSession, post_id: int) -> models.Post:
    stmt = (
        select(models.Post)
        .options(selectinload(models.Post.author))
        .where(models.Post.id == post_id)
    )
    result = await db.execute(stmt)
    post = result.scalar_one_or_none()
    if post is None:
        raise NotFoundError(code="post_not_found", detail="Post not found")
    return post


async def create_post(db: AsyncSession, payload: schemas.PostCreate) -> models.Post:
    data = payload.model_dump()
    post = models.Post(**data)
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


async def increment_view_count(db: AsyncSession, post_id: int) -> None:
    """게시물 조회수를 1 증가시킵니다."""
    stmt = (
        update(models.Post)
        .where(models.Post.id == post_id)
        .values(view_count=models.Post.view_count + 1)
    )
    await db.execute(stmt)
    await db.commit()


async def get_comment_count(db: AsyncSession, post_id: int) -> int:
    """게시물의 댓글 수를 반환합니다."""
    stmt = select(func.count(models.Comment.id)).where(
        models.Comment.post_id == post_id
    )
    result = await db.execute(stmt)
    count = result.scalar()
    return count if count is not None else 0


async def get_comment_counts_batch(
    db: AsyncSession, post_ids: Sequence[int]
) -> dict[int, int]:
    """여러 게시물의 댓글 수를 한 번에 조회합니다 (N+1 쿼리 방지)."""
    if not post_ids:
        return {}
    stmt = (
        select(models.Comment.post_id, func.count(models.Comment.id))
        .where(models.Comment.post_id.in_(post_ids))
        .group_by(models.Comment.post_id)
    )
    result = await db.execute(stmt)
    return {row[0]: row[1] for row in result.all()}
