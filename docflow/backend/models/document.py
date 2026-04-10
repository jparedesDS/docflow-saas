"""Pydantic schemas for EIPSA document validation.

Aliases map Python field names to Excel column names preserved in JSONB.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


class DocumentCreate(BaseModel):
    """Schema for creating a new document."""
    model_config = ConfigDict(populate_by_name=True)

    doc_eipsa: str = Field(..., alias="Nº Doc. EIPSA")
    titulo: str = Field(..., alias="Título")
    pedido: str = Field("", alias="Nº Pedido")
    cliente: Optional[str] = Field(None, alias="Cliente")
    estado: Optional[str] = Field(None, alias="Estado")
    responsable: Optional[str] = Field(None, alias="Repsonsable")  # Intentional typo
    tipo_documento: Optional[str] = Field(None, alias="Tipo de documento")
    rev: Optional[str] = Field(None, alias="Rev.")
    supp: Optional[str] = Field(None, alias="Supp.")
    material: Optional[str] = Field(None, alias="Material")
    critico: Optional[str] = Field(None, alias="Crítico")


class DocumentUpdate(BaseModel):
    """Schema for updating a document. All fields optional."""
    model_config = ConfigDict(populate_by_name=True)

    doc_eipsa: Optional[str] = Field(None, alias="Nº Doc. EIPSA")
    titulo: Optional[str] = Field(None, alias="Título")
    pedido: Optional[str] = Field(None, alias="Nº Pedido")
    cliente: Optional[str] = Field(None, alias="Cliente")
    estado: Optional[str] = Field(None, alias="Estado")
    responsable: Optional[str] = Field(None, alias="Repsonsable")
    tipo_documento: Optional[str] = Field(None, alias="Tipo de documento")
    rev: Optional[str] = Field(None, alias="Rev.")
    supp: Optional[str] = Field(None, alias="Supp.")
    material: Optional[str] = Field(None, alias="Material")
    critico: Optional[str] = Field(None, alias="Crítico")


class DocumentResponse(BaseModel):
    """Response schema -- pass-through since JSONB structure varies."""
    model_config = ConfigDict(extra="allow")
