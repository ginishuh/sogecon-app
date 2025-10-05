from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from .. import models
from ..errors import NotFoundError


def list_posts(db: Session, *, limit: int, offset: int) -> Sequence[models.Post]:
    stmt = (
        select(models.Post)
        .order_by(desc(models.Post.published_at))
        .offset(offset)
        .limit(limit)
    )
    return db.execute(stmt).scalars().all()


def get_post(db: Session, post_id: int) -> models.Post:
    post = db.get(models.Post, post_id)
    if post is None:
        raise NotFoundError("post not found")
    return post


def create_post(db: Session, payload: dict) -> models.Post:
    post = models.Post(**payload)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post
