from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from http import HTTPStatus

from fastapi.testclient import TestClient
from sqlalchemy import select

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app


def _set_updated_at(email: str, value: datetime) -> None:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _do_update() -> None:
        async for db in override():
            stmt = select(models.Member).where(models.Member.email == email)
            result = await db.execute(stmt)
            member = result.scalars().first()
            if member is None:
                raise RuntimeError(f"member not found for {email}")
            member.updated_at = value
            await db.commit()
            break

    asyncio.run(_do_update())


def test_members_sort_recent(admin_login: TestClient) -> None:
    client = admin_login
    older = client.post(
        "/members/",
        json={
            "student_id": "older001",
            "email": "older@example.com",
            "name": "Older",
            "cohort": 1,
        },
    )
    newer = client.post(
        "/members/",
        json={
            "student_id": "newer001",
            "email": "newer@example.com",
            "name": "Newer",
            "cohort": 1,
        },
    )
    assert older.status_code == HTTPStatus.CREATED
    assert newer.status_code == HTTPStatus.CREATED

    base = datetime.now(tz=UTC)
    _set_updated_at("older@example.com", base - timedelta(hours=1))
    _set_updated_at("newer@example.com", base + timedelta(minutes=5))

    response = client.get("/members/?sort=recent&limit=2")
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert [member["email"] for member in data[:2]] == [
        "newer@example.com",
        "older@example.com",
    ]


def test_members_sort_cohort_desc(admin_login: TestClient) -> None:
    client = admin_login
    payloads = [
        {
            "student_id": "anna001",
            "email": "anna@example.com",
            "name": "Anna",
            "cohort": 3,
        },
        {
            "student_id": "brad001",
            "email": "brad@example.com",
            "name": "Brad",
            "cohort": 3,
        },
        {
            "student_id": "carol001",
            "email": "carol@example.com",
            "name": "Carol",
            "cohort": 1,
        },
    ]
    for payload in payloads:
        res = client.post("/members/", json=payload)
        assert res.status_code == HTTPStatus.CREATED

    response = client.get("/members/?sort=cohort_desc&limit=3")
    assert response.status_code == HTTPStatus.OK
    emails = [member["email"] for member in response.json()[:3]]
    # Cohort 3 first (name ascending), then cohort 1
    assert emails == [
        "anna@example.com",
        "brad@example.com",
        "carol@example.com",
    ]
