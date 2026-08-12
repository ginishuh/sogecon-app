from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from http import HTTPStatus

import bcrypt
import httpx
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app
from tests.api.problem_assertions import assert_problem_code


def _run_in_test_session(
    operation: Callable[[AsyncSession], Awaitable[object]],
) -> object:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _run() -> object:
        async for session in override():
            return await operation(session)
        raise RuntimeError("test session was not yielded")

    return asyncio.run(_run())


def _seed_post_with_author() -> tuple[int, int]:
    async def _seed(session: AsyncSession) -> tuple[int, int]:
        author = models.Member(
            student_id="comment_post_author",
            email="comment_post_author@example.com",
            name="Post Author",
            cohort=2025,
            roles="member",
            status="active",
        )
        session.add(author)
        await session.flush()
        post = models.Post(
            author_id=author.id,
            title="Comment target",
            content="Body",
            category="notice",
            published_at=datetime.now(tz=UTC),
        )
        session.add(post)
        await session.commit()
        await session.refresh(post)
        assert author.id is not None
        assert post.id is not None
        return author.id, post.id

    result = _run_in_test_session(_seed)
    assert isinstance(result, tuple)
    return result


def _seed_member_auth(*, student_id: str, password: str) -> None:
    async def _seed(session: AsyncSession) -> None:
        member = models.Member(
            student_id=student_id,
            email=f"{student_id}@example.com",
            name=student_id,
            cohort=2025,
            roles="member",
            status="active",
        )
        session.add(member)
        await session.flush()
        session.add(
            models.MemberAuth(
                member_id=member.id,
                student_id=student_id,
                password_hash=bcrypt.hashpw(
                    password.encode(), bcrypt.gensalt()
                ).decode(),
            )
        )
        await session.commit()

    _run_in_test_session(_seed)


def _seed_comment(*, post_id: int, author_student_id: str, content: str) -> int:
    async def _seed(session: AsyncSession) -> int:
        author = (
            await session.execute(
                select(models.Member).where(
                    models.Member.student_id == author_student_id
                )
            )
        ).scalar_one()
        comment = models.Comment(
            post_id=post_id,
            author_id=author.id,
            content=content,
        )
        session.add(comment)
        await session.commit()
        await session.refresh(comment)
        assert comment.id is not None
        return comment.id

    comment_id = _run_in_test_session(_seed)
    assert isinstance(comment_id, int)
    return comment_id


def test_comment_list_create_and_delete_own(member_login: TestClient) -> None:
    _, post_id = _seed_post_with_author()

    empty = member_login.get(f"/comments/?post_id={post_id}")
    assert empty.status_code == HTTPStatus.OK
    assert empty.json() == []

    created = member_login.post(
        "/comments/",
        json={"post_id": post_id, "content": "첫 댓글"},
    )
    assert created.status_code == HTTPStatus.CREATED
    comment = created.json()
    assert comment["content"] == "첫 댓글"
    assert comment["author_id"] is not None

    listed = member_login.get(f"/comments/?post_id={post_id}")
    assert listed.status_code == HTTPStatus.OK
    items = listed.json()
    assert len(items) == 1
    assert items[0]["id"] == comment["id"]
    assert items[0]["author_name"] is not None

    deleted = member_login.delete(f"/comments/{comment['id']}")
    assert deleted.status_code == HTTPStatus.NO_CONTENT

    after_delete = member_login.get(f"/comments/?post_id={post_id}")
    assert after_delete.json() == []


def test_comment_delete_forbidden_for_other_member(member_login: TestClient) -> None:
    _, post_id = _seed_post_with_author()
    comment_id = _seed_comment(
        post_id=post_id,
        author_student_id="member001",
        content="owner only",
    )
    _seed_member_auth(student_id="comment_other", password="other-pass")

    transport = httpx.ASGITransport(app=app)

    async def _delete_as_other() -> httpx.Response:
        async with httpx.AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as hc:
            login = await hc.post(
                "/auth/member/login",
                json={"student_id": "comment_other", "password": "other-pass"},
            )
            assert login.status_code == HTTPStatus.OK
            return await hc.delete(f"/comments/{comment_id}")

    res = asyncio.run(_delete_as_other())
    assert res.status_code == HTTPStatus.FORBIDDEN
    assert_problem_code(res.json(), "forbidden")


def test_comment_delete_allowed_for_admin(
    admin_login: TestClient,
    member_login: TestClient,
) -> None:
    _, post_id = _seed_post_with_author()
    created = member_login.post(
        "/comments/",
        json={"post_id": post_id, "content": "admin can delete"},
    )
    assert created.status_code == HTTPStatus.CREATED
    comment_id = created.json()["id"]

    deleted = admin_login.delete(f"/comments/{comment_id}")
    assert deleted.status_code == HTTPStatus.NO_CONTENT


def test_comment_delete_not_found(member_login: TestClient) -> None:
    res = member_login.delete("/comments/999999")
    assert res.status_code == HTTPStatus.NOT_FOUND
    assert_problem_code(res.json(), "comment_not_found")
