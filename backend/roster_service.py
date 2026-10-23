
from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from backend.models import (
    Student,
    Enrollment,
    AttendanceSession,
)

from backend.schedule_models import (
    AttendanceSessionSchedule,
    AttendanceSessionRoster,
)


@dataclass(frozen=True)
class RosterStudent:
    student_id: str
    roll_number: str
    name: str
    section: str


def is_scheduled_session(
    db: Session,
    session_id: int,
) -> bool:
    """
    Check whether a session belongs to
    an administrator-maintained timetable.
    """
    mapping = db.get(
        AttendanceSessionSchedule,
        session_id,
    )

    return mapping is not None


def get_session_roster(
    db: Session,
    session: AttendanceSession,
) -> list[RosterStudent]:
    """
    Scheduled sessions:
        Use the frozen roster snapshot.

    Older manually created sessions:
        Use existing subject enrollments.

    Never silently fall back to current
    enrollments for a scheduled session.
    """

    if is_scheduled_session(db, session.session_id):

        snapshot = db.scalars(
            select(AttendanceSessionRoster)
            .where(
                AttendanceSessionRoster.session_id
                == session.session_id
            )
            .order_by(
                AttendanceSessionRoster.roll_number
            )
        ).all()

        if not snapshot:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Scheduled session has no roster "
                    "snapshot. Attendance is blocked."
                ),
            )

        return [
            RosterStudent(
                student_id=row.student_id,
                roll_number=row.roll_number,
                name=row.student_name,
                section=row.section,
            )
            for row in snapshot
        ]

    # Legacy session compatibility.
    students = db.scalars(
        select(Student)
        .join(
            Enrollment,
            Enrollment.student_id == Student.student_id,
        )
        .where(
            Enrollment.subject_id == session.subject_id,
            func.upper(Student.section)
            == session.section.upper(),
            Student.is_active.is_(True),
        )
        .order_by(Student.roll_number)
    ).all()

    return [
        RosterStudent(
            student_id=student.student_id,
            roll_number=student.roll_number,
            name=student.name,
            section=student.section,
        )
        for student in students
    ]


def student_in_session_roster(
    db: Session,
    session: AttendanceSession,
    student_id: str,
) -> bool:
    """
    Verify that the student belongs to
    the correct attendance session.
    """

    if is_scheduled_session(db, session.session_id):

        record = db.scalar(
            select(AttendanceSessionRoster.roster_id)
            .where(
                AttendanceSessionRoster.session_id
                == session.session_id,
                AttendanceSessionRoster.student_id
                == student_id,
            )
        )

        return record is not None

    # Existing enrollment-based eligibility.
    record = db.scalar(
        select(Student.student_id)
        .join(
            Enrollment,
            Enrollment.student_id == Student.student_id,
        )
        .where(
            Student.student_id == student_id,
            Student.is_active.is_(True),
            Enrollment.subject_id == session.subject_id,
            func.upper(Student.section)
            == session.section.upper(),
        )
    )

    return record is not None
