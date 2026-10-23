
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.academic_routes import require_admin
from backend.models import Student, Subject
from backend.academic_models import (
    AcademicClass,
    Teacher,
    ClassStudentAssignment,
    TeachingAssignment,
)


router = APIRouter(
    prefix="/api/admin",
    tags=["Admin - Class Assignments"],
    dependencies=[Depends(require_admin)],
)


# ==========================================
# REQUEST MODELS
# ==========================================

class StudentAssignmentCreate(BaseModel):
    class_id: int = Field(gt=0)
    student_id: str = Field(min_length=1, max_length=36)


class TeachingAssignmentCreate(BaseModel):
    teacher_id: int = Field(gt=0)
    subject_id: int = Field(gt=0)
    class_id: int = Field(gt=0)


# ==========================================
# HELPERS
# ==========================================

def save(db, record):
    try:
        db.add(record)
        db.commit()
        db.refresh(record)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Assignment conflicts with an existing record."
        )
    return record


def require_active_class(db, class_id):
    academic_class = db.get(AcademicClass, class_id)

    if not academic_class:
        raise HTTPException(
            status_code=404,
            detail="Academic class not found."
        )

    if not academic_class.is_active:
        raise HTTPException(
            status_code=409,
            detail="Academic class is inactive."
        )

    return academic_class


# ==========================================
# 1. ASSIGN STUDENT TO CLASS
# ==========================================

@router.post(
    "/class-assignments/students",
    status_code=201,
)
def assign_student(
    data: StudentAssignmentCreate,
    db: Session = Depends(get_db),
):
    academic_class = require_active_class(
        db, data.class_id
    )

    student = db.get(Student, data.student_id)

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found."
        )

    if not student.is_active:
        raise HTTPException(
            status_code=409,
            detail="Student is inactive."
        )

    # Existing system keeps section on students.
    if (
        student.section.strip().upper()
        != academic_class.section.strip().upper()
    ):
        raise HTTPException(
            status_code=409,
            detail="Student section does not match class section."
        )

    existing = db.scalar(
        select(ClassStudentAssignment).where(
            ClassStudentAssignment.class_id == data.class_id,
            ClassStudentAssignment.student_id == data.student_id,
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Student is already assigned to this class."
        )

    # Prevent assignment to two classes in the
    # same academic year and semester.
    conflicting = db.scalar(
        select(ClassStudentAssignment)
        .join(
            AcademicClass,
            ClassStudentAssignment.class_id
            == AcademicClass.class_id,
        )
        .where(
            ClassStudentAssignment.student_id == data.student_id,
            AcademicClass.academic_year
            == academic_class.academic_year,
            AcademicClass.semester_number
            == academic_class.semester_number,
        )
    )

    if conflicting:
        raise HTTPException(
            status_code=409,
            detail=(
                "Student is already assigned to another "
                "class for this academic year and semester."
            ),
        )

    record = ClassStudentAssignment(
        class_id=data.class_id,
        student_id=data.student_id,
    )

    save(db, record)

    return {
        "message": "Student assigned to class",
        "assignment_id": record.assignment_id,
        "class_id": record.class_id,
        "student_id": record.student_id,
        "roll_number": student.roll_number,
        "student_name": student.name,
    }


# ==========================================
# 2. VIEW STUDENTS IN CLASS
# ==========================================

@router.get("/classes/{class_id}/students")
def get_class_students(
    class_id: int,
    db: Session = Depends(get_db),
):
    academic_class = db.get(
        AcademicClass, class_id
    )

    if not academic_class:
        raise HTTPException(
            status_code=404,
            detail="Academic class not found."
        )

    rows = db.execute(
        select(ClassStudentAssignment, Student)
        .join(
            Student,
            ClassStudentAssignment.student_id
            == Student.student_id,
        )
        .where(
            ClassStudentAssignment.class_id == class_id
        )
        .order_by(Student.roll_number)
    ).all()

    return {
        "class_id": class_id,
        "class_code": academic_class.class_code,
        "total_students": len(rows),
        "students": [
            {
                "assignment_id": assignment.assignment_id,
                "student_id": student.student_id,
                "roll_number": student.roll_number,
                "name": student.name,
                "section": student.section,
                "is_active": student.is_active,
            }
            for assignment, student in rows
        ],
    }


# ==========================================
# 3. ASSIGN TEACHER AND SUBJECT TO CLASS
# ==========================================

@router.post(
    "/teaching-assignments",
    status_code=201,
)
def create_teaching_assignment(
    data: TeachingAssignmentCreate,
    db: Session = Depends(get_db),
):
    academic_class = require_active_class(
        db, data.class_id
    )

    teacher = db.get(Teacher, data.teacher_id)

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher not found."
        )

    if not teacher.is_active:
        raise HTTPException(
            status_code=409,
            detail="Teacher is inactive."
        )

    subject = db.get(Subject, data.subject_id)

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found."
        )

    existing = db.scalar(
        select(TeachingAssignment).where(
            TeachingAssignment.teacher_id == data.teacher_id,
            TeachingAssignment.subject_id == data.subject_id,
            TeachingAssignment.class_id == data.class_id,
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Teaching assignment already exists."
        )

    record = TeachingAssignment(
        teacher_id=data.teacher_id,
        subject_id=data.subject_id,
        class_id=data.class_id,
        is_active=True,
    )

    save(db, record)

    return {
        "message": "Teaching assignment created",
        "teaching_assignment_id":
            record.teaching_assignment_id,
        "teacher": teacher.teacher_name,
        "subject": subject.subject_name,
        "class_code": academic_class.class_code,
    }


# ==========================================
# 4. LIST TEACHING ASSIGNMENTS
# ==========================================

@router.get("/teaching-assignments")
def list_teaching_assignments(
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(
            TeachingAssignment,
            Teacher,
            Subject,
            AcademicClass,
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
        .order_by(
            AcademicClass.class_code,
            Subject.subject_code,
        )
    ).all()

    return {
        "total": len(rows),
        "assignments": [
            {
                "teaching_assignment_id":
                    assignment.teaching_assignment_id,
                "teacher_id": teacher.teacher_id,
                "teacher_name": teacher.teacher_name,
                "subject_id": subject.subject_id,
                "subject_code": subject.subject_code,
                "subject_name": subject.subject_name,
                "class_id": academic_class.class_id,
                "class_code": academic_class.class_code,
                "is_active": assignment.is_active,
            }
            for (
                assignment,
                teacher,
                subject,
                academic_class,
            ) in rows
        ],
    }
