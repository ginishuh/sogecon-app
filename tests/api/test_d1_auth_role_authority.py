from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from http import HTTPStatus

import bcrypt
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.db import get_db
from apps.api.errors import ApiError
from apps.api.main import app
from apps.api.repositories import members as members_repo
from apps.api.services import members_service


def _run_in_test_session(
    operation: Callable[[AsyncSession], Awaitable[None]],
) -> None:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _run() -> None:
        async for session in override():
            await operation(session)
            return
        raise RuntimeError("test session was not yielded")

    asyncio.run(_run())


def _seed_member(
    *,
    student_id: str,
    password: str = "test-pass",
    roles: str = "member",
    status: str = "active",
) -> int:
    holder = {"member_id": 0}

    async def _seed(session: AsyncSession) -> None:
        member = models.Member(
            student_id=student_id,
            email=f"{student_id}@example.com",
            name=student_id,
            cohort=1,
            roles=roles,
            status=status,
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
        holder["member_id"] = int(member.id)

    _run_in_test_session(_seed)
    return holder["member_id"]


def _seed_event(*, title: str) -> int:
    holder = {"event_id": 0}

    async def _seed(session: AsyncSession) -> None:
        starts_at = datetime.now(tz=UTC) + timedelta(days=30)
        event = models.Event(
            title=title,
            starts_at=starts_at,
            ends_at=starts_at + timedelta(hours=2),
            location="Seoul",
            capacity=10,
        )
        session.add(event)
        await session.commit()
        holder["event_id"] = int(event.id)

    _run_in_test_session(_seed)
    return holder["event_id"]


def _login(client: TestClient, *, student_id: str, password: str = "test-pass") -> None:
    response = client.post(
        "/auth/login",
        json={"student_id": student_id, "password": password},
    )
    assert response.status_code == HTTPStatus.OK


def _update_member(
    student_id: str,
    *,
    roles: str | None = None,
    status: str | None = None,
) -> None:
    async def _update(session: AsyncSession) -> None:
        result = await session.execute(
            select(models.Member).where(models.Member.student_id == student_id)
        )
        member = result.scalar_one()
        if roles is not None:
            setattr(member, "roles", roles)
        if status is not None:
            setattr(member, "status", status)
        await session.commit()

    _run_in_test_session(_update)


def test_rsvp_routes_require_authentication(client: TestClient) -> None:
    requests = (
        client.get("/rsvps/"),
        client.get("/rsvps/1/1"),
        client.post(
            "/rsvps/",
            json={"member_id": 1, "event_id": 1, "status": "going"},
        ),
        client.post(
            "/events/1/rsvp",
            json={"member_id": 1, "status": "going"},
        ),
    )

    assert [response.status_code for response in requests] == [
        HTTPStatus.UNAUTHORIZED,
        HTTPStatus.UNAUTHORIZED,
        HTTPStatus.UNAUTHORIZED,
        HTTPStatus.UNAUTHORIZED,
    ]


def test_rsvp_member_id_is_server_owned(client: TestClient) -> None:
    actor_id = _seed_member(student_id="rsvp-actor")
    victim_id = _seed_member(student_id="rsvp-victim")
    event_id = _seed_event(title="RSVP actor authority")
    direct_event_id = _seed_event(title="Direct RSVP actor authority")
    victim_event_id = _seed_event(title="Victim RSVP isolation")
    _login(client, student_id="rsvp-actor")

    event_response = client.post(
        f"/events/{event_id}/rsvp",
        json={"member_id": victim_id, "status": "going"},
    )
    assert event_response.status_code == HTTPStatus.CREATED
    assert event_response.json()["member_id"] == actor_id

    forbidden = client.get(f"/rsvps/{victim_id}/{event_id}")
    assert forbidden.status_code == HTTPStatus.FORBIDDEN

    own = client.get(f"/rsvps/{actor_id}/{event_id}")
    assert own.status_code == HTTPStatus.OK

    direct_response = client.post(
        "/rsvps/",
        json={
            "member_id": victim_id,
            "event_id": direct_event_id,
            "status": "going",
        },
    )
    assert direct_response.status_code == HTTPStatus.CREATED
    assert direct_response.json()["member_id"] == actor_id

    admin_path = client.post(
        f"/admin/events/{event_id}/rsvps/{victim_id}",
        json={"status": "going"},
    )
    assert admin_path.status_code == HTTPStatus.FORBIDDEN

    client.post("/auth/logout")
    _login(client, student_id="rsvp-victim")
    victim_response = client.post(
        f"/events/{victim_event_id}/rsvp",
        json={"status": "going"},
    )
    assert victim_response.status_code == HTTPStatus.CREATED
    client.post("/auth/logout")
    _login(client, student_id="rsvp-actor")

    listed = client.get("/rsvps/")
    assert listed.status_code == HTTPStatus.OK
    assert {row["member_id"] for row in listed.json()} == {actor_id}


def test_existing_session_uses_current_roles_and_status(client: TestClient) -> None:
    member_id = _seed_member(
        student_id="stale-admin",
        roles="super_admin,admin,member,admin_roles",
    )
    _seed_member(student_id="role-target")
    _login(client, student_id="stale-admin")

    _update_member("stale-admin", roles="member")
    demoted = client.patch(
        f"/admin/members/{member_id}/roles",
        json={"roles": ["member"]},
    )
    assert demoted.status_code == HTTPStatus.FORBIDDEN
    assert demoted.json()["detail"] == "super_admin_required"

    event_write = client.post(
        "/events/",
        json={
            "title": "stale role must not write",
            "starts_at": "2030-01-01T09:00:00Z",
            "ends_at": "2030-01-01T10:00:00Z",
            "location": "Seoul",
            "capacity": 10,
        },
    )
    assert event_write.status_code == HTTPStatus.FORBIDDEN

    _update_member("stale-admin", status="suspended")
    suspended = client.get("/members/?limit=1")
    assert suspended.status_code == HTTPStatus.UNAUTHORIZED


def test_existing_session_is_invalid_after_member_deletion(client: TestClient) -> None:
    _seed_member(student_id="deleted-session")
    _login(client, student_id="deleted-session")

    async def _delete(session: AsyncSession) -> None:
        result = await session.execute(
            select(models.Member).where(
                models.Member.student_id == "deleted-session"
            )
        )
        member = result.scalar_one()
        await session.delete(member)
        await session.commit()

    _run_in_test_session(_delete)

    response = client.get("/members/?limit=1")
    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_super_admin_count_uses_exact_active_role_tokens(client: TestClient) -> None:
    _seed_member(student_id="exact-super", roles="member,super_admin")
    _seed_member(student_id="substring-super", roles="member,super_admin_helper")
    _seed_member(student_id="wildcard-super", roles="member,superXadmin")
    _seed_member(
        student_id="suspended-super",
        roles="member,super_admin",
        status="suspended",
    )
    holder = {"count": 0}

    async def _count(session: AsyncSession) -> None:
        holder["count"] = await members_repo.count_active_members_with_role(
            session,
            role="super_admin",
        )

    _run_in_test_session(_count)
    assert holder["count"] == 1


def test_concurrent_demotions_preserve_one_super_admin(client: TestClient) -> None:
    first_id = _seed_member(
        student_id="concurrent-super-1",
        roles="member,admin,super_admin",
    )
    second_id = _seed_member(
        student_id="concurrent-super-2",
        roles="member,admin,super_admin",
    )
    _seed_member(student_id="concurrent-actor")
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _demote(member_id: int) -> str:
        async for session in override():
            try:
                await members_service.update_member_roles(
                    session,
                    member_id=member_id,
                    actor_student_id="concurrent-actor",
                    roles=["member", "admin"],
                )
            except ApiError as exc:
                return exc.code
            return "updated"
        raise RuntimeError("test session was not yielded")

    async def _run_demotions() -> list[str]:
        return list(await asyncio.gather(_demote(first_id), _demote(second_id)))

    outcomes = asyncio.run(_run_demotions())

    assert sorted(outcomes) == ["last_super_admin_forbidden", "updated"]

    holder = {"count": 0}

    async def _count(session: AsyncSession) -> None:
        holder["count"] = await members_repo.count_active_members_with_role(
            session,
            role="super_admin",
        )

    _run_in_test_session(_count)
    assert holder["count"] == 1
