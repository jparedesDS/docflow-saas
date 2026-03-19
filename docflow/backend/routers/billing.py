"""Billing router — Stripe checkout, portal, webhooks, usage."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from utils.auth_middleware import get_current_user

router = APIRouter(tags=["billing"])


class CheckoutRequest(BaseModel):
    plan: str
    success_url: str
    cancel_url: str


class PortalRequest(BaseModel):
    return_url: str


@router.post("/checkout")
async def create_checkout(
    body: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a Stripe Checkout session for upgrading."""
    from services.billing_service import create_checkout_session, get_or_create_customer

    tenant_id = current_user.get("tenant_id", 1)

    try:
        # Ensure customer exists
        get_or_create_customer(
            tenant_id=tenant_id,
            email=current_user.get("email", f"{current_user['username']}@docflow.app"),
            name=current_user.get("username", ""),
        )

        url = create_checkout_session(
            tenant_id=tenant_id,
            plan=body.plan,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
        )
        return {"url": url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/portal")
async def create_portal(
    body: PortalRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a Stripe Customer Portal session."""
    from services.billing_service import create_portal_session

    tenant_id = current_user.get("tenant_id", 1)
    try:
        url = create_portal_session(tenant_id, body.return_url)
        return {"url": url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhooks")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events. No auth — verified by Stripe signature."""
    from services.billing_service import handle_webhook

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        result = handle_webhook(payload, sig)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/info")
async def get_billing(current_user: dict = Depends(get_current_user)):
    """Get billing info for the current tenant."""
    from services.billing_service import get_billing_info

    tenant_id = current_user.get("tenant_id", 1)
    info = get_billing_info(tenant_id)
    if not info:
        return {"plan": "free", "status": "active", "has_subscription": False}
    return info


@router.get("/usage")
async def get_usage(current_user: dict = Depends(get_current_user)):
    """Get usage stats for the current tenant."""
    from services.usage_service import get_current_month_usage, get_usage_history
    from services.plan_service import get_limits

    tenant_id = current_user.get("tenant_id", 1)
    return {
        "current": get_current_month_usage(tenant_id),
        "limits": get_limits(tenant_id),
        "history": get_usage_history(tenant_id),
    }
