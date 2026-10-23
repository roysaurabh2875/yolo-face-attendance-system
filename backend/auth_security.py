
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import jwt

from fastapi import Depends, HTTPException
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth_models import UserAccount


ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 30
ISSUER = "face-attendance-api"
AUDIENCE = "face-attendance-users"

bearer_scheme = HTTPBearer(auto_error=False)


def get_jwt_secret():
    private_dir = (
        Path(os.environ.get("LOCALAPPDATA", ""))
        / "FaceAttendancePrivate"
    )
    project_dir = Path(__file__).resolve().parent.parent

    secret_path = private_dir / "jwt_secret.key"
    if not secret_path.is_file():
        secret_path = project_dir / "jwt_secret.key"

    if not secret_path.is_file():
        raise RuntimeError(
            "JWT signing key is missing. "
            "Checked FaceAttendancePrivate and project directory."
        )

    secret = secret_path.read_text(
        encoding="utf-8"
    ).strip()

    if len(secret) < 64:
        raise RuntimeError(
            "JWT signing key is too short."
        )

    return secret


def create_access_token(user: UserAccount):
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user.user_id),
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(
            minutes=ACCESS_TOKEN_MINUTES
        ),
        "jti": str(uuid4()),
        "ver": int(user.token_version),
    }

    return jwt.encode(
        payload,
        get_jwt_secret(),
        algorithm=ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
):
    invalid_token = HTTPException(
        status_code=401,
        detail="Invalid or expired access token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if (
        credentials is None
        or credentials.scheme.lower() != "bearer"
    ):
        raise invalid_token

    try:
        payload = jwt.decode(
            credentials.credentials,
            get_jwt_secret(),
            algorithms=[ALGORITHM],
            issuer=ISSUER,
            audience=AUDIENCE,
            options={
                "require": [
                    "sub", "iss", "aud",
                    "iat", "nbf", "exp", "jti", "ver",
                ]
            },
        )

        subject = payload.get("sub")

        if not (
            isinstance(subject, str)
            and subject.isdecimal()
            and int(subject) > 0
        ):
            raise invalid_token

        user = db.get(UserAccount, int(subject))

    except jwt.InvalidTokenError:
        raise invalid_token

    if user is None or not user.is_active:
        raise invalid_token

    token_version = payload.get("ver")

    if (
        type(token_version) is not int
        or token_version != user.token_version
    ):
        raise invalid_token

    return user


def require_role(*allowed_roles):
    def dependency(
        user: UserAccount = Depends(
            get_current_user
        ),
    ):
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions",
            )

        return user

    return dependency


def require_jwt_admin(
    user: UserAccount = Depends(get_current_user),
) -> UserAccount:
    if user.role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Administrator access required",
        )

    return user
