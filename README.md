# Enterprise Observability & Audit Platform

A centralized, production-grade observability platform designed using **OpenTelemetry OTLP standard specifications** for distributed tracing, log aggregation, and real-time metrics monitoring across **17+ microservices**, with **zero application code changes**.

Includes an **Application Registry Dashboard** that automatically provisions ingestion API keys and outputs copy-paste configuration shell scripts tailored to Python, Node.js, .NET/IIS, Linux VMs (eBPF), and Browser runtimes.

---

## 🏗️ High-Level Architecture

```text
┌────────────────────────────────────────────────────────┐
│               INSTRUMENTED APPLICATIONS                │
│    (Python, Node.js, IIS, VMs, Browser SDK, React)     │
└───────────────────────────┬────────────────────────────┘
                            │ (OTLP / HTTP JSON Protocol)
                            ▼
┌────────────────────────────────────────────────────────┐
│                  FASTAPI INGESTION ENGINE              │
│  ├─ /v1/traces    (OTLP JSON Ingest with App Match)    │
│  ├─ /v1/metrics   (OTLP JSON Ingest with App Match)    │
│  ├─ /v1/logs      (OTLP JSON Ingest with App Match)    │
│  ├─ /api/v1/audit (Enterprise Audit Ingest)            │
│  └─ /api/v1/apps  (Application Registry Management)    │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│                     MYSQL DATABASE                     │
│  ├─ applications registry   ├─ metrics & time-series   │
│  ├─ traces & spans          ├─ audit compliance trails │
│  ├─ system logs             ├─ alert rules & incidents │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│                REACT FRONTEND (VITE + TS)              │
│  ├─ Apps Registry  (Add, View Credentials & Scripts)   │
│  ├─ APM Tracing    (Service-to-service Gantt viewer)   │
│  ├─ Live Metrics   (Interactive line & bar charts)     │
│  ├─ Log Explorer   (Search, severity level, trace lookup)│
│  ├─ Audit Logs     (Filter by app/user, JSON inspect)  │
│  └─ Incidents      (Manage active alerts & rules)      │
└────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start: Spin Up Locally in 60 Seconds

The backend includes a **resilient database engine fallback** that defaults to a local **SQLite** database if no MySQL environment is found. This enables you to boot and explore the application instantly on your machine without configuring a database server!

### Option A: Local Run (No Docker / Fast trial)

#### 1. Setup & Launch FastAPI Backend
```bash
cd backend
python -m venv venv
# On Windows Powershell:
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
*API documentation will be accessible at: `http://localhost:8000/docs`*

#### 2. Run the Multi-Service Telemetry Simulator (Keep running in a separate shell terminal)
```bash
cd backend
# Activate venv if not active
python -m app.simulator
```
*This simulator provisions registered apps (Gateway, Auth, Billing, Inventory, AI) and populates the database with realistic system metrics, exceptions, request tracing loops, and audits every 5 seconds.*

#### 3. Setup & Start the React UI
```bash
cd frontend
npm install
npm run dev
```
*Open your browser and navigate to: `http://localhost:5173`*

---

### Option B: Docker Compose (Production MySQL Stack)

To run the complete platform inside a unified multi-container architecture utilizing a **MySQL 8.0** database:

```bash
docker-compose up --build
```
*After containers boot, the React dashboard will be live at `http://localhost:5173` and database sessions will persist in `mysql_data` volume.*

---

## 🛡️ Zero-Touch Ingestion strategy

OpenTelemetry configuration is loaded at the platform/host level using environment variables. **Your existing application code remains completely untouched.**

### 🐍 Python Auto-Instrumentation
Run standard python processes using OTel's binary wrapper:
```bash
export OTEL_SERVICE_NAME="payment-service"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:8000"
export OTEL_EXPORTER_OTLP_HEADERS="X-OTEL-API-KEY=otel_key_gateway_prod_99"

# Execute your app (no code modifications!)
opentelemetry-instrument uvicorn main:app
```

### 🟢 Node.js Auto-Instrumentation
Use Node's experimental loader hooks at execution:
```bash
export OTEL_SERVICE_NAME="identity-auth-engine"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:8000"
export OTEL_EXPORTER_OTLP_HEADERS="X-OTEL-API-KEY=otel_key_auth_prod_88"

# Boot the process using OTel preload registration
node --require @opentelemetry/auto-instrumentations-node/register app.js
```

### 💻 .NET Applications on IIS
Set environment flags at the host OS registry level:
```powershell
[Environment]::SetEnvironmentVariable("CORECLR_ENABLE_PROFILING", "1", "Machine")
[Environment]::SetEnvironmentVariable("CORECLR_PROFILER", "{918728C2-CC8F-4d05-B0E3-F5E06927C5E9}", "Machine")
[Environment]::SetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:8000", "Machine")
[Environment]::SetEnvironmentVariable("OTEL_EXPORTER_OTLP_HEADERS", "X-OTEL-API-KEY=your-api-key", "Machine")

iisreset
```

---

## 📦 Bundling the Complete Project ZIP

To package the entire source code directory (excluding heavy `node_modules` folders, caches, and database files) into a compact, clean, deliverable `.zip` file, run the custom packager script in the root directory:

```bash
python zip_project.py
```
This will compile a file named **`enterprise_observability_platform.zip`** directly in the root workspace folder, ready for distribution!
