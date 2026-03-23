"""Chatbot router — conversational AI assistant with real DocFlow data."""

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from utils.auth_middleware import get_current_user

logger = structlog.get_logger("docflow.chatbot")

router = APIRouter()


# ── Singleton service instance ────────────────────────────────────────────
_service = None


def _get_service():
    global _service
    if _service is None:
        from services.chatbot_service import ChatbotService
        _service = ChatbotService()
    return _service


# ── Request / Response models ─────────────────────────────────────────────

class ChatMessage(BaseModel):
    question: str


class ChatResponse(BaseModel):
    answer: str


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/ask", response_model=ChatResponse)
async def chatbot_ask(body: ChatMessage, user: dict = Depends(get_current_user)):
    """Ask the chatbot a question. Responds with real-time DocFlow data context."""
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacia.")

    service = _get_service()
    answer = service.ask(
        question=body.question.strip(),
        user_initials=user["initials"],
        tenant_id=str(user.get("tenant_id", "")),
    )
    return ChatResponse(answer=answer)


@router.delete("/history")
async def chatbot_clear(user: dict = Depends(get_current_user)):
    """Clear the conversation history for the current user."""
    service = _get_service()
    service.clear_history(user_initials=user["initials"], tenant_id=str(user.get("tenant_id", "")))
    return {"ok": True, "message": "Historial de conversacion limpiado."}
