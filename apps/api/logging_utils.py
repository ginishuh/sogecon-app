from __future__ import annotations

import json
import logging
from collections.abc import Mapping, MutableMapping
from contextvars import ContextVar, Token
from datetime import UTC, datetime
from typing import TYPE_CHECKING, cast

from sentry_sdk import capture_event, is_initialized

if TYPE_CHECKING:
    from sentry_sdk._types import Event
else:
    Event = MutableMapping[str, object]

_request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


def set_request_id(value: str) -> Token[str | None]:
    """요청 컨텍스트에 request_id를 설정하고 토큰을 반환한다."""
    return _request_id_ctx.set(value)


def reset_request_id(token: Token[str | None]) -> None:
    """요청 컨텍스트에서 request_id 토큰을 원복한다."""
    _request_id_ctx.reset(token)


def get_request_id() -> str | None:
    """현재 컨텍스트의 request_id를 반환한다."""
    return _request_id_ctx.get()


def log_json(
    logger: logging.Logger,
    level: int,
    message: str,
    **fields: object,
) -> None:
    """JSON Lines 포맷으로 로그를 출력한다."""
    record: dict[str, object] = {
        "timestamp": datetime.now(UTC).isoformat(),
        "level": logging.getLevelName(level).lower(),
        "message": message,
        **fields,
    }
    request_id = get_request_id()
    if request_id and "request_id" not in record:
        record["request_id"] = request_id
    payload = json.dumps(
        record, ensure_ascii=False, separators=(",", ":"), default=str
    )
    logger.log(level, payload)


def emit_error_event(event: Mapping[str, object]) -> None:
    """외부 에러 알림 연동(Sentry). DSN 미설정 시 No-op."""
    event_payload = dict(event)
    # level 키가 있으면 제거하여 log_json의 level 파라미터와 충돌 방지
    event_payload.pop("level", None)
    log_json(
        logging.getLogger("apps.api.error_event"),
        logging.DEBUG,
        "error_event",
        **event_payload,
    )

    if not is_initialized():
        return

    tag_sources = {
        "request_id": "request_id",
        "method": "http.method",
        "path": "http.path",
    }
    tags: dict[str, str] = {}
    for source_key, tag_key in tag_sources.items():
        value = event_payload.get(source_key)
        if value is not None:
            tags[tag_key] = str(value)

    extra_fields = {
        key: event_payload[key]
        for key in ("code", "status")
        if key in event_payload
    }

    message = event_payload.get("detail") or event_payload.get("error") or "api_error"
    level = str(event_payload.get("level", "error"))

    sentry_payload: dict[str, object] = {
        "message": str(message),
        "level": level,
        "tags": tags,
    }
    if extra_fields:
        sentry_payload["extra"] = extra_fields

    capture_event(cast(Event, sentry_payload))
