from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass
from http import HTTPStatus
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..config import get_settings
from ..db import get_db
from ..errors import ApiError
from ..ratelimit import get_client_ip_for_rate_limit, should_skip_rate_limit
from ..repositories import posts as posts_repo
from ..services import posts_service
from .auth import require_admin, require_member

router = APIRouter(prefix="/posts", tags=["posts"])


# 멤버 게시글 작성 레이트리밋 (in-memory)
# 주의: 멀티워커 환경에서는 워커 간 상태가 공유되지 않아 일관성이 깨질 수 있음.
# 운영 환경에서는 Redis 기반 분산 레이트리밋(slowapi + Redis)으로 전환 권장.
_MEMBER_RATE_TABLE: dict[str, deque[float]] = defaultdict(deque)


def _parse_rate_limit(raw: str) -> tuple[int, float]:
    value = raw.strip().lower()
    try:
        amount_str, unit = value.split("/", 1)
        amount = int(amount_str)
    except ValueError as exc:  # pragma: no cover - defensive
        raise ValueError(f"Invalid rate limit format: {raw}") from exc
    unit = unit.strip()
    seconds_map = {
        "second": 1.0,
        "sec": 1.0,
        "s": 1.0,
        "minute": 60.0,
        "min": 60.0,
        "m": 60.0,
        "hour": 3600.0,
        "h": 3600.0,
        "day": 86400.0,
        "d": 86400.0,
    }
    if unit not in seconds_map:
        raise ValueError(f"Unsupported rate limit unit: {raw}")
    return amount, seconds_map[unit]


def _enforce_member_post_limit(request: Request, limit_value: str) -> None:
    """멤버 게시글 작성 레이트리밋 적용.

    주의: 현재 in-memory 구현으로 멀티워커 환경에서 일관성이 보장되지 않음.
    운영 환경에서는 Redis 기반 분산 레이트리밋으로 전환 권장.
    """
    if should_skip_rate_limit():
        return
    amount, window = _parse_rate_limit(limit_value)
    key = get_client_ip_for_rate_limit(request)
    now = time.monotonic()
    bucket = _MEMBER_RATE_TABLE[key]
    while bucket and now - bucket[0] > window:
        bucket.popleft()
    if len(bucket) >= amount:
        raise HTTPException(status_code=429, detail="rate_limited")
    bucket.append(now)


def reset_member_post_limit_cache() -> None:
    _MEMBER_RATE_TABLE.clear()


@dataclass
class PostListQueryParams:
    """공개 게시글 목록 쿼리 파라미터."""

    limit: int = 10
    offset: int = 0
    category: str | None = None
    categories: list[str] | None = None
    q: str | None = None


def get_post_list_params(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: str | None = Query(None),
    categories: list[str] | None = Query(None),
    q: str | None = Query(None, max_length=100),
) -> PostListQueryParams:
    return PostListQueryParams(
        limit=limit,
        offset=offset,
        category=category,
        categories=categories,
        q=q,
    )


@router.get("/", response_model=list[schemas.PostRead])
async def list_posts(
    params: PostListQueryParams = Depends(get_post_list_params),
    db: AsyncSession = Depends(get_db),
) -> list[schemas.PostRead]:
    if params.category is not None and params.categories is not None:
        raise ApiError(
            code="category_query_conflict",
            detail="category and categories cannot be used together",
            status=400,
        )
    posts = await posts_service.list_posts(
        db,
        limit=params.limit,
        offset=params.offset,
        filters={
            "category": params.category,
            "categories": params.categories,
            "q": params.q,
        },
    )
    # N+1 쿼리 방지: 배치로 댓글 수 조회
    post_ids = [cast(int, p.id) for p in posts]
    comment_counts = await posts_repo.get_comment_counts_batch(db, post_ids)
    result: list[schemas.PostRead] = []
    for post in posts:
        post_read = schemas.PostRead.model_validate(post)
        post_read.author_name = post.author.name if post.author else None
        post_read.comment_count = comment_counts.get(cast(int, post.id), 0)
        result.append(post_read)
    return result


@router.get("/{post_id}", response_model=schemas.PostRead)
async def get_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
) -> schemas.PostRead:
    post = await posts_service.get_public_post(db, post_id)
    await posts_repo.increment_view_count(db, post_id)
    await db.refresh(post)
    post_read = schemas.PostRead.model_validate(post)
    post_read.author_name = post.author.name if post.author else None
    post_read.comment_count = await posts_repo.get_comment_count(db, cast(int, post.id))
    return post_read


@router.post("/", response_model=schemas.PostRead, status_code=201)
async def create_post(
    payload: schemas.PostCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> schemas.PostRead:
    try:
        admin = await require_admin(request, db)
        # 보안: 클라이언트가 보낸 author_id를 무시하고 서버에서 강제 주입
        # student_id로 member를 조회하여 author_id 결정 (레거시 세션 호환)
        # 관리자는 pinned, published_at 등 관리자 권한 필드 설정 가능
        post = await posts_service.create_admin_post(
            db,
            payload,
            admin_student_id=admin.student_id,
        )
    except HTTPException as exc_admin:
        if exc_admin.status_code not in (
            HTTPStatus.UNAUTHORIZED,
            HTTPStatus.FORBIDDEN,
        ):
            raise
        try:
            member = await require_member(request, db)
        except HTTPException as exc_member:
            raise HTTPException(status_code=401, detail="unauthorized") from exc_member

        settings = get_settings()
        _enforce_member_post_limit(request, settings.rate_limit_post_create)

        sanitized = payload.model_copy(update={"pinned": False, "published_at": None})
        post = await posts_service.create_member_post(
            db,
            sanitized,
            member_student_id=member.student_id,
            member_id=member.id,
        )

    return schemas.PostRead.model_validate(post)


@router.patch("/{post_id}", response_model=schemas.PostRead)
async def update_post(
    post_id: int,
    payload: schemas.PostUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> schemas.PostRead:
    """게시물 수정 (관리자 전용)."""
    await require_admin(request, db)
    post = await posts_service.update_admin_post(db, post_id, payload)
    post_read = schemas.PostRead.model_validate(post)
    post_read.author_name = post.author.name if post.author else None
    post_read.comment_count = await posts_repo.get_comment_count(db, cast(int, post.id))
    return post_read


@router.delete("/{post_id}")
async def delete_post(
    post_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool | int]:
    """게시물 삭제 (관리자 전용)."""
    await require_admin(request, db)
    deleted_id = await posts_service.delete_admin_post(db, post_id)
    return {"ok": True, "deleted_id": deleted_id}
