
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth_security import require_jwt_admin
from backend.models import (
    Student,
    Subject,
    Attendance,
    AttendanceSession,
)
from backend.schedule_models import (
    AttendanceSessionSchedule,
    AttendanceSessionRoster,
)


router = APIRouter(
    prefix="/api/admin/history",
    tags=["Admin - Student Attendance History"],
    dependencies=[Depends(require_jwt_admin)],
)


@router.get("/students/{roll_number}")
def get_student_history(
    roll_number: str,
    start_date: date | None = None,
    end_date: date | None = None,
    subject_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
):
    # ========================================
    # 1. VALIDATE REQUEST
    # ========================================

    if (
        start_date is not None
        and end_date is not None
        and start_date > end_date
    ):
        raise HTTPException(
            status_code=422,
            detail="Start date cannot exceed end date",
        )

    roll_number = roll_number.strip()

    if not roll_number:
        raise HTTPException(
            status_code=422,
            detail="Roll number cannot be empty",
        )

    student = db.scalar(
        select(Student).where(
            Student.roll_number == roll_number
        )
    )

    if student is None:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    # ========================================
    # 2. GET SCHEDULED SESSION HISTORY
    # ========================================

    scheduled_statement = (
        select(
            AttendanceSessionRoster,
            AttendanceSession,
            Subject,
            Attendance,
        )
        .join(
            AttendanceSession,
            AttendanceSessionRoster.session_id
            == AttendanceSession.session_id,
        )
        .join(
            AttendanceSessionSchedule,
            AttendanceSessionSchedule.session_id
            == AttendanceSession.session_id,
        )
        .join(
            Subject,
            AttendanceSession.subject_id
            == Subject.subject_id,
        )
        .outerjoin(
            Attendance,
            (
                Attendance.session_id
                == AttendanceSessionRoster.session_id
            )
            &
            (
                Attendance.student_id
                == AttendanceSessionRoster.student_id
            ),
        )
        .where(
            AttendanceSessionRoster.student_id
            == student.student_id,
            AttendanceSession.status == "FINALIZED",
        )
    )

    if start_date is not None:
        scheduled_statement = scheduled_statement.where(
            AttendanceSession.session_date >= start_date
        )

    if end_date is not None:
        scheduled_statement = scheduled_statement.where(
            AttendanceSession.session_date <= end_date
        )

    if subject_id is not None:
        scheduled_statement = scheduled_statement.where(
            AttendanceSession.subject_id == subject_id
        )

    scheduled_statement = scheduled_statement.order_by(
        AttendanceSession.session_date.desc(),
        AttendanceSession.period_number.desc(),
        AttendanceSession.session_id.desc(),
    )

    scheduled_rows = db.execute(
        scheduled_statement
    ).all()

    history = []

    subject_stats = defaultdict(
        lambda: {
            "total_periods": 0,
            "present": 0,
            "absent": 0,
        }
    )

    for roster, session, subject, attendance in scheduled_rows:

        if attendance is None:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Finalized session {session.session_id} "
                    "has missing attendance"
                ),
            )

        status = attendance.status

        if status not in ("PRESENT", "ABSENT"):
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Finalized session {session.session_id} "
                    "contains an invalid attendance status"
                ),
            )

        stats = subject_stats[
            (subject.subject_id, subject.subject_code,
             subject.subject_name)
        ]

        stats["total_periods"] += 1

        if status == "PRESENT":
            stats["present"] += 1
        else:
            stats["absent"] += 1

        history.append({
            "session_id": session.session_id,
            "date": session.session_date.isoformat(),
            "period_number": session.period_number,
            "subject_id": subject.subject_id,
            "subject_code": subject.subject_code,
            "subject_name": subject.subject_name,
            "status": status,
            "source": attendance.source,
            "session_type": "SCHEDULED",
        })

    # ========================================
    # 3. OVERALL ATTENDANCE PERCENTAGE
    # ========================================

    total_periods = len(history)

    present = sum(
        row["status"] == "PRESENT"
        for row in history
    )

    absent = sum(
        row["status"] == "ABSENT"
        for row in history
    )

    percentage = (
        round(present / total_periods * 100, 2)
        if total_periods else None
    )

    # ========================================
    # 4. SUBJECT-WISE STATISTICS
    # ========================================

    subjects = []

    for (
        sub_id,
        sub_code,
        sub_name,
    ), stats in sorted(subject_stats.items()):

        sub_total = stats["total_periods"]

        subjects.append({
            "subject_id": sub_id,
            "subject_code": sub_code,
            "subject_name": sub_name,
            "total_periods": sub_total,
            "present": stats["present"],
            "absent": stats["absent"],
            "attendance_percentage": round(
                stats["present"] / sub_total * 100, 2
            ),
        })

    # ========================================
    # 5. LEGACY MANUAL ATTENDANCE
    # ========================================

    legacy_statement = (
        select(
            Attendance,
            AttendanceSession,
            Subject,
        )
        .join(
            AttendanceSession,
            Attendance.session_id
            == AttendanceSession.session_id,
        )
        .join(
            Subject,
            AttendanceSession.subject_id
            == Subject.subject_id,
        )
        .outerjoin(
            AttendanceSessionSchedule,
            AttendanceSessionSchedule.session_id
            == AttendanceSession.session_id,
        )
        .where(
            Attendance.student_id == student.student_id,
            AttendanceSessionSchedule.session_id.is_(None),
            AttendanceSession.status == "FINALIZED",
        )
    )

    if start_date is not None:
        legacy_statement = legacy_statement.where(
            AttendanceSession.session_date >= start_date
        )

    if end_date is not None:
        legacy_statement = legacy_statement.where(
            AttendanceSession.session_date <= end_date
        )

    if subject_id is not None:
        legacy_statement = legacy_statement.where(
            AttendanceSession.subject_id == subject_id
        )

    legacy_statement = legacy_statement.order_by(
        AttendanceSession.session_date.desc(),
        AttendanceSession.period_number.desc(),
    )

    legacy_rows = db.execute(
        legacy_statement
    ).all()

    legacy_history = [
        {
            "session_id": session.session_id,
            "date": session.session_date.isoformat(),
            "period_number": session.period_number,
            "subject_code": subject.subject_code,
            "subject_name": subject.subject_name,
            "status": attendance.status,
            "source": attendance.source,
            "session_type": "MANUAL",
        }
        for attendance, session, subject in legacy_rows
    ]

    # ========================================
    # 6. FINAL RESPONSE
    # ========================================

    return {
        "student": {
            "student_id": student.student_id,
            "roll_number": student.roll_number,
            "name": student.name,
            "department": student.department,
            "section": student.section,
            "is_active": student.is_active,
        },
        "start_date": (
            start_date.isoformat()
            if start_date else None
        ),
        "end_date": (
            end_date.isoformat()
            if end_date else None
        ),
        "subject_id_filter": subject_id,
        "summary": {
            "total_periods": total_periods,
            "present": present,
            "absent": absent,
            "attendance_percentage": percentage,
        },
        "subject_statistics": subjects,
        "attendance_history": history,
        "legacy_manual_history": legacy_history,
        "note": (
            "Attendance percentages include finalized "
            "scheduled sessions with frozen rosters. "
            "Legacy manual records are shown separately."
        ),
    }
