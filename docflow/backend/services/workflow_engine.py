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
            wf_results = []
            for action in actions:
                try:
                    result = execute_action(action, event_data, tenant_id)
                    action_result = {
                        "workflow_id": wf.id,
                        "workflow_name": wf.name,
                        "action_type": action.get("type"),
                        "success": True,
                        "result": result,
                    }
                    results.append(action_result)
                    wf_results.append(action_result)
                    log.info("workflow_action_executed", action_type=action.get("type"))
                except Exception as exc:
                    action_result = {
                        "workflow_id": wf.id,
                        "workflow_name": wf.name,
                        "action_type": action.get("type"),
                        "success": False,
                        "error": str(exc),
                    }
                    results.append(action_result)
                    wf_results.append(action_result)
                    log.error("workflow_action_failed", action_type=action.get("type"), error=str(exc))

            # Persist execution record
            actions_total = len(actions)
            actions_succeeded = sum(1 for r in wf_results if r.get("success"))
            exec_status = "success" if actions_succeeded == actions_total else "failed" if actions_succeeded == 0 else "partial"

            try:
                from db.models import WorkflowExecution
                execution = WorkflowExecution(
                    tenant_id=tenant_id,
                    workflow_id=wf.id,
                    trigger_event=event_type,
                    event_data=event_data,
                    results=wf_results,
                    status=exec_status,
                    actions_total=actions_total,
                    actions_succeeded=actions_succeeded,
                )
                session.add(execution)
                session.commit()
            except Exception as exc:
                session.rollback()
                log.warning("workflow_execution_persist_failed", error=str(exc))
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
    """Change document status via document_service."""
    new_status = action.get("new_status", "")
    document_ref = data.get("document_ref", "")
    if not new_status or not document_ref:
        return {"action": "change_status", "applied": False, "reason": "missing new_status or document_ref"}

    from repositories.instances import data_repo
    from services.document_service import DocumentService
    svc = DocumentService(data_repo)
    result = svc.update(document_ref, {"Estado": new_status})

    logger.info("workflow_change_status", document_ref=document_ref, new_status=new_status, applied=bool(result))
    return {
        "action": "change_status",
        "document_ref": document_ref,
        "new_status": new_status,
        "applied": bool(result),
    }


def _action_send_email(action: dict, data: dict, tenant_id: int) -> dict:
    """Send email via SMTP service."""
    to = action.get("to", "")
    subject = action.get("subject", "Workflow notification")
    body = action.get("body", "")

    # Substitute placeholders
    for key, val in data.items():
        subject = subject.replace(f"{{{{{key}}}}}", str(val))
        body = body.replace(f"{{{{{key}}}}}", str(val))
        if isinstance(to, str):
            to = to.replace(f"{{{{{key}}}}}", str(val))

    recipients = [r.strip() for r in to.split(",") if r.strip()] if isinstance(to, str) else to

    if not recipients:
        return {"action": "send_email", "sent": False, "reason": "no recipients"}

    try:
        from services.smtp_service import send_html_email
        html_body = f"<div style='font-family:Arial;padding:20px'>{body or subject}</div>"
        send_html_email(to=recipients, cc=[], subject=subject, html_body=html_body)
        sent = True
    except Exception as exc:
        logger.warning("workflow_email_failed", to=recipients, error=str(exc))
        sent = False

    return {"action": "send_email", "to": recipients, "subject": subject, "sent": sent}


def execute_workflow_actions(tenant_id: int, workflow_id: int, workflow_dict: dict, event_data: dict) -> list:
    """Execute all actions of a workflow manually. Persists execution record."""
    actions = workflow_dict.get("actions", [])
    wf_results = []

    for action in actions:
        try:
            result = execute_action(action, event_data, tenant_id)
            wf_results.append({
                "action_type": action.get("type"),
                "success": True,
                "result": result,
            })
        except Exception as exc:
            wf_results.append({
                "action_type": action.get("type"),
                "success": False,
                "error": str(exc),
            })

    # Persist execution
    actions_total = len(actions)
    actions_succeeded = sum(1 for r in wf_results if r.get("success"))
    status = "success" if actions_succeeded == actions_total else "failed" if actions_succeeded == 0 else "partial"

    session = _get_session()
    try:
        from db.models import WorkflowExecution
        execution = WorkflowExecution(
            tenant_id=tenant_id,
            workflow_id=workflow_id,
            trigger_event="manual",
            event_data=event_data,
            results=wf_results,
            status=status,
            actions_total=actions_total,
            actions_succeeded=actions_succeeded,
        )
        session.add(execution)
        session.commit()
    except Exception as exc:
        session.rollback()
        logger.warning("manual_execution_persist_failed", error=str(exc))
    finally:
        session.close()

    return wf_results
