from __future__ import annotations

from collections.abc import Callable
from ipaddress import ip_address, ip_network
from typing import Protocol, cast

from fastapi import Request
from slowapi import Limiter

from .config import Settings, get_settings


def parse_trusted_proxies(raw: str) -> list[str]:
    """신뢰할 프록시 IP/CIDR 목록 파싱."""
    if not raw:
        return []
    result: list[str] = []
    for part in raw.split(","):
        ip_str = part.strip()
        if not ip_str:
            continue
        try:
            if "/" in ip_str:
                ip_network(ip_str, strict=False)
            else:
                ip_address(ip_str)
            result.append(ip_str)
        except ValueError:
            pass
    return result


def forwarded_allow_ips(raw: str | None = None) -> str:
    """Uvicorn --forwarded-allow-ips 값.

    TRUSTED_PROXY_IPS와 동일한 목록을 쓰고, 비어 있으면 127.0.0.1만 허용한다.
    '*'는 허용하지 않는다.
    """
    value = raw if raw is not None else get_settings().trusted_proxy_ips
    parsed = parse_trusted_proxies(value)
    if not parsed:
        return "127.0.0.1"
    return ",".join(parsed)


def _is_ip_trusted(ip_str: str, trusted_networks: list[str]) -> bool:
    if not trusted_networks:
        return False
    try:
        client_ip = ip_address(ip_str)
    except ValueError:
        return False
    for net_str in trusted_networks:
        try:
            if "/" in net_str:
                if client_ip in ip_network(net_str, strict=False):
                    return True
            elif client_ip == ip_address(net_str):
                return True
        except ValueError:
            pass
    return False


def get_client_ip_for_rate_limit(request: Request) -> str:
    """레이트리밋용 클라이언트 IP 추출.

    X-Forwarded-For 처리 정책:
    1. trusted_proxy_ips 설정이 있고, 직접 연결 IP가 신뢰 목록에 있을 때만 XFF 사용.
    2. XFF가 있으면 우측에서 역순 파싱해 첫 non-trusted hop을 원본 IP로 확정.
    3. 신뢰 체인을 모두 통과하면 XFF 첫 번째(좌측) IP 사용.
    4. 그 외에는 request.client.host 사용.
    """
    settings = get_settings()
    trusted = parse_trusted_proxies(settings.trusted_proxy_ips)

    if request.client and request.client.host:
        direct_ip = request.client.host
    else:
        return "unknown"

    if not _is_ip_trusted(direct_ip, trusted):
        return direct_ip

    xff = request.headers.get("x-forwarded-for", "")
    if not xff:
        return direct_ip

    parts = [p.strip() for p in xff.split(",") if p.strip()]
    if not parts:
        return direct_ip

    for ip_str in reversed(parts):
        if not _is_ip_trusted(ip_str, trusted):
            return ip_str

    return parts[0]


def should_skip_rate_limit() -> bool:
    """테스트 환경에서만 레이트리밋을 건너뛴다."""
    return (get_settings().app_env or "").lower().strip() == "test"


def create_limiter(settings: Settings) -> Limiter:
    """Create a Limiter with default per-IP limits from settings.

    기본값: `RATE_LIMIT_DEFAULT` 환경변수(예: "120/minute").
    """
    return Limiter(
        key_func=get_client_ip_for_rate_limit,
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
    """요청 단위 레이트리밋 토큰 소비.

    동일 (limiter id, path, limit_value) 조합에 대해 데코레이트된 함수를
    한 번만 생성·등록하고 이후에는 캐시된 함수를 재사용하여
    _route_limits 누적에 의한 다중 토큰 차감 버그를 방지합니다.
    """
    if should_skip_rate_limit():
        return

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
