"""Webhooks configuration router — manage outbound webhook integrations."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from utils.auth_middleware import get_current_user, require_scope, SCOPE_WEBHOOKS

router = APIRouter()


# ── Request models ─────────────────────────────────────────────────────────


class WebhookRequest(BaseModel):
    name: str
    url: str
    platform: str = "generic"
    events: list = []
    enabled: bool = True


# ── Helpers ────────────────────────────────────────────────────────────────


def _require_admin_or_dc(current_user: dict):
    """Raise 403 if user is not admin or Document Controller."""
    if current_user.get("role") not in ("admin", "Document Controller"):
        raise HTTPException(status_code=403, detail="Admin or DC access required")


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/")
async def list_webhooks(
    current_user: dict = Depends(require_scope(SCOPE_WEBHOOKS)),
):
    """List all configured webhooks for the tenant."""
    _require_admin_or_dc(current_user)

    from services.webhook_service import list_webhooks as get_webhooks

    tenant_id = current_user.get("tenant_id", 1)
    try:
        return get_webhooks(tenant_id=tenant_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/")
async def create_webhook(
    body: WebhookRequest,
    current_user: dict = Depends(require_scope(SCOPE_WEBHOOKS)),
):
    """Create a new webhook configuration."""
    _require_admin_or_dc(current_user)

    from services.webhook_service import create_webhook as do_create

    tenant_id = current_user.get("tenant_id", 1)
    try:
        return do_create(
            tenant_id=tenant_id,
            data=body.model_dump(),
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{webhook_id}")
async def update_webhook(
    webhook_id: int,
    body: WebhookRequest,
    current_user: dict = Depends(require_scope(SCOPE_WEBHOOKS)),
):
    """Update an existing webhook configuration."""
    _require_admin_or_dc(current_user)

    from services.webhook_service import update_webhook as do_update

    tenant_id = current_user.get("tenant_id", 1)
    try:
        return do_update(
            tenant_id=tenant_id,
            webhook_id=webhook_id,
            data=body.model_dump(),
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: int,
    current_user: dict = Depends(require_scope(SCOPE_WEBHOOKS)),
):
    """Delete a webhook configuration."""
    _require_admin_or_dc(current_user)

    from services.webhook_service import delete_webhook as do_delete

    tenant_id = current_user.get("tenant_id", 1)
    try:
        do_delete(tenant_id=tenant_id, webhook_id=webhook_id)
        return {"detail": "Webhook deleted"}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{webhook_id}/test")
async def test_webhook(
    webhook_id: int,
    current_user: dict = Depends(require_scope(SCOPE_WEBHOOKS)),
):
    """Send a test payload to a webhook."""
    _require_admin_or_dc(current_user)

    from services.webhook_service import test_webhook as send_test

    tenant_id = current_user.get("tenant_id", 1)
    try:
        result = send_test(tenant_id=tenant_id, webhook_id=webhook_id)
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")
