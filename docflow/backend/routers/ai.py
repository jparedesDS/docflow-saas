from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from services.ai_service import AIService
from services.document_service import DocumentService
from repositories.instances import data_repo

router = APIRouter()
ai_service = AIService()
doc_service = DocumentService(data_repo)


class EmailThreadRequest(BaseModel):
    email_thread: str
    documento: Optional[str] = "N/A"
    estado: Optional[str] = "N/A"
    cliente: Optional[str] = "N/A"


@router.post("/respond-email")
def respond_to_email(req: EmailThreadRequest):
    """Genera prompt de respuesta automática para un hilo de email."""
    return ai_service.generate_email_response(
        email_thread=req.email_thread,
        documento=req.documento,
        estado=req.estado,
        cliente=req.cliente,
    )


@router.get("/summary")
def generate_summary():
    """Genera prompt de resumen ejecutivo de todos los documentos."""
    docs = doc_service.list_all()
    return ai_service.generate_summary_prompt(docs)
