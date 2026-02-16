"""
Product Catalog RAG - Search Agent

Natural language search for products using RAG.
Supports complex queries like "LED panels for office, 60x60, warm white, under €50"
"""
from textwrap import dedent
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.models.google import Gemini
from agno.tools.reasoning import ReasoningTools

from config import get_config
from shared import create_knowledge_base


class ProductSearchResult(BaseModel):
    """Product search result"""
    product_id: str
    sku: str
    name: str
    category: str
    b2b_price: Optional[float]
    stock: int
    relevance_score: float
    reasoning: str


class ProductSearchAgent:
    """
    Natural language search agent for product catalog.
    
    Uses RAG to understand complex queries and find matching products.
    """
    
    def __init__(self, use_gemini: bool = True):
        self.config = get_config()
        self.use_gemini = use_gemini
        self.knowledge = None
        self.agent = None
        self._initialized = False
    
    def initialize(self) -> None:
        """Initialize the search agent"""
        # Use existing product catalog knowledge base
        self.knowledge = create_knowledge_base(table_name="product_catalog")
        
        # Select model
        if self.use_gemini and self.config.has_google:
            model = Gemini(
                id=self.config.gemini_model,
                api_key=self.config.google_api_key
            )
        else:
            model = OpenAIChat(
                id=self.config.openai_model,
                api_key=self.config.openai_api_key
            )
        
        # Create search agent
        self.agent = Agent(
            name="Product Search Agent",
            role="Specialist in finding LED lighting products",
            model=model,
            knowledge=self.knowledge,
            search_knowledge=True,
            tools=[ReasoningTools(add_instructions=True)],
            description=dedent("""
                You are an expert product search assistant for Ledux.ro LED lighting catalog.
                You understand technical specifications, B2B pricing, and can match
                complex requirements to products.
                
                When searching:
                1. Parse the user's requirements (dimensions, wattage, color temp, price range)
                2. Search the product catalog
                3. Rank results by relevance
                4. Explain why each product matches
            """),
            instructions=[
                "Always search the knowledge base for products.",
                "Parse technical requirements from natural language queries.",
                "Consider B2B pricing when price constraints are mentioned.",
                "Explain your reasoning for each recommendation.",
                "Return structured product information.",
                "Use Romanian when the query is in Romanian.",
            ],
            markdown=True,
        )
        
        self._initialized = True
    
    def search(
        self,
        query: str,
        max_results: int = 10,
        price_max: Optional[float] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search for products using natural language.
        
        Args:
            query: Natural language search query
            max_results: Maximum results to return
            price_max: Optional maximum price filter
            category: Optional category filter
            
        Returns:
            Search results with products and reasoning
        """
        if not self._initialized:
            raise RuntimeError("Agent not initialized. Call initialize() first.")
        
        # Build enhanced query with filters
        enhanced_query = query
        if price_max:
            enhanced_query += f" with maximum price €{price_max}"
        if category:
            enhanced_query += f" in category {category}"
        enhanced_query += f". Return up to {max_results} products."
        
        # Run agent
        response = self.agent.run(enhanced_query, stream=False)
        
        return {
            "query": query,
            "enhanced_query": enhanced_query,
            "results": response.content,
            "max_results": max_results,
        }
    
    def quick_search(self, query: str) -> str:
        """Quick search returning just the response text"""
        if not self._initialized:
            raise RuntimeError("Agent not initialized. Call initialize() first.")
        
        response = self.agent.run(query, stream=False)
        return response.content


# Convenience function
def create_search_agent(use_gemini: bool = True) -> ProductSearchAgent:
    """Create and initialize a product search agent"""
    agent = ProductSearchAgent(use_gemini=use_gemini)
    agent.initialize()
    return agent
