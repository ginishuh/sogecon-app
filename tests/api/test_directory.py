from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from http import HTTPStatus
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app
from apps.api.services import members_service


def _create_member(client: TestClient, payload: dict[str, object]) -> None:
    student_id = str(payload["student_id"])
    major = str(payload["major"])
    res = client.post(
        "/admin/members/",
        json={
            "student_id": student_id,
            "email": payload["email"],
            "name": payload["name"],
            "cohort": payload["cohort"],
            "roles": ["member"],
        },
    )
    assert res.status_code == HTTPStatus.CREATED
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _set_major() -> None:
        async for db in override():
            stmt = select(models.Member).where(models.Member.student_id == student_id)
            member = (await db.execute(stmt)).scalars().first()
            if member is None:
                raise RuntimeError("member not found")
            setattr(member, "major", major)
            await db.commit()
            break

    asyncio.run(_set_major())


def _set_visibility(student_id: str, visibility: models.Visibility) -> int:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _update() -> int:
        async for db in override():
            stmt = select(models.Member).where(models.Member.student_id == student_id)
            member = (await db.execute(stmt)).scalars().first()
            if member is None:
                raise RuntimeError("member not found")
            member.visibility = visibility
            await db.commit()
            return int(member.id)
        raise RuntimeError("database session not available")

    return asyncio.run(_update())


def _set_cohort(student_id: str, cohort: int) -> int:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _update() -> int:
        async for db in override():
            stmt = select(models.Member).where(models.Member.student_id == student_id)
            member = (await db.execute(stmt)).scalars().first()
            if member is None:
                raise RuntimeError("member not found")
            member.cohort = cohort
            await db.commit()
            return int(member.id)
        raise RuntimeError("database session not available")

    return asyncio.run(_update())


def test_directory_filters(admin_login: TestClient) -> None:
    client = admin_login
    # seed two members via admin create
    _create_member(
        client,
        {
            "student_id": "alice001",
            "email": "alice@example.com",
            "name": "Alice",
            "cohort": 1,
            "major": "CS",
        },
    )
    _create_member(
        client,
        {
            "student_id": "bob002",
            "email": "bob@example.com",
            "name": "Bob",
            "cohort": 2,
            "major": "Math",
        },
    )

    # filter by cohort
    q1 = client.get("/members/?cohort=1")
    assert q1.status_code == HTTPStatus.OK
    data1 = q1.json()
    assert isinstance(data1, list)
    assert any(x["email"] == "alice@example.com" for x in data1)
    assert all(x["cohort"] == 1 for x in data1)

    # search by q
    q2 = client.get("/members/?q=bo")
    assert q2.status_code == HTTPStatus.OK
    data2 = q2.json()
    assert any(x["email"] == "bob@example.com" for x in data2)

    # filter by major
    q3 = client.get("/members/?major=cs")
    assert q3.status_code == HTTPStatus.OK
    data3 = q3.json()
    assert any(x["email"] == "alice@example.com" for x in data3)

    # pagination: limit/offset
    p1 = client.get("/members/?limit=1&offset=0")
    p2 = client.get("/members/?limit=1&offset=1")
    assert p1.status_code == HTTPStatus.OK and p2.status_code == HTTPStatus.OK
    d1, d2 = p1.json(), p2.json()
    assert isinstance(d1, list) and isinstance(d2, list)
    assert d1 and d2 and d1[0]["email"] != d2[0]["email"]

    # count endpoint
    c = client.get("/members/count?q=bo")
    assert c.status_code == HTTPStatus.OK
    assert c.json().get("count", 0) >= 1


def test_directory_enforces_visibility_on_server(admin_login: TestClient) -> None:
    client = admin_login  # seed admin은 1기
    fixtures = [
        ("all215", "all215@example.com", "전체 공개", 2, models.Visibility.ALL),
        ("same215", "same215@example.com", "같은 기수", 1, models.Visibility.COHORT),
        ("other215", "other215@example.com", "다른 기수", 2, models.Visibility.COHORT),
        (
            "private215",
            "private215@example.com",
            "비공개",
            1,
            models.Visibility.PRIVATE,
        ),
    ]
    ids: dict[str, int] = {}
    for student_id, email, name, cohort, visibility in fixtures:
        _create_member(
            client,
            {
                "student_id": student_id,
                "email": email,
                "name": name,
                "cohort": cohort,
                "major": "경제학",
            },
        )
        ids[student_id] = _set_visibility(student_id, visibility)

    admin_detail = client.get(f"/admin/members/{ids['private215']}")
    assert admin_detail.status_code == HTTPStatus.OK
    assert admin_detail.json()["student_id"] == "private215"
    assert admin_detail.json()["roles"] == "member"

    response = client.get("/members/?q=215&limit=20")
    assert response.status_code == HTTPStatus.OK
    rows = response.json()
    emails = {row["email"] for row in rows}
    assert "all215@example.com" in emails
    assert "same215@example.com" in emails
    assert "other215@example.com" not in emails
    assert "private215@example.com" not in emails
    assert all(
        "student_id" not in row and "roles" not in row and "status" not in row
        for row in rows
    )

    hidden_detail = client.get(f"/members/{ids['other215']}")
    assert hidden_detail.status_code == HTTPStatus.NOT_FOUND
    assert hidden_detail.json()["code"] == "member_not_found"
    private_detail = client.get(f"/members/{ids['private215']}")
    assert private_detail.status_code == HTTPStatus.NOT_FOUND
    assert private_detail.json()["code"] == "member_not_found"
    missing_detail = client.get("/members/99999999")
    assert missing_detail.status_code == HTTPStatus.NOT_FOUND
    assert missing_detail.json()["code"] == hidden_detail.json()["code"]
    hidden_count = client.get("/members/count?q=other215@example.com")
    assert hidden_count.status_code == HTTPStatus.OK
    assert hidden_count.json() == {"count": 0}

    _set_visibility("other215", models.Visibility.ALL)
    visible_count = client.get("/members/count?q=other215@example.com")
    assert visible_count.status_code == HTTPStatus.OK
    assert visible_count.json() == {"count": 1}

    viewer_id = _set_visibility("__seed__admin", models.Visibility.PRIVATE)
    own_detail = client.get(f"/members/{viewer_id}")
    assert own_detail.status_code == HTTPStatus.OK
    own_search = client.get("/members/?q=__seed__admin")
    assert own_search.status_code == HTTPStatus.OK
    assert [row["id"] for row in own_search.json()] == [viewer_id]


def test_directory_routes_do_not_preread_viewer(
    admin_login: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    viewer_id = _set_visibility("__seed__admin", models.Visibility.PRIVATE)

    async def _fail_preread(*_args: object, **_kwargs: object) -> models.Member:
        raise AssertionError("directory route performed a separate viewer lookup")

    monkeypatch.setattr(
        members_service,
        "get_member_by_student_id",
        _fail_preread,
    )
    original_execute = cast(
        Callable[..., Awaitable[Result[Any]]],
        AsyncSession.execute,
    )
    query_count = 0

    async def _counting_execute(
        session: AsyncSession,
        *args: object,
        **kwargs: object,
    ) -> Result[Any]:
        nonlocal query_count
        query_count += 1
        return await original_execute(session, *args, **kwargs)

    monkeypatch.setattr(AsyncSession, "execute", _counting_execute)

    before = query_count
    listing = admin_login.get("/members/?q=__seed__admin")
    assert listing.status_code == HTTPStatus.OK
    assert [row["id"] for row in listing.json()] == [viewer_id]
    assert query_count - before == 1

    before = query_count
    count = admin_login.get("/members/count?q=__seed__admin")
    assert count.status_code == HTTPStatus.OK
    assert count.json() == {"count": 1}
    assert query_count - before == 1

    before = query_count
    detail = admin_login.get(f"/members/{viewer_id}")
    assert detail.status_code == HTTPStatus.OK
    assert detail.json()["id"] == viewer_id
    assert query_count - before == 1


def test_directory_scope_uses_latest_viewer_cohort(
    admin_login: TestClient,
) -> None:
    _create_member(
        admin_login,
        {
            "student_id": "cohort-live-225",
            "email": "cohort-live-225@example.com",
            "name": "최신 기수 확인",
            "cohort": 2,
            "major": "경제학",
        },
    )
    target_id = _set_visibility("cohort-live-225", models.Visibility.COHORT)

    hidden = admin_login.get(f"/members/{target_id}")
    assert hidden.status_code == HTTPStatus.NOT_FOUND
    assert hidden.json()["code"] == "member_not_found"

    _set_cohort("__seed__admin", 2)

    visible = admin_login.get(f"/members/{target_id}")
    assert visible.status_code == HTTPStatus.OK
    assert visible.json()["id"] == target_id
    count = admin_login.get("/members/count?q=cohort-live-225")
    assert count.status_code == HTTPStatus.OK
    assert count.json() == {"count": 1}
