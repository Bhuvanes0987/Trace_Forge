import datetime
import random
import time
import uuid
from sqlalchemy.orm import Session
from .database import SessionLocal, engine, Base
from . import models

# Ensure tables are built and schema is migrated
Base.metadata.create_all(bind=engine)
from .database import migrate_registered_app_owner_email_to_url
migrate_registered_app_owner_email_to_url()

def seed_default_applications(db: Session):
    apps_data = [
        {"name": "FrictionX", "environment": "PRODUCTION", "tech_stack": "Python/FastAPI/LLM", "url": "https://frictionx.excel-tek.com/", "api_key": "otel_key_frictionx_prod_01"},
        {"name": "FlowTracer", "environment": "PRODUCTION", "tech_stack": "Python/FastAPI", "url": "https://flowtracer.excel-tek.com/", "api_key": "otel_key_flowtracer_prod_01"},
    ]
    
    seeded_apps = {}
    for app_data in apps_data:
        existing = db.query(models.RegisteredApp).filter(models.RegisteredApp.name == app_data["name"]).first()
        if not existing:
            app = models.RegisteredApp(
                name=app_data["name"],
                environment=app_data["environment"],
                tech_stack=app_data["tech_stack"],
                url=app_data["url"],
                api_key=app_data["api_key"]
            )
            db.add(app)
            db.commit()
            db.refresh(app)
            seeded_apps[app.name] = app
        else:
            seeded_apps[existing.name] = existing
            
    return seeded_apps

def seed_memory_fabric(db: Session):
    # Check if memory fabric tables are empty
    if db.query(models.MemoryHot).count() > 0:
        return
        
    print("🧠 Seeding memory fabric data...")
    sessions = ["session-a1b2c3d4", "session-e5f6g7h8", "session-i9j0k1l2"]
    emails = ["alex.developer@company.com", "sarah.pm@company.com", "john.ops@company.com"]
    
    # Seed Hot Memory
    db.add(models.MemoryHot(
        session_id=sessions[0],
        user_identifier=emails[0],
        active_context="User experienced a database connection pool timeout while checking out a cart value of $1,250 on FlowTracer, then opened FrictionX support chat to confirm the order status.",
        last_event_time=datetime.datetime.utcnow() - datetime.timedelta(minutes=5)
    ))
    db.add(models.MemoryHot(
        session_id=sessions[1],
        user_identifier=emails[1],
        active_context="User successfully logged in and is checking the metrics dashboards on FlowTracer, displaying normal system indicators.",
        last_event_time=datetime.datetime.utcnow() - datetime.timedelta(minutes=15)
    ))
    
    # Seed Structured Memory (Facts)
    db.add(models.MemoryStructured(
        session_id=sessions[0],
        app_name="FlowTracer",
        event_type="CHECKOUT_FAILED",
        description="Checkout workflow aborted due to DB connection pool exhaustion (limit 90 reached)",
        timestamp=datetime.datetime.utcnow() - datetime.timedelta(minutes=8)
    ))
    db.add(models.MemoryStructured(
        session_id=sessions[0],
        app_name="FrictionX",
        event_type="SUPPORT_CHAT",
        description="User initiated AI support chat regarding checkout failure",
        timestamp=datetime.datetime.utcnow() - datetime.timedelta(minutes=5)
    ))
    db.add(models.MemoryStructured(
        session_id=sessions[1],
        app_name="FlowTracer",
        event_type="DASHBOARD_VIEW",
        description="User viewed app system analytics page",
        timestamp=datetime.datetime.utcnow() - datetime.timedelta(minutes=16)
    ))
    
    # Seed Semantic Memory
    db.add(models.MemorySemantic(
        session_id=sessions[0],
        content_type="llm_interaction",
        prompt="Hi, my checkout failed on FlowTracer. It said connection pool exhausted. Did my order go through? Can I get a refund?",
        response="Hello! I can see that your checkout failed with a database connection pool timeout, and no payment was processed. Your order did not go through, so you will not be charged. I can assist you with retrying or help request a credit waiver.",
        summary="User checking failed checkout status on FlowTracer and requesting refund confirmation.",
        model_name="gemini-2.5-flash",
        timestamp=datetime.datetime.utcnow() - datetime.timedelta(minutes=5)
    ))
    
    # Seed Graph Memory
    db.add(models.MemoryGraph(
        source_type="USER", source_id=emails[0], source_label=emails[0],
        target_type="SESSION", target_id=sessions[0], target_label="Session A1B2",
        relationship="OWNED_SESSION"
    ))
    db.add(models.MemoryGraph(
        source_type="SESSION", source_id=sessions[0], target_type="APP", target_id="FlowTracer",
        source_label="Session A1B2", target_label="FlowTracer", relationship="ACCESSED_APP"
    ))
    db.add(models.MemoryGraph(
        source_type="SESSION", source_id=sessions[0], target_type="APP", target_id="FrictionX",
        source_label="Session A1B2", target_label="FrictionX", relationship="ACCESSED_APP"
    ))
    db.add(models.MemoryGraph(
        source_type="SESSION", source_id=sessions[0], target_type="EVENT", target_id="checkout-failure",
        source_label="Session A1B2", target_label="Checkout Failure", relationship="TRIGGERED_EVENT"
    ))
    
    db.add(models.MemoryGraph(
        source_type="USER", source_id=emails[1], source_label=emails[1],
        target_type="SESSION", target_id=sessions[1], target_label="Session E5F6",
        relationship="OWNED_SESSION"
    ))
    db.add(models.MemoryGraph(
        source_type="SESSION", source_id=sessions[1], target_type="APP", target_id="FlowTracer",
        source_label="Session E5F6", target_label="FlowTracer", relationship="ACCESSED_APP"
    ))
    
    # Seed Learning Memory
    db.add(models.MemoryLearning(
        pattern_type="BEHAVIOR_PATTERN",
        title="DB Exhaustion Support Escalation",
        description="Database Connection Pool Exhaustion triggers immediate support chat escalations with questions about order state.",
        confidence=0.94,
        frequency=12,
        details={"impacted_service": "flowtracer-api", "escalation_target": "frictionx-llm-engine"}
    ))
    db.add(models.MemoryLearning(
        pattern_type="BOTTLENECK_PREDICTION",
        title="Impending FlowTracer Connection Bottleneck",
        description="FlowTracer db connections frequently exhaust during peak traffic. Recommended pool size expansion from 90 to 150.",
        confidence=0.88,
        frequency=3,
        details={"current_limit": 90, "suggested_limit": 150}
    ))
    
    db.commit()
    print("✅ Memory fabric seeded.")

def should_generate_llm_metrics(app: models.RegisteredApp) -> bool:
    if not app:
        return False

    name = (app.name or "").lower()
    tech = (app.tech_stack or "").lower()
    url = (app.url or "").lower()

    # Auto-generate LLM metrics for any app that declares LLM usage in tech stack
    # or for common AI-enabled apps such as FlowTracer.
    return (
        "llm" in tech or
        "ai" in tech or
        "llm" in name or
        "flowtracer" in name or
        "llm" in url
    )


def normalize_service_name(value: str) -> str:
    normalized = "".join(
        ch.lower() if ch.isalnum() else "-" for ch in (value or "")
    )
    return "-".join(part for part in normalized.split("-") if part)


def build_service_names_for_app(app: models.RegisteredApp) -> list[str]:
    base = normalize_service_name(app.name)
    tech = (app.tech_stack or "").lower()
    services = [f"{base}-api"]

    if any(keyword in tech for keyword in ["db", "sql", "postgres", "mysql", "mongodb"]):
        services.append(f"{base}-db")

    if any(keyword in tech for keyword in ["react", "frontend", "browser", "ui"]):
        services.append(f"{base}-frontend")

    if any(keyword in tech for keyword in ["python", "node", "fastapi", "flask", "dotnet", "java", "go"]):
        services.append(f"{base}-backend")

    if should_generate_llm_metrics(app):
        services.append(f"{base}-llm-engine")

    return list(dict.fromkeys(services))


def build_trace_endpoints(app: models.RegisteredApp) -> list[str]:
    endpoints = [
        "/api/v1/health",
        "/api/v1/metrics",
        "/api/v1/logs",
        "/api/v1/dashboards/overview",
        "/api/v1/apps",
        "/api/v1/apps/stats",
        "/api/v1/intelligence/query",
        "/api/v1/alerts"
    ]
    if "llm" in (app.tech_stack or "").lower() or "ai" in (app.tech_stack or "").lower():
        endpoints.append("/api/v1/llm/invoke")
    return endpoints


def generate_trace_and_log_data_for_app(db: Session, app: models.RegisteredApp, base_time: datetime.datetime | None = None):
    base_time = base_time or datetime.datetime.utcnow()
    service_base = normalize_service_name(app.name)
    endpoints = build_trace_endpoints(app)

    for _ in range(random.randint(6, 14)):
        trace_id = uuid.uuid4().hex
        root_span_id = uuid.uuid4().hex
        endpoint = random.choice(endpoints)
        method = random.choice(["GET", "POST", "PUT", "PATCH", "DELETE"])
        service_name = f"{service_base}-api"
        duration_ms = random.uniform(50, 2200)
        status_code = "ERROR" if random.random() < 0.14 else "OK"
        if "health" in endpoint:
            duration_ms = random.uniform(10, 120)
        if "error" in endpoint or status_code == "ERROR":
            status_code = "ERROR"

        span_start = base_time - datetime.timedelta(seconds=random.randint(0, 180))
        span_end = span_start + datetime.timedelta(milliseconds=duration_ms)

        db.add(models.TraceSpan(
            app_id=app.id,
            trace_id=trace_id,
            span_id=root_span_id,
            parent_span_id=None,
            name=f"{method} {endpoint}",
            service_name=service_name,
            start_time=span_start,
            end_time=span_end,
            duration_ms=duration_ms,
            status_code=status_code,
            status_message="OK" if status_code == "OK" else "Internal server error",
            attributes={
                "http.method": method,
                "http.route": endpoint,
                "app.name": app.name,
                "operation.type": "request"
            },
            events=[{"name": "span.start", "time": span_start.isoformat()}, {"name": "span.end", "time": span_end.isoformat()}]
        ))

        if random.random() < 0.55:
            child_span_id = uuid.uuid4().hex
            child_service = f"{service_base}-db" if "db" in (app.tech_stack or "").lower() else f"{service_base}-backend"
            child_duration = duration_ms * random.uniform(0.12, 0.42)
            child_start = span_start + datetime.timedelta(milliseconds=random.uniform(5, 40))
            child_end = child_start + datetime.timedelta(milliseconds=child_duration)
            db.add(models.TraceSpan(
                app_id=app.id,
                trace_id=trace_id,
                span_id=child_span_id,
                parent_span_id=root_span_id,
                name=f"DB Query for {endpoint}",
                service_name=child_service,
                start_time=child_start,
                end_time=child_end,
                duration_ms=child_duration,
                status_code="OK",
                status_message="DB query completed",
                attributes={
                    "db.system": "postgresql",
                    "db.statement": "SELECT ...",
                    "app.name": app.name
                },
                events=[{"name": "db.query.start", "time": child_start.isoformat()}, {"name": "db.query.end", "time": child_end.isoformat()}]
            ))

        log_severity = "ERROR" if status_code == "ERROR" else "WARN" if random.random() < 0.15 else "INFO"
        log_message = (
            f"{app.name} {method} {endpoint} returned {status_code} in {duration_ms:.0f}ms"
            if log_severity != "ERROR"
            else f"{app.name} encountered an error while serving {endpoint}."
        )

        log_time = span_start + datetime.timedelta(milliseconds=random.uniform(0, duration_ms))
        db.add(models.LogData(
            app_id=app.id,
            trace_id=trace_id,
            span_id=root_span_id,
            service_name=service_name,
            severity=log_severity,
            message=log_message,
            timestamp=log_time,
            attributes={
                "http.method": method,
                "http.route": endpoint,
                "http.status_code": 500 if log_severity == "ERROR" else 200,
                "app.name": app.name
            }
        ))


def generate_standard_metrics_for_app(db: Session, app: models.RegisteredApp, base_time: datetime.datetime | None = None):
    base_time = base_time or datetime.datetime.utcnow()
    service_name = f"{normalize_service_name(app.name)}-api"
    metric_names = [
        "request_count",
        "request_latency_ms",
        "error_rate",
        "cpu_utilization_pct",
        "memory_usage_mb"
    ]

    for _ in range(random.randint(8, 16)):
        timestamp = base_time - datetime.timedelta(seconds=random.randint(0, 240))
        request_count = random.randint(10, 180)
        latency = random.uniform(35, 1200)
        error_rate = random.uniform(0.0, 0.16)
        cpu = random.uniform(12.0, 90.0)
        memory = random.uniform(90.0, 1450.0)

        db.add(models.MetricData(
            app_id=app.id,
            metric_name="request_count",
            service_name=service_name,
            value=float(request_count),
            timestamp=timestamp,
            labels={"route": random.choice(build_trace_endpoints(app)), "app": app.name}
        ))

        db.add(models.MetricData(
            app_id=app.id,
            metric_name="request_latency_ms",
            service_name=service_name,
            value=float(latency),
            timestamp=timestamp,
            labels={"app": app.name}
        ))

        db.add(models.MetricData(
            app_id=app.id,
            metric_name="error_rate",
            service_name=service_name,
            value=float(round(error_rate, 4)),
            timestamp=timestamp,
            labels={"app": app.name}
        ))

        db.add(models.MetricData(
            app_id=app.id,
            metric_name="cpu_utilization_pct",
            service_name=service_name,
            value=float(round(cpu, 2)),
            timestamp=timestamp,
            labels={"app": app.name}
        ))

        db.add(models.MetricData(
            app_id=app.id,
            metric_name="memory_usage_mb",
            service_name=service_name,
            value=float(round(memory, 2)),
            timestamp=timestamp,
            labels={"app": app.name}
        ))

        if latency > 1100:
            evaluate_rule(db, app.id, service_name, "request_latency_ms", latency, 1000.0, "HighRequestLatency", "WARNING")
        if error_rate > 0.08:
            evaluate_rule(db, app.id, service_name, "error_rate", error_rate, 0.08, "HighErrorRate", "CRITICAL")


def generate_audit_events_for_app(db: Session, app: models.RegisteredApp, base_time: datetime.datetime | None = None):
    """Generate realistic audit events for app activity."""
    base_time = base_time or datetime.datetime.utcnow()
    
    users = [
        {"id": "user_001", "email": "admin@company.com"},
        {"id": "user_002", "email": "dev@company.com"},
        {"id": "user_003", "email": "ops@company.com"},
    ]
    
    actions = [
        "USER_LOGIN", "CONFIG_CHANGE", "DATA_ACCESS", "API_CALL", 
        "REPORT_GENERATED", "ALERT_ACKNOWLEDGED", "SYSTEM_UPDATE"
    ]
    
    resources = ["Dashboard", "Metrics", "Configuration", "API", "Alerts", "Logs"]
    
    for _ in range(random.randint(5, 12)):
        timestamp = base_time - datetime.timedelta(seconds=random.randint(0, 600))
        user = random.choice(users)
        
        db.add(models.AuditEvent(
            app_id=app.id,
            user_id=user["id"],
            user_email=user["email"],
            action=random.choice(actions),
            resource=random.choice(resources),
            status=random.choice(["SUCCESS", "FAILURE"]),
            ip_address=f"192.168.{random.randint(1,255)}.{random.randint(1,255)}",
            timestamp=timestamp,
            details={
                "resource_id": f"res_{uuid.uuid4().hex[:8]}",
                "change_type": random.choice(["create", "update", "delete", "read"]),
                "app": app.name
            }
        ))


def generate_llm_usage_metrics_for_app(db: Session, app: models.RegisteredApp, base_time: datetime.datetime | None = None):
    """Generate LLM-specific metrics (tokens, latency, costs) for LLM-enabled apps."""
    if not should_generate_llm_metrics(app):
        return
        
    base_time = base_time or datetime.datetime.utcnow()
    service_name = f"{normalize_service_name(app.name)}-llm-engine"
    
    llm_metrics = [
        ("llm.tokens.input", random.randint(100, 5000)),
        ("llm.tokens.output", random.randint(50, 2000)),
        ("llm.request.latency_ms", random.uniform(200, 5000)),
        ("llm.request.cost_usd", random.uniform(0.001, 0.5)),
        ("llm.cache_hit_rate_pct", random.uniform(0, 100)),
        ("llm.prompt_caching_efficiency", random.uniform(0.5, 1.0)),
    ]
    
    for _ in range(random.randint(4, 8)):
        timestamp = base_time - datetime.timedelta(seconds=random.randint(0, 300))
        for metric_name, base_value in llm_metrics:
            # Add some variance to values
            if "rate" in metric_name or "efficiency" in metric_name:
                value = base_value + random.uniform(-5, 5)
                value = max(0, min(100, value)) if "rate" in metric_name else max(0, min(1.0, value))
            else:
                variance = base_value * 0.2  # 20% variance
                value = base_value + random.uniform(-variance, variance)
            
            db.add(models.MetricData(
                app_id=app.id,
                metric_name=metric_name,
                service_name=service_name,
                value=float(round(value, 2)),
                timestamp=timestamp,
                labels={"app": app.name, "llm_engine": "gemini-2.5-flash"}
            ))


def generate_initial_app_telemetry(db: Session, app: models.RegisteredApp, base_time: datetime.datetime | None = None):
    base_time = base_time or datetime.datetime.utcnow()
    generate_standard_metrics_for_app(db, app, base_time)
    generate_trace_and_log_data_for_app(db, app, base_time)
    generate_audit_events_for_app(db, app, base_time)
    generate_llm_usage_metrics_for_app(db, app, base_time)
    db.commit()


def generate_telemetry_batch(db: Session, apps: dict, base_time: datetime.datetime | None = None):
    """Generate simulated application telemetry data for all registered applications."""
    base_time = base_time or datetime.datetime.utcnow()
    for app in apps.values():
        generate_initial_app_telemetry(db, app, base_time)


def evaluate_rule(db: Session, app_id: int, service_name: str, metric_name: str, value: float, threshold: float, rule_name: str, severity: str):
    if value > threshold:
        # Check if alert already active
        existing = db.query(models.AlertIncident).filter(
            models.AlertIncident.app_id == app_id,
            models.AlertIncident.service_name == service_name,
            models.AlertIncident.rule_name == rule_name,
            models.AlertIncident.status == "TRIGGERED"
        ).first()
        
        if not existing:
            incident = models.AlertIncident(
                app_id=app_id,
                rule_name=rule_name,
                service_name=service_name,
                metric_name=metric_name,
                threshold=threshold,
                current_value=value,
                severity=severity,
                status="TRIGGERED",
                created_at=datetime.datetime.utcnow()
            )
            db.add(incident)
            
            db.add(models.LogData(
                app_id=app_id,
                service_name="alerting-engine",
                severity="ERROR",
                message=f"INCIDENT TRIGGERED: Alert [{rule_name}] on service [{service_name}] is firing. Current value {value} exceeded threshold {threshold}.",
                timestamp=datetime.datetime.utcnow(),
                attributes={"incident_severity": severity}
            ))
            
            db.add(models.AuditEvent(
                app_id=app_id,
                user_id="alerting-engine",
                user_email="alerts@observability.internal",
                action="ALERT_TRIGGER",
                resource="SystemAlerts",
                status="CRITICAL" if severity == "CRITICAL" else "WARNING",
                ip_address="127.0.0.1",
                timestamp=datetime.datetime.utcnow(),
                details={"rule_name": rule_name, "metric_name": metric_name, "current_value": value}
            ))
    else:
        # Auto-resolve
        existing = db.query(models.AlertIncident).filter(
            models.AlertIncident.app_id == app_id,
            models.AlertIncident.service_name == service_name,
            models.AlertIncident.rule_name == rule_name,
            models.AlertIncident.status == "TRIGGERED"
        ).first()
        
        if existing:
            existing.status = "RESOLVED"
            existing.resolved_at = datetime.datetime.utcnow()
            
            db.add(models.LogData(
                app_id=app_id,
                service_name="alerting-engine",
                severity="INFO",
                message=f"INCIDENT RESOLVED: Alert [{rule_name}] on service [{service_name}] has normalized. Value {value} is below threshold {threshold}.",
                timestamp=datetime.datetime.utcnow()
            ))

if __name__ == "__main__":
    print("Initializing Database Observability Telemetry Simulator...")
    db = SessionLocal()
    try:
        print("Seeding default microservice applications...")
        apps = seed_default_applications(db)
        
        # Seed Memory Fabric
        seed_memory_fabric(db)
        
        print("Generating historical telemetry data (30 time-points)...")
        # Generate 30 past points of metrics/traces to make graphs look complete immediately
        for i in range(30, 0, -1):
            historical_now = datetime.datetime.utcnow() - datetime.timedelta(minutes=i)
            # Create a mock database context with override timestamp
            generate_telemetry_batch(db, apps)
            # Fast-forward timestamps of recent entries
            db.execute(models.MetricData.__table__.update().where(models.MetricData.timestamp > historical_now).values(timestamp=historical_now))
            db.execute(models.TraceSpan.__table__.update().where(models.TraceSpan.start_time > historical_now).values(
                start_time=historical_now, 
                end_time=historical_now + datetime.timedelta(milliseconds=150)
            ))
            db.execute(models.LogData.__table__.update().where(models.LogData.timestamp > historical_now).values(timestamp=historical_now))
            db.execute(models.AuditEvent.__table__.update().where(models.AuditEvent.timestamp > historical_now).values(timestamp=historical_now))
            db.commit()
            
        print("Historical telemetry loaded successfully!")
        
        print("Entering live simulation loop. Generating realistic logs/metrics every 5 seconds. Press Ctrl+C to stop.")
        while True:
            generate_telemetry_batch(db, apps)
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Telemetry payload and transaction logs injected.")
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\nSimulator stopped cleanly.")
    finally:
        db.close()
