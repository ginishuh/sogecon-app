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


# 데코레이트된 함수 캐시: limiter.limit() 재등록으로 인한 _route_limits 누적 방지
_consume_cache: dict[str, Callable[[Request], None]] = {}


def consume_limit(limiter: Limiter, request: Request, limit_value: str) -> None:
    """요청 단위 레이트리밋 토큰 소비(테스트 클라이언트 분기에서 활용).

    동일 (limiter id, path, limit_value) 조합에 대해 데코레이트된 함수를
    한 번만 생성·등록하고 이후에는 캐시된 함수를 재사용하여
    _route_limits 누적에 의한 다중 토큰 차감 버그를 방지합니다.
    """
    path_key = request.url.path.strip("/").replace("/", "_") or "root"
    limit_key = (
        limit_value.replace("/", "_").replace(" ", "").replace("-", "_").lower()
    )
    cache_key = f"{id(limiter)}:{path_key}:{limit_key}"

    if cache_key not in _consume_cache:

        def _consume(request: Request) -> None:
            return None

        _consume.__name__ = f"consume_{path_key}_{limit_key}"
        limiter_typed: _LimiterProto = cast(_LimiterProto, limiter)
        _consume_cache[cache_key] = limiter_typed.limit(limit_value)(_consume)

    _consume_cache[cache_key](request)
