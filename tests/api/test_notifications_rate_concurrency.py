from __future__ import annotations

import asyncio
from http import HTTPStatus

import httpx
import pytest
from fastapi.testclient import TestClient

from apps.api import models
from apps.api.main import app
from apps.api.routers import notifications as router_mod
from apps.api.services.notifications_service import PushProvider


@pytest.fixture()
def anyio_backend() -> str:
    return "asyncio"


class _DummyProvider(PushProvider):
    def send(
        self, sub: models.PushSubscription, payload: dict[str, object]
    ) -> tuple[bool, int | None]:
        return (True, 201)


@pytest.mark.anyio
async def test_admin_send_rate_limit_concurrent(admin_login: TestClient) -> None:
    app.dependency_overrides[router_mod.get_push_provider] = lambda: _DummyProvider()
    try:
        transport = httpx.ASGITransport(app=app, client=("5.6.7.8", 55555))
        async with httpx.AsyncClient(
            transport=transport, base_url="http://local"
        ) as hc:
            rc_login = await hc.post(
                "/auth/login",
                json={"student_id": "__seed__admin", "password": "__seed__"},
            )
            assert rc_login.status_code == HTTPStatus.OK

            # 한 세션에 구독 하나 등록
            rs = await hc.post(
                "/notifications/subscriptions",
                json={
                    "endpoint": "https://example.com/ep/conc",
                    "p256dh": "k",
                    "auth": "a",
                },
            )
            assert rs.status_code == HTTPStatus.NO_CONTENT

            payload = {"title": "t", "body": "b"}

            async def _send() -> int:
                r = await hc.post(
                    "/notifications/admin/notifications/test", json=payload
                )
                return r.status_code

            # 동시 2요청 → 최소 1개는 429(보수적 조건; 둘 다 429도 가능)
            s1, s2 = await asyncio.gather(_send(), _send())
            statuses = [s1, s2]
            assert statuses.count(HTTPStatus.TOO_MANY_REQUESTS) >= 1
            assert statuses.count(HTTPStatus.ACCEPTED) <= 1
    finally:
        app.dependency_overrides.pop(router_mod.get_push_provider, None)
