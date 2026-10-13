from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

import sentry_sdk
from sentry_sdk.integrations.starlette import StarletteIntegration

from .config import Settings
from .logging_utils import SENSITIVE_EXCEPTION_MODULES

if TYPE_CHECKING:
    from sentry_sdk._types import Event, Hint

_DEFAULT_TRACE_SAMPLE_RATE = 0.05
_DEFAULT_PROFILE_SAMPLE_RATE = 0.0
_FILTERED = "[Filtered]"
_URL_KEYS = frozenset({"url", "http.url", "url.full"})
_QUERY_KEYS = frozenset({"query_string", "http.query", "url.query"})


def _scrub_query(query: str) -> str:
    if not query:
        return query
    pairs: list[str] = []
    for pair in query.split("&"):
        key, separator, _ = pair.partition("=")
        pairs.append(f"{key}={_FILTERED}" if separator else _FILTERED)
    return "&".join(pairs)


def scrub_url(value: str) -> str:
    """관리자 회원 검색(`?q=`)처럼 쿼리에 회원 정보가 실리므로 모든 쿼리 값을 가린다."""
    base, separator, rest = value.partition("?")
    if not separator:
        return value
    query, hash_separator, fragment = rest.partition("#")
    return f"{base}?{_scrub_query(query)}{hash_separator}{fragment}"


def _mapping(value: object) -> dict[str, Any] | None:
    return cast(dict[str, Any], value) if isinstance(value, dict) else None


def _items(value: object) -> list[Any]:
    return cast(list[Any], value) if isinstance(value, list) else []


def _scrub_mapping(data: dict[str, Any] | None) -> None:
    if data is None:
        return
    for key, value in data.items():
        if not isinstance(value, str):
            continue
        lowered = key.lower()
        if lowered in _QUERY_KEYS:
            data[key] = _scrub_query(value)
        elif lowered in _URL_KEYS or lowered == "referer":
            data[key] = scrub_url(value)


def _scrub_request(event: dict[str, Any]) -> None:
    request = _mapping(event.get("request"))
    if request is None:
        return
    if request.get("query_string"):
        request["query_string"] = _FILTERED
    url = request.get("url")
    if isinstance(url, str):
        request["url"] = scrub_url(url)
    _scrub_mapping(_mapping(request.get("headers")))


def _scrub_sensitive_exception_values(event: dict[str, Any]) -> None:
    exception = _mapping(event.get("exception")) or {}
    for item in _items(exception.get("values")):
        value = _mapping(item)
        # DB 드라이버 상세(`Key (email)=(...)`)는 hide_parameters로도, 검증 오류의
        # `input_value=...`는 본문 차단으로도 가려지지 않는다.
        module = str((value or {}).get("module") or "")
        if value is not None and module.startswith(SENSITIVE_EXCEPTION_MODULES):
            value["value"] = _FILTERED


def _scrub_breadcrumbs(event: dict[str, Any]) -> None:
    breadcrumbs = _mapping(event.get("breadcrumbs")) or {}
    for crumb in _items(breadcrumbs.get("values")):
        _scrub_mapping(_mapping((_mapping(crumb) or {}).get("data")))


def _before_send(event: Event, hint: Hint) -> Event:
    data = cast(dict[str, Any], event)
    _scrub_request(data)
    _scrub_sensitive_exception_values(data)
    _scrub_breadcrumbs(data)
    return event


def _before_send_transaction(event: Event, hint: Hint) -> Event:
    data = cast(dict[str, Any], event)
    _scrub_request(data)
    transaction = data.get("transaction")
    if isinstance(transaction, str):
        data["transaction"] = scrub_url(transaction)
    for span in _items(data.get("spans")):
        _scrub_mapping(_mapping((_mapping(span) or {}).get("data")))
    return event


def init_sentry(settings: Settings) -> None:
    """Sentry를 초기화한다(DSN이 없으면 동작하지 않는다)."""
    dsn = settings.sentry_dsn.strip()
    if not dsn:
        return

    integrations = [StarletteIntegration(transaction_style="endpoint")]

    sample_rate = (
        settings.sentry_traces_sample_rate
        if settings.sentry_traces_sample_rate is not None
        else _DEFAULT_TRACE_SAMPLE_RATE
    )
    profile_rate: float | None
    if settings.sentry_profiles_sample_rate is not None:
        profile_rate = settings.sentry_profiles_sample_rate
    elif sample_rate > 0:
        profile_rate = _DEFAULT_PROFILE_SAMPLE_RATE
    else:
        profile_rate = None

    release_value: str | None = settings.release or None

    # 이미 활성 클라이언트가 있으면 다시 초기화하지 않는다.
    if sentry_sdk.get_client().is_active():
        return

    sentry_sdk.init(
        dsn=dsn,
        environment=settings.app_env,
        integrations=integrations,
        send_default_pii=settings.sentry_send_default_pii,
        # 요청 본문과 스택 지역 변수에는 연락처·비밀번호·활성화 토큰 같은 회원 정보가
        # 그대로 들어 있어 보내지 않는다. 기본 스크러버는 중첩 값까지 가리지 못한다.
        max_request_body_size="never",
        include_local_variables=False,
        before_send=_before_send,
        before_send_transaction=_before_send_transaction,
        release=release_value,
        traces_sample_rate=sample_rate,
        profiles_sample_rate=profile_rate,
    )
