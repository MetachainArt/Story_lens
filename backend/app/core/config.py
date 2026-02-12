from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/story_lens"
    SECRET_KEY: str = Field(
        default="story-lens-dev-secret-key-change-in-production",
        description="JWT secret key. MUST be overridden via env var in production.",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DEBUG: bool = True
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = "../.env"
        extra = "ignore"

settings = Settings()
