from fastapi import APIRouter, Depends, Request, Header
from sqlalchemy.orm import Session
from typing import Optional
import json

from ..database import get_db
from .. import models
from typing import List
from .. import schemas
import datetime 

from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest
from opentelemetry.proto.collector.metrics.v1.metrics_service_pb2 import ExportMetricsServiceRequest
from opentelemetry.proto.collector.logs.v1.logs_service_pb2 import ExportLogsServiceRequest

router = APIRouter(tags=["OpenTelemetry Ingest"])


# -----------------------------
# Helper: Get or Auto-create App
# -----------------------------
def get_app_by_api_key_or_name(
    db: Session,
    api_key: Optional[str],
    service_name: str
) -> models.RegisteredApp:

    if api_key:
        app = db.query(models.RegisteredApp).filter(
            models.RegisteredApp.api_key == api_key
        ).first()
        if app:
            return app

    clean_service = service_name.lower().replace("-", " ").replace("_", " ").strip()

    app = db.query(models.RegisteredApp).filter(
        models.RegisteredApp.name.ilike(f"%{clean_service}%")
    ).first()

    if app:
        return app

    # Auto-register app
    env = "DEVELOPMENT"
    if "prod" in service_name.lower():
        env = "PRODUCTION"
    elif "stage" in service_name.lower():
        env = "STAGING"

    new_app = models.RegisteredApp(
        name=service_name.replace("-", " ").replace("_", " ").title(),
        environment=env,
        tech_stack="Auto Discovered / OTel",
        url=None
    )

    db.add(new_app)
    db.commit()
    db.refresh(new_app)

    return new_app


# -----------------------------
# TRACES
# -----------------------------
@router.post("/v1/traces")
async def ingest_otlp_traces(
    request: Request,
    db: Session = Depends(get_db),
    x_otel_api_key: Optional[str] = Header(None)
):
    content_type = request.headers.get("content-type", "")
    body = await request.body()

    if "application/x-protobuf" in content_type:
        try:
            req = ExportTraceServiceRequest()
            req.ParseFromString(body)
            spans_added = 0
            for resource_span in req.resource_spans:
                service_name = "unknown_service"
                for attr in resource_span.resource.attributes:
                    if attr.key == "service.name":
                        service_name = attr.value.string_value
                        break
                        
                app = get_app_by_api_key_or_name(db, x_otel_api_key, service_name)
                
                for scope_span in resource_span.scope_spans:
                    for span in scope_span.spans:
                        db_span = models.TraceSpan(
                            app_id=app.id,
                            trace_id=span.trace_id.hex(),
                            span_id=span.span_id.hex(),
                            parent_span_id=span.parent_span_id.hex() if span.parent_span_id else None,
                            name=span.name,
                            service_name=service_name,
                            start_time=datetime.datetime.utcfromtimestamp(span.start_time_unix_nano / 1e9),
                            end_time=datetime.datetime.utcfromtimestamp(span.end_time_unix_nano / 1e9),
                            duration_ms=max(0.0, (span.end_time_unix_nano - span.start_time_unix_nano) / 1e6),
                            status_code="ERROR" if span.status.code == 2 else "OK",
                            attributes={kv.key: str(kv.value) for kv in span.attributes}
                        )
                        db.add(db_span)
                        spans_added += 1
            db.commit()
            return {"status": "success", "spans_ingested": spans_added}
        except Exception as e:
            return {"status": "error", "message": f"Failed parsing trace protobuf: {e}"}

    return {"status": "error", "message": "Only application/x-protobuf is supported on this endpoint."}


# -----------------------------
# METRICS
# -----------------------------
@router.post("/v1/metrics")
async def ingest_otlp_metrics(
    request: Request,
    db: Session = Depends(get_db),
    x_otel_api_key: Optional[str] = Header(None)
):
    content_type = request.headers.get("content-type", "")
    body = await request.body()

    if "application/x-protobuf" in content_type:
        try:
            req = ExportMetricsServiceRequest()
            req.ParseFromString(body)
            metrics_added = 0
            for resource_metric in req.resource_metrics:
                service_name = "unknown_service"
                for attr in resource_metric.resource.attributes:
                    if attr.key == "service.name":
                        service_name = attr.value.string_value
                        break
                        
                app = get_app_by_api_key_or_name(db, x_otel_api_key, service_name)
                
                for scope_metric in resource_metric.scope_metrics:
                    for metric in scope_metric.metrics:
                        data_points = []
                        if metric.HasField("gauge"):
                            data_points = metric.gauge.data_points
                        elif metric.HasField("sum"):
                            data_points = metric.sum.data_points
                            
                        for dp in data_points:
                            val = dp.as_double if dp.HasField("as_double") else float(dp.as_int)
                            db_metric = models.MetricData(
                                app_id=app.id,
                                metric_name=metric.name,
                                service_name=service_name,
                                value=val,
                                timestamp=datetime.datetime.utcfromtimestamp(dp.time_unix_nano / 1e9),
                                labels={kv.key: str(kv.value) for kv in dp.attributes}
                            )
                            db.add(db_metric)
                            metrics_added += 1
                            evaluate_metric_alerts(db, app, service_name, metric.name, val)
                            
            db.commit()
            return {"status": "success", "metrics_ingested": metrics_added}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    return {"status": "error", "message": "Only application/x-protobuf is supported on this endpoint."}


# -----------------------------
# LOGS
# -----------------------------
@router.post("/v1/logs")
async def ingest_otlp_logs(
    request: Request,
    db: Session = Depends(get_db),
    x_otel_api_key: Optional[str] = Header(None)
):
    content_type = request.headers.get("content-type", "")
    body = await request.body()

    if "application/x-protobuf" in content_type:
        try:
            req = ExportLogsServiceRequest()
            req.ParseFromString(body)
            logs_added = 0
            for resource_log in req.resource_logs:
                service_name = "unknown_service"
                for attr in resource_log.resource.attributes:
                    if attr.key == "service.name":
                        service_name = attr.value.string_value
                        break
                        
                app = get_app_by_api_key_or_name(db, x_otel_api_key, service_name)
                
                for scope_log in resource_log.scope_logs:
                    for log_record in scope_log.log_records:
                        db_log = models.LogData(
                            app_id=app.id,
                            trace_id=log_record.trace_id.hex() if log_record.trace_id else None,
                            span_id=log_record.span_id.hex() if log_record.span_id else None,
                            service_name=service_name,
                            severity=log_record.severity_text or "INFO",
                            message=log_record.body.string_value,
                            timestamp=datetime.datetime.utcfromtimestamp(log_record.time_unix_nano / 1e9),
                            attributes={kv.key: str(kv.value) for kv in log_record.attributes}
                        )
                        db.add(db_log)
                        logs_added += 1
            db.commit()
            return {"status": "success", "logs_ingested": logs_added}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    return {"status": "error", "message": "Only application/x-protobuf is supported on this endpoint."}

# --- Dynamic Simplified Client Direct Receivers ---
# For direct CLI curl/simulators pushing clean telemetry

@router.post("/api/v1/telemetry/spans")
def ingest_simple_spans(
    spans: List[schemas.SimpleTraceSpan], 
    db: Session = Depends(get_db),
    x_otel_api_key: Optional[str] = Header(None)
):
    spans_added = 0
    for s in spans:
        app = get_app_by_api_key_or_name(db, x_otel_api_key, s.service_name)
        db_span = models.TraceSpan(
            app_id=app.id,
            trace_id=s.trace_id,
            span_id=s.span_id,
            parent_span_id=s.parent_span_id,
            name=s.name,
            service_name=s.service_name,
            start_time=s.start_time,
            end_time=s.end_time,
            duration_ms=max(0.0, (s.end_time - s.start_time).total_seconds() * 1000.0),
            status_code=s.status_code,
            status_message=s.status_message,
            attributes=s.attributes or {}
        )
        db.add(db_span)
        spans_added += 1
    db.commit()
    return {"status": "success", "spans_ingested": spans_added}


@router.post("/api/v1/telemetry/metrics")
def ingest_simple_metrics(
    metrics: List[schemas.SimpleMetric],
    db: Session = Depends(get_db),
    x_otel_api_key: Optional[str] = Header(None)
):
    metrics_added = 0
    for m in metrics:
        app = get_app_by_api_key_or_name(db, x_otel_api_key, m.service_name)
        timestamp = m.timestamp or datetime.datetime.utcnow()
        db_metric = models.MetricData(
            app_id=app.id,
            metric_name=m.metric_name,
            service_name=m.service_name,
            value=m.value,
            timestamp=timestamp,
            labels=m.labels or {}
        )
        db.add(db_metric)
        metrics_added += 1
        
        # Evaluate alerting rules
        evaluate_metric_alerts(db, app, m.service_name, m.metric_name, m.value)
        
    db.commit()
    return {"status": "success", "metrics_ingested": metrics_added}


@router.post("/api/v1/telemetry/logs")
def ingest_simple_logs(
    logs: List[schemas.SimpleLog],
    db: Session = Depends(get_db),
    x_otel_api_key: Optional[str] = Header(None)
):
    logs_added = 0
    for l in logs:
        app = get_app_by_api_key_or_name(db, x_otel_api_key, l.service_name)
        timestamp = l.timestamp or datetime.datetime.utcnow()
        db_log = models.LogData(
            app_id=app.id,
            trace_id=l.trace_id,
            span_id=l.span_id,
            service_name=l.service_name,
            severity=l.severity.upper(),
            message=l.message,
            timestamp=timestamp,
            attributes=l.attributes or {}
        )
        db.add(db_log)
        logs_added += 1
    db.commit()
    return {"status": "success", "logs_ingested": logs_added}


# --- Lightweight Alerting Evaluator ---
def evaluate_metric_alerts(db: Session, app: models.RegisteredApp, service_name: str, metric_name: str, value: float):
    # Static alerting rules simulation (CPU > 85%, Error Rate > 5%, DB Pool > 90, AI Response Time > 2000ms)
    rules = [
        {"metric": "system.cpu.utilization", "threshold": 0.85, "sev": "CRITICAL", "name": "High CPU Utilization"},
        {"metric": "system.memory.utilization", "threshold": 0.90, "sev": "WARNING", "name": "High Memory Utilization"},
        {"metric": "http.server.error_rate", "threshold": 0.05, "sev": "CRITICAL", "name": "Elevated API Error Rate"},
        {"metric": "db.connection.pool.active", "threshold": 90.0, "sev": "WARNING", "name": "Database Connection Exhaustion"},
        {"metric": "ai.inference.latency_ms", "threshold": 2000.0, "sev": "CRITICAL", "name": "AI Model Response Bottleneck"}
    ]
    
    for r in rules:
        if r["metric"] == metric_name:
            # Check if this metric exceeds the threshold
            if value > r["threshold"]:
                # Check if an active incident already exists for this rule on this app and service
                existing = db.query(models.AlertIncident).filter(
                    models.AlertIncident.app_id == app.id,
                    models.AlertIncident.service_name == service_name,
                    models.AlertIncident.rule_name == r["name"],
                    models.AlertIncident.status == "TRIGGERED"
                ).first()
                
                if not existing:
                    # Trigger alert incident
                    incident = models.AlertIncident(
                        app_id=app.id,
                        rule_name=r["name"],
                        service_name=service_name,
                        metric_name=metric_name,
                        threshold=r["threshold"],
                        current_value=value,
                        severity=r["sev"],
                        status="TRIGGERED"
                    )
                    db.add(incident)
                    
                    # Create corresponding system log and audit event
                    system_log = models.LogData(
                        app_id=app.id,
                        service_name="alerting-engine",
                        severity="ERROR",
                        message=f"INCIDENT TRIGGERED: Alert [{r['name']}] on service [{service_name}] is firing. Metric value {value} exceeded threshold {r['threshold']}.",
                        timestamp=datetime.datetime.utcnow(),
                        attributes={"incident_severity": r["sev"], "metric": metric_name}
                    )
                    db.add(system_log)
                    
                    audit = models.AuditEvent(
                        app_id=app.id,
                        user_id="alerting-engine",
                        user_email="alerts@observability.internal",
                        action="ALERT_TRIGGER",
                        resource="SystemAlerts",
                        status="WARNING" if r["sev"] == "WARNING" else "CRITICAL",
                        ip_address="127.0.0.1",
                        timestamp=datetime.datetime.utcnow(),
                        details={"rule_name": r["name"], "metric": metric_name, "value": value}
                    )
                    db.add(audit)
            else:
                # If metric drops back below threshold, resolve any active incident
                existing = db.query(models.AlertIncident).filter(
                    models.AlertIncident.app_id == app.id,
                    models.AlertIncident.service_name == service_name,
                    models.AlertIncident.rule_name == r["name"],
                    models.AlertIncident.status == "TRIGGERED"
                ).first()
                
                if existing:
                    existing.status = "RESOLVED"
                    existing.resolved_at = datetime.datetime.utcnow()
                    
                    system_log = models.LogData(
                        app_id=app.id,
                        service_name="alerting-engine",
                        severity="INFO",
                        message=f"INCIDENT RESOLVED: Alert [{r['name']}] on service [{service_name}] has normalized. Value {value} is below threshold {r['threshold']}.",
                        timestamp=datetime.datetime.utcnow(),
                        attributes={"incident_id": existing.id}
                    )
                    db.add(system_log)
