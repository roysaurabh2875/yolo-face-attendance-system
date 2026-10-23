
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    func,
)

from backend.database import Base


class AttendanceSessionSchedule(Base):
    __tablename__ = "attendance_session_schedule"

    session_id = Column(
        Integer,
        ForeignKey("attendance_sessions.session_id"),
        primary_key=True,
    )

    timetable_id = Column(
        Integer,
        ForeignKey("timetable.timetable_id"),
        nullable=False,
    )

    class_id = Column(
        Integer,
        ForeignKey("academic_classes.class_id"),
        nullable=False,
    )

    teacher_id = Column(
        Integer,
        ForeignKey("teachers.teacher_id"),
        nullable=False,
    )

    room_id = Column(
        Integer,
        ForeignKey("classrooms.room_id"),
        nullable=False,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )


class AttendanceSessionRoster(Base):
    __tablename__ = "attendance_session_roster"

    roster_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    session_id = Column(
        Integer,
        ForeignKey("attendance_sessions.session_id"),
        nullable=False,
    )

    student_id = Column(
        String(36),
        ForeignKey("students.student_id"),
        nullable=False,
    )

    roll_number = Column(String(30), nullable=False)
    student_name = Column(String(100), nullable=False)
    section = Column(String(20), nullable=False)

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )

    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "student_id",
            name="uq_session_roster_student",
        ),
    )
