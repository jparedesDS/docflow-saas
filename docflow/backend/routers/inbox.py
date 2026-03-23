from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional

from services import inbox_service
from services.ai_service import chat_with_context
from utils.auth_middleware import get_current_user
from utils.encryption import decrypt_value
from routers.auth import _load_users_json

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AIChatRequest(BaseModel):
    messages: List[ChatMessage]
    context_subject: Optional[str] = ""
    context_body: Optional[str] = ""


def _get_user_imap_creds(current_user: dict) -> tuple:
    users = _load_users_json()
    user_data = users.get(current_user["username"], {})
    imap_email = user_data.get("imap_email")
    imap_password = user_data.get("imap_password")
    if not imap_email or not imap_password:
        raise HTTPException(
            status_code=400,
            detail="Email no configurado. Ve a Configuración > Cuenta para vincular tu email.",
        )
    return imap_email, decrypt_value(imap_password)


@router.get("/emails")
def get_emails(
    folder: str = Query("INBOX"),
    filter: str = Query("all"),
    current_user: dict = Depends(get_current_user),
):
    imap_email, imap_password = _get_user_imap_creds(current_user)
    try:
        return inbox_service.list_emails(
            folder=folder, filter=filter,
            imap_user=imap_email, imap_pass=imap_password,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/emails/{uid}")
def get_email_detail(
    uid: str,
    folder: str = Query("INBOX"),
    current_user: dict = Depends(get_current_user),
):
    if not uid.isdigit():
        raise HTTPException(status_code=400, detail="uid debe ser numérico")
    imap_email, imap_password = _get_user_imap_creds(current_user)
    try:
        return inbox_service.get_email_detail(
            uid=uid, folder=folder,
            imap_user=imap_email, imap_pass=imap_password,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/emails/{uid}/mark-read")
def mark_read(
    uid: str,
    folder: str = Query("INBOX"),
    current_user: dict = Depends(get_current_user),
):
    if not uid.isdigit():
        raise HTTPException(status_code=400, detail="uid debe ser numérico")
    imap_email, imap_password = _get_user_imap_creds(current_user)
    try:
        return inbox_service.mark_read(
            uid=uid, folder=folder,
            imap_user=imap_email, imap_pass=imap_password,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-chat")
def ai_chat(body: AIChatRequest, current_user: dict = Depends(get_current_user)):
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
