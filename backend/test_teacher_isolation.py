
from fastapi import HTTPException
from sqlalchemy import select

from backend.database import SessionLocal
from backend.auth_models import UserAccount
from backend.session_permissions import require_session_access


def check_access(db, username, session_id):
    user = db.scalar(
        select(UserAccount).where(
            UserAccount.username == username
        )
    )

    if user is None:
        return "ACCOUNT NOT FOUND"

    try:
        require_session_access(
            db=db,
            session_id=session_id,
            user=user,
        )
        return "ALLOWED"

    except HTTPException as error:
        return f"DENIED ({error.status_code})"


def main():
    db = SessionLocal()

    try:
        session_b = int(
            input("Enter Teacher 2 session ID: ").strip()
        )

        test_cases = [
            ("faculty001", 2, "ALLOWED"),
            ("faculty001", session_b, "DENIED (403)"),
            ("faculty002", 2, "DENIED (403)"),
            ("faculty002", session_b, "ALLOWED"),
        ]

        print()
        print("TEACHER SESSION ISOLATION RESULTS")
        print("-" * 55)

        passed = 0

        for username, session_id, expected in test_cases:
            actual = check_access(
                db, username, session_id
            )

            success = actual == expected

            if success:
                passed += 1

            print(
                f"{username} | Session {session_id} "
                f"| {actual} "
                f"| {'PASS' if success else 'FAIL'}"
            )

        print("-" * 55)
        print(f"Passed: {passed}/{len(test_cases)}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
