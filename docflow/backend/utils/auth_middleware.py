"""FastAPI dependencies for JWT authentication."""

from typing import Callable

from fastapi import Header, HTTPException
from jose import JWTError

from services.auth_service import verify_token


async def get_current_user(authorization: str = Header(...)) -> dict:
    """Extract and verify Bearer token, return user dict."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.removeprefix("Bearer ")
    try:
        payload = verify_token(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return {
        "username": payload["sub"],
        "role": payload["role"],
        "initials": payload["initials"],
        "tenant_id": payload.get("tenant_id", 1),
    }


def require_role(*roles: str) -> Callable:
    """Return a dependency that checks the user has one of the allowed roles."""

    async def _check_role(authorization: str = Header(...)) -> dict:
        user = await get_current_user(authorization)
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return _check_role
