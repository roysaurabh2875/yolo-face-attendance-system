
import re

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.academic_models import Teacher
from backend.auth_models import UserAccount
from backend.auth_security import require_role
from backend.password_security import hash_password


router = APIRouter(
    prefix="/api/admin/accounts",
    tags=["Admin - Account Management"],
    dependencies=[Depends(require_role("ADMIN"))],
)

USERNAME_PATTERN = re.compile(
    r"^[a-z][a-z0-9_.-]{2,49}$"
)


class CreateTeacherAccount(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: SecretStr
    teacher_id: int = Field(gt=0)


class AccountStatusUpdate(BaseModel):
    is_active: bool


class PasswordReset(BaseModel):
    new_password: SecretStr


def validate_password(password: str):
    if not 6 <= len(password) <= 128:
        raise HTTPException(
            status_code=422,
            detail="Password must contain at least 6 characters",
        )


def account_response(account, teacher_name=None):
    return {
        "user_id": account.user_id,
        "username": account.username,
        "role": account.role,
        "teacher_id": account.teacher_id,
        "teacher_name": teacher_name,
        "is_active": account.is_active,
        "created_at": (
            account.created_at.isoformat()
            if account.created_at else None
        ),
    }


# ========================================
# 1. CREATE TEACHER ACCOUNT
# ========================================

@router.post(
    "/teachers",
    status_code=status.HTTP_201_CREATED,
)
def create_teacher_account(
    data: CreateTeacherAccount,
    db: Session = Depends(get_db),
):
    username = data.username.strip().lower()

    if not USERNAME_PATTERN.fullmatch(username):
        raise HTTPException(
            422,
            "Invalid username format",
        )

    password = data.password.get_secret_value()
    validate_password(password)

    teacher = db.get(Teacher, data.teacher_id)

    if teacher is None:
        raise HTTPException(
            404,
            "Teacher not found",
        )

    if not teacher.is_active:
        raise HTTPException(
            409,
            "Teacher is inactive",
        )

    existing_username = db.scalar(
        select(UserAccount.user_id)
        .where(UserAccount.username == username)
    )

    if existing_username is not None:
        raise HTTPException(
            409,
            "Username already exists",
        )

    existing_teacher = db.scalar(
        select(UserAccount.user_id)
        .where(UserAccount.teacher_id == data.teacher_id)
    )

    if existing_teacher is not None:
        raise HTTPException(
            409,
            "Teacher already has a login account",
        )

    account = UserAccount(
        username=username,
        password_hash=hash_password(password),
        role="TEACHER",
        teacher_id=data.teacher_id,
        is_active=True,
    )

    db.add(account)

    try:
        db.commit()
        db.refresh(account)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409,
            "Username or teacher account already exists",
        )

    return {
        "message": "Teacher account created",
        "account": account_response(
            account,
            teacher.teacher_name,
        ),
    }


# ========================================
# 2. LIST ACCOUNTS
# ========================================

@router.get("")
def list_accounts(
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(UserAccount, Teacher)
        .outerjoin(
            Teacher,
            UserAccount.teacher_id == Teacher.teacher_id,
        )
        .order_by(UserAccount.user_id)
    ).all()

    accounts = [
        account_response(
            account,
            teacher.teacher_name if teacher else None,
        )
        for account, teacher in rows
    ]

    return {
        "total": len(accounts),
        "accounts": accounts,
    }


# ========================================
# 3. ACTIVATE / DEACTIVATE ACCOUNT
# ========================================

@router.patch("/{user_id}/status")
def update_account_status(
    user_id: int,
    data: AccountStatusUpdate,
    admin: UserAccount = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    account = db.get(UserAccount, user_id)

    if account is None:
        raise HTTPException(
            404,
            "Account not found",
        )

    if (
        account.user_id == admin.user_id
        and data.is_active is False
    ):
        raise HTTPException(
            409,
            "You cannot deactivate your own account",
        )

    if data.is_active and account.role == "TEACHER":
        teacher = db.get(Teacher, account.teacher_id)

        if teacher is None or not teacher.is_active:
            raise HTTPException(
                409,
                "Cannot activate an account for an inactive teacher",
            )

    account.is_active = data.is_active

    db.commit()
    db.refresh(account)

    return {
        "message": "Account status updated",
        "user_id": account.user_id,
        "is_active": account.is_active,
    }


# ========================================
# 4. RESET TEACHER PASSWORD
# ========================================

@router.post("/{user_id}/reset-password")
def reset_teacher_password(
    user_id: int,
    data: PasswordReset,
    db: Session = Depends(get_db),
):
    account = db.get(UserAccount, user_id)

    if account is None:
        raise HTTPException(
            404,
            "Account not found",
        )

    if account.role != "TEACHER":
        raise HTTPException(
            403,
            "This endpoint resets teacher passwords only",
        )

    new_password = data.new_password.get_secret_value()

    validate_password(new_password)

    # Lock the account before modifying credentials.
    account = db.scalar(
        select(UserAccount)
        .where(UserAccount.user_id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )

    if account is None:
        raise HTTPException(
            status_code=404,
            detail="Account not found",
        )

    if account.role != "TEACHER":
        raise HTTPException(
            status_code=403,
            detail="This endpoint resets teacher passwords only",
        )

    account.password_hash = hash_password(new_password)

    # Invalidate previously issued JWTs.
    account.token_version += 1

    db.commit()

    return {
        "message": "Teacher password updated",
        "user_id": account.user_id,
    }
