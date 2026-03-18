from __future__ import annotations

from pathlib import Path
from typing import Optional

from models.email_template import (
    EmailTemplate,
    EmailTemplateCreate,
    EmailTemplateUpdate,
)
from utils.json_store import read_json, write_json

TEMPLATES_FILE = Path(__file__).resolve().parent.parent / "email_templates.json"

DEFAULT_TEMPLATES: list[dict] = [
    {
        "id": "default-claim",
        "nombre": "Reclamación estándar",
        "asunto": "Reclamación documentación — {pedido}",
        "cuerpo_html": (
            "<p>Estimado/a {contacto},</p>"
            "<p>Le informamos de que la siguiente documentación del pedido "
            "<b>{pedido}</b> se encuentra pendiente de recepción:</p>"
            "<ul><li>{documentos}</li></ul>"
            "<p>Rogamos nos la hagan llegar a la mayor brevedad.</p>"
            "<p>Un saludo,<br/>{remitente}</p>"
        ),
        "variables": ["contacto", "pedido", "documentos", "remitente"],
        "tipo": "claim",
    },
    {
        "id": "default-transmittal",
        "nombre": "Notificación transmittal",
        "asunto": "Transmittal {tr_number} — {cliente}",
        "cuerpo_html": (
            "<p>Se ha recibido el transmittal <b>{tr_number}</b> del cliente "
            "<b>{cliente}</b>.</p>"
            "<p>Documentos incluidos:</p><ul><li>{documentos}</li></ul>"
            "<p>Responsable asignado: {responsable}</p>"
        ),
        "variables": ["tr_number", "cliente", "documentos", "responsable"],
        "tipo": "transmittal",
    },
]


def _load() -> list[dict]:
    if not TEMPLATES_FILE.exists():
        _save(DEFAULT_TEMPLATES)
        return list(DEFAULT_TEMPLATES)
    return read_json(str(TEMPLATES_FILE), default=DEFAULT_TEMPLATES)


def _save(data: list[dict]) -> None:
    write_json(str(TEMPLATES_FILE), data)


def list_templates() -> list[EmailTemplate]:
    return [EmailTemplate(**t) for t in _load()]


def get_template(template_id: str) -> Optional[EmailTemplate]:
    for t in _load():
        if t["id"] == template_id:
            return EmailTemplate(**t)
    return None


def create_template(data: EmailTemplateCreate) -> EmailTemplate:
    tpl = EmailTemplate(**data.model_dump())
    templates = _load()
    templates.append(tpl.model_dump())
    _save(templates)
    return tpl


def update_template(template_id: str, data: EmailTemplateUpdate) -> Optional[EmailTemplate]:
    templates = _load()
    for i, t in enumerate(templates):
        if t["id"] == template_id:
            updates = data.model_dump(exclude_none=True)
            t.update(updates)
            templates[i] = t
            _save(templates)
            return EmailTemplate(**t)
    return None


def delete_template(template_id: str) -> bool:
    templates = _load()
    new = [t for t in templates if t["id"] != template_id]
    if len(new) == len(templates):
        return False
    _save(new)
    return True


def render_template(template_id: str, variables: dict[str, str]) -> Optional[dict]:
    tpl = get_template(template_id)
    if tpl is None:
        return None
    asunto = tpl.asunto
    cuerpo = tpl.cuerpo_html
    for key, value in variables.items():
        placeholder = "{" + key + "}"
        asunto = asunto.replace(placeholder, value)
        cuerpo = cuerpo.replace(placeholder, value)
    return {"asunto": asunto, "cuerpo_html": cuerpo}
