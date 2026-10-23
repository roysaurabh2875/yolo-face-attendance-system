
from datetime import date

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from pydantic import BaseModel, Field

from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db

from backend.models import (
    Student,
    Subject,
    Enrollment,
    AttendanceSession,
)

from backend.auth_security import require_jwt_admin


# ==========================================
# ACADEMIC MANAGEMENT ROUTER
# ==========================================

router = APIRouter(
    prefix="/api",
    tags=["Academic Management"],
)


# ==========================================
# REQUEST SCHEMAS
# ==========================================

class SubjectCreate(BaseModel):
    subject_code: str = Field(
        min_length=1,
        max_length=30,
    )
    subject_name: str = Field(
        min_length=1,
        max_length=100,
    )


class EnrollmentCreate(BaseModel):
    student_id: str
    subject_id: int


class SessionCreate(BaseModel):
    subject_id: int
    section: str = Field(
        min_length=1,
        max_length=20,
    )
    session_date: date
    period_number: int = Field(
        ge=1,
        le=20,
    )


# ==========================================
# 1. CREATE SUBJECT
# ADMIN ONLY
# ==========================================

@router.post(
    "/subjects",
    dependencies=[Depends(require_jwt_admin)],
)
def create_subject(
    data: SubjectCreate,
    db: Session = Depends(get_db),
):
    code = data.subject_code.strip().upper()
    name = data.subject_name.strip()

    if not code or not name:
        raise HTTPException(
            status_code=422,
            detail="Subject fields cannot be blank",
        )

    subject = Subject(
        subject_code=code,
        subject_name=name,
    )

    db.add(subject)

    try:
        db.commit()
        db.refresh(subject)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Subject code already exists",
        )

    return {
        "subject_id": subject.subject_id,
        "subject_code": subject.subject_code,
        "subject_name": subject.subject_name,
    }


# ==========================================
# 2. LIST SUBJECTS
# ADMIN ONLY
# ==========================================

@router.get(
    "/subjects",
    dependencies=[Depends(require_jwt_admin)],
)
def list_subjects(
    db: Session = Depends(get_db),
):
    subjects = db.scalars(
        select(Subject)
        .order_by(Subject.subject_code)
    ).all()

    return [
        {
            "subject_id": subject.subject_id,
            "subject_code": subject.subject_code,
            "subject_name": subject.subject_name,
        }
        for subject in subjects
    ]


# ==========================================
# 3. ENROLL STUDENT IN SUBJECT
# ADMIN ONLY
# ==========================================

@router.post(
    "/enrollments",
    dependencies=[Depends(require_jwt_admin)],
)
def enroll_student(
    data: EnrollmentCreate,
    db: Session = Depends(get_db),
):
    student = db.get(
        Student,
        data.student_id,
    )

    subject = db.get(
        Subject,
        data.subject_id,
    )

    if student is None or not student.is_active:
        raise HTTPException(
            status_code=404,
            detail="Active student not found",
        )

    if subject is None:
        raise HTTPException(
            status_code=404,
            detail="Subject not found",
        )

    enrollment = Enrollment(
        student_id=data.student_id,
        subject_id=data.subject_id,
    )

    db.add(enrollment)

    try:
        db.commit()
        db.refresh(enrollment)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Student already enrolled",
        )

    return {
        "message": "Student enrolled successfully",
        "enrollment_id": enrollment.enrollment_id,
    }


# ==========================================
# 4. CREATE MANUAL ATTENDANCE SESSION
# ADMIN ONLY
# ==========================================

@router.post(
    "/sessions",
    dependencies=[Depends(require_jwt_admin)],
)
def create_session(
    data: SessionCreate,
    db: Session = Depends(get_db),
):
    subject = db.get(
        Subject,
        data.subject_id,
    )

    if subject is None:
        raise HTTPException(
            status_code=404,
            detail="Subject not found",
        )

    section = data.section.strip().upper()

    if not section:
        raise HTTPException(
            status_code=422,
            detail="Section cannot be blank",
        )

    # Ensure at least one active student
    # is enrolled in the requested subject
    # and section.

    enrolled_student = db.scalar(
        select(Student.student_id)
        .join(
            Enrollment,
            Enrollment.student_id
            == Student.student_id,
        )
        .where(
            Enrollment.subject_id
            == data.subject_id,

            func.upper(Student.section)
            == section,

            Student.is_active.is_(True),
        )
        .limit(1)
    )

    if enrolled_student is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "No active students enrolled "
                "for this section"
            ),
        )

    session = AttendanceSession(
        subject_id=data.subject_id,
        section=section,
        session_date=data.session_date,
        period_number=data.period_number,
        status="ACTIVE",
    )

    db.add(session)

    try:
        db.commit()
        db.refresh(session)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Attendance session already exists",
        )

    return {
        "session_id": session.session_id,
        "subject_id": session.subject_id,
        "section": session.section,
        "date": session.session_date.isoformat(),
        "period": session.period_number,
        "status": session.status,
    }


# ==========================================
# 5. LIST ATTENDANCE SESSIONS
# ADMIN ONLY
# ==========================================

@router.get(
    "/sessions",
    dependencies=[Depends(require_jwt_admin)],
)
def list_sessions(
    db: Session = Depends(get_db),
):
    sessions = db.scalars(
        select(AttendanceSession)
        .order_by(
            AttendanceSession.session_id.desc()
        )
    ).all()

    return [
        {
            "session_id": session.session_id,
            "subject_id": session.subject_id,
            "section": session.section,
            "date": session.session_date.isoformat(),
            "period": session.period_number,
            "status": session.status,
        }
        for session in sessions
    ]
