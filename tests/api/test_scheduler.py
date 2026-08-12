from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from apps.api import scheduler
from apps.api.config import reset_settings_cache


@pytest.mark.asyncio
async def test_process_scheduled_notifications_invokes_service() -> None:
    result = SimpleNamespace(
        total_events=2,
        processed=1,
        skipped=1,
        total_accepted=3,
        total_failed=0,
    )
    session = object()
    session_ctx = AsyncMock()
    session_ctx.__aenter__.return_value = session
    session_ctx.__aexit__.return_value = False

    with (
        patch("apps.api.scheduler.AsyncSessionLocal", return_value=session_ctx),
        patch(
            "apps.api.scheduler.sched_svc.trigger_scheduled_notifications",
            new_callable=AsyncMock,
            return_value=result,
        ) as trigger,
        patch("apps.api.scheduler.PyWebPushProvider") as provider_cls,
    ):
        await scheduler.process_scheduled_notifications()

    provider_cls.assert_called_once_with()
    trigger.assert_awaited_once()
    trigger_args = trigger.await_args
    assert trigger_args is not None
    assert trigger_args.args[0] is session


@pytest.mark.asyncio
async def test_reclaim_stale_scheduled_notifications_logs_when_reclaimed() -> None:
    session = object()
    session_ctx = AsyncMock()
    session_ctx.__aenter__.return_value = session
    session_ctx.__aexit__.return_value = False

    with (
        patch("apps.api.scheduler.AsyncSessionLocal", return_value=session_ctx),
        patch(
            "apps.api.scheduler.sched_svc.reclaim_stale_scheduled_logs",
            new_callable=AsyncMock,
            return_value=2,
        ) as reclaim,
    ):
        await scheduler.reclaim_stale_scheduled_notifications()

    reclaim.assert_awaited_once_with(session)


def test_start_scheduler_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    scheduler._state["scheduler"] = None
    monkeypatch.setenv("SCHEDULER_ENABLED", "false")
    reset_settings_cache()
    try:
        scheduler.start_scheduler()
        assert scheduler._state["scheduler"] is None
    finally:
        monkeypatch.delenv("SCHEDULER_ENABLED", raising=False)
        reset_settings_cache()


def test_shutdown_scheduler_is_idempotent() -> None:
    scheduler._state["scheduler"] = None
    scheduler.shutdown_scheduler()
    scheduler.shutdown_scheduler()
