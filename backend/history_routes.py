
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth_security import require_jwt_admin

from backend.models import (
    AttendanceSession,
    Attendance,
    Subject,
)

from backend.academic_models import (
    AcademicClass,
    Teacher,
    Classroom,
)

from backend.schedule_models import (
    AttendanceSessionSchedule,
    AttendanceSessionRoster,
)


router = APIRouter(
    prefix="/api/admin/history",
    tags=["Admin - Attendance History"],
    dependencies=[Depends(require_jwt_admin)],
)


# ==========================================
# 1. ATTENDANCE HISTORY
# ==========================================

@router.get("/sessions")
def get_attendance_history(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    subject_id: Optional[int] = Query(
        default=None, gt=0
    ),
    class_id: Optional[int] = Query(
        default=None, gt=0
    ),
    status: Optional[str] = None,
    limit: int = Query(
        default=20, ge=1, le=100
    ),
    offset: int = Query(
        default=0, ge=0
    ),
    db: Session = Depends(get_db),
):

    # --------------------------------------
    # VALIDATE FILTERS
    # --------------------------------------

    if (
        start_date is not None
        and end_date is not None
        and start_date > end_date
    ):
        raise HTTPException(
            status_code=422,
            detail="Start date cannot exceed end date",
        )

    if status is not None:
        status = status.strip().upper()

        if status not in (
            "ACTIVE",
            "REVIEW",
            "FINALIZED",
        ):
            raise HTTPException(
                status_code=422,
                detail="Invalid session status",
            )

    # --------------------------------------
    # BUILD QUERY
    # --------------------------------------

    statement = (
        select(
            AttendanceSession,
            Subject,
            AttendanceSessionSchedule,
            AcademicClass,
            Teacher,
            Classroom,
        )
        .join(
            Subject,
            AttendanceSession.subject_id
            == Subject.subject_id,
        )
        .outerjoin(
            AttendanceSessionSchedule,
            AttendanceSession.session_id
            == AttendanceSessionSchedule.session_id,
        )
        .outerjoin(
            AcademicClass,
            AttendanceSessionSchedule.class_id
            == AcademicClass.class_id,
        )
        .outerjoin(
            Teacher,
            AttendanceSessionSchedule.teacher_id
            == Teacher.teacher_id,
        )
        .outerjoin(
            Classroom,
            AttendanceSessionSchedule.room_id
            == Classroom.room_id,
        )
    )

    if start_date is not None:
        statement = statement.where(
            AttendanceSession.session_date
            >= start_date
        )

    if end_date is not None:
        statement = statement.where(
            AttendanceSession.session_date
            <= end_date
        )

    if subject_id is not None:
        statement = statement.where(
            AttendanceSession.subject_id
            == subject_id
        )

    if class_id is not None:
        statement = statement.where(
            AttendanceSessionSchedule.class_id
            == class_id
        )

    if status is not None:
        statement = statement.where(
            AttendanceSession.status == status
        )

    # --------------------------------------
    # TOTAL MATCHING SESSIONS
    # --------------------------------------

    total = db.scalar(
        select(func.count())
        .select_from(statement.subquery())
    ) or 0

    # --------------------------------------
    # PAGINATE RESULTS
    # --------------------------------------

    statement = (
        statement
        .order_by(
            AttendanceSession.session_date.desc(),
            AttendanceSession.period_number.desc(),
            AttendanceSession.session_id.desc(),
        )
        .limit(limit)
        .offset(offset)
    )

    rows = db.execute(statement).all()

    result = []

    for (
        session,
        subject,
        schedule,
        academic_class,
        teacher,
        classroom,
    ) in rows:

        # ----------------------------------
        # COUNT ATTENDANCE STATUSES
        # ----------------------------------

        counts = db.execute(
            select(
                Attendance.status,
                func.count(Attendance.attendance_id),
            )
            .where(
                Attendance.session_id
                == session.session_id
            )
            .group_by(Attendance.status)
        ).all()

        status_counts = {
            attendance_status: count
            for attendance_status, count in counts
        }

        present = status_counts.get(
            "PRESENT", 0
        )

        absent = status_counts.get(
            "ABSENT", 0
        )

        if schedule is not None:
            # Scheduled sessions have a
            # fixed enrollment snapshot.
            total_students = db.scalar(
                select(func.count())
                .select_from(AttendanceSessionRoster)
                .where(
                    AttendanceSessionRoster.session_id
                    == session.session_id
                )
            ) or 0

            unmarked = max(
                0,
                total_students - present - absent,
            )

        else:
            # Historical manually-created sessions
            # do not have a frozen roster.
            total_students = None
            unmarked = None

        if total_students is not None:
            attendance_percentage = (
                round(
                    present / total_students * 100,
                    2,
                )
                if total_students else 0.0
            )
        else:
            attendance_percentage = None

        result.append({
            "session_id": session.session_id,
            "session_type": (
                "SCHEDULED"
                if schedule is not None
                else "MANUAL"
            ),
            "session_date":
                session.session_date.isoformat(),
            "period_number": session.period_number,
            "session_status": session.status,

            "subject_id": subject.subject_id,
            "subject_code": subject.subject_code,
            "subject_name": subject.subject_name,

            "section": session.section,

            "class_id": (
                academic_class.class_id
                if academic_class is not None
                else None
            ),
            "class_code": (
                academic_class.class_code
                if academic_class is not None
                else None
            ),

            "teacher_name": (
                teacher.teacher_name
                if teacher is not None
                else None
            ),

            "room_number": (
                classroom.room_number
                if classroom is not None
                else None
            ),

            "total_students": total_students,
            "present": present,
            "absent": absent,
            "unmarked": unmarked,
            "attendance_percentage":
                attendance_percentage,

            "started_at": (
                session.started_at.isoformat()
                if session.started_at
                else None
            ),

            "ended_at": (
                session.ended_at.isoformat()
                if session.ended_at
                else None
            ),
        })

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "returned": len(result),
        "sessions": result,
    }
