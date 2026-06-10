import datetime
import uuid
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class RegisteredApp(Base):
    __tablename__ = "registered_apps"

    id = Column(Integer, primary_key=True, index=True)
    app_id = Column(String(50), unique=True, index=True, default=lambda: f"APP-{uuid.uuid4().hex[:8].upper()}")
    name = Column(String(100), nullable=False)
    environment = Column(String(50), nullable=False) # PROD, STAGE, DEV
    tech_stack = Column(String(50), nullable=False) # Python, Node, .NET, React, Angular, etc.
    url = Column(String(255), nullable=True)
    api_key = Column(String(100), unique=True, index=True, default=lambda: f"otel_key_{uuid.uuid4().hex}")
    status = Column(String(20), default="ACTIVE")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    spans = relationship("TraceSpan", back_populates="app", cascade="all, delete-orphan")
    metrics = relationship("MetricData", back_populates="app", cascade="all, delete-orphan")
    logs = relationship("LogData", back_populates="app", cascade="all, delete-orphan")
    audits = relationship("AuditEvent", back_populates="app", cascade="all, delete-orphan")
    alerts = relationship("AlertIncident", back_populates="app", cascade="all, delete-orphan")

class TraceSpan(Base):
    __tablename__ = "traces_spans"

    id = Column(Integer, primary_key=True, index=True)
    app_id = Column(Integer, ForeignKey("registered_apps.id", ondelete="CASCADE"), nullable=False)
    trace_id = Column(String(100), index=True, nullable=False)
    span_id = Column(String(100), index=True, nullable=False)
    parent_span_id = Column(String(100), nullable=True)
    name = Column(String(200), nullable=False) # e.g. /api/v1/checkout
    service_name = Column(String(100), nullable=False) # e.g. checkout-service
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    duration_ms = Column(Float, nullable=False)
    status_code = Column(String(50), default="UNSET") # OK, ERROR, UNSET
    status_message = Column(String(500), nullable=True)
    attributes = Column(JSON, nullable=True)
    events = Column(JSON, nullable=True)

    app = relationship("RegisteredApp", back_populates="spans")

class MetricData(Base):
    __tablename__ = "metrics_data"

    id = Column(Integer, primary_key=True, index=True)
    app_id = Column(Integer, ForeignKey("registered_apps.id", ondelete="CASCADE"), nullable=False)
    metric_name = Column(String(100), index=True, nullable=False) # e.g. system.cpu.utilization
    service_name = Column(String(100), nullable=False)
    value = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    labels = Column(JSON, nullable=True)

    app = relationship("RegisteredApp", back_populates="metrics")

class LogData(Base):
    __tablename__ = "logs_data"

    id = Column(Integer, primary_key=True, index=True)
    app_id = Column(Integer, ForeignKey("registered_apps.id", ondelete="CASCADE"), nullable=False)
    trace_id = Column(String(100), index=True, nullable=True)
    span_id = Column(String(100), index=True, nullable=True)
    service_name = Column(String(100), nullable=False)
    severity = Column(String(20), index=True, nullable=False) # INFO, WARN, ERROR, DEBUG
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    attributes = Column(JSON, nullable=True)

    app = relationship("RegisteredApp", back_populates="logs")

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    app_id = Column(Integer, ForeignKey("registered_apps.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(100), index=True, nullable=False)
    user_email = Column(String(100), index=True, nullable=False)
    action = Column(String(100), index=True, nullable=False) # e.g. USER_LOGIN, RECORD_DELETE
    resource = Column(String(100), nullable=False) # e.g. Invoice, Payments
    status = Column(String(50), nullable=False) # e.g. SUCCESS, FAILURE
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    details = Column(JSON, nullable=True)

    app = relationship("RegisteredApp", back_populates="audits")

class AlertIncident(Base):
    __tablename__ = "alerts_incidents"

    id = Column(Integer, primary_key=True, index=True)
    app_id = Column(Integer, ForeignKey("registered_apps.id", ondelete="CASCADE"), nullable=False)
    rule_name = Column(String(100), nullable=False)
    service_name = Column(String(100), nullable=False)
    metric_name = Column(String(100), nullable=False)
    threshold = Column(Float, nullable=False)
    current_value = Column(Float, nullable=False)
    severity = Column(String(20), default="HIGH") # WARNING, CRITICAL
    status = Column(String(20), default="TRIGGERED") # TRIGGERED, RESOLVED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    app = relationship("RegisteredApp", back_populates="alerts")


# ==========================================
# ENTERPRISE MEMORY FABRIC & CONTEXT MODELS (ADDITIVE)
# ==========================================

class MemoryHot(Base):
    __tablename__ = "memory_hot"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, index=True)
    user_identifier = Column(String(100), index=True, nullable=True)
    active_context = Column(Text, nullable=False)  # AI synthesized active context
    last_event_time = Column(DateTime, default=datetime.datetime.utcnow)
    ttl_seconds = Column(Integer, default=1800)  # 30 min expiration

class MemoryStructured(Base):
    __tablename__ = "memory_structured"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(100), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(100), index=True)
    app_name = Column(String(100), index=True)
    event_type = Column(String(100))  # e.g. "ORDER_PLACED", "TICKET_CREATED", "CHECKOUT_FAILED"
    description = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    metadata_json = Column(JSON, nullable=True)

class MemorySemantic(Base):
    __tablename__ = "memory_semantic"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), index=True, nullable=True)
    content_type = Column(String(50))  # "llm_interaction" or "summary"
    prompt = Column(Text, nullable=True)
    response = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    model_name = Column(String(100), nullable=True)
    embedding_vector = Column(JSON, nullable=True)  # Simulated floats array
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class MemoryGraph(Base):
    __tablename__ = "memory_graph_edges"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String(50), nullable=False)  # e.g. "USER", "SESSION", "APP", "EVENT"
    source_id = Column(String(100), nullable=False)
    source_label = Column(String(100), nullable=False)
    target_type = Column(String(50), nullable=False)
    target_id = Column(String(100), nullable=False)
    target_label = Column(String(100), nullable=False)
    relationship = Column(String(100), nullable=False)  # e.g. "VISITED", "TRIGGERED", "BELONGS_TO", "COMMUNICATED"
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class MemoryLearning(Base):
    __tablename__ = "memory_learning"

    id = Column(Integer, primary_key=True, index=True)
    pattern_type = Column(String(100), nullable=False)  # e.g. "BEHAVIOR_PATTERN", "ANOMALY", "BOTTLENECK_PREDICTION"
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    confidence = Column(Float, default=0.85)
    frequency = Column(Integer, default=1)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    details = Column(JSON, nullable=True)

