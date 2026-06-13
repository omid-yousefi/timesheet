from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

from app.core.config import settings

# bcrypt has a hard 72-byte input limit. We pre-truncate to stay within it and
# behave predictably across bcrypt versions.
_BCRYPT_MAX_BYTES = 72


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except (ValueError, TypeError):
        return False


def hash_password(password: str) -> str:
    pw_bytes = password.encode('utf-8')[:_BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode('utf-8')


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {'sub': subject, 'role': role, 'exp': expire},
        settings.secret_key,
        algorithm=settings.algorithm,
    )
