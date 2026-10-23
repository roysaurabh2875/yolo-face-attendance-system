
import os
import secrets
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from fastapi import (
    APIRouter, Depends, Header, HTTPException
)
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import (
    Student, Subject, Enrollment, AttendanceSession
)

private_dir = (
    Path(os.environ["LOCALAPPDATA"])
    / "FaceAttendancePrivate"
)
load_dotenv(private_dir / "database.env")

ADMIN_KEY = os.getenv("DEV_ADMIN_KEY")

router = APIRouter(prefix="/api", tags=["Academic Management"])


def require_admin(x_admin_key: str = Header(default="")):
    if not ADMIN_KEY:
        raise HTTPException(
            status_code=503,
            detail="Development admin key is not configured"
        )

    if not secrets.compare_digest(x_admin_key, ADMIN_KEY):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized"
        )


class SubjectCreate(BaseModel):
    subject_code: str = Field(min_length=1, max_length=30)
    subject_name: str = Field(min_length=1, max_length=100)


class EnrollmentCreate(BaseModel):
    student_id: str
    subject_id: int


class SessionCreate(BaseModel):
    subject_id: int
    section: str = Field(min_length=1, max_length=20)
    session_date: date
    period_number: int = Field(ge=1, le=20)


@router.post("/subjects", dependencies=[Depends(require_admin)])
def create_subject(
    data: SubjectCreate,
    db: Session = Depends(get_db)
):
    code = data.subject_code.strip().upper()
    name = data.subject_name.strip()

    if not code or not name:
        raise HTTPException(422, "Subject fields cannot be blank")

    subject = Subject(
        subject_code=code,
        subject_name=name
    )

    db.add(subject)

    try:
        db.commit()
        db.refresh(subject)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Subject code already exists")

    return {
        "subject_id": subject.subject_id,
        "subject_code": subject.subject_code,
        "subject_name": subject.subject_name
    }


@router.get("/subjects", dependencies=[Depends(require_admin)])
def list_subjects(db: Session = Depends(get_db)):
    subjects = db.scalars(
        select(Subject).order_by(Subject.subject_code)
    ).all()

    return [
        {
            "subject_id": s.subject_id,
            "subject_code": s.subject_code,
            "subject_name": s.subject_name
        }
        for s in subjects
    ]


@router.post("/enrollments", dependencies=[Depends(require_admin)])
def enroll_student(
    data: EnrollmentCreate,
    db: Session = Depends(get_db)
):
    student = db.get(Student, data.student_id)
    subject = db.get(Subject, data.subject_id)

    if not student or not student.is_active:
        raise HTTPException(404, "Active student not found")

    if not subject:
        raise HTTPException(404, "Subject not found")

    enrollment = Enrollment(
        student_id=data.student_id,
        subject_id=data.subject_id
    )
    db.add(enrollment)

    try:
        db.commit()
        db.refresh(enrollment)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Student already enrolled")

    return {
        "message": "Student enrolled successfully",
        "enrollment_id": enrollment.enrollment_id
    }


@router.post("/sessions", dependencies=[Depends(require_admin)])
def create_session(
    data: SessionCreate,
    db: Session = Depends(get_db)
):
    subject = db.get(Subject, data.subject_id)

    if not subject:
        raise HTTPException(404, "Subject not found")

    section = data.section.strip().upper()
    if not section:
        raise HTTPException(422, "Section cannot be blank")

    # A session must have at least one enrolled student.
    
    enrolled_student = db.scalar(
        select(Student.student_id)
        .join(
            Enrollment,
            Enrollment.student_id == Student.student_id
        )
        .where(
            Enrollment.subject_id == data.subject_id,
            func.upper(Student.section) == section,
            Student.is_active.is_(True)
        )
        .limit(1)
    )


    if enrolled_student is None:
        raise HTTPException(
            400,
            "No active students enrolled for this section"
        )

    session = AttendanceSession(
        subject_id=data.subject_id,
        section=section,
        session_date=data.session_date,
        period_number=data.period_number,
        status="ACTIVE"
    )

    db.add(session)

    try:
        db.commit()
        db.refresh(session)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409, "Attendance session already exists"
        )

    return {
        "session_id": session.session_id,
        "subject_id": session.subject_id,
        "section": session.section,
        "date": session.session_date.isoformat(),
        "period": session.period_number,
        "status": session.status
    }


@router.get("/sessions", dependencies=[Depends(require_admin)])
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.scalars(
        select(AttendanceSession)
        .order_by(AttendanceSession.session_id.desc())
    ).all()

    return [
        {
            "session_id": s.session_id,
            "subject_id": s.subject_id,
            "section": s.section,
            "date": s.session_date.isoformat(),
            "period": s.period_number,
            "status": s.status
        }
        for s in sessions
    ]
