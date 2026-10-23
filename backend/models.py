
from datetime import datetime, timezone, date

from sqlalchemy import (
    String, Integer, Date, DateTime,
    ForeignKey, UniqueConstraint, Text
)
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Student(Base):
    __tablename__ = "students"

    student_id: Mapped[str] = mapped_column(
        String(36), primary_key=True
    )
    roll_number: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(100))
    department: Mapped[str] = mapped_column(String(50))
    section: Mapped[str] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(default=True)


class Subject(Base):
    __tablename__ = "subjects"

    subject_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    subject_code: Mapped[str] = mapped_column(
        String(30), unique=True
    )
    subject_name: Mapped[str] = mapped_column(String(100))


class Enrollment(Base):
    __tablename__ = "enrollments"

    enrollment_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    student_id: Mapped[str] = mapped_column(
        ForeignKey("students.student_id"), nullable=False
    )
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.subject_id"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "student_id", "subject_id",
            name="uq_student_subject"
        ),
    )


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    session_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.subject_id"), nullable=False
    )
    section: Mapped[str] = mapped_column(String(20))
    session_date: Mapped[date] = mapped_column(Date)
    period_number: Mapped[int] = mapped_column(Integer)

    # ACTIVE -> REVIEW -> FINALIZED
    status: Mapped[str] = mapped_column(
        String(20), default="ACTIVE"
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        UniqueConstraint(
            "subject_id", "section",
            "session_date", "period_number",
            name="uq_subject_period"
        ),
    )


class Attendance(Base):
    __tablename__ = "attendance"

    attendance_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    session_id: Mapped[int] = mapped_column(
        ForeignKey("attendance_sessions.session_id"),
        nullable=False
    )
    student_id: Mapped[str] = mapped_column(
        ForeignKey("students.student_id"),
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), default="PRESENT"
    )
    source: Mapped[str] = mapped_column(
        String(20), default="FACE"
    )
    marked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    __table_args__ = (
        UniqueConstraint(
            "session_id", "student_id",
            name="uq_attendance_once"
        ),
    )


class AttendanceAudit(Base):
    __tablename__ = "attendance_audit"

    audit_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    attendance_id: Mapped[int] = mapped_column(
        ForeignKey("attendance.attendance_id"),
        nullable=False
    )
    previous_status: Mapped[str] = mapped_column(String(20))
    new_status: Mapped[str] = mapped_column(String(20))
    changed_by: Mapped[str] = mapped_column(String(100))
    reason: Mapped[str] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
