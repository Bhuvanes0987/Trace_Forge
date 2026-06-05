import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Enterprise Observability & Audit Platform"
    DEBUG: bool = True
    
    # Database Configuration - defaults to local SQLite for instant out-of-the-box operation, 
    # and automatically uses environment variable-configured MySQL in docker-compose.
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./observability.db"
    )
    
    # OpenTelemetry Ingest Settings
    INGEST_API_KEY_HEADER: str = "X-OTEL-API-KEY"
    
    class Config:
        env_file = ".env"

settings = Settings()
