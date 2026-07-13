from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from http import HTTPStatus

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app
from apps.api.routers import posts as posts_router


@pytest.fixture()
def anyio_backend() -> str:
    return "asyncio"


def _get_member_id() -> int:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _do_get() -> int:
        async for db in override():
            stmt = select(models.Member).where(
                models.Member.email == "member@example.com"
            )
            result = await db.execute(stmt)
            member = result.scalars().first()
            if member is None:
                raise RuntimeError("member@example.com not seeded")
            return member.id
        raise RuntimeError("DB session not available")

    return asyncio.run(_do_get())


def test_member_can_create_board_post(member_login: TestClient) -> None:
    payload = {"title": "멤버 게시글", "content": "본문", "category": "discussion"}
    res = member_login.post("/posts/", json=payload)

    assert res.status_code == HTTPStatus.CREATED
    body = res.json()
    assert body["title"] == payload["title"]
    assert body["pinned"] is False
    assert body["published_at"] is None
    assert body["created_at"] is not None
    assert body["author_id"] == _get_member_id()


def _seed_posts_for_effective_date_order() -> None:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _do_seed() -> None:
        async for db in override():
            result = await db.execute(
                select(models.Member).where(models.Member.email == "member@example.com")
            )
            member = result.scalars().first()
            if member is None:
                raise RuntimeError("member@example.com not seeded")
            member_id = member.id
            posts = [
                models.Post(
                    author_id=member_id,
                    title="고정 글",
                    content="본문",
                    category="discussion",
                    pinned=True,
                    created_at=datetime(2026, 1, 1, tzinfo=UTC),
                ),
                models.Post(
                    author_id=member_id,
                    title="신규 동문 글",
                    content="본문",
                    category="discussion",
                    created_at=datetime(2026, 1, 4, tzinfo=UTC),
                ),
                models.Post(
                    author_id=member_id,
                    title="관리자 발행 글",
                    content="본문",
                    category="discussion",
                    created_at=datetime(2026, 1, 2, tzinfo=UTC),
                    published_at=datetime(2026, 1, 3, tzinfo=UTC),
                ),
                models.Post(
                    author_id=member_id,
                    title="동률 이전 글",
                    content="본문",
                    category="discussion",
                    created_at=datetime(2026, 1, 2, tzinfo=UTC),
                ),
                models.Post(
                    author_id=member_id,
                    title="동률 이후 글",
                    content="본문",
                    category="discussion",
                    created_at=datetime(2026, 1, 2, tzinfo=UTC),
                ),
                models.Post(
                    author_id=member_id,
                    title="작성일 없는 기존 글",
                    content="본문",
                    category="discussion",
                    created_at=datetime(2026, 1, 5, tzinfo=UTC),
                ),
            ]
            db.add_all(posts)
            await db.commit()
            posts[-1].created_at = None
            await db.commit()
            return
        raise RuntimeError("DB session not available")

    asyncio.run(_do_seed())


def test_posts_use_published_or_created_date_for_order(
    member_login: TestClient,
) -> None:
    _seed_posts_for_effective_date_order()

    res = member_login.get("/posts/?limit=10&offset=0&category=discussion")

    assert res.status_code == HTTPStatus.OK
    items = res.json()
    assert [item["title"] for item in items] == [
        "고정 글",
        "신규 동문 글",
        "관리자 발행 글",
        "동률 이후 글",
        "동률 이전 글",
        "작성일 없는 기존 글",
    ]
    assert items[1]["published_at"] is None
    assert items[1]["created_at"] is not None
    assert items[-1]["created_at"] is None


def test_post_create_requires_auth(client: TestClient) -> None:
    res = client.post(
        "/posts/",
        json={"title": "비로그인", "content": "본문", "category": "discussion"},
    )
    assert res.status_code == HTTPStatus.UNAUTHORIZED


@pytest.mark.anyio("asyncio")
async def test_post_create_rate_limit(member_login: TestClient) -> None:
    posts_router.reset_member_post_limit_cache()

    transport = httpx.ASGITransport(app=app, client=("10.20.30.40", 8080))
    async with httpx.AsyncClient(transport=transport, base_url="http://local") as hc:
        login_res = await hc.post(
            "/auth/member/login",
            json={"student_id": "member001", "password": "memberpass"},
        )
        assert login_res.status_code == HTTPStatus.OK

        payload = {"title": "레이팅", "content": "본문", "category": "discussion"}
        for _ in range(5):
            res = await hc.post("/posts/", json=payload)
            assert res.status_code == HTTPStatus.CREATED

        res = await hc.post("/posts/", json=payload)
        assert res.status_code == HTTPStatus.TOO_MANY_REQUESTS
