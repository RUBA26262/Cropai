"""Password hashing using bcrypt directly (avoids passlib/bcrypt version
compatibility issues that surface with newer bcrypt releases)."""
import bcrypt


def hash_password(password: str) -> str:
    pw_bytes = password.encode("utf-8")[:72]  # bcrypt's own hard limit
    hashed = bcrypt.hashpw(pw_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    pw_bytes = plain_password.encode("utf-8")[:72]
    return bcrypt.checkpw(pw_bytes, hashed_password.encode("utf-8"))
