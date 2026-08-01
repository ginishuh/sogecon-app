"""회원 본인 board 게시글 수정·삭제 API 테스트."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from http import HTTPStatus
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app


def _db_override() -> Any:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")
    return override


def _seed_member_owned_post(
    category: str | None = "discussion",
    published_at: datetime | None = None,
) -> int:
    async def _do_seed() -> int:
        async for db in _db_override()():
            member_result = await db.execute(
                select(models.Member).where(models.Member.email == "member@example.com")
            )
            member = member_result.scalar_one()
            post = models.Post(
                author_id=member.id,
                title="회원 소유 게시글",
                content="회원 소유 본문",
                category=category,
                published_at=published_at,
                pinned=False,
            )
            db.add(post)
            await db.commit()
            await db.refresh(post)
            return post.id
        raise RuntimeError("DB session not available")

    return asyncio.run(_do_seed())


def _read_post_row(post_id: int) -> dict[str, object]:
    async def _do_read() -> dict[str, object]:
        async for db in _db_override()():
            result = await db.execute(
                select(models.Post).where(models.Post.id == post_id)
            )
            post = result.scalar_one()
            return {
                "author_id": post.author_id,
                "category": post.category,
                "published_at": post.published_at,
                "pinned": post.pinned,
                "view_count": post.view_count,
                "title": post.title,
                "content": post.content,
                "cover_image": post.cover_image,
                "images": post.images,
            }
        raise RuntimeError("DB session not available")

    return asyncio.run(_do_read())


def _create_member_board_post(member_login: TestClient) -> dict[str, object]:
    response = member_login.post(
        "/posts/",
        json={
            "title": "회원 board 글",
            "content": "수정 전 본문",
            "category": "discussion",
        },
    )
    assert response.status_code == HTTPStatus.CREATED
    return response.json()


def test_member_can_update_own_board_post_and_preserve_server_fields(
    member_login: TestClient,
) -> None:
    created = _create_member_board_post(member_login)
    post_id = created["id"]
    before_view_count = created["view_count"]

    response = member_login.patch(
        f"/board/posts/{post_id}",
        json={
            "title": "회원 board 수정 글",
            "content": "수정 후 본문",
            "cover_image": None,
            "images": [],
        },
    )

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["title"] == "회원 board 수정 글"
    assert body["content"] == "수정 후 본문"
    assert body["author_id"] == created["author_id"]
    assert body["category"] == "discussion"
    assert body["published_at"] is None
    assert body["pinned"] is False
    assert body["view_count"] == before_view_count

    row = _read_post_row(post_id)
    assert row["title"] == "회원 board 수정 글"
    assert row["content"] == "수정 후 본문"
    assert row["author_id"] == created["author_id"]
    assert row["category"] == "discussion"
    assert row["published_at"] is None
    assert row["pinned"] is False
    assert row["view_count"] == before_view_count
    assert row["cover_image"] is None
    assert row["images"] == []


def test_member_can_delete_own_board_post(member_login: TestClient) -> None:
    created = _create_member_board_post(member_login)
    post_id = created["id"]

    response = member_login.delete(f"/board/posts/{post_id}")

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {"ok": True, "deleted_id": post_id}
    assert member_login.get(f"/posts/{post_id}").status_code == HTTPStatus.NOT_FOUND


def test_member_cannot_mutate_another_members_board_post(
    admin_login: TestClient,
    member_login: TestClient,
) -> None:
    admin_login.post(
        "/auth/login", json={"student_id": "__seed__admin", "password": "__seed__"}
    )
    created = admin_login.post(
        "/posts/",
        json={
            "title": "다른 회원 board 글",
            "content": "관리자 소유지만 board category",
            "category": "discussion",
        },
    )
    assert created.status_code == HTTPStatus.CREATED
    post_id = created.json()["id"]

    member_login_response = admin_login.post(
        "/auth/member/login",
        json={"student_id": "member001", "password": "memberpass"},
    )
    assert member_login_response.status_code == HTTPStatus.OK

    update = admin_login.patch(
        f"/board/posts/{post_id}", json={"title": "탈취 시도"}
    )
    delete = admin_login.delete(f"/board/posts/{post_id}")

    assert update.status_code == HTTPStatus.FORBIDDEN
    assert update.json()["code"] == "post_owner_required"
    assert delete.status_code == HTTPStatus.FORBIDDEN
    assert delete.json()["code"] == "post_owner_required"


@pytest.mark.parametrize(
    ("category", "published_at"),
    [
        ("notice", None),
        ("notice", datetime(2099, 1, 1, tzinfo=UTC)),
        ("news", datetime(2099, 1, 1, tzinfo=UTC)),
        ("notice", datetime(2020, 1, 1, tzinfo=UTC)),
        ("news", datetime(2020, 1, 1, tzinfo=UTC)),
        (None, None),
    ],
    ids=[
        "notice-draft",
        "notice-scheduled",
        "news-scheduled",
        "notice-published",
        "news-published",
        "legacy-non-board",
    ],
)
def test_member_owner_mutation_hides_non_board_posts(
    member_login: TestClient,
    category: str | None,
    published_at: datetime | None,
) -> None:
    post_id = _seed_member_owned_post(category, published_at)

    update = member_login.patch(
        f"/board/posts/{post_id}", json={"title": "공개 범위 우회"}
    )
    delete = member_login.delete(f"/board/posts/{post_id}")

    assert update.status_code == HTTPStatus.NOT_FOUND
    assert update.json()["code"] == "post_not_found"
    assert delete.status_code == HTTPStatus.NOT_FOUND
    assert delete.json()["code"] == "post_not_found"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("category", "notice"),
        ("published_at", datetime(2026, 8, 1, tzinfo=UTC).isoformat()),
        ("pinned", True),
        ("unpublish", True),
        ("author_id", 999999),
        ("view_count", 999999),
    ],
)
def test_member_owner_payload_rejects_admin_fields(
    member_login: TestClient,
    field: str,
    value: object,
) -> None:
    created = _create_member_board_post(member_login)

    response = member_login.patch(
        f"/board/posts/{created['id']}", json={field: value}
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


@pytest.mark.parametrize("field", ["title", "content"])
def test_member_owner_payload_rejects_explicit_null(
    member_login: TestClient,
    field: str,
) -> None:
    created = _create_member_board_post(member_login)

    response = member_login.patch(
        f"/board/posts/{created['id']}", json={field: None}
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_owner_mutation_requires_auth(member_login: TestClient) -> None:
    post_id = _seed_member_owned_post()
    member_login.post("/auth/member/logout")

    update = member_login.patch(f"/board/posts/{post_id}", json={"title": "비로그인"})
    delete = member_login.delete(f"/board/posts/{post_id}")

    assert update.status_code == HTTPStatus.UNAUTHORIZED
    assert delete.status_code == HTTPStatus.UNAUTHORIZED
