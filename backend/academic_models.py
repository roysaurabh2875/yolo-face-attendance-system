
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Time,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    func,
)

from backend.database import Base


# ==========================================
# 1. ACADEMIC CLASSES
# ==========================================

class AcademicClass(Base):
    __tablename__ = "academic_classes"

    class_id = Column(
        Integer, primary_key=True, autoincrement=True
    )

    class_code = Column(
        String(40), nullable=False, unique=True
    )

    department = Column(String(50), nullable=False)
    academic_year = Column(String(20), nullable=False)
    year_number = Column(Integer, nullable=False)
    semester_number = Column(Integer, nullable=False)
    section = Column(String(20), nullable=False)

    is_active = Column(
        Boolean, nullable=False, default=True
    )

    __table_args__ = (
        CheckConstraint(
            "year_number BETWEEN 1 AND 6",
            name="chk_class_year"
        ),
        CheckConstraint(
            "semester_number BETWEEN 1 AND 12",
            name="chk_class_semester"
        ),
    )


# ==========================================
# 2. CLASSROOMS
# ==========================================

class Classroom(Base):
    __tablename__ = "classrooms"

    room_id = Column(
        Integer, primary_key=True, autoincrement=True
    )

    room_number = Column(String(30), nullable=False)
    building = Column(String(100), nullable=False)
    capacity = Column(Integer, nullable=False)

    is_active = Column(
        Boolean, nullable=False, default=True
    )

    __table_args__ = (
        UniqueConstraint(
            "building",
            "room_number",
            name="uq_classroom"
        ),
        CheckConstraint(
            "capacity > 0",
            name="chk_room_capacity"
        ),
    )


# ==========================================
# 3. CLASS STUDENT ASSIGNMENTS
# ==========================================

class ClassStudentAssignment(Base):
    __tablename__ = "class_student_assignments"

    assignment_id = Column(
        Integer, primary_key=True, autoincrement=True
    )

    class_id = Column(
        Integer,
        ForeignKey("academic_classes.class_id"),
        nullable=False
    )

    student_id = Column(
        String(36),
        ForeignKey("students.student_id"),
        nullable=False
    )

    assigned_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp()
    )

    __table_args__ = (
        UniqueConstraint(
            "class_id",
            "student_id",
            name="uq_class_student"
        ),
    )


# ==========================================
# 4. TEACHERS
# ==========================================

class Teacher(Base):
    __tablename__ = "teachers"

    teacher_id = Column(
        Integer, primary_key=True, autoincrement=True
    )

    employee_code = Column(
        String(30), nullable=False, unique=True
    )

    teacher_name = Column(String(100), nullable=False)
    department = Column(String(50), nullable=False)

    email = Column(String(150), unique=True)

    is_active = Column(
        Boolean, nullable=False, default=True
    )


# ==========================================
# 5. TEACHING ASSIGNMENTS
# ==========================================

class TeachingAssignment(Base):
    __tablename__ = "teaching_assignments"

    teaching_assignment_id = Column(
        Integer, primary_key=True, autoincrement=True
    )

    teacher_id = Column(
        Integer,
        ForeignKey("teachers.teacher_id"),
        nullable=False
    )

    subject_id = Column(
        Integer,
        ForeignKey("subjects.subject_id"),
        nullable=False
    )

    class_id = Column(
        Integer,
        ForeignKey("academic_classes.class_id"),
        nullable=False
    )

    is_active = Column(
        Boolean, nullable=False, default=True
    )

    __table_args__ = (
        UniqueConstraint(
            "teacher_id",
            "subject_id",
            "class_id",
            name="uq_teaching_assignment"
        ),
    )


# ==========================================
# 6. TIMETABLE
# ==========================================

class Timetable(Base):
    __tablename__ = "timetable"

    timetable_id = Column(
        Integer, primary_key=True, autoincrement=True
    )

    teaching_assignment_id = Column(
        Integer,
        ForeignKey(
            "teaching_assignments.teaching_assignment_id"
        ),
        nullable=False
    )

    room_id = Column(
        Integer,
        ForeignKey("classrooms.room_id"),
        nullable=False
    )

    day_of_week = Column(Integer, nullable=False)
    period_number = Column(Integer, nullable=False)

    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    is_active = Column(
        Boolean, nullable=False, default=True
    )

    __table_args__ = (
        UniqueConstraint(
            "teaching_assignment_id",
            "day_of_week",
            "period_number",
            name="uq_timetable_assignment_period"
        ),
        CheckConstraint(
            "day_of_week BETWEEN 1 AND 7",
            name="chk_timetable_day"
        ),
        CheckConstraint(
            "period_number > 0",
            name="chk_timetable_period"
        ),
        CheckConstraint(
            "end_time > start_time",
            name="chk_timetable_time"
        ),
    )
