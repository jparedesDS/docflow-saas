"""Tenant management router — registration, info, invitations."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from utils.auth_middleware import get_current_user

router = APIRouter(tags=["tenants"])


# ── Request models ──────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    name: str
    slug: str
    admin_email: str
    admin_password: str
    admin_name: str = ""


class InviteRequest(BaseModel):
    email: str
    role: str = "Document Controller"


class AcceptInviteRequest(BaseModel):
    token: str
    name: str
    password: str


class UpdateTenantRequest(BaseModel):
    name: str | None = None
    logo_url: str | None = None


# ── Endpoints ───────────────────────────────────────────────────────────────


@router.post("/register")
async def register_tenant(body: RegisterRequest):
    """Register a new organization. Public endpoint (no auth required)."""
    from services.tenant_service import register_tenant as do_register

    try:
        result = do_register(
            name=body.name,
            slug=body.slug,
            admin_email=body.admin_email,
            admin_password=body.admin_password,
            admin_name=body.admin_name,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me")
async def get_current_tenant(current_user: dict = Depends(get_current_user)):
    """Get info about the current tenant."""
    from services.tenant_service import get_tenant

    tenant_id = current_user.get("tenant_id", 1)
    tenant = get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Add feature flags
    from services.plan_service import get_features, get_limits
    tenant["features"] = get_features(tenant_id)
    tenant["limits"] = get_limits(tenant_id)

    return tenant


@router.put("/me")
async def update_current_tenant(
    body: UpdateTenantRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update current tenant settings (admin only)."""
    if current_user.get("role") not in ("admin", "Document Controller"):
        raise HTTPException(status_code=403, detail="Admin access required")

    from services.tenant_service import update_tenant

    tenant_id = current_user.get("tenant_id", 1)
    updates = body.model_dump(exclude_none=True)
    result = update_tenant(tenant_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return result


@router.post("/invite")
async def invite_user(
    body: InviteRequest,
    current_user: dict = Depends(get_current_user),
):
    """Invite a new user to the organization."""
    if current_user.get("role") not in ("admin", "Document Controller"):
        raise HTTPException(status_code=403, detail="Admin access required")

    from services.tenant_service import create_invitation

    tenant_id = current_user.get("tenant_id", 1)
    try:
        result = create_invitation(
            tenant_id=tenant_id,
            email=body.email,
            role=body.role,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/accept-invite")
async def accept_invite(body: AcceptInviteRequest):
    """Accept an invitation and create an account. Public endpoint."""
    from services.tenant_service import accept_invitation

    try:
        result = accept_invitation(
            token=body.token,
            name=body.name,
            password=body.password,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
