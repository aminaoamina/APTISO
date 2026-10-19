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
    # NVIDIA Build (OpenAI-compatible). Models are settings, so they change without code changes.
    nvidia_api_key: SecretStr | None = None
    ai_base_url: str = "https://integrate.api.nvidia.com/v1"
    ai_model_main: str = "nvidia/nemotron-3-super-120b-a12b"
    ai_model_fallback: str = "openai/gpt-oss-20b"
    ai_model_embed: str = "nvidia/nemotron-3-embed-1b"
    # Reading scans: the models that read our test scan correctly (14/14, 14/14, 13/14 facts).
    ai_model_ocr: str = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
    ai_model_ocr_fallback: str = "nvidia/nemotron-3.5-super-vl-120b-a12b"
    ai_model_vision: str = "meta/llama-3.2-11b-vision-instruct"
    # Largest accepted request body (JSON); evidence uploads have their own limit.
    max_body_bytes: int = 1_048_576
    # Job submissions may carry an evidence file (15 MB, base64-encoded).
    max_job_body_bytes: int = 21_000_000

    @property
    def database_url(self) -> str:
        password = quote(self.ai_db_password.get_secret_value(), safe="")
        return f"postgresql+asyncpg://{self.ai_db_user}:{password}@{self.ai_db_host}:{self.ai_db_port}/{self.ai_db_name}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
