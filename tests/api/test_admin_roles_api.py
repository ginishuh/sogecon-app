from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from http import HTTPStatus

import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.db import get_db
from apps.api.errors import ApiError
from apps.api.main import app
from apps.api.services import admin_roles_service


def _run_in_test_session(coro: Callable[[AsyncSession], Awaitable[None]]) -> None:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _run() -> None:
        async for session in override():
            await coro(session)
            return
        raise RuntimeError("test session was not yielded")

    asyncio.run(_run())


def _seed_admin_identity(
    *,
    student_id: str,
    password: str,
    roles: str,
) -> None:
    async def _seed(session: AsyncSession) -> None:
        admin_stmt = select(models.AdminUser).where(
            models.AdminUser.student_id == student_id
        )
        admin_user = (await session.execute(admin_stmt)).scalars().first()
        pwd_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        if admin_user is None:
            session.add(
                models.AdminUser(
                    student_id=student_id,
                    email=f"{student_id}@example.com",
                    password_hash=pwd_hash,
                )
            )

        member_stmt = select(models.Member).where(
            models.Member.student_id == student_id
        )
        member = (await session.execute(member_stmt)).scalars().first()
        if member is None:
            session.add(
                models.Member(
                    student_id=student_id,
                    email=f"{student_id}@example.com",
                    name=student_id,
                    cohort=1,
                    roles=roles,
                    status="active",
                )
            )
        else:
            setattr(member, "roles", roles)

        await session.commit()

    _run_in_test_session(_seed)


def _login_admin(client: TestClient, *, student_id: str, password: str) -> None:
    res = client.post(
        "/auth/login",
        json={"student_id": student_id, "password": password},
    )
    assert res.status_code == HTTPStatus.OK


def test_super_admin_can_list_and_patch_admin_roles(
    admin_login: TestClient,
) -> None:
    _seed_admin_identity(
        student_id="ops001",
        password="ops-pass",
        roles="admin,member",
    )

    list_res = admin_login.get("/admin/admin-users/")
    assert list_res.status_code == HTTPStatus.OK
    assert list_res.json()["total"] >= 1

    patch_res = admin_login.patch(
        "/admin/admin-users/ops001/roles",
        json={"roles": ["admin", "admin_events", "unknown_token"]},
    )
    assert patch_res.status_code == HTTPStatus.OK
    updated = patch_res.json()["updated"]
    assert updated["student_id"] == "ops001"
    assert updated["roles"] == ["member", "admin", "admin_events"]
    assert updated["grade"] == "admin"
    assert updated["permissions"] == ["admin_events"]
    assert patch_res.json()["decided_by_student_id"] == "__seed__admin"

    admin_login.post("/auth/logout")
    _login_admin(admin_login, student_id="ops001", password="ops-pass")

    events_res = admin_login.get("/admin/events/")
    assert events_res.status_code == HTTPStatus.OK

    posts_res = admin_login.get("/admin/posts/")
    assert posts_res.status_code == HTTPStatus.FORBIDDEN


def test_super_admin_can_create_admin_user(admin_login: TestClient) -> None:
    create_res = admin_login.post(
        "/admin/admin-users/",
        json={
            "student_id": "newadmin001",
            "email": "newadmin001@example.com",
            "name": "신규 관리자",
            "cohort": 50,
            "temporary_password": "temp-pass-001",
            "roles": ["admin", "admin_posts"],
        },
    )
    assert create_res.status_code == HTTPStatus.CREATED
    body = create_res.json()
    assert body["created_by_student_id"] == "__seed__admin"
    assert body["created"]["student_id"] == "newadmin001"
    assert body["created"]["roles"] == ["member", "admin", "admin_posts"]

    admin_login.post("/auth/logout")
    _login_admin(admin_login, student_id="newadmin001", password="temp-pass-001")

    posts_res = admin_login.get("/admin/posts/")
    assert posts_res.status_code == HTTPStatus.OK

    events_res = admin_login.get("/admin/events/")
    assert events_res.status_code == HTTPStatus.FORBIDDEN


def test_admin_without_super_admin_cannot_create_admin_user(client: TestClient) -> None:
    _seed_admin_identity(
        student_id="manager002",
        password="manager-pass",
        roles="admin,member,admin_roles",
    )
    _login_admin(client, student_id="manager002", password="manager-pass")

    create_res = client.post(
        "/admin/admin-users/",
        json={
            "student_id": "blocked001",
            "email": "blocked001@example.com",
            "name": "권한 없음",
            "cohort": 50,
            "temporary_password": "temp-pass-002",
            "roles": ["admin", "admin_posts"],
        },
    )
    assert create_res.status_code == HTTPStatus.FORBIDDEN
    assert create_res.json()["detail"] == "super_admin_required"


def test_create_admin_user_returns_conflict_when_already_exists(
    admin_login: TestClient,
) -> None:
    payload = {
        "student_id": "dupadmin001",
        "email": "dupadmin001@example.com",
        "name": "중복 관리자",
        "cohort": 60,
        "temporary_password": "temp-pass-003",
        "roles": ["admin"],
    }
    first_res = admin_login.post("/admin/admin-users/", json=payload)
    assert first_res.status_code == HTTPStatus.CREATED

    second_res = admin_login.post("/admin/admin-users/", json=payload)
    assert second_res.status_code == HTTPStatus.CONFLICT
    assert second_res.json()["code"] == "admin_user_already_exists"


def test_admin_without_super_admin_cannot_patch_roles(client: TestClient) -> None:
    _seed_admin_identity(
        student_id="manager001",
        password="manager-pass",
        roles="admin,member,admin_roles",
    )
    _seed_admin_identity(
        student_id="target001",
        password="target-pass",
        roles="admin,member",
    )
    _login_admin(client, student_id="manager001", password="manager-pass")

    list_res = client.get("/admin/admin-users/")
    assert list_res.status_code == HTTPStatus.OK

    patch_res = client.patch(
        "/admin/admin-users/target001/roles",
        json={"roles": ["admin", "admin_posts"]},
    )
    assert patch_res.status_code == HTTPStatus.FORBIDDEN
    assert patch_res.json()["detail"] == "super_admin_required"


def test_super_admin_cannot_self_demote(admin_login: TestClient) -> None:
    patch_res = admin_login.patch(
        "/admin/admin-users/__seed__admin/roles",
        json={"roles": ["admin", "admin_roles"]},
    )
    assert patch_res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    body = patch_res.json()
    assert body["code"] == "self_demotion_forbidden"


def test_service_blocks_removing_last_super_admin(client: TestClient) -> None:
    _seed_admin_identity(
        student_id="solo001",
        password="solo-pass",
        roles="super_admin,admin,member",
    )
    _seed_admin_identity(
        student_id="actor001",
        password="actor-pass",
        roles="admin,member,admin_roles",
    )

    async def _run(session: AsyncSession) -> None:
        with pytest.raises(ApiError) as exc:
            await admin_roles_service.update_admin_user_roles(
                session,
                target_student_id="solo001",
                actor_student_id="actor001",
                roles=["admin", "admin_roles"],
            )
        assert exc.value.code == "last_super_admin_forbidden"

    _run_in_test_session(_run)
