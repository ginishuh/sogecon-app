from __future__ import annotations

from http import HTTPStatus

from fastapi.testclient import TestClient

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


class _DummyProvider(PushProvider):
    def __init__(self, fail_every: int = 0) -> None:
        self._i = 0
        self._fail_every = fail_every

    def send(self, sub, payload):  # type: ignore[override]
        self._i += 1
        if self._fail_every and self._i % self._fail_every == 0:
            return (False, 410)
        return (True, 201)


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

    # override provider to avoid real network
    router_mod.get_push_provider = lambda: _DummyProvider(fail_every=2)  # type: ignore[assignment]

    res = client.post(
        "/notifications/admin/notifications/test", json={"title": "t", "body": "b"}
    )
    assert res.status_code == HTTPStatus.ACCEPTED
    data = res.json()
    assert data["accepted"] + data["failed"] >= 1
