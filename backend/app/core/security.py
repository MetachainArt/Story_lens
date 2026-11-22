"""Security utilities for authentication."""
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4
import jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def password_fingerprint(password_hash: str) -> str:
    """Return a keyed digest that changes whenever the stored password changes.

    The digest is embedded in session tokens so a password change invalidates
    every session issued for the previous password without a server-side
    session table. It is keyed with SECRET_KEY, so it reveals nothing about the
    stored hash.
    """
    digest = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        password_hash.encode("utf-8"),
        hashlib.sha256,
    )
    return digest.hexdigest()[:32]


def token_matches_password(payload: dict[str, Any], password_hash: str | None) -> bool:
    """Check that a session token was issued for the user's current password.

    Tokens issued before fingerprints existed carry no claim and remain valid
    until their normal expiry, so deploying this change signs nobody out.
    """
    claim = payload.get("pwd")
    if claim is None:
        return True
    if not password_hash:
        return False
    return hmac.compare_digest(str(claim), password_fingerprint(password_hash))


def create_access_token(
    subject: str | Any,
    expires_delta: timedelta | None = None,
    *,
    password_hash: str | None = None,
) -> str:
    """Create JWT access token."""
    if expires_delta:
        expire = _utcnow() + expires_delta
    else:
        expire = _utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "exp": expire,
        "jti": uuid4().hex,
        "sub": str(subject),
        "type": "access"
    }
    if password_hash:
        to_encode["pwd"] = password_fingerprint(password_hash)
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(
    subject: str | Any,
    expires_delta: timedelta | None = None,
    *,
    password_hash: str | None = None,
) -> str:
    """Create JWT refresh token."""
    if expires_delta:
        expire = _utcnow() + expires_delta
    else:
        expire = _utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode = {
        "exp": expire,
        "jti": uuid4().hex,
        "sub": str(subject),
        "type": "refresh"
    }
    if password_hash:
        to_encode["pwd"] = password_fingerprint(password_hash)
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_media_token(path: str, expires_delta: timedelta | None = None) -> str:
    """Create a short-lived token for a single private media path."""
    expire = _utcnow() + (expires_delta or timedelta(minutes=15))
    normalized_path = path.lstrip("/")
    to_encode = {
        "exp": expire,
        "path": normalized_path,
        "type": "media",
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def verify_media_token(token: str, path: str) -> bool:
    """Verify that a media token was issued for this exact path."""
    payload = decode_token(token)
    return (
        payload.get("type") == "media"
        and str(payload.get("path") or "").lstrip("/") == path.lstrip("/")
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decode and verify JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.InvalidTokenError:
        raise ValueError("Invalid token")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)
