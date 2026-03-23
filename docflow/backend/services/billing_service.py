"""Stripe billing service — subscriptions, webhooks, customer portal."""

import os
from datetime import datetime, timezone
from typing import Optional

import structlog

logger = structlog.get_logger("docflow.billing")

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_PRO = os.getenv("STRIPE_PRICE_PRO", "")
STRIPE_PRICE_ENTERPRISE = os.getenv("STRIPE_PRICE_ENTERPRISE", "")

PLAN_PRICE_MAP = {
    "pro": STRIPE_PRICE_PRO,
    "enterprise": STRIPE_PRICE_ENTERPRISE,
}


def _get_stripe():
    """Lazy import and configure stripe."""
    import stripe
    stripe.api_key = STRIPE_SECRET_KEY
    return stripe


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


# ── Customer management ─────────────────────────────────────────────────────


def get_or_create_customer(tenant_id: int, email: str, name: str) -> str:
    """Get or create a Stripe customer for a tenant. Returns customer_id."""
    from db.models import BillingInfo
    stripe = _get_stripe()
    session = _get_session()

    try:
        billing = session.query(BillingInfo).filter(
            BillingInfo.tenant_id == tenant_id
        ).first()

        if billing and billing.stripe_customer_id:
            return billing.stripe_customer_id

        # Create Stripe customer
        customer = stripe.Customer.create(
            email=email,
            name=name,
            metadata={"tenant_id": str(tenant_id)},
        )

        if not billing:
            billing = BillingInfo(tenant_id=tenant_id)
            session.add(billing)

        billing.stripe_customer_id = customer.id
        session.commit()

        return customer.id
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ── Checkout ─────────────────────────────────────────────────────────────────


def create_checkout_session(tenant_id: int, plan: str, success_url: str, cancel_url: str) -> str:
    """Create a Stripe Checkout session. Returns the checkout URL."""
    from db.models import BillingInfo
    stripe = _get_stripe()

    price_id = PLAN_PRICE_MAP.get(plan)
    if not price_id:
        raise ValueError(f"Unknown plan: {plan}")

    session_db = _get_session()
    try:
        billing = session_db.query(BillingInfo).filter(
            BillingInfo.tenant_id == tenant_id
        ).first()

        if not billing or not billing.stripe_customer_id:
            raise ValueError("No Stripe customer found. Please contact support.")

        checkout = stripe.checkout.Session.create(
            customer=billing.stripe_customer_id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"tenant_id": str(tenant_id)},
        )
        return checkout.url
    finally:
        session_db.close()


# ── Customer Portal ──────────────────────────────────────────────────────────


def create_portal_session(tenant_id: int, return_url: str) -> str:
    """Create a Stripe Customer Portal session. Returns the portal URL."""
    from db.models import BillingInfo
    stripe = _get_stripe()

    session_db = _get_session()
    try:
        billing = session_db.query(BillingInfo).filter(
            BillingInfo.tenant_id == tenant_id
        ).first()

        if not billing or not billing.stripe_customer_id:
            raise ValueError("No Stripe customer found")

        portal = stripe.billing_portal.Session.create(
            customer=billing.stripe_customer_id,
            return_url=return_url,
        )
        return portal.url
    finally:
        session_db.close()


# ── Webhook handler ──────────────────────────────────────────────────────────


def handle_webhook(payload: bytes, sig_header: str) -> dict:
    """Process a Stripe webhook event. Returns {type, tenant_id, action}."""
    from utils.redis_client import get_redis

    stripe = _get_stripe()

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        raise ValueError(f"Invalid webhook: {e}")

    # ── Idempotency check (skip duplicate events) ─────────────────
    redis = get_redis()
    if redis is not None:
        event_key = f"stripe_event:{event['id']}"
        if redis.get(event_key):
            logger.info("stripe_webhook_duplicate", event_id=event["id"])
            return {"type": event.get("type", "unknown"), "action": "duplicate_skipped"}
        redis.setex(event_key, 7 * 24 * 3600, "processed")  # 7-day TTL

    event_type = event["type"]
    data_obj = event["data"]["object"]

    logger.info("stripe_webhook", event_type=event_type, event_id=event["id"])

    handlers = {
        "checkout.session.completed": _handle_checkout_completed,
        "customer.subscription.updated": _handle_subscription_updated,
        "customer.subscription.deleted": _handle_subscription_deleted,
        "invoice.payment_failed": _handle_payment_failed,
    }

    handler = handlers.get(event_type)
    if handler:
        return handler(data_obj)

    return {"type": event_type, "action": "ignored"}


def _handle_checkout_completed(data: dict) -> dict:
    """Activate subscription after successful checkout."""
    from db.models import BillingInfo, Tenant
    stripe = _get_stripe()

    tenant_id = int(data.get("metadata", {}).get("tenant_id", 0))
    subscription_id = data.get("subscription")

    if not tenant_id or not subscription_id:
        return {"type": "checkout.session.completed", "action": "skipped", "reason": "missing data"}

    # Get subscription details
    sub = stripe.Subscription.retrieve(subscription_id)
    plan = _price_to_plan(sub["items"]["data"][0]["price"]["id"])

    session = _get_session()
    try:
        billing = session.query(BillingInfo).filter(BillingInfo.tenant_id == tenant_id).first()
        if billing:
            billing.stripe_subscription_id = subscription_id
            billing.plan = plan
            billing.status = "active"
            billing.current_period_start = datetime.fromtimestamp(sub["current_period_start"], tz=timezone.utc)
            billing.current_period_end = datetime.fromtimestamp(sub["current_period_end"], tz=timezone.utc)

        # Update tenant plan
        tenant = session.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant:
            from services.plan_service import PLANS
            tenant.plan = plan
            tenant.max_users = PLANS.get(plan, PLANS["free"])["max_users"]

        session.commit()
        return {"type": "checkout.session.completed", "action": "activated", "tenant_id": tenant_id, "plan": plan}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _handle_subscription_updated(data: dict) -> dict:
    """Handle plan changes or renewal."""
    from db.models import BillingInfo, Tenant

    customer_id = data.get("customer")
    session = _get_session()
    try:
        billing = session.query(BillingInfo).filter(BillingInfo.stripe_customer_id == customer_id).first()
        if not billing:
            return {"type": "subscription.updated", "action": "skipped"}

        plan = _price_to_plan(data["items"]["data"][0]["price"]["id"])
        billing.plan = plan
        billing.status = data.get("status", "active")
        billing.current_period_start = datetime.fromtimestamp(data["current_period_start"], tz=timezone.utc)
        billing.current_period_end = datetime.fromtimestamp(data["current_period_end"], tz=timezone.utc)

        tenant = session.query(Tenant).filter(Tenant.id == billing.tenant_id).first()
        if tenant:
            from services.plan_service import PLANS
            tenant.plan = plan
            tenant.max_users = PLANS.get(plan, PLANS["free"])["max_users"]

        session.commit()
        return {"type": "subscription.updated", "action": "updated", "tenant_id": billing.tenant_id, "plan": plan}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _handle_subscription_deleted(data: dict) -> dict:
    """Downgrade to free on cancellation."""
    from db.models import BillingInfo, Tenant

    customer_id = data.get("customer")
    session = _get_session()
    try:
        billing = session.query(BillingInfo).filter(BillingInfo.stripe_customer_id == customer_id).first()
        if not billing:
            return {"type": "subscription.deleted", "action": "skipped"}

        billing.plan = "free"
        billing.status = "canceled"
        billing.stripe_subscription_id = None

        tenant = session.query(Tenant).filter(Tenant.id == billing.tenant_id).first()
        if tenant:
            tenant.plan = "free"
            tenant.max_users = 3

        session.commit()
        return {"type": "subscription.deleted", "action": "downgraded", "tenant_id": billing.tenant_id}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _handle_payment_failed(data: dict) -> dict:
    """Mark billing as past_due on payment failure."""
    from db.models import BillingInfo

    customer_id = data.get("customer")
    session = _get_session()
    try:
        billing = session.query(BillingInfo).filter(BillingInfo.stripe_customer_id == customer_id).first()
        if billing:
            billing.status = "past_due"
            session.commit()
        return {"type": "invoice.payment_failed", "action": "marked_past_due"}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _price_to_plan(price_id: str) -> str:
    """Map Stripe price ID back to plan name."""
    for plan, pid in PLAN_PRICE_MAP.items():
        if pid == price_id:
            return plan
    return "pro"


# ── Billing info queries ─────────────────────────────────────────────────────


def get_billing_info(tenant_id: int) -> Optional[dict]:
    from db.models import BillingInfo
    session = _get_session()
    try:
        billing = session.query(BillingInfo).filter(BillingInfo.tenant_id == tenant_id).first()
        if not billing:
            return None
        return {
            "plan": billing.plan,
            "status": billing.status,
            "stripe_customer_id": billing.stripe_customer_id,
            "has_subscription": billing.stripe_subscription_id is not None,
            "current_period_start": billing.current_period_start.isoformat() if billing.current_period_start else None,
            "current_period_end": billing.current_period_end.isoformat() if billing.current_period_end else None,
        }
    finally:
        session.close()
