---
name: AI Agents Development
description: Best practices for building AI Agents and Multi-Agent Teams using patterns from awesome-llm-apps
---

# AI Agents Development Skill

This skill provides patterns for building single and multi-agent AI systems.

## Core Framework: Agno

Use **Agno** (`pip install agno`) for agent development:

- `Agent` - Core agent class
- `RunOutput` - Structured agent responses
- Built-in tools: `SerpApiTools`, `ReasoningTools`, etc.

## Single Agent Pattern

```python
from textwrap import dedent
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.tools.serpapi import SerpApiTools

agent = Agent(
    name="Researcher",
    role="Searches for information based on user queries",
    model=OpenAIChat(id="gpt-4o", api_key=openai_key),
    description=dedent("""
        You are a world-class researcher. Given a topic,
        generate search terms, analyze results, and return findings.
    """),
    instructions=[
        "Generate 3 search terms for the topic.",
        "For each term, search_google and analyze results.",
        "Return the 10 most relevant results.",
    ],
    tools=[SerpApiTools(api_key=serp_api_key)],
    add_datetime_to_context=True,
)

# Run agent
response = agent.run("Research LED lighting trends", stream=False)
print(response.content)
```

## Multi-Agent Pattern

```python
# Agent 1: Researcher
researcher = Agent(
    name="Researcher",
    role="Searches for information",
    model=OpenAIChat(id="gpt-4o", api_key=key),
    tools=[SerpApiTools(api_key=serp_key)],
)

# Agent 2: Planner
planner = Agent(
    name="Planner",
    role="Creates plans from research",
    model=OpenAIChat(id="gpt-4o", api_key=key),
    instructions=["Create detailed, actionable plans."],
)

# Sequential execution
research_results = researcher.run(query, stream=False)
final_plan = planner.run(f"Research: {research_results.content}", stream=False)
```

## Agent Types Available

| Type | Use Case | Reference |
|------|----------|-----------|
| **Data Analysis Agent** | Analyze data, create visualizations | `starter_ai_agents/ai_data_analysis_agent/` |
| **Web Scraping Agent** | Extract data from websites | `starter_ai_agents/web_scrapping_ai_agent/` |
| **Finance Agent** | Stock analysis, financial data | `starter_ai_agents/xai_finance_agent/` |
| **Multimodal Agent** | Image + text processing | `starter_ai_agents/multimodal_ai_agent/` |
| **Mixture of Agents** | Multiple LLMs collaborating | `starter_ai_agents/mixture_of_agents/` |

## Advanced Multi-Agent Teams

| Team | Use Case | Reference |
|------|----------|-----------|
| **Sales Intelligence** | Lead research, competitor analysis | `advanced_ai_agents/multi_agent_apps/agent_teams/ai_sales_intelligence_agent_team/` |
| **Legal Agent Team** | Contract review, compliance | `advanced_ai_agents/multi_agent_apps/agent_teams/ai_legal_agent_team/` |
| **Coding Agent Team** | Code review, generation | `advanced_ai_agents/multi_agent_apps/agent_teams/multimodal_coding_agent_team/` |

## Dependencies

```txt
agno
openai
google-generativeai
serpapi
streamlit
python-dotenv
```

## ERP Integration Tips

1. **B2B Sales Agent**: Research potential B2B customers, analyze their needs, suggest products.
2. **Supplier Intelligence**: Monitor supplier websites for price changes and stock updates.
3. **Customer Support Agent**: Answer questions about orders, products, and B2B pricing.

## Reference Code

See full working examples at:

- `/Users/Dell/Desktop/erp/awesome-llm-apps/starter_ai_agents/ai_travel_agent/`
- `/Users/Dell/Desktop/erp/awesome-llm-apps/advanced_ai_agents/multi_agent_apps/agent_teams/`
