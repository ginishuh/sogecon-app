from __future__ import annotations

from typing import Any, Protocol

class _ResponseLike(Protocol):
    status_code: int

class WebPushException(Exception):
    response: Any

def webpush(
    *,
    subscription_info: dict[str, Any],
    data: str,
    vapid_private_key: str,
    vapid_claims: dict[str, Any],
) -> _ResponseLike: ...

