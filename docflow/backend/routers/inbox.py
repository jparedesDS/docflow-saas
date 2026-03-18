from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional

from services import inbox_service
from services.ai_service import chat_with_context

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AIChatRequest(BaseModel):
    messages: List[ChatMessage]
    context_subject: Optional[str] = ""
    context_body: Optional[str] = ""


@router.get("/emails")
def get_emails(
    folder: str = Query("INBOX"),
    filter: str = Query("all"),
):
    try:
        return inbox_service.list_emails(folder=folder, filter=filter)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/emails/{uid}")
def get_email_detail(uid: str, folder: str = Query("INBOX")):
    if not uid.isdigit():
        raise HTTPException(status_code=400, detail="uid debe ser numérico")
    try:
        return inbox_service.get_email_detail(uid=uid, folder=folder)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/emails/{uid}/mark-read")
def mark_read(uid: str, folder: str = Query("INBOX")):
    if not uid.isdigit():
        raise HTTPException(status_code=400, detail="uid debe ser numérico")
    try:
        return inbox_service.mark_read(uid=uid, folder=folder)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-chat")
def ai_chat(body: AIChatRequest):
    try:
        messages = [{"role": m.role, "content": m.content} for m in body.messages]
        reply = chat_with_context(
            messages=messages,
            context_subject=body.context_subject or "",
            context_body=body.context_body or "",
        )
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
