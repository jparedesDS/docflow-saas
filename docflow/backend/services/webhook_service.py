"""Webhook dispatcher service — sends event notifications to external endpoints."""

import os
import time
import structlog
from datetime import datetime, timezone
from typing import Optional

logger = structlog.get_logger(__name__)


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


def _send_with_retry(url: str, body: dict, max_retries: int = 3, base_delay: float = 1.0) -> "httpx.Response":
    """Send HTTP POST with exponential backoff retry on 5xx / connection errors.

    Retries: base_delay * 2^attempt (1s, 2s, 4s).
    Does NOT retry on 4xx (client errors).
    """
    import httpx

    last_exc = None
    for attempt in range(max_retries + 1):
        try:
            with httpx.Client(timeout=10) as client:
                response = client.post(url, json=body)
            # Don't retry on 4xx — those are client errors
            if response.status_code < 500:
                return response
            # 5xx → retry
            last_exc = Exception(f"Server error {response.status_code}")
            logger.warning(
                "webhook_retry",
                url=url,
                attempt=attempt + 1,
                status_code=response.status_code,
            )
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "webhook_retry",
                url=url,
                attempt=attempt + 1,
                error=str(exc),
            )
        # Sleep with exponential backoff before next attempt (skip after last attempt)
        if attempt < max_retries:
            time.sleep(base_delay * (2 ** attempt))

    # All retries exhausted — raise last exception
    raise last_exc


def dispatch_event(tenant_id: int, event_type: str, payload: dict) -> list:
    """Find matching webhook configs and send HTTP POST to each.

    Returns a list of delivery results.
    """
    import httpx
    from db.models import WebhookConfig

    session = _get_session()
    results = []
    try:
        webhooks = session.query(WebhookConfig).filter(
            WebhookConfig.tenant_id == tenant_id,
            WebhookConfig.enabled == True,
        ).all()

        matching = []
        for wh in webhooks:
            events = wh.events or []
            if event_type in events or "*" in events:
                matching.append(_webhook_to_dict(wh))

    finally:
        session.close()

    # Send requests outside the DB session
    for wh_data in matching:
        platform = wh_data.get("platform", "generic")
        if platform == "slack":
            body = format_slack_message(event_type, payload)
        elif platform == "teams":
            body = format_teams_message(event_type, payload)
        else:
            body = format_generic_message(event_type, payload)

        try:
            response = _send_with_retry(wh_data["url"], body)
            results.append({
                "webhook_id": wh_data["id"],
                "name": wh_data["name"],
                "status_code": response.status_code,
                "success": 200 <= response.status_code < 300,
            })
            logger.info(
                "webhook_dispatched",
                webhook_id=wh_data["id"],
                event_type=event_type,
                status_code=response.status_code,
            )
        except Exception as exc:
            results.append({
                "webhook_id": wh_data["id"],
                "name": wh_data["name"],
                "status_code": None,
                "success": False,
                "error": str(exc),
            })
            logger.error(
                "webhook_dispatch_failed",
                webhook_id=wh_data["id"],
                event_type=event_type,
                error=str(exc),
            )

    return results


def format_slack_message(event_type: str, payload: dict) -> dict:
    """Format payload as a Slack Block Kit message."""
    text = f"*DocFlow Event*: `{event_type}`"
    fields = []
    for key, val in payload.items():
        fields.append({
            "type": "mrkdwn",
            "text": f"*{key}*: {val}",
        })

    blocks = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": text},
        },
    ]
    if fields:
        # Slack fields are limited to 10 per section
        for i in range(0, len(fields), 10):
            blocks.append({
                "type": "section",
                "fields": fields[i:i + 10],
            })

    return {"blocks": blocks}


def format_teams_message(event_type: str, payload: dict) -> dict:
    """Format payload as a Microsoft Teams Adaptive Card."""
    facts = [{"title": k, "value": str(v)} for k, v in payload.items()]
    return {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "content": {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "body": [
                        {
                            "type": "TextBlock",
                            "text": f"DocFlow Event: {event_type}",
                            "weight": "Bolder",
                            "size": "Medium",
                        },
                        {
                            "type": "FactSet",
                            "facts": facts,
                        },
                    ],
                },
            }
        ],
    }


def format_generic_message(event_type: str, payload: dict) -> dict:
    """Format payload as plain JSON."""
    return {
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": payload,
    }


# ── Webhook CRUD ─────────────────────────────────────────────────────────────


def list_webhooks(tenant_id: int) -> list:
    """List all webhook configs for a tenant."""
    from db.models import WebhookConfig
    session = _get_session()
    try:
        webhooks = session.query(WebhookConfig).filter(
            WebhookConfig.tenant_id == tenant_id,
        ).order_by(WebhookConfig.created_at.desc()).all()
        return [_webhook_to_dict(w) for w in webhooks]
    finally:
        session.close()


def create_webhook(tenant_id: int, data: dict) -> dict:
    """Create a new webhook config."""
    from db.models import WebhookConfig
    session = _get_session()
    try:
        wh = WebhookConfig(
            tenant_id=tenant_id,
            name=data["name"],
            url=data["url"],
            platform=data.get("platform", "generic"),
            events=data.get("events", []),
            enabled=data.get("enabled", True),
        )
        session.add(wh)
        session.commit()
        session.refresh(wh)
        return _webhook_to_dict(wh)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def update_webhook(tenant_id: int, webhook_id: int, data: dict) -> Optional[dict]:
    """Update an existing webhook config."""
    from db.models import WebhookConfig
    session = _get_session()
    try:
        wh = session.query(WebhookConfig).filter(
            WebhookConfig.id == webhook_id,
            WebhookConfig.tenant_id == tenant_id,
        ).first()
        if not wh:
            return None
        allowed = {"name", "url", "platform", "events", "enabled"}
        for key, val in data.items():
            if key in allowed:
                setattr(wh, key, val)
        session.commit()
        session.refresh(wh)
        return _webhook_to_dict(wh)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def delete_webhook(tenant_id: int, webhook_id: int) -> bool:
    """Delete a webhook config."""
    from db.models import WebhookConfig
    session = _get_session()
    try:
        wh = session.query(WebhookConfig).filter(
            WebhookConfig.id == webhook_id,
            WebhookConfig.tenant_id == tenant_id,
        ).first()
        if not wh:
            return False
        session.delete(wh)
        session.commit()
        return True
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def test_webhook(tenant_id: int, webhook_id: int) -> dict:
    """Send a test payload to a webhook endpoint."""
    import httpx
    from db.models import WebhookConfig

    session = _get_session()
    try:
        wh = session.query(WebhookConfig).filter(
            WebhookConfig.id == webhook_id,
            WebhookConfig.tenant_id == tenant_id,
        ).first()
        if not wh:
            return {"success": False, "error": "Webhook not found"}
        wh_data = _webhook_to_dict(wh)
    finally:
        session.close()

    test_payload = {
        "document_ref": "TEST-001",
        "status": "approved",
        "user": "system",
        "message": "This is a test event from DocFlow",
    }

    platform = wh_data.get("platform", "generic")
    if platform == "slack":
        body = format_slack_message("test_event", test_payload)
    elif platform == "teams":
        body = format_teams_message("test_event", test_payload)
    else:
        body = format_generic_message("test_event", test_payload)

    try:
        with httpx.Client(timeout=10) as client:
            response = client.post(wh_data["url"], json=body)
        return {
            "success": 200 <= response.status_code < 300,
            "status_code": response.status_code,
        }
    except Exception as exc:
        return {"success": False, "error": str(exc)}


def _webhook_to_dict(w) -> dict:
    return {
        "id": w.id,
        "tenant_id": w.tenant_id,
        "name": w.name,
        "url": w.url,
        "platform": w.platform,
        "events": w.events or [],
        "enabled": w.enabled,
        "created_at": w.created_at.isoformat() if w.created_at else None,
    }
