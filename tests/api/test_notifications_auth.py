from __future__ import annotations

from http import HTTPStatus

import httpx
import pytest
from fastapi.testclient import TestClient

from apps.api import models
from apps.api.main import app
from apps.api.routers import notifications as router_mod
from apps.api.services.notifications_service import PushProvider


@pytest.fixture()
def anyio_backend() -> str:  # limit to asyncio to avoid trio dependency
    return "asyncio"


@pytest.fixture()
def anon_client(client: TestClient) -> TestClient:  # alias for readability
    return client


def test_subscription_requires_auth(anon_client: TestClient) -> None:
    # without login, saving a subscription returns 401
    res = anon_client.post(
        "/notifications/subscriptions",
        json={
            "endpoint": "https://example.com/ep/unauth",
            "p256dh": "k",
            "auth": "a",
        },
    )
    assert res.status_code == HTTPStatus.UNAUTHORIZED


def test_subscription_invalid_payload_returns_422(admin_login: TestClient) -> None:
    client = admin_login
    # missing p256dh/auth → 422
    res = client.post(
        "/notifications/subscriptions",
        json={"endpoint": "https://example.com/ep/x"},
    )
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


@pytest.mark.anyio
async def test_admin_send_rate_limit_429(admin_login: TestClient) -> None:
    class _DummyProvider(PushProvider):
        def send(
            self, sub: models.PushSubscription, payload: dict[str, object]
        ) -> tuple[bool, int | None]:
            return (True, 201)

    app.dependency_overrides[router_mod.get_push_provider] = lambda: _DummyProvider()

    # Use httpx ASGITransport to set a non-test client IP so rate limit applies
    transport = httpx.ASGITransport(app=app, client=("1.2.3.4", 55555))
    async with httpx.AsyncClient(transport=transport, base_url="http://local") as hc:
        # login
        rc_login = await hc.post(
            "/auth/login",
            json={"email": "__seed__@example.com", "password": "__seed__"},
        )
        assert rc_login.status_code == HTTPStatus.OK

        # register a subscription under this session
        rs = await hc.post(
            "/notifications/subscriptions",
            json={
                "endpoint": "https://example.com/ep/rl",
                "p256dh": "k",
                "auth": "a",
            },
        )
        assert rs.status_code == HTTPStatus.NO_CONTENT

        payload = {"title": "t", "body": "b"}
        r1 = await hc.post("/notifications/admin/notifications/test", json=payload)
        r2 = await hc.post("/notifications/admin/notifications/test", json=payload)
        assert r1.status_code == HTTPStatus.ACCEPTED
        assert r2.status_code == HTTPStatus.TOO_MANY_REQUESTS

    app.dependency_overrides.pop(router_mod.get_push_provider, None)
