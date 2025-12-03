from functools import lru_cache

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 데이터베이스: 무조건 PostgreSQL(psycopg 드라이버)만 지원
    # 개발 기본값은 루트 compose dev 프로필의 포트 5433 기준
    database_url: str = Field(
        default="postgresql+psycopg://app:devpass@localhost:5433/appdb",
        alias="DATABASE_URL",
    )
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
    # 이미지 업로드 (게시글 커버 등)
    image_max_upload_bytes: int = Field(
        default=5_000_000, alias="IMAGE_MAX_UPLOAD_BYTES"
    )  # 5MB
    image_max_pixels: int = Field(default=1920, alias="IMAGE_MAX_PIXELS")

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

    # Session/Cookie 설정 (크로스 도메인 전환 대비)
    # - COOKIE_SAMESITE: 'lax' | 'strict' | 'none' (기본 'lax')
    #   별도 도메인 전환 시 교차 사이트 쿠키를 위해 'none' 권장
    #   (HTTPS 필요)
    # - COOKIE_SECURE: true/false (기본: APP_ENV == 'prod')
    # - COOKIE_DOMAIN: 특정 도메인으로 범위를 제한(기본 None=호스트 전용)
    cookie_same_site: str = Field(default="lax", alias="COOKIE_SAMESITE")
    cookie_secure: bool | None = Field(default=None, alias="COOKIE_SECURE")
    cookie_domain: str | None = Field(default=None, alias="COOKIE_DOMAIN")
    # 세션 만료 시간 (초). 기본 7일. 0이면 브라우저 세션 쿠키.
    session_max_age: int = Field(default=604800, alias="SESSION_MAX_AGE")

    # --- Validators ---
    @field_validator("cookie_same_site")
    @classmethod
    def _validate_same_site(cls, v: str) -> str:
        vv = (v or "").strip().lower() or "lax"
        if vv not in {"lax", "strict", "none"}:
            raise ValueError("COOKIE_SAMESITE must be lax, strict, or none")
        return vv

    @field_validator("jwt_secret")
    @classmethod
    def _normalize_jwt_secret(cls, v: str) -> str:
        return (v or "").strip()

    @model_validator(mode="after")
    def _validate_prod_only(self) -> "Settings":
        # Enforce strong JWT secret only in prod deployments.
        if (self.app_env or "dev").lower().strip() == "prod":
            MIN_LEN = 32
            if (
                self.jwt_secret in {"change-me", "change-me-to-a-strong-secret", ""}
                or len(self.jwt_secret) < MIN_LEN
            ):
                msg = (
                    "JWT_SECRET must be strong ("
                    f"{MIN_LEN}+ chars) and not a placeholder"
                )
                raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def _enforce_postgres_only(self) -> "Settings":
        """SQLite 등 비-PostgreSQL 백엔드를 금지한다.

        운영/개발 공통 정책: 연결 문자열은 반드시
        `postgresql+psycopg://` 스킴을 사용해야 한다.
        """
        url = (self.database_url or "").strip()
        required_prefix = "postgresql+psycopg://"
        if not url.lower().startswith(required_prefix):
            raise ValueError(
                "DATABASE_URL must use PostgreSQL (psycopg) — e.g., "
                "postgresql+psycopg://USER:PASS@HOST:5432/DB"
            )
        return self


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
