"""JWT authentication service for DocFlow."""

import os
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

JWT_SECRET = os.getenv("JWT_SECRET", "docflow-dev-secret-change-me")
JWT_SECRET_PREVIOUS = os.getenv("JWT_SECRET_PREVIOUS", "")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24
REFRESH_TOKEN_EXPIRE_HOURS = 168  # 7 days

# Block startup if using default secret in production
if os.getenv("ENV") == "production" and JWT_SECRET == "docflow-dev-secret-change-me":
    raise RuntimeError(
        "JWT_SECRET must be set to a secure value in production. "
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
    )


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_data: dict) -> str:
    """Create a JWT token.

    user_data must contain: sub, role, initials, tenant_id
    Raises ValueError if tenant_id is missing.
    """
    if "tenant_id" not in user_data or user_data["tenant_id"] is None:
        raise ValueError("tenant_id is required")
    payload = {
        "sub": user_data["sub"],
        "role": user_data["role"],
        "initials": user_data["initials"],
        "tenant_id": user_data["tenant_id"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_data: dict) -> str:
    """Create a long-lived refresh token.

    Raises ValueError if tenant_id is missing.
    """
    if "tenant_id" not in user_data or user_data["tenant_id"] is None:
        raise ValueError("tenant_id is required")
    payload = {
        "sub": user_data["sub"],
        "role": user_data["role"],
        "initials": user_data["initials"],
        "tenant_id": user_data["tenant_id"],
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(hours=REFRESH_TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _verify_with_fallback(token: str) -> dict:
    """Verify token with primary key, falling back to previous key during rotation."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        if JWT_SECRET_PREVIOUS:
            return jwt.decode(token, JWT_SECRET_PREVIOUS, algorithms=[JWT_ALGORITHM])
        raise


def verify_token(token: str) -> dict:
    """Verify and decode a JWT token. Raises JWTError on failure."""
    return _verify_with_fallback(token)


def verify_refresh_token(token: str) -> dict:
    """Verify a refresh token. Raises JWTError if invalid or wrong type."""
    payload = _verify_with_fallback(token)
    if payload.get("type") != "refresh":
        raise JWTError("Not a refresh token")
    return payload
