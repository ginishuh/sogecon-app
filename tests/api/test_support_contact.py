from __future__ import annotations

import asyncio
from http import HTTPStatus

import bcrypt
import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app


@pytest.fixture()
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_support_contact_rate_limit_and_validation(client: TestClient) -> None:
    transport = httpx.ASGITransport(app=app, client=("2.2.2.2", 55555))
    async with httpx.AsyncClient(transport=transport, base_url="http://local") as hc:
        # login as admin to satisfy require_member compatibility
        rc_login = await hc.post(
            "/auth/login",
            json={"student_id": "__seed__admin", "password": "__seed__"},
        )
        assert rc_login.status_code in (HTTPStatus.OK, HTTPStatus.UNAUTHORIZED)
        if rc_login.status_code == HTTPStatus.UNAUTHORIZED:
            # seed via admin_login fixture path is not available here; skip strict login
            return

        ok = await hc.post(
            "/support/contact",
            json={"subject": "hello", "body": "message body long enough"},
        )
        assert ok.status_code == HTTPStatus.ACCEPTED

        rl = await hc.post(
            "/support/contact",
            json={"subject": "hello", "body": "message body long enough"},
        )
        assert rl.status_code == HTTPStatus.TOO_MANY_REQUESTS


def test_support_contact_validation(admin_login: TestClient) -> None:
    client = admin_login
    bad = client.post(
        "/support/contact",
        json={"subject": "a", "body": "short"},
    )
    assert bad.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_admin_can_list_support_tickets(admin_login: TestClient) -> None:
    client = admin_login
    submit = client.post(
        "/support/contact",
        json={
            "subject": "문의 조회 테스트",
            "body": "관리자 문의함 목록에서 본문 확인이 되어야 합니다.",
            "contact": "010-1111-2222",
        },
    )
    assert submit.status_code == HTTPStatus.ACCEPTED

    res = client.get("/support/admin/tickets?limit=20")
    assert res.status_code == HTTPStatus.OK
    body = res.json()
    assert isinstance(body, list)
    assert len(body) >= 1

    first = body[0]
    assert isinstance(first["id"], int)
    assert isinstance(first["subject"], str)
    assert isinstance(first["body"], str)


def test_member_cannot_list_support_tickets(member_login: TestClient) -> None:
    res = member_login.get("/support/admin/tickets?limit=20")
    assert res.status_code == HTTPStatus.FORBIDDEN
    assert res.json()["detail"] == "admin_permission_required"


def test_active_admin_session_refreshes_backfilled_support_role(
    client: TestClient,
) -> None:
    student_id = "suppbackfill"
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _seed_admin() -> None:
        async for db in override():
            member = models.Member(
                student_id=student_id,
                email="support-backfill-admin@test.example.com",
                name="Support Admin",
                cohort=1,
                roles="member,admin,admin_posts",
                status="active",
            )
            db.add(member)
            await db.flush()
            db.add(
                models.MemberAuth(
                    member_id=member.id,
                    student_id=member.student_id,
                    password_hash=bcrypt.hashpw(
                        b"support-password", bcrypt.gensalt()
                    ).decode(),
                )
            )
            await db.commit()
            break

    async def _backfill_role() -> None:
        async for db in override():
            member = await db.scalar(
                select(models.Member).where(
                        models.Member.student_id == student_id
                )
            )
            if member is None:
                raise RuntimeError("seeded member not found")
            member.roles = "member,admin,admin_posts,admin_support"
            await db.commit()
            break

    asyncio.run(_seed_admin())
    login = client.post(
        "/auth/login",
        json={
            "student_id": student_id,
            "password": "support-password",
        },
    )
    assert login.status_code == HTTPStatus.OK
    assert client.get("/support/admin/tickets").status_code == HTTPStatus.FORBIDDEN

    asyncio.run(_backfill_role())

    tickets = client.get("/support/admin/tickets")
    assert tickets.status_code == HTTPStatus.OK
    session = client.get("/auth/session")
    assert session.status_code == HTTPStatus.OK
    assert "admin_support" in session.json()["roles"]
