---
name: RAG Development
description: Best practices for building Retrieval Augmented Generation (RAG) systems using patterns from awesome-llm-apps
---

# RAG Development Skill

This skill provides patterns and best practices for building RAG (Retrieval Augmented Generation) systems.

## Core Framework: Agno

The recommended framework is **Agno** (`pip install agno`), which provides:

- `Knowledge` - Document loading and management
- `LanceDb` - Vector database for embeddings
- `OpenAIEmbedder` - Text to vector conversion
- `ReasoningTools` - Step-by-step reasoning capabilities

## Basic RAG Pattern

```python
from agno.agent import Agent
from agno.knowledge.embedder.openai import OpenAIEmbedder
from agno.knowledge.knowledge import Knowledge
from agno.models.google import Gemini
from agno.tools.reasoning import ReasoningTools
from agno.vectordb.lancedb import LanceDb, SearchType

# 1. Create Knowledge Base with Vector Store
knowledge = Knowledge(
    vector_db=LanceDb(
        uri="tmp/lancedb",
        table_name="documents",
        search_type=SearchType.vector,
        embedder=OpenAIEmbedder(api_key=openai_key),
    ),
)

# 2. Add content to knowledge base
knowledge.add_content(url="https://example.com/doc")

# 3. Create Agent with Knowledge
agent = Agent(
    model=Gemini(id="gemini-2.5-flash", api_key=google_key),
    knowledge=knowledge,
    search_knowledge=True,
    tools=[ReasoningTools(add_instructions=True)],
    instructions=[
        "Include sources in your response.",
        "Always search your knowledge before answering.",
    ],
    markdown=True,
)

# 4. Query with streaming
for chunk in agent.run(query, stream=True, stream_events=True):
    if hasattr(chunk, 'content') and chunk.content:
        print(chunk.content)
```

## RAG Variants

| Pattern | Use Case | Reference |
|---------|----------|-----------|
| **Agentic RAG** | Complex multi-step retrieval | `rag_tutorials/agentic_rag_with_reasoning/` |
| **Corrective RAG (CRAG)** | Self-correcting retrieval | `rag_tutorials/corrective_rag/` |
| **Hybrid Search RAG** | Semantic + keyword search | `rag_tutorials/hybrid_search_rag/` |
| **Local RAG** | Fully offline with Llama | `rag_tutorials/llama3.1_local_rag/` |
| **Vision RAG** | Image-based retrieval | `rag_tutorials/vision_rag/` |

## Dependencies

```txt
agno
lancedb
openai
streamlit
python-dotenv
```

## ERP Integration Tips

1. **Product Catalog RAG**: Index all 100k+ products with MeiliSearch for fast retrieval, use RAG for complex natural language queries.
2. **B2B Support Agent**: Create a RAG agent that searches product documentation, pricing rules, and order history.
3. **Invoice Q&A**: Index SmartBill invoices for natural language queries ("What did company X order last month?").

## Reference Code

See full working examples at:

- `/Users/Dell/Desktop/erp/awesome-llm-apps/rag_tutorials/agentic_rag_with_reasoning/`
- `/Users/Dell/Desktop/erp/awesome-llm-apps/rag_tutorials/local_rag_agent/`
