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
    jwt_secret: str = Field(default="change-me", alias="JWT_SECRET")
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        alias="CORS_ORIGINS",
    )
    # Rate limiting (SlowAPI) — default per-IP limit
    rate_limit_default: str = Field(default="120/minute", alias="RATE_LIMIT_DEFAULT")

    # Web Push (VAPID)
    vapid_public_key: str = Field(default="", alias="VAPID_PUBLIC_KEY")
    vapid_private_key: str = Field(default="", alias="VAPID_PRIVATE_KEY")
    vapid_subject: str = Field(
        default="mailto:security@trr.co.kr", alias="VAPID_SUBJECT"
    )
    # Web Push encryption at rest
    push_encrypt_at_rest: bool = Field(default=False, alias="PUSH_ENCRYPT_AT_REST")
    push_kek: str = Field(default="", alias="PUSH_KEK")  # base64 32 bytes


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
