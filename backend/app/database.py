from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

# Adjust sqlite connection args
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL, 
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def migrate_registered_app_owner_email_to_url():
    """Remove deprecated owner_email column and ensure url column exists."""
    inspector = inspect(engine)
    if "registered_apps" not in inspector.get_table_names():
        return

    columns = [column["name"] for column in inspector.get_columns("registered_apps")]
    
    with engine.begin() as conn:
        # If old owner_email column exists, drop it (url should exist from model)
        if "owner_email" in columns:
            try:
                conn.execute(text("ALTER TABLE registered_apps DROP COLUMN owner_email"))
            except Exception as e:
                # SQLite doesn't support DROP COLUMN in older versions
                # Just log and continue—the column won't cause issues if url exists
                pass
        
        # Ensure url column exists (should be added by model)
        if "url" not in columns:
            conn.execute(text("ALTER TABLE registered_apps ADD COLUMN url VARCHAR(255)"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
