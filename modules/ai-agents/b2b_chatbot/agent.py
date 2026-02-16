"""
B2B Customer Support Chatbot Agent

This agent provides customer support for B2B portal users.
It has knowledge of:
- Product catalog
- B2B pricing rules
- Order history
- Company policies
"""
from textwrap import dedent
from typing import Optional, List
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.models.google import Gemini
from agno.tools.reasoning import ReasoningTools

from config import get_config
from shared import create_knowledge_base


class B2BChatbotAgent:
    """
    B2B Customer Support Chatbot using RAG.
    
    Capabilities:
    - Answer questions about products
    - Explain B2B pricing and discounts
    - Track orders
    - Provide product recommendations
    """
    
    def __init__(self, use_gemini: bool = False):
        """
        Initialize the B2B Chatbot agent.
        
        Args:
            use_gemini: Use Gemini instead of OpenAI (cost-effective)
        """
        self.config = get_config()
        self.use_gemini = use_gemini
        self.knowledge = None
        self.agent = None
        self._initialized = False
    
    def initialize(self, knowledge_sources: Optional[List[str]] = None) -> None:
        """
        Initialize the agent with knowledge base.
        
        Args:
            knowledge_sources: Optional URLs to load into knowledge base
        """
        # Create knowledge base
        self.knowledge = create_knowledge_base(table_name="b2b_chatbot_kb")
        
        # Load default knowledge sources if provided
        if knowledge_sources:
            for url in knowledge_sources:
                self.knowledge.add_content(url=url)
        
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
        
        # Create agent
        self.agent = Agent(
            name="B2B Support Agent",
            role="Customer support specialist for B2B portal users",
            model=model,
            knowledge=self.knowledge,
            search_knowledge=True,
            tools=[ReasoningTools(add_instructions=True)],
            description=dedent("""
                You are a helpful B2B customer support agent for Ledux.ro,
                a LED lighting e-commerce company. You help B2B customers with:
                - Product information and specifications
                - Pricing and discount inquiries
                - Order tracking and status
                - Product recommendations for projects
                - Technical specifications
                
                Always be professional, helpful, and accurate.
                Include sources when referencing specific information.
            """),
            instructions=[
                "Always search knowledge base before answering product questions.",
                "Be concise but thorough in your responses.",
                "If you don't know something, say so and offer to help find the answer.",
                "Use Romanian language when the user writes in Romanian.",
                "Include relevant product links when recommending products.",
            ],
            markdown=True,
            add_datetime_to_context=True,
        )
        
        self._initialized = True
    
    def add_product_knowledge(self, products: List[dict]) -> None:
        """
        Add product catalog to knowledge base.
        
        Args:
            products: List of product dictionaries with name, description, specs, price
        """
        if not self.knowledge:
            raise RuntimeError("Agent not initialized. Call initialize() first.")
        
        for product in products:
            text = f"""
            Product: {product.get('name', 'Unknown')}
            SKU: {product.get('sku', 'N/A')}
            Description: {product.get('description', '')}
            Specifications: {product.get('specs', '')}
            Category: {product.get('category', '')}
            B2B Price: {product.get('b2b_price', 'Contact for pricing')}
            Stock: {product.get('stock', 'Unknown')}
            """
            self.knowledge.add_content(text=text.strip())
    
    def chat(self, message: str, stream: bool = False):
        """
        Send a message to the chatbot and get a response.
        
        Args:
            message: User message
            stream: Whether to stream the response
            
        Returns:
            Agent response (string or generator if streaming)
        """
        if not self._initialized:
            raise RuntimeError("Agent not initialized. Call initialize() first.")
        
        if stream:
            return self.agent.run(message, stream=True, stream_events=True)
        else:
            response = self.agent.run(message, stream=False)
            return response.content
    
    def get_response(self, message: str) -> str:
        """
        Get a simple string response (non-streaming).
        
        Args:
            message: User message
            
        Returns:
            Response string
        """
        return self.chat(message, stream=False)


# Convenience function for quick usage
def create_b2b_chatbot(use_gemini: bool = False) -> B2BChatbotAgent:
    """
    Create and initialize a B2B chatbot agent.
    
    Args:
        use_gemini: Use Gemini instead of OpenAI
        
    Returns:
        Initialized B2BChatbotAgent
    """
    agent = B2BChatbotAgent(use_gemini=use_gemini)
    agent.initialize()
    return agent
