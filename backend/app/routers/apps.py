from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from sqlalchemy.orm import Session
import json
import datetime
from typing import List

from ..database import get_db
from .. import models, schemas, simulator

router = APIRouter(
    prefix="/api/v1/apps",
    tags=["Application Registry"]
)

@router.post("/", response_model=schemas.RegisteredAppResponse)
def register_app(app: schemas.RegisteredAppCreate, db: Session = Depends(get_db)):
    # Check if app with same name already exists
    existing = db.query(models.RegisteredApp).filter(models.RegisteredApp.name == app.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="An application with this name is already registered.")

    db_app = models.RegisteredApp(
        name=app.name,
        environment=app.environment.upper(),
        tech_stack=app.tech_stack,
        url=app.url
    )
    db.add(db_app)
    db.commit()
    db.refresh(db_app)

    # Auto-seed full observability telemetry for newly registered applications
    simulator.generate_initial_app_telemetry(db, db_app)

    return db_app

@router.get("/", response_model=List[schemas.RegisteredAppResponse])
def list_apps(db: Session = Depends(get_db)):
    return db.query(models.RegisteredApp).all()

@router.get("/stats")
def list_apps_with_stats(db: Session = Depends(get_db)):
    apps = db.query(models.RegisteredApp).all()
    res = []
    for app in apps:
        # Query accurate count of spans, logs, metrics, audits
        spans_count = db.query(models.TraceSpan).filter(models.TraceSpan.app_id == app.id).count()
        logs_count = db.query(models.LogData).filter(models.LogData.app_id == app.id).count()
        metrics_count = db.query(models.MetricData).filter(models.MetricData.app_id == app.id).count()
        audit_count = db.query(models.AuditEvent).filter(models.AuditEvent.app_id == app.id).count()
        
        # Dynamically calculate knowledge, memory, context values based on dynamic counts
        knowledge = min(100, int(60 + (spans_count * 2 + logs_count) // 5) if spans_count + logs_count > 0 else 50)
        memory = min(100, int(40 + (spans_count * 3 + audit_count) // 4) if spans_count + audit_count > 0 else 30)
        context = min(100, int(50 + (metrics_count * 4 + logs_count) // 3) if metrics_count + logs_count > 0 else 40)
        
        # Get recent events from OTel database for this application
        recent_spans = db.query(models.TraceSpan).filter(models.TraceSpan.app_id == app.id).order_by(models.TraceSpan.start_time.desc()).limit(3).all()
        events = []
        for s in recent_spans:
            events.append(f"{s.name} \u2014 {s.status_code} \u2014 {s.duration_ms:.1f}ms")
            
        # Get learned behavior (RLM) description from DB or fallback
        learned = "Enrichment pipeline active. Capturing trace spans and log streams dynamically."
        learning_item = db.query(models.MemoryLearning).filter(
            (models.MemoryLearning.details.like(f"%{app.name}%")) | 
            (models.MemoryLearning.description.like(f"%{app.name}%"))
        ).order_by(models.MemoryLearning.timestamp.desc()).first()
        if learning_item:
            learned = learning_item.description
            
        res.append({
            "id": app.id,
            "app_id": app.app_id,
            "name": app.name,
            "environment": app.environment,
            "tech_stack": app.tech_stack,
            "url": app.url,
            "api_key": app.api_key,
            "status": app.status,
            "knowledge": knowledge,
            "memory": memory,
            "context": context,
            "signals": {
                "traces": spans_count,
                "logs": logs_count,
                "metrics": metrics_count,
                "audit": audit_count
            },
            "events": events if events else ["No telemetry events captured yet"],
            "learned": learned
        })
    return res

@router.get("/{app_id}", response_model=schemas.RegisteredAppResponse)
def get_app(app_id: str, db: Session = Depends(get_db)):
    app = db.query(models.RegisteredApp).filter(models.RegisteredApp.app_id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")
    return app

@router.delete("/{app_id}")
def delete_app(app_id: str, db: Session = Depends(get_db)):
    app = db.query(models.RegisteredApp).filter(models.RegisteredApp.app_id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")
    db.delete(app)
    db.commit()
    return {"message": f"Application '{app.name}' successfully de-registered."}

@router.get("/{app_id}/snippets")
def get_instrumentation_snippets(app_id: str, db: Session = Depends(get_db)):
    app = db.query(models.RegisteredApp).filter(models.RegisteredApp.app_id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    api_key = app.api_key
    snippets = {}

    otel_env = build_otel_environment_snippet(app.name, api_key)
    otel_env_docker = build_otel_docker_compose_snippet(app.name, api_key)
    otel_env_file = build_otel_env_file_snippet(app.name, api_key)

    # 1. Python FastAPI / Flask
    snippets["python"] = {
        "title": "Python Auto-Instrumentation",
        "description": "Run your Python web services with zero code changes using the standard OpenTelemetry loader.",
        "install": "pip install opentelemetry-distro opentelemetry-exporter-otlp\nopentelemetry-bootstrap -a install",
        "environment": otel_env,
        "run": "opentelemetry-instrument uvicorn main:app --host 0.0.0.0 --port 8003"
    }

    snippets["otel_configuration"] = {
        "title": "High-level OpenTelemetry Environment Configuration",
        "description": "Copy these settings once into your shell, Docker container, or .env file to fully configure OTLP export for traces, metrics, and logs.",
        "shell": otel_env,
        "docker_compose": otel_env_docker,
        "env_file": otel_env_file
    }

    # Additional snippets omitted for brevity (nodejs, dotnet, ebpf, browser)
    return snippets

def build_otel_environment_snippet(app_name: str, api_key: str) -> str:
    service_name = app_name.lower().replace(' ', '-')
    header_key = settings_header_key()
    return (
        f"export OTEL_SERVICE_NAME=\"{service_name}\"\n"
        "export OTEL_TRACES_EXPORTER=\"otlp\"\n"
        "export OTEL_METRICS_EXPORTER=\"otlp\"\n"
        "export OTEL_LOGS_EXPORTER=\"otlp\"\n"
        "export OTEL_EXPORTER_OTLP_ENDPOINT=\"http://localhost:8003\"\n"
        "export OTEL_EXPORTER_OTLP_PROTOCOL=\"http/protobuf\"\n"
        f"export OTEL_EXPORTER_OTLP_HEADERS=\"{header_key}={api_key}\"\n"
        "export OTEL_EXPORTER_OTLP_TIMEOUT=30000\n"
        "export OTEL_EXPORTER_OTLP_TRACES_TIMEOUT=30000\n"
        "export OTEL_EXPORTER_OTLP_METRICS_TIMEOUT=30000\n"
        "export OTEL_EXPORTER_OTLP_LOGS_TIMEOUT=30000\n"
        "export OTEL_TRACES_SAMPLER=always_on\n"
        "export OTEL_BSP_SCHEDULE_DELAY=1000\n"
        "export OTEL_BSP_MAX_EXPORT_BATCH_SIZE=512\n"
        "export OTEL_BSP_MAX_QUEUE_SIZE=2048\n"
        "export OTEL_METRIC_EXPORT_INTERVAL=10000\n"
        "export OTEL_METRIC_EXPORT_TIMEOUT=30000\n"
        "export OTEL_PYTHON_LOG_CORRELATION=true\n"
        "export OTEL_PYTHON_LOGGING_AUTO_INSTRUMENTATION_ENABLED=true\n"
        "export OTEL_PYTHON_LOG_LEVEL=debug\n"
        "export TRACELOOP_TRACE_CONTENT=true"
    )


def build_otel_docker_compose_snippet(app_name: str, api_key: str) -> str:
    service_name = app_name.lower().replace(' ', '-')
    header_key = settings_header_key()
    return (
        "environment:\n"
        f"  - OTEL_SERVICE_NAME={service_name}\n"
        "  - OTEL_TRACES_EXPORTER=otlp\n"
        "  - OTEL_METRICS_EXPORTER=otlp\n"
        "  - OTEL_LOGS_EXPORTER=otlp\n"
        "  - OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:8003\n"
        "  - OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf\n"
        f"  - OTEL_EXPORTER_OTLP_HEADERS={header_key}={api_key}\n"
        "  - OTEL_EXPORTER_OTLP_TIMEOUT=30000\n"
        "  - OTEL_EXPORTER_OTLP_TRACES_TIMEOUT=30000\n"
        "  - OTEL_EXPORTER_OTLP_METRICS_TIMEOUT=30000\n"
        "  - OTEL_EXPORTER_OTLP_LOGS_TIMEOUT=30000\n"
        "  - OTEL_TRACES_SAMPLER=always_on\n"
        "  - OTEL_BSP_SCHEDULE_DELAY=1000\n"
        "  - OTEL_BSP_MAX_EXPORT_BATCH_SIZE=512\n"
        "  - OTEL_BSP_MAX_QUEUE_SIZE=2048\n"
        "  - OTEL_METRIC_EXPORT_INTERVAL=10000\n"
        "  - OTEL_METRIC_EXPORT_TIMEOUT=30000\n"
        "  - OTEL_PYTHON_LOG_CORRELATION=true\n"
        "  - OTEL_PYTHON_LOGGING_AUTO_INSTRUMENTATION_ENABLED=true\n"
        "  - OTEL_PYTHON_LOG_LEVEL=debug\n"
        "  - TRACELOOP_TRACE_CONTENT=true"
    )


def build_otel_env_file_snippet(app_name: str, api_key: str) -> str:
    service_name = app_name.lower().replace(' ', '-')
    header_key = settings_header_key()
    return (
        f"OTEL_SERVICE_NAME={service_name}\n"
        "OTEL_TRACES_EXPORTER=otlp\n"
        "OTEL_METRICS_EXPORTER=otlp\n"
        "OTEL_LOGS_EXPORTER=otlp\n"
        "OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:8003\n"
        "OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf\n"
        f"OTEL_EXPORTER_OTLP_HEADERS={header_key}={api_key}\n"
        "OTEL_EXPORTER_OTLP_TIMEOUT=30000\n"
        "OTEL_EXPORTER_OTLP_TRACES_TIMEOUT=30000\n"
        "OTEL_EXPORTER_OTLP_METRICS_TIMEOUT=30000\n"
        "OTEL_EXPORTER_OTLP_LOGS_TIMEOUT=30000\n"
        "OTEL_TRACES_SAMPLER=always_on\n"
        "OTEL_BSP_SCHEDULE_DELAY=1000\n"
        "OTEL_BSP_MAX_EXPORT_BATCH_SIZE=512\n"
        "OTEL_BSP_MAX_QUEUE_SIZE=2048\n"
        "OTEL_METRIC_EXPORT_INTERVAL=10000\n"
        "OTEL_METRIC_EXPORT_TIMEOUT=30000\n"
        "OTEL_PYTHON_LOG_CORRELATION=true\n"
        "OTEL_PYTHON_LOGGING_AUTO_INSTRUMENTATION_ENABLED=true\n"
        "OTEL_PYTHON_LOG_LEVEL=debug\n"
        "TRACELOOP_TRACE_CONTENT=true"
    )


def settings_header_key():
    from ..config import settings
    return settings.INGEST_API_KEY_HEADER


def get_app_from_api_key(request: Request, db: Session):
    from ..config import settings
    header_key = settings.INGEST_API_KEY_HEADER.lower()
    api_key = request.headers.get(header_key)
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API key header")
    app = db.query(models.RegisteredApp).filter(models.RegisteredApp.api_key == api_key).first()
    if not app:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return app


def parse_otlp_attributes(attrs_list):
    res = {}
    if not attrs_list: return res
    for attr in attrs_list:
        key = attr.get("key")
        val_obj = attr.get("value", {})
        if "stringValue" in val_obj: res[key] = val_obj["stringValue"]
        elif "intValue" in val_obj: res[key] = int(val_obj["intValue"])
        elif "doubleValue" in val_obj: res[key] = float(val_obj["doubleValue"])
        elif "boolValue" in val_obj: res[key] = bool(val_obj["boolValue"])
        elif "arrayValue" in val_obj:
            res[key] = [list(v.values())[0] for v in val_obj["arrayValue"].get("values", []) if v]
    return res


@router.post("/ingest/otlp/v1/traces", status_code=status.HTTP_202_ACCEPTED)
async def ingest_otlp_traces(request: Request, db: Session = Depends(get_db)):
    app = get_app_from_api_key(request, db)
    payload = await request.json()
    
    for resource_span in payload.get("resourceSpans", []):
        resource = resource_span.get("resource", {})
        res_attrs = parse_otlp_attributes(resource.get("attributes", []))
        service_name = res_attrs.get("service.name", app.name)
        
        for scope_span in resource_span.get("scopeSpans", []):
            for span in scope_span.get("spans", []):
                span_attrs = parse_otlp_attributes(span.get("attributes", []))
                
                start_ns = int(span.get("startTimeUnixNano", 0))
                end_ns = int(span.get("endTimeUnixNano", 0))
                duration_ms = (end_ns - start_ns) / 1_000_000.0 if end_ns > start_ns else 0.0
                
                db_span = models.TraceSpan(
                    app_id=app.id,
                    trace_id=span.get("traceId", ""),
                    span_id=span.get("spanId", ""),
                    parent_span_id=span.get("parentSpanId"),
                    name=span.get("name", "unnamed_span"),
                    service_name=service_name,
                    start_time=datetime.datetime.utcfromtimestamp(start_ns / 1e9) if start_ns else datetime.datetime.utcnow(),
                    end_time=datetime.datetime.utcfromtimestamp(end_ns / 1e9) if end_ns else datetime.datetime.utcnow(),
                    duration_ms=duration_ms,
                    status_code="ERROR" if span.get("status", {}).get("code") == 2 else "OK",
                    status_message=span.get("status", {}).get("message"),
                    attributes=span_attrs
                )
                db.add(db_span)
    db.commit()
    return {"status": "accepted"}


@router.post("/ingest/otlp/v1/metrics", status_code=status.HTTP_202_ACCEPTED)
async def ingest_otlp_metrics(request: Request, db: Session = Depends(get_db)):
    app = get_app_from_api_key(request, db)
    payload = await request.json()
    
    for resource_metric in payload.get("resourceMetrics", []):
        resource = resource_metric.get("resource", {})
        res_attrs = parse_otlp_attributes(resource.get("attributes", []))
        service_name = res_attrs.get("service.name", app.name)
        
        for scope_metric in resource_metric.get("scopeMetrics", []):
            for metric in scope_metric.get("metrics", []):
                metric_name = metric.get("name", "unnamed_metric")
                data_points = []
                if "gauge" in metric: data_points = metric["gauge"].get("dataPoints", [])
                elif "sum" in metric: data_points = metric["sum"].get("dataPoints", [])
                
                for dp in data_points:
                    val = dp.get("asDouble") or dp.get("asInt") or 0.0
                    ts_ns = int(dp.get("timeUnixNano", 0))
                    labels = parse_otlp_attributes(dp.get("attributes", []))
                    
                    db_metric = models.MetricData(
                        app_id=app.id,
                        metric_name=metric_name,
                        service_name=service_name,
                        value=float(val),
                        timestamp=datetime.datetime.utcfromtimestamp(ts_ns / 1e9) if ts_ns else datetime.datetime.utcnow(),
                        labels=labels
                    )
                    db.add(db_metric)
    db.commit()
    return {"status": "accepted"}


@router.post("/ingest/otlp/v1/logs", status_code=status.HTTP_202_ACCEPTED)
async def ingest_otlp_logs(request: Request, db: Session = Depends(get_db)):
    app = get_app_from_api_key(request, db)
    payload = await request.json()
    
    for resource_log in payload.get("resourceLogs", []):
        resource = resource_log.get("resource", {})
        res_attrs = parse_otlp_attributes(resource.get("attributes", []))
        service_name = res_attrs.get("service.name", app.name)
        
        for scope_log in resource_log.get("scopeLogs", []):
            for log_record in scope_log.get("logRecords", []):
                attrs = parse_otlp_attributes(log_record.get("attributes", []))
                ts_ns = int(log_record.get("timeUnixNano", 0))
                
                body = log_record.get("body", {})
                message = body.get("stringValue", str(body))
                
                db_log = models.LogData(
                    app_id=app.id,
                    trace_id=log_record.get("traceId"),
                    span_id=log_record.get("spanId"),
                    service_name=service_name,
                    severity=log_record.get("severityText", "INFO"),
                    message=message,
                    timestamp=datetime.datetime.utcfromtimestamp(ts_ns / 1e9) if ts_ns else datetime.datetime.utcnow(),
                    attributes=attrs
                )
                db.add(db_log)
    db.commit()
    return {"status": "accepted"}
