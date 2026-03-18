from __future__ import annotations

import uuid
from typing import Literal, Optional

from pydantic import BaseModel, Field


class EmailTemplateCreate(BaseModel):
    nombre: str
    asunto: str
    cuerpo_html: str
    variables: list[str] = []
    tipo: Literal["claim", "transmittal", "alerta"]


class EmailTemplate(EmailTemplateCreate):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)


class EmailTemplateUpdate(BaseModel):
    nombre: Optional[str] = None
    asunto: Optional[str] = None
    cuerpo_html: Optional[str] = None
    variables: Optional[list[str]] = None
    tipo: Optional[Literal["claim", "transmittal", "alerta"]] = None
