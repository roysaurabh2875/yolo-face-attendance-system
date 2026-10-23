
import getpass
import re
import sys

from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from backend.database import SessionLocal

# Register the existing teachers table in SQLAlchemy metadata
from backend.academic_models import Teacher

from backend.auth_models import UserAccount
from backend.password_security import hash_password


USERNAME_PATTERN = re.compile(
    r"^[a-z][a-z0-9_.-]{2,49}$"
)


def main():
    print()
    print("=" * 45)
    print("FACE ATTENDANCE - INITIAL ADMIN SETUP")
    print("=" * 45)

    print(
        "This command creates the first account "
        "only when the account table is empty."
    )

    db = SessionLocal()

    try:
        existing_count = db.scalar(
            select(func.count())
            .select_from(UserAccount)
        )

        if existing_count:
            raise RuntimeError(
                "User accounts already exist. "
                "Initial administrator setup is disabled."
            )

        username = input(
            "Administrator username: "
        ).strip().lower()

        if not USERNAME_PATTERN.fullmatch(username):
            raise RuntimeError(
                "Username must start with a letter, "
                "contain 3-50 characters, and use only "
                "lowercase letters, numbers, _, . or -."
            )

        existing_username = db.scalar(
            select(UserAccount.user_id)
            .where(UserAccount.username == username)
        )

        if existing_username is not None:
            raise RuntimeError(
                "Username already exists."
            )

        password = getpass.getpass(
            "Administrator password: "
        )

        confirmation = getpass.getpass(
            "Confirm password: "
        )

        if password != confirmation:
            raise RuntimeError(
                "Passwords do not match."
            )

        if not 12 <= len(password) <= 128:
            raise RuntimeError(
                "Password must contain 12-128 characters."
            )

        hashed = hash_password(password)

        # No plaintext password is saved.
        del password
        del confirmation

        account = UserAccount(
            username=username,
            password_hash=hashed,
            role="ADMIN",
            teacher_id=None,
            is_active=True,
        )

        db.add(account)

        try:
            db.commit()

        except IntegrityError:
            db.rollback()
            raise RuntimeError(
                "Account creation failed because "
                "of a database constraint."
            )

        print()
        print("Administrator created successfully.")
        print("User ID:", account.user_id)
        print("Username:", username)
        print("Role: ADMIN")
        print("Password stored as Argon2id hash.")
        print()

    except (
        RuntimeError,
        SQLAlchemyError,
    ) as error:
        db.rollback()
        print(
            "Administrator setup failed:",
            error,
            file=sys.stderr,
        )
        raise SystemExit(1)

    finally:
        db.close()


if __name__ == "__main__":
    main()
