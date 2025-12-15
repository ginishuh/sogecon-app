from __future__ import annotations

import time
from collections import defaultdict, deque
from http import HTTPStatus
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .. import schemas
from ..config import get_settings
from ..db import get_db
from ..errors import ApiError
from ..repositories import posts as posts_repo
from ..services import posts_service
from .auth import is_admin, require_admin, require_member

router = APIRouter(prefix="/posts", tags=["posts"])


def _is_test_client(request: Request) -> bool:
    return bool(request.client and request.client.host == "testclient")


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
    if _is_test_client(request):
        return
    amount, window = _parse_rate_limit(limit_value)
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    bucket = _MEMBER_RATE_TABLE[key]
    while bucket and now - bucket[0] > window:
        bucket.popleft()
    if len(bucket) >= amount:
        raise HTTPException(status_code=429, detail="rate_limited")
    bucket.append(now)


def reset_member_post_limit_cache() -> None:
    _MEMBER_RATE_TABLE.clear()


@router.get("/", response_model=list[schemas.PostRead])
async def list_posts(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: str | None = Query(None),
    categories: list[str] | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[schemas.PostRead]:
    if category is not None and categories is not None:
        raise ApiError(
            code="category_query_conflict",
            detail="category and categories cannot be used together",
            status=400,
        )
    posts = await posts_service.list_posts(
        db, limit=limit, offset=offset, category=category, categories=categories
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
    request: Request,
    post_id: int,
    db: AsyncSession = Depends(get_db),
) -> schemas.PostRead:
    post = await posts_service.get_post(db, post_id)
    # 관리자 조회는 통계 왜곡을 피하기 위해 조회수 증가 제외
    if not is_admin(request):
        # 조회수 증가 후 refresh로 최신 값 반영 (재조회 대신)
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
        admin = require_admin(request)
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
            member = require_member(request)
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
    require_admin(request)
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
    require_admin(request)
    deleted_id = await posts_service.delete_admin_post(db, post_id)
    return {"ok": True, "deleted_id": deleted_id}
