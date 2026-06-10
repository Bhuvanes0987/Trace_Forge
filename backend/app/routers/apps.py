from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import models, schemas

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
        "export OTEL_PYTHON_LOG_LEVEL=debug"
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
        "  - OTEL_PYTHON_LOG_LEVEL=debug"
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
        "OTEL_PYTHON_LOG_LEVEL=debug"
    )


def settings_header_key():
    from ..config import settings
    return settings.INGEST_API_KEY_HEADER

