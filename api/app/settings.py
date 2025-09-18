from functools import lru_cache
from pydantic import AnyHttpUrl, field_validator  # stays in pydantic
from pydantic_settings import BaseSettings        # moved in Pydantic v2
from typing import List, Optional

class Settings(BaseSettings):
    ENV: str = "dev"
    LOG_LEVEL: str = "INFO"

    # Networking
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    CORS_ORIGINS: List[AnyHttpUrl] = []

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://puma:puma@db:5432/puma_v2"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 10

    # Redis (optional, for later)
    REDIS_URL: Optional[str] = None

    # LLM providers (later)
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    DEFAULT_LLM_PROVIDER: str = "null"  # "openai" | "gemini" | "null"

    @field_validator("LOG_LEVEL")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()

    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache
def get_settings() -> Settings:
    return Settings()
