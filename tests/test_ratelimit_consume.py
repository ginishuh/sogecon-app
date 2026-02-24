from __future__ import annotations

from collections.abc import Generator

import pytest
from slowapi import Limiter
from starlette.requests import Request

from apps.api import ratelimit


def _build_request(path: str) -> Request:
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": [],
        "client": ("1.2.3.4", 12345),
        "server": ("testserver", 80),
        "root_path": "",
    }
    return Request(scope)


@pytest.fixture(autouse=True)
def clear_consume_cache() -> Generator[None, None, None]:
    ratelimit._consume_cache.clear()
    yield
    ratelimit._consume_cache.clear()


def test_consume_limit_reuses_decorated_consumer_per_path_and_limit() -> None:
    limiter = Limiter(key_func=lambda request: "1.2.3.4")
    path = "/notifications/admin/notifications/send"
    limit_value = "6/minute"
    route_key = "apps.api.ratelimit.consume_notifications_admin_notifications_send_6_minute"

    for _ in range(6):
        ratelimit.consume_limit(limiter, _build_request(path), limit_value)

    assert len(limiter._route_limits.get(route_key, [])) == 1
    assert len(ratelimit._consume_cache) == 1

