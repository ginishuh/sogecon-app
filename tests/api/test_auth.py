from __future__ import annotations

import asyncio
from http import HTTPStatus

import bcrypt
from fastapi.testclient import TestClient

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app


def _seed_admin(client: TestClient, student_id: str, password: str) -> None:
    """관리자 계정 시드 (Member + MemberAuth 기반)."""
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _do_seed() -> None:
        async for db in override():
            pwd = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            member = models.Member(
                student_id=student_id,
                email=f"{student_id}@test.example.com",
                name="Admin",
                cohort=1,
                roles="admin,member",
                status="active",
            )
            db.add(member)
            await db.flush()
            db.add(
                models.MemberAuth(
                    member_id=member.id,
                    student_id=student_id,
                    password_hash=pwd,
                )
            )
            await db.commit()
            break

    asyncio.run(_do_seed())


def test_login_success_and_protected_routes(client: TestClient) -> None:
    _seed_admin(client, "admin001", "adminpass")

    # Protected route: create post should require login
    res_unauth = client.post(
        "/posts/",
        json={"author_id": 1, "title": "T", "content": "C", "published_at": None},
    )
    assert res_unauth.status_code in (HTTPStatus.UNAUTHORIZED, HTTPStatus.FORBIDDEN)

    # Login
    res_login = client.post(
        "/auth/login", json={"student_id": "admin001", "password": "adminpass"}
    )
    assert res_login.status_code == HTTPStatus.OK

    # After login, protected route should pass.
    # 시드된 관리자 member_id는 최초 생성 기준 1이다.

    res_post = client.post(
        "/posts/",
        json={
            "author_id": 1,
            "title": "Hello",
            "content": "World",
            "published_at": None,
        },
    )
    assert res_post.status_code == HTTPStatus.CREATED

    # Logout and verify protection again
    res_logout = client.post("/auth/logout")
    assert res_logout.status_code == HTTPStatus.NO_CONTENT
    res_again = client.post(
        "/events/",
        json={
            "title": "AuthEvt",
            "starts_at": "2030-01-01T09:00:00Z",
            "ends_at": "2030-01-01T10:00:00Z",
            "location": "Seoul",
            "capacity": 10,
        },
    )
    assert res_again.status_code in (HTTPStatus.UNAUTHORIZED, HTTPStatus.FORBIDDEN)


def test_login_failure(client: TestClient) -> None:
    res = client.post("/auth/login", json={"student_id": "none001", "password": "x"})
    assert res.status_code == HTTPStatus.UNAUTHORIZED
