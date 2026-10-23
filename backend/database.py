
import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

PRIVATE_DIR = (
    Path(os.environ.get("LOCALAPPDATA", ""))
    / "FaceAttendancePrivate"
)

PROJECT_DIR = Path(__file__).resolve().parent.parent

# Load from Private dir first, then fallback to project dir
if (PRIVATE_DIR / "database.env").is_file():
    load_dotenv(PRIVATE_DIR / "database.env")
elif (PROJECT_DIR / "database.env").is_file():
    load_dotenv(PROJECT_DIR / "database.env")
elif (PROJECT_DIR / ".env").is_file():
    load_dotenv(PROJECT_DIR / ".env")

HOST = os.getenv("DB_HOST", "127.0.0.1").strip()
PORT = os.getenv("DB_PORT", "3306").strip()
NAME = os.getenv("DB_NAME", "face_attendance").strip()
USER = (os.getenv("DB_USER") or "root").strip()
PASSWORD = (os.getenv("DB_PASSWORD") or "").strip()

if not USER or PASSWORD is None:
    raise RuntimeError(
        "Database credentials are missing. "
        "Check database.env."
    )

DATABASE_URL = (
    f"mysql+pymysql://{quote_plus(USER)}:"
    f"{quote_plus(PASSWORD)}@{HOST}:{PORT}/{NAME}"
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


def get_db():
    with SessionLocal() as db:
        yield db


def test_connection():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    print("MySQL connected successfully!")
