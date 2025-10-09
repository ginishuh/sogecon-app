from __future__ import annotations

from collections.abc import Callable
from typing import Protocol, cast

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import Settings


def create_limiter(settings: Settings) -> Limiter:
    """Create a Limiter with default per-IP limits from settings.

    기본값: `RATE_LIMIT_DEFAULT` 환경변수(예: "120/minute").
    """
    return Limiter(
        key_func=get_remote_address,
        default_limits=[settings.rate_limit_default],
    )


class _LimiterProto(Protocol):
    def limit(
        self, limit_value: str
    ) -> Callable[[Callable[[Request], None]], Callable[[Request], None]]:
        ...


def consume_limit(limiter: Limiter, request: Request, limit_value: str) -> None:
    """요청 단위 레이트리밋 토큰 소비(테스트 클라이언트 분기에서 활용)."""

    def _consume(request: Request) -> None:
        return None

    path_key = request.url.path.strip("/").replace("/", "_") or "root"
    limit_key = (
        limit_value.replace("/", "_").replace(" ", "").replace("-", "_").lower()
    )
    _consume.__name__ = f"consume_{path_key}_{limit_key}"

    limiter_typed: _LimiterProto = cast(_LimiterProto, limiter)
    limiter_typed.limit(limit_value)(_consume)(request)
