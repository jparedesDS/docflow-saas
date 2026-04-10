"""Workflow and approval request service — tenant-aware CRUD + escalation."""

import os
from datetime import datetime, timezone
from typing import Optional

STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "excel")


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


# ── Workflow CRUD ──────────────────────────────────────────────────────────


def list_workflows(tenant_id: int) -> list:
    from db.models import Workflow
    session = _get_session()
    try:
        workflows = session.query(Workflow).filter(
            Workflow.tenant_id == tenant_id,
        ).order_by(Workflow.created_at.desc()).all()
        return [_workflow_to_dict(w) for w in workflows]
    finally:
        session.close()


def get_workflow(tenant_id: int, workflow_id: int) -> Optional[dict]:
    from db.models import Workflow
    session = _get_session()
    try:
        w = session.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.tenant_id == tenant_id,
        ).first()
        return _workflow_to_dict(w) if w else None
    finally:
        session.close()


def create_workflow(tenant_id: int, data: dict) -> dict:
    from db.models import Workflow
    session = _get_session()
    try:
        w = Workflow(
            tenant_id=tenant_id,
            name=data["name"],
            description=data.get("description", ""),
            trigger_type=data["trigger_type"],
            conditions=data.get("conditions", []),
            actions=data.get("actions", []),
            enabled=data.get("enabled", True),
            created_by=data.get("created_by"),
        )
        session.add(w)
        session.commit()
        session.refresh(w)
        return _workflow_to_dict(w)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def update_workflow(tenant_id: int, workflow_id: int, data: dict) -> Optional[dict]:
    from db.models import Workflow
    session = _get_session()
    try:
        w = session.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.tenant_id == tenant_id,
        ).first()
        if not w:
            return None
        allowed = {"name", "description", "trigger_type", "conditions", "actions", "enabled"}
        for key, val in data.items():
            if key in allowed:
                setattr(w, key, val)
        session.commit()
        session.refresh(w)
        return _workflow_to_dict(w)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def delete_workflow(tenant_id: int, workflow_id: int) -> bool:
    from db.models import Workflow
    session = _get_session()
    try:
        w = session.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.tenant_id == tenant_id,
        ).first()
        if not w:
            return False
        session.delete(w)
        session.commit()
        return True
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def toggle_workflow(tenant_id: int, workflow_id: int, enabled: bool) -> Optional[dict]:
    from db.models import Workflow
    session = _get_session()
    try:
        w = session.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.tenant_id == tenant_id,
        ).first()
        if not w:
            return None
        w.enabled = enabled
        session.commit()
        session.refresh(w)
        return _workflow_to_dict(w)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _workflow_to_dict(w) -> dict:
    return {
        "id": w.id,
        "tenant_id": w.tenant_id,
        "name": w.name,
        "description": w.description,
        "trigger_type": w.trigger_type,
        "conditions": w.conditions or [],
        "actions": w.actions or [],
        "enabled": w.enabled,
        "created_by": w.created_by,
        "created_at": w.created_at.isoformat() if w.created_at else None,
        "updated_at": w.updated_at.isoformat() if w.updated_at else None,
    }


# ── Approval Requests ──────────────────────────────────────────────────────


def list_approval_requests(
    tenant_id: int,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
) -> list:
    from db.models import ApprovalRequest
    session = _get_session()
    try:
        query = session.query(ApprovalRequest).filter(
            ApprovalRequest.tenant_id == tenant_id,
        )
        if status:
            query = query.filter(ApprovalRequest.status == status)
        if assigned_to:
            query = query.filter(ApprovalRequest.assigned_to == assigned_to)
        requests = query.order_by(ApprovalRequest.created_at.desc()).all()
        return [_approval_to_dict(r) for r in requests]
    finally:
        session.close()


def create_approval_request(tenant_id: int, data: dict) -> dict:
    from db.models import ApprovalRequest
    session = _get_session()
    try:
        req = ApprovalRequest(
            tenant_id=tenant_id,
            workflow_id=data.get("workflow_id"),
            title=data["title"],
            description=data.get("description", ""),
            document_ref=data.get("document_ref"),
            requested_by=data["requested_by"],
            assigned_to=data.get("assigned_to"),
            due_date=data.get("due_date"),
        )
        session.add(req)
        session.commit()
        session.refresh(req)
        return _approval_to_dict(req)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def approve_request(tenant_id: int, request_id: int, by: str, comment: str = "") -> Optional[dict]:
    return _resolve_request(tenant_id, request_id, "approved", by, comment)


def reject_request(tenant_id: int, request_id: int, by: str, comment: str = "") -> Optional[dict]:
    return _resolve_request(tenant_id, request_id, "rejected", by, comment)


def _resolve_request(
    tenant_id: int, request_id: int, new_status: str, by: str, comment: str
) -> Optional[dict]:
    from db.models import ApprovalRequest
    session = _get_session()
    try:
        req = session.query(ApprovalRequest).filter(
            ApprovalRequest.id == request_id,
            ApprovalRequest.tenant_id == tenant_id,
        ).first()
        if not req:
            return None
        if req.status != "pending":
            return None
        req.status = new_status
        req.resolved_at = datetime.now(timezone.utc)
        if comment:
            comments = list(req.comments or [])
            comments.append({
                "by": by,
                "text": comment,
                "action": new_status,
                "at": datetime.now(timezone.utc).isoformat(),
            })
            req.comments = comments
        session.commit()
        session.refresh(req)
        return _approval_to_dict(req)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def add_comment(tenant_id: int, request_id: int, by: str, text: str) -> Optional[dict]:
    from db.models import ApprovalRequest
    session = _get_session()
    try:
        req = session.query(ApprovalRequest).filter(
            ApprovalRequest.id == request_id,
            ApprovalRequest.tenant_id == tenant_id,
        ).first()
        if not req:
            return None
        comments = list(req.comments or [])
        comments.append({
            "by": by,
            "text": text,
            "action": "comment",
            "at": datetime.now(timezone.utc).isoformat(),
        })
        req.comments = comments
        session.commit()
        session.refresh(req)
        return _approval_to_dict(req)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def escalate_request(tenant_id: int, request_id: int, by: str, reason: str = "") -> Optional[dict]:
    """Escalate a pending approval request — marks as 'escalated' and adds comment."""
    from db.models import ApprovalRequest
    session = _get_session()
    try:
        req = session.query(ApprovalRequest).filter(
            ApprovalRequest.id == request_id,
            ApprovalRequest.tenant_id == tenant_id,
        ).first()
        if not req or req.status != "pending":
            return None
        req.status = "escalated"
        comments = list(req.comments or [])
        comments.append({
            "by": by,
            "text": reason or "Escalated",
            "action": "escalated",
            "at": datetime.now(timezone.utc).isoformat(),
        })
        req.comments = comments
        session.commit()
        session.refresh(req)
        return _approval_to_dict(req)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _approval_to_dict(r) -> dict:
    return {
        "id": r.id,
        "tenant_id": r.tenant_id,
        "workflow_id": r.workflow_id,
        "title": r.title,
        "description": r.description,
        "document_ref": r.document_ref,
        "status": r.status,
        "requested_by": r.requested_by,
        "assigned_to": r.assigned_to,
        "comments": r.comments or [],
        "due_date": r.due_date.isoformat() if r.due_date else None,
        "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }
