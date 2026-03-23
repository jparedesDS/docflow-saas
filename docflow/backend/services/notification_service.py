"""Servicio de notificaciones / log de actividad.
Almacena en memoria las acciones realizadas (reclamaciones, exportaciones, etc.)
para trazabilidad dentro de la sesión. Incluye SSE push para notificaciones en tiempo real.
"""

import asyncio
import json
import os
from datetime import datetime
from typing import AsyncGenerator, Dict, Any, List, Optional

import structlog

from utils.json_store import read_json, write_json

logger = structlog.get_logger("docflow.notifications")

# Archivo local para persistir entre reinicios del servidor
_LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "notifications_log.json")


class NotificationService:
    def __init__(self):
        self._log: List[Dict[str, Any]] = []
        self._sse_queues: Dict[str, List[asyncio.Queue]] = {}
        self._load()

    def _load(self):
        self._log = read_json(_LOG_PATH, default=[])

    def _save(self):
        try:
            write_json(_LOG_PATH, self._log[-500:])
        except Exception:
            pass

    def publish_event(
        self,
        tipo: str,
        titulo: str,
        detalle: str = "",
        target_users: Optional[List[str]] = None,
    ):
        """Push an SSE event to connected clients.

        Args:
            tipo: Event type (reclamacion, exportacion, sistema, etc.)
            titulo: Short title for the notification.
            detalle: Optional detail text.
            target_users: List of user initials to notify. None = broadcast to all.
        """
        event_data = {
            "tipo": tipo,
            "titulo": titulo,
            "detalle": detalle,
            "timestamp": datetime.now().isoformat(),
        }

        targets = target_users if target_users else list(self._sse_queues.keys())

        for initials in targets:
            queues = self._sse_queues.get(initials, [])
            for queue in queues:
                try:
                    queue.put_nowait(event_data)
                except asyncio.QueueFull:
                    logger.warning("sse_queue_full", user=initials)

    def add(self, tipo: str, titulo: str, detalle: str = "", metadata: Optional[Dict] = None):
        entry = {
            "id": len(self._log) + 1,
            "timestamp": datetime.now().isoformat(),
            "tipo": tipo,
            "titulo": titulo,
            "detalle": detalle,
            "metadata": metadata or {},
        }
        self._log.append(entry)
        self._save()

        # Push SSE event to connected clients
        target_users = None
        if metadata and metadata.get("target_users"):
            target_users = metadata["target_users"]
        self.publish_event(tipo, titulo, detalle, target_users=target_users)

        return entry

    def get_all(self, tipo: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        items = self._log
        if tipo:
            items = [i for i in items if i["tipo"] == tipo]
        return list(reversed(items[-limit:]))

    def get_stats(self) -> Dict[str, Any]:
        today = datetime.now().strftime("%Y-%m-%d")
        today_items = [i for i in self._log if i["timestamp"].startswith(today)]
        tipos = {}
        for item in self._log:
            t = item["tipo"]
            tipos[t] = tipos.get(t, 0) + 1
        return {
            "total": len(self._log),
            "hoy": len(today_items),
            "por_tipo": tipos,
        }

    def clear(self):
        self._log = []
        self._save()

    async def stream_events(self, user_initials: str) -> AsyncGenerator[str, None]:
        """Yield SSE-formatted events for a specific user. Blocks until events arrive."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=64)
        self._sse_queues.setdefault(user_initials, []).append(queue)
        logger.info("sse_connected", user=user_initials)
        try:
            # Send initial keepalive
            yield ": connected\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive comment to prevent connection timeout
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            queues = self._sse_queues.get(user_initials, [])
            if queue in queues:
                queues.remove(queue)
            if not queues:
                self._sse_queues.pop(user_initials, None)
            logger.info("sse_disconnected", user=user_initials)


# Singleton
notification_service = NotificationService()
