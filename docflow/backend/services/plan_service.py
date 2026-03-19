"""Plan & feature flag service for multi-tenant DocFlow.

Defines plan tiers, checks feature access, and enforces quotas.
"""

import os

PLANS = {
    "free": {
        "max_users": 3,
        "max_documents": 500,
        "max_api_calls_per_month": 5000,
        "features": {
            "workflows": False,
            "ai": False,
            "custom_reports": False,
            "email_parsing": True,
            "claims": True,
            "docusign": False,
            "scheduled_reports": False,
            "api_access": False,
        },
    },
    "pro": {
        "max_users": 15,
        "max_documents": 10000,
        "max_api_calls_per_month": 50000,
        "features": {
            "workflows": True,
            "ai": True,
            "custom_reports": True,
            "email_parsing": True,
            "claims": True,
            "docusign": True,
            "scheduled_reports": True,
            "api_access": True,
        },
    },
    "enterprise": {
        "max_users": -1,  # unlimited
        "max_documents": -1,
        "max_api_calls_per_month": -1,
        "features": {
            "workflows": True,
            "ai": True,
            "custom_reports": True,
            "email_parsing": True,
            "claims": True,
            "docusign": True,
            "scheduled_reports": True,
            "api_access": True,
        },
    },
}


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


def get_plan(tenant_id: int) -> str:
    """Get the plan name for a tenant."""
    if os.getenv("STORAGE_BACKEND", "excel") != "postgres":
        return "enterprise"  # single-tenant mode = enterprise

    from db.models import Tenant
    session = _get_session()
    try:
        tenant = session.query(Tenant).filter(Tenant.id == tenant_id).first()
        return tenant.plan if tenant else "free"
    finally:
        session.close()


def get_plan_config(tenant_id: int) -> dict:
    """Get the full plan configuration for a tenant."""
    plan_name = get_plan(tenant_id)
    return PLANS.get(plan_name, PLANS["free"])


def check_feature(tenant_id: int, feature: str) -> bool:
    """Check if a tenant has access to a specific feature."""
    config = get_plan_config(tenant_id)
    return config["features"].get(feature, False)


def check_quota(tenant_id: int, resource: str, additional: int = 0) -> bool:
    """Check if adding `additional` units would exceed the tenant's quota.

    resource: "users", "documents", "api_calls"
    """
    config = get_plan_config(tenant_id)

    if resource == "users":
        limit = config["max_users"]
        if limit == -1:
            return True
        from services.tenant_service import get_tenant_users_count
        current = get_tenant_users_count(tenant_id)
        return (current + additional) <= limit

    if resource == "documents":
        limit = config["max_documents"]
        if limit == -1:
            return True
        from db.models import Document
        session = _get_session()
        try:
            current = session.query(Document).filter(Document.tenant_id == tenant_id).count()
            return (current + additional) <= limit
        finally:
            session.close()

    if resource == "api_calls":
        limit = config["max_api_calls_per_month"]
        if limit == -1:
            return True
        from services.usage_service import get_current_month_usage
        usage = get_current_month_usage(tenant_id)
        return (usage.get("api_calls", 0) + additional) <= limit

    return True


def get_features(tenant_id: int) -> dict:
    """Get all feature flags for a tenant."""
    config = get_plan_config(tenant_id)
    return config["features"]


def get_limits(tenant_id: int) -> dict:
    """Get all quotas/limits for a tenant."""
    config = get_plan_config(tenant_id)
    return {
        "max_users": config["max_users"],
        "max_documents": config["max_documents"],
        "max_api_calls_per_month": config["max_api_calls_per_month"],
    }
