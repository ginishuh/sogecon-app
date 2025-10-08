from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy.orm import Session

from .. import models, schemas
from ..repositories import members as members_repo
from ..repositories import posts as posts_repo


def list_posts(
    db: Session, *, limit: int, offset: int, category: str | None = None
) -> Sequence[models.Post]:
    return posts_repo.list_posts(db, limit=limit, offset=offset, category=category)


def get_post(db: Session, post_id: int) -> models.Post:
    return posts_repo.get_post(db, post_id)


def create_post(db: Session, payload: schemas.PostCreate) -> models.Post:
    # 작성자 존재 확인
    _ = members_repo.get_member(db, payload.author_id)  # 존재하지 않으면 NotFoundError
    return posts_repo.create_post(db, payload)
