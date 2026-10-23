from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth_security import get_current_user
from backend.auth_models import UserAccount
from backend.session_permissions import require_session_access
from backend.models import Student, AttendanceSession, Attendance, AttendanceAudit
from backend.roster_service import get_session_roster

router = APIRouter(prefix="/api/sessions", tags=["Attendance Review"])


def utc_now():
    # Database columns currently use naive DATETIME. Keep timestamps UTC.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_locked_session(db: Session, session_id: int) -> AttendanceSession:
    session = db.scalar(
        select(AttendanceSession)
        .where(AttendanceSession.session_id == session_id)
        .with_for_update()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def load_attendance(db: Session, session_id: int):
    records = db.scalars(
        select(Attendance).where(Attendance.session_id == session_id)
    ).all()
    return {record.student_id: record for record in records}


def verify_roster_records(roster, attendance_by_student):
    roster_ids = {student.student_id for student in roster}
    unexpected_ids = set(attendance_by_student) - roster_ids
    if unexpected_ids:
        raise HTTPException(
            status_code=409,
            detail=(
                "Attendance contains records outside the session roster. "
                "Administrator investigation is required."
            ),
        )


# 1. End period: ACTIVE -> REVIEW
@router.post("/{session_id}/end")
def end_period(
    session_id: int,
    db: Session = Depends(get_db),
    user: UserAccount = Depends(get_current_user),
):
    try:
        require_session_access(db=db, session_id=session_id, user=user)
        session = get_locked_session(db, session_id)
        if session.status != "ACTIVE":
            raise HTTPException(
                status_code=409, detail="Only ACTIVE sessions can be ended"
            )
        roster = get_session_roster(db, session)
        if not roster:
            raise HTTPException(status_code=409, detail="Session roster is empty")
        session.status = "REVIEW"
        session.ended_at = utc_now()
        db.commit()
        return {
            "session_id": session_id,
            "status": "REVIEW",
            "message": "Attendance scanning stopped. Attendance is ready for review.",
        }
    except Exception:
        db.rollback()
        raise


# 2. Attendance review
@router.get("/{session_id}/review")
def review_attendance(
    session_id: int,
    db: Session = Depends(get_db),
    user: UserAccount = Depends(get_current_user),
):
    session = require_session_access(db=db, session_id=session_id, user=user)
    roster = get_session_roster(db, session)
    attendance_by_student = load_attendance(db, session_id)
    verify_roster_records(roster, attendance_by_student)

    result = []
    present = absent = unmarked = 0
    for student in roster:
        record = attendance_by_student.get(student.student_id)
        status = record.status if record is not None else "UNMARKED"
        if status == "PRESENT":
            present += 1
        elif status == "ABSENT":
            absent += 1
        elif status == "UNMARKED":
            unmarked += 1
        else:
            raise HTTPException(status_code=409, detail="Unknown attendance status")
        result.append(
            {
                "student_id": student.student_id,
                "roll_number": student.roll_number,
                "name": student.name,
                "section": student.section,
                "status": status,
                "source": record.source if record is not None else None,
            }
        )

    return {
        "session_id": session_id,
        "session_status": session.status,
        "total_students": len(roster),
        "present": present,
        "absent": absent,
        "unmarked": unmarked,
        "students": result,
    }


class AttendanceCorrection(BaseModel):
    status: str = Field(min_length=1, max_length=20)
    reason: str = Field(min_length=3, max_length=500)


# 3. Correct attendance during REVIEW
@router.patch("/{session_id}/attendance/{student_id}")
def correct_attendance(
    session_id: int,
    student_id: str,
    data: AttendanceCorrection,
    db: Session = Depends(get_db),
    user: UserAccount = Depends(get_current_user),
):
    try:
        require_session_access(db=db, session_id=session_id, user=user)
        session = get_locked_session(db, session_id)
        if session.status != "REVIEW":
            raise HTTPException(
                status_code=409, detail="Corrections are allowed only during REVIEW"
            )

        new_status = data.status.strip().upper()
        reason = data.reason.strip()
        if new_status not in ("PRESENT", "ABSENT"):
            raise HTTPException(
                status_code=422, detail="Status must be PRESENT or ABSENT"
            )
        if len(reason) < 3:
            raise HTTPException(status_code=422, detail="A correction reason is required")

        roster = get_session_roster(db, session)
        if student_id not in {item.student_id for item in roster}:
            raise HTTPException(
                status_code=403, detail="Student is not in this session's roster"
            )
        if db.get(Student, student_id) is None:
            raise HTTPException(status_code=404, detail="Student record not found")

        attendance_by_student = load_attendance(db, session_id)
        verify_roster_records(roster, attendance_by_student)
        record = attendance_by_student.get(student_id)
        previous_status = record.status if record is not None else "UNMARKED"
        if previous_status == new_status:
            db.rollback()
            return {
                "message": "Attendance already has this status",
                "student_id": student_id,
                "status": new_status,
            }

        if record is None:
            record = Attendance(
                session_id=session_id,
                student_id=student_id,
                status=new_status,
                source="MANUAL",
                marked_at=utc_now(),
            )
            db.add(record)
            db.flush()
        else:
            record.status = new_status
            record.source = "MANUAL"
            record.marked_at = utc_now()

        db.add(
            AttendanceAudit(
                attendance_id=record.attendance_id,
                previous_status=previous_status,
                new_status=new_status,
                changed_by=f"{user.role}:{user.user_id}",
                reason=reason,
                changed_at=utc_now(),
            )
        )
        db.commit()
        return {
            "message": "Attendance corrected",
            "student_id": student_id,
            "previous_status": previous_status,
            "new_status": new_status,
        }
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Attendance correction conflict")
    except Exception:
        db.rollback()
        raise


# 4. Finalize: REVIEW -> FINALIZED, missing students -> ABSENT
@router.post("/{session_id}/finalize")
def finalize_attendance(
    session_id: int,
    db: Session = Depends(get_db),
    user: UserAccount = Depends(get_current_user),
):
    try:
        require_session_access(db=db, session_id=session_id, user=user)
        session = get_locked_session(db, session_id)
        if session.status != "REVIEW":
            raise HTTPException(
                status_code=409, detail="Only REVIEW sessions can be finalized"
            )

        roster = get_session_roster(db, session)
        if not roster:
            raise HTTPException(status_code=409, detail="Session roster is empty")
        attendance_by_student = load_attendance(db, session_id)
        verify_roster_records(roster, attendance_by_student)

        present = absent = 0
        for student in roster:
            record = attendance_by_student.get(student.student_id)
            if record is None:
                db.add(
                    Attendance(
                        session_id=session_id,
                        student_id=student.student_id,
                        status="ABSENT",
                        source="SYSTEM",
                        marked_at=utc_now(),
                    )
                )
                absent += 1
            elif record.status == "PRESENT":
                present += 1
            elif record.status == "ABSENT":
                absent += 1
            else:
                raise HTTPException(
                    status_code=409,
                    detail="Unexpected attendance status during finalization",
                )

        session.status = "FINALIZED"
        if session.ended_at is None:
            session.ended_at = utc_now()
        db.commit()
        return {
            "message": "Attendance finalized successfully",
            "session_id": session_id,
            "status": "FINALIZED",
            "total_students": len(roster),
            "present": present,
            "absent": absent,
        }
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Attendance finalization conflict")
    except Exception:
        db.rollback()
        raise
