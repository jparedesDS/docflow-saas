"""Saved filters router — user-defined filter presets for documents and entities."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from utils.auth_middleware import get_current_user

router = APIRouter()


# ── Request models ─────────────────────────────────────────────────────────


class CreateFilterRequest(BaseModel):
    name: str
    entity_type: str = "document"
    filters: dict = {}
    sort_config: dict | None = None


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/")
async def list_saved_filters(
    entity_type: str = Query("document"),
    current_user: dict = Depends(get_current_user),
):
    """List saved filters for the current user."""
    from services.saved_filter_service import list_filters as get_filters

    tenant_id = current_user.get("tenant_id", 1)
    user_initials = current_user.get("initials", "")
    try:
        return get_filters(
            tenant_id=tenant_id,
            user_initials=user_initials,
            entity_type=entity_type,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_saved_filter(
    body: CreateFilterRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a new saved filter."""
    from services.saved_filter_service import create_filter

    tenant_id = current_user.get("tenant_id", 1)
    user_initials = current_user.get("initials", "")
    try:
        return create_filter(
            tenant_id=tenant_id,
            user_initials=user_initials,
            name=body.name,
            entity_type=body.entity_type,
            filters=body.filters,
            sort_config=body.sort_config,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{filter_id}")
async def delete_saved_filter(
    filter_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Delete a saved filter."""
    from services.saved_filter_service import delete_filter

    tenant_id = current_user.get("tenant_id", 1)
    user_initials = current_user.get("initials", "")
    try:
        delete_filter(
            tenant_id=tenant_id,
            filter_id=filter_id,
            user_initials=user_initials,
        )
        return {"detail": "Filter deleted"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{filter_id}/default")
async def set_default_filter(
    filter_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Set a saved filter as the default."""
    from services.saved_filter_service import set_default

    tenant_id = current_user.get("tenant_id", 1)
    user_initials = current_user.get("initials", "")
    try:
        return set_default(
            tenant_id=tenant_id,
            filter_id=filter_id,
            user_initials=user_initials,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
