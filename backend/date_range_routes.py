
from collections import defaultdict
from datetime import date

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth_security import require_jwt_admin

from backend.models import (
    Attendance,
    AttendanceSession,
    Subject,
)

from backend.academic_models import AcademicClass

from backend.schedule_models import (
    AttendanceSessionSchedule,
    AttendanceSessionRoster,
)


router = APIRouter(
    prefix="/api/admin/reports",
    tags=["Admin - Date Range Reports"],
    dependencies=[Depends(require_jwt_admin)],
)


@router.get("/attendance")
def get_date_range_attendance(
    start_date: date,
    end_date: date,
    class_id: int | None = Query(
        default=None, gt=0
    ),
    subject_id: int | None = Query(
        default=None, gt=0
    ),
    include_students: bool = True,
    limit: int = Query(
        default=20, ge=1, le=100
    ),
    offset: int = Query(
        default=0, ge=0
    ),
    db: Session = Depends(get_db),
):
    # ======================================
    # 1. VALIDATE DATE RANGE
    # ======================================

    if start_date > end_date:
        raise HTTPException(
            status_code=422,
            detail="Start date cannot exceed end date",
        )

    if (end_date - start_date).days > 366:
        raise HTTPException(
            status_code=422,
            detail="Maximum supported range is 366 days",
        )

    # ======================================
    # 2. FIND FINALIZED SCHEDULED SESSIONS
    # ======================================

    filters = [
        AttendanceSession.status == "FINALIZED",
        AttendanceSession.session_date >= start_date,
        AttendanceSession.session_date <= end_date,
    ]

    if class_id is not None:
        filters.append(
            AttendanceSessionSchedule.class_id == class_id
        )

    if subject_id is not None:
        filters.append(
            AttendanceSession.subject_id == subject_id
        )

    base_statement = (
        select(
            AttendanceSession,
            Subject,
            AttendanceSessionSchedule,
            AcademicClass,
        )
        .join(
            AttendanceSessionSchedule,
            AttendanceSessionSchedule.session_id
            == AttendanceSession.session_id,
        )
        .join(
            Subject,
            Subject.subject_id
            == AttendanceSession.subject_id,
        )
        .join(
            AcademicClass,
            AcademicClass.class_id
            == AttendanceSessionSchedule.class_id,
        )
        .where(*filters)
    )

    total_matching = db.scalar(
        select(func.count())
        .select_from(base_statement.subquery())
    ) or 0

    statement = (
        base_statement
        .order_by(
            AttendanceSession.session_date,
            AttendanceSession.period_number,
            AttendanceSession.session_id,
        )
        .limit(limit)
        .offset(offset)
    )

    sessions = db.execute(statement).all()

    session_ids = [
        session.session_id
        for session, _, _, _ in sessions
    ]

    # ======================================
    # 3. LOAD ROSTERS AND ATTENDANCE IN BULK
    # ======================================

    roster_by_session = defaultdict(list)
    attendance_by_session = defaultdict(dict)

    if session_ids:
        roster_rows = db.scalars(
            select(AttendanceSessionRoster)
            .where(
                AttendanceSessionRoster.session_id.in_(
                    session_ids
                )
            )
            .order_by(
                AttendanceSessionRoster.roll_number
            )
        ).all()

        for roster in roster_rows:
            roster_by_session[
                roster.session_id
            ].append(roster)

        attendance_rows = db.scalars(
            select(Attendance)
            .where(
                Attendance.session_id.in_(session_ids)
            )
        ).all()

        for attendance in attendance_rows:
            attendance_by_session[
                attendance.session_id
            ][attendance.student_id] = attendance

    # ======================================
    # 4. BUILD REPORT
    # ======================================

    report_sessions = []

    total_present = 0
    total_absent = 0
    total_expected = 0

    for (
        session,
        subject,
        schedule,
        academic_class,
    ) in sessions:

        roster = roster_by_session[
            session.session_id
        ]

        attendance_map = attendance_by_session[
            session.session_id
        ]

        if not roster:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Session {session.session_id} "
                    "has no frozen roster"
                ),
            )

        roster_ids = {
            item.student_id
            for item in roster
        }

        recorded_ids = set(attendance_map)

        if roster_ids != recorded_ids:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Session {session.session_id} "
                    "has missing or unexpected "
                    "attendance records"
                ),
            )

        present = 0
        absent = 0
        students = []

        for student in roster:
            record = attendance_map[
                student.student_id
            ]

            if record.status == "PRESENT":
                present += 1

            elif record.status == "ABSENT":
                absent += 1

            else:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Invalid attendance status "
                        f"in session {session.session_id}"
                    ),
                )

            if include_students:
                students.append({
                    "student_id": student.student_id,
                    "roll_number": student.roll_number,
                    "name": student.student_name,
                    "status": record.status,
                    "source": record.source,
                })

        expected = len(roster)

        percentage = round(
            present / expected * 100, 2
        )

        total_expected += expected
        total_present += present
        total_absent += absent

        session_result = {
            "session_id": session.session_id,
            "date": session.session_date.isoformat(),
            "period_number": session.period_number,
            "class_id": academic_class.class_id,
            "class_code": academic_class.class_code,
            "subject_id": subject.subject_id,
            "subject_code": subject.subject_code,
            "subject_name": subject.subject_name,
            "room_id": schedule.room_id,
            "teacher_id": schedule.teacher_id,
            "total_students": expected,
            "present": present,
            "absent": absent,
            "attendance_percentage": percentage,
        }

        if include_students:
            session_result["students"] = students

        report_sessions.append(session_result)

    # ======================================
    # 5. SUMMARY FOR RETURNED PAGE
    # ======================================

    overall_percentage = (
        round(
            total_present / total_expected * 100,
            2,
        )
        if total_expected
        else None
    )

    return {
        "filters": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "class_id": class_id,
            "subject_id": subject_id,
        },
        "pagination": {
            "total_matching_sessions": total_matching,
            "limit": limit,
            "offset": offset,
            "returned": len(report_sessions),
        },
        "summary_scope": "RETURNED_PAGE_ONLY",
        "summary": {
            "total_sessions": len(report_sessions),
            "total_student_attendances": total_expected,
            "present": total_present,
            "absent": total_absent,
            "attendance_percentage": overall_percentage,
        },
        "sessions": report_sessions,
        "note": (
            "Only finalized timetable-based sessions "
            "are included. Summary totals describe "
            "the returned page, not all pages. "
            "Legacy manual sessions are excluded."
        ),
    }
