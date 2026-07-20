# TraceForge Integration Guide (Zero-Code Instrumentation)

This guide provides instructions on how to integrate your applications with TraceForge **without touching any application code**. We will use OpenTelemetry's Auto-Instrumentation capabilities, which only require installing packages, setting environment variables, and slightly modifying your startup commands.

## 1. Python Backend Integration (Zero-Code)

You can automatically instrument your Python application (FastAPI, Flask, Django, etc.) by wrapping your startup command with the OpenTelemetry instrumentor.

### Step 1: Install Dependencies
Install the OpenTelemetry distribution, OTLP exporter, and the automatic instrumentation packages:
```bash
pip install opentelemetry-distro opentelemetry-exporter-otlp
opentelemetry-bootstrap -a install
```
*(The `bootstrap` command automatically detects installed libraries like FastAPI, Flask, or SQLAlchemy and installs the necessary instrumentation packages for them).*

### Step 2: Set Environment Variables
Set the following environment variables in your terminal, `.env` file, or CI/CD pipeline:
```bash
export OTEL_SERVICE_NAME="my-python-backend"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_METRICS_EXPORTER="otlp"
export OTEL_LOGS_EXPORTER="otlp"
# Point directly to the TraceForge backend
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:8003"
# Inject your TraceForge API Key for authentication
export OTEL_EXPORTER_OTLP_HEADERS="x-otel-api-key=<YOUR_API_KEY>"
```

### Step 3: Modify the Run Command
Prefix your normal startup command (e.g., `python app.py` or `uvicorn main:app`) with `opentelemetry-instrument`:
```bash
# Example for a simple script:
opentelemetry-instrument python app.py

# Example for FastAPI/Uvicorn:
opentelemetry-instrument uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 2. Docker-based Application Integration

If your application is containerized using Docker, you can inject the auto-instrumentation entirely through your `docker-compose.yml` or `docker run` command.

### Example `docker-compose.yml`
You only need to install the OpenTelemetry CLI in your image (or do it during your build pipeline) and override the `command` and `environment` sections. No code changes are required.

```yaml
version: '3.8'

services:
  my-app:
    image: my-app-image:latest
    # Override the container's default startup command
    command: ["opentelemetry-instrument", "python", "app.py"]
    environment:
      - OTEL_SERVICE_NAME=docker-python-app
      - OTEL_TRACES_EXPORTER=otlp
      - OTEL_METRICS_EXPORTER=otlp
      - OTEL_LOGS_EXPORTER=otlp
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://<TRACEFORGE_HOST>:8003
      - OTEL_EXPORTER_OTLP_HEADERS=x-otel-api-key=<YOUR_API_KEY>
    ports:
      - "8000:8000"
```
*Note: Make sure your `my-app-image` already ran `pip install opentelemetry-distro opentelemetry-exporter-otlp` and `opentelemetry-bootstrap -a install` in its Dockerfile.*

---

## 3. Kubernetes Integration (The Operator Approach)

The absolute cleanest way to do zero-code instrumentation in Kubernetes is by using the **OpenTelemetry Operator**. It can automatically inject the auto-instrumentation agents into your Pods at runtime, meaning you don't even need to modify your startup commands or Dockerfiles.

### Step 1: Deploy the OpenTelemetry Operator
*(If you haven't already, install the cert-manager and the OpenTelemetry Operator into your cluster).*

### Step 2: Create an Instrumentation Resource
Create a custom resource that defines your TraceForge configuration and API key.

```yaml
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: traceforge-instrumentation
  namespace: my-app-namespace
spec:
  exporter:
    endpoint: "http://traceforge-service.default.svc.cluster.local:8003"
  env:
    - name: OTEL_EXPORTER_OTLP_HEADERS
      value: "x-otel-api-key=<YOUR_API_KEY>"
```

### Step 3: Annotate your Deployment
To enable auto-instrumentation, simply add a specific annotation to your existing Application's Deployment YAML. The Operator will intercept the pod creation and inject the instrumentation for you.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app-namespace
spec:
  template:
    metadata:
      annotations:
        # This tells the operator to inject Python auto-instrumentation!
        instrumentation.opentelemetry.io/inject-python: "true"
        # Or if it's Java: instrumentation.opentelemetry.io/inject-java: "true"
        # Or NodeJS: instrumentation.opentelemetry.io/inject-nodejs: "true"
    spec:
      containers:
        - name: my-app
          image: my-app-image:latest
```

Once annotated and applied, the Operator automatically wraps your app process, attaches the environment variables from the `Instrumentation` resource, and streams your telemetry to TraceForge seamlessly!

---

## 4. Advanced & Simple: The Wrapper Script Pattern

If you want to apply this to *all* your applications without cluttering your environment or terminal, the most "advanced yet simple" approach is to use a standardized `.env.observability` file and a universal startup wrapper script (`entrypoint.sh`).

This allows you to modify the `run` command universally across all apps without hardcoding variables.

### Step 1: Create a Central `.env.observability`
Create this file in your project root:
```env
OTEL_SERVICE_NAME=my-auto-app
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://<TRACEFORGE_HOST>:8003
OTEL_EXPORTER_OTLP_HEADERS=x-otel-api-key=<YOUR_API_KEY>
```

### Step 2: Create a Universal `entrypoint.sh`
This script auto-installs dependencies, loads the variables, and runs your app with instrumentation.
```bash
#!/bin/bash
# 1. Load observability environment variables silently
if [ -f .env.observability ]; then
  export $(grep -v '^#' .env.observability | xargs)
fi

# 2. Ensure dependencies are installed (optional but highly recommended for zero-touch setup)
pip install opentelemetry-distro opentelemetry-exporter-otlp > /dev/null 2>&1
opentelemetry-bootstrap -a install > /dev/null 2>&1

# 3. Run the application command passed to this script, automatically wrapped with OTel
exec opentelemetry-instrument "$@"
```
*Make it executable:* `chmod +x entrypoint.sh`

### Step 3: Use the Wrapper Universally!
Now, you never have to think about instrumentation again. You just prefix your run command with the script.

**Running locally:**
```bash
./entrypoint.sh uvicorn main:app
```

**Running in Docker (`Dockerfile`):**
```dockerfile
COPY entrypoint.sh /app/entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]
# Just define your normal start command
CMD ["python", "app.py"]
```
This is the cleanest pattern to inject telemetry across a fleet of applications with zero code changes and zero clutter!
