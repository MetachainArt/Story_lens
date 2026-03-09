from typing import ClassVar
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


DEFAULT_DATABASE_URL = (
    "postgresql+asyncpg://postgres:postgres@localhost:5432/story_lens"
)


def _is_local_database_url(database_url: str) -> bool:
    parsed = urlparse(database_url)
    hostname = (parsed.hostname or "").lower()
    return hostname in {"localhost", "127.0.0.1", "::1"}


class Settings(BaseSettings):
    model_config: ClassVar[SettingsConfigDict] = SettingsConfigDict(
        env_file="../.env", extra="ignore"
    )

    DATABASE_URL: str = DEFAULT_DATABASE_URL
    SECRET_KEY: str = Field(
        default="story-lens-dev-secret-key-change-in-production",
        description="JWT secret key. MUST be overridden via env var in production.",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_TIMEOUT_SECONDS: int = 60
    KIE_API_KEY: str = ""
    KIE_SUNO_MODEL: str = "V4_5"


settings = Settings()

if settings.ENVIRONMENT.lower() in {"prod", "production"}:
    if settings.SECRET_KEY == "story-lens-dev-secret-key-change-in-production":
        raise ValueError("SECRET_KEY must be set in production")
    if settings.DATABASE_URL == DEFAULT_DATABASE_URL:
        raise ValueError("DATABASE_URL must be explicitly set in production")
    if _is_local_database_url(settings.DATABASE_URL):
        raise ValueError("DATABASE_URL must not point to localhost in production")
