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
from utils.encryption import encrypt_value, decrypt_value
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
                "role": "admin" if initials == "JP" else "Comercial",
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
        ).all()
        return [
            {
                "id": u.id,
                "username": u.username,
                "name": u.name,
                "initials": u.initials,
                "role": u.role,
                "email": u.email,
                "is_active": u.is_active,
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


class UpdateUserRequest(BaseModel):
    role: str | None = None
    is_active: bool | None = None


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


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    body: UpdateUserRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update a user's role or active status (admin/DC only)."""
    if current_user.get("role") not in ("admin", "Document Controller"):
        raise HTTPException(status_code=403, detail="Admin access required")

    if STORAGE_BACKEND == "postgres":
        try:
            uid = int(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user ID")

        from db.models import User
        session = _get_db_session()
        try:
            tenant_id = current_user.get("tenant_id", 1)
            user = session.query(User).filter(
                User.id == uid,
                User.tenant_id == tenant_id,
            ).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            if body.is_active is False and user.username == current_user["username"]:
                raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

            if body.role is not None:
                user.role = body.role
            if body.is_active is not None:
                user.is_active = body.is_active

            session.commit()
            return {
                "id": user.id,
                "username": user.username,
                "name": user.name,
                "role": user.role,
                "is_active": user.is_active,
            }
        except HTTPException:
            raise
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    # JSON mode
    users = _load_users_json()
    if user_id not in users:
        raise HTTPException(status_code=404, detail="User not found")
    if body.role is not None:
        users[user_id]["role"] = body.role
        _save_users_json(users)
    return {
        "username": user_id,
        "name": users[user_id].get("name", user_id),
        "role": users[user_id].get("role", ""),
    }


# ── Email settings ──────────────────────────────────────────────────────────


class EmailSettingsRequest(BaseModel):
    imap_email: str
    imap_password: str


@router.get("/me/email-settings")
async def get_email_settings(current_user: dict = Depends(get_current_user)):
    users = _load_users_json()
    user = users.get(current_user["username"], {})
    return {
        "imap_email": user.get("imap_email", ""),
        "has_password": bool(user.get("imap_password")),
    }


@router.put("/me/email-settings")
async def save_email_settings(body: EmailSettingsRequest, current_user: dict = Depends(get_current_user)):
    users = _load_users_json()
    username = current_user["username"]
    if username not in users:
        raise HTTPException(status_code=404, detail="User not found")
    users[username]["imap_email"] = body.imap_email
    users[username]["imap_password"] = encrypt_value(body.imap_password)
    _save_users_json(users)
    return {"detail": "Email settings saved"}


@router.post("/me/test-email")
async def test_email_connection(body: EmailSettingsRequest, current_user: dict = Depends(get_current_user)):
    import imaplib as _imaplib
    from utils.config import IMAP_HOST, IMAP_PORT
    try:
        conn = _imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        conn.login(body.imap_email, body.imap_password)
        conn.select("INBOX")
        conn.close()
        conn.logout()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error: {e}")


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
