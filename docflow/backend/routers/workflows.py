"""Workflows and approval requests router — requires 'workflows' feature flag."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List

from utils.auth_middleware import get_current_user
from services.plan_service import check_feature
from services import workflow_service

router = APIRouter()


# ── Request models ─────────────────────────────────────────────────────────


class WorkflowCreate(BaseModel):
    name: str
    description: str = ""
    trigger_type: str  # document_received, status_changed, manual
    conditions: list = []
    actions: list = []
    enabled: bool = True


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    conditions: Optional[list] = None
    actions: Optional[list] = None
    enabled: Optional[bool] = None


class ToggleRequest(BaseModel):
    enabled: bool


class ApprovalCreate(BaseModel):
    title: str
    description: str = ""
    document_ref: Optional[str] = None
    workflow_id: Optional[int] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None


class CommentRequest(BaseModel):
    text: str


class ResolveRequest(BaseModel):
    comment: str = ""


# ── Helpers ────────────────────────────────────────────────────────────────


def _require_workflows(tenant_id: int):
    if not check_feature(tenant_id, "workflows"):
        raise HTTPException(
            status_code=403,
            detail="Workflows feature not available on your plan. Upgrade to Pro or Enterprise.",
        )


# ── Workflow endpoints ─────────────────────────────────────────────────────


@router.get("/")
def list_workflows(current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id", 1)
    _require_workflows(tenant_id)
    return workflow_service.list_workflows(tenant_id)


@router.post("/", status_code=201)
def create_workflow(body: WorkflowCreate, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id", 1)
    _require_workflows(tenant_id)
    data = body.model_dump()
    data["created_by"] = current_user["username"]
    return workflow_service.create_workflow(tenant_id, data)


@router.get("/{workflow_id}")
def get_workflow(workflow_id: int, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id", 1)
    _require_workflows(tenant_id)
    result = workflow_service.get_workflow(tenant_id, workflow_id)
    if not result:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return result


@router.put("/{workflow_id}")
def update_workflow(workflow_id: int, body: WorkflowUpdate, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id", 1)
    _require_workflows(tenant_id)
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    result = workflow_service.update_workflow(tenant_id, workflow_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return result


@router.delete("/{workflow_id}", status_code=204)
def delete_workflow(workflow_id: int, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id", 1)
    _require_workflows(tenant_id)
    if not workflow_service.delete_workflow(tenant_id, workflow_id):
        raise HTTPException(status_code=404, detail="Workflow not found")


@router.patch("/{workflow_id}/toggle")
def toggle_workflow(workflow_id: int, body: ToggleRequest, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id", 1)
    _require_workflows(tenant_id)
    result = workflow_service.toggle_workflow(tenant_id, workflow_id, body.enabled)
    if not result:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return result


# ── Approval endpoints ─────────────────────────────────────────────────────


@router.get("/approvals/")
def list_approvals(
    status: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    tenant_id = current_user.get("tenant_id", 1)
    _require_workflows(tenant_id)
    return workflow_service.list_approval_requests(tenant_id, status=status, assigned_to=assigned_to)


@router.get("/approvals/my")
def my_approvals(current_user: dict = Depends(get_current_user)):
    """Get approval requests assigned to the current user."""
    tenant_id = current_user.get("tenant_id", 1)
    _require_workflows(tenant_id)
    return workflow_service.list_approval_requests(
        tenant_id, assigned_to=current_user["initials"]
    )


@router.post("/approvals/", status_code=201)
def create_approval(body: ApprovalCreate, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id", 1)
    _require_workflows(tenant_id)
    data = body.model_dump()
    data["requested_by"] = current_user["username"]
    return workflow_service.create_approval_request(tenant_id, data)


@router.post("/approvals/{request_id}/approve")
def approve(request_id: int, body: ResolveRequest, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id", 1)
    _require_workflows(tenant_id)
    result = workflow_service.approve_request(tenant_id, request_id, current_user["username"], body.comment)
    if not result:
        raise HTTPException(status_code=404, detail="Approval request not found or already resolved")
    return result


@router.post("/approvals/{request_id}/reject")
def reject(request_id: int, body: ResolveRequest, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id", 1)
    _require_workflows(tenant_id)
    result = workflow_service.reject_request(tenant_id, request_id, current_user["username"], body.comment)
    if not result:
        raise HTTPException(status_code=404, detail="Approval request not found or already resolved")
    return result


@router.post("/approvals/{request_id}/comment")
def comment(request_id: int, body: CommentRequest, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id", 1)
    _require_workflows(tenant_id)
    result = workflow_service.add_comment(tenant_id, request_id, current_user["username"], body.text)
    if not result:
        raise HTTPException(status_code=404, detail="Approval request not found")
    return result


@router.post("/approvals/{request_id}/escalate")
def escalate(request_id: int, body: ResolveRequest, current_user: dict = Depends(get_current_user)):
    """Escalate a pending approval request."""
    tenant_id = current_user.get("tenant_id", 1)
    _require_workflows(tenant_id)
    result = workflow_service.escalate_request(
        tenant_id, request_id, current_user["username"], body.comment
    )
    if not result:
        raise HTTPException(status_code=404, detail="Approval request not found or not pending")
    return result
