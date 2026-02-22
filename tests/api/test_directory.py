from __future__ import annotations

import asyncio
from http import HTTPStatus

from fastapi.testclient import TestClient
from sqlalchemy import select

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app


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
