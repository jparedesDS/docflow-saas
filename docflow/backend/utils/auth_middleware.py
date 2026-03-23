"""FastAPI dependencies for JWT authentication."""

from typing import Callable

from fastapi import Header, HTTPException
from jose import JWTError

from services.auth_service import verify_token

# API Key scope constants
SCOPE_READ = "read"
SCOPE_WRITE = "write"
SCOPE_WEBHOOKS = "webhooks"
SCOPE_ADMIN = "admin"


async def get_current_user(authorization: str = Header(...)) -> dict:
    """Extract and verify Bearer token, return user dict."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.removeprefix("Bearer ")
    try:
        payload = verify_token(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Token missing tenant_id")

    return {
        "username": payload["sub"],
        "role": payload["role"],
        "initials": payload["initials"],
        "tenant_id": tenant_id,
        "scopes": payload.get("scopes", []),
    }


def require_role(*roles: str) -> Callable:
    """Return a dependency that checks the user has one of the allowed roles."""

    async def _check_role(authorization: str = Header(...)) -> dict:
        user = await get_current_user(authorization)
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return _check_role


def require_scope(*scopes: str) -> Callable:
    """Return a dependency that checks the user (if API key) has required scopes.

    JWT human users always pass (they have implicit full access).
    API key users (role == 'api') must have at least one of the required scopes.
    """

    async def _check_scope(authorization: str = Header(...)) -> dict:
        user = await get_current_user(authorization)
        if user["role"] == "api":
            user_scopes = set(user.get("scopes", []))
            if not user_scopes.intersection(scopes):
                raise HTTPException(
                    status_code=403,
                    detail=f"API key missing required scope. Need one of: {', '.join(scopes)}",
                )
        return user

    return _check_scope
