from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import engine, Base, migrate_registered_app_owner_email_to_url
from .routers import apps, telemetry, audit, dashboards, alerts

# Ensure schema is aligned with model changes
migrate_registered_app_owner_email_to_url()

# Create DB Tables automatically (highly resilient start-up pattern)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    description="Centralized OpenTelemetry-compatible Ingest and Governance Engine for 17+ Enterprise Applications.",
    version="1.0.0",
    debug=settings.DEBUG
)

# Enable CORS (Allows React UI to securely communicate with API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Core Routers
app.include_router(apps.router)
app.include_router(telemetry.router)
app.include_router(audit.router)
app.include_router(dashboards.router)
app.include_router(alerts.router)

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "platform": settings.APP_NAME,
        "api_docs": "/docs",
        "otlp_receivers": {
            "traces": "/v1/traces",
            "metrics": "/v1/metrics",
            "logs": "/v1/logs"
        }
    }
