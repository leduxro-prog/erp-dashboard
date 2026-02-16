"""
Competitor Intelligence - Multi-Agent Team

Coordinated team of AI agents for market research and competitor analysis.
- Researcher: Finds competitor data
- Analyst: Compares products and prices
- Reporter: Generates actionable insights
"""
from textwrap import dedent
from typing import List, Dict, Any
from pydantic import BaseModel

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.tools.serpapi import SerpApiTools

from config import get_config


class CompetitorReport(BaseModel):
    """Structured competitor analysis report"""
    competitor: str
    product_category: str
    price_positioning: str
    key_strengths: List[str]
    identified_gaps: List[str]
    action_items: List[str]


class CompetitorIntelTeam:
    """
    Multi-agent team for competitor intelligence.
    
    Orchestrates specialized agents to gather, analyze, and report on competitors.
    """
    
    def __init__(self):
        self.config = get_config()
        self.researcher = None
        self.analyst = None
        self.reporter = None
        self._initialized = False
    
    def initialize(self) -> None:
        """Initialize the agent team"""
        if not self.config.has_openai or not self.config.has_serpapi:
            print("Warning: Missing OpenAI or SerpAPI key. Functionality limited.")
        
        # 1. Researcher Agent - Finds raw data
        self.researcher = Agent(
            name="Market Researcher",
            role="Finds competitor product information and pricing",
            model=OpenAIChat(id="gpt-4o", api_key=self.config.openai_api_key),
            tools=[SerpApiTools(api_key=self.config.serpapi_key)],
            description=dedent("""
                You are a market researcher for Ledux.ro.
                Your job is to find accurate, up-to-date information about competitors.
                Focus on:
                - Product specifications
                - Pricing strategies (B2B vs Retail)
                - Stock availability
                - Marketing claims
            """),
            instructions=[
                "Use Google Search to find competitor product pages.",
                "Extract specific technical details and prices.",
                "Verify information from multiple sources if possible.",
                "Return raw data for the analyst to process.",
            ],
        )
        
        # 2. Analyst Agent - Processes data
        self.analyst = Agent(
            name="Market Analyst",
            role="Analyzes competitor data against our products",
            model=OpenAIChat(id="gpt-4o", api_key=self.config.openai_api_key),
            description=dedent("""
                You are a senior market analyst.
                Compare competitor data with Ledux.ro's offerings.
                Identify:
                - Price gaps (are we too expensive?)
                - Spec gaps (do they offer better efficiency/CRI?)
                - Portfolio gaps (what products are we missing?)
            """),
            instructions=[
                "Compare apples to apples (similar specs).",
                "Calculate price differences in percentages.",
                "Identify trends in competitor assortments.",
            ],
        )
        
        # 3. Reporter Agent - Creates actionable output
        self.reporter = Agent(
            name="Strategic Reporter",
            role="Generates executive summaries and action items",
            model=OpenAIChat(id="gpt-4o", api_key=self.config.openai_api_key),
            description=dedent("""
                You are a strategic advisor.
                Synthesize analysis into clear, actionable reports.
                Focus on business impact and recommended actions.
            """),
            instructions=[
                "Be concise and executive-friendly.",
                "Prioritize high-impact findings.",
                "Suggest specific actions (e.g., 'Lower price on SKU-123', 'Launch 4000K variant').",
                "Format output as a structured report.",
            ],
        )
        
        self._initialized = True
    
    def analyze_competitor(self, competitor_name: str, product_category: str) -> str:
        """
        Run full analysis cycle on a competitor.
        
        Args:
            competitor_name: Name of competitor (e.g., "V-Tac")
            product_category: Category to analyze (e.g., "LED Panels")
            
        Returns:
            Analysis report text
        """
        if not self._initialized:
            raise RuntimeError("Team not initialized. Call initialize() first.")
        
        print(f"Starting analysis of {competitor_name} - {product_category}...")
        
        # Step 1: Research
        research_task = f"Find top 5 {product_category} products from {competitor_name}. Get prices and specs."
        research_data = self.researcher.run(research_task, stream=False)
        print("Research complete.")
        
        # Step 2: Analysis
        analysis_task = f"""
        Analyze this data for {competitor_name}:
        {research_data.content}
        
        Compare with typical market standards for {product_category}.
        Spot any aggressive pricing or unique features.
        """
        analysis_results = self.analyst.run(analysis_task, stream=False)
        print("Analysis complete.")
        
        # Step 3: Reporting
        report_task = f"""
        Create a strategic report based on this analysis:
        {analysis_results.content}
        
        Focus on {competitor_name}'s strategy in {product_category}.
        """
        final_report = self.reporter.run(report_task, stream=False)
        print("Report generated.")
        
        return final_report.content


# Convenience function
def create_intel_team() -> CompetitorIntelTeam:
    """Create and initialize an intelligence team"""
    team = CompetitorIntelTeam()
    team.initialize()
    return team
