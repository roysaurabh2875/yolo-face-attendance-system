
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jwt
import pytest

from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from backend import auth_security
from backend.database import get_db
from backend.auth_models import UserAccount
from backend.academic_models import Teacher
from backend.models import AttendanceSession
from backend.schedule_models import AttendanceSessionSchedule
from backend.session_permissions import require_session_access
from backend.password_security import (
    hash_password,
    verify_password,
)


TEST_SECRET = "testing-only-secret-" + ("x" * 64)


class FakeDatabase:
    """
    Fake session used only for security tests.
    No MySQL connection is created.
    """

    def __init__(self, users, teachers, sessions, schedules):
        self.users = users
        self.teachers = teachers
        self.sessions = sessions
        self.schedules = schedules

    def get(self, model, key):
        if model is UserAccount:
            return self.users.get(key)

        if model is Teacher:
            return self.teachers.get(key)

        if model is AttendanceSession:
            return self.sessions.get(key)

        if model is AttendanceSessionSchedule:
            return self.schedules.get(key)

        return None


@pytest.fixture
def setup_api(monkeypatch):
    # Replace the JWT signing key for tests only.
    # Production keys and tokens are never used.
    monkeypatch.setattr(
        auth_security,
        "get_jwt_secret",
        lambda: TEST_SECRET,
    )

    admin = SimpleNamespace(
        user_id=1,
        username="test_admin",
        role="ADMIN",
        teacher_id=None,
        is_active=True,
        token_version=0,
    )

    teacher1 = SimpleNamespace(
        user_id=2,
        username="test_teacher1",
        role="TEACHER",
        teacher_id=101,
        is_active=True,
        token_version=0,
    )

    teacher2 = SimpleNamespace(
        user_id=3,
        username="test_teacher2",
        role="TEACHER",
        teacher_id=102,
        is_active=True,
        token_version=0,
    )

    fake_db = FakeDatabase(
        users={
            1: admin,
            2: teacher1,
            3: teacher2,
        },
        teachers={
            101: SimpleNamespace(
                teacher_id=101,
                is_active=True,
            ),
            102: SimpleNamespace(
                teacher_id=102,
                is_active=True,
            ),
        },
        sessions={
            10: SimpleNamespace(session_id=10),
            20: SimpleNamespace(session_id=20),
        },
        schedules={
            10: SimpleNamespace(
                session_id=10,
                teacher_id=101,
            ),
            20: SimpleNamespace(
                session_id=20,
                teacher_id=102,
            ),
        },
    )

    app = FastAPI()

    # Replace the real database dependency.
    app.dependency_overrides[get_db] = lambda: fake_db

    @app.get(
        "/test/admin",
        dependencies=[
            Depends(auth_security.require_jwt_admin)
        ],
    )
    def admin_endpoint():
        return {"message": "admin allowed"}

    @app.get("/test/sessions/{session_id}/review")
    def review_endpoint(
        session_id: int,
        user=Depends(auth_security.get_current_user),
        db=Depends(get_db),
    ):
        require_session_access(
            db=db,
            session_id=session_id,
            user=user,
        )

        return {
            "session_id": session_id,
            "message": "session access allowed",
        }

    client = TestClient(app)

    def token_headers(user):
        token = auth_security.create_access_token(user)

        return {
            "Authorization": f"Bearer {token}"
        }

    return SimpleNamespace(
        client=client,
        admin=admin,
        teacher1=teacher1,
        teacher2=teacher2,
        token_headers=token_headers,
    )


# ==========================================
# PASSWORD HASHING
# ==========================================

def test_password_hashing():
    password = "TestOnlyPassword123!"

    stored_hash = hash_password(password)

    assert stored_hash.startswith("$argon2id$")
    assert verify_password(password, stored_hash)
    assert not verify_password(
        "IncorrectPassword123!",
        stored_hash,
    )


# ==========================================
# UNAUTHENTICATED REQUESTS
# ==========================================

def test_admin_requires_login(setup_api):
    response = setup_api.client.get(
        "/test/admin"
    )

    assert response.status_code == 401


# ==========================================
# ADMINISTRATOR ACCESS
# ==========================================

def test_admin_has_access(setup_api):
    response = setup_api.client.get(
        "/test/admin",
        headers=setup_api.token_headers(
            setup_api.admin
        ),
    )

    assert response.status_code == 200


# ==========================================
# TEACHER CANNOT ACCESS ADMIN ENDPOINTS
# ==========================================

def test_teacher_cannot_access_admin(setup_api):
    response = setup_api.client.get(
        "/test/admin",
        headers=setup_api.token_headers(
            setup_api.teacher1
        ),
    )

    assert response.status_code == 403


# ==========================================
# TEACHER CAN ACCESS ASSIGNED SESSION
# ==========================================

def test_teacher_assigned_session(setup_api):
    response = setup_api.client.get(
        "/test/sessions/10/review",
        headers=setup_api.token_headers(
            setup_api.teacher1
        ),
    )

    assert response.status_code == 200


# ==========================================
# TEACHER CANNOT ACCESS ANOTHER SESSION
# ==========================================

def test_teacher_cross_session_denied(setup_api):
    response = setup_api.client.get(
        "/test/sessions/20/review",
        headers=setup_api.token_headers(
            setup_api.teacher1
        ),
    )

    assert response.status_code == 403


# ==========================================
# ADMIN CAN ACCESS BOTH SESSIONS
# ==========================================

def test_admin_all_session_access(setup_api):
    headers = setup_api.token_headers(
        setup_api.admin
    )

    for session_id in (10, 20):
        response = setup_api.client.get(
            f"/test/sessions/{session_id}/review",
            headers=headers,
        )

        assert response.status_code == 200


# ==========================================
# INVALID JWT
# ==========================================

def test_invalid_jwt_is_rejected(setup_api):
    response = setup_api.client.get(
        "/test/admin",
        headers={
            "Authorization": "Bearer invalid.token.value"
        },
    )

    assert response.status_code == 401


# ==========================================
# REVOKED JWT
# ==========================================

def test_revoked_jwt_is_rejected(setup_api):
    user = setup_api.teacher1

    old_headers = setup_api.token_headers(user)

    first_response = setup_api.client.get(
        "/test/sessions/10/review",
        headers=old_headers,
    )

    assert first_response.status_code == 200

    # Simulate successful logout/password reset.
    user.token_version += 1

    second_response = setup_api.client.get(
        "/test/sessions/10/review",
        headers=old_headers,
    )

    assert second_response.status_code == 401

    # Restore fixture state.
    user.token_version -= 1


# ==========================================
# EXPIRED JWT
# ==========================================

def test_expired_jwt_is_rejected(setup_api):
    now = datetime.now(timezone.utc)

    payload = {
        "sub": "1",
        "iss": auth_security.ISSUER,
        "aud": auth_security.AUDIENCE,
        "iat": now - timedelta(hours=2),
        "nbf": now - timedelta(hours=2),
        "exp": now - timedelta(hours=1),
        "jti": "expired-test-token",
        "ver": 0,
    }

    token = jwt.encode(
        payload,
        TEST_SECRET,
        algorithm=auth_security.ALGORITHM,
    )

    response = setup_api.client.get(
        "/test/admin",
        headers={
            "Authorization": f"Bearer {token}"
        },
    )

    assert response.status_code == 401
