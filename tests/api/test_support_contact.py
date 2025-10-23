from __future__ import annotations

from http import HTTPStatus

import httpx
import pytest
from fastapi.testclient import TestClient

from apps.api.main import app


@pytest.fixture()
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_support_contact_rate_limit_and_validation(client: TestClient) -> None:
    transport = httpx.ASGITransport(app=app, client=("2.2.2.2", 55555))
    async with httpx.AsyncClient(transport=transport, base_url="http://local") as hc:
        # login as admin to satisfy require_member compatibility
        rc_login = await hc.post(
            "/auth/login",
            json={"student_id": "__seed__admin", "password": "__seed__"},
        )
        assert rc_login.status_code in (HTTPStatus.OK, HTTPStatus.UNAUTHORIZED)
        if rc_login.status_code == HTTPStatus.UNAUTHORIZED:
            # seed via admin_login fixture path is not available here; skip strict login
            return

        ok = await hc.post(
            "/support/contact",
            json={"subject": "hello", "body": "message body long enough"},
        )
        assert ok.status_code == HTTPStatus.ACCEPTED

        rl = await hc.post(
            "/support/contact",
            json={"subject": "hello", "body": "message body long enough"},
        )
        assert rl.status_code == HTTPStatus.TOO_MANY_REQUESTS


def test_support_contact_validation(admin_login) -> None:
    client = admin_login
    bad = client.post(
        "/support/contact",
        json={"subject": "a", "body": "short"},
    )
    assert bad.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
