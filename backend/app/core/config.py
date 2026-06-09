from pathlib import Path
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


_CONFIG_FILE = Path(__file__).resolve()
_BACKEND_ROOT = _CONFIG_FILE.parents[2]
_PROJECT_ROOT = _CONFIG_FILE.parents[3]


class Settings(BaseSettings):
    model_config: ClassVar[SettingsConfigDict] = SettingsConfigDict(
        env_file=(str(_PROJECT_ROOT / ".env"), str(_BACKEND_ROOT / ".env")),
        extra="ignore",
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
    KIE_SUNO_MODEL: str = "V5.5"
    OPENAI_API_KEY: str = ""
    IMAGE_PROVIDER: str = "kie"
    IMAGE_DEFAULT_MODEL: str = "gpt-image-2"
    IMAGE_GENERATION_TIMEOUT_SECONDS: int = 120
    IMAGE_GENERATION_ENABLED: bool = True
    IMAGE_GENERATION_DAILY_LIMIT: int = 20
    IMAGE_GENERATION_COOLDOWN_SECONDS: int = 30
    IMAGE_PROVIDER_ALLOWLIST: str = "kie,openai"
    IMAGE_MODEL_ALLOWLIST: str = "gpt-image-2,gpt-image-2-image-to-image"
    PUBLIC_API_URL: str = ""


settings = Settings()

if settings.ENVIRONMENT.lower() in {"prod", "production"}:
    if settings.SECRET_KEY == "story-lens-dev-secret-key-change-in-production":
        raise ValueError("SECRET_KEY must be set in production")
    if settings.DATABASE_URL == DEFAULT_DATABASE_URL:
        raise ValueError("DATABASE_URL must be explicitly set in production")
    if _is_local_database_url(settings.DATABASE_URL):
        raise ValueError("DATABASE_URL must not point to localhost in production")
