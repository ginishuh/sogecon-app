from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(default="sqlite:///./dev.sqlite3", alias="DATABASE_URL")
    app_env: str = Field(default="dev", alias="APP_ENV")
    release: str = Field(default="", alias="RELEASE")
    jwt_secret: str = Field(default="change-me", alias="JWT_SECRET")
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        alias="CORS_ORIGINS",
    )
    # Rate limiting (SlowAPI) — default per-IP limit
    rate_limit_default: str = Field(default="120/minute", alias="RATE_LIMIT_DEFAULT")
    rate_limit_login: str = Field(default="5/minute", alias="RATE_LIMIT_LOGIN")
    rate_limit_notify_test: str = Field(
        default="1/minute", alias="RATE_LIMIT_NOTIFY_TEST"
    )
    rate_limit_support: str = Field(default="1/minute", alias="RATE_LIMIT_SUPPORT")
    rate_limit_subscribe: str = Field(
        default="30/minute", alias="RATE_LIMIT_SUBSCRIBE"
    )
    rate_limit_post_create: str = Field(
        default="5/minute", alias="RATE_LIMIT_POST_CREATE"
    )

    # Web Push (VAPID)
    vapid_public_key: str = Field(default="", alias="VAPID_PUBLIC_KEY")
    vapid_private_key: str = Field(default="", alias="VAPID_PRIVATE_KEY")
    vapid_subject: str = Field(
        default="mailto:security@trr.co.kr", alias="VAPID_SUBJECT"
    )
    # Web Push encryption at rest
    push_encrypt_at_rest: bool = Field(default=False, alias="PUSH_ENCRYPT_AT_REST")
    push_kek: str = Field(default="", alias="PUSH_KEK")  # base64 32 bytes

    # Media/Uploads
    media_root: str = Field(default="uploads", alias="MEDIA_ROOT")
    media_url_base: str = Field(default="/media", alias="MEDIA_URL_BASE")
    avatar_max_bytes: int = Field(default=100_000, alias="AVATAR_MAX_BYTES")
    avatar_max_upload_bytes: int = Field(
        default=2_000_000, alias="AVATAR_MAX_UPLOAD_BYTES"
    )
    avatar_max_pixels: int = Field(default=512, alias="AVATAR_MAX_PIXELS")

    # Observability / Sentry
    sentry_dsn: str = Field(default="", alias="SENTRY_DSN")
    sentry_traces_sample_rate: float | None = Field(
        default=None, alias="SENTRY_TRACES_SAMPLE_RATE"
    )
    sentry_profiles_sample_rate: float | None = Field(
        default=None, alias="SENTRY_PROFILES_SAMPLE_RATE"
    )
    sentry_send_default_pii: bool = Field(
        default=False, alias="SENTRY_SEND_DEFAULT_PII"
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def reset_settings_cache() -> None:
    """설정 캐시(lru_cache) 초기화.

    테스트 등에서 환경변수 기반 설정을 재적용할 때 사용합니다.
    정적 타입 검사 우회를 피하기 위해 동적 속성 접근을 사용합니다.
    """
    cache_clear = getattr(get_settings, "cache_clear", None)
    if callable(cache_clear):
        cache_clear()
