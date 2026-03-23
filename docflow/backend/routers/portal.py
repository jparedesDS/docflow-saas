"""Client Portal router — read-only endpoints for external clients."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from utils.auth_middleware import get_current_user
from services.client_portal_service import (
    generate_portal_token,
    validate_portal_token,
    list_portal_accesses,
    revoke_portal_access,
    get_client_documents,
    get_client_dashboard,
    get_document_detail,
)

router = APIRouter()


# ── Admin endpoints (manage portal access) ──────────────────────────


class PortalAccessCreate(BaseModel):
    client_name: str
    contact_email: str
    expires_days: int = 90


@router.post("/access")
def create_portal_access(body: PortalAccessCreate, user=Depends(get_current_user)):
    """Generate a portal access token for a client."""
    token = generate_portal_token(
        tenant_id=user["tenant_id"],
        client_name=body.client_name,
        contact_email=body.contact_email,
        expires_days=body.expires_days,
    )
    if token is None:
        raise HTTPException(status_code=400, detail="Portal not available in Excel mode")
    return {"token": token, "client_name": body.client_name}


@router.get("/access")
def list_accesses(user=Depends(get_current_user)):
    """List all portal accesses for the tenant."""
    return list_portal_accesses(user["tenant_id"])


@router.delete("/access/{access_id}")
def delete_access(access_id: int, user=Depends(get_current_user)):
    """Revoke a portal access."""
    ok = revoke_portal_access(user["tenant_id"], access_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Access not found")
    return {"ok": True}


# ── Client-facing endpoints (authenticated via portal token) ─────


@router.get("/documents")
def portal_documents(
    token: str = Query(...),
    status: str = Query(""),
):
    """Get documents for the authenticated client."""
    client = validate_portal_token(token)
    if not client:
        raise HTTPException(status_code=401, detail="Invalid or expired portal token")
    docs = get_client_documents(client["tenant_id"], client["client_name"], status)
    return docs


@router.get("/dashboard")
def portal_dashboard(token: str = Query(...)):
    """Get KPI dashboard for the authenticated client."""
    client = validate_portal_token(token)
    if not client:
        raise HTTPException(status_code=401, detail="Invalid or expired portal token")
    return get_client_dashboard(client["tenant_id"], client["client_name"])


@router.get("/document/{doc_ref}")
def portal_document_detail(doc_ref: str, token: str = Query(...)):
    """Get detailed info for a single document including timeline/history."""
    client = validate_portal_token(token)
    if not client:
        raise HTTPException(status_code=401, detail="Invalid or expired portal token")
    detail = get_document_detail(client["tenant_id"], client["client_name"], doc_ref)
    if not detail:
        raise HTTPException(status_code=404, detail="Document not found")
    return detail
