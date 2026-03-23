"""Audit log router — view activity history for documents and entities."""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from utils.auth_middleware import get_current_user

router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────


def _require_admin_or_dc(current_user: dict):
    """Raise 403 if user is not admin or Document Controller."""
    if current_user.get("role") not in ("admin", "Document Controller"):
        raise HTTPException(status_code=403, detail="Admin or DC access required")


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/")
async def get_audit_log(
    entity_type: Optional[str] = Query(None),
    user_initials: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(50),
    current_user: dict = Depends(get_current_user),
):
    """Get audit log entries with optional filters."""
    _require_admin_or_dc(current_user)

    from services.audit_service import get_recent_activity as fetch_log

    tenant_id = current_user.get("tenant_id", 1)
    try:
        return fetch_log(
            tenant_id=tenant_id,
            entity_type=entity_type,
            user_initials=user_initials,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent")
async def get_recent_audit_log(
    current_user: dict = Depends(get_current_user),
):
    """Get the 20 most recent audit log entries."""
    _require_admin_or_dc(current_user)

    from services.audit_service import get_recent_activity

    tenant_id = current_user.get("tenant_id", 1)
    try:
        return get_recent_activity(tenant_id=tenant_id, limit=20)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/document/{doc_ref}")
async def get_document_audit_log(
    doc_ref: str,
    current_user: dict = Depends(get_current_user),
):
    """Get audit log entries for a specific document."""
    _require_admin_or_dc(current_user)

    from services.audit_service import get_entity_log

    tenant_id = current_user.get("tenant_id", 1)
    try:
        return get_entity_log(
            tenant_id=tenant_id,
            entity_type="document",
            entity_id=doc_ref,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
