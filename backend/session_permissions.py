
from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.auth_models import UserAccount
from backend.academic_models import Teacher
from backend.models import AttendanceSession
from backend.schedule_models import AttendanceSessionSchedule


def require_session_access(
    db: Session,
    session_id: int,
    user: UserAccount,
) -> AttendanceSession:
    """
    Check whether an authenticated user can access
    the specified attendance session.

    ADMIN:
        Can access any session.

    TEACHER:
        Can access only scheduled sessions assigned
        to their teacher_id.
    """

    session = db.get(
        AttendanceSession,
        session_id,
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Attendance session not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="Inactive account",
        )

    if user.role == "ADMIN":
        return session

    if user.role != "TEACHER":
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    teacher = (
        db.get(Teacher, user.teacher_id)
        if user.teacher_id is not None
        else None
    )

    if teacher is None or not teacher.is_active:
        raise HTTPException(
            status_code=403,
            detail="Teacher account is inactive",
        )

    scheduled = db.get(
        AttendanceSessionSchedule,
        session_id,
    )

    # Teachers cannot access legacy manually
    # created sessions without a teacher assignment.
    if scheduled is None:
        raise HTTPException(
            status_code=403,
            detail="Session is not assigned to a teacher",
        )

    if scheduled.teacher_id != user.teacher_id:
        raise HTTPException(
            status_code=403,
            detail="This session belongs to another teacher",
        )

    return session

from fastapi import Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth_security import get_current_user


def authorized_session(
    session_id: int,
    db: Session = Depends(get_db),
    user: UserAccount = Depends(get_current_user),
) -> AttendanceSession:
    return require_session_access(
        db=db,
        session_id=session_id,
        user=user,
    )

