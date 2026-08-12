from __future__ import annotations

import json
from http import HTTPStatus

import httpx
import pytest
from fastapi.testclient import TestClient
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request

from apps.api import models
from apps.api.error_messages import (
    USER_FACING_DETAILS,
    code_and_detail_from_http_detail,
)
from apps.api.main import _handle_http_exception, app
from apps.api.routers import notifications as router_mod
from apps.api.routers.auth import require_member
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


def test_openapi_operations_reference_problem_details_errors() -> None:
    schema = app.openapi()
    paths = schema.get("paths")
    assert isinstance(paths, dict)
    problem_ref = "#/components/responses/ProblemDetailsError"
    checked = 0
    for path_item in paths.values():
        if not isinstance(path_item, dict):
            continue
        for method, operation in path_item.items():
            if method not in {
                "get",
                "post",
                "put",
                "patch",
                "delete",
                "options",
                "head",
                "trace",
            }:
                continue
            if not isinstance(operation, dict):
                continue
            responses = operation.get("responses")
            assert isinstance(responses, dict)
            for status in ("400", "401", "403", "404", "409", "422", "429", "500"):
                assert responses.get(status) == {"$ref": problem_ref}
            assert "HTTPValidationError" not in json.dumps(responses)
            checked += 1
    assert checked > 0


def test_code_and_detail_masks_internal_http_500_text() -> None:
    code, detail = code_and_detail_from_http_detail(
        "Member ID is None",
        status=HTTPStatus.INTERNAL_SERVER_ERROR,
    )
    assert code == "internal_error"
    assert detail == USER_FACING_DETAILS["internal_error"]
    assert "Member" not in detail


@pytest.mark.anyio
async def test_http_exception_500_masks_internal_detail_and_request_id() -> None:
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/comments/1",
            "headers": [],
            "query_string": b"",
            "server": ("testserver", 80),
            "client": ("testclient", 50000),
            "scheme": "http",
            "http_version": "1.1",
        }
    )
    request.state.request_id = "req-d9-http-500"
    response = await _handle_http_exception(
        request,
        StarletteHTTPException(HTTPStatus.INTERNAL_SERVER_ERROR, "Member ID is None"),
    )
    body = json.loads(response.body)
    assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert body["code"] == "internal_error"
    assert body["detail"] == USER_FACING_DETAILS["internal_error"]
    assert body["request_id"] == "req-d9-http-500"
    assert response.headers["x-request-id"] == "req-d9-http-500"
    assert "Member" not in body["detail"]


def test_api_error_500_masks_internal_code_and_request_id(
    member_login: TestClient,
) -> None:
    async def _member_without_id() -> models.Member:
        return models.Member(
            id=None,
            student_id="ghost-member",
            email="ghost@test.example.com",
            name="Ghost",
            cohort=2024,
            roles="member",
            status="active",
        )

    app.dependency_overrides[require_member] = _member_without_id
    try:
        res = member_login.patch(
            "/board/posts/1",
            json={"title": "t", "content": "c"},
        )
        assert res.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
        data = res.json()
        assert data["code"] == "internal_error"
        assert data["detail"] == USER_FACING_DETAILS["internal_error"]
        assert "member_id_missing" not in json.dumps(data)
        request_id = res.headers.get("x-request-id")
        assert request_id
        assert data["request_id"] == request_id
    finally:
        app.dependency_overrides.pop(require_member, None)


@pytest.mark.anyio
async def test_rate_limit_returns_problem_details(
    admin_login: TestClient,
    enable_rate_limit: None,
) -> None:
    class _DummyProvider(PushProvider):
        def send(
            self, sub: models.PushSubscription, payload: dict[str, object]
        ) -> tuple[bool, int | None]:
            return (True, 201)

        async def send_async(
            self, sub: models.PushSubscription, payload: dict[str, object]
        ) -> tuple[bool, int | None]:
            return self.send(sub, payload)

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
