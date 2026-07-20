import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Enterprise Observability & Audit Platform"
    DEBUG: bool = True
    
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_HOST: Optional[str] = None
    DB_PORT: str = "3306"
    DB_NAME: Optional[str] = None

    # Database Configuration - dynamically builds MySQL if DB credentials exist in .env
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL", None)
    
    @property
    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if self.DB_USER and self.DB_HOST and self.DB_NAME:
            import urllib.parse
            pwd = urllib.parse.quote_plus(self.DB_PASSWORD) if self.DB_PASSWORD else ""
            return f"mysql+mysqlconnector://{self.DB_USER}:{pwd}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        return "sqlite:///./observability.db"
    
    # OpenTelemetry Ingest Settings
    INGEST_API_KEY_HEADER: str = "X-OTEL-API-KEY"
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
