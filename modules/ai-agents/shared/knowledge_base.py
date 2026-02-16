"""
Shared Knowledge Base utilities for AI agents.
Provides common functions for loading and querying knowledge bases.
"""
from typing import List, Optional
from agno.knowledge.knowledge import Knowledge
from agno.knowledge.embedder.openai import OpenAIEmbedder
from agno.vectordb.lancedb import LanceDb, SearchType

from config import get_config


def create_knowledge_base(
    table_name: str,
    uri: Optional[str] = None
) -> Knowledge:
    """
    Create a knowledge base with LanceDB vector store.
    
    Args:
        table_name: Name of the LanceDB table
        uri: Optional custom URI for the database
        
    Returns:
        Knowledge instance ready for content loading
    """
    config = get_config()
    
    return Knowledge(
        vector_db=LanceDb(
            uri=uri or config.lancedb_uri,
            table_name=table_name,
            search_type=SearchType.vector,
            embedder=OpenAIEmbedder(api_key=config.openai_api_key),
        ),
    )


def load_urls_to_knowledge(
    knowledge: Knowledge,
    urls: List[str]
) -> None:
    """
    Load content from URLs into the knowledge base.
    
    Args:
        knowledge: Knowledge instance
        urls: List of URLs to load
    """
    for url in urls:
        knowledge.add_content(url=url)


def load_text_to_knowledge(
    knowledge: Knowledge,
    texts: List[str],
    metadata: Optional[List[dict]] = None
) -> None:
    """
    Load text content directly into the knowledge base.
    
    Args:
        knowledge: Knowledge instance
        texts: List of text content to load
        metadata: Optional metadata for each text
    """
    for i, text in enumerate(texts):
        meta = metadata[i] if metadata and i < len(metadata) else {}
        knowledge.add_content(text=text, metadata=meta)
