
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    CheckConstraint,
    func,
)

from backend.database import Base
import backend.academic_models


class UserAccount(Base):
    __tablename__ = "user_accounts"

    user_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    username = Column(
        String(50),
        nullable=False,
        unique=True,
    )

    password_hash = Column(
        String(255),
        nullable=False,
    )

    role = Column(
        String(20),
        nullable=False,
    )

    teacher_id = Column(
        Integer,
        ForeignKey("teachers.teacher_id"),
        nullable=True,
        unique=True,
    )

    is_active = Column(
        Boolean,
        nullable=False,
        server_default="1",
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )
    
    token_version = Column(
    Integer,
    nullable=False,
    default=0,
    server_default="0",
     )
    failed_login_attempts = Column(
    Integer,
    nullable=False,
    default=0,
    server_default="0",
    )

    locked_until = Column(
        DateTime,
        nullable=True,
    )
    __table_args__ = (
        CheckConstraint(
            "role IN ('ADMIN', 'TEACHER')",
            name="chk_user_role",
        ),
        CheckConstraint(
            "("
            "role = 'ADMIN' AND teacher_id IS NULL"
            ") OR ("
            "role = 'TEACHER' AND teacher_id IS NOT NULL"
            ")",
            name="chk_user_teacher_link",
        ),
    )

class AuthenticationAudit(Base):
    __tablename__ = "authentication_audit"

    audit_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("user_accounts.user_id"),
        nullable=True,
    )

    username = Column(
        String(50),
        nullable=False,
    )

    event_type = Column(
        String(30),
        nullable=False,
    )

    event_time = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )
    
