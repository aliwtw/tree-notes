from passlib.context import CryptContext

# Shared so that auth (verify on login) and profile (verify then rehash on
# password change) always use identical settings. Two separate CryptContext
# instances would be easy to let drift apart.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Mirrored by the client-side rules in RegisterCard.jsx and ProfileContent.jsx.
MIN_PASSWORD_LENGTH = 8
# bcrypt only reads the first 72 bytes and silently ignores the rest, so a
# longer password would accept any string sharing that prefix. Bytes, not
# characters: a non-ASCII character takes several.
MAX_PASSWORD_BYTES = 72


def password_too_long(password: str) -> bool:
    return len(password.encode("utf-8")) > MAX_PASSWORD_BYTES


def normalise_email(email: str) -> str:
    """Emails are stored and looked up lowercased, so the same address in a
    different case can neither register twice nor fail to log in."""
    return email.strip().lower()
