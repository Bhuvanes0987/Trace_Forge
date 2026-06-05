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
    inspector = inspect(engine)
    if "registered_apps" not in inspector.get_table_names():
        return

    columns = [column["name"] for column in inspector.get_columns("registered_apps")]
    if "url" in columns:
        return

    with engine.begin() as conn:
        if "owner_email" in columns:
            conn.execute(text("ALTER TABLE registered_apps RENAME COLUMN owner_email TO url"))
        else:
            conn.execute(text("ALTER TABLE registered_apps ADD COLUMN url VARCHAR(255)"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
