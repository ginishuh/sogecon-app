from __future__ import annotations

import asyncio
from http import HTTPStatus

from fastapi.testclient import TestClient

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app


def _seed_author() -> int:
    override = app.dependency_overrides.get(get_db)
    assert override is not None

    async def _do_seed() -> int:
        async for db in override():
            m = models.Member(
                student_id="20250001",
                email="author@example.com",
                name="Author",
                cohort=2025,
            )
            db.add(m)
            await db.commit()
            await db.refresh(m)
            return m.id  # type: ignore[return-value]
        raise RuntimeError("DB session not available")

    return asyncio.run(_do_seed())


def test_posts_category_pinned_cover_image(admin_login: TestClient) -> None:
    client = admin_login
    author_id = _seed_author()

    # create posts: notice (pinned), notice, news
    p1 = client.post(
        "/posts/",
        json={
            "author_id": author_id,
            "title": "Notice Pinned",
            "content": "Body1",
            "published_at": None,
            "category": "notice",
            "pinned": True,
            "cover_image": "https://example.com/cover1.png",
        },
    )
    assert p1.status_code in (HTTPStatus.CREATED, HTTPStatus.OK)
    data1 = p1.json()
    assert data1.get("category") == "notice" and data1.get("pinned") is True
    assert data1.get("cover_image") == "https://example.com/cover1.png"

    p2 = client.post(
        "/posts/",
        json={
            "author_id": author_id,
            "title": "Notice",
            "content": "Body2",
            "published_at": None,
            "category": "notice",
            "pinned": False,
        },
    )
    assert p2.status_code in (HTTPStatus.CREATED, HTTPStatus.OK)

    p3 = client.post(
        "/posts/",
        json={
            "author_id": author_id,
            "title": "News",
            "content": "Body3",
            "published_at": None,
            "category": "news",
        },
    )
    assert p3.status_code in (HTTPStatus.CREATED, HTTPStatus.OK)

    # list only notice
    r = client.get("/posts/?limit=10&offset=0&category=notice")
    assert r.status_code == HTTPStatus.OK
    lst = r.json()
    expected = 2
    assert len(lst) == expected
    # pinned first
    assert lst[0]["pinned"] is True

    # list by categories (notice + news)
    r2 = client.get(
        "/posts/?limit=10&offset=0&categories=notice&categories=news"
    )
    assert r2.status_code == HTTPStatus.OK
    lst2 = r2.json()
    assert len(lst2) == 3
    assert lst2[0]["pinned"] is True
