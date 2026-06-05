from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
from ..database import get_db
from .. import models, schemas

router = APIRouter(
    prefix="/api/v1/audit",
    tags=["Audit Trail"]
)

# helper to resolve app ID
def get_app_id_by_api_key(db: Session, api_key: str) -> int:
    app = db.query(models.RegisteredApp).filter(models.RegisteredApp.api_key == api_key).first()
    if not app:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return app.id

@router.post("/", response_model=dict)
def ingest_audit_event(
    event: schemas.AuditEventCreate,
    db: Session = Depends(get_db),
    x_otel_api_key: Optional[str] = Header(None)
):
    if not x_otel_api_key:
        raise HTTPException(status_code=401, detail="Authentication API Key header X-OTEL-API-KEY required")
        
    app_id = get_app_id_by_api_key(db, x_otel_api_key)
    
    timestamp = event.timestamp or datetime.datetime.utcnow()
    
    db_audit = models.AuditEvent(
        app_id=app_id,
        user_id=event.user_id,
        user_email=event.user_email,
        action=event.action.upper(),
        resource=event.resource,
        status=event.status.upper(),
        ip_address=event.ip_address,
        timestamp=timestamp,
        details=event.details or {}
    )
    
    db.add(db_audit)
    db.commit()
    
    # Also mirror this critical audit event into system logs for unified visibility
    db_log = models.LogData(
        app_id=app_id,
        service_name="audit-pipeline",
        severity="INFO" if event.status.upper() == "SUCCESS" else "WARN",
        message=f"AUDIT TRAIL: User [{event.user_email}] performed [{event.action}] on resource [{event.resource}]. Status: [{event.status}].",
        timestamp=timestamp,
        attributes={"user_id": event.user_id, "ip": event.ip_address}
    )
    db.add(db_log)
    db.commit()
    
    return {"status": "success", "audit_id": db_audit.id}

@router.get("/", response_model=List[schemas.AuditEventResponse])
def get_audit_trail(
    app_id: Optional[int] = Query(None),
    user_email: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(
        models.AuditEvent.id,
        models.AuditEvent.app_id,
        models.RegisteredApp.name.label("app_name"),
        models.AuditEvent.user_id,
        models.AuditEvent.user_email,
        models.AuditEvent.action,
        models.AuditEvent.resource,
        models.AuditEvent.status,
        models.AuditEvent.ip_address,
        models.AuditEvent.timestamp,
        models.AuditEvent.details
    ).join(models.RegisteredApp, models.AuditEvent.app_id == models.RegisteredApp.id)
    
    if app_id is not None:
        query = query.filter(models.AuditEvent.app_id == app_id)
        
    if user_email:
        query = query.filter(models.AuditEvent.user_email.like(f"%{user_email}%"))
        
    if action:
        query = query.filter(models.AuditEvent.action == action.upper())
        
    if resource:
        query = query.filter(models.AuditEvent.resource.like(f"%{resource}%"))
        
    if status:
        query = query.filter(models.AuditEvent.status == status.upper())
        
    # Order by newest audits first
    results = query.order_by(models.AuditEvent.timestamp.desc()).limit(limit).all()
    
    # Map raw query result rows to schema responses
    return [
        schemas.AuditEventResponse(
            id=r.id,
            app_id=r.app_id,
            app_name=r.app_name,
            user_id=r.user_id,
            user_email=r.user_email,
            action=r.action,
            resource=r.resource,
            status=r.status,
            ip_address=r.ip_address,
            timestamp=r.timestamp,
            details=r.details
        ) for r in results
    ]
