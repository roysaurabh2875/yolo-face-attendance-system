
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth_security import require_jwt_admin

# Import old models before new mappings
from backend.models import (
    Student,
    Subject,
    AttendanceSession,
)

from backend.academic_models import (
    AcademicClass,
    Classroom,
    Teacher,
    TeachingAssignment,
    ClassStudentAssignment,
    Timetable,
)

from backend.schedule_models import (
    AttendanceSessionSchedule,
    AttendanceSessionRoster,
)


router = APIRouter(
    prefix="/api/admin/scheduled-sessions",
    tags=["Admin - Scheduled Attendance"],
    dependencies=[Depends(require_jwt_admin)],
)


# ==========================================
# REQUEST MODEL
# ==========================================

class ScheduledSessionCreate(BaseModel):
    timetable_id: int = Field(gt=0)
    session_date: date


# ==========================================
# CREATE A SESSION FROM TIMETABLE
# ==========================================

@router.post("", status_code=201)
def create_scheduled_session(
    data: ScheduledSessionCreate,
    db: Session = Depends(get_db),
):
    today = datetime.now().date()

    if data.session_date != today:
        raise HTTPException(
            status_code=422,
            detail=(
                "This test version only creates "
                "sessions for the current local date."
            ),
        )

    try:
        # Lock the timetable row to serialize
        # session creation for this entry.
        timetable = db.scalar(
            select(Timetable)
            .where(
                Timetable.timetable_id
                == data.timetable_id
            )
            .with_for_update()
        )

        if timetable is None:
            raise HTTPException(
                404, "Timetable entry not found"
            )

        if not timetable.is_active:
            raise HTTPException(
                409, "Timetable entry is inactive"
            )

        if (
            data.session_date.isoweekday()
            != timetable.day_of_week
        ):
            raise HTTPException(
                422,
                "Date does not match timetable weekday"
            )

        assignment = db.get(
            TeachingAssignment,
            timetable.teaching_assignment_id,
        )

        if (
            assignment is None
            or not assignment.is_active
        ):
            raise HTTPException(
                409,
                "Teaching assignment is inactive or missing",
            )

        academic_class = db.get(
            AcademicClass,
            assignment.class_id,
        )

        teacher = db.get(
            Teacher,
            assignment.teacher_id,
        )

        subject = db.get(
            Subject,
            assignment.subject_id,
        )

        room = db.get(
            Classroom,
            timetable.room_id,
        )

        if (
            academic_class is None
            or not academic_class.is_active
        ):
            raise HTTPException(
                409, "Academic class is unavailable"
            )

        if teacher is None or not teacher.is_active:
            raise HTTPException(
                409, "Assigned teacher is unavailable"
            )

        if subject is None:
            raise HTTPException(
                404, "Subject not found"
            )

        if room is None or not room.is_active:
            raise HTTPException(
                409, "Classroom is unavailable"
            )

        # Existing sessions use a uniqueness rule
        # on subject, section, date and period.
        # Check that before attempting an insert.
        existing_session = db.scalar(
            select(AttendanceSession).where(
                AttendanceSession.subject_id
                == subject.subject_id,
                func.upper(AttendanceSession.section)
                == academic_class.section.upper(),
                AttendanceSession.session_date
                == data.session_date,
                AttendanceSession.period_number
                == timetable.period_number,
            )
        )

        if existing_session:
            raise HTTPException(
                409,
                (
                    "An attendance session already exists "
                    "for this subject, section, date and period"
                ),
            )

        # Use only active students assigned
        # to this particular academic class.
        students = db.scalars(
            select(Student)
            .join(
                ClassStudentAssignment,
                ClassStudentAssignment.student_id
                == Student.student_id,
            )
            .where(
                ClassStudentAssignment.class_id
                == academic_class.class_id,
                Student.is_active.is_(True),
            )
            .order_by(Student.roll_number)
        ).all()

        if not students:
            raise HTTPException(
                409,
                "No active students assigned to this class"
            )

        # Reject inconsistent student assignments
        # rather than silently changing sections.
        for student in students:
            if (
                student.section.strip().upper()
                != academic_class.section.strip().upper()
            ):
                raise HTTPException(
                    409,
                    "Student section does not match class"
                )

        if len(students) > room.capacity:
            raise HTTPException(
                409,
                "Student roster exceeds classroom capacity"
            )

        # ----------------------------------
        # A. CREATE ATTENDANCE SESSION
        # ----------------------------------

        session = AttendanceSession(
            subject_id=subject.subject_id,
            section=academic_class.section.upper(),
            session_date=data.session_date,
            period_number=timetable.period_number,
            status="ACTIVE",
            started_at=datetime.now(timezone.utc),
        )

        db.add(session)
        db.flush()

        # ----------------------------------
        # B. CONNECT SESSION TO TIMETABLE
        # ----------------------------------

        db.add(
            AttendanceSessionSchedule(
                session_id=session.session_id,
                timetable_id=timetable.timetable_id,
                class_id=academic_class.class_id,
                teacher_id=teacher.teacher_id,
                room_id=room.room_id,
            )
        )

        # ----------------------------------
        # C. FREEZE THE STUDENT ROSTER
        # ----------------------------------

        for student in students:
            db.add(
                AttendanceSessionRoster(
                    session_id=session.session_id,
                    student_id=student.student_id,
                    roll_number=student.roll_number,
                    student_name=student.name,
                    section=student.section,
                )
            )

        db.commit()

        return {
            "message": (
                "Scheduled attendance session created"
            ),
            "session_id": session.session_id,
            "status": "ACTIVE",
            "session_date":
                data.session_date.isoformat(),
            "class_id": academic_class.class_id,
            "class_code": academic_class.class_code,
            "subject_id": subject.subject_id,
            "subject_name": subject.subject_name,
            "teacher_id": teacher.teacher_id,
            "teacher_name": teacher.teacher_name,
            "room_id": room.room_id,
            "room_number": room.room_number,
            "period_number":
                timetable.period_number,
            "total_students": len(students),
        }

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409,
            "Attendance session conflicts with an existing record"
        )

    except Exception:
        db.rollback()
        raise


# ==========================================
# VIEW THE FROZEN SESSION ROSTER
# ==========================================

@router.get("/{session_id}/roster")
def get_scheduled_session_roster(
    session_id: int,
    db: Session = Depends(get_db),
):
    session = db.get(
        AttendanceSession,
        session_id,
    )

    if session is None:
        raise HTTPException(
            404, "Session not found"
        )

    schedule = db.get(
        AttendanceSessionSchedule,
        session_id,
    )

    if schedule is None:
        raise HTTPException(
            404,
            "Session was not created from a timetable"
        )

    students = db.scalars(
        select(AttendanceSessionRoster)
        .where(
            AttendanceSessionRoster.session_id
            == session_id
        )
        .order_by(
            AttendanceSessionRoster.roll_number
        )
    ).all()

    return {
        "session_id": session_id,
        "session_status": session.status,
        "timetable_id": schedule.timetable_id,
        "class_id": schedule.class_id,
        "teacher_id": schedule.teacher_id,
        "room_id": schedule.room_id,
        "total_students": len(students),
        "students": [
            {
                "student_id": item.student_id,
                "roll_number": item.roll_number,
                "name": item.student_name,
                "section": item.section,
            }
            for item in students
        ],
    }
