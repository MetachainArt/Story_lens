from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/story_lens"
    )
    SECRET_KEY: str = Field(
        default="story-lens-dev-secret-key-change-in-production",
        description="JWT secret key. MUST be overridden via env var in production.",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"


settings = Settings()

if settings.ENVIRONMENT.lower() in {"prod", "production"}:
    if settings.SECRET_KEY == "story-lens-dev-secret-key-change-in-production":
        raise ValueError("SECRET_KEY must be set in production")
