# Enterprise Memory Fabric & Context Intelligence Platform

An intelligent additive layer sitting on top of OpenTelemetry to transform raw logs, traces, and metrics into synthesized context, multi-layered organizational memory, and behavioral insights.

---

## Technical Architecture Overview

The platform operates as a centralized context aggregator and learning brain without requiring any code alterations in the monitored source applications. It continuously consumes and enriches telemetry into six distinct memory tiers:

```
                  ┌──────────────────────────────────────────────┐
                  │          Monitored Applications              │
                  │  (Sends raw Spans, Logs, Metrics via OTel)   │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │        OpenTelemetry Ingestion Endpoint      │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
            ┌──────────────────────────────────────────────────────────┐
            │        Context Enrichment & Synthesis Engine             │
            │           (Triggered via Telemetry Hooks)                │
            └────────────────────────────┬─────────────────────────────┘
                                         │
     ┌───────────────────┬───────────────┼───────────────┬───────────────────┐
     ▼                   ▼               ▼               ▼                   ▼
┌──────────┐      ┌────────────┐   ┌───────────┐   ┌────────────┐     ┌────────────┐
│   HOT    │      │ STRUCTURED │   │ SEMANTIC  │   │ KNOWLEDGE  │     │  LEARNING  │
│  MEMORY  │      │   MEMORY   │   │  MEMORY   │   │   GRAPH    │     │   MEMORY   │
│ (Redis)  │      │ (Postgres) │   │ (Qdrant)  │   │  (Neo4j)   │     │(ClickHouse)│
└────┬─────┘      └─────┬──────┘   └─────┬─────┘   └─────┬──────┘     └─────┬──────┘
     │                  │                │               │                  │
     ▼                  ▼                ▼               ▼                  ▼
Active Session     High-level    Embeddings & AI   Cross-system      Trends, Patterns
Context Summaries  Biz Facts     Prompts / Comps   Relationships      & Predictions
```

---

## The 6 Memory Tiers

| Tier Name | Real-World Tech | Local Mock Architecture | Purpose |
| :--- | :--- | :--- | :--- |
| **Hot Memory** | Redis Cluster | `memory_hot` Table | Stores active user sessions, identifiers, and real-time synthesized context with expiration. |
| **Structured Memory** | PostgreSQL | `memory_structured` Table | Permanently records high-level business events and facts (e.g., failed checkouts, ticket creations). |
| **Semantic Memory** | Qdrant | `memory_semantic` Table | Houses LLM prompts, replies, and summaries, supporting semantic vector searches. |
| **Historical Memory** | Parquet / S3 / MinIO | `traces_spans` & `logs_data` | Retains raw telemetry payloads for retro-replay and future ML training models. |
| **Knowledge Graph** | Neo4j | `memory_graph_edges` Table | Formulates node-edge relationships linking users, active sessions, target apps, and events. |
| **Learning Memory** | ClickHouse / Python | `memory_learning` Table | Logs discovered bottlenecks, behavioral correlations, and confidence scores. |

---

## Intelligence & Context Generation

Instead of passing verbose JSON structures, applications request plain-English executive context from:
`GET /api/v1/intelligence/context/{session_id}`

### How Context is Synthesized
1. **Raw Event Aggregation**: The backend collects the last 15 traces, logs, and audits related to the active session.
2. **Gemini 2.5 Flash Synthesis**: If a `GEMINI_API_KEY` is provided, the backend formats the logs into a prompt and requests a single-sentence summary of the user's recent experience and likely intent.
3. **Smart Rule-Based Fallback**: If no key is set, a deterministic rule classifier analyzes the activities (errors, chat requests, purchases) and returns a formatted context string.

---

## Verification & Execution Guide

### 1. Verification Script
We have provided an automated test script [test_memory_fabric.py](file:///d:/Projects/Agentic_accelators/Test_Agents/test_memory_fabric.py) in the root directory. To run it:

```bash
# In your terminal
python test_memory_fabric.py
```

It will:
- Post a simulated multi-application user journey.
- Retrieve the AI-synthesized context for that session.
- Run a semantic vector query matching search.
- Retrieve counts and records from all 6 memory layers.

### 2. Frontend Dashboard
The user interface has been expanded with a premium, dark-mode **Memory Fabric** workspace:
- **Active Context Visualizer**: Live session picker showing context summaries.
- **Knowledge Graph Canvas**: Dynamic node network drawing entity links (Users, Apps, Events) in real-time.
- **Tiers Explorer**: Individual tabs to inspect Redis/Postgres/Qdrant/Neo4j/ClickHouse mocks.
- **Semantic Vector Query Engine**: Test search boxes scanning LLM interactions.

---

## Technical Updates & Resiliency Fixes (June 2026)

### Route Priority Bugfix (FastAPI Router)
- **Problem**: The endpoint `GET /api/v1/apps/stats` was defined below `GET /api/v1/apps/{app_id}` inside [apps.py](file:///d:/Projects/Agentic_accelators/Test_Agents/backend/app/routers/apps.py). FastAPI matches parameters eagerly, treating the request path `/stats` as an application lookup for `app_id="stats"`. This threw a `404 Not Found` payload back to frontend callers.
- **Resolution**: Relocated `@router.get("/stats")` to be registered **above** any parameterized routing paths.

### Resilient Data Fetching & Error Boundaries
- **Problem**: The Memory Fabric UI previously synchronized queries via `Promise.all()`. A single failed network stream or server-side error would reject the entire setup call, collapsing the page into a blank component state.
- **Resolution**: Refined [MemoryFabric.tsx](file:///d:/Projects/Agentic_accelators/Test_Agents/frontend/src/pages/MemoryFabric.tsx) to execute updates with `Promise.allSettled()`. Now, individual component networks are wrapped in local `.catch()` handlers, allowing functional parts of the dashboard to render gracefully even if one of the backend providers drops offline.

### Port Availability
- If port `5173` is occupied during development, Vite automatically boots the user interface on `http://localhost:5174/`.

