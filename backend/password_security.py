
from argon2 import PasswordHasher
from argon2.exceptions import (
    VerifyMismatchError,
    VerificationError,
    InvalidHashError,
)

password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    """Create a salted Argon2id password hash."""

    if not isinstance(password, str):
        raise ValueError("Password must be a string")

    if not 12 <= len(password) <= 128:
        raise ValueError(
            "Password must contain 12 to 128 characters"
        )

    return password_hasher.hash(password)


def verify_password(
    password: str,
    stored_hash: str,
) -> bool:
    """Check a supplied password against its hash."""

    try:
        return password_hasher.verify(
            stored_hash,
            password,
        )

    except (
        VerifyMismatchError,
        VerificationError,
        InvalidHashError,
    ):
        return False


def password_needs_rehash(stored_hash: str) -> bool:
    return password_hasher.check_needs_rehash(
        stored_hash
    )
