from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app
from apps.api.models_support import SupportTicket
from apps.api.reset_data import (
    ALLOW_RESET_ENV,
    async_main,
    is_reset_allowed,
    reset_transition_data,
)


def _run_in_test_session(fn: Callable[[AsyncSession], Awaitable[None]]) -> None:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise RuntimeError("get_db override not found")

    # 테스트 fixture가 주입한 DB 세션 override를 재사용해
    # 별도 엔진 생성 없이 동일 트랜잭션 컨텍스트에서 검증한다.
    async def _run() -> None:
        async for session in override():
            await fn(session)
            return
        raise RuntimeError("test session was not yielded")

    asyncio.run(_run())


async def _seed_reset_target_data(session: AsyncSession) -> None:
    member = models.Member(
        student_id="reset-member",
        email="reset-member@example.com",
        name="리셋대상",
        cohort=1,
        roles="member",
    )
    session.add(member)
    await session.flush()

    session.add(
        models.MemberAuth(
            member_id=member.id,
            student_id=member.student_id,
            password_hash="dummy-hash",
        )
    )
    session.add(
        models.AdminUser(
            student_id="reset-admin",
            email="reset-admin@example.com",
            password_hash="dummy-admin-hash",
        )
    )

    event = models.Event(
        title="reset event",
        description="desc",
        starts_at=datetime(2026, 2, 18, 0, 0, tzinfo=UTC),
        ends_at=datetime(2026, 2, 18, 2, 0, tzinfo=UTC),
        location="Seoul",
        capacity=100,
    )
    session.add(event)
    await session.flush()

    post = models.Post(
        author_id=member.id,
        title="reset post",
        content="content",
    )
    session.add(post)
    await session.flush()

    session.add(
        models.Comment(
            post_id=post.id,
            author_id=member.id,
            content="comment",
        )
    )
    session.add(
        models.RSVP(
            member_id=member.id,
            event_id=event.id,
            status=models.RSVPStatus.GOING,
        )
    )
    session.add(
        models.NotificationPreference(
            member_id=member.id,
            channel="webpush",
            topic="notice",
            enabled=True,
        )
    )
    session.add(
        models.PushSubscription(
            member_id=member.id,
            endpoint="https://push.example.com/linked",
            endpoint_hash="a" * 64,
            p256dh="p256dh-linked",
            auth="auth-linked",
        )
    )
    session.add(
        models.PushSubscription(
            member_id=None,
            endpoint="https://push.example.com/anon",
            endpoint_hash="b" * 64,
            p256dh="p256dh-anon",
            auth="auth-anon",
        )
    )
    session.add(
        models.SignupRequest(
            student_id="signup-001",
            email="signup-001@example.com",
            name="신청자",
            cohort=2024,
            status="pending",
        )
    )
    session.add(
        models.NotificationSendLog(
            ok=1,
            status_code=202,
            endpoint_hash="c" * 64,
            endpoint_tail="tail",
        )
    )
    session.add(
        models.ScheduledNotificationLog(
            event_id=event.id,
            d_type="d-1",
            scheduled_at=datetime(2026, 2, 17, 0, 0, tzinfo=UTC),
            sent_at=datetime(2026, 2, 17, 0, 1, tzinfo=UTC),
            accepted_count=1,
            failed_count=0,
            status="completed",
        )
    )
    session.add(
        models.HeroItem(
            target_type="event",
            target_id=event.id,
            enabled=True,
            pinned=False,
        )
    )
    session.add(
        SupportTicket(
            member_email="member@example.com",
            subject="문의",
            body="본문",
            contact="010-0000-0000",
            client_ip="127.0.0.1",
        )
    )
    await session.commit()


async def _assert_counts_after_reset(session: AsyncSession) -> None:
    member_count = await session.scalar(select(func.count()).select_from(models.Member))
    auth_count = await session.scalar(
        select(func.count()).select_from(models.MemberAuth)
    )
    admin_count = await session.scalar(
        select(func.count()).select_from(models.AdminUser)
    )
    post_count = await session.scalar(select(func.count()).select_from(models.Post))
    comment_count = await session.scalar(
        select(func.count()).select_from(models.Comment)
    )
    rsvp_count = await session.scalar(select(func.count()).select_from(models.RSVP))
    pref_count = await session.scalar(
        select(func.count()).select_from(models.NotificationPreference)
    )
    sub_count = await session.scalar(
        select(func.count()).select_from(models.PushSubscription)
    )
    signup_count = await session.scalar(
        select(func.count()).select_from(models.SignupRequest)
    )
    send_log_count = await session.scalar(
        select(func.count()).select_from(models.NotificationSendLog)
    )
    sched_log_count = await session.scalar(
        select(func.count()).select_from(models.ScheduledNotificationLog)
    )
    event_count = await session.scalar(select(func.count()).select_from(models.Event))
    hero_count = await session.scalar(select(func.count()).select_from(models.HeroItem))
    ticket_count = await session.scalar(select(func.count()).select_from(SupportTicket))

    assert member_count == 0
    assert auth_count == 0
    assert admin_count == 0
    assert post_count == 0
    assert comment_count == 0
    assert rsvp_count == 0
    assert pref_count == 0
    assert sub_count == 1
    assert signup_count == 0
    assert send_log_count == 1
    assert sched_log_count == 1
    assert event_count == 1
    assert hero_count == 1
    assert ticket_count == 1


def test_is_reset_allowed() -> None:
    assert is_reset_allowed("1") is True
    assert is_reset_allowed("0") is False
    assert is_reset_allowed(None) is False


def test_async_main_requires_guard(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(ALLOW_RESET_ENV, raising=False)
    with pytest.raises(RuntimeError, match="보호장치"):
        asyncio.run(async_main())


def test_reset_transition_data_keeps_logs(client: object) -> None:
    assert client is not None
    _run_in_test_session(_seed_reset_target_data)

    async def _do_reset(session: AsyncSession) -> None:
        summary = await reset_transition_data(session)
        assert "signup_requests" in summary.deleted_rows
        assert "events" in summary.preserved_tables
        assert "hero_items" in summary.preserved_tables

    _run_in_test_session(_do_reset)
    _run_in_test_session(_assert_counts_after_reset)
