"""
Memory Engine — Live enrichment pipeline for the Enterprise Memory Fabric.

This module is called automatically by the telemetry ingest endpoints
every time a span, log, or metric is written to the database. It extracts
session identifiers, user identities, business events, and entity
relationships and writes them into the memory fabric tiers.

All functions are wrapped in try/except so enrichment failures NEVER
crash the core telemetry ingest pipeline.
"""

import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models


# ──────────────────────────────────────────────
# ATTRIBUTE EXTRACTORS
# ──────────────────────────────────────────────

def extract_session_id(attributes: dict) -> Optional[str]:
    if not attributes:
        return None
    for key in ("session_id", "session.id", "user.session_id",
                "http.session_id", "baggage.session_id"):
        val = attributes.get(key)
        if val:
            return str(val).strip('"').strip("'")
    return None


def extract_user_identifier(attributes: dict) -> Optional[str]:
    if not attributes:
        return None
    for key in ("user_email", "user.email", "enduser.id", "user_id", "user.id"):
        val = attributes.get(key)
        if val:
            return str(val).strip('"').strip("'")
    return None


# ──────────────────────────────────────────────
# PER-RECORD ENRICHMENT HOOKS
# ──────────────────────────────────────────────

def process_span_into_memory(db: Session, span: models.TraceSpan,
                             app: models.RegisteredApp):
    """Called after every span is db.add()-ed, before db.commit()."""
    try:
        attrs = span.attributes or {}
        session_id = extract_session_id(attrs)
        user_id = extract_user_identifier(attrs)

        if not session_id:
            session_id = f"trace-{span.trace_id[:12]}"

        # ── Structured Memory: record significant events ──
        event_type = None
        description = None

        if span.status_code == "ERROR":
            event_type = "ERROR_ENCOUNTERED"
            msg = (span.status_message or "Unknown error")[:150]
            description = (f"Error in {span.name} on {span.service_name}: "
                           f"{msg}")
        elif _name_matches(span.name, ("checkout", "order", "purchase",
                                       "payment", "invoice")):
            event_type = "CHECKOUT_ACTIVITY"
            description = (f"Commerce activity: {span.name} on "
                           f"{span.service_name} ({span.status_code})")
        elif _name_matches(span.name, ("chat", "completion", "llm",
                                       "generate", "predict", "inference")):
            event_type = "AI_INTERACTION"
            description = (f"AI/LLM call: {span.name} on "
                           f"{span.service_name} ({span.duration_ms:.0f}ms)")
        elif _name_matches(span.name, ("login", "auth", "signin", "sso",
                                       "token")):
            event_type = "USER_AUTH"
            description = (f"Auth event: {span.name} on "
                           f"{span.service_name} ({span.status_code})")
        elif span.duration_ms and span.duration_ms > 2000:
            event_type = "SLOW_OPERATION"
            description = (f"Slow: {span.name} on {span.service_name} "
                           f"({span.duration_ms:.0f}ms)")

        if event_type:
            _add_structured_fact(db, session_id, app.name, event_type,
                                 description, span.start_time,
                                 {"service": span.service_name,
                                  "status": span.status_code,
                                  "duration_ms": span.duration_ms})

        # ── Knowledge Graph ──
        _ensure_graph_edge(db,
                           "SESSION", session_id, f"Session {session_id[:12]}",
                           "APP", app.name, app.name, "ACCESSED_APP")

        if user_id:
            _ensure_graph_edge(db,
                               "USER", user_id, user_id,
                               "SESSION", session_id,
                               f"Session {session_id[:12]}",
                               "OWNED_SESSION")

        if span.status_code == "ERROR":
            err_id = f"err-{span.service_name[:20]}"
            err_label = f"Error: {span.name[:30]}"
            _ensure_graph_edge(db,
                               "SESSION", session_id,
                               f"Session {session_id[:12]}",
                               "EVENT", err_id, err_label,
                               "TRIGGERED_EVENT")
    except Exception as e:
        # Never crash the ingest pipeline
        print(f"[MemoryEngine] span enrichment warning: {e}")


def process_log_into_memory(db: Session, log: models.LogData,
                            app: models.RegisteredApp):
    """Called after every log is db.add()-ed, before db.commit()."""
    try:
        attrs = log.attributes or {}
        session_id = extract_session_id(attrs)
        if not session_id and log.trace_id:
            session_id = f"trace-{log.trace_id[:12]}"
        if not session_id:
            return

        if log.severity in ("ERROR", "CRITICAL"):
            _add_structured_fact(db, session_id, app.name, "LOG_ERROR",
                                 f"[{log.severity}] {log.message[:200]}",
                                 log.timestamp,
                                 {"service": log.service_name})

        _ensure_graph_edge(db,
                           "SESSION", session_id, f"Session {session_id[:12]}",
                           "APP", app.name, app.name, "ACCESSED_APP")
    except Exception as e:
        print(f"[MemoryEngine] log enrichment warning: {e}")


def process_metric_into_memory(db: Session, metric: models.MetricData,
                               app: models.RegisteredApp):
    """Detect LLM usage from metrics and store in semantic memory."""
    try:
        if not metric.metric_name.startswith("llm_"):
            return

        labels = metric.labels or {}
        model_name = labels.get("model", "unknown")

        # Only record once per model per 60 seconds to avoid flooding
        if metric.metric_name == "llm_total_tokens":
            session_id = labels.get("session_id", f"llm-{app.name.lower()}")
            cutoff = datetime.datetime.utcnow() - datetime.timedelta(seconds=60)

            recent = db.query(models.MemorySemantic).filter(
                models.MemorySemantic.session_id == session_id,
                models.MemorySemantic.model_name == model_name,
                models.MemorySemantic.timestamp > cutoff
            ).first()

            if not recent:
                db.add(models.MemorySemantic(
                    session_id=session_id,
                    content_type="llm_metric_detected",
                    prompt=None,
                    response=(f"LLM call: model={model_name}, "
                              f"tokens={int(metric.value)}"),
                    summary=(f"Auto-detected LLM usage on {app.name} "
                             f"via {model_name}"),
                    model_name=model_name,
                    timestamp=metric.timestamp
                ))

            # Graph: link app to LLM model
            _ensure_graph_edge(db,
                               "APP", app.name, app.name,
                               "EVENT", f"llm-{model_name}", model_name,
                               "USES_MODEL")
    except Exception as e:
        print(f"[MemoryEngine] metric enrichment warning: {e}")


# ──────────────────────────────────────────────
# ADAPTIVE PATTERN DISCOVERY
# ──────────────────────────────────────────────

def discover_patterns(db: Session) -> int:
    """
    Analyze structured memory and the knowledge graph to discover
    behavioral patterns, anomalies, and bottleneck predictions.

    Returns the number of patterns created or updated.
    """
    now = datetime.datetime.utcnow()
    window = now - datetime.timedelta(hours=24)
    count = 0

    try:
        # ── Pattern 1: Error → AI‐escalation correlation ──
        error_sessions = [r[0] for r in db.query(
            models.MemoryStructured.session_id
        ).filter(
            models.MemoryStructured.event_type.in_(
                ["ERROR_ENCOUNTERED", "LOG_ERROR"]),
            models.MemoryStructured.timestamp > window
        ).distinct().all()]

        if error_sessions:
            ai_count = db.query(models.MemoryStructured).filter(
                models.MemoryStructured.session_id.in_(error_sessions),
                models.MemoryStructured.event_type == "AI_INTERACTION",
                models.MemoryStructured.timestamp > window
            ).count()

            if ai_count > 0:
                conf = min(0.97,
                           0.5 + ai_count / max(len(error_sessions), 1) * 0.4)
                _upsert_learning(
                    db, "BEHAVIOR_PATTERN",
                    "Error-to-AI Support Escalation",
                    (f"{ai_count} AI support interactions followed "
                     f"application errors across {len(error_sessions)} "
                     f"sessions (24 h window)."),
                    conf, ai_count,
                    {"error_sessions": len(error_sessions),
                     "ai_escalations": ai_count})
                count += 1

        # ── Pattern 2: Slow‐operation bottleneck ──
        slow_ops = db.query(
            models.MemoryStructured.app_name,
            func.count(models.MemoryStructured.id)
        ).filter(
            models.MemoryStructured.event_type == "SLOW_OPERATION",
            models.MemoryStructured.timestamp > window
        ).group_by(models.MemoryStructured.app_name).all()

        for app_name, n in slow_ops:
            if n >= 2:
                _upsert_learning(
                    db, "BOTTLENECK_PREDICTION",
                    f"Performance Bottleneck: {app_name}",
                    (f"{app_name} recorded {n} slow operations (>2 s) in "
                     f"24 h. Potential scaling or optimization needed."),
                    min(0.95, 0.6 + n * 0.05), n,
                    {"app": app_name, "slow_count": n})
                count += 1

        # ── Pattern 3: Error‐rate anomaly ──
        error_count = db.query(models.MemoryStructured).filter(
            models.MemoryStructured.event_type.in_(
                ["ERROR_ENCOUNTERED", "LOG_ERROR"]),
            models.MemoryStructured.timestamp > window
        ).count()

        total_events = db.query(models.MemoryStructured).filter(
            models.MemoryStructured.timestamp > window
        ).count()

        if total_events > 5 and error_count > 0:
            rate = error_count / total_events
            if rate > 0.1:
                _upsert_learning(
                    db, "ANOMALY",
                    "Elevated Enterprise Error Rate",
                    (f"Errors represent {rate * 100:.1f}% of all events "
                     f"({error_count}/{total_events}) in 24 h, exceeding "
                     f"the 10% baseline."),
                    min(0.95, 0.7 + rate), error_count,
                    {"error_count": error_count,
                     "total_events": total_events,
                     "rate_pct": round(rate * 100, 1)})
                count += 1

        # ── Pattern 4: Cross‐app user journeys ──
        multi_app = db.query(
            models.MemoryGraph.source_id,
            func.count(func.distinct(models.MemoryGraph.target_id))
        ).filter(
            models.MemoryGraph.source_type == "SESSION",
            models.MemoryGraph.target_type == "APP"
        ).group_by(models.MemoryGraph.source_id).having(
            func.count(func.distinct(models.MemoryGraph.target_id)) > 1
        ).all()

        if multi_app:
            _upsert_learning(
                db, "BEHAVIOR_PATTERN",
                "Cross-Application User Journeys Detected",
                (f"{len(multi_app)} user sessions traversed multiple "
                 f"applications, indicating shared‐context opportunities."),
                min(0.92, 0.6 + len(multi_app) * 0.1), len(multi_app),
                {"multi_app_sessions": len(multi_app)})
            count += 1

        # ── Pattern 5: LLM model distribution ──
        llm_models = db.query(
            models.MemorySemantic.model_name,
            func.count(models.MemorySemantic.id)
        ).filter(
            models.MemorySemantic.model_name.isnot(None),
            models.MemorySemantic.timestamp > window
        ).group_by(models.MemorySemantic.model_name).all()

        if len(llm_models) >= 2:
            model_map = {m: c for m, c in llm_models}
            total = sum(model_map.values())
            top_model = max(model_map, key=model_map.get)
            _upsert_learning(
                db, "BEHAVIOR_PATTERN",
                "LLM Model Usage Distribution",
                (f"{len(llm_models)} distinct LLM models detected across "
                 f"{total} interactions. {top_model} is the most used."),
                0.90, total,
                {"models": model_map, "top_model": top_model})
            count += 1

        db.commit()
    except Exception as e:
        print(f"[MemoryEngine] pattern discovery warning: {e}")

    return count


# ──────────────────────────────────────────────
# INTERNAL HELPERS
# ──────────────────────────────────────────────

def _name_matches(name: str, keywords: tuple) -> bool:
    lower = name.lower()
    return any(kw in lower for kw in keywords)


def _add_structured_fact(db, session_id, app_name, event_type,
                         description, timestamp, metadata):
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(minutes=2)
    existing = db.query(models.MemoryStructured).filter(
        models.MemoryStructured.session_id == session_id,
        models.MemoryStructured.event_type == event_type,
        models.MemoryStructured.app_name == app_name,
        models.MemoryStructured.timestamp > cutoff
    ).first()

    if not existing:
        db.add(models.MemoryStructured(
            session_id=session_id,
            app_name=app_name,
            event_type=event_type,
            description=description,
            timestamp=timestamp or datetime.datetime.utcnow(),
            metadata_json=metadata
        ))


def _ensure_graph_edge(db, src_type, src_id, src_label,
                       tgt_type, tgt_id, tgt_label, relationship):
    existing = db.query(models.MemoryGraph).filter(
        models.MemoryGraph.source_type == src_type,
        models.MemoryGraph.source_id == src_id,
        models.MemoryGraph.target_type == tgt_type,
        models.MemoryGraph.target_id == tgt_id,
        models.MemoryGraph.relationship == relationship
    ).first()

    if not existing:
        db.add(models.MemoryGraph(
            source_type=src_type,
            source_id=src_id,
            source_label=src_label,
            target_type=tgt_type,
            target_id=tgt_id,
            target_label=tgt_label,
            relationship=relationship
        ))


def _upsert_learning(db, pattern_type, title, description,
                     confidence, frequency, details):
    existing = db.query(models.MemoryLearning).filter(
        models.MemoryLearning.title == title
    ).first()

    if existing:
        existing.description = description
        existing.confidence = confidence
        existing.frequency = frequency
        existing.details = details
        existing.timestamp = datetime.datetime.utcnow()
    else:
        db.add(models.MemoryLearning(
            pattern_type=pattern_type,
            title=title,
            description=description,
            confidence=confidence,
            frequency=frequency,
            details=details
        ))
