from __future__ import annotations

from http import HTTPStatus

import httpx
import pytest
from fastapi.testclient import TestClient

from apps.api.main import app
from apps.api.routers import notifications as router_mod
from apps.api.services.notifications_service import PushProvider


@pytest.fixture()
def anyio_backend() -> str:
    return "asyncio"


def test_http_exception_separates_code_and_user_detail(
    member_login: TestClient,
) -> None:
    res = member_login.get("/admin/signup-requests")
    assert res.status_code == HTTPStatus.FORBIDDEN
    data = res.json()
    assert data["status"] == HTTPStatus.FORBIDDEN
    assert data["code"] == "admin_permission_required"
    assert data["detail"] == "이 작업을 수행할 운영 권한이 없습니다."
    assert data["detail"] != data["code"]
    assert data["type"] == "about:blank"


def test_framework_not_found_returns_problem_details(client: TestClient) -> None:
    res = client.get("/this-route-does-not-exist-d9")
    assert res.status_code == HTTPStatus.NOT_FOUND
    data = res.json()
    assert data["code"] == "not_found"
    assert isinstance(data["detail"], str)
    assert data["detail"] != "not_found"
    assert data["status"] == HTTPStatus.NOT_FOUND


def test_validation_error_uses_string_detail_and_errors_extension(
    admin_login: TestClient,
) -> None:
    e = admin_login.post(
        "/events/",
        json={
            "title": "Seminar",
            "starts_at": "2030-03-01T10:00:00Z",
            "ends_at": "2030-03-01T12:00:00Z",
            "location": "Seoul",
            "capacity": 10,
        },
    ).json()

    res = admin_login.post(f"/events/{e['id']}/rsvp", json={"status": "invalid"})
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    data = res.json()
    assert data["code"] == "validation_error"
    assert isinstance(data["detail"], str)
    assert data["detail"] == "입력값을 확인해 주세요."
    assert isinstance(data["errors"], list)
    assert data["errors"]


def test_validation_error_serializes_value_error_ctx(
    client: TestClient,
) -> None:
    res = client.post(
        "/auth/member/signup",
        json={
            "student_id": "s119001",
            "email": "s119001@test.example.com",
            "name": "전화검증",
            "cohort": 2024,
            "phone": "bad-phone",
        },
    )
    assert res.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    data = res.json()
    assert data["code"] == "validation_error"
    assert isinstance(data["detail"], str)
    assert isinstance(data["errors"], list)
    for item in data["errors"]:
        ctx = item.get("ctx")
        if ctx is not None:
            assert all(isinstance(v, str) for v in ctx.values())


@pytest.mark.anyio
async def test_rate_limit_returns_problem_details(
    admin_login: TestClient,
    enable_rate_limit: None,
) -> None:
    class _DummyProvider(PushProvider):
        def send(self, sub, payload):  # type: ignore[no-untyped-def]
            return (True, 201)

        async def send_async(self, sub, payload):  # type: ignore[no-untyped-def]
            return (True, 201)

    def _provider_override() -> _DummyProvider:
        return _DummyProvider()

    app.dependency_overrides[router_mod.get_push_provider] = _provider_override
    try:
        transport = httpx.ASGITransport(app=app, client=("1.2.3.4", 55555))
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://local",
        ) as hc:
            login_res = await hc.post(
                "/auth/login",
                json={"student_id": "__seed__admin", "password": "__seed__"},
            )
            assert login_res.status_code == HTTPStatus.OK
            sub_res = await hc.post(
                "/notifications/subscriptions",
                json={
                    "endpoint": "https://example.com/ep/rl-d9",
                    "p256dh": "k",
                    "auth": "a",
                },
            )
            assert sub_res.status_code == HTTPStatus.NO_CONTENT
            limited_body: dict[str, object] | None = None
            for _ in range(8):
                response = await hc.post(
                    "/notifications/admin/notifications/send",
                    json={"title": "t", "body": "b"},
                )
                if response.status_code == HTTPStatus.TOO_MANY_REQUESTS:
                    limited_body = response.json()
                    break
            assert limited_body is not None
            assert limited_body["code"] == "rate_limit_exceeded"
            assert limited_body["status"] == HTTPStatus.TOO_MANY_REQUESTS
            assert isinstance(limited_body["detail"], str)
            assert limited_body["detail"] != limited_body["code"]
    finally:
        app.dependency_overrides.pop(router_mod.get_push_provider, None)
