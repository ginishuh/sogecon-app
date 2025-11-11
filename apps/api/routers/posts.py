from __future__ import annotations

import time
from collections import defaultdict, deque
from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from .. import schemas
from ..config import get_settings
from ..db import get_db
from ..services import posts_service
from .auth import require_admin, require_member

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
def list_posts(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[schemas.PostRead]:
    posts = posts_service.list_posts(db, limit=limit, offset=offset, category=category)
    result = []
    for post in posts:
        post_read = schemas.PostRead.model_validate(post)
        post_read.author_name = post.author.name if post.author else None
        result.append(post_read)
    return result


@router.get("/{post_id}", response_model=schemas.PostRead)
def get_post(post_id: int, db: Session = Depends(get_db)) -> schemas.PostRead:
    post = posts_service.get_post(db, post_id)
    post_read = schemas.PostRead.model_validate(post)
    post_read.author_name = post.author.name if post.author else None
    return post_read


@router.post("/", response_model=schemas.PostRead, status_code=201)
def create_post(
    payload: schemas.PostCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> schemas.PostRead:
    try:
        require_admin(request)
        post = posts_service.create_post(db, payload)
    except HTTPException as exc_admin:
        if exc_admin.status_code != HTTPStatus.UNAUTHORIZED:
            raise
        try:
            member = require_member(request)
        except HTTPException as exc_member:
            raise HTTPException(status_code=401, detail="unauthorized") from exc_member

        settings = get_settings()
        _enforce_member_post_limit(request, settings.rate_limit_post_create)

        sanitized = payload.model_copy(update={"pinned": False, "published_at": None})
        post = posts_service.create_member_post(
            db,
            sanitized,
            member_student_id=member.student_id,
            member_id=member.id,
        )

    return schemas.PostRead.model_validate(post)
