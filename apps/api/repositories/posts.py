from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import desc, func, select, update
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..errors import NotFoundError


def list_posts(
    db: Session, *, limit: int, offset: int, category: str | None = None
) -> Sequence[models.Post]:
    stmt = select(models.Post).options(joinedload(models.Post.author))
    if category:
        stmt = stmt.where(models.Post.category == category)
    stmt = (
        stmt.order_by(desc(models.Post.pinned), desc(models.Post.published_at))
        .offset(offset)
        .limit(limit)
    )
    return db.execute(stmt).scalars().all()


def get_post(db: Session, post_id: int) -> models.Post:
    stmt = (
        select(models.Post)
        .options(joinedload(models.Post.author))
        .where(models.Post.id == post_id)
    )
    post = db.execute(stmt).scalar_one_or_none()
    if post is None:
        raise NotFoundError(code="post_not_found", detail="Post not found")
    return post


def create_post(db: Session, payload: schemas.PostCreate) -> models.Post:
    data = payload.model_dump()
    post = models.Post(**data)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def increment_view_count(db: Session, post_id: int) -> None:
    """게시물 조회수를 1 증가시킵니다."""
    stmt = (
        update(models.Post)
        .where(models.Post.id == post_id)
        .values(view_count=models.Post.view_count + 1)
    )
    db.execute(stmt)
    db.commit()


def get_comment_count(db: Session, post_id: int) -> int:
    """게시물의 댓글 수를 반환합니다."""
    stmt = select(func.count(models.Comment.id)).where(
        models.Comment.post_id == post_id
    )
    count = db.execute(stmt).scalar()
    return count if count is not None else 0


def get_comment_counts_batch(db: Session, post_ids: Sequence[int]) -> dict[int, int]:
    """여러 게시물의 댓글 수를 한 번에 조회합니다 (N+1 쿼리 방지)."""
    if not post_ids:
        return {}
    stmt = (
        select(models.Comment.post_id, func.count(models.Comment.id))
        .where(models.Comment.post_id.in_(post_ids))
        .group_by(models.Comment.post_id)
    )
    result = db.execute(stmt).all()
    return {row[0]: row[1] for row in result}
