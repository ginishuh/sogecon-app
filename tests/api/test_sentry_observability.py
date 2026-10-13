from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any

import pytest
import sentry_sdk
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel
from sentry_sdk.envelope import Envelope
from sentry_sdk.transport import Transport
from sqlalchemy import text

from apps.api import observability
from apps.api.config import get_settings
from apps.api.db import create_app_engine
from apps.api.main import unhandled_exception_handler

PHONE = "010-1234-5678"
TOKEN = "act_9f8e7d6c5b4a"
MEMBER_NAME = "홍길동"
EMAIL = "dup-member@example.com"


class _CapturingTransport(Transport):
    def __init__(self) -> None:
        super().__init__()
        self.events: list[dict[str, Any]] = []
        self.transactions: list[dict[str, Any]] = []

    def capture_envelope(self, envelope: Envelope) -> None:
        for item in envelope.items:
            event = item.get_event()
            if event is not None:
                self.events.append(dict(event))
            transaction = item.get_transaction_event()
            if transaction is not None:
                self.transactions.append(dict(transaction))

    def everything(self) -> str:
        # SDK 직렬화는 한글을 \\u 이스케이프하므로 파싱된 이벤트 문자열로 검사한다.
        return repr(self.events) + repr(self.transactions)


@pytest.fixture
def transport(monkeypatch: pytest.MonkeyPatch) -> Iterator[_CapturingTransport]:
    # 셸에 남은 실제 DSN·릴리스가 테스트 클라이언트로 새지 않게 env를 비운다.
    for key in ("SENTRY_DSN", "SENTRY_RELEASE", "SENTRY_ENVIRONMENT"):
        monkeypatch.delenv(key, raising=False)
    captured = _CapturingTransport()
    real_init = sentry_sdk.init

    def init_with_transport(*args: Any, **kwargs: Any) -> Any:
        return real_init(*args, transport=captured, **kwargs)

    monkeypatch.setattr(observability.sentry_sdk, "init", init_with_transport)
    yield captured
    # dsn=""로 다시 init하면 "활성" 클라이언트가 남으므로 전역 클라이언트를 비운다.
    sentry_sdk.get_client().close()
    sentry_sdk.get_global_scope().set_client(None)


def _init(traces_sample_rate: float = 0.0) -> None:
    settings = get_settings().model_copy(
        update={
            "sentry_dsn": "https://key@o0.ingest.sentry.io/1",
            "release": "deploy-tag",
            "sentry_traces_sample_rate": traces_sample_rate,
        }
    )
    observability.init_sentry(settings)


def _test_db_url() -> str:
    return (
        os.environ.get("TEST_DB_URL")
        or os.environ.get("DATABASE_URL")
        or "postgresql+psycopg://app:devpass@localhost:5434/appdb_test"
    )


class _MemberAge(BaseModel):
    age: int


def test_app_import_does_not_start_sentry_from_local_env() -> None:
    # tests/conftest.py가 앱 import 전에 DSN을 비워 셸·`.env`의 실제 DSN을 쓰지 않는다.
    assert not sentry_sdk.get_client().is_active()


def test_unhandled_error_reaches_sentry_without_member_request_body(
    transport: _CapturingTransport,
) -> None:
    _init()
    app = FastAPI()

    @app.post("/boom")
    async def boom(payload: dict[str, str]) -> None:
        raise RuntimeError("boom")

    client = TestClient(app, raise_server_exceptions=False)
    response = client.post("/boom", json={"phone": PHONE, "token": TOKEN})
    sentry_sdk.flush()

    assert response.status_code == 500
    errors = [event for event in transport.events if event.get("exception")]
    assert len(errors) == 1
    event = errors[0]
    assert event["release"] == "deploy-tag"
    assert not event.get("request", {}).get("data")
    assert PHONE not in transport.everything()
    assert TOKEN not in transport.everything()


def test_admin_search_query_and_referer_token_are_masked(
    transport: _CapturingTransport,
) -> None:
    _init(traces_sample_rate=1.0)
    app = FastAPI()

    @app.get("/admin/members")
    async def search(q: str) -> None:
        raise RuntimeError("search failed")

    client = TestClient(app, raise_server_exceptions=False)
    response = client.get(
        "/admin/members",
        params={"q": MEMBER_NAME},
        headers={"Referer": f"https://www.example.com/activate?token={TOKEN}"},
    )
    sentry_sdk.flush()

    assert response.status_code == 500
    assert any(event.get("exception") for event in transport.events)
    assert transport.transactions
    assert MEMBER_NAME not in transport.everything()
    assert TOKEN not in transport.everything()


def test_db_unique_violation_does_not_send_member_email(
    transport: _CapturingTransport,
) -> None:
    _init()
    db_url = _test_db_url()
    app = FastAPI()
    app.add_exception_handler(Exception, unhandled_exception_handler)

    @app.post("/members")
    async def create_member(payload: dict[str, str]) -> None:
        engine = create_app_engine(db_url)
        try:
            async with engine.begin() as conn:
                await conn.execute(
                    text("CREATE TEMP TABLE sentry_member (email text UNIQUE)")
                )
                insert = text("INSERT INTO sentry_member (email) VALUES (:email)")
                await conn.execute(insert, {"email": payload["email"]})
                await conn.execute(insert, {"email": payload["email"]})
        finally:
            await engine.dispose()

    client = TestClient(app, raise_server_exceptions=False)
    response = client.post("/members", json={"email": EMAIL})
    sentry_sdk.flush()

    assert response.status_code == 500
    assert "IntegrityError" in transport.everything()
    assert EMAIL not in transport.everything()


@pytest.mark.parametrize("source", ["service", "response_model"])
def test_validation_error_does_not_send_member_input(
    transport: _CapturingTransport, source: str
) -> None:
    _init()
    app = FastAPI()
    app.add_exception_handler(Exception, unhandled_exception_handler)

    @app.get("/service")
    async def service() -> None:
        _MemberAge.model_validate({"age": PHONE})

    @app.get("/response_model", response_model=_MemberAge)
    async def response_model() -> dict[str, str]:
        return {"age": PHONE}

    client = TestClient(app, raise_server_exceptions=False)
    response = client.get(f"/{source}")
    sentry_sdk.flush()

    assert response.status_code == 500
    assert "ValidationError" in transport.everything()
    assert PHONE not in transport.everything()
