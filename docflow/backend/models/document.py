from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DocumentBase(BaseModel):
    title: str
    doc_type: str  # factura, orden_compra, remision, cotizacion
    client: Optional[str] = None
    provider: Optional[str] = None
    amount: Optional[float] = None
    currency: str = "MXN"


class DocumentCreate(DocumentBase):
    pass


class Document(DocumentBase):
    id: int
    status: str = "draft"
    created_at: datetime = datetime.now()

    class Config:
        from_attributes = True
