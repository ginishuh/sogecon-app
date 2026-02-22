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
from apps.api.services import members_service


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


def _seed_member_identity(
    *,
    student_id: str,
    password: str,
    roles: str,
) -> None:
    async def _seed(session: AsyncSession) -> None:
        member_stmt = select(models.Member).where(
            models.Member.student_id == student_id
        )
        member = (await session.execute(member_stmt)).scalars().first()
        if member is None:
            member = models.Member(
                student_id=student_id,
                email=f"{student_id}@example.com",
                name=student_id,
                cohort=1,
                roles=roles,
                status="active",
            )
            session.add(member)
            await session.flush()
        else:
            setattr(member, "roles", roles)
            setattr(member, "status", "active")

        pwd_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        auth_stmt = select(models.MemberAuth).where(
            models.MemberAuth.student_id == student_id
        )
        auth_row = (await session.execute(auth_stmt)).scalars().first()
        if auth_row is None:
            session.add(
                models.MemberAuth(
                    member_id=member.id,
                    student_id=student_id,
                    password_hash=pwd_hash,
                )
            )
        else:
            setattr(auth_row, "member_id", member.id)
            setattr(auth_row, "password_hash", pwd_hash)

        await session.commit()

    _run_in_test_session(_seed)


def _member_id_by_student_id(student_id: str) -> int:
    holder: dict[str, int] = {"member_id": 0}

    async def _find(session: AsyncSession) -> None:
        stmt = select(models.Member.id).where(models.Member.student_id == student_id)
        member_id = (await session.execute(stmt)).scalar_one()
        holder["member_id"] = int(member_id)

    _run_in_test_session(_find)
    return holder["member_id"]


def _login(client: TestClient, *, student_id: str, password: str) -> None:
    res = client.post(
        "/auth/login",
        json={"student_id": student_id, "password": password},
    )
    assert res.status_code == HTTPStatus.OK


def test_super_admin_can_patch_member_roles(admin_login: TestClient) -> None:
    _seed_member_identity(
        student_id="ops001",
        password="ops-pass",
        roles="admin,member",
    )
    member_id = _member_id_by_student_id("ops001")

    patch_res = admin_login.patch(
        f"/admin/members/{member_id}/roles",
        json={"roles": ["admin", "admin_events", "unknown_token"]},
    )
    assert patch_res.status_code == HTTPStatus.OK
    body = patch_res.json()
    assert body["student_id"] == "ops001"
    assert body["roles"] == ["member", "admin", "admin_events"]

    admin_login.post("/auth/logout")
    _login(admin_login, student_id="ops001", password="ops-pass")

    events_res = admin_login.get("/admin/events/")
    assert events_res.status_code == HTTPStatus.OK

    posts_res = admin_login.get("/admin/posts/")
    assert posts_res.status_code == HTTPStatus.FORBIDDEN


def test_super_admin_can_create_member_direct(admin_login: TestClient) -> None:
    create_res = admin_login.post(
        "/admin/members/",
        json={
            "student_id": "newadmin001",
            "email": "newadmin001@example.com",
            "name": "신규 관리자",
            "cohort": 50,
            "roles": ["admin", "admin_posts"],
        },
    )
    assert create_res.status_code == HTTPStatus.CREATED
    body = create_res.json()
    assert body["member"]["student_id"] == "newadmin001"
    assert body["member"]["roles"] == "member,admin,admin_posts"
    activation_token = body["activation_token"]
    assert isinstance(activation_token, str) and activation_token

    activate_res = admin_login.post(
        "/auth/member/activate",
        json={"token": activation_token, "password": "temp-pass-001"},
    )
    assert activate_res.status_code == HTTPStatus.OK

    admin_login.post("/auth/logout")
    _login(admin_login, student_id="newadmin001", password="temp-pass-001")

    posts_res = admin_login.get("/admin/posts/")
    assert posts_res.status_code == HTTPStatus.OK

    events_res = admin_login.get("/admin/events/")
    assert events_res.status_code == HTTPStatus.FORBIDDEN


def test_admin_without_super_admin_cannot_create_member_direct(
    client: TestClient,
) -> None:
    _seed_member_identity(
        student_id="manager002",
        password="manager-pass",
        roles="admin,member,admin_roles",
    )
    _login(client, student_id="manager002", password="manager-pass")

    create_res = client.post(
        "/admin/members/",
        json={
            "student_id": "blocked001",
            "email": "blocked001@example.com",
            "name": "권한 없음",
            "cohort": 50,
            "roles": ["admin", "admin_posts"],
        },
    )
    assert create_res.status_code == HTTPStatus.FORBIDDEN
    assert create_res.json()["detail"] == "super_admin_required"


def test_create_member_direct_returns_conflict_when_already_exists(
    admin_login: TestClient,
) -> None:
    payload = {
        "student_id": "dupadmin001",
        "email": "dupadmin001@example.com",
        "name": "중복 관리자",
        "cohort": 60,
        "roles": ["admin"],
    }
    first_res = admin_login.post("/admin/members/", json=payload)
    assert first_res.status_code == HTTPStatus.CREATED

    second_res = admin_login.post("/admin/members/", json=payload)
    assert second_res.status_code == HTTPStatus.CONFLICT
    assert second_res.json()["code"] == "member_exists"


def test_admin_without_super_admin_cannot_patch_roles(client: TestClient) -> None:
    _seed_member_identity(
        student_id="manager001",
        password="manager-pass",
        roles="admin,member,admin_roles",
    )
    _seed_member_identity(
        student_id="target001",
        password="target-pass",
        roles="admin,member",
    )
    _login(client, student_id="manager001", password="manager-pass")
    target_member_id = _member_id_by_student_id("target001")

    patch_res = client.patch(
        f"/admin/members/{target_member_id}/roles",
        json={"roles": ["admin", "admin_posts"]},
    )
    assert patch_res.status_code == HTTPStatus.FORBIDDEN
    assert patch_res.json()["detail"] == "super_admin_required"


def test_super_admin_cannot_self_demote(admin_login: TestClient) -> None:
    admin_member_id = _member_id_by_student_id("__seed__admin")
    patch_res = admin_login.patch(
        f"/admin/members/{admin_member_id}/roles",
        json={"roles": ["admin", "admin_roles"]},
    )
    assert patch_res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    body = patch_res.json()
    assert body["code"] == "self_demotion_forbidden"


def test_service_blocks_removing_last_super_admin(client: TestClient) -> None:
    _seed_member_identity(
        student_id="solo001",
        password="solo-pass",
        roles="super_admin,admin,member",
    )
    _seed_member_identity(
        student_id="actor001",
        password="actor-pass",
        roles="admin,member,admin_roles",
    )
    solo_member_id = _member_id_by_student_id("solo001")

    async def _run(session: AsyncSession) -> None:
        with pytest.raises(ApiError) as exc:
            await members_service.update_member_roles(
                session,
                member_id=solo_member_id,
                actor_student_id="actor001",
                roles=["admin", "admin_roles"],
            )
        assert exc.value.code == "last_super_admin_forbidden"

    _run_in_test_session(_run)
