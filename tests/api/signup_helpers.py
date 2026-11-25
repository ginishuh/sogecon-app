"""가입 신청·승인 테스트 공용 헬퍼(실제 테스트 DB 경계)."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from email.message import EmailMessage
from http import HTTPStatus
from typing import cast

import httpx
from bcrypt import gensalt, hashpw
from fastapi.testclient import TestClient
from pytest import MonkeyPatch
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.config import reset_settings_cache
from apps.api.db import get_db
from apps.api.main import app
from apps.api.services import email_service
from apps.api.student_id_key import student_id_key

PASSWORD_HASH = hashpw(b"existing-pass", gensalt()).decode()


def run_in_test_session(fn: Callable[[AsyncSession], Awaitable[None]]) -> None:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    async def _run() -> None:
        async for session in override():
            await fn(session)
            return
        raise RuntimeError("test session was not yielded")

    asyncio.run(_run())


def seed_member(
    *,
    student_id: str,
    email: str | None,
    status: str = "active",
    with_password: bool = True,
) -> None:
    async def _seed(session: AsyncSession) -> None:
        member = models.Member(
            student_id=student_id,
            email=email,
            name="기존회원",
            cohort=20,
            roles="member",
            status=status,
            visibility=models.Visibility.PRIVATE,
        )
        session.add(member)
        await session.flush()
        if with_password:
            session.add(
                models.MemberAuth(
                    member_id=member.id,
                    student_id=student_id,
                    password_hash=PASSWORD_HASH,
                )
            )
        await session.commit()

    run_in_test_session(_seed)


def signup(
    client: TestClient,
    *,
    student_id: str,
    email: str,
    phone: str = "010-3100-0001",
) -> httpx.Response:
    return client.post(
        "/auth/member/signup",
        json={
            "student_id": student_id,
            "email": email,
            "name": "재신청자",
            "cohort": 20,
            "phone": phone,
        },
    )


def signup_id_of(client: TestClient, *, student_id: str, email: str) -> int:
    res = client.post(
        "/auth/member/signup",
        json={
            "student_id": student_id,
            "email": email,
            "name": "재신청자",
            "cohort": 20,
            "phone": "010-3100-0002",
        },
    )
    assert res.status_code == HTTPStatus.CREATED, res.text
    return cast(int, res.json()["id"])


def db_state(signup_id: int) -> tuple[str, list[str]]:
    """신청 상태와, 신청 학번과 학번 키가 같은 회원 학번 목록(파이썬 키로 정확 비교)."""
    out: dict[str, object] = {}

    async def _load(session: AsyncSession) -> None:
        row = (
            await session.execute(
                select(models.SignupRequest).where(
                    models.SignupRequest.id == signup_id
                )
            )
        ).scalar_one()
        key = student_id_key(cast(str, row.student_id))
        out["status"] = cast(str, row.status)
        out["members"] = sorted(
            cast(str, value)
            for value in (
                await session.execute(select(models.Member.student_id))
            ).scalars()
            if student_id_key(cast(str, value)) == key
        )

    run_in_test_session(_load)
    return cast(str, out["status"]), cast(list[str], out["members"])


def configure_smtp(monkeypatch: MonkeyPatch) -> list[EmailMessage]:
    monkeypatch.setenv("SMTP_USERNAME", "office@test.example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "not-a-real-app-password")
    monkeypatch.setenv("SMTP_FROM_EMAIL", "office@test.example.com")
    monkeypatch.setenv("PUBLIC_SITE_URL", "https://sogangeconomics.com")
    reset_settings_cache()
    sent: list[EmailMessage] = []

    def fake_deliver(message: EmailMessage, settings: object = None) -> None:
        sent.append(message)

    monkeypatch.setattr(email_service, "deliver_message", fake_deliver)
    return sent
