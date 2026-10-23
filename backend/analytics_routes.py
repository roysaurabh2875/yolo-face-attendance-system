
from datetime import date
from collections import defaultdict

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

from backend.academic_models import AcademicClass

from backend.schedule_models import (
    AttendanceSessionSchedule,
    AttendanceSessionRoster,
)


router = APIRouter(
    prefix="/api/admin/analytics",
    tags=["Admin - Attendance Analytics"],
    dependencies=[Depends(require_jwt_admin)],
)


@router.get("/subjects")
def subject_attendance_analytics(
    start_date: date | None = None,
    end_date: date | None = None,
    subject_id: int | None = Query(
        default=None, gt=0
    ),
    class_id: int | None = Query(
        default=None, gt=0
    ),
    db: Session = Depends(get_db),
):
    # ======================================
    # 1. VALIDATE DATE RANGE
    # ======================================

    if (
        start_date is not None
        and end_date is not None
        and start_date > end_date
    ):
        raise HTTPException(
            status_code=422,
            detail="Start date cannot exceed end date",
        )

    # ======================================
    # 2. FIND FINALIZED SESSIONS
    # ======================================

    statement = (
        select(
            AttendanceSession,
            Subject,
            AttendanceSessionSchedule,
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
        .where(
            AttendanceSession.status == "FINALIZED"
        )
    )

    if start_date is not None:
        statement = statement.where(
            AttendanceSession.session_date >= start_date
        )

    if end_date is not None:
        statement = statement.where(
            AttendanceSession.session_date <= end_date
        )

    if subject_id is not None:
        statement = statement.where(
            Subject.subject_id == subject_id
        )

    if class_id is not None:
        statement = statement.where(
            AttendanceSessionSchedule.class_id == class_id
        )

    rows = db.execute(statement).all()

    # ======================================
    # 3. CALCULATE SUBJECT-WISE RESULTS
    # ======================================

    statistics = defaultdict(
        lambda: {
            "total_sessions": 0,
            "total_students_counted": 0,
            "present": 0,
            "absent": 0,
            "manual_sessions_excluded": 0,
        }
    )

    for session, subject, schedule in rows:

        subject_key = (
            subject.subject_id,
            subject.subject_code,
            subject.subject_name,
        )

        # A scheduled session has a frozen roster.
        # This allows an accurate denominator.
        #
        # Older manual sessions do not have a
        # frozen roster. Exclude them from this
        # analytics percentage instead of using
        # potentially incomplete historical data.

        if schedule is None:
            statistics[
                subject_key
            ]["manual_sessions_excluded"] += 1

            continue

        roster_ids = set(
            db.scalars(
                select(AttendanceSessionRoster.student_id)
                .where(
                    AttendanceSessionRoster.session_id
                    == session.session_id
                )
            ).all()
        )

        if not roster_ids:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Session {session.session_id} "
                    "has an empty roster."
                ),
            )

        attendance_rows = db.execute(
            select(
                Attendance.student_id,
                Attendance.status,
            )
            .where(
                Attendance.session_id
                == session.session_id
            )
        ).all()

        recorded_ids = {
            student_id
            for student_id, status
            in attendance_rows
        }

        if recorded_ids != roster_ids:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Session {session.session_id} "
                    "has missing or unexpected "
                    "attendance records."
                ),
            )

        present = sum(
            status == "PRESENT"
            for _, status in attendance_rows
        )

        absent = sum(
            status == "ABSENT"
            for _, status in attendance_rows
        )

        if present + absent != len(roster_ids):
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Session {session.session_id} "
                    "contains invalid attendance statuses."
                ),
            )

        stats = statistics[subject_key]

        stats["total_sessions"] += 1
        stats["total_students_counted"] += len(
            roster_ids
        )
        stats["present"] += present
        stats["absent"] += absent

    # ======================================
    # 4. PREPARE RESPONSE
    # ======================================

    results = []

    for (
        sub_id,
        sub_code,
        sub_name,
    ), stats in sorted(statistics.items()):

        total = stats["total_students_counted"]

        attendance_percentage = (
            round(stats["present"] / total * 100, 2)
            if total else None
        )

        results.append({
            "subject_id": sub_id,
            "subject_code": sub_code,
            "subject_name": sub_name,
            "total_sessions": stats["total_sessions"],
            "total_student_attendances": total,
            "present": stats["present"],
            "absent": stats["absent"],
            "attendance_percentage":
                attendance_percentage,
            "manual_sessions_excluded":
                stats["manual_sessions_excluded"],
        })

    return {
        "total_subjects": len(results),
        "start_date": (
            start_date.isoformat()
            if start_date else None
        ),
        "end_date": (
            end_date.isoformat()
            if end_date else None
        ),
        "class_id": class_id,
        "subjects": results,
        "note": (
            "Statistics include finalized timetable-based "
            "sessions with verified frozen rosters. "
            "Legacy manual sessions are excluded "
            "from percentage calculations."
        ),
    }
