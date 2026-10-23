
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth_security import require_jwt_admin
from backend.academic_models import (
    AcademicClass,
    Classroom,
    Teacher,
)


router = APIRouter(
    prefix="/api/admin",
    tags=["Admin - Academic Management"],
    dependencies=[Depends(require_jwt_admin)],
)

Name = Annotated[str, Field(min_length=1)]


# ==========================================
# 1. REQUEST SCHEMAS
# ==========================================

class ClassCreate(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    class_code: str = Field(
        min_length=2,
        max_length=40,
    )

    department: str = Field(
        min_length=1,
        max_length=50,
    )

    academic_year: str = Field(
        min_length=1,
        max_length=20,
    )

    year_number: int = Field(ge=1, le=6)
    semester_number: int = Field(ge=1, le=12)

    section: str = Field(
        min_length=1,
        max_length=20,
    )


class ClassroomCreate(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    room_number: str = Field(
        min_length=1,
        max_length=30,
    )

    building: str = Field(
        min_length=1,
        max_length=100,
    )

    capacity: int = Field(gt=0)


class TeacherCreate(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    employee_code: str = Field(
        min_length=1,
        max_length=30,
    )

    teacher_name: str = Field(
        min_length=1,
        max_length=100,
    )

    department: str = Field(
        min_length=1,
        max_length=50,
    )

    email: str | None = Field(
        default=None,
        max_length=150,
    )


# ==========================================
# 2. RESPONSE HELPERS
# ==========================================

def class_response(item):
    return {
        "class_id": item.class_id,
        "class_code": item.class_code,
        "department": item.department,
        "academic_year": item.academic_year,
        "year_number": item.year_number,
        "semester_number": item.semester_number,
        "section": item.section,
        "is_active": item.is_active,
    }


def classroom_response(item):
    return {
        "room_id": item.room_id,
        "room_number": item.room_number,
        "building": item.building,
        "capacity": item.capacity,
        "is_active": item.is_active,
    }


def teacher_response(item):
    return {
        "teacher_id": item.teacher_id,
        "employee_code": item.employee_code,
        "teacher_name": item.teacher_name,
        "department": item.department,
        "email": item.email,
        "is_active": item.is_active,
    }


def save_record(db, item):
    try:
        db.add(item)
        db.commit()
        db.refresh(item)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Duplicate or conflicting record. "
                "Check existing database entries."
            ),
        )

    return item


# ==========================================
# 3. CREATE ACADEMIC CLASS
# ==========================================

@router.post(
    "/classes",
    status_code=201,
)
def create_class(
    data: ClassCreate,
    db: Session = Depends(get_db),
):
    class_code = data.class_code.upper()

    existing = db.scalar(
        select(AcademicClass).where(
            AcademicClass.class_code == class_code
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Class code already exists",
        )

    item = AcademicClass(
        class_code=class_code,
        department=data.department.upper(),
        academic_year=data.academic_year,
        year_number=data.year_number,
        semester_number=data.semester_number,
        section=data.section.upper(),
        is_active=True,
    )

    save_record(db, item)

    return {
        "message": "Academic class created",
        **class_response(item),
    }


# ==========================================
# 4. LIST ACADEMIC CLASSES
# ==========================================

@router.get("/classes")
def list_classes(
    db: Session = Depends(get_db),
):
    items = db.scalars(
        select(AcademicClass)
        .order_by(AcademicClass.class_code)
    ).all()

    return {
        "total": len(items),
        "classes": [
            class_response(item)
            for item in items
        ],
    }


# ==========================================
# 5. CREATE CLASSROOM
# ==========================================

@router.post(
    "/classrooms",
    status_code=201,
)
def create_classroom(
    data: ClassroomCreate,
    db: Session = Depends(get_db),
):
    room_number = data.room_number.upper()
    building = data.building.upper()

    existing = db.scalar(
        select(Classroom).where(
            Classroom.room_number == room_number,
            Classroom.building == building,
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Classroom already exists",
        )

    item = Classroom(
        room_number=room_number,
        building=building,
        capacity=data.capacity,
        is_active=True,
    )

    save_record(db, item)

    return {
        "message": "Classroom created",
        **classroom_response(item),
    }


# ==========================================
# 6. LIST CLASSROOMS
# ==========================================

@router.get("/classrooms")
def list_classrooms(
    db: Session = Depends(get_db),
):
    items = db.scalars(
        select(Classroom)
        .order_by(
            Classroom.building,
            Classroom.room_number,
        )
    ).all()

    return {
        "total": len(items),
        "classrooms": [
            classroom_response(item)
            for item in items
        ],
    }


# ==========================================
# 7. CREATE TEACHER
# ==========================================

@router.post(
    "/teachers",
    status_code=201,
)
def create_teacher(
    data: TeacherCreate,
    db: Session = Depends(get_db),
):
    employee_code = data.employee_code.upper()

    email = (
        data.email.lower()
        if data.email
        else None
    )

    existing = db.scalar(
        select(Teacher).where(
            Teacher.employee_code == employee_code
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Employee code already exists",
        )

    if email:
        existing_email = db.scalar(
            select(Teacher).where(
                Teacher.email == email
            )
        )

        if existing_email:
            raise HTTPException(
                status_code=409,
                detail="Email already registered",
            )

    item = Teacher(
        employee_code=employee_code,
        teacher_name=data.teacher_name,
        department=data.department.upper(),
        email=email,
        is_active=True,
    )

    save_record(db, item)

    return {
        "message": "Teacher created",
        **teacher_response(item),
    }


# ==========================================
# 8. LIST TEACHERS
# ==========================================

@router.get("/teachers")
def list_teachers(
    db: Session = Depends(get_db),
):
    items = db.scalars(
        select(Teacher)
        .order_by(Teacher.teacher_name)
    ).all()

    return {
        "total": len(items),
        "teachers": [
            teacher_response(item)
            for item in items
        ],
    }
