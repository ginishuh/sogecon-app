from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

import pytest
from pydantic import ValidationError
from starlette.requests import Request

from apps.api.config import (
    Settings,
    get_settings,
    is_jwt_placeholder,
    reset_settings_cache,
)
from apps.api.ratelimit import (
    forwarded_allow_ips,
    get_client_ip_for_rate_limit,
    should_skip_rate_limit,
)

_PG = "postgresql+psycopg://app:devpass@localhost:5434/appdb_test"
_STRONG_JWT = "d2-test-strong-jwt-secret-32chars-min"
_REPO_ROOT = Path(__file__).resolve().parents[2]


def _request(host: str, xff: str | None = None) -> Request:
    headers: list[tuple[bytes, bytes]] = []
    if xff is not None:
        headers.append((b"x-forwarded-for", xff.encode("latin-1")))
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": headers,
        "client": (host, 12345),
        "server": ("testserver", 80),
    }
    return Request(scope)


@pytest.fixture()
def _restore_settings() -> Generator[None, None, None]:
    yield
    reset_settings_cache()


def test_untrusted_direct_connection_ignores_spoofed_xff(
    monkeypatch: pytest.MonkeyPatch, _restore_settings: None
) -> None:
    monkeypatch.setenv("TRUSTED_PROXY_IPS", "10.0.0.1")
    reset_settings_cache()
    req = _request("203.0.113.10", xff="198.51.100.1, 10.0.0.1")
    assert get_client_ip_for_rate_limit(req) == "203.0.113.10"


def test_trusted_proxy_extracts_original_client_ip(
    monkeypatch: pytest.MonkeyPatch, _restore_settings: None
) -> None:
    monkeypatch.setenv("TRUSTED_PROXY_IPS", "10.0.0.1")
    reset_settings_cache()
    req = _request("10.0.0.1", xff="198.51.100.7")
    assert get_client_ip_for_rate_limit(req) == "198.51.100.7"


def test_testclient_host_does_not_skip_outside_test_env(
    monkeypatch: pytest.MonkeyPatch, _restore_settings: None
) -> None:
    for env in ("dev", "staging", "prod"):
        monkeypatch.setenv("APP_ENV", env)
        monkeypatch.setenv("JWT_SECRET", _STRONG_JWT)
        monkeypatch.setenv("DATABASE_URL", _PG)
        reset_settings_cache()
        assert should_skip_rate_limit() is False
        # host 문자열은 더 이상 스킵 근거가 아니다
        assert get_client_ip_for_rate_limit(_request("testclient")) == "testclient"


def test_should_skip_only_when_app_env_test(
    monkeypatch: pytest.MonkeyPatch, _restore_settings: None
) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", _PG)
    reset_settings_cache()
    assert should_skip_rate_limit() is True
    assert get_settings().app_env == "test"


@pytest.mark.parametrize("env", ["staging", "prod"])
def test_production_like_rejects_weak_jwt(
    env: str, monkeypatch: pytest.MonkeyPatch, _restore_settings: None
) -> None:
    monkeypatch.setenv("APP_ENV", env)
    monkeypatch.setenv("JWT_SECRET", "change-me")
    monkeypatch.setenv("DATABASE_URL", _PG)
    reset_settings_cache()
    with pytest.raises(ValidationError):
        Settings()


@pytest.mark.parametrize(
    "secret",
    [
        "change-me-to-a-strong-secret",
        "change-me-extra-long-but-still-placeholder!!",
        "REPLACE_ME_WITH_OPENSSL_RAND_BASE64_32B_MIN",
        "replace-me-please-use-openssl-rand-base64",
        "",
    ],
)
@pytest.mark.parametrize("env", ["staging", "prod"])
def test_production_like_rejects_placeholder_jwt_patterns(
    env: str, secret: str, monkeypatch: pytest.MonkeyPatch, _restore_settings: None
) -> None:
    assert is_jwt_placeholder(secret) or len(secret) < 32 or secret == ""
    monkeypatch.setenv("APP_ENV", env)
    monkeypatch.setenv("JWT_SECRET", secret)
    monkeypatch.setenv("DATABASE_URL", _PG)
    reset_settings_cache()
    with pytest.raises(ValidationError):
        Settings()


def test_env_api_example_jwt_placeholder_rejected_in_prod(
    monkeypatch: pytest.MonkeyPatch, _restore_settings: None
) -> None:
    """`.env.api.example`의 JWT_SECRET 값은 staging/prod에서 거부되어야 한다."""
    example = (_REPO_ROOT / ".env.api.example").read_text(encoding="utf-8")
    jwt_line = next(
        line for line in example.splitlines() if line.startswith("JWT_SECRET=")
    )
    example_secret = jwt_line.split("=", 1)[1]
    assert is_jwt_placeholder(example_secret)
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("JWT_SECRET", example_secret)
    monkeypatch.setenv("DATABASE_URL", _PG)
    reset_settings_cache()
    with pytest.raises(ValidationError):
        Settings()


def test_unknown_app_env_fail_closed(
    monkeypatch: pytest.MonkeyPatch, _restore_settings: None
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", _STRONG_JWT)
    monkeypatch.setenv("DATABASE_URL", _PG)
    reset_settings_cache()
    with pytest.raises(ValidationError):
        Settings()


@pytest.mark.parametrize("empty", ["", "   "])
def test_empty_app_env_fail_closed(
    empty: str, monkeypatch: pytest.MonkeyPatch, _restore_settings: None
) -> None:
    monkeypatch.setenv("APP_ENV", empty)
    monkeypatch.setenv("JWT_SECRET", _STRONG_JWT)
    monkeypatch.setenv("DATABASE_URL", _PG)
    reset_settings_cache()
    with pytest.raises(ValidationError):
        Settings()


def test_dev_and_test_accept_weak_jwt_fixture(
    monkeypatch: pytest.MonkeyPatch, _restore_settings: None
) -> None:
    for env in ("dev", "test"):
        monkeypatch.setenv("APP_ENV", env)
        monkeypatch.setenv("JWT_SECRET", "change-me")
        monkeypatch.setenv("DATABASE_URL", _PG)
        reset_settings_cache()
        settings = Settings()
        assert settings.app_env == env
        assert settings.jwt_secret == "change-me"


def test_forwarded_allow_ips_defaults_and_never_star(
    monkeypatch: pytest.MonkeyPatch, _restore_settings: None
) -> None:
    monkeypatch.setenv("TRUSTED_PROXY_IPS", "")
    reset_settings_cache()
    assert forwarded_allow_ips() == "127.0.0.1"
    assert forwarded_allow_ips("10.0.0.1, 10.0.0.2") == "10.0.0.1,10.0.0.2"
    # '*' 단독 입력은 파서에서 무시되어 기본값으로 떨어진다
    assert forwarded_allow_ips("*") == "127.0.0.1"


def test_invalid_trusted_proxy_ips_fail_closed(
    monkeypatch: pytest.MonkeyPatch, _restore_settings: None
) -> None:
    monkeypatch.setenv("APP_ENV", "dev")
    monkeypatch.setenv("DATABASE_URL", _PG)
    monkeypatch.setenv("TRUSTED_PROXY_IPS", "not-an-ip")
    reset_settings_cache()
    with pytest.raises(ValidationError):
        Settings()


@pytest.mark.parametrize("env", ["staging", "prod"])
@pytest.mark.parametrize(
    ("upload", "pixels"),
    [
        (0, 1920),
        (-1, 1920),
        (5_000_000, 0),
        (5_000_000, -10),
        (50_000_001, 1920),
        (5_000_000, 10_001),
    ],
)
def test_production_like_rejects_bad_image_limits(
    env: str,
    upload: int,
    pixels: int,
    monkeypatch: pytest.MonkeyPatch,
    _restore_settings: None,
) -> None:
    monkeypatch.setenv("APP_ENV", env)
    monkeypatch.setenv("JWT_SECRET", _STRONG_JWT)
    monkeypatch.setenv("DATABASE_URL", _PG)
    monkeypatch.setenv("IMAGE_MAX_UPLOAD_BYTES", str(upload))
    monkeypatch.setenv("IMAGE_MAX_PIXELS", str(pixels))
    reset_settings_cache()
    with pytest.raises(ValidationError):
        Settings()


def test_dev_rejects_non_positive_image_limits(
    monkeypatch: pytest.MonkeyPatch, _restore_settings: None
) -> None:
    monkeypatch.setenv("APP_ENV", "dev")
    monkeypatch.setenv("DATABASE_URL", _PG)
    monkeypatch.setenv("IMAGE_MAX_UPLOAD_BYTES", "0")
    monkeypatch.setenv("IMAGE_MAX_PIXELS", "1920")
    reset_settings_cache()
    with pytest.raises(ValidationError):
        Settings()
