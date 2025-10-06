from __future__ import annotations

from http import HTTPStatus

import bcrypt
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from apps.api import models
from apps.api.db import get_db


def _seed_admin(client: TestClient, email: str, password: str) -> None:
    # Access the same DB session used by the app via dependency override in conftest
    db: Session = next(iter(client.app.dependency_overrides[get_db]().__iter__()))  # type: ignore[arg-type]
    try:
        pwd = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        admin = models.AdminUser(email=email, password_hash=pwd)
        db.add(admin)
        db.commit()
    finally:
        db.close()


def test_login_success_and_protected_routes(client: TestClient) -> None:
    _seed_admin(client, "admin@example.com", "adminpass")

    # Protected route: create post should require login
    res_unauth = client.post(
        "/posts/",
        json={"author_id": 1, "title": "T", "content": "C", "published_at": None},
    )
    assert res_unauth.status_code in (HTTPStatus.UNAUTHORIZED, HTTPStatus.FORBIDDEN)

    # Login
    res_login = client.post(
        "/auth/login", json={"email": "admin@example.com", "password": "adminpass"}
    )
    assert res_login.status_code == HTTPStatus.OK

    # After login, protected route should pass (author_id 존재는 별도 테스트에서 검증)
    # 먼저 멤버 생성(보호됨)
    res_member = client.post(
        "/members/",
        json={"email": "m@example.com", "name": "M", "cohort": 2025},
    )
    assert res_member.status_code == HTTPStatus.CREATED

    res_post = client.post(
        "/posts/",
        json={
            "author_id": res_member.json()["id"],
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
    res = client.post(
        "/auth/login", json={"email": "none@example.com", "password": "x"}
    )
    assert res.status_code == HTTPStatus.UNAUTHORIZED
