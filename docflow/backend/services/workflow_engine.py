"""Workflow execution engine — evaluates triggers, conditions, and executes actions."""

import os
import structlog
from datetime import datetime, timezone
from typing import Optional

logger = structlog.get_logger(__name__)


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


def on_event(tenant_id: int, event_type: str, event_data: dict) -> list:
    """Find enabled workflows matching the trigger, evaluate conditions, execute actions.

    Returns a list of action results for each matched workflow.
    """
    from db.models import Workflow
    session = _get_session()
    results = []
    try:
        workflows = session.query(Workflow).filter(
            Workflow.tenant_id == tenant_id,
            Workflow.trigger_type == event_type,
            Workflow.enabled == True,
        ).all()

        for wf in workflows:
            log = logger.bind(workflow_id=wf.id, workflow_name=wf.name, event_type=event_type)
            conditions = wf.conditions or []
            if not evaluate_conditions(conditions, event_data):
                log.info("workflow_conditions_not_met")
                continue

            log.info("workflow_triggered")
            actions = wf.actions or []
            for action in actions:
                try:
                    result = execute_action(action, event_data, tenant_id)
                    results.append({
                        "workflow_id": wf.id,
                        "workflow_name": wf.name,
                        "action_type": action.get("type"),
                        "success": True,
                        "result": result,
                    })
                    log.info("workflow_action_executed", action_type=action.get("type"))
                except Exception as exc:
                    results.append({
                        "workflow_id": wf.id,
                        "workflow_name": wf.name,
                        "action_type": action.get("type"),
                        "success": False,
                        "error": str(exc),
                    })
                    log.error("workflow_action_failed", action_type=action.get("type"), error=str(exc))
    finally:
        session.close()

    return results


def evaluate_conditions(conditions: list, data: dict) -> bool:
    """Evaluate a list of conditions against event data. All conditions must pass (AND logic).

    Supported operators: equals, not_equals, contains, greater_than, less_than.
    """
    if not conditions:
        return True

    for condition in conditions:
        field = condition.get("field", "")
        operator = condition.get("operator", "equals")
        expected = condition.get("value")
        actual = data.get(field)

        if operator == "equals":
            if str(actual) != str(expected):
                return False
        elif operator == "not_equals":
            if str(actual) == str(expected):
                return False
        elif operator == "contains":
            if expected is None or actual is None:
                return False
            if str(expected) not in str(actual):
                return False
        elif operator == "greater_than":
            try:
                if float(actual) <= float(expected):
                    return False
            except (TypeError, ValueError):
                return False
        elif operator == "less_than":
            try:
                if float(actual) >= float(expected):
                    return False
            except (TypeError, ValueError):
                return False
        else:
            logger.warning("unknown_condition_operator", operator=operator)
            return False

    return True


def execute_action(action: dict, data: dict, tenant_id: int) -> dict:
    """Execute a single workflow action.

    Supported types: notify, create_approval, change_status, send_email.
    """
    action_type = action.get("type", "")

    if action_type == "notify":
        return _action_notify(action, data, tenant_id)
    elif action_type == "create_approval":
        return _action_create_approval(action, data, tenant_id)
    elif action_type == "change_status":
        return _action_change_status(action, data, tenant_id)
    elif action_type == "send_email":
        return _action_send_email(action, data, tenant_id)
    else:
        raise ValueError(f"Unknown action type: {action_type}")


def _action_notify(action: dict, data: dict, tenant_id: int) -> dict:
    """Create a Notification record in the database."""
    from db.models import Notification
    session = _get_session()
    try:
        title = action.get("title", "Workflow notification")
        detail = action.get("detail", "")

        # Substitute placeholders from data
        for key, val in data.items():
            title = title.replace(f"{{{{{key}}}}}", str(val))
            detail = detail.replace(f"{{{{{key}}}}}", str(val))

        notification = Notification(
            tenant_id=tenant_id,
            tipo="workflow",
            titulo=title,
            detalle=detail,
            metadata_={"source": "workflow_engine", "event_data": data},
        )
        session.add(notification)
        session.commit()
        return {"notification_id": notification.id, "title": title}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _action_create_approval(action: dict, data: dict, tenant_id: int) -> dict:
    """Create an approval request via workflow_service."""
    from services.workflow_service import create_approval_request

    approval_data = {
        "title": action.get("title", f"Approval for {data.get('document_ref', 'N/A')}"),
        "description": action.get("description", ""),
        "document_ref": data.get("document_ref"),
        "requested_by": data.get("user_initials", "system"),
        "assigned_to": action.get("assigned_to"),
        "workflow_id": action.get("workflow_id"),
    }
    result = create_approval_request(tenant_id, approval_data)
    return {"approval_id": result.get("id"), "title": approval_data["title"]}


def _action_change_status(action: dict, data: dict, tenant_id: int) -> dict:
    """Log the intended status change. Does not modify data directly — caller decides."""
    new_status = action.get("new_status", "")
    document_ref = data.get("document_ref", "")
    logger.info(
        "workflow_change_status",
        tenant_id=tenant_id,
        document_ref=document_ref,
        new_status=new_status,
    )
    return {
        "action": "change_status",
        "document_ref": document_ref,
        "new_status": new_status,
        "applied": False,  # Caller must apply the change
    }


def _action_send_email(action: dict, data: dict, tenant_id: int) -> dict:
    """Log the email action. Actual sending requires SMTP configuration."""
    to = action.get("to", "")
    subject = action.get("subject", "Workflow notification")

    # Substitute placeholders
    for key, val in data.items():
        subject = subject.replace(f"{{{{{key}}}}}", str(val))
        if isinstance(to, str):
            to = to.replace(f"{{{{{key}}}}}", str(val))

    logger.info(
        "workflow_send_email",
        tenant_id=tenant_id,
        to=to,
        subject=subject,
    )
    return {
        "action": "send_email",
        "to": to,
        "subject": subject,
        "sent": False,  # Actual send requires SMTP config
    }
