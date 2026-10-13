from __future__ import annotations

import sentry_sdk
from sentry_sdk.integrations.starlette import StarletteIntegration

from .config import Settings

_DEFAULT_TRACE_SAMPLE_RATE = 0.05
_DEFAULT_PROFILE_SAMPLE_RATE = 0.0


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

    # Avoid duplicate initialization in tests by checking existing client
    if sentry_sdk.Hub.current.client is not None:
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
        release=release_value,
        traces_sample_rate=sample_rate,
        profiles_sample_rate=profile_rate,
    )
