from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    APP_NAME: str = "MPSEDC GenAI Procurement Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    SECRET_KEY: str = "mpsedc-secret-key-change-in-production"

    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "mpsedc_procurement"
    DB_USER: str = "root"
    DB_PASSWORD: str = "12345"

    # Qdrant
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333

    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "gemma3"

    # Gemini Fallback
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"

    # File Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 50

    # OCR
    OCR_MIN_ACCURACY: float = 0.95

    @property
    def DATABASE_URL(self) -> str:
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def DATABASE_URL_SQLITE(self) -> str:
        """SQLite fallback for demo/dev when MySQL not available"""
        return "sqlite:///./mpsedc_demo.db"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
