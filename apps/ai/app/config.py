from functools import lru_cache
from urllib.parse import quote

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """AI service settings, from the environment or apps/ai/.env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Shared secret with the NestJS backend; the only caller of this service.
    ai_service_token: SecretStr = Field(min_length=32)
    # Own database (role aptiso_ai): never the business database.
    ai_db_user: str = "aptiso_ai"
    ai_db_password: SecretStr
    ai_db_host: str = "localhost"
    ai_db_port: int = 5432
    ai_db_name: str = "aptiso_ai"
    redis_url: str = "redis://localhost:6379"
    # Largest accepted request body (JSON); evidence uploads have their own limit.
    max_body_bytes: int = 1_048_576

    @property
    def database_url(self) -> str:
        password = quote(self.ai_db_password.get_secret_value(), safe="")
        return f"postgresql+asyncpg://{self.ai_db_user}:{password}@{self.ai_db_host}:{self.ai_db_port}/{self.ai_db_name}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
