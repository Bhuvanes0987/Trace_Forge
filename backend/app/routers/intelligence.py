import os
import datetime
import uuid
import json
import requests
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from ..database import get_db
from .. import models

router = APIRouter(prefix="/api/v1/intelligence", tags=["Memory Fabric & Intelligence"])

# -----------------------------
# PYDANTIC SCHEMAS
# -----------------------------
class SemanticQueryRequest(BaseModel):
    query: str
    limit: Optional[int] = 5

class CustomKeyRequest(BaseModel):
    api_key: str

# Helper: Synthesize context with Gemini 2.5 Flash API
def synthesize_context_with_gemini(events_summary: str, api_key: str) -> str:
    if not api_key:
        return ""
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    prompt = (
        "You are the Enterprise Memory Fabric Context Engine. Your job is to transform a raw log of user telemetry "
        "events (traces, logs, audits) across multiple applications into a single-sentence active context description "
        "that applications and AI assistants can use to understand the user's current situation.\n\n"
        "Format guidelines:\n"
        "- Write exactly ONE sentence.\n"
        "- Write in plain, clear, professional English.\n"
        "- Describe who the user is (if known), their recent experience (e.g. error, checkout), actions, and current likely intent.\n"
        "- Do not mention raw trace IDs or JSON structure.\n\n"
        f"Telemetry logs to process:\n{events_summary}\n\n"
        "Single-sentence Context:"
    )
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 100
        }
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=8)
        if response.status_code == 200:
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            return text
        else:
            print(f"Gemini API Error ({response.status_code}): {response.text}")
    except Exception as e:
        print(f"Failed calling Gemini API: {e}")
    return ""

# Helper: Generate rule-based fallback context
def generate_fallback_context(events: List[Dict[str, Any]]) -> str:
    if not events:
        return "User session initialized with no recent activities."
    
    has_error = any("error" in str(e.get("description", "")).lower() or e.get("status") == "ERROR" for e in events)
    apps_visited = list(set(e.get("app_name") for e in events if e.get("app_name")))
    actions = [e.get("event_type") for e in events if e.get("event_type")]
    
    apps_str = " & ".join(apps_visited) if apps_visited else "our systems"
    
    if has_error and "SUPPORT_CHAT" in actions:
        return f"User encountered an operational issue in {apps_str}, initiated a support chat, and is currently seeking assistance."
    elif has_error:
        return f"User experienced an error while performing activities in {apps_str} and may be experiencing friction."
    elif "CHECKOUT" in str(actions).upper() or "ORDER" in str(actions).upper():
        return f"User successfully navigated business workflows in {apps_str} and recently completed a purchasing activity."
    
    return f"User is active in {apps_str}, traversing typical application paths with normal operations."


# -----------------------------
# ENDPOINT: Synthesize/Retrieve Context
# -----------------------------
@router.get("/context/{session_id}")
def get_or_synthesize_session_context(
    session_id: str,
    db: Session = Depends(get_db),
    x_gemini_api_key: Optional[str] = Header(None)
):
    # Try finding in Hot Memory (Redis Cluster simulation)
    hot_mem = db.query(models.MemoryHot).filter(models.MemoryHot.session_id == session_id).first()
    
    # Let's collect recent telemetry from DB to synthesize or refresh
    spans = db.query(models.TraceSpan).filter(
        (models.TraceSpan.attributes.like(f"%{session_id}%")) | 
        (models.TraceSpan.trace_id == session_id)
    ).order_by(models.TraceSpan.start_time.desc()).limit(15).all()
    
    logs = db.query(models.LogData).filter(
        (models.LogData.trace_id == session_id) | 
        (models.LogData.attributes.like(f"%{session_id}%"))
    ).order_by(models.LogData.timestamp.desc()).limit(15).all()
    
    audits = db.query(models.AuditEvent).filter(
        models.AuditEvent.details.like(f"%{session_id}%")
    ).order_by(models.AuditEvent.timestamp.desc()).limit(10).all()
    
    # Collect into standard event list
    raw_events = []
    for s in spans:
        raw_events.append({
            "time": s.start_time.isoformat(),
            "app_name": s.service_name,
            "event_type": "API_SPAN",
            "description": f"Called endpoint {s.name} (Duration: {s.duration_ms:.1f}ms, Status: {s.status_code})",
            "status": s.status_code
        })
    for l in logs:
        raw_events.append({
            "time": l.timestamp.isoformat(),
            "app_name": l.service_name,
            "event_type": "LOG",
            "description": f"[{l.severity}] {l.message}",
            "status": l.severity
        })
    for a in audits:
        raw_events.append({
            "time": a.timestamp.isoformat(),
            "app_name": "AuditService",
            "event_type": a.action,
            "description": f"User {a.user_email} performed {a.action} on {a.resource} ({a.status})",
            "status": a.status
        })
        
    # Sort events by time
    raw_events.sort(key=lambda x: x["time"])
    
    # Generate context text
    context_text = ""
    api_key_to_use = x_gemini_api_key or os.getenv("GEMINI_API_KEY")
    
    if api_key_to_use and raw_events:
        summary_lines = []
        for e in raw_events[-10:]: # top 10 recent
            summary_lines.append(f"- [{e['app_name']}] {e['event_type']}: {e['description']}")
        events_summary = "\n".join(summary_lines)
        context_text = synthesize_context_with_gemini(events_summary, api_key_to_use)
        
    if not context_text:
        # Fallback to rule-based synthesis
        context_text = generate_fallback_context(raw_events)
        
    # Update Hot Memory
    if hot_mem:
        hot_mem.active_context = context_text
        hot_mem.last_event_time = datetime.datetime.utcnow()
    else:
        # Try to find a user identifier
        user_email = None
        for a in audits:
            if a.user_email and "@" in a.user_email:
                user_email = a.user_email
                break
        
        hot_mem = models.MemoryHot(
            session_id=session_id,
            user_identifier=user_email or "anonymous-user",
            active_context=context_text,
            last_event_time=datetime.datetime.utcnow()
        )
        db.add(hot_mem)
        
    # Also save structured memory facts if we have events
    for e in raw_events[-2:]:
        # Check if already present to avoid duplication
        exists = db.query(models.MemoryStructured).filter(
            models.MemoryStructured.session_id == session_id,
            models.MemoryStructured.event_type == e["event_type"],
            models.MemoryStructured.description == e["description"]
        ).first()
        if not exists:
            db.add(models.MemoryStructured(
                session_id=session_id,
                app_name=e["app_name"],
                event_type=e["event_type"],
                description=e["description"],
                metadata_json={"status": e["status"]}
            ))
            
    db.commit()
    db.refresh(hot_mem)
    
    return {
        "session_id": session_id,
        "user_identifier": hot_mem.user_identifier,
        "active_context": hot_mem.active_context,
        "last_updated": hot_mem.last_event_time,
        "raw_events_count": len(raw_events)
    }


# -----------------------------
# ENDPOINT: Memory Fabric Layers Status
# -----------------------------
@router.get("/memory")
def get_memory_fabric_statistics(db: Session = Depends(get_db)):
    hot_count = db.query(models.MemoryHot).count()
    struct_count = db.query(models.MemoryStructured).count()
    semantic_count = db.query(models.MemorySemantic).count()
    graph_count = db.query(models.MemoryGraph).count()
    
    # Historical uses spans and logs counts
    span_count = db.query(models.TraceSpan).count()
    log_count = db.query(models.LogData).count()
    historical_count = span_count + log_count
    
    learning_count = db.query(models.MemoryLearning).count()
    
    # Fetch samples for each
    hot_samples = db.query(models.MemoryHot).order_by(models.MemoryHot.last_event_time.desc()).limit(5).all()
    struct_samples = db.query(models.MemoryStructured).order_by(models.MemoryStructured.timestamp.desc()).limit(5).all()
    semantic_samples = db.query(models.MemorySemantic).order_by(models.MemorySemantic.timestamp.desc()).limit(5).all()
    graph_samples = db.query(models.MemoryGraph).order_by(models.MemoryGraph.timestamp.desc()).limit(5).all()
    learning_samples = db.query(models.MemoryLearning).order_by(models.MemoryLearning.timestamp.desc()).limit(5).all()
    
    return {
        "layers": {
            "hot": {
                "name": "Hot Memory (Redis Cluster)",
                "status": "ONLINE",
                "count": hot_count,
                "purpose": "Fast active context & session storage",
                "samples": [{"session_id": h.session_id, "user": h.user_identifier, "context": h.active_context} for h in hot_samples]
            },
            "structured": {
                "name": "Structured Memory (PostgreSQL)",
                "status": "ONLINE",
                "count": struct_count,
                "purpose": "Permanent business facts & transactions",
                "samples": [{"app": s.app_name, "type": s.event_type, "desc": s.description, "time": s.timestamp} for s in struct_samples]
            },
            "semantic": {
                "name": "Semantic Memory (Qdrant)",
                "status": "ONLINE",
                "count": semantic_count,
                "purpose": "Vector search of prompts & interactions",
                "samples": [{"session": s.session_id, "model": s.model_name, "prompt": s.prompt, "response": s.response[:100]} for s in semantic_samples]
            },
            "historical": {
                "name": "Historical Memory (Parquet / MinIO)",
                "status": "ONLINE",
                "count": historical_count,
                "purpose": "Raw telemetry replay & future learning",
                "samples": [{"type": "traces", "count": span_count}, {"type": "logs", "count": log_count}]
            },
            "graph": {
                "name": "Knowledge Graph (Neo4j)",
                "status": "ONLINE",
                "count": graph_count,
                "purpose": "Cross-application entities & dependencies",
                "samples": [{"source": f"{g.source_type}:{g.source_label}", "rel": g.relationship, "target": f"{g.target_type}:{g.target_label}"} for g in graph_samples]
            },
            "learning": {
                "name": "Learning Memory (ClickHouse / Python)",
                "status": "ONLINE",
                "count": learning_count,
                "purpose": "Discovered patterns, bottlenecks, and predictions",
                "samples": [{"type": l.pattern_type, "title": l.title, "confidence": l.confidence} for l in learning_samples]
            }
        }
    }


# -----------------------------
# ENDPOINT: Knowledge Graph Data
# -----------------------------
@router.get("/graph")
def get_knowledge_graph_data(db: Session = Depends(get_db)):
    edges = db.query(models.MemoryGraph).order_by(models.MemoryGraph.timestamp.desc()).limit(30).all()
    
    # Compile nodes and links
    nodes_map = {}
    links = []
    
    for e in edges:
        # Source Node
        s_key = f"{e.source_type}:{e.source_id}"
        if s_key not in nodes_map:
            nodes_map[s_key] = {
                "id": s_key,
                "label": e.source_label,
                "type": e.source_type,
                "group": e.source_type
            }
            
        # Target Node
        t_key = f"{e.target_type}:{e.target_id}"
        if t_key not in nodes_map:
            nodes_map[t_key] = {
                "id": t_key,
                "label": e.target_label,
                "type": e.target_type,
                "group": e.target_type
            }
            
        # Link
        links.append({
            "source": s_key,
            "target": t_key,
            "relationship": e.relationship
        })
        
    return {
        "nodes": list(nodes_map.values()),
        "links": links
    }


# -----------------------------
# ENDPOINT: Discovered Insights & Trends
# -----------------------------
@router.get("/insights")
def get_discovered_insights(db: Session = Depends(get_db)):
    insights = db.query(models.MemoryLearning).order_by(models.MemoryLearning.confidence.desc()).all()
    return {
        "insights": [
            {
                "id": i.id,
                "pattern_type": i.pattern_type,
                "title": i.title,
                "description": i.description,
                "confidence": i.confidence,
                "frequency": i.frequency,
                "timestamp": i.timestamp,
                "details": i.details
            } for i in insights
        ]
    }


# -----------------------------
# ENDPOINT: Semantic Query Search
# -----------------------------
@router.post("/query")
def semantic_query_search(
    payload: SemanticQueryRequest,
    db: Session = Depends(get_db)
):
    query = payload.query.lower()
    
    # Fetch all semantic records
    records = db.query(models.MemorySemantic).all()
    
    # Direct simple semantic matching (keyword relevance score fallback)
    results = []
    for r in records:
        score = 0.0
        text_corpus = f"{r.prompt or ''} {r.response} {r.summary or ''}".lower()
        
        # Calculate matching keywords count
        words = query.split()
        for w in words:
            if w in text_corpus:
                score += 1.0
                
        # Boost matches in prompt or summary
        if r.prompt and query in r.prompt.lower():
            score += 2.0
        if r.summary and query in r.summary.lower():
            score += 3.0
            
        if score > 0:
            results.append((score, r))
            
    # Sort by score descending
    results.sort(key=lambda x: x[0], reverse=True)
    
    response_items = []
    for score, r in results[:payload.limit]:
        response_items.append({
            "id": r.id,
            "session_id": r.session_id,
            "content_type": r.content_type,
            "prompt": r.prompt,
            "response": r.response,
            "summary": r.summary,
            "model_name": r.model_name,
            "timestamp": r.timestamp,
            "relevance_score": score
        })
        
    return {
        "query": payload.query,
        "matches_found": len(response_items),
        "results": response_items
    }


# -----------------------------
# ENDPOINT: Seed Simulated Journey
# -----------------------------
@router.post("/seed-journey")
def seed_simulated_user_journey(db: Session = Depends(get_db)):
    session_id = f"session-{uuid.uuid4().hex[:12]}"
    user_email = f"lead-engineer-{uuid.uuid4().hex[:4]}@enterprise.io"
    now = datetime.datetime.utcnow()
    
    # 1. Add Trace Spans representing FlowTracer activity
    app_flow = db.query(models.RegisteredApp).filter(models.RegisteredApp.name == "FlowTracer").first()
    if not app_flow:
        app_flow = models.RegisteredApp(
            name="FlowTracer",
            environment="PRODUCTION",
            tech_stack="Python/FastAPI",
            api_key=f"otel_key_flowtracer_{uuid.uuid4().hex[:6]}"
        )
        db.add(app_flow)
        db.commit()
        db.refresh(app_flow)
        
    trace_id = uuid.uuid4().hex
    
    # Step 1: User Login
    db.add(models.TraceSpan(
        app_id=app_flow.id,
        trace_id=trace_id,
        span_id=uuid.uuid4().hex[:16],
        name="POST /api/v1/auth/login",
        service_name="flowtracer-api",
        start_time=now - datetime.timedelta(minutes=10),
        end_time=now - datetime.timedelta(minutes=10) + datetime.timedelta(milliseconds=120),
        duration_ms=120.0,
        status_code="OK",
        attributes={"session_id": session_id, "user_email": user_email}
    ))
    
    # Step 2: Audit log login event
    db.add(models.AuditEvent(
        app_id=app_flow.id,
        user_id="user-1029",
        user_email=user_email,
        action="USER_LOGIN",
        resource="Authentication",
        status="SUCCESS",
        ip_address="198.51.100.42",
        timestamp=now - datetime.timedelta(minutes=10),
        details={"session_id": session_id}
    ))
    
    # Step 3: Checkout Failed (Database connection issue)
    checkout_span_id = uuid.uuid4().hex[:16]
    db.add(models.TraceSpan(
        app_id=app_flow.id,
        trace_id=trace_id,
        span_id=checkout_span_id,
        name="POST /api/v1/checkout",
        service_name="flowtracer-api",
        start_time=now - datetime.timedelta(minutes=8),
        end_time=now - datetime.timedelta(minutes=8) + datetime.timedelta(milliseconds=850),
        duration_ms=850.0,
        status_code="ERROR",
        status_message="DatabasePoolTimeoutException: Connection pool exhausted.",
        attributes={"session_id": session_id, "cart_value_usd": "1250.00"}
    ))
    
    # Log the checkout error
    db.add(models.LogData(
        app_id=app_flow.id,
        trace_id=trace_id,
        span_id=checkout_span_id,
        service_name="flowtracer-api",
        severity="ERROR",
        message="Database pool error: Timed out waiting for connection. Pool limit (90) reached.",
        timestamp=now - datetime.timedelta(minutes=8),
        attributes={"session_id": session_id}
    ))
    
    # 2. Add LLM interaction in FrictionX
    app_friction = db.query(models.RegisteredApp).filter(models.RegisteredApp.name == "FrictionX").first()
    if not app_friction:
        app_friction = models.RegisteredApp(
            name="FrictionX",
            environment="PRODUCTION",
            tech_stack="Python/FastAPI/LLM",
            api_key=f"otel_key_frictionx_{uuid.uuid4().hex[:6]}"
        )
        db.add(app_friction)
        db.commit()
        db.refresh(app_friction)
        
    # User switches to FrictionX Support AI
    friction_trace_id = uuid.uuid4().hex
    ai_span_id = uuid.uuid4().hex[:16]
    
    db.add(models.TraceSpan(
        app_id=app_friction.id,
        trace_id=friction_trace_id,
        span_id=ai_span_id,
        name="POST /api/v1/chat/completions",
        service_name="frictionx-llm-engine",
        start_time=now - datetime.timedelta(minutes=5),
        end_time=now - datetime.timedelta(minutes=5) + datetime.timedelta(milliseconds=1800),
        duration_ms=1800.0,
        status_code="OK",
        attributes={"session_id": session_id, "llm_model": "gemini-2.5-flash"}
    ))
    
    prompt_txt = "Hi, my checkout failed on FlowTracer. It said connection pool exhausted. Did my order go through? Can I get a refund?"
    resp_txt = "Hello! I can see that your checkout failed with a database connection pool timeout, and no payment was processed. Your order did not go through, so you will not be charged. I can assist you with retrying or help request a credit waiver."
    
    # Add Semantic memory record
    db.add(models.MemorySemantic(
        session_id=session_id,
        content_type="llm_interaction",
        prompt=prompt_txt,
        response=resp_txt,
        summary="User checking failed checkout status on FlowTracer and requesting refund confirmation.",
        model_name="gemini-2.5-flash"
    ))
    
    # 3. Add Knowledge Graph entries connecting these entities
    # Node connections: USER -> SESSION -> APP
    db.add(models.MemoryGraph(
        source_type="USER",
        source_id=user_email,
        source_label=user_email,
        target_type="SESSION",
        target_id=session_id,
        target_label=f"Session {session_id[:8]}",
        relationship="OWNED_SESSION"
    ))
    
    db.add(models.MemoryGraph(
        source_type="SESSION",
        source_id=session_id,
        source_label=f"Session {session_id[:8]}",
        target_type="APP",
        target_id="FlowTracer",
        target_label="FlowTracer",
        relationship="ACCESSED_APP"
    ))
    
    db.add(models.MemoryGraph(
        source_type="SESSION",
        source_id=session_id,
        source_label=f"Session {session_id[:8]}",
        target_type="APP",
        target_id="FrictionX",
        target_label="FrictionX",
        relationship="ACCESSED_APP"
    ))
    
    db.add(models.MemoryGraph(
        source_type="SESSION",
        source_id=session_id,
        source_label=f"Session {session_id[:8]}",
        target_type="EVENT",
        target_id="checkout-failure",
        target_label="Checkout Failure (Pool Timeout)",
        relationship="TRIGGERED_EVENT"
    ))
    
    # 4. Insert patterns or learnings discovered
    # Pattern: DB Pool timeouts precede customer support complaints
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
    
    return {
        "status": "success",
        "message": "Simulated multi-app user journey seeded successfully.",
        "session_id": session_id,
        "user_email": user_email
    }
