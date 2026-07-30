from __future__ import annotations

import asyncio
from http import HTTPStatus

import bcrypt
from fastapi.testclient import TestClient
from sqlalchemy import select

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app


def _create_member(
    client: TestClient,
    *,
    student_id: str,
    email: str,
    name: str,
    cohort: int,
) -> dict[str, object]:
    res = client.post(
        "/admin/members/",
        json={
            "student_id": student_id,
            "email": email,
            "name": name,
            "cohort": cohort,
            "roles": ["member"],
        },
    )
    assert res.status_code == HTTPStatus.CREATED
    return res.json()["member"]


def test_create_post_and_get(admin_login: TestClient) -> None:
    client = admin_login
    m = _create_member(
        client,
        student_id="author001",
        email="author@example.com",
        name="Author",
        cohort=2025,
    )
    p = client.post(
        "/posts/",
        json={
            "author_id": m["id"],
            "title": "Hello",
            "content": "World",
            "published_at": None,
        },
    ).json()
    res = client.get(f"/posts/{p['id']}")
    assert res.status_code == HTTPStatus.OK
    data = res.json()
    assert data["id"] == p["id"]
    assert data["title"] == "Hello"


def test_create_event_and_get(admin_login: TestClient) -> None:
    client = admin_login
    e = client.post(
        "/events/",
        json={
            "title": "Small",
            "starts_at": "2030-01-01T09:00:00Z",
            "ends_at": "2030-01-01T10:00:00Z",
            "location": "Seoul",
            "capacity": 1,
        },
    ).json()
    res = client.get(f"/events/{e['id']}")
    assert res.status_code == HTTPStatus.OK
    assert res.json()["title"] == "Small"


def test_rsvp_capacity_v1_enforces_waitlist(admin_login: TestClient) -> None:
    client = admin_login
    # capacity 1인 이벤트에 2명이 going을 시도하면 2번째는 waitlist
    e = client.post(
        "/events/",
        json={
            "title": "Cap1",
            "starts_at": "2030-04-01T09:00:00Z",
            "ends_at": "2030-04-01T10:00:00Z",
            "location": "Seoul",
            "capacity": 1,
        },
    ).json()
    m1 = _create_member(
        client,
        student_id="m1001",
        email="a@example.com",
        name="A",
        cohort=2025,
    )
    m2 = _create_member(
        client,
        student_id="m1002",
        email="b@example.com",
        name="B",
        cohort=2025,
    )

    r1 = client.post(
        f"/admin/events/{e['id']}/rsvps/{m1['id']}", json={"status": "going"}
    )
    assert r1.status_code == HTTPStatus.CREATED
    assert r1.json()["status"] == "going"

    r2 = client.post(
        f"/admin/events/{e['id']}/rsvps/{m2['id']}", json={"status": "going"}
    )
    assert r2.status_code == HTTPStatus.CREATED
    assert r2.json()["status"] == "waitlist"


def test_rsvp_create_path_enforces_waitlist_capacity(admin_login: TestClient) -> None:
    client = admin_login
    e = client.post(
        "/events/",
        json={
            "title": "Cap1-CreatePath",
            "starts_at": "2030-04-02T09:00:00Z",
            "ends_at": "2030-04-02T10:00:00Z",
            "location": "Seoul",
            "capacity": 1,
        },
    ).json()
    first = client.post("/rsvps/", json={"event_id": e["id"], "status": "going"})
    assert first.status_code == HTTPStatus.CREATED
    assert first.json()["status"] == "going"

    m2 = _create_member(
        client,
        student_id="m1003",
        email="c@example.com",
        name="C",
        cohort=2025,
    )
    override = app.dependency_overrides.get(get_db)
    assert override is not None

    async def _activate_second() -> None:
        async for session in override():
            member = (
                await session.execute(
                    select(models.Member).where(models.Member.student_id == "m1003")
                )
            ).scalar_one()
            setattr(member, "status", "active")
            session.add(
                models.MemberAuth(
                    member_id=member.id,
                    student_id="m1003",
                    password_hash=bcrypt.hashpw(
                        b"pass-1003", bcrypt.gensalt()
                    ).decode(),
                )
            )
            await session.commit()
            return
        raise RuntimeError("test session was not yielded")

    asyncio.run(_activate_second())
    client.post("/auth/logout")
    login = client.post(
        "/auth/login", json={"student_id": "m1003", "password": "pass-1003"}
    )
    assert login.status_code == HTTPStatus.OK
    second = client.post("/rsvps/", json={"event_id": e["id"], "status": "going"})
    assert second.status_code == HTTPStatus.CREATED
    assert second.json()["status"] == "waitlist"
    assert second.json()["member_id"] == m2["id"]


def test_rsvp_going_reassertion_keeps_status(admin_login: TestClient) -> None:
    client = admin_login
    # capacity 1: 첫 참석자가 going을 재요청해도 waitlist로 강등되지 않아야 한다
    e = client.post(
        "/events/",
        json={
            "title": "Cap1-Reassert",
            "starts_at": "2030-06-01T09:00:00Z",
            "ends_at": "2030-06-01T10:00:00Z",
            "location": "Seoul",
            "capacity": 1,
        },
    ).json()
    m1 = _create_member(
        client,
        student_id="ra001",
        email="ra@example.com",
        name="ReAssert",
        cohort=2025,
    )

    r1 = client.post(
        f"/admin/events/{e['id']}/rsvps/{m1['id']}", json={"status": "going"}
    )
    assert r1.status_code == HTTPStatus.CREATED
    assert r1.json()["status"] == "going"

    # 동일 회원이 다시 going 요청
    r_again = client.post(
        f"/admin/events/{e['id']}/rsvps/{m1['id']}", json={"status": "going"}
    )
    assert r_again.status_code == HTTPStatus.CREATED
    assert r_again.json()["status"] == "going"


def test_list_endpoints_ok(member_login: TestClient) -> None:
    # members는 인증 필요, posts/events는 공개
    assert member_login.get("/members/?limit=5").status_code == HTTPStatus.OK
    assert member_login.get("/posts/?limit=5").status_code == HTTPStatus.OK
    assert member_login.get("/events/?limit=5").status_code == HTTPStatus.OK


def test_rsvp_create_success(admin_login: TestClient) -> None:
    client = admin_login
    e = client.post(
        "/events/",
        json={
            "title": "RSVP",
            "starts_at": "2030-05-01T09:00:00Z",
            "ends_at": "2030-05-01T10:00:00Z",
            "location": "Seoul",
            "capacity": 10,
        },
    ).json()
    res = client.post(
        "/rsvps/",
        json={"event_id": e["id"], "status": "going"},
    )
    assert res.status_code == HTTPStatus.CREATED


def test_rsvp_waitlist_promoted_on_cancel(admin_login: TestClient) -> None:
    client = admin_login
    # capacity 1: m1 going, m2 waitlist → m1 cancel 시 m2 going 승급
    m1 = _create_member(
        client,
        student_id="p1001",
        email="p1@example.com",
        name="P1",
        cohort=2025,
    )
    m2 = _create_member(
        client,
        student_id="p1002",
        email="p2@example.com",
        name="P2",
        cohort=2025,
    )
    e = client.post(
        "/events/",
        json={
            "title": "Cap1-Promo",
            "starts_at": "2030-07-01T09:00:00Z",
            "ends_at": "2030-07-01T10:00:00Z",
            "location": "Seoul",
            "capacity": 1,
        },
    ).json()

    r1 = client.post(
        f"/admin/events/{e['id']}/rsvps/{m1['id']}", json={"status": "going"}
    )
    assert r1.status_code == HTTPStatus.CREATED
    r2 = client.post(
        f"/admin/events/{e['id']}/rsvps/{m2['id']}", json={"status": "going"}
    )
    assert r2.status_code == HTTPStatus.CREATED and r2.json()["status"] == "waitlist"

    # m1 cancel → m2 going 승급
    rc = client.post(
        f"/admin/events/{e['id']}/rsvps/{m1['id']}", json={"status": "cancel"}
    )
    assert rc.status_code == HTTPStatus.CREATED
    promoted = client.get(f"/admin/events/{e['id']}/rsvps/{m2['id']}")
    assert promoted.status_code == HTTPStatus.OK
    assert promoted.json()["status"] == "going"
