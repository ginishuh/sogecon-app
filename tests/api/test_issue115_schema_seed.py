from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app
from apps.api.seed_data import create_admin_users
from apps.api.seed_production import create_production_admins


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


async def _create_signup_request(
    session: AsyncSession,
    *,
    student_id: str,
    status: str,
) -> None:
    session.add(
        models.SignupRequest(
            student_id=student_id,
            email=f"{student_id}@test.example.com",
            name="테스트 신청자",
            cohort=2020,
            major="경제학",
            status=status,
        )
    )
    await session.commit()


def test_signup_requests_partial_unique_blocks_duplicate_pending(
    client: object,
) -> None:
    assert client is not None

    async def _run(session: AsyncSession) -> None:
        await _create_signup_request(session, student_id="s115001", status="pending")

        session.add(
            models.SignupRequest(
                student_id="s115001",
                email="dup@test.example.com",
                name="중복 신청자",
                cohort=2021,
                major="경제학",
                status="pending",
            )
        )
        with pytest.raises(IntegrityError):
            await session.commit()
        await session.rollback()

    _run_in_test_session(_run)


def test_signup_requests_partial_unique_allows_rejected_history(client: object) -> None:
    assert client is not None

    async def _run(session: AsyncSession) -> None:
        await _create_signup_request(session, student_id="s115002", status="rejected")
        await _create_signup_request(session, student_id="s115002", status="pending")

        count = await session.scalar(
            select(func.count())
            .select_from(models.SignupRequest)
            .where(models.SignupRequest.student_id == "s115002")
        )
        assert count == 2

    _run_in_test_session(_run)


def test_seed_data_creates_admin_bootstrap_only(
    client: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert client is not None
    monkeypatch.setenv("SEED_DEV_ADMIN_VALUE", "dev-admin-pass")

    async def _run(session: AsyncSession) -> None:
        await create_admin_users(session)

        admin_count = await session.scalar(
            select(func.count()).select_from(models.AdminUser)
        )
        member_count = await session.scalar(
            select(func.count()).select_from(models.Member)
        )
        auth_count = await session.scalar(
            select(func.count()).select_from(models.MemberAuth)
        )

        assert admin_count == 1
        assert member_count == 1
        assert auth_count == 1

        row = await session.execute(
            select(models.Member.status, models.Member.roles).where(
                models.Member.student_id == "s47053"
            )
        )
        status, roles = row.one()
        assert status == "active"
        assert "super_admin" in roles.split(",")

    _run_in_test_session(_run)


def test_seed_production_creates_admin_bootstrap_only(
    client: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert client is not None
    monkeypatch.setenv("SEED_PROD_ADMIN001_VALUE", "prod-admin-1")

    async def _run(session: AsyncSession) -> None:
        await create_production_admins(session)

        admin_count = await session.scalar(
            select(func.count()).select_from(models.AdminUser)
        )
        member_count = await session.scalar(
            select(func.count()).select_from(models.Member)
        )
        auth_count = await session.scalar(
            select(func.count()).select_from(models.MemberAuth)
        )

        assert admin_count == 1
        assert member_count == 1
        assert auth_count == 1

        row = await session.execute(
            select(models.Member.roles).where(models.Member.student_id == "s47053")
        )
        roles = row.scalar_one()
        assert "super_admin" in roles.split(",")

    _run_in_test_session(_run)
