from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from typing import List, Optional
import datetime
from ..database import get_db
from .. import models, schemas

router = APIRouter(
    prefix="/api/v1/alerts",
    tags=["Incident Alerting"]
)

@router.get("/incidents", response_model=List[schemas.AlertIncidentResponse])
def get_incidents(
    app_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None), # TRIGGERED, RESOLVED
    db: Session = Depends(get_db)
):
    query = db.query(
        models.AlertIncident.id,
        models.AlertIncident.app_id,
        models.RegisteredApp.name.label("app_name"),
        models.AlertIncident.rule_name,
        models.AlertIncident.service_name,
        models.AlertIncident.metric_name,
        models.AlertIncident.threshold,
        models.AlertIncident.current_value,
        models.AlertIncident.severity,
        models.AlertIncident.status,
        models.AlertIncident.created_at,
        models.AlertIncident.resolved_at
    ).join(models.RegisteredApp, models.AlertIncident.app_id == models.RegisteredApp.id)
    
    conditions = []
    if app_id is not None:
        conditions.append(models.AlertIncident.app_id == app_id)
        
    if status:
        conditions.append(models.AlertIncident.status == status.upper())
        
    results = query.filter(*conditions).order_by(models.AlertIncident.created_at.desc()).all()
    
    return [
        schemas.AlertIncidentResponse(
            id=r.id,
            app_id=r.app_id,
            app_name=r.app_name,
            rule_name=r.rule_name,
            service_name=r.service_name,
            metric_name=r.metric_name,
            threshold=r.threshold,
            current_value=r.current_value,
            severity=r.severity,
            status=r.status,
            created_at=r.created_at,
            resolved_at=r.resolved_at
        ) for r in results
    ]

@router.post("/incidents/{incident_id}/resolve")
def resolve_incident(
    incident_id: int,
    db: Session = Depends(get_db)
):
    incident = db.query(models.AlertIncident).filter(models.AlertIncident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found.")
        
    if incident.status == "RESOLVED":
        return {"message": "Incident is already resolved."}
        
    incident.status = "RESOLVED"
    incident.resolved_at = datetime.datetime.utcnow()
    
    # Create system log
    log = models.LogData(
        app_id=incident.app_id,
        service_name="alerting-engine",
        severity="INFO",
        message=f"INCIDENT MANUALLY RESOLVED: Alert [{incident.rule_name}] on service [{incident.service_name}] resolved by operations team.",
        timestamp=datetime.datetime.utcnow(),
        attributes={"resolved_incident_id": incident.id}
    )
    db.add(log)
    
    # Create audit event
    audit = models.AuditEvent(
        app_id=incident.app_id,
        user_id="ops-manager",
        user_email="ops-lead@enterprise.com",
        action="ALERT_RESOLVE_MANUAL",
        resource="SystemAlerts",
        status="SUCCESS",
        ip_address="127.0.0.1",
        timestamp=datetime.datetime.utcnow(),
        details={"incident_id": incident.id, "rule_name": incident.rule_name}
    )
    db.add(audit)
    
    db.commit()
    return {"status": "success", "message": f"Incident '{incident.rule_name}' resolved."}
