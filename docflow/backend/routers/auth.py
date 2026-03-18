"""Authentication router for DocFlow."""

import json
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services.auth_service import (
    create_token,
    hash_password,
    verify_password,
)
from utils.auth_middleware import get_current_user

router = APIRouter(tags=["auth"])

_USERS_FILE = Path(__file__).resolve().parent.parent / "users.json"
_DEFAULT_PASSWORD = "Aa123456"


def _load_users() -> dict:
    """Load users from users.json, initialising from config.USERS if absent."""
    if not _USERS_FILE.exists():
        # Bootstrap: crear users.json desde config.USERS
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
        _save_users(users)
        return users
    with open(_USERS_FILE, "r", encoding="utf-8") as f:
        users = json.load(f)
    changed = False
    for udata in users.values():
        if "password_hash" not in udata:
            udata["password_hash"] = hash_password(_DEFAULT_PASSWORD)
            changed = True
    if changed:
        _save_users(users)
    return users


def _save_users(users: dict) -> None:
    with open(_USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


# --- Request / Response models ---

class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# --- Endpoints ---

@router.post("/login")
async def login(body: LoginRequest):
    users = _load_users()
    user = users.get(body.username)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token({
        "sub": body.username,
        "role": user["role"],
        "initials": user["initials"],
    })

    return {
        "token": token,
        "user": {
            "username": body.username,
            "name": user["name"],
            "initials": user["initials"],
            "role": user["role"],
        },
    }


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    users = _load_users()
    username = current_user["username"]
    user = users.get(username, {})
    return {
        "username": username,
        "name": user.get("name", username),
        "initials": current_user["initials"],
        "role": current_user["role"],
    }


@router.get("/users")
async def list_users(current_user: dict = Depends(get_current_user)):
    """Return all users without password hashes."""
    users = _load_users()
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
    users = _load_users()
    username = current_user["username"]
    user = users.get(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    user["password_hash"] = hash_password(body.new_password)
    _save_users(users)
    return {"detail": "Password changed successfully"}
