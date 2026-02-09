from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/story_lens"
    SECRET_KEY: str = "story-lens-dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    class Config:
        env_file = "../.env"
        extra = "ignore"

settings = Settings()
