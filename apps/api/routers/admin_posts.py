"""관리자 게시물 관리 API."""

from __future__ import annotations

from dataclasses import dataclass
from typing import cast

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..db import get_db
from ..repositories import posts as posts_repo
from ..services import posts_service
from .auth import CurrentUser, require_any_permission, require_permission

router = APIRouter(prefix="/admin/posts", tags=["admin-posts"])


@dataclass
class AdminPostQueryParams:
    """관리자 게시물 목록 쿼리 파라미터 (의존성 주입)."""

    limit: int = 20
    offset: int = 0
    category: str | None = None
    status: str | None = None
    q: str | None = None


def get_admin_post_params(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: str | None = Query(None),
    status: str | None = Query(None, pattern="^(published|scheduled|draft)$"),
    q: str | None = Query(None, max_length=100),
) -> AdminPostQueryParams:
    """쿼리 파라미터를 AdminPostQueryParams로 변환."""
    return AdminPostQueryParams(
        limit=limit, offset=offset, category=category, status=status, q=q
    )


class AdminPostListResponse(BaseModel):
    """관리자 게시물 목록 응답."""

    items: list[schemas.PostRead]
    total: int


@router.get("/", response_model=AdminPostListResponse)
async def list_admin_posts(
    params: AdminPostQueryParams = Depends(get_admin_post_params),
    db: AsyncSession = Depends(get_db),
    _admin: CurrentUser = Depends(
        require_permission("admin_posts", allow_admin_fallback=False)
    ),
) -> AdminPostListResponse:
    """관리자용 게시물 목록 (비공개 포함)."""
    filters: posts_repo.AdminPostFilters = {
        "category": params.category,
        "status": params.status,
        "q": params.q,
    }
    posts, total = await posts_service.list_admin_posts_with_total(
        db, limit=params.limit, offset=params.offset, filters=filters
    )
    # N+1 방지: 배치로 댓글 수 조회
    post_ids = [cast(int, p.id) for p in posts]
    comment_counts = await posts_repo.get_comment_counts_batch(db, post_ids)
    items: list[schemas.PostRead] = []
    for post in posts:
        post_read = schemas.PostRead.model_validate(post)
        post_read.author_name = post.author.name if post.author else None
        post_read.comment_count = comment_counts.get(cast(int, post.id), 0)
        items.append(post_read)
    return AdminPostListResponse(items=items, total=total)


@router.get("/{post_id}/preview", response_model=schemas.PostRead)
async def preview_admin_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: CurrentUser = Depends(
        require_any_permission(
            ("admin_posts", "admin_hero"), allow_admin_fallback=False
        )
    ),
) -> schemas.PostRead:
    """관리자 게시물 미리보기 (게시물 또는 hero 읽기 권한)."""
    post = await posts_service.get_post(db, post_id)
    post_read = schemas.PostRead.model_validate(post)
    post_read.author_name = post.author.name if post.author else None
    post_read.comment_count = await posts_repo.get_comment_count(db, cast(int, post.id))
    return post_read
