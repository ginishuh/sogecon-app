from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from http import HTTPStatus
from typing import Any

import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api import models
from apps.api.config import get_settings, reset_settings_cache
from apps.api.crypto_utils import is_push_encryption_effective
from apps.api.db import get_db
from apps.api.main import app
from apps.api.repositories import notifications as subs_repo
from apps.api.repositories import send_logs as logs_repo
from apps.api.routers import notifications as router_mod
from apps.api.services import notifications_service as notif_svc
from apps.api.services import scheduled_delivery_service as delivery_svc
from apps.api.services import scheduled_notifications_service as sched
from apps.api.services.notifications_service import PushProvider


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
) -> int:
    holder = {"member_id": 0}

    async def _seed(session: AsyncSession) -> None:
        member = models.Member(
            student_id=student_id,
            email=f"{student_id}@example.com",
            name=student_id,
            cohort=1,
            roles=roles,
            status="active",
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


def _login_member(
    client: TestClient, *, student_id: str, password: str = "test-pass"
) -> None:
    response = client.post(
        "/auth/member/login",
        json={"student_id": student_id, "password": password},
    )
    assert response.status_code == HTTPStatus.OK


class _PartialBoomProvider(PushProvider):
    def __init__(self) -> None:
        self.calls: list[str] = []

    def send(
        self, sub: models.PushSubscription, payload: dict[str, object]
    ) -> tuple[bool, int | None]:
        self.calls.append(str(sub.endpoint_hash))
        if len(self.calls) == 1:
            return (True, 201)
        raise RuntimeError("provider stopped after first send")

    async def send_async(
        self, sub: models.PushSubscription, payload: dict[str, object]
    ) -> tuple[bool, int | None]:
        return self.send(sub, payload)


class _NoCallProvider(PushProvider):
    def __init__(self) -> None:
        self.calls = 0

    def send(
        self, sub: models.PushSubscription, payload: dict[str, object]
    ) -> tuple[bool, int | None]:
        self.calls += 1
        return (True, 201)

    async def send_async(
        self, sub: models.PushSubscription, payload: dict[str, object]
    ) -> tuple[bool, int | None]:
        return self.send(sub, payload)


def test_subscription_ownership_upsert_and_delete(client: TestClient) -> None:
    owner_id = _seed_member(student_id="d3-owner")
    _seed_member(student_id="d3-other")
    endpoint = "https://example.com/push/d3-ownership"

    _login_member(client, student_id="d3-owner")
    ok = client.post(
        "/notifications/subscriptions",
        json={"endpoint": endpoint, "p256dh": "k", "auth": "a"},
    )
    assert ok.status_code == HTTPStatus.NO_CONTENT

    _login_member(client, student_id="d3-other")
    takeover = client.post(
        "/notifications/subscriptions",
        json={"endpoint": endpoint, "p256dh": "k2", "auth": "a2"},
    )
    assert takeover.status_code == HTTPStatus.FORBIDDEN
    body = takeover.json()
    assert body["code"] == "subscription_forbidden"
    assert "endpoint" not in body.get("detail", "").lower()

    steal_delete = client.request(
        "DELETE",
        "/notifications/subscriptions",
        json={"endpoint": endpoint},
    )
    assert steal_delete.status_code == HTTPStatus.FORBIDDEN
    assert steal_delete.json()["code"] == "subscription_forbidden"

    _login_member(client, student_id="d3-owner")
    own_delete = client.request(
        "DELETE",
        "/notifications/subscriptions",
        json={"endpoint": endpoint},
    )
    assert own_delete.status_code == HTTPStatus.NO_CONTENT

    missing = client.request(
        "DELETE",
        "/notifications/subscriptions",
        json={"endpoint": endpoint},
    )
    assert missing.status_code == HTTPStatus.NO_CONTENT

    # 레거시 member_id NULL 행은 actor에게 귀속 허용
    async def _seed_legacy(session: AsyncSession) -> None:
        await subs_repo.upsert_subscription(
            session,
            {
                "endpoint": "https://example.com/push/d3-legacy",
                "p256dh": "p",
                "auth": "a",
            },
            actor_member_id=owner_id,
        )
        result = await session.execute(
            select(models.PushSubscription).where(
                models.PushSubscription.endpoint_hash
                == subs_repo.hash_endpoint("https://example.com/push/d3-legacy")
            )
        )
        row = result.scalars().first()
        assert row is not None
        setattr(row, "member_id", None)
        await session.commit()

    _run_in_test_session(_seed_legacy)

    _login_member(client, student_id="d3-other")
    claim = client.post(
        "/notifications/subscriptions",
        json={
            "endpoint": "https://example.com/push/d3-legacy",
            "p256dh": "p2",
            "auth": "a2",
        },
    )
    assert claim.status_code == HTTPStatus.NO_CONTENT


def test_stats_encryption_enabled_matches_effective(
    admin_login: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("PUSH_ENCRYPT_AT_REST", raising=False)
    monkeypatch.delenv("PUSH_KEK", raising=False)
    reset_settings_cache()
    res = admin_login.get("/notifications/admin/notifications/stats?range=7d")
    assert res.status_code == HTTPStatus.OK
    assert res.json()["encryption_enabled"] is False
    assert is_push_encryption_effective(get_settings()) is False


def test_stats_aggregate_matches_list_counts(admin_login: TestClient) -> None:
    member_id = _seed_member(student_id="d3-stats-owner")

    async def _seed(session: AsyncSession) -> None:
        now = datetime.now(tz=UTC)
        await logs_repo.create_log(
            session, endpoint="https://example.com/a", ok=True, status_code=201
        )
        await logs_repo.create_log(
            session, endpoint="https://example.com/b", ok=False, status_code=404
        )
        await logs_repo.create_log(
            session, endpoint="https://example.com/c", ok=False, status_code=410
        )
        await logs_repo.create_log(
            session, endpoint="https://example.com/d", ok=False, status_code=500
        )
        # 범위 밖
        old = models.NotificationSendLog(
            ok=1,
            status_code=201,
            endpoint_hash="old",
            endpoint_tail="old-tail",
            created_at=now - timedelta(days=40),
        )
        session.add(old)
        await session.commit()

        await subs_repo.upsert_subscription(
            session,
            {
                "endpoint": "https://example.com/stats-sub",
                "p256dh": "p",
                "auth": "a",
            },
            actor_member_id=member_id,
        )

    _run_in_test_session(_seed)

    cutoff = datetime.now(tz=UTC) - timedelta(days=7)

    async def _compare(session: AsyncSession) -> None:
        agg = await logs_repo.aggregate_since(session, cutoff=cutoff)
        logs = await logs_repo.list_since(session, cutoff=cutoff)
        accepted = sum(1 for r in logs if int(r.ok) != 0)
        failed = sum(1 for r in logs if int(r.ok) == 0)
        f404 = sum(
            1
            for r in logs
            if int(r.ok) == 0 and r.status_code == int(HTTPStatus.NOT_FOUND)
        )
        f410 = sum(
            1 for r in logs if int(r.ok) == 0 and r.status_code == int(HTTPStatus.GONE)
        )
        assert agg.accepted == accepted
        assert agg.failed == failed
        assert agg.failed_404 == f404
        assert agg.failed_410 == f410
        active = await subs_repo.count_active_subscriptions(session)
        listed = await subs_repo.list_active_subscriptions(session)
        assert active == len(listed)

    _run_in_test_session(_compare)

    res = admin_login.get("/notifications/admin/notifications/stats?range=7d")
    assert res.status_code == HTTPStatus.OK
    data = res.json()
    assert data["recent_accepted"] >= 1
    assert data["recent_failed"] >= 3
    assert data["failed_404"] >= 1
    assert data["failed_410"] >= 1
    assert data["failed_other"] >= 1


def test_send_to_all_batches_logs_and_expired_deletes(
    admin_login: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner_id = _seed_member(student_id="d3-batch-owner")
    endpoints = [f"https://example.com/push/batch/{i}" for i in range(12)]

    async def _seed(session: AsyncSession) -> None:
        for ep in endpoints:
            await subs_repo.upsert_subscription(
                session,
                {"endpoint": ep, "p256dh": "p", "auth": "a"},
                actor_member_id=owner_id,
            )

    _run_in_test_session(_seed)

    class _Dummy(PushProvider):
        def __init__(self) -> None:
            self._n = 0

        def send(
            self, sub: models.PushSubscription, payload: dict[str, object]
        ) -> tuple[bool, int | None]:
            self._n += 1
            if self._n % 2 == 0:
                return (False, 404)
            return (True, 201)

        async def send_async(
            self, sub: models.PushSubscription, payload: dict[str, object]
        ) -> tuple[bool, int | None]:
            return self.send(sub, payload)

    provider = _Dummy()

    batch_calls = {"logs": 0, "removes": 0}
    real_create = logs_repo.create_logs_batch
    real_remove = subs_repo.remove_by_endpoint_hashes

    async def _count_logs(db: AsyncSession, items: Any) -> int:
        batch_calls["logs"] += 1
        return await real_create(db, items)

    async def _count_remove(db: AsyncSession, hashes: Any, **kwargs: Any) -> int:
        batch_calls["removes"] += 1
        return await real_remove(db, hashes, **kwargs)

    monkeypatch.setattr(logs_repo, "create_logs_batch", _count_logs)
    monkeypatch.setattr(notif_svc.send_logs, "create_logs_batch", _count_logs)
    monkeypatch.setattr(subs_repo, "remove_by_endpoint_hashes", _count_remove)
    monkeypatch.setattr(notif_svc.repo, "remove_by_endpoint_hashes", _count_remove)

    app.dependency_overrides[router_mod.get_push_provider] = lambda: provider
    try:
        res = admin_login.post(
            "/notifications/admin/notifications/send",
            json={"title": "t", "body": "b"},
        )
        assert res.status_code in (HTTPStatus.ACCEPTED, HTTPStatus.OK)
        body = res.json()
        assert body["accepted"] + body["failed"] == 12
        assert batch_calls["logs"] == 1
        assert batch_calls["removes"] == 1
        assert body["failed"] >= 1
        assert body["accepted"] >= 1
    finally:
        app.dependency_overrides.pop(router_mod.get_push_provider, None)


def test_remove_by_endpoint_hashes_bounded_batches() -> None:
    calls = {"commits": 0}

    class _FakeResult:
        rowcount = 3

    class _FakeSession:
        async def execute(self, _stmt: object) -> _FakeResult:
            return _FakeResult()

        async def commit(self) -> None:
            calls["commits"] += 1

    hashes = [f"h{i:03d}" for i in range(250)]
    removed = asyncio.run(
        subs_repo.remove_by_endpoint_hashes(_FakeSession(), hashes, batch_size=100)
    )
    assert removed == 9  # 3 batches * rowcount 3
    assert calls["commits"] == 3


def test_create_logs_batch_single_commit(monkeypatch: pytest.MonkeyPatch) -> None:
    commits = {"n": 0}

    class _FakeSession:
        def add_all(self, _rows: object) -> None:
            return None

        async def commit(self) -> None:
            commits["n"] += 1

    items = [
        logs_repo.SendLogItem(endpoint=f"https://e/{i}", ok=True, status_code=201)
        for i in range(5)
    ]
    n = asyncio.run(logs_repo.create_logs_batch(_FakeSession(), items))
    assert n == 5
    assert commits["n"] == 1


def test_send_to_all_isolates_crypto_failure_per_subscription(
    admin_login: TestClient,
) -> None:
    owner_id = _seed_member(student_id="d3-crypto-iso")
    good_ep = "https://example.com/push/crypto-good"
    bad_hash = subs_repo.hash_endpoint("https://example.com/push/crypto-bad")

    async def _seed(session: AsyncSession) -> None:
        await subs_repo.upsert_subscription(
            session,
            {"endpoint": good_ep, "p256dh": "p", "auth": "a"},
            actor_member_id=owner_id,
        )
        session.add(
            models.PushSubscription(
                endpoint="enc:v1:not-a-real-ciphertext",
                p256dh="enc:v1:bad",
                auth="enc:v1:bad",
                endpoint_hash=bad_hash,
                member_id=owner_id,
            )
        )
        await session.commit()

    _run_in_test_session(_seed)

    class _Dummy(PushProvider):
        def send(
            self, sub: models.PushSubscription, payload: dict[str, object]
        ) -> tuple[bool, int | None]:
            return (True, 201)

        async def send_async(
            self, sub: models.PushSubscription, payload: dict[str, object]
        ) -> tuple[bool, int | None]:
            return self.send(sub, payload)

    provider = _Dummy()
    app.dependency_overrides[router_mod.get_push_provider] = lambda: provider
    try:
        res = admin_login.post(
            "/notifications/admin/notifications/send",
            json={"title": "t", "body": "b"},
        )
        assert res.status_code == HTTPStatus.ACCEPTED
        body = res.json()
        assert body["accepted"] >= 1
        assert body["failed"] >= 1
        assert body["accepted"] + body["failed"] >= 2
    finally:
        app.dependency_overrides.pop(router_mod.get_push_provider, None)


def test_process_single_event_marks_failed_on_batch_exception(
    client: TestClient,
) -> None:
    owner_id = _seed_member(student_id="d3-sched-fail")
    event_holder = {"id": 0}

    async def _seed(session: AsyncSession) -> None:
        starts = datetime.now(tz=UTC) + timedelta(days=3)
        event = models.Event(
            title="d3-sched",
            starts_at=starts,
            ends_at=starts + timedelta(hours=2),
            location="Seoul",
            capacity=10,
        )
        session.add(event)
        await session.commit()
        await session.refresh(event)
        event_holder["id"] = int(event.id)
        await subs_repo.upsert_subscription(
            session,
            {
                "endpoint": "https://example.com/push/sched-fail",
                "p256dh": "p",
                "auth": "a",
            },
            actor_member_id=owner_id,
        )

    _run_in_test_session(_seed)

    class _Boom(PushProvider):
        def send(
            self, sub: models.PushSubscription, payload: dict[str, object]
        ) -> tuple[bool, int | None]:
            raise RuntimeError("provider boom")

        async def send_async(
            self, sub: models.PushSubscription, payload: dict[str, object]
        ) -> tuple[bool, int | None]:
            return self.send(sub, payload)

    async def _run(session: AsyncSession) -> None:
        event = await session.get(models.Event, event_holder["id"])
        assert event is not None
        result = await sched.process_single_event(session, _Boom(), event, "d-3")
        assert result.skipped is False
        assert result.failed >= 1
        assert (
            await sched.is_already_sent(
                session, event_id=event_holder["id"], d_type="d-3"
            )
            is False
        )
        logs = await sched.list_scheduled_logs(session, limit=10)
        match = [
            log
            for log in logs
            if int(log.event_id) == event_holder["id"] and str(log.d_type) == "d-3"
        ]
        assert match
        assert str(match[0].status) == "failed"

        # failed 행은 재시도 시 회수 가능해야 함
        reclaim = await sched.create_notification_log(
            session,
            event_id=event_holder["id"],
            d_type="d-3",
            scheduled_at=datetime.now(tz=UTC),
        )
        assert reclaim is not None
        assert str(reclaim.status) == "pending"

    _run_in_test_session(_run)


def test_upsert_same_actor_idempotent_other_forbidden(client: TestClient) -> None:
    owner_id = _seed_member(student_id="d3-upsert-a")
    other_id = _seed_member(student_id="d3-upsert-b")
    endpoint = "https://example.com/push/upsert-race"

    async def _run(session: AsyncSession) -> None:
        await subs_repo.upsert_subscription(
            session,
            {"endpoint": endpoint, "p256dh": "p1", "auth": "a1"},
            actor_member_id=owner_id,
        )
        again = await subs_repo.upsert_subscription(
            session,
            {"endpoint": endpoint, "p256dh": "p2", "auth": "a2"},
            actor_member_id=owner_id,
        )
        assert int(again.member_id) == owner_id
        with pytest.raises(subs_repo.SubscriptionOwnershipError):
            await subs_repo.upsert_subscription(
                session,
                {"endpoint": endpoint, "p256dh": "p3", "auth": "a3"},
                actor_member_id=other_id,
            )

    _run_in_test_session(_run)


@pytest.mark.parametrize("stale_status", ["pending", "in_progress"])
def test_stale_scheduled_log_is_reclaimed(
    client: TestClient, stale_status: str
) -> None:
    event_holder = {"id": 0}

    async def _seed(session: AsyncSession) -> None:
        starts = datetime.now(tz=UTC) + timedelta(days=3)
        event = models.Event(
            title=f"stale-{stale_status}",
            starts_at=starts,
            ends_at=starts + timedelta(hours=2),
            location="Seoul",
            capacity=10,
        )
        session.add(event)
        await session.commit()
        await session.refresh(event)
        event_holder["id"] = int(event.id)

    _run_in_test_session(_seed)

    async def _create_stale(session: AsyncSession) -> None:
        log = await sched.create_notification_log(
            session,
            event_id=event_holder["id"],
            d_type="d-3",
            scheduled_at=datetime.now(tz=UTC),
        )
        assert log is not None
        setattr(log, "status", stale_status)
        setattr(
            log,
            "updated_at",
            datetime.now(tz=UTC)
            - sched.SCHEDULED_LOG_STALE_AFTER
            - timedelta(minutes=1),
        )
        await session.commit()

    _run_in_test_session(_create_stale)

    class _Noop(PushProvider):
        def send(
            self, sub: models.PushSubscription, payload: dict[str, object]
        ) -> tuple[bool, int | None]:
            return (True, 201)

        async def send_async(
            self, sub: models.PushSubscription, payload: dict[str, object]
        ) -> tuple[bool, int | None]:
            return self.send(sub, payload)

    async def _run(session: AsyncSession) -> None:
        event = await session.get(models.Event, event_holder["id"])
        assert event is not None
        result = await sched.process_single_event(session, _Noop(), event, "d-3")
        assert result.skipped is False
        logs = await sched.list_scheduled_logs(session, limit=10)
        match = [
            log
            for log in logs
            if int(log.event_id) == event_holder["id"] and str(log.d_type) == "d-3"
        ]
        assert match
        assert str(match[0].status) == "completed"

    _run_in_test_session(_run)


def test_scheduled_trigger_entrypoint_persists_delivery_state(
    admin_login: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner_id = _seed_member(student_id="d3-trigger-owner")
    target_date = datetime.now(tz=sched.KST).date()
    event_holder = {"id": 0}

    async def _seed(session: AsyncSession) -> None:
        starts = datetime.combine(
            target_date + timedelta(days=3),
            datetime.min.time(),
            tzinfo=sched.KST,
        ) + timedelta(hours=10)
        event = models.Event(
            title="scheduled-entrypoint",
            starts_at=starts,
            ends_at=starts + timedelta(hours=2),
            location="Seoul",
            capacity=10,
        )
        session.add(event)
        await session.commit()
        await session.refresh(event)
        event_holder["id"] = int(event.id)
        await subs_repo.upsert_subscription(
            session,
            {
                "endpoint": "https://example.com/push/trigger-entrypoint",
                "p256dh": "p",
                "auth": "a",
            },
            actor_member_id=owner_id,
        )

    _run_in_test_session(_seed)

    provider = _NoCallProvider()
    app.dependency_overrides[router_mod.get_push_provider] = lambda: provider
    try:
        response = admin_login.post(
            "/notifications/admin/notifications/trigger-scheduled",
            json={"target_date": target_date.isoformat()},
        )
        assert response.status_code == HTTPStatus.ACCEPTED
        body = response.json()
        assert body["processed"] == 1
        assert body["accepted"] == 1
        assert body["failed"] == 0
        assert provider.calls == 1
    finally:
        app.dependency_overrides.pop(router_mod.get_push_provider, None)

    async def _verify(session: AsyncSession) -> None:
        result = await session.execute(
            select(models.ScheduledNotificationDelivery)
            .join(
                models.ScheduledNotificationLog,
                models.ScheduledNotificationDelivery.scheduled_log_id
                == models.ScheduledNotificationLog.id,
            )
            .where(models.ScheduledNotificationLog.event_id == event_holder["id"])
        )
        deliveries = result.scalars().all()
        assert len(deliveries) == 1
        assert str(deliveries[0].status) == "completed"

    _run_in_test_session(_verify)


def test_scheduled_retry_does_not_resend_uncertain_delivery(
    client: TestClient,
) -> None:
    owner_id = _seed_member(student_id="d3-delivery-owner")
    event_holder = {"id": 0}

    async def _seed(session: AsyncSession) -> None:
        starts = datetime.now(tz=UTC) + timedelta(days=3)
        event = models.Event(
            title="delivery-idempotency",
            starts_at=starts,
            ends_at=starts + timedelta(hours=2),
            location="Seoul",
            capacity=10,
        )
        session.add(event)
        await session.commit()
        await session.refresh(event)
        event_holder["id"] = int(event.id)
        for suffix in ("first", "second"):
            await subs_repo.upsert_subscription(
                session,
                {
                    "endpoint": f"https://example.com/push/{suffix}",
                    "p256dh": "p",
                    "auth": "a",
                },
                actor_member_id=owner_id,
            )

    _run_in_test_session(_seed)

    first_provider = _PartialBoomProvider()

    async def _first_attempt(session: AsyncSession) -> None:
        event = await session.get(models.Event, event_holder["id"])
        assert event is not None
        result = await sched.process_single_event(session, first_provider, event, "d-3")
        assert result.skipped is False
        assert result.failed == 2
        assert len(first_provider.calls) == 2

    _run_in_test_session(_first_attempt)

    retry_provider = _NoCallProvider()

    async def _retry(session: AsyncSession) -> None:
        event = await session.get(models.Event, event_holder["id"])
        assert event is not None
        result = await sched.process_single_event(session, retry_provider, event, "d-3")
        assert result.skipped is False
        assert result.failed == 2
        assert retry_provider.calls == 0
        delivery_result = await session.execute(
            select(models.ScheduledNotificationDelivery).order_by(
                models.ScheduledNotificationDelivery.id
            )
        )
        deliveries = delivery_result.scalars().all()
        assert len(deliveries) == 2
        assert {str(row.status) for row in deliveries} == {"unknown"}

    _run_in_test_session(_retry)


def test_scheduled_db_failure_rolls_back_before_failed_readback(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner_id = _seed_member(student_id="d3-db-fail")
    event_holder = {"id": 0}

    async def _seed(session: AsyncSession) -> None:
        starts = datetime.now(tz=UTC) + timedelta(days=3)
        event = models.Event(
            title="db-fail",
            starts_at=starts,
            ends_at=starts + timedelta(hours=2),
            location="Seoul",
            capacity=10,
        )
        session.add(event)
        await session.commit()
        await session.refresh(event)
        event_holder["id"] = int(event.id)
        await subs_repo.upsert_subscription(
            session,
            {
                "endpoint": "https://example.com/push/db-fail",
                "p256dh": "p",
                "auth": "a",
            },
            actor_member_id=owner_id,
        )

    _run_in_test_session(_seed)

    async def _raise_db_error(_db: AsyncSession, _items: Any) -> int:
        raise SQLAlchemyError("notification log commit failed")

    monkeypatch.setattr(delivery_svc.send_logs, "create_logs_batch", _raise_db_error)

    class _Good(PushProvider):
        def send(
            self, sub: models.PushSubscription, payload: dict[str, object]
        ) -> tuple[bool, int | None]:
            return (True, 201)

        async def send_async(
            self, sub: models.PushSubscription, payload: dict[str, object]
        ) -> tuple[bool, int | None]:
            return self.send(sub, payload)

    async def _run(session: AsyncSession) -> None:
        event = await session.get(models.Event, event_holder["id"])
        assert event is not None
        result = await sched.process_single_event(session, _Good(), event, "d-3")
        assert result.skipped is False
        logs = await sched.list_scheduled_logs(session, limit=10)
        match = [
            log
            for log in logs
            if int(log.event_id) == event_holder["id"] and str(log.d_type) == "d-3"
        ]
        assert match
        assert str(match[0].status) == "failed"

    _run_in_test_session(_run)
