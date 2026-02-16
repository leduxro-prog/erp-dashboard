---
name: MCP Agents Development
description: Best practices for building Model Context Protocol (MCP) agents for browser automation and integrations
---

# MCP Agents Development Skill

This skill provides patterns for building MCP (Model Context Protocol) agents.

## Core Framework: mcp-agent

Use **mcp-agent** (`pip install mcp-agent`) for MCP development:

- `MCPApp` - Application container
- `Agent` - MCP-enabled agent
- `OpenAIAugmentedLLM` - LLM with MCP tool support

## Browser Automation Agent Pattern

```python
import asyncio
from mcp_agent.app import MCPApp
from mcp_agent.agents.agent import Agent
from mcp_agent.workflows.llm.augmented_llm_openai import OpenAIAugmentedLLM
from mcp_agent.workflows.llm.augmented_llm import RequestParams

# 1. Create MCP App
mcp_app = MCPApp(name="browser_automation")

async def run_browser_agent(query: str):
    async with mcp_app.run() as app:
        # 2. Create Agent with MCP servers
        browser_agent = Agent(
            name="browser",
            instruction="""You are a web browsing assistant using Playwright.
                - Navigate to websites
                - Click, scroll, type on pages
                - Extract information
                - Take screenshots""",
            server_names=["playwright"],  # MCP server to use
        )
        
        # 3. Initialize and attach LLM
        await browser_agent.initialize()
        llm = await browser_agent.attach_llm(OpenAIAugmentedLLM)
        
        # 4. Run query
        result = await llm.generate_str(
            message=query,
            request_params=RequestParams(use_history=True, maxTokens=10000)
        )
        return result

# Execute
result = asyncio.run(run_browser_agent("Go to github.com and summarize the page"))
```

## MCP Configuration (mcp_agent.config.yaml)

```yaml
mcp:
  servers:
    playwright:
      command: npx
      args: ["@anthropic-ai/mcp-server-playwright"]
    github:
      command: npx
      args: ["@anthropic-ai/mcp-server-github"]
```

## Available MCP Agents

| Agent | MCP Server | Use Case | Reference |
|-------|------------|----------|-----------|
| **Browser Agent** | Playwright | Web automation, scraping | `mcp_ai_agents/browser_mcp_agent/` |
| **GitHub Agent** | GitHub MCP | Repo management, issues, PRs | `mcp_ai_agents/github_mcp_agent/` |
| **Notion Agent** | Notion MCP | Document management | `mcp_ai_agents/notion_mcp_agent/` |
| **Multi-MCP** | Multiple | Combined capabilities | `mcp_ai_agents/multi_mcp_agent/` |

## Dependencies

```txt
mcp-agent
openai
streamlit
playwright
```

## ERP Integration Tips

1. **Supplier Price Scraping**: Use Browser MCP to automatically scrape supplier websites for price updates.
2. **WooCommerce Automation**: Control WooCommerce admin panel via browser automation.
3. **Invoice Automation**: Navigate SmartBill web interface for complex operations not available via API.
4. **GitHub Integration**: Automate repository management for the ERP codebase.

## Reference Code

See full working examples at:

- `/Users/Dell/Desktop/erp/awesome-llm-apps/mcp_ai_agents/browser_mcp_agent/`
- `/Users/Dell/Desktop/erp/awesome-llm-apps/mcp_ai_agents/github_mcp_agent/`
