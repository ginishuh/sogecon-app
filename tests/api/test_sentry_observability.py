from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
import sentry_sdk
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sentry_sdk.envelope import Envelope
from sentry_sdk.transport import Transport

from apps.api import observability
from apps.api.config import get_settings

PHONE = "010-1234-5678"
TOKEN = "act_9f8e7d6c5b4a"


class _CapturingTransport(Transport):
    def __init__(self) -> None:
        super().__init__()
        self.events: list[dict[str, Any]] = []

    def capture_envelope(self, envelope: Envelope) -> None:
        for item in envelope.items:
            event = item.get_event()
            if event is not None:
                self.events.append(dict(event))


@pytest.fixture
def transport(monkeypatch: pytest.MonkeyPatch) -> Iterator[_CapturingTransport]:
    captured = _CapturingTransport()
    real_init = sentry_sdk.init

    def init_with_transport(*args: Any, **kwargs: Any) -> Any:
        return real_init(*args, transport=captured, **kwargs)

    monkeypatch.setattr(observability.sentry_sdk, "init", init_with_transport)
    yield captured
    sentry_sdk.get_client().close()
    real_init()


def test_unhandled_error_reaches_sentry_without_member_request_body(
    transport: _CapturingTransport,
) -> None:
    settings = get_settings().model_copy(
        update={
            "sentry_dsn": "https://key@o0.ingest.sentry.io/1",
            "release": "deploy-tag",
        }
    )
    observability.init_sentry(settings)

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
    serialized = repr(event)
    assert PHONE not in serialized
    assert TOKEN not in serialized
