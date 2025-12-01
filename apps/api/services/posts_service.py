from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..errors import ApiError
from ..repositories import members as members_repo
from ..repositories import posts as posts_repo


async def list_posts(
    db: AsyncSession, *, limit: int, offset: int, category: str | None = None
) -> Sequence[models.Post]:
    return await posts_repo.list_posts(
        db, limit=limit, offset=offset, category=category
    )


async def get_post(db: AsyncSession, post_id: int) -> models.Post:
    return await posts_repo.get_post(db, post_id)


async def create_post(db: AsyncSession, payload: schemas.PostCreate) -> models.Post:
    if payload.author_id is None:
        raise ApiError(
            code="post_author_required",
            detail="author_id is required",
            status=422,
        )
    _ = await members_repo.get_member(db, payload.author_id)  # NotFoundError
    return await posts_repo.create_post(db, payload)


async def create_member_post(
    db: AsyncSession,
    payload: schemas.PostCreate,
    *,
    member_student_id: str,
    member_id: int | None = None,
) -> models.Post:
    author_id = member_id
    if author_id is None:
        member = await members_repo.get_member_by_student_id(db, member_student_id)
        author_id = member.id
    sanitized = payload.model_copy(
        update={
            "author_id": author_id,
            "pinned": False,
            "published_at": None,
        }
    )
    return await posts_repo.create_post(db, sanitized)
