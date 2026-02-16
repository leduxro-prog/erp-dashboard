"""
Product Catalog RAG - Indexer

Indexes product catalog into LanceDB for natural language search.
Supports 100k+ products with efficient batch processing.
"""
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel

from agno.knowledge.embedder.openai import OpenAIEmbedder
from agno.vectordb.lancedb import LanceDb, SearchType

from config import get_config


class ProductDocument(BaseModel):
    """Product document for indexing"""
    id: str
    sku: str
    name: str
    description: str
    category: str
    subcategory: Optional[str] = None
    specs: Dict[str, Any] = {}
    b2b_price: Optional[float] = None
    retail_price: Optional[float] = None
    stock: int = 0
    brand: Optional[str] = None
    tags: List[str] = []


class ProductIndexer:
    """
    Indexes products into LanceDB for RAG-based search.
    
    Features:
    - Batch processing for 100k+ products
    - Incremental updates
    - Full reindexing support
    """
    
    def __init__(self, table_name: str = "product_catalog"):
        self.config = get_config()
        self.table_name = table_name
        self.vector_db = None
        self._initialized = False
    
    def initialize(self) -> None:
        """Initialize the vector database"""
        self.vector_db = LanceDb(
            uri=self.config.lancedb_uri,
            table_name=self.table_name,
            search_type=SearchType.vector,
            embedder=OpenAIEmbedder(api_key=self.config.openai_api_key),
        )
        self._initialized = True
    
    def _product_to_text(self, product: ProductDocument) -> str:
        """Convert product to searchable text"""
        specs_text = ", ".join([
            f"{k}: {v}" for k, v in product.specs.items()
        ]) if product.specs else ""
        
        tags_text = ", ".join(product.tags) if product.tags else ""
        
        return f"""
Product: {product.name}
SKU: {product.sku}
Category: {product.category} > {product.subcategory or 'General'}
Brand: {product.brand or 'N/A'}
Description: {product.description}
Specifications: {specs_text}
B2B Price: €{product.b2b_price:.2f} if product.b2b_price else 'Contact for pricing'
Stock: {product.stock} units
Tags: {tags_text}
        """.strip()
    
    def index_products(
        self,
        products: List[ProductDocument],
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Index products into the vector database.
        
        Args:
            products: List of products to index
            batch_size: Number of products per batch
            
        Returns:
            Indexing statistics
        """
        if not self._initialized:
            raise RuntimeError("Indexer not initialized. Call initialize() first.")
        
        start_time = datetime.now()
        indexed_count = 0
        error_count = 0
        
        # Process in batches
        for i in range(0, len(products), batch_size):
            batch = products[i:i + batch_size]
            
            for product in batch:
                try:
                    text = self._product_to_text(product)
                    metadata = {
                        "product_id": product.id,
                        "sku": product.sku,
                        "category": product.category,
                        "b2b_price": product.b2b_price,
                        "stock": product.stock,
                    }
                    self.vector_db.add(text=text, metadata=metadata)
                    indexed_count += 1
                except Exception as e:
                    error_count += 1
                    print(f"Error indexing product {product.sku}: {e}")
        
        end_time = datetime.now()
        
        return {
            "indexed": indexed_count,
            "errors": error_count,
            "total": len(products),
            "duration_seconds": (end_time - start_time).total_seconds(),
            "products_per_second": indexed_count / max((end_time - start_time).total_seconds(), 1),
        }
    
    def index_from_database(
        self,
        db_connection,
        query: str = "SELECT * FROM products WHERE active = true",
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Index products directly from PostgreSQL database.
        
        Args:
            db_connection: Database connection
            query: SQL query to fetch products
            batch_size: Batch size for processing
            
        Returns:
            Indexing statistics
        """
        # This would integrate with your existing database
        # For now, return a placeholder
        raise NotImplementedError("Database integration pending - use index_products() for now")
    
    def search(
        self,
        query: str,
        limit: int = 10,
        min_score: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Search for products using natural language.
        
        Args:
            query: Natural language search query
            limit: Maximum results to return
            min_score: Minimum similarity score
            
        Returns:
            List of matching products with scores
        """
        if not self._initialized:
            raise RuntimeError("Indexer not initialized. Call initialize() first.")
        
        results = self.vector_db.search(query, limit=limit)
        
        return [
            {
                "text": r.text,
                "metadata": r.metadata,
                "score": r.score,
            }
            for r in results
            if r.score >= min_score
        ]


# Convenience function
def create_product_indexer(table_name: str = "product_catalog") -> ProductIndexer:
    """Create and initialize a product indexer"""
    indexer = ProductIndexer(table_name=table_name)
    indexer.initialize()
    return indexer
