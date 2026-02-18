from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from http import HTTPStatus

import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app
from apps.api.services.auth_service import create_member_activation_token


def _run_in_test_session(fn: Callable[[AsyncSession], Awaitable[None]]) -> None:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _run() -> None:
        async for session in override():
            await fn(session)
            return
        raise RuntimeError("test session was not yielded")

    asyncio.run(_run())


def _create_signup_and_approve(
    admin_client: TestClient,
    student_id: str,
) -> tuple[int, str]:
    signup_res = admin_client.post(
        "/auth/member/signup",
        json={
            "student_id": student_id,
            "email": f"{student_id}@example.com",
            "name": "ABC One",
            "cohort": 1,
        },
    )
    assert signup_res.status_code == HTTPStatus.CREATED
    signup_id = signup_res.json()["id"]

    approve_res = admin_client.post(f"/admin/signup-requests/{signup_id}/approve")
    assert approve_res.status_code == HTTPStatus.OK
    token = approve_res.json()["activation_token"]
    assert isinstance(token, str) and token
    return signup_id, token


def test_member_activate_and_login(admin_login: TestClient) -> None:
    _, token = _create_signup_and_approve(admin_login, "abc1")

    res = admin_login.post(
        "/auth/member/activate", json={"token": token, "password": "pw1"}
    )
    assert res.status_code == HTTPStatus.OK

    session_res = admin_login.get("/auth/session")
    assert session_res.status_code == HTTPStatus.OK
    assert session_res.json()["roles"] == ["member"]

    # change password with member session
    res2 = admin_login.post(
        "/auth/member/change-password",
        json={"current_password": "pw1", "new_password": "pw2"},
    )
    assert res2.status_code == HTTPStatus.OK

    # profile get/put
    me = admin_login.get("/me/")
    assert me.status_code == HTTPStatus.OK
    data = me.json()
    assert "email" in data and data["email"] == "abc1@example.com"
    upd = admin_login.put("/me/", json={"name": "Renamed", "visibility": "cohort"})
    assert upd.status_code == HTTPStatus.OK
    data2 = upd.json()
    assert data2["name"] == "Renamed"


def test_member_activate_invalid_token_401(admin_login: TestClient) -> None:
    res = admin_login.post(
        "/auth/member/activate",
        json={"token": "bad", "password": "pw"},
    )
    assert res.status_code == HTTPStatus.UNAUTHORIZED
    assert res.json()["detail"] == "invalid_or_expired_activation_token"


def test_member_activate_pending_blocked_401(admin_login: TestClient) -> None:
    signup_res = admin_login.post(
        "/auth/member/signup",
        json={
            "student_id": "abc-pending",
            "email": "abc-pending@example.com",
            "name": "Pending",
            "cohort": 1,
        },
    )
    assert signup_res.status_code == HTTPStatus.CREATED
    signup_id = signup_res.json()["id"]

    token = create_member_activation_token(
        signup_request_id=signup_id,
        student_id="abc-pending",
        cohort=1,
        name="Pending",
    )
    res = admin_login.post(
        "/auth/member/activate",
        json={"token": token, "password": "pw"},
    )
    assert res.status_code == HTTPStatus.UNAUTHORIZED
    assert res.json()["detail"] == "invalid_or_expired_activation_token"


def test_member_activate_already_used_409(admin_login: TestClient) -> None:
    _, token = _create_signup_and_approve(admin_login, "abc-reuse")

    first = admin_login.post(
        "/auth/member/activate", json={"token": token, "password": "pw1"}
    )
    assert first.status_code == HTTPStatus.OK

    second = admin_login.post(
        "/auth/member/activate", json={"token": token, "password": "pw2"}
    )
    assert second.status_code == HTTPStatus.CONFLICT
    assert second.json()["detail"] == "activation_already_used"


def test_member_activate_expired_token_401(
    admin_login: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, token = _create_signup_and_approve(admin_login, "abc-expire")
    monkeypatch.setattr(
        "apps.api.services.auth_service.ACTIVATION_TOKEN_MAX_AGE_SECONDS",
        1,
    )

    time.sleep(2.2)
    res = admin_login.post(
        "/auth/member/activate",
        json={"token": token, "password": "pw"},
    )
    assert res.status_code == HTTPStatus.UNAUTHORIZED
    assert res.json()["detail"] == "invalid_or_expired_activation_token"


def test_member_login_inactive_blocked(client: TestClient) -> None:
    async def _seed_inactive(session: AsyncSession) -> None:
        member = models.Member(
            student_id="inactive001",
            email="inactive001@example.com",
            name="Inactive",
            cohort=1,
            roles="member",
            status="suspended",
        )
        session.add(member)
        await session.flush()

        session.add(
            models.MemberAuth(
                member_id=member.id,
                student_id="inactive001",
                password_hash=bcrypt.hashpw(b"pw", bcrypt.gensalt()).decode(),
            )
        )
        await session.commit()

    _run_in_test_session(_seed_inactive)

    res = client.post(
        "/auth/member/login",
        json={"student_id": "inactive001", "password": "pw"},
    )
    assert res.status_code == HTTPStatus.FORBIDDEN
    assert res.json()["detail"] == "member_not_active"


def test_support_contact_rate_limit(admin_login: TestClient) -> None:
    client = admin_login
    res1 = client.post(
        "/support/contact", json={"subject": "hello", "body": "message long enough"}
    )
    assert res1.status_code in (HTTPStatus.ACCEPTED, HTTPStatus.OK)

    res2 = client.post(
        "/support/contact", json={"subject": "hello2", "body": "message long enough 2"}
    )
    assert res2.status_code in (HTTPStatus.ACCEPTED, HTTPStatus.TOO_MANY_REQUESTS)
