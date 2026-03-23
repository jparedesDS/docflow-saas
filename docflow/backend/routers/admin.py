"""Superadmin router — tenant management, impersonation."""

import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from utils.auth_middleware import get_current_user
from services.auth_service import create_token, create_refresh_token

router = APIRouter(tags=["admin"])

STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "excel")


def _require_superadmin(current_user: dict = Depends(get_current_user)):
    """Dependency: only allow superadmin users."""
    if STORAGE_BACKEND != "postgres":
        # In Excel mode, JP is effectively superadmin
        if current_user.get("initials") != "JP":
            raise HTTPException(status_code=403, detail="Superadmin access required")
        return current_user

    # Check is_superadmin flag
    from db.database import SessionLocal
    from db.models import User
    session = SessionLocal()
    try:
        user = session.query(User).filter(
            User.username == current_user["username"],
            User.tenant_id == current_user.get("tenant_id", 1),
        ).first()
        if not user or not user.is_superadmin:
            raise HTTPException(status_code=403, detail="Superadmin access required")
    finally:
        session.close()
    return current_user


class ImpersonateRequest(BaseModel):
    tenant_id: int
    username: str | None = None


class UpdateTenantAdminRequest(BaseModel):
    plan: str | None = None
    max_users: int | None = None
    is_active: bool | None = None


# ── Endpoints ───────────────────────────────────────────────────────────────


@router.get("/tenants")
async def list_tenants(admin: dict = Depends(_require_superadmin)):
    """List all tenants with basic stats."""
    from db.database import SessionLocal
    from db.models import Tenant, User
    from sqlalchemy import func

    session = SessionLocal()
    try:
        tenants = session.query(
            Tenant,
            func.count(User.id).label("user_count"),
        ).outerjoin(User, User.tenant_id == Tenant.id).group_by(Tenant.id).all()

        return [
            {
                "id": t.id,
                "name": t.name,
                "slug": t.slug,
                "plan": t.plan,
                "max_users": t.max_users,
                "is_active": t.is_active,
                "user_count": count,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t, count in tenants
        ]
    finally:
        session.close()


@router.get("/tenants/{tenant_id}")
async def get_tenant_detail(tenant_id: int, admin: dict = Depends(_require_superadmin)):
    """Get detailed info about a specific tenant."""
    from db.database import SessionLocal
    from db.models import Tenant, User, BillingInfo

    session = SessionLocal()
    try:
        tenant = session.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        users = session.query(User).filter(User.tenant_id == tenant_id).all()
        billing = session.query(BillingInfo).filter(BillingInfo.tenant_id == tenant_id).first()

        from services.usage_service import get_current_month_usage
        usage = get_current_month_usage(tenant_id)

        return {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "plan": tenant.plan,
            "max_users": tenant.max_users,
            "is_active": tenant.is_active,
            "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
            "users": [
                {
                    "id": u.id,
                    "username": u.username,
                    "name": u.name,
                    "role": u.role,
                    "is_active": u.is_active,
                }
                for u in users
            ],
            "billing": {
                "plan": billing.plan if billing else "free",
                "status": billing.status if billing else "active",
                "stripe_customer_id": billing.stripe_customer_id if billing else None,
            },
            "usage": usage,
        }
    finally:
        session.close()


@router.put("/tenants/{tenant_id}")
async def update_tenant_admin(
    tenant_id: int,
    body: UpdateTenantAdminRequest,
    admin: dict = Depends(_require_superadmin),
):
    """Update tenant plan/settings (superadmin only)."""
    from db.database import SessionLocal
    from db.models import Tenant

    session = SessionLocal()
    try:
        tenant = session.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        if body.plan is not None:
            tenant.plan = body.plan
        if body.max_users is not None:
            tenant.max_users = body.max_users
        if body.is_active is not None:
            tenant.is_active = body.is_active

        session.commit()
        return {"detail": "Tenant updated", "tenant_id": tenant_id}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@router.post("/impersonate")
async def impersonate(body: ImpersonateRequest, admin: dict = Depends(_require_superadmin)):
    """Generate a token as if logged in as a user in another tenant."""
    from db.database import SessionLocal
    from db.models import User

    session = SessionLocal()
    try:
        query = session.query(User).filter(User.tenant_id == body.tenant_id, User.is_active == True)
        if body.username:
            query = query.filter(User.username == body.username)
        user = query.first()

        if not user:
            raise HTTPException(status_code=404, detail="User not found in tenant")

        user_data = {
            "sub": user.username,
            "role": user.role,
            "initials": user.initials,
            "tenant_id": body.tenant_id,
        }
        return {
            "token": create_token(user_data),
            "refresh_token": create_refresh_token(user_data),
            "user": {
                "username": user.username,
                "name": user.name,
                "role": user.role,
                "tenant_id": body.tenant_id,
            },
        }
    finally:
        session.close()


@router.get("/stats")
async def global_stats(admin: dict = Depends(_require_superadmin)):
    """Global platform statistics."""
    from db.database import SessionLocal
    from db.models import Tenant, User, Document
    from sqlalchemy import func

    session = SessionLocal()
    try:
        return {
            "total_tenants": session.query(Tenant).count(),
            "active_tenants": session.query(Tenant).filter(Tenant.is_active == True).count(),
            "total_users": session.query(User).filter(User.is_active == True).count(),
            "total_documents": session.query(Document).count(),
            "tenants_by_plan": dict(
                session.query(Tenant.plan, func.count(Tenant.id)).group_by(Tenant.plan).all()
            ),
        }
    finally:
        session.close()


@router.get("/activity")
async def platform_activity(admin: dict = Depends(_require_superadmin)):
    """Recent platform activity aggregated from multiple sources."""
    from datetime import datetime, timedelta, timezone
    from db.database import SessionLocal
    from db.models import Tenant, User, UsageRecord
    from sqlalchemy import desc

    session = SessionLocal()
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    events = []

    try:
        # Recent tenant registrations
        recent_tenants = session.query(Tenant).filter(
            Tenant.created_at >= cutoff,
        ).order_by(desc(Tenant.created_at)).limit(50).all()

        for t in recent_tenants:
            events.append({
                "type": "tenant_created",
                "description": f"Organization '{t.name}' registered",
                "tenant_name": t.name,
                "tenant_id": t.id,
                "timestamp": t.created_at.isoformat() if t.created_at else None,
                "metadata": {"plan": t.plan, "slug": t.slug},
            })

        # Recent user signups
        recent_users = session.query(User, Tenant.name.label("tenant_name")).join(
            Tenant, User.tenant_id == Tenant.id,
        ).filter(
            User.created_at >= cutoff,
        ).order_by(desc(User.created_at)).limit(50).all()

        for u, tenant_name in recent_users:
            events.append({
                "type": "user_created",
                "description": f"User '{u.name}' joined '{tenant_name}'",
                "tenant_name": tenant_name,
                "tenant_id": u.tenant_id,
                "timestamp": u.created_at.isoformat() if u.created_at else None,
                "metadata": {"role": u.role, "username": u.username},
            })

        # Recent usage updates
        recent_usage = session.query(UsageRecord, Tenant.name.label("tenant_name")).join(
            Tenant, UsageRecord.tenant_id == Tenant.id,
        ).order_by(desc(UsageRecord.month)).limit(20).all()

        for ur, tenant_name in recent_usage:
            events.append({
                "type": "usage_update",
                "description": f"Usage for '{tenant_name}' — {ur.month}",
                "tenant_name": tenant_name,
                "tenant_id": ur.tenant_id,
                "timestamp": ur.month + "-01T00:00:00+00:00",
                "metadata": {
                    "api_calls": ur.api_calls,
                    "documents_created": ur.documents_created,
                    "emails_sent": ur.emails_sent,
                },
            })

        # Sort all events by timestamp descending
        events.sort(key=lambda e: e.get("timestamp") or "", reverse=True)
        return events[:100]

    finally:
        session.close()
