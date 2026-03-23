from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from jose import JWTError
from typing import Optional

from services.auth_service import verify_token
from services.notification_service import notification_service
from utils.auth_middleware import get_current_user

router = APIRouter()


@router.get("/")
def get_notifications(tipo: Optional[str] = Query(None), limit: int = Query(100), user=Depends(get_current_user)):
    """Lista de notificaciones / log de actividad."""
    return notification_service.get_all(tipo=tipo, limit=limit)


@router.get("/stats")
def get_notification_stats(user=Depends(get_current_user)):
    """Estadísticas de notificaciones."""
    return notification_service.get_stats()


@router.get("/stream")
async def notification_stream(token: str = Query(...)):
    """SSE endpoint for real-time notifications.

    Uses token as query param because EventSource API cannot send custom headers.
    """
    try:
        payload = verify_token(token)
    except (JWTError, Exception):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_initials = payload.get("initials", "UNKNOWN")
    return StreamingResponse(
        notification_service.stream_events(user_initials),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
