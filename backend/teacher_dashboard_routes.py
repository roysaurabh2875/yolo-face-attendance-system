
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth_security import get_current_user
from backend.auth_models import UserAccount

from backend.models import (
    AttendanceSession,
    Attendance,
    Subject,
)
from backend.academic_models import (
    Teacher,
    AcademicClass,
    Classroom,
    TeachingAssignment,
)
from backend.schedule_models import (
    AttendanceSessionSchedule,
    AttendanceSessionRoster,
)


router = APIRouter(
    prefix="/api/teacher",
    tags=["Teacher Dashboard"],
)


def require_active_teacher(
    db: Session = Depends(get_db),
    user: UserAccount = Depends(get_current_user),
):
    if user.role != "TEACHER":
        raise HTTPException(
            status_code=403,
            detail="Teacher account required",
        )

    teacher = (
        db.get(Teacher, user.teacher_id)
        if user.teacher_id is not None
        else None
    )

    if teacher is None or not teacher.is_active:
        raise HTTPException(
            status_code=403,
            detail="Teacher is inactive or missing",
        )

    return teacher


@router.get("/dashboard")
def teacher_dashboard(
    teacher: Teacher = Depends(require_active_teacher),
    db: Session = Depends(get_db),
):
    assignments = db.execute(
        select(
            TeachingAssignment,
            Subject,
            AcademicClass,
        )
        .join(
            Subject,
            TeachingAssignment.subject_id
            == Subject.subject_id,
        )
        .join(
            AcademicClass,
            TeachingAssignment.class_id
            == AcademicClass.class_id,
        )
        .where(
            TeachingAssignment.teacher_id
            == teacher.teacher_id,
            TeachingAssignment.is_active.is_(True),
        )
        .order_by(
            AcademicClass.class_code,
            Subject.subject_code,
        )
    ).all()

    result = [
        {
            "teaching_assignment_id":
                assignment.teaching_assignment_id,
            "subject_id": subject.subject_id,
            "subject_code": subject.subject_code,
            "subject_name": subject.subject_name,
            "class_id": academic_class.class_id,
            "class_code": academic_class.class_code,
            "section": academic_class.section,
        }
        for assignment, subject, academic_class
        in assignments
    ]

    return {
        "teacher_id": teacher.teacher_id,
        "teacher_name": teacher.teacher_name,
        "department": teacher.department,
        "total_assignments": len(result),
        "assignments": result,
    }


@router.get("/sessions")
def teacher_sessions(
    start_date: date | None = None,
    end_date: date | None = None,
    status: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    teacher: Teacher = Depends(require_active_teacher),
    db: Session = Depends(get_db),
):
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
            "ACTIVE", "REVIEW", "FINALIZED"
        ):
            raise HTTPException(
                status_code=422,
                detail="Invalid session status",
            )

    statement = (
        select(
            AttendanceSession,
            AttendanceSessionSchedule,
            Subject,
            AcademicClass,
            Classroom,
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
        .join(
            AcademicClass,
            AttendanceSessionSchedule.class_id
            == AcademicClass.class_id,
        )
        .join(
            Classroom,
            AttendanceSessionSchedule.room_id
            == Classroom.room_id,
        )
        .where(
            AttendanceSessionSchedule.teacher_id
            == teacher.teacher_id
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

    if status is not None:
        statement = statement.where(
            AttendanceSession.status == status
        )

    total = db.scalar(
        select(func.count())
        .select_from(statement.subquery())
    ) or 0

    rows = db.execute(
        statement.order_by(
            AttendanceSession.session_date.desc(),
            AttendanceSession.period_number.desc(),
            AttendanceSession.session_id.desc(),
        )
        .limit(limit)
        .offset(offset)
    ).all()

    result = []

    for (
        session,
        schedule,
        subject,
        academic_class,
        classroom,
    ) in rows:
        roster_count = db.scalar(
            select(func.count())
            .select_from(AttendanceSessionRoster)
            .where(
                AttendanceSessionRoster.session_id
                == session.session_id
            )
        ) or 0

        counts = dict(
            db.execute(
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
        )

        present = counts.get("PRESENT", 0)
        absent = counts.get("ABSENT", 0)
        unmarked = max(
            0, roster_count - present - absent
        )

        result.append({
            "session_id": session.session_id,
            "date": session.session_date.isoformat(),
            "period_number": session.period_number,
            "status": session.status,
            "subject_id": subject.subject_id,
            "subject_code": subject.subject_code,
            "subject_name": subject.subject_name,
            "class_id": academic_class.class_id,
            "class_code": academic_class.class_code,
            "section": academic_class.section,
            "room_number": classroom.room_number,
            "total_students": roster_count,
            "present": present,
            "absent": absent,
            "unmarked": unmarked,
        })

    return {
        "teacher_id": teacher.teacher_id,
        "total_matching": total,
        "limit": limit,
        "offset": offset,
        "sessions": result,
    }
