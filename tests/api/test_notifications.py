from __future__ import annotations

import asyncio
import hashlib
from http import HTTPStatus
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from apps.api import models
from apps.api.db import get_db
from apps.api.main import app
from apps.api.routers import notifications as router_mod
from apps.api.services.notifications_service import PushProvider


def test_subscription_save_update_delete(admin_login: TestClient) -> None:
    client = admin_login
    endpoint = "https://example.com/ep/1"
    payload = {
        "endpoint": endpoint,
        "p256dh": "k1",
        "auth": "a1",
        "ua": "pytest",
    }
    # create
    res = client.post("/notifications/subscriptions", json=payload)
    assert res.status_code == HTTPStatus.NO_CONTENT

    # idempotent update
    payload2 = {**payload, "p256dh": "k2"}
    res2 = client.post("/notifications/subscriptions", json=payload2)
    assert res2.status_code == HTTPStatus.NO_CONTENT

    # delete idempotent
    res3 = client.request(
        "DELETE", "/notifications/subscriptions", json={"endpoint": endpoint}
    )
    assert res3.status_code == HTTPStatus.NO_CONTENT
    res4 = client.request(
        "DELETE", "/notifications/subscriptions", json={"endpoint": endpoint}
    )
    assert res4.status_code == HTTPStatus.NO_CONTENT


def test_subscription_save_sets_member_id(member_login: TestClient) -> None:
    client = member_login
    endpoint = "https://example.com/ep/member/1"
    payload = {
        "endpoint": endpoint,
        "p256dh": "k1",
        "auth": "a1",
        "ua": "pytest",
    }

    res = client.post("/notifications/subscriptions", json=payload)
    assert res.status_code == HTTPStatus.NO_CONTENT

    override = app.dependency_overrides.get(get_db)
    assert override is not None

    async def _check() -> None:
        async for db in override():
            m_stmt = select(models.Member).where(
                models.Member.student_id == "member001"
            )
            m = (await db.execute(m_stmt)).scalars().first()
            assert m is not None

            endpoint_hash = hashlib.sha256(endpoint.encode()).hexdigest()
            s_stmt = select(models.PushSubscription).where(
                models.PushSubscription.endpoint_hash == endpoint_hash
            )
            sub = (await db.execute(s_stmt)).scalars().first()
            assert sub is not None
            assert sub.member_id == m.id
            break

    asyncio.run(_check())


class _DummyProvider(PushProvider):
    def __init__(self, fail_every: int = 0) -> None:
        self._i = 0
        self._fail_every = fail_every

    def send(
        self, sub: models.PushSubscription, payload: dict[str, Any]
    ) -> tuple[bool, int | None]:
        self._i += 1
        if self._fail_every and self._i % self._fail_every == 0:
            return (False, 410)
        return (True, 201)

    async def send_async(
        self, sub: models.PushSubscription, payload: dict[str, Any]
    ) -> tuple[bool, int | None]:
        return self.send(sub, payload)


def test_admin_send_uses_provider_and_handles_410(admin_login: TestClient) -> None:
    client = admin_login
    # register two subscriptions
    for i in range(2):
        client.post(
            "/notifications/subscriptions",
            json={
                "endpoint": f"https://example.com/ep/{i}",
                "p256dh": f"k{i}",
                "auth": f"a{i}",
            },
        )

    # override provider to avoid real network (FastAPI dependency override)
    app.dependency_overrides[router_mod.get_push_provider] = lambda: _DummyProvider(
        fail_every=2
    )

    res = client.post(
        "/notifications/admin/notifications/test",
        json={"title": "t", "body": "b", "url": "https://example.com/x"},
    )
    assert res.status_code == HTTPStatus.ACCEPTED
    data = res.json()
    assert data["accepted"] + data["failed"] >= 1

    # fetch stats and logs
    res2 = client.get("/notifications/admin/notifications/stats")
    assert res2.status_code == HTTPStatus.OK
    stats = res2.json()
    assert (
        "active_subscriptions" in stats
        and "recent_accepted" in stats
        and "recent_failed" in stats
    )

    res3 = client.get("/notifications/admin/notifications/logs?limit=10")
    assert res3.status_code == HTTPStatus.OK
    logs = res3.json()
    assert isinstance(logs, list) and len(logs) >= 1
    # clean override
    app.dependency_overrides.pop(router_mod.get_push_provider, None)
