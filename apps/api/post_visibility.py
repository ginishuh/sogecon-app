"""게시글 공개 가시성 SSOT.

board 카테고리는 published_at과 무관하게 공개.
notice/news 등 그 외는 published_at이 있고 now(UTC) 이하일 때만 공개.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Final, cast

from sqlalchemy import ColumnElement, or_

from . import models

BOARD_POST_CATEGORIES: Final[frozenset[str]] = frozenset(
    {"discussion", "question", "share", "congrats"}
)


def is_post_public(post: models.Post, *, now: datetime | None = None) -> bool:
    """단일 게시글이 공개 API에 노출 가능한지."""
    category = cast(str | None, post.category)
    if category in BOARD_POST_CATEGORIES:
        return True

    published_at = cast(datetime | None, post.published_at)
    if published_at is None:
        return False
    current = now if now is not None else datetime.now(UTC)
    return published_at <= current


def public_visibility_clause(
    *, now: datetime | None = None
) -> ColumnElement[bool]:
    """공개 목록용 SQL 조건 (board OR published_at <= now)."""
    current = now if now is not None else datetime.now(UTC)
    return or_(
        models.Post.category.in_(list(BOARD_POST_CATEGORIES)),
        models.Post.published_at.isnot(None) & (models.Post.published_at <= current),
    )


def post_public_href(post: models.Post) -> str:
    post_id = cast(int, post.id)
    category = cast(str | None, post.category)
    if category in BOARD_POST_CATEGORIES:
        return f"/board/{post_id}"
    return f"/posts/{post_id}"
