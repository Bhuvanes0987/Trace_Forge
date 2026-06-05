from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- Application Registry Schemas ---
class RegisteredAppCreate(BaseModel):
    name: str = Field(..., example="Customer Portal Service")
    environment: str = Field(..., example="PRODUCTION")
    tech_stack: str = Field(..., example="Python/FastAPI")
    url: str = Field(..., example="https://customer-portal.example.com")

class RegisteredAppResponse(BaseModel):
    id: int
    app_id: str
    name: str
    environment: str
    tech_stack: str
    url: Optional[str] = None
    api_key: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Simplified & Standard OTLP Schema Definitions ---
# These structures model standard OTel / OTLP HTTP JSON payloads as well as simple direct JSON posts.

class OTelKeyValue(BaseModel):
    key: str
    value: Dict[str, Any]

class OTelSpan(BaseModel):
    traceId: str
    spanId: str
    parentSpanId: Optional[str] = None
    name: str
    kind: Optional[int] = None
    startTimeUnixNano: Any  # Can be integer string or integer
    endTimeUnixNano: Any
    attributes: Optional[List[Dict[str, Any]]] = None
    status: Optional[Dict[str, Any]] = None

class OTelScopeSpans(BaseModel):
    scope: Optional[Dict[str, Any]] = None
    spans: List[OTelSpan]

class OTelResourceSpans(BaseModel):
    resource: Optional[Dict[str, Any]] = None
    scopeSpans: List[OTelScopeSpans]

class OTLPTracesPayload(BaseModel):
    resourceSpans: List[OTelResourceSpans]


class OTelMetricDataPoint(BaseModel):
    timeUnixNano: Any
    asDouble: Optional[float] = None
    asInt: Optional[int] = None
    attributes: Optional[List[Dict[str, Any]]] = None

class OTelMetricInfo(BaseModel):
    name: str
    description: Optional[str] = None
    unit: Optional[str] = None
    gauge: Optional[Dict[str, Any]] = None
    sum: Optional[Dict[str, Any]] = None

class OTelScopeMetrics(BaseModel):
    scope: Optional[Dict[str, Any]] = None
    metrics: List[OTelMetricInfo]

class OTelResourceMetrics(BaseModel):
    resource: Optional[Dict[str, Any]] = None
    scopeMetrics: List[OTelScopeMetrics]

class OTLPMetricsPayload(BaseModel):
    resourceMetrics: List[OTelResourceMetrics]


class OTelLogRecord(BaseModel):
    timeUnixNano: Any
    severityText: Optional[str] = None
    severityNumber: Optional[int] = None
    body: Dict[str, Any] # e.g. {"stringValue": "Log message"}
    attributes: Optional[List[Dict[str, Any]]] = None
    traceId: Optional[str] = None
    spanId: Optional[str] = None

class OTelScopeLogs(BaseModel):
    scope: Optional[Dict[str, Any]] = None
    logRecords: List[OTelLogRecord]

class OTelResourceLogs(BaseModel):
    resource: Optional[Dict[str, Any]] = None
    scopeLogs: List[OTelScopeLogs]

class OTLPLogsPayload(BaseModel):
    resourceLogs: List[OTelResourceLogs]


# --- Custom/Simplified Ingestion Schemas ---
# For developers or CLI startup scripts wishing to push simplified payloads directly
class SimpleTraceSpan(BaseModel):
    trace_id: str
    span_id: str
    parent_span_id: Optional[str] = None
    name: str
    service_name: str
    start_time: datetime
    end_time: datetime
    status_code: str = "UNSET"
    status_message: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None

class SimpleMetric(BaseModel):
    metric_name: str
    service_name: str
    value: float
    timestamp: Optional[datetime] = None
    labels: Optional[Dict[str, Any]] = None

class SimpleLog(BaseModel):
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    service_name: str
    severity: str
    message: str
    timestamp: Optional[datetime] = None
    attributes: Optional[Dict[str, Any]] = None

class AuditEventCreate(BaseModel):
    user_id: str
    user_email: str
    action: str
    resource: str
    status: str
    ip_address: Optional[str] = None
    timestamp: Optional[datetime] = None
    details: Optional[Dict[str, Any]] = None

class AuditEventResponse(BaseModel):
    id: int
    app_id: int
    app_name: Optional[str] = None
    user_id: str
    user_email: str
    action: str
    resource: str
    status: str
    ip_address: Optional[str] = None
    timestamp: datetime
    details: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class AlertIncidentResponse(BaseModel):
    id: int
    app_id: int
    app_name: Optional[str] = None
    rule_name: str
    service_name: str
    metric_name: str
    threshold: float
    current_value: float
    severity: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True
