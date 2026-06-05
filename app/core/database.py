from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Try MySQL first, fallback to SQLite for demo
try:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=settings.DEBUG,
    )
    # Test connection
    with engine.connect() as conn:
        pass
    logger.info("✅ Connected to MySQL database")
except Exception as e:
    logger.warning(f"⚠️  MySQL unavailable ({e}), using SQLite for demo")
    engine = create_engine(
        settings.DATABASE_URL_SQLITE,
        connect_args={"check_same_thread": False},
        echo=settings.DEBUG,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    import app.models  # noqa - triggers all model registrations
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables created")
