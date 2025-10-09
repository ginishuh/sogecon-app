from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy.orm import Session

from .. import models, schemas
from ..errors import ApiError
from ..repositories import members as members_repo
from ..repositories import posts as posts_repo


def list_posts(
    db: Session, *, limit: int, offset: int, category: str | None = None
) -> Sequence[models.Post]:
    return posts_repo.list_posts(db, limit=limit, offset=offset, category=category)


def get_post(db: Session, post_id: int) -> models.Post:
    return posts_repo.get_post(db, post_id)


def create_post(db: Session, payload: schemas.PostCreate) -> models.Post:
    if payload.author_id is None:
        raise ApiError(
            code="post_author_required",
            detail="author_id is required",
            status=422,
        )
    _ = members_repo.get_member(db, payload.author_id)  # 존재하지 않으면 NotFoundError
    return posts_repo.create_post(db, payload)


def create_member_post(
    db: Session,
    payload: schemas.PostCreate,
    *,
    member_email: str,
    member_id: int | None = None,
) -> models.Post:
    author_id = member_id
    if author_id is None:
        member = members_repo.get_member_by_email(db, member_email)
        author_id = member.id
    sanitized = payload.model_copy(
        update={
            "author_id": author_id,
            "pinned": False,
            "published_at": None,
        }
    )
    return posts_repo.create_post(db, sanitized)
