# TraceForge — Enterprise Observability & Context Intelligence Platform

A production-grade **Enterprise Observability + Organizational Memory** platform built on top of the OpenTelemetry standard. It ingests distributed traces, logs, metrics, and AI interactions from 17+ enterprise microservices **without requiring any changes to application source code**, then transforms that raw telemetry into a shared, multi-layered organizational memory and context intelligence brain.

> **What makes this different from a regular observability tool?**  
> TraceForge does not just store telemetry for debugging. It continuously processes every trace, log, metric, and AI interaction from every connected application and converts them into **synthesized context, behavioral knowledge, and predictive intelligence** — shared across the whole enterprise in real time.

---

## Table of Contents

1. [What the Platform Does](#what-the-platform-does)
2. [Full Architecture](#full-architecture)
3. [Feature Modules](#feature-modules)
4. [Memory Fabric Tier Architecture](#memory-fabric-tier-architecture)
5. [Context Intelligence Engine (Gemini 2.5 Flash)](#context-intelligence-engine)
6. [TraceForge Brain Bridge — Quick Start](#traceforge-brain-bridge--quick-start)
7. [API Reference](#api-reference)
8. [Quick Start — Local Run](#quick-start--local-run)
9. [Quick Start — Docker Compose](#quick-start--docker-compose)
10. [Zero-Touch Instrumentation Guide](#zero-touch-instrumentation-guide)
11. [Project File Structure](#project-file-structure)
12. [Testing & Verification](#testing--verification)
13. [Packaging for Delivery](#packaging-for-delivery)

---


## What the Platform Does

### Layer 1 — Core Observability (Existing)
Collects and visualizes standard operational telemetry from all connected enterprise services:

| Capability | Description |
|---|---|
| **Distributed Tracing** | Captures every service-to-service API call as a trace span, including duration, status, and parent-child relationships |
| **Metrics Monitoring** | Ingests CPU, memory, connection pool, error rate, and custom application metrics |
| **Log Aggregation** | Collects structured logs across all services with severity filtering and trace correlation |
| **Compliance Audit Trail** | Records every sensitive user action (login, record delete, data export) with user ID, email, IP, and status |
| **Incident Alerting** | Auto-fires alerts when metrics breach thresholds (e.g. CPU > 85%, error rate > 5%) and auto-resolves when they normalize |
| **App Registry** | Automatically discovers and registers microservices, generates API keys, and outputs copy-paste OTel config scripts |

### Layer 2 — Memory Fabric & Context Intelligence (New)
Processes all ingested telemetry and builds a shared organizational memory:

| Capability | Description |
|---|---|
| **Cross-App Context Synthesis** | Watches what a user does across multiple apps in one session and generates a single-sentence situational summary |
| **Hot Memory (Redis)** | Caches the latest active context per session for instant retrieval |
| **Structured Memory (PostgreSQL)** | Permanently stores extracted business events (failed checkouts, tickets created, AI conversations) |
| **Semantic Memory (Qdrant)** | Stores LLM prompts, completions, and summaries with keyword-based vector search |
| **Knowledge Graph (Neo4j)** | Maps entity relationships: User → Session → App → Event across all services |
| **Learning Memory (ClickHouse)** | Discovers behavioral patterns, bottleneck correlations, and predictive signals |
| **Gemini 2.5 Flash Integration** | Uses Google Gemini to synthesize human-readable context from raw telemetry event lists |

---

## Full Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INSTRUMENTED APPLICATIONS                       │
│         (Python, Node.js, .NET/IIS, Go, React Browser SDK)         │
└────────────────────────────────┬────────────────────────────────────┘
                                 │  Standard OTLP HTTP/Protobuf
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  FASTAPI INGESTION ENGINE  (port 8003)              │
│  ├─ POST /v1/traces        OTLP Protobuf trace ingest               │
│  ├─ POST /v1/metrics       OTLP Protobuf metrics ingest             │
│  ├─ POST /v1/logs          OTLP Protobuf log ingest                 │
│  ├─ POST /api/v1/telemetry/spans    Simplified JSON spans           │
│  ├─ POST /api/v1/telemetry/metrics  Simplified JSON metrics         │
│  ├─ POST /api/v1/telemetry/logs     Simplified JSON logs            │
│  ├─ GET/POST /api/v1/apps           Application registry            │
│  ├─ GET  /api/v1/audit              Compliance audit trail          │
│  ├─ GET  /api/v1/alerts             Incident management             │
│  └─ GET  /api/v1/dashboards         Analytics aggregations          │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
              ▼                                     ▼
┌─────────────────────────┐          ┌─────────────────────────────────┐
│   CORE TELEMETRY DB     │          │   MEMORY FABRIC ENGINE          │
│   (SQLite / MySQL)      │          │   /api/v1/intelligence/*        │
│                         │          │                                 │
│  registered_apps        │          │  ├─ context/{session_id}        │
│  traces_spans           │◄────────►│  ├─ memory  (all 6 tier stats)  │
│  metrics_data           │          │  ├─ graph   (entity relations)  │
│  logs_data              │          │  ├─ insights (patterns learned) │
│  audit_events           │          │  └─ query   (semantic search)   │
│  alerts_incidents       │          │                                 │
│                         │          │  MEMORY FABRIC TABLES           │
│                         │          │  ├─ memory_hot                  │
│                         │          │  ├─ memory_structured           │
│                         │          │  ├─ memory_semantic             │
│                         │          │  ├─ memory_graph_edges          │
│                         │          │  └─ memory_learning             │
└─────────────────────────┘          └──────────────┬──────────────────┘
                                                    │
                                                    ▼
                                     ┌──────────────────────────────┐
                                     │   GEMINI 2.5 FLASH API       │
                                     │   Context Synthesis Engine   │
                                     │   (Falls back to rule-based) │
                                     └──────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   REACT FRONTEND  (Vite + TypeScript)               │
│                                                                     │
│  ├─ Overview          Health KPIs, event rates, error summaries     │
│  ├─ Apps Registry     Register, view credentials, copy OTel scripts │
│  ├─ Distributed Tracing  Service Gantt timeline, span drill-down    │
│  ├─ Metrics Explorer  Live line & bar charts per service            │
│  ├─ LLM Usage         Token counts, cost, latency per AI model      │
│  ├─ Log Explorer      Severity filter, trace correlation, search    │
│  ├─ Compliance Audit  Per-user/app audit trail with JSON inspector  │
│  ├─ Incident Alerts   Active incidents, severity, auto-resolve      │
│  └─ Memory Fabric     Context engine, knowledge graph, memory tiers │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Feature Modules

### Overview Dashboard
The home screen. Shows a live summary across all connected applications:
- Total traces, metrics, logs, and audit events ingested
- Active incident count with severity breakdown
- Error rate trends across all services
- Quick navigation to any feature module

### Apps Registry
Manage the lifecycle of all instrumented services:
- Register new applications and auto-generate OTLP API keys
- View per-app health status (ACTIVE / INACTIVE)
- One-click copy of auto-configured shell scripts for Python, Node.js, .NET/IIS, Linux VM, and Browser SDK setups
- Supports auto-discovery — apps are self-registered the moment they send their first telemetry

### Distributed Tracing
End-to-end journey visibility for every request:
- Gantt-style timeline showing full trace chains with parent/child spans
- Per-span details: endpoint name, duration (ms), status, and raw attribute payload
- Correlate a trace directly to its associated logs in one click
- Filter by application, service name, status code, or time range

### Metrics Explorer
Infrastructure and application health monitoring:
- Real-time line charts: CPU, memory, connection pools, error rates
- LLM-specific metrics: response latency per model, token rate, cost accumulation
- Alert thresholds are evaluated automatically on every incoming metric data point
- Filter by application and time window

### LLM Usage Intelligence
Dedicated AI observability module for applications using any LLM:
- Per-model usage breakdown (GPT-4, Claude, Gemini, etc.)
- Token consumption: input tokens, output tokens, and total
- Calculated cost per API call in USD
- Response time distribution and latency percentile charts
- Powered by the standard `llm_*` metric namespace

### Log Explorer
Centralized structured log management:
- Filter by application, severity (DEBUG / INFO / WARN / ERROR), service name
- Full-text search across all log messages
- Trace ID correlation — jump from a log entry directly to the associated span timeline
- Attribute JSON payload inspector per log record

### Compliance Audit Trail
Enterprise-grade audit logging for regulatory requirements:
- Every user action recorded: who, what, where, when, and result
- Filter by user email, action type, application, and time range
- Supports actions such as `USER_LOGIN`, `RECORD_DELETE`, `DATA_EXPORT`, `CONFIG_CHANGE`
- Exportable, tamper-evident event history

### Incident Alerting
Automated threshold-based alerting engine:
- Pre-configured rules for CPU > 85%, memory > 90%, error rate > 5%, DB pool > 90, AI latency > 2000ms
- Auto-triggers incidents and writes audit records when thresholds are breached
- Auto-resolves incidents when metrics normalize
- One-click manual resolution with acknowledgment tracking

### Memory Fabric (Intelligence Layer)
The organizational brain. See [Memory Fabric Tier Architecture](#memory-fabric-tier-architecture) below.

---

## Memory Fabric Tier Architecture

The Memory Fabric is a multi-layer storage and synthesis system that converts raw telemetry into contextual organizational knowledge.

```
Raw Telemetry Events
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│                Context Enrichment Engine                  │
│  Reads spans + logs + audits for a given session ID       │
│  ↓                                                        │
│  Formats into an event timeline                           │
│  ↓                                                        │
│  Calls Gemini 2.5 Flash to write a 1-sentence summary     │
│  (Falls back to rule-based classifier if no API key)      │
└───────────────────────────────────────────────────────────┘
        │
   ┌────┼───────────────────────────────────────────────┐
   ▼    ▼          ▼              ▼              ▼       ▼
  HOT  STRUCT   SEMANTIC       GRAPH         LEARNING  HIST
```

| Tier | Simulates | Table | What Gets Stored |
|---|---|---|---|
| **Hot Memory** | Redis Cluster | `memory_hot` | Active user session ID, user identity, last synthesized context, TTL |
| **Structured Memory** | PostgreSQL | `memory_structured` | Business events extracted from telemetry: `CHECKOUT_FAILED`, `SUPPORT_CHAT`, `ORDER_PLACED` |
| **Semantic Memory** | Qdrant | `memory_semantic` | LLM prompt text, completion response, contextual summary, model name |
| **Historical Memory** | S3 / MinIO Parquet | `traces_spans` + `logs_data` | Raw telemetry payloads for replay and future ML training |
| **Knowledge Graph** | Neo4j | `memory_graph_edges` | Node-edge relationships: `USER → OWNED_SESSION → SESSION → ACCESSED_APP → FlowTracer` |
| **Learning Memory** | ClickHouse + Python | `memory_learning` | Patterns like "DB pool exhaustion always precedes AI support escalations" with confidence scores |

---

## Context Intelligence Engine

### How It Works

**Step 1 — Event Collection**
When any application requests context for a session, the engine queries the last 15 traces, 15 logs, and 10 audit records associated with that `session_id`.

**Step 2 — Context Synthesis with Gemini 2.5 Flash**
The events are formatted into a structured prompt and sent to the **Gemini 2.5 Flash** generative API:

```
Before (raw telemetry):
  - [flowtracer-api] POST /api/v1/checkout ERROR: DatabasePoolTimeoutException
  - [flowtracer-api] LOG ERROR: Connection pool exhausted (limit 90 reached)
  - [frictionx-llm-engine] POST /api/v1/chat/completions OK 1800ms
  - [AuditService] USER_LOGIN SUCCESS user@company.com

After (synthesized context):
  "User encountered a database connection pool timeout during checkout on
   FlowTracer, then escalated to FrictionX AI support to confirm whether
   their order was processed and request a refund."
```

**Step 3 — Hot Memory Write**
The synthesized context is stored in the `memory_hot` table and is immediately available to any application that needs it.

**Step 4 — Fallback Rule Engine**
If no Gemini API key is configured, a rule-based classifier analyzes the events for known patterns (errors, purchases, support escalations) and generates a structured context string without any external API call.

### Configuring Gemini API Key

**Option A — Environment Variable (Backend)**
```bash
# In backend/.env
GEMINI_API_KEY=your_gemini_api_key_here
```

**Option B — Frontend UI (Runtime)**
Navigate to **Memory Fabric** in the sidebar → paste your key into the Gemini Context Engine panel → click **Apply Key**. The key is saved to browser local storage and sent as a request header on every context synthesis call.

---

## TraceForge Brain Bridge — Quick Start

### 1. Install dependencies
```bash
pip install requests google-generativeai schedule python-dotenv
```

### 2. Configure
```bash
cp .env.example .env
# edit .env with your keys
```

### 3. Run modes

#### Once (test it)
```bash
python traceforge_obsidian_bridge.py
```

#### Continuous loop (every 15 min)
```bash
python traceforge_obsidian_bridge.py --loop
```

#### Specific session only
```bash
python traceforge_obsidian_bridge.py --session sess_abc123
```

---

### 4. Automate with cron (Linux / Mac)

Run `crontab -e` and add:
```
*/15 * * * * cd /path/to/bridge && python traceforge_obsidian_bridge.py >> logs/bridge.log 2>&1
```

### 5. Automate with Task Scheduler (Windows)

```powershell
$action  = New-ScheduledTaskAction -Execute "python" -Argument "C:\path\to\traceforge_obsidian_bridge.py" -WorkingDirectory "C:\path\to\bridge"
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 15) -Once -At (Get-Date)
Register-ScheduledTask -TaskName "TraceForge Brain Bridge" -Action $action -Trigger $trigger
```

---

### What gets written to your vault

```
Daily Notes/
  2026-06-10.md          ← brain sync section appended every 15 min

Memory/
  Sessions/
    2026-06-10-sess_abc1.md   ← one note per session
    2026-06-10-sess_def2.md
  Graphs/
    graph-2026-W24.md    ← weekly knowledge graph snapshot (Mondays)
```

### Obsidian Local REST API plugin setup

1. Open Obsidian → Settings → Community Plugins → Browse
2. Search "Local REST API" → Install → Enable
3. Go to plugin settings → copy the API key
4. Paste into `OBSIDIAN_APIKEY` in your `.env`
5. Keep Obsidian open (or use `OBSIDIAN_VAULT` filesystem fallback)

---


## API Reference

### Core Telemetry Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/traces` | OTLP Protobuf trace ingest |
| `POST` | `/v1/metrics` | OTLP Protobuf metrics ingest |
| `POST` | `/v1/logs` | OTLP Protobuf log ingest |
| `POST` | `/api/v1/telemetry/spans` | Simplified JSON span ingest |
| `POST` | `/api/v1/telemetry/metrics` | Simplified JSON metric ingest |
| `POST` | `/api/v1/telemetry/logs` | Simplified JSON log ingest |
| `GET` | `/api/v1/apps` | List all registered applications |
| `POST` | `/api/v1/apps` | Register a new application |
| `GET` | `/api/v1/audit` | Query compliance audit trail |
| `GET` | `/api/v1/alerts` | List incident alerts |
| `GET` | `/api/v1/dashboards/summary` | Platform-wide health KPIs |

### Memory Fabric & Intelligence Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/intelligence/context/{session_id}` | Synthesize or retrieve active context for a session |
| `GET` | `/api/v1/intelligence/memory` | Statistics and samples from all 6 memory tiers |
| `GET` | `/api/v1/intelligence/graph` | Knowledge graph nodes and edges for rendering |
| `GET` | `/api/v1/intelligence/insights` | Discovered behavioral patterns and predictions |
| `POST` | `/api/v1/intelligence/query` | Semantic keyword search across semantic memory |
| `POST` | `/api/v1/intelligence/seed-journey` | Inject a synthetic multi-app user journey for testing |

---

## Quick Start — Local Run

> The backend defaults to a local **SQLite** database (`observability.db`) with no configuration required. Boot the full stack in under 60 seconds.

### Step 1 — Start the FastAPI Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8003
```
API docs: `http://localhost:8003/docs`

### Step 2 — Seed the Database (Optional but Recommended)
```bash
# Run from the root project directory
python -m backend.app.simulator
```
This will:
- Register FrictionX and FlowTracer applications
- Seed all 6 memory fabric tiers with realistic cross-app user journeys
- Populate 30 historical time-points of telemetry data (traces, metrics, logs, audits)
- Start a live simulation loop generating new telemetry every 5 seconds

### Step 3 — Start the React Frontend
```bash
cd frontend
npm install
npm run dev
```
Open browser at: `http://localhost:5173`

### Step 4 — Verify the Memory Fabric
```bash
# Run from the root project directory
python test_memory_fabric.py
```
Expected output: all 6 memory tiers populated, context synthesized, semantic search returning results.

---

## Quick Start — Docker Compose

To run the full production stack (MySQL 8.0 + Backend + Frontend) inside Docker:

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| React Dashboard | `http://localhost:5173` |
| FastAPI Backend | `http://localhost:8003` |
| API Documentation | `http://localhost:8003/docs` |
| MySQL Database | `localhost:3306` |

Database sessions persist between container restarts in the `mysql_data` Docker volume.

---

## Zero-Touch Instrumentation Guide

OpenTelemetry configuration is applied at the host or process level using environment variables. **Your application source code is never modified.**

### Python Auto-Instrumentation
```bash
pip install opentelemetry-distro opentelemetry-exporter-otlp
opentelemetry-bootstrap -a install

export OTEL_SERVICE_NAME="payment-service"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:8003"
export OTEL_EXPORTER_OTLP_HEADERS="X-OTEL-API-KEY=your_api_key"

opentelemetry-instrument uvicorn main:app
```

### Node.js Auto-Instrumentation
```bash
npm install @opentelemetry/auto-instrumentations-node

export OTEL_SERVICE_NAME="identity-auth-engine"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:8003"
export OTEL_EXPORTER_OTLP_HEADERS="X-OTEL-API-KEY=your_api_key"

node --require @opentelemetry/auto-instrumentations-node/register app.js
```

### .NET / IIS Auto-Instrumentation
```powershell
[Environment]::SetEnvironmentVariable("CORECLR_ENABLE_PROFILING", "1", "Machine")
[Environment]::SetEnvironmentVariable("CORECLR_PROFILER", "{918728C2-CC8F-4d05-B0E3-F5E06927C5E9}", "Machine")
[Environment]::SetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:8003", "Machine")
[Environment]::SetEnvironmentVariable("OTEL_EXPORTER_OTLP_HEADERS", "X-OTEL-API-KEY=your_api_key", "Machine")
iisreset
```

---

## Project File Structure

```
TraceForge/
│
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, router registration
│   │   ├── config.py            # Settings (database URL, app name, API key header)
│   │   ├── database.py          # SQLAlchemy engine, session factory, migration helper
│   │   ├── models.py            # All database table definitions
│   │   │   ├── RegisteredApp    # Microservice registry
│   │   │   ├── TraceSpan        # Distributed trace spans
│   │   │   ├── MetricData       # Application and infrastructure metrics
│   │   │   ├── LogData          # Structured application logs
│   │   │   ├── AuditEvent       # Compliance audit trail
│   │   │   ├── AlertIncident    # Threshold-based alerts
│   │   │   ├── MemoryHot        # [NEW] Active session context (Redis sim)
│   │   │   ├── MemoryStructured # [NEW] Business facts (PostgreSQL sim)
│   │   │   ├── MemorySemantic   # [NEW] LLM interaction vectors (Qdrant sim)
│   │   │   ├── MemoryGraph      # [NEW] Entity relationships (Neo4j sim)
│   │   │   └── MemoryLearning   # [NEW] Behavioral patterns (ClickHouse sim)
│   │   ├── schemas.py           # Pydantic request/response models
│   │   ├── simulator.py         # Telemetry simulator + memory fabric seeder
│   │   └── routers/
│   │       ├── apps.py          # Application registry CRUD
│   │       ├── telemetry.py     # OTLP ingest + simplified JSON receivers
│   │       ├── audit.py         # Audit log queries
│   │       ├── dashboards.py    # Analytics aggregations
│   │       ├── alerts.py        # Incident management
│   │       └── intelligence.py  # [NEW] Memory Fabric & Context Intelligence
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   └── src/
│       ├── App.tsx              # Root app, navigation sidebar, tab routing
│       ├── index.css            # Design system tokens, dark-mode theme
│       └── pages/
│           ├── Overview.tsx         # Platform health KPI summary
│           ├── AppsRegistry.tsx     # App registration and OTel scripts
│           ├── HostedApps.tsx       # Hosted application viewer
│           ├── Tracing.tsx          # Distributed trace Gantt viewer
│           ├── Metrics.tsx          # Live metrics charts
│           ├── LLMUsage.tsx         # AI token/cost/latency dashboard
│           ├── Logs.tsx             # Structured log explorer
│           ├── Audit.tsx            # Compliance audit trail
│           ├── Alerts.tsx           # Incident alerting manager
│           └── MemoryFabric.tsx     # [NEW] Context Intelligence dashboard
│
├── test_memory_fabric.py        # [NEW] Automated API verification script
├── README_MEMORY_FABRIC.md      # [NEW] Memory Fabric technical architecture doc
├── README.md                    # This file
├── add_frictionx_llm_data.py    # Script to seed LLM usage data for FrictionX
├── test_otlp.py                 # OTLP ingest endpoint test script
├── zip_project.py               # Project packaging utility
└── docker-compose.yml           # Full production Docker stack
```

---

## Testing & Verification

### Automated Memory Fabric Test
```bash
python test_memory_fabric.py
```
Verifies:
1. Multi-app user journey seed succeeds
2. Session context synthesis returns a human-readable summary
3. Semantic memory keyword search returns relevance-ranked matches
4. All 6 memory tier counters are non-zero and status is ONLINE

### Manual UI Verification
1. Open `http://localhost:5173` (or `http://localhost:5174` if port 5173 is in use)
2. Click **Memory Fabric** in the left sidebar
3. Click **Trigger Simulation Journey** — this seeds a FlowTracer→FrictionX session
4. Observe the Knowledge Graph canvas update with new User, Session, App, and Event nodes
5. Select the new session from the dropdown — the Active Context panel shows the synthesized summary
6. Enter `"checkout"` in the Semantic Search box and verify LLM dialogue matches appear

---

## Technical Updates & Bug Fixes (June 2026)

### 1. FastAPI Route Shadowing Resolved
- **Issue**: The `/stats` endpoint on the applications router (`GET /api/v1/apps/stats`) was declared below the wildcard path parameter route `GET /api/v1/apps/{app_id}`. This caused FastAPI to match requests to `/stats` as an application ID lookup (`app_id="stats"`), triggering `404 Not Found` exceptions and rendering blank dashboard pages.
- **Fix**: Reordered routes in [apps.py](file:///d:/Projects/Agentic_accelators/Test_Agents/backend/app/routers/apps.py) so `@router.get("/stats")` is declared before any parameter-based wildcard matches.

### 2. Frontend Fetch Resiliency
- **Issue**: The dashboard relied on a strict `Promise.all` invocation for API orchestration. Any failure or slow response on a single endpoint (like `/stats`) caused the entire page promise chain to reject, leading to a blank UI rendering crash.
- **Fix**: Modified [MemoryFabric.tsx](file:///d:/Projects/Agentic_accelators/Test_Agents/frontend/src/pages/MemoryFabric.tsx) to utilize `Promise.allSettled` for concurrent loading, protected individual fetch items with localized `.catch()` exception handlers, and introduced defensive data checking.

---

## Packaging for Delivery

To package the full source code (excluding `node_modules`, caches, and database files) into a clean ZIP:

```bash
python zip_project.py
```

Output: `enterprise_observability_platform.zip` in the root directory, ready for distribution.

