"""Authentication router for DocFlow — supports both JSON and PostgreSQL backends."""

import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from services.auth_service import (
    create_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_refresh_token,
)
from utils.auth_middleware import get_current_user
from utils.json_store import read_json, write_json

router = APIRouter(tags=["auth"])

STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "excel")

_USERS_FILE = Path(__file__).resolve().parent.parent / "users.json"
_DEFAULT_PASSWORD = "Aa123456"


# ── JSON-based user loading (original) ──────────────────────────────────────


def _load_users_json() -> dict:
    """Load users from users.json, initialising from config.USERS if absent."""
    if not _USERS_FILE.exists():
        from utils.config import USERS
        users = {}
        for initials, info in USERS.items():
            username = info["nombre"].lower().replace(" ", ".")
            users[username] = {
                "name": info["nombre"],
                "initials": initials,
                "role": "Document Controller" if initials == "JP" else "Comercial",
                "password_hash": hash_password(_DEFAULT_PASSWORD),
            }
        _save_users_json(users)
        return users
    users = read_json(str(_USERS_FILE), default={})
    changed = False
    for udata in users.values():
        if "password_hash" not in udata:
            udata["password_hash"] = hash_password(_DEFAULT_PASSWORD)
            changed = True
    if changed:
        _save_users_json(users)
    return users


def _save_users_json(users: dict) -> None:
    write_json(str(_USERS_FILE), users)


# ── Postgres-based user loading ─────────────────────────────────────────────


def _get_db_session():
    from db.database import SessionLocal
    return SessionLocal()


def _load_user_pg(username: str, tenant_id: int = None):
    """Load a single user from PostgreSQL. Returns dict or None."""
    from db.models import User
    session = _get_db_session()
    try:
        query = session.query(User).filter(
            User.username == username,
            User.is_active == True,
        )
        if tenant_id is not None:
            query = query.filter(User.tenant_id == tenant_id)
        user = query.first()
        if not user:
            return None
        return {
            "name": user.name,
            "initials": user.initials,
            "role": user.role,
            "password_hash": user.password_hash,
            "tenant_id": user.tenant_id,
            "is_superadmin": user.is_superadmin,
            "email": user.email,
            "user_id": user.id,
        }
    finally:
        session.close()


def _list_users_pg(tenant_id: int):
    """List all users for a tenant from PostgreSQL."""
    from db.models import User
    session = _get_db_session()
    try:
        users = session.query(User).filter(
            User.tenant_id == tenant_id,
            User.is_active == True,
        ).all()
        return [
            {
                "username": u.username,
                "name": u.name,
                "initials": u.initials,
                "role": u.role,
                "email": u.email,
            }
            for u in users
        ]
    finally:
        session.close()


def _change_password_pg(username: str, tenant_id: int, new_hash: str):
    """Update password hash in PostgreSQL."""
    from db.models import User
    session = _get_db_session()
    try:
        user = session.query(User).filter(
            User.username == username,
            User.tenant_id == tenant_id,
        ).first()
        if user:
            user.password_hash = new_hash
            session.commit()
            return True
        return False
    finally:
        session.close()


# ── Request / Response models ───────────────────────────────────────────────


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Endpoints ───────────────────────────────────────────────────────────────


@router.post("/login")
async def login(body: LoginRequest, request: Request):
    from utils.rate_limit import login_limiter
    client_ip = request.client.host if request.client else "unknown"
    if login_limiter.is_rate_limited(client_ip):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")

    if STORAGE_BACKEND == "postgres":
        user = _load_user_pg(body.username)
        if not user or not verify_password(body.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        user_data = {
            "sub": body.username,
            "role": user["role"],
            "initials": user["initials"],
            "tenant_id": user["tenant_id"],
        }
        token = create_token(user_data)
        refresh = create_refresh_token(user_data)

        return {
            "token": token,
            "refresh_token": refresh,
            "user": {
                "username": body.username,
                "name": user["name"],
                "initials": user["initials"],
                "role": user["role"],
                "tenant_id": user["tenant_id"],
            },
        }

    # JSON backend (original)
    users = _load_users_json()
    user = users.get(body.username)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_data = {
        "sub": body.username,
        "role": user["role"],
        "initials": user["initials"],
        "tenant_id": 1,
    }
    token = create_token(user_data)
    refresh = create_refresh_token(user_data)

    return {
        "token": token,
        "refresh_token": refresh,
        "user": {
            "username": body.username,
            "name": user["name"],
            "initials": user["initials"],
            "role": user["role"],
            "tenant_id": 1,
        },
    }


@router.post("/refresh")
async def refresh_token(body: RefreshRequest):
    """Issue a new access token using a valid refresh token."""
    try:
        payload = verify_refresh_token(body.refresh_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user_data = {
        "sub": payload["sub"],
        "role": payload["role"],
        "initials": payload["initials"],
        "tenant_id": payload.get("tenant_id", 1),
    }
    new_token = create_token(user_data)
    return {"token": new_token}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    username = current_user["username"]
    tenant_id = current_user.get("tenant_id", 1)

    if STORAGE_BACKEND == "postgres":
        user = _load_user_pg(username, tenant_id)
        if not user:
            return {
                "username": username,
                "name": username,
                "initials": current_user["initials"],
                "role": current_user["role"],
                "tenant_id": tenant_id,
            }
        # Get tenant info
        tenant_info = _get_tenant_info(tenant_id)
        return {
            "username": username,
            "name": user.get("name", username),
            "initials": current_user["initials"],
            "role": current_user["role"],
            "tenant_id": tenant_id,
            "tenant": tenant_info,
        }

    users = _load_users_json()
    user = users.get(username, {})
    return {
        "username": username,
        "name": user.get("name", username),
        "initials": current_user["initials"],
        "role": current_user["role"],
        "tenant_id": tenant_id,
    }


@router.get("/users")
async def list_users(current_user: dict = Depends(get_current_user)):
    """Return all users without password hashes."""
    tenant_id = current_user.get("tenant_id", 1)

    if STORAGE_BACKEND == "postgres":
        return _list_users_pg(tenant_id)

    users = _load_users_json()
    return [
        {
            "username": uname,
            "name": udata.get("name", uname),
            "initials": udata.get("initials", uname[:2].upper()),
            "role": udata.get("role", ""),
        }
        for uname, udata in users.items()
    ]


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    username = current_user["username"]
    tenant_id = current_user.get("tenant_id", 1)

    if STORAGE_BACKEND == "postgres":
        user = _load_user_pg(username, tenant_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not verify_password(body.current_password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        _change_password_pg(username, tenant_id, hash_password(body.new_password))
        return {"detail": "Password changed successfully"}

    users = _load_users_json()
    user = users.get(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    user["password_hash"] = hash_password(body.new_password)
    _save_users_json(users)
    return {"detail": "Password changed successfully"}


# ── Helpers ─────────────────────────────────────────────────────────────────


def _get_tenant_info(tenant_id: int) -> dict:
    """Get tenant info from PostgreSQL."""
    from db.models import Tenant
    session = _get_db_session()
    try:
        tenant = session.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            return {}
        return {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "plan": tenant.plan,
            "logo_url": tenant.logo_url,
            "max_users": tenant.max_users,
        }
    finally:
        session.close()
