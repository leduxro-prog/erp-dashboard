"""
AI Agents Module Configuration
Loads environment variables and provides shared configuration for all AI agents.
"""
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional

# Load environment variables
load_dotenv()


class AIConfig(BaseModel):
    """Configuration for AI agents"""
    
    # OpenAI
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o")
    openai_embedding_model: str = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    
    # Google Gemini
    google_api_key: str = os.getenv("GOOGLE_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
    # SerpAPI (for web search)
    serpapi_key: str = os.getenv("SERPAPI_KEY", "")
    
    # Vector Database
    lancedb_uri: str = os.getenv("LANCEDB_URI", "./data/lancedb")
    
    # MeiliSearch (for product search)
    meilisearch_host: str = os.getenv("MEILISEARCH_HOST", "http://localhost:7700")
    meilisearch_key: str = os.getenv("MEILI_MASTER_KEY", "masterKey")
    
    # Database (for fetching product data)
    db_host: str = os.getenv("DB_HOST", "localhost")
    db_port: int = int(os.getenv("DB_PORT", "5432"))
    db_name: str = os.getenv("DB_NAME", "cypher_erp")
    db_user: str = os.getenv("DB_USER", "cypher_user")
    db_password: str = os.getenv("DB_PASSWORD", "")
    
    @property
    def has_openai(self) -> bool:
        return bool(self.openai_api_key)
    
    @property
    def has_google(self) -> bool:
        return bool(self.google_api_key)
    
    @property
    def has_serpapi(self) -> bool:
        return bool(self.serpapi_key)


# Singleton config instance
config = AIConfig()


def get_config() -> AIConfig:
    """Get the AI configuration singleton"""
    return config
