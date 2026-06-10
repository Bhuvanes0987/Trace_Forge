import datetime
import random
import time
import uuid
from sqlalchemy.orm import Session
from ..database import SessionLocal, engine, Base
from .. import models

# Ensure tables are built
Base.metadata.create_all(bind=engine)

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

def generate_telemetry_batch(db: Session, apps: dict):
    """Generate LLM usage metrics for FrictionX application"""
    
    frictionx = apps.get("FrictionX")
    
    if not frictionx:
        print("FrictionX application not found. Skipping telemetry batch.")
        return

    now = datetime.datetime.utcnow()
    
    # Generate realistic LLM usage patterns
    # Number of LLM API calls per batch
    num_calls = random.randint(15, 45)
    
    for _ in range(num_calls):
        # Simulate different LLM models being used
        models_list = ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "claude-3-opus", "claude-3-sonnet"]
        model_used = random.choice(models_list)
        
        # Token counts (realistic ranges for different models)
        if "gpt-4-turbo" in model_used or "gpt-4" in model_used:
            input_tokens = random.randint(100, 2000)
            output_tokens = random.randint(50, 1500)
            cost_per_1m_input = 0.01  # $0.01 per 1M input tokens
            cost_per_1m_output = 0.03  # $0.03 per 1M output tokens
        elif "3.5" in model_used:
            input_tokens = random.randint(50, 1000)
            output_tokens = random.randint(30, 800)
            cost_per_1m_input = 0.0005  # $0.0005 per 1M input tokens
            cost_per_1m_output = 0.0015  # $0.0015 per 1M output tokens
        else:  # Claude models
            input_tokens = random.randint(80, 1500)
            output_tokens = random.randint(40, 1200)
            cost_per_1m_input = 0.003  # $0.003 per 1M input tokens
            cost_per_1m_output = 0.015  # $0.015 per 1M output tokens
        
        total_tokens = input_tokens + output_tokens
        cost_usd = (input_tokens * cost_per_1m_input / 1_000_000) + (output_tokens * cost_per_1m_output / 1_000_000)
        
        # Generate metrics for this LLM call
        
        # 1. Total tokens metric
        db.add(models.MetricData(
            app_id=frictionx.id,
            metric_name="llm_total_tokens",
            service_name="frictionx-llm-engine",
            value=float(total_tokens),
            timestamp=now - datetime.timedelta(seconds=random.randint(0, 30)),
            labels={
                "model": model_used,
                "type": "total"
            }
        ))
        
        # 2. Input tokens metric
        db.add(models.MetricData(
            app_id=frictionx.id,
            metric_name="llm_input_tokens",
            service_name="frictionx-llm-engine",
            value=float(input_tokens),
            timestamp=now - datetime.timedelta(seconds=random.randint(0, 30)),
            labels={
                "model": model_used,
                "type": "input"
            }
        ))
        
        # 3. Output tokens metric
        db.add(models.MetricData(
            app_id=frictionx.id,
            metric_name="llm_output_tokens",
            service_name="frictionx-llm-engine",
            value=float(output_tokens),
            timestamp=now - datetime.timedelta(seconds=random.randint(0, 30)),
            labels={
                "model": model_used,
                "type": "output"
            }
        ))
        
        # 4. Cost metric (in USD)
        db.add(models.MetricData(
            app_id=frictionx.id,
            metric_name="llm_cost_usd",
            service_name="frictionx-llm-engine",
            value=cost_usd,
            timestamp=now - datetime.timedelta(seconds=random.randint(0, 30)),
            labels={
                "model": model_used,
                "currency": "USD"
            }
        ))
        
        # 5. Response time metric (in milliseconds)
        response_time = random.uniform(100, 3500)
        db.add(models.MetricData(
            app_id=frictionx.id,
            metric_name="llm_response_time_ms",
            service_name="frictionx-llm-engine",
            value=response_time,
            timestamp=now - datetime.timedelta(seconds=random.randint(0, 30)),
            labels={
                "model": model_used
            }
        ))
    
    # Summary aggregates for the batch
    total_batch_tokens = sum([random.randint(150, 2500) for _ in range(num_calls)])
    total_batch_cost = (total_batch_tokens / 1_000_000) * 0.75  # Average cost
    
    db.add(models.MetricData(
        app_id=frictionx.id,
        metric_name="llm_batch_total_tokens",
        service_name="frictionx-llm-engine",
        value=float(total_batch_tokens),
        timestamp=now,
        labels={"batch_size": str(num_calls)}
    ))
    
    db.add(models.MetricData(
        app_id=frictionx.id,
        metric_name="llm_batch_cost_usd",
        service_name="frictionx-llm-engine",
        value=total_batch_cost,
        timestamp=now,
        labels={"batch_size": str(num_calls)}
    ))
    
    db.commit()


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
