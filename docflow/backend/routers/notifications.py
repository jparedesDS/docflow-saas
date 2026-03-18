from fastapi import APIRouter, Query
from typing import Optional
from services.notification_service import notification_service

router = APIRouter()


@router.get("/")
def get_notifications(tipo: Optional[str] = Query(None), limit: int = Query(100)):
    """Lista de notificaciones / log de actividad."""
    return notification_service.get_all(tipo=tipo, limit=limit)


@router.get("/stats")
def get_notification_stats():
    """Estadísticas de notificaciones."""
    return notification_service.get_stats()
