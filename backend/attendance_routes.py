
import os
import secrets
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Student, AttendanceSession, Attendance
from backend.roster_service import (
    get_session_roster,
    student_in_session_roster,
)


PRIVATE_DIR = (
    Path(os.environ["LOCALAPPDATA"])
    / "FaceAttendancePrivate"
)

load_dotenv(PRIVATE_DIR / "database.env")

SCANNER_KEY = (os.getenv("SCANNER_API_KEY") or "").strip()

router = APIRouter(
    prefix="/api",
    tags=["Face Attendance"],
)


def utc_now():
    return datetime.now(timezone.utc)


def require_scanner(
    x_scanner_key: str = Header(default=""),
):
    if not SCANNER_KEY:
        raise HTTPException(
            status_code=503,
            detail="Scanner API key not configured",
        )

    if not secrets.compare_digest(
        x_scanner_key,
        SCANNER_KEY,
    ):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized scanner",
        )


class AttendanceScan(BaseModel):
    student_id: str = Field(
        min_length=36,
        max_length=36,
    )
    liveness_passed: bool
    recognition_passed: bool


@router.post(
    "/sessions/{session_id}/scan",
    dependencies=[Depends(require_scanner)],
)
def mark_face_attendance(
    session_id: int,
    data: AttendanceScan,
    db: Session = Depends(get_db),
):
    try:
        session = db.scalar(
            select(AttendanceSession)
            .where(
                AttendanceSession.session_id == session_id
            )
            .with_for_update()
        )

        if session is None:
            raise HTTPException(
                status_code=404,
                detail="Attendance session not found",
            )

        if session.status != "ACTIVE":
            raise HTTPException(
                status_code=409,
                detail="Attendance session is not active",
            )

        if not (
            data.liveness_passed
            and data.recognition_passed
        ):
            raise HTTPException(
                status_code=403,
                detail="Face verification failed",
            )

        student = db.get(
            Student,
            data.student_id,
        )

        if student is None:
            raise HTTPException(
                status_code=404,
                detail="Student not found",
            )

        if not student.is_active:
            raise HTTPException(
                status_code=403,
                detail="Student is inactive",
            )

        # Scheduled sessions use their frozen roster.
        # Legacy sessions use existing subject enrollment.
        eligible = student_in_session_roster(
            db,
            session,
            student.student_id,
        )

        if not eligible:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Student does not belong to "
                    "this attendance session"
                ),
            )

        # Load stored identity information from
        # the correct roster source.
        roster = get_session_roster(db, session)

        roster_student = next(
            (
                item
                for item in roster
                if item.student_id == student.student_id
            ),
            None,
        )

        if roster_student is None:
            raise HTTPException(
                status_code=409,
                detail="Student missing from session roster",
            )

        existing = db.scalar(
            select(Attendance).where(
                Attendance.session_id == session_id,
                Attendance.student_id == student.student_id,
            )
        )

        if existing is not None:
            db.rollback()

            return {
                "status": "ALREADY_MARKED",
                "session_id": session_id,
                "name": roster_student.name,
                "roll_number": roster_student.roll_number,
            }

        record = Attendance(
            session_id=session_id,
            student_id=student.student_id,
            status="PRESENT",
            source="FACE",
            marked_at=utc_now(),
        )

        db.add(record)
        db.commit()

        return {
            "status": "PRESENT",
            "session_id": session_id,
            "name": roster_student.name,
            "roll_number": roster_student.roll_number,
        }

    except IntegrityError:
        db.rollback()

        # Concurrent duplicate attempts are
        # protected by the database UNIQUE key.
        raise HTTPException(
            status_code=409,
            detail="Attendance record already exists",
        )

    except Exception:
        db.rollback()
        raise
