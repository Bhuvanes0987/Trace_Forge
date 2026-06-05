from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import datetime
from ..database import get_db
from .. import models
from sqlalchemy import func, desc, and_, case, case, case

router = APIRouter(
    prefix="/api/v1/dashboards",
    tags=["Dashboard Operations"]
)

@router.get("/overview")
def get_operational_overview(
    app_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    # Base filter
    span_filter = []
    log_filter = []
    audit_filter = []
    incident_filter = []
    
    if app_id is not None:
        span_filter.append(models.TraceSpan.app_id == app_id)
        log_filter.append(models.LogData.app_id == app_id)
        audit_filter.append(models.AuditEvent.app_id == app_id)
        incident_filter.append(models.AlertIncident.app_id == app_id)

    # 1. Active incident count
    active_incidents = db.query(models.AlertIncident).filter(
        and_(models.AlertIncident.status == "TRIGGERED", *incident_filter)
    ).count()
    
    # 2. Total traces count
    total_traces = db.query(func.count(func.distinct(models.TraceSpan.trace_id))).filter(*span_filter).scalar() or 0
    
    # 3. Average Request latency
    avg_latency = db.query(func.avg(models.TraceSpan.duration_ms)).filter(*span_filter).scalar() or 0.0
    
    # 4. Error Spans Count and Total Spans (to compute error rate)
    total_spans = db.query(models.TraceSpan).filter(*span_filter).count()
    error_spans = db.query(models.TraceSpan).filter(
        and_(models.TraceSpan.status_code == "ERROR", *span_filter)
    ).count()
    
    error_rate = (error_spans / total_spans) if total_spans > 0 else 0.0
    
    # 5. Total registered apps count
    apps_count = db.query(models.RegisteredApp).count()
    
    # 6. Service status list (Latency, Errors, Health)
    services_query = db.query(
        models.TraceSpan.service_name,
        func.count(models.TraceSpan.id).label("total_reqs"),
        func.avg(models.TraceSpan.duration_ms).label("avg_lat"),
        func.sum(case((models.TraceSpan.status_code == "ERROR", 1), else_=0)).label("errors")
    ).filter(*span_filter).group_by(models.TraceSpan.service_name).all()
    
    services_list = []
    for s in services_query:
        err_ratio = (s.errors / s.total_reqs) if s.total_reqs > 0 else 0.0
        status = "HEALTHY"
        if err_ratio > 0.05:
            status = "CRITICAL"
        elif err_ratio > 0.01 or s.avg_lat > 800:
            status = "WARNING"
            
        services_list.append({
            "service_name": s.service_name,
            "requests_count": s.total_reqs,
            "avg_latency_ms": round(s.avg_lat, 2),
            "error_rate": round(err_ratio * 100, 2),
            "status": status
        })
        
    # 7. Recent active incidents
    incidents = db.query(
        models.AlertIncident.id,
        models.AlertIncident.rule_name,
        models.AlertIncident.service_name,
        models.AlertIncident.severity,
        models.AlertIncident.current_value,
        models.AlertIncident.created_at,
        models.RegisteredApp.name.label("app_name")
    ).join(
        models.RegisteredApp, models.AlertIncident.app_id == models.RegisteredApp.id
    ).filter(
        and_(models.AlertIncident.status == "TRIGGERED", *incident_filter)
    ).order_by(models.AlertIncident.created_at.desc()).limit(5).all()
    
    recent_incidents = [{
        "id": r.id,
        "rule_name": r.rule_name,
        "service_name": r.service_name,
        "severity": r.severity,
        "current_value": round(r.current_value, 2),
        "created_at": r.created_at,
        "app_name": r.app_name
    } for r in incidents]

    return {
        "summary": {
            "registered_applications": apps_count,
            "active_incidents": active_incidents,
            "total_traces": total_traces,
            "avg_latency_ms": round(avg_latency, 2),
            "error_rate_pct": round(error_rate * 100, 2)
        },
        "services": services_list,
        "recent_incidents": recent_incidents
    }

@router.get("/metrics/names")
def get_metric_names(
    app_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.MetricData.metric_name).distinct()
    if app_id is not None:
        query = query.filter(models.MetricData.app_id == app_id)
    names = [row[0] for row in query.all()]
    return {"metrics": names}


@router.get("/metrics")
def get_metrics_timeline(
    metric_name: str,
    app_id: Optional[int] = Query(None),
    minutes_ago: Optional[int] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    conditions = [
        models.MetricData.metric_name == metric_name
    ]
    
    if start_date or end_date:
        if start_date:
            try:
                # Remove Z and parse
                clean_start = start_date.rstrip('Z')
                if '+' in clean_start:
                    clean_start = clean_start.split('+')[0]
                s_dt = datetime.datetime.fromisoformat(clean_start)
                conditions.append(models.MetricData.timestamp >= s_dt)
            except ValueError:
                pass
        if end_date:
            try:
                clean_end = end_date.rstrip('Z')
                if '+' in clean_end:
                    clean_end = clean_end.split('+')[0]
                e_dt = datetime.datetime.fromisoformat(clean_end)
                conditions.append(models.MetricData.timestamp <= e_dt)
            except ValueError:
                pass
    else:
        minutes = minutes_ago if minutes_ago is not None else 30
        filter_time = datetime.datetime.utcnow() - datetime.timedelta(minutes=minutes)
        conditions.append(models.MetricData.timestamp >= filter_time)
    
    if app_id is not None:
        conditions.append(models.MetricData.app_id == app_id)
        
    # Query raw time-series metrics joined with RegisteredApp
    metrics = db.query(
        models.MetricData.timestamp,
        models.MetricData.value,
        models.MetricData.service_name,
        models.RegisteredApp.name.label("app_name")
    ).join(
        models.RegisteredApp, models.MetricData.app_id == models.RegisteredApp.id
    ).filter(*conditions).order_by(models.MetricData.timestamp.asc()).all()
    
    # Format for graphing: group by timestamp (or rounded to seconds) and service
    timeline = []
    for m in metrics:
        timeline.append({
            "timestamp": m.timestamp.isoformat(),
            "value": m.value,
            "service": m.service_name,
            "app_name": m.app_name
        })
        
    return {
        "metric_name": metric_name,
        "points_count": len(timeline),
        "timeline": timeline
    }


@router.get("/traces")
def get_traces_list(
    app_id: Optional[int] = Query(None),
    service_name: Optional[str] = Query(None),
    status_code: Optional[str] = Query(None),
    min_duration: Optional[float] = Query(None),
    limit: int = Query(50),
    db: Session = Depends(get_db)
):
    # Find trace entry points (i.e. parent_span_id is null or first span of a trace)
    # To get reliable entry spans: group by trace_id and retrieve entry characteristics
    # For this dashboard we can search root spans (parent_span_id IS NULL or empty) or simply query spans
    conditions = []
    
    if app_id is not None:
        conditions.append(models.TraceSpan.app_id == app_id)
    if service_name:
        conditions.append(models.TraceSpan.service_name == service_name)
    if status_code:
        conditions.append(models.TraceSpan.status_code == status_code)
    if min_duration is not None:
        conditions.append(models.TraceSpan.duration_ms >= min_duration)
        
    # Subquery to retrieve maximum duration & start time per trace
    # and match that trace's details.
    # To keep database execution fast on MySQL/SQLite, let's fetch matching traces
    traces_query = db.query(
        models.TraceSpan.trace_id,
        models.TraceSpan.name,
        models.TraceSpan.service_name,
        models.TraceSpan.start_time,
        models.TraceSpan.duration_ms,
        models.TraceSpan.status_code,
        models.RegisteredApp.name.label("app_name")
    ).join(
        models.RegisteredApp, models.TraceSpan.app_id == models.RegisteredApp.id
    ).filter(
        and_(models.TraceSpan.parent_span_id.is_(None) | (models.TraceSpan.parent_span_id == ""), *conditions)
    ).order_by(
        models.TraceSpan.start_time.desc()
    ).limit(limit).all()

    results = []
    for t in traces_query:
        # Count spans inside this trace
        spans_count = db.query(models.TraceSpan).filter(models.TraceSpan.trace_id == t.trace_id).count()
        results.append({
            "trace_id": t.trace_id,
            "root_name": t.name,
            "service_name": t.service_name,
            "start_time": t.start_time,
            "duration_ms": round(t.duration_ms, 2),
            "status_code": t.status_code,
            "app_name": t.app_name,
            "spans_count": spans_count
        })
        
    return results


@router.get("/traces/{trace_id}")
def get_trace_waterfall(trace_id: str, db: Session = Depends(get_db)):
    spans = db.query(models.TraceSpan).filter(
        models.TraceSpan.trace_id == trace_id
    ).order_by(models.TraceSpan.start_time.asc()).all()
    
    if not spans:
        raise HTTPException(status_code=404, detail=f"Trace with ID {trace_id} not found.")
        
    # Format spans into hierarchical Gantt timeline structure
    timeline_spans = []
    trace_start = spans[0].start_time
    
    for s in spans:
        # Calculate relative start offset
        start_offset_ms = (s.start_time - trace_start).total_seconds() * 1000.0
        
        timeline_spans.append({
            "span_id": s.span_id,
            "parent_span_id": s.parent_span_id,
            "name": s.name,
            "service_name": s.service_name,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "duration_ms": round(s.duration_ms, 2),
            "relative_start_ms": round(max(0.0, start_offset_ms), 2),
            "status_code": s.status_code,
            "status_message": s.status_message,
            "attributes": s.attributes or {},
            "events": s.events or []
        })
        
    # Fetch correlated logs for this exact trace! (Trace-Log correlation)
    correlated_logs = db.query(models.LogData).filter(
        models.LogData.trace_id == trace_id
    ).order_by(models.LogData.timestamp.asc()).all()
    
    logs = [{
        "id": l.id,
        "span_id": l.span_id,
        "service_name": l.service_name,
        "severity": l.severity,
        "message": l.message,
        "timestamp": l.timestamp
    } for l in correlated_logs]
    
    return {
        "trace_id": trace_id,
        "spans_count": len(timeline_spans),
        "total_duration_ms": round(sum(s.duration_ms for s in spans if not s.parent_span_id), 2),
        "spans": timeline_spans,
        "correlated_logs": logs
    }


@router.get("/logs")
def search_logs(
    app_id: Optional[int] = Query(None),
    severity: Optional[str] = Query(None),
    query: Optional[str] = Query(None),
    trace_id: Optional[str] = Query(None),
    limit: int = Query(100),
    db: Session = Depends(get_db)
):
    conditions = []
    
    if app_id is not None:
        conditions.append(models.LogData.app_id == app_id)
        
    if severity:
        conditions.append(models.LogData.severity == severity.upper())
        
    if trace_id:
        conditions.append(models.LogData.trace_id == trace_id)
        
    if query:
        conditions.append(models.LogData.message.like(f"%{query}%"))
        
    logs = db.query(
        models.LogData.id,
        models.LogData.trace_id,
        models.LogData.span_id,
        models.LogData.service_name,
        models.LogData.severity,
        models.LogData.message,
        models.LogData.timestamp,
        models.LogData.attributes,
        models.RegisteredApp.name.label("app_name")
    ).join(
        models.RegisteredApp, models.LogData.app_id == models.RegisteredApp.id
    ).filter(
        *conditions
    ).order_by(
        models.LogData.timestamp.desc()
    ).limit(limit).all()
    
    return [{
        "id": l.id,
        "trace_id": l.trace_id,
        "span_id": l.span_id,
        "service_name": l.service_name,
        "severity": l.severity,
        "message": l.message,
        "timestamp": l.timestamp,
        "attributes": l.attributes or {},
        "app_name": l.app_name
    } for l in logs]
