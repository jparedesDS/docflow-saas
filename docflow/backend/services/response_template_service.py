"""Transmittal Response Template service — manage and render email templates."""

import os
import re
from datetime import datetime, timezone
from typing import Optional

from utils.json_store import read_json, write_json

TEMPLATES_FILE = os.path.join(os.path.dirname(__file__), "..", "response_templates.json")

DEFAULT_TEMPLATES = [
    {
        "id": "tr-acknowledgement",
        "platform": "TR",
        "name": "TR - Acuse de recibo",
        "subject": "RE: {transmittal_ref} - Acuse de recibo",
        "body_html": (
            "<p>Estimados,</p>"
            "<p>Acusamos recibo del transmittal <strong>{transmittal_ref}</strong> "
            "correspondiente al pedido <strong>{pedido}</strong>.</p>"
            "<p>Documentos recibidos:</p>{docs_list}"
            "<p>Saludos cordiales,<br/>Departamento de Documentación - EIPSA</p>"
        ),
        "variables": ["transmittal_ref", "pedido", "docs_list", "fecha"],
    },
    {
        "id": "tr-status-update",
        "platform": "TR",
        "name": "TR - Actualización de estado",
        "subject": "RE: {transmittal_ref} - Estado de documentos",
        "body_html": (
            "<p>Estimados,</p>"
            "<p>Les informamos del estado de los documentos del transmittal "
            "<strong>{transmittal_ref}</strong>:</p>"
            "{status_summary}"
            "<p>Quedamos a su disposición para cualquier consulta.</p>"
            "<p>Saludos cordiales,<br/>Departamento de Documentación - EIPSA</p>"
        ),
        "variables": ["transmittal_ref", "pedido", "status_summary", "fecha"],
    },
    {
        "id": "gaia-acknowledgement",
        "platform": "GAIA",
        "name": "GAIA - Acuse de recibo",
        "subject": "RE: {transmittal_ref} - Documentación recibida",
        "body_html": (
            "<p>Estimados,</p>"
            "<p>Confirmamos la recepción de la documentación enviada vía GAIA "
            "referencia <strong>{transmittal_ref}</strong> para el pedido "
            "<strong>{pedido}</strong>.</p>"
            "{docs_list}"
            "<p>Saludos cordiales,<br/>EIPSA - Control de Documentos</p>"
        ),
        "variables": ["transmittal_ref", "pedido", "docs_list", "fecha"],
    },
    {
        "id": "generic-response",
        "platform": "ALL",
        "name": "Respuesta genérica",
        "subject": "RE: {subject}",
        "body_html": (
            "<p>Estimados,</p>"
            "<p>{message}</p>"
            "<p>Saludos cordiales,<br/>EIPSA</p>"
        ),
        "variables": ["subject", "message", "fecha"],
    },
]


def _ensure_defaults():
    """Ensure the templates file exists with defaults."""
    if not os.path.exists(TEMPLATES_FILE):
        write_json(TEMPLATES_FILE, DEFAULT_TEMPLATES)


def list_templates(tenant_id: int, platform: str = "") -> list:
    """List all response templates, optionally filtered by platform."""
    _ensure_defaults()

    if os.getenv("STORAGE_BACKEND", "excel") != "postgres":
        templates = read_json(TEMPLATES_FILE, [])
        if platform:
            templates = [t for t in templates if t.get("platform") in (platform, "ALL")]
        return templates

    from db.models import ResponseTemplate
    session = _get_session()
    try:
        query = session.query(ResponseTemplate).filter(
            ResponseTemplate.tenant_id == tenant_id,
        )
        if platform:
            query = query.filter(
                ResponseTemplate.platform.in_([platform, "ALL"]),
            )
        return [
            {
                "id": t.template_id,
                "platform": t.platform,
                "name": t.name,
                "subject": t.subject,
                "body_html": t.body_html,
                "variables": t.variables or [],
            }
            for t in query.all()
        ]
    finally:
        session.close()


def get_template(tenant_id: int, template_id: str) -> Optional[dict]:
    """Get a specific template by ID."""
    templates = list_templates(tenant_id)
    return next((t for t in templates if t["id"] == template_id), None)


def create_template(tenant_id: int, data: dict) -> dict:
    """Create a new response template."""
    if os.getenv("STORAGE_BACKEND", "excel") != "postgres":
        _ensure_defaults()
        templates = read_json(TEMPLATES_FILE, [])
        new_id = data.get("id", f"custom-{len(templates) + 1}")
        template = {
            "id": new_id,
            "platform": data.get("platform", "ALL"),
            "name": data["name"],
            "subject": data["subject"],
            "body_html": data["body_html"],
            "variables": data.get("variables", []),
        }
        templates.append(template)
        write_json(TEMPLATES_FILE, templates)
        return template

    from db.models import ResponseTemplate
    session = _get_session()
    try:
        template_id = data.get("id", f"custom-{int(datetime.now(timezone.utc).timestamp())}")
        t = ResponseTemplate(
            tenant_id=tenant_id,
            template_id=template_id,
            platform=data.get("platform", "ALL"),
            name=data["name"],
            subject=data["subject"],
            body_html=data["body_html"],
            variables=data.get("variables", []),
        )
        session.add(t)
        session.commit()
        return {
            "id": t.template_id,
            "platform": t.platform,
            "name": t.name,
            "subject": t.subject,
            "body_html": t.body_html,
            "variables": t.variables or [],
        }
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def update_template(tenant_id: int, template_id: str, data: dict) -> Optional[dict]:
    """Update an existing response template."""
    if os.getenv("STORAGE_BACKEND", "excel") != "postgres":
        _ensure_defaults()
        templates = read_json(TEMPLATES_FILE, [])
        for i, t in enumerate(templates):
            if t["id"] == template_id:
                templates[i] = {**t, **{k: v for k, v in data.items() if v is not None}}
                write_json(TEMPLATES_FILE, templates)
                return templates[i]
        return None

    from db.models import ResponseTemplate
    session = _get_session()
    try:
        t = session.query(ResponseTemplate).filter(
            ResponseTemplate.tenant_id == tenant_id,
            ResponseTemplate.template_id == template_id,
        ).first()
        if not t:
            return None
        if "name" in data:
            t.name = data["name"]
        if "subject" in data:
            t.subject = data["subject"]
        if "body_html" in data:
            t.body_html = data["body_html"]
        if "platform" in data:
            t.platform = data["platform"]
        if "variables" in data:
            t.variables = data["variables"]
        session.commit()
        return {
            "id": t.template_id,
            "platform": t.platform,
            "name": t.name,
            "subject": t.subject,
            "body_html": t.body_html,
            "variables": t.variables or [],
        }
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def delete_template(tenant_id: int, template_id: str) -> bool:
    """Delete a response template."""
    if os.getenv("STORAGE_BACKEND", "excel") != "postgres":
        _ensure_defaults()
        templates = read_json(TEMPLATES_FILE, [])
        original_len = len(templates)
        templates = [t for t in templates if t["id"] != template_id]
        if len(templates) < original_len:
            write_json(TEMPLATES_FILE, templates)
            return True
        return False

    from db.models import ResponseTemplate
    session = _get_session()
    try:
        t = session.query(ResponseTemplate).filter(
            ResponseTemplate.tenant_id == tenant_id,
            ResponseTemplate.template_id == template_id,
        ).first()
        if not t:
            return False
        session.delete(t)
        session.commit()
        return True
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def render_template(template_id: str, variables: dict, tenant_id: int = 0) -> dict:
    """Render a template by replacing {variable} placeholders."""
    template = get_template(tenant_id, template_id)
    if not template:
        return {"error": "Template not found"}

    # Add default variables
    variables.setdefault("fecha", datetime.now(timezone.utc).strftime("%Y-%m-%d"))

    subject = template["subject"]
    body = template["body_html"]

    for key, value in variables.items():
        placeholder = "{" + key + "}"
        subject = subject.replace(placeholder, str(value))
        body = body.replace(placeholder, str(value))

    return {
        "subject": subject,
        "body_html": body,
        "template_id": template_id,
    }


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()
