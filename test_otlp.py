import requests
import datetime
import time
from opentelemetry.proto.collector.metrics.v1.metrics_service_pb2 import ExportMetricsServiceRequest
from opentelemetry.proto.metrics.v1.metrics_pb2 import ResourceMetrics, ScopeMetrics, Metric, Gauge, NumberDataPoint
from opentelemetry.proto.resource.v1.resource_pb2 import Resource
from opentelemetry.proto.common.v1.common_pb2 import KeyValue, AnyValue

# Create a dummy Metric request for LLM Tokens
req = ExportMetricsServiceRequest()
rm = req.resource_metrics.add()
rm.resource.attributes.append(KeyValue(key="service.name", value=AnyValue(string_value="TestApp")))

sm = rm.scope_metrics.add()
m = sm.metrics.add()
m.name = "llm.usage.total_tokens"
m.description = "Total LLM tokens"
m.unit = "{token}"

# Add Gauge value
gauge = Gauge()
dp = gauge.data_points.add()
dp.as_int = 450
dp.time_unix_nano = int(time.time() * 1e9)
m.gauge.CopyFrom(gauge)

# Serialize to protobuf
payload = req.SerializeToString()

# Send to backend
try:
    res = requests.post(
        "http://localhost:8003/v1/metrics",
        data=payload,
        headers={"Content-Type": "application/x-protobuf"}
    )
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text}")
except Exception as e:
    print(f"Connection failed: {e}")
