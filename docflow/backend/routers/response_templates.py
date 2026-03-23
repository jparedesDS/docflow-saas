"""Response Templates router — CRUD + render for transmittal reply templates."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from utils.auth_middleware import get_current_user
from services.response_template_service import (
    list_templates,
    get_template,
    create_template,
    update_template,
    delete_template,
    render_template,
)

router = APIRouter()


class TemplateCreate(BaseModel):
    id: Optional[str] = None
    platform: str = "ALL"
    name: str
    subject: str
    body_html: str
    variables: list = []


class TemplateUpdate(BaseModel):
    platform: Optional[str] = None
    name: Optional[str] = None
    subject: Optional[str] = None
    body_html: Optional[str] = None
    variables: Optional[list] = None


class RenderRequest(BaseModel):
    template_id: str
    variables: dict = {}


@router.get("/")
def list_response_templates(
    platform: str = "",
    user=Depends(get_current_user),
):
    return list_templates(user["tenant_id"], platform)


@router.get("/{template_id}")
def get_response_template(template_id: str, user=Depends(get_current_user)):
    t = get_template(user["tenant_id"], template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t


@router.post("/")
def create_response_template(body: TemplateCreate, user=Depends(get_current_user)):
    return create_template(user["tenant_id"], body.model_dump())


@router.put("/{template_id}")
def update_response_template(
    template_id: str,
    body: TemplateUpdate,
    user=Depends(get_current_user),
):
    result = update_template(user["tenant_id"], template_id, body.model_dump(exclude_none=True))
    if not result:
        raise HTTPException(status_code=404, detail="Template not found")
    return result


@router.delete("/{template_id}")
def delete_response_template(template_id: str, user=Depends(get_current_user)):
    ok = delete_template(user["tenant_id"], template_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"ok": True}


@router.post("/render")
def render_response_template(body: RenderRequest, user=Depends(get_current_user)):
    result = render_template(body.template_id, body.variables, user["tenant_id"])
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
