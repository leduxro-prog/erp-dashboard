# AI Agents Verification Guide

This guide helps you verify the installation and functionality of the new AI Agents module.

## 1. Prerequisites

Ensure you have Python 3.10+ installed and a virtual environment set up:

```bash
cd modules/ai-agents
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Ensure your `.env` file has the necessary API keys:

- `OPENAI_API_KEY`
- `GOOGLE_API_KEY` (Optional, for Gemini)
- `SERPAPI_KEY` (For competitor research)

## 2. Verify B2B Chatbot

Run the following script to test the chatbot:

```python
from modules.ai_agents.b2b_chatbot import create_b2b_chatbot

# Initialize
bot = create_b2b_chatbot(use_gemini=True)

# Add sample knowledge
bot.knowledge.add_content(text="Ledux offers free shipping on orders over €500.")

# Test
response = bot.get_response("What is your free shipping policy?")
print(f"Bot Response: {response}")
```

## 3. Verify Product RAG

Test indexing and searching:

```python
from modules.ai_agents.product_rag import create_search_agent, ProductDocument

# Initialize
agent = create_search_agent()

# Search (will use existing knowledge base if populated)
results = agent.search("LED panels for office 60x60")
print(f"Found {len(results['results'])} products")
```

## 4. Verify Supplier Scraper

Test browser automation (requires Playwright):

```python
from modules.ai_agents.supplier_scraper import create_supplier_scraper, EXAMPLE_SUPPLIERS

# Initialize
scraper = create_supplier_scraper()

# This will open a browser to scrape (ensure Playwright is installed)
# products = scraper.run_sync(EXAMPLE_SUPPLIERS['supplier_a'])
```

## 5. Verify Competitor Intelligence

Test multi-agent research:

```python
from modules.ai_agents.competitor_intel import create_intel_team

# Initialize
team = create_intel_team()

# Run analysis (Warning: Consumes API credits)
# report = team.analyze_competitor("CompetitorX", "LED Panels")
# print(report)
```
