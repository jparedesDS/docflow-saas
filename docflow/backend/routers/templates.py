from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.email_template import (
    EmailTemplate,
    EmailTemplateCreate,
    EmailTemplateUpdate,
)
from services import template_service

router = APIRouter(prefix="/templates", tags=["Email Templates"])


@router.get("/", response_model=list[EmailTemplate])
def list_all():
    return template_service.list_templates()


@router.post("/", response_model=EmailTemplate, status_code=201)
def create(data: EmailTemplateCreate):
    return template_service.create_template(data)


@router.put("/{template_id}", response_model=EmailTemplate)
def update(template_id: str, data: EmailTemplateUpdate):
    result = template_service.update_template(template_id, data)
    if result is None:
        raise HTTPException(404, "Template not found")
    return result


@router.delete("/{template_id}", status_code=204)
def delete(template_id: str):
    if not template_service.delete_template(template_id):
        raise HTTPException(404, "Template not found")


@router.post("/{template_id}/preview")
def preview(template_id: str, variables: dict[str, str]):
    result = template_service.render_template(template_id, variables)
    if result is None:
        raise HTTPException(404, "Template not found")
    return result
