from __future__ import annotations

from contextlib import suppress
from http import HTTPStatus

import httpx
import pytest
from fastapi.testclient import TestClient

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
    gen = override()
    db = next(gen)
    try:
        member = (
            db.query(models.Member)
            .filter(models.Member.email == "member@example.com")
            .first()
        )
        if member is None:
            raise RuntimeError("member@example.com not seeded")
        return member.id
    finally:
        db.close()
        with suppress(RuntimeError, StopIteration):
            gen.close()


def test_member_can_create_board_post(member_login: TestClient) -> None:
    payload = {"title": "멤버 게시글", "content": "본문", "category": "discussion"}
    res = member_login.post("/posts/", json=payload)

    assert res.status_code == HTTPStatus.CREATED
    body = res.json()
    assert body["title"] == payload["title"]
    assert body["pinned"] is False
    assert body["published_at"] is None
    assert body["author_id"] == _get_member_id()


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
