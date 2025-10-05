from __future__ import annotations

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
