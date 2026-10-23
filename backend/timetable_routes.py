
from datetime import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth_security import require_jwt_admin
from backend.models import Subject
from backend.academic_models import (
    AcademicClass,
    Classroom,
    Teacher,
    TeachingAssignment,
    ClassStudentAssignment,
    Timetable,
)


router = APIRouter(
    prefix="/api/admin/timetable",
    tags=["Admin - Timetable Management"],
    dependencies=[Depends(require_jwt_admin)],
)


# ==========================================
# 1. REQUEST SCHEMA
# ==========================================

class TimetableCreate(BaseModel):
    teaching_assignment_id: int = Field(gt=0)
    room_id: int = Field(gt=0)

    # Monday=1 ... Sunday=7
    day_of_week: int = Field(ge=1, le=7)

    period_number: int = Field(gt=0)

    start_time: time
    end_time: time

    @model_validator(mode="after")
    def validate_times(self):
        if self.end_time <= self.start_time:
            raise ValueError(
                "End time must be after start time"
            )

        if (
            self.start_time.tzinfo is not None
            or self.end_time.tzinfo is not None
        ):
            raise ValueError(
                "Use local timetable times without timezone offsets"
            )

        return self


# ==========================================
# 2. RESPONSE HELPER
# ==========================================

DAYS = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday",
}


def timetable_response(
    schedule,
    assignment,
    teacher,
    subject,
    academic_class,
    classroom,
):
    return {
        "timetable_id": schedule.timetable_id,
        "teaching_assignment_id":
            schedule.teaching_assignment_id,
        "class_id": academic_class.class_id,
        "class_code": academic_class.class_code,
        "teacher_id": teacher.teacher_id,
        "teacher_name": teacher.teacher_name,
        "subject_id": subject.subject_id,
        "subject_code": subject.subject_code,
        "subject_name": subject.subject_name,
        "room_id": classroom.room_id,
        "room_number": classroom.room_number,
        "building": classroom.building,
        "day_of_week": schedule.day_of_week,
        "day_name": DAYS[schedule.day_of_week],
        "period_number": schedule.period_number,
        "start_time": schedule.start_time.isoformat(
            timespec="minutes"
        ),
        "end_time": schedule.end_time.isoformat(
            timespec="minutes"
        ),
        "is_active": schedule.is_active,
    }


# ==========================================
# 3. CREATE TIMETABLE ENTRY
# ==========================================

@router.post("", status_code=201)
def create_timetable(
    data: TimetableCreate,
    db: Session = Depends(get_db),
):
    assignment = db.get(
        TeachingAssignment,
        data.teaching_assignment_id,
    )

    if not assignment or not assignment.is_active:
        raise HTTPException(
            404,
            "Active teaching assignment not found",
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

    classroom = db.get(
        Classroom,
        data.room_id,
    )

    if (
        academic_class is None
        or not academic_class.is_active
    ):
        raise HTTPException(
            409,
            "Assigned academic class is inactive or missing",
        )

    if teacher is None or not teacher.is_active:
        raise HTTPException(
            409,
            "Assigned teacher is inactive or missing",
        )

    if subject is None:
        raise HTTPException(
            404,
            "Assigned subject not found",
        )

    if classroom is None or not classroom.is_active:
        raise HTTPException(
            404,
            "Active classroom not found",
        )

    # --------------------------------------
    # Check classroom capacity
    # --------------------------------------

    student_count = db.scalar(
        select(func.count())
        .select_from(ClassStudentAssignment)
        .where(
            ClassStudentAssignment.class_id
            == academic_class.class_id
        )
    ) or 0

    if student_count > classroom.capacity:
        raise HTTPException(
            409,
            (
                f"Class has {student_count} assigned students "
                f"but classroom capacity is {classroom.capacity}"
            ),
        )

    # --------------------------------------
    # Get existing entries on the same day
    # --------------------------------------

    rows = db.execute(
        select(
            Timetable,
            TeachingAssignment,
        )
        .join(
            TeachingAssignment,
            Timetable.teaching_assignment_id
            == TeachingAssignment.teaching_assignment_id,
        )
        .where(
            Timetable.day_of_week == data.day_of_week,
            Timetable.is_active.is_(True),
        )
    ).all()

    for existing, existing_assignment in rows:

        # Half-open intervals:
        # 09:00-10:00 and 10:00-11:00
        # do NOT overlap.
        overlaps = (
            data.start_time < existing.end_time
            and data.end_time > existing.start_time
        )

        if not overlaps:
            continue

        if existing.room_id == data.room_id:
            raise HTTPException(
                409,
                (
                    "Classroom conflict with timetable "
                    f"entry {existing.timetable_id}"
                ),
            )

        if (
            existing_assignment.teacher_id
            == assignment.teacher_id
        ):
            raise HTTPException(
                409,
                (
                    "Teacher conflict with timetable "
                    f"entry {existing.timetable_id}"
                ),
            )

        if (
            existing_assignment.class_id
            == assignment.class_id
        ):
            raise HTTPException(
                409,
                (
                    "Class conflict with timetable "
                    f"entry {existing.timetable_id}"
                ),
            )

    schedule = Timetable(
        teaching_assignment_id=
            data.teaching_assignment_id,
        room_id=data.room_id,
        day_of_week=data.day_of_week,
        period_number=data.period_number,
        start_time=data.start_time,
        end_time=data.end_time,
        is_active=True,
    )

    try:
        db.add(schedule)
        db.commit()
        db.refresh(schedule)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409,
            "Timetable conflicts with an existing entry",
        )

    return {
        "message": "Timetable entry created",
        **timetable_response(
            schedule,
            assignment,
            teacher,
            subject,
            academic_class,
            classroom,
        ),
    }


# ==========================================
# 4. LIST / FILTER TIMETABLE
# ==========================================

@router.get("")
def list_timetable(
    class_id: Optional[int] = None,
    teacher_id: Optional[int] = None,
    day_of_week: Optional[int] = None,
    db: Session = Depends(get_db),
):
    if class_id is not None and class_id <= 0:
        raise HTTPException(422, "Invalid class_id")

    if teacher_id is not None and teacher_id <= 0:
        raise HTTPException(422, "Invalid teacher_id")

    if day_of_week is not None and not (
        1 <= day_of_week <= 7
    ):
        raise HTTPException(
            422,
            "day_of_week must be between 1 and 7",
        )

    statement = (
        select(
            Timetable,
            TeachingAssignment,
            Teacher,
            Subject,
            AcademicClass,
            Classroom,
        )
        .join(
            TeachingAssignment,
            Timetable.teaching_assignment_id
            == TeachingAssignment.teaching_assignment_id,
        )
        .join(
            Teacher,
            TeachingAssignment.teacher_id
            == Teacher.teacher_id,
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
        .join(
            Classroom,
            Timetable.room_id
            == Classroom.room_id,
        )
        .where(Timetable.is_active.is_(True))
    )

    if class_id is not None:
        statement = statement.where(
            AcademicClass.class_id == class_id
        )

    if teacher_id is not None:
        statement = statement.where(
            Teacher.teacher_id == teacher_id
        )

    if day_of_week is not None:
        statement = statement.where(
            Timetable.day_of_week == day_of_week
        )

    statement = statement.order_by(
        Timetable.day_of_week,
        Timetable.start_time,
        Timetable.period_number,
    )

    rows = db.execute(statement).all()

    return {
        "total": len(rows),
        "timetable": [
            timetable_response(
                schedule,
                assignment,
                teacher,
                subject,
                academic_class,
                classroom,
            )
            for (
                schedule,
                assignment,
                teacher,
                subject,
                academic_class,
                classroom,
            ) in rows
        ],
    }
