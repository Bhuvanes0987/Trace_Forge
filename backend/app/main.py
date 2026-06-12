from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import engine, Base, migrate_registered_app_owner_email_to_url, SessionLocal
from .routers import apps, telemetry, audit, dashboards, alerts, intelligence
from fastapi.staticfiles import StaticFiles
from . import simulator

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

# Serve static assets (generated graph viewer / exports)
static_dir = Path(__file__).resolve().parent.parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Startup event: seed default data on first run
@app.on_event("startup")
def startup_event():
    try:
        db = SessionLocal()
        # Seed apps if not already seeded
        apps = simulator.seed_default_applications(db)
        # Seed memory fabric data
        simulator.seed_memory_fabric(db)
        # Generate initial telemetry batch
        simulator.generate_telemetry_batch(db, apps)
        db.close()
        print("✅ Startup data seeding complete.")
    except Exception as e:
        print(f"⚠️ Startup seeding error (non-fatal): {e}")

# Register Core Routers
app.include_router(apps.router)
app.include_router(telemetry.router)
app.include_router(audit.router)
app.include_router(dashboards.router)
app.include_router(alerts.router)
app.include_router(intelligence.router)

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
