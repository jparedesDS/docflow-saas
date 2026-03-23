"""API keys router — manage tenant API keys for programmatic access."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from utils.auth_middleware import get_current_user

router = APIRouter()


# ── Request models ─────────────────────────────────────────────────────────


class CreateKeyRequest(BaseModel):
    name: str
    scopes: list = ["read"]
    expires_days: int | None = None


# ── Helpers ────────────────────────────────────────────────────────────────


def _require_admin(current_user: dict):
    """Raise 403 if user is not admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _check_api_keys_feature(tenant_id: int):
    """Raise 403 if the api_keys feature is not available on the current plan."""
    from services.plan_service import check_feature

    if not check_feature(tenant_id, "api_keys"):
        raise HTTPException(
            status_code=403,
            detail="API keys not available on current plan",
        )


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/")
async def list_api_keys(
    current_user: dict = Depends(get_current_user),
):
    """List all API keys for the tenant."""
    _require_admin(current_user)

    tenant_id = current_user.get("tenant_id", 1)
    _check_api_keys_feature(tenant_id)

    from services.api_key_service import list_keys as get_keys

    try:
        return get_keys(tenant_id=tenant_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_api_key(
    body: CreateKeyRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a new API key."""
    _require_admin(current_user)

    tenant_id = current_user.get("tenant_id", 1)
    _check_api_keys_feature(tenant_id)

    from services.api_key_service import create_key

    try:
        return create_key(
            tenant_id=tenant_id,
            name=body.name,
            scopes=body.scopes,
            expires_days=body.expires_days,
            created_by=current_user.get("initials", ""),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{key_id}")
async def revoke_api_key(
    key_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Revoke and delete an API key."""
    _require_admin(current_user)

    tenant_id = current_user.get("tenant_id", 1)
    _check_api_keys_feature(tenant_id)

    from services.api_key_service import delete_key

    try:
        delete_key(tenant_id=tenant_id, key_id=key_id)
        return {"detail": "API key revoked"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
