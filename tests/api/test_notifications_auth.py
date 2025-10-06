from __future__ import annotations

from http import HTTPStatus

import pytest
from fastapi.testclient import TestClient


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
