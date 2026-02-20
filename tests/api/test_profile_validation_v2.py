from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from http import HTTPStatus

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app
from apps.api.repositories import members as members_repo


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


def test_me_update_requires_auth(client: TestClient) -> None:
    res = client.put("/me/", json={"phone": "010-1234-5678"})
    assert res.status_code == HTTPStatus.UNAUTHORIZED


def test_me_update_accepts_trimmed_phone(member_login: TestClient) -> None:
    res = member_login.put("/me/", json={"phone": " 010-1234-5678 "})
    assert res.status_code == HTTPStatus.OK
    assert res.json()["phone"] == "010-1234-5678"


def test_me_update_normalizes_blank_phone_to_null(member_login: TestClient) -> None:
    res = member_login.put("/me/", json={"phone": "   "})
    assert res.status_code == HTTPStatus.OK
    assert res.json()["phone"] is None


def test_me_update_rejects_duplicate_phone(member_login: TestClient) -> None:
    target_phone = "010-7777-7777"

    async def _seed(session: AsyncSession) -> None:
        session.add(
            models.Member(
                student_id="dup_phone_001",
                email="dup_phone_001@example.com",
                name="Dup Phone",
                cohort=2020,
                roles="member",
                phone=target_phone,
            )
        )
        await session.commit()

    _run_in_test_session(_seed)

    res = member_login.put("/me/", json={"phone": target_phone})
    assert res.status_code == HTTPStatus.CONFLICT
    assert res.json()["code"] == "member_phone_already_in_use"


def test_me_update_phone_integrity_error_maps_to_409(
    member_login: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _raise_integrity_error(*_: object, **__: object) -> object:
        raise IntegrityError(
            "UPDATE members ...",
            {},
            Exception(
                'duplicate key value violates unique constraint "ix_members_phone"'
            ),
        )

    monkeypatch.setattr(members_repo, "update_member_profile", _raise_integrity_error)

    res = member_login.put("/me/", json={"phone": "010-5555-5555"})
    assert res.status_code == HTTPStatus.CONFLICT
    assert res.json()["code"] == "member_phone_already_in_use"


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"phone": "abc12345"}, "phone"),
        ({"phone": "123456"}, "phone"),
        ({"company_phone": "123456789012345678901"}, "company_phone"),
        ({"department": ""}, "department"),
        ({"department": "x" * 81}, "department"),
        ({"job_title": "y" * 81}, "job_title"),
        ({"addr_personal": "z" * 201}, "addr_personal"),
        ({"addr_company": "z" * 201}, "addr_company"),
        ({"industry": ""}, "industry"),
        ({"industry": "i" * 61}, "industry"),
    ],
)
def test_me_update_invalid_payload_returns_422(
    member_login: TestClient, payload: dict[str, str], field: str
) -> None:
    res = member_login.put("/me/", json=payload)
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    body = res.json()
    assert isinstance(body["detail"], list)
    assert any(field in entry.get("loc", []) for entry in body["detail"])
