"""Servicio de notificaciones / log de actividad.
Almacena en memoria las acciones realizadas (reclamaciones, exportaciones, etc.)
para trazabilidad dentro de la sesión. Incluye SSE push para notificaciones en tiempo real.

Tenant-aware: when STORAGE_BACKEND=postgres, notifications are stored in the ORM
Notification model filtered by tenant_id. In Excel mode, the legacy JSON file is used.
"""

import asyncio
import json
import os
from datetime import datetime
from typing import AsyncGenerator, Dict, Any, List, Optional

import structlog

from utils.json_store import read_json, write_json

logger = structlog.get_logger("docflow.notifications")

# Storage mode check
_IS_POSTGRES = os.getenv("STORAGE_BACKEND", "excel") == "postgres"

# Archivo local para persistir entre reinicios del servidor (Excel mode)
_LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "notifications_log.json")


def _get_db_session():
    """Get a new database session for postgres mode."""
    from db.database import SessionLocal
    return SessionLocal()


class NotificationService:
    def __init__(self):
        self._log: List[Dict[str, Any]] = []
        self._sse_queues: Dict[str, List[asyncio.Queue]] = {}
        if not _IS_POSTGRES:
            self._load()

    # ── JSON file persistence (Excel mode) ────────────────────────────────

    def _load(self):
        self._log = read_json(_LOG_PATH, default=[])

    def _save(self):
        try:
            write_json(_LOG_PATH, self._log[-500:])
        except Exception:
            pass

    # ── SSE push (shared by both modes) ───────────────────────────────────

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

    # ── Add notification ──────────────────────────────────────────────────

    def add(
        self,
        tipo: str,
        titulo: str,
        detalle: str = "",
        metadata: Optional[Dict] = None,
        tenant_id: Optional[int] = None,
    ):
        """Add a notification. In postgres mode, persists to Notification ORM model."""
        if _IS_POSTGRES and tenant_id is not None:
            return self._add_postgres(tipo, titulo, detalle, metadata or {}, tenant_id)
        return self._add_json(tipo, titulo, detalle, metadata)

    def _add_json(self, tipo: str, titulo: str, detalle: str, metadata: Optional[Dict]):
        """Legacy JSON-file add (Excel mode)."""
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

    def _add_postgres(
        self, tipo: str, titulo: str, detalle: str, metadata: Dict, tenant_id: int
    ):
        """Postgres mode: create ORM Notification record."""
        from db.models import Notification

        db = _get_db_session()
        try:
            notif = Notification(
                tenant_id=tenant_id,
                tipo=tipo,
                titulo=titulo,
                detalle=detalle,
                metadata_=metadata,
            )
            db.add(notif)
            db.commit()
            db.refresh(notif)

            entry = {
                "id": notif.id,
                "timestamp": notif.created_at.isoformat() if notif.created_at else datetime.now().isoformat(),
                "tipo": notif.tipo,
                "titulo": notif.titulo,
                "detalle": notif.detalle,
                "metadata": metadata,
                "tenant_id": tenant_id,
            }

            # Push SSE event
            target_users = metadata.get("target_users") if metadata else None
            self.publish_event(tipo, titulo, detalle, target_users=target_users)

            return entry
        except Exception:
            db.rollback()
            logger.exception("notification_add_postgres_failed")
            raise
        finally:
            db.close()

    # ── List notifications ────────────────────────────────────────────────

    def get_all(
        self,
        tipo: Optional[str] = None,
        limit: int = 100,
        tenant_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Get notifications. In postgres mode, filters by tenant_id."""
        if _IS_POSTGRES and tenant_id is not None:
            return self._get_all_postgres(tipo, limit, tenant_id)
        return self._get_all_json(tipo, limit)

    def _get_all_json(self, tipo: Optional[str], limit: int) -> List[Dict[str, Any]]:
        """Legacy JSON-file list (Excel mode)."""
        items = self._log
        if tipo:
            items = [i for i in items if i["tipo"] == tipo]
        return list(reversed(items[-limit:]))

    def _get_all_postgres(
        self, tipo: Optional[str], limit: int, tenant_id: int
    ) -> List[Dict[str, Any]]:
        """Postgres mode: query Notification table filtered by tenant_id."""
        from db.models import Notification

        db = _get_db_session()
        try:
            query = db.query(Notification).filter(Notification.tenant_id == tenant_id)
            if tipo:
                query = query.filter(Notification.tipo == tipo)
            query = query.order_by(Notification.created_at.desc()).limit(limit)
            rows = query.all()
            return [
                {
                    "id": r.id,
                    "timestamp": r.created_at.isoformat() if r.created_at else "",
                    "tipo": r.tipo,
                    "titulo": r.titulo,
                    "detalle": r.detalle,
                    "metadata": r.metadata_ or {},
                    "tenant_id": r.tenant_id,
                }
                for r in rows
            ]
        finally:
            db.close()

    # ── Mark as read ──────────────────────────────────────────────────────

    def mark_as_read(
        self,
        notification_id: int,
        tenant_id: Optional[int] = None,
    ) -> bool:
        """Mark a notification as read. Returns True if found and updated."""
        if _IS_POSTGRES and tenant_id is not None:
            return self._mark_as_read_postgres(notification_id, tenant_id)
        return self._mark_as_read_json(notification_id)

    def _mark_as_read_json(self, notification_id: int) -> bool:
        """Legacy JSON-file mark-as-read (Excel mode)."""
        for entry in self._log:
            if entry.get("id") == notification_id:
                entry["read"] = True
                self._save()
                return True
        return False

    def _mark_as_read_postgres(self, notification_id: int, tenant_id: int) -> bool:
        """Postgres mode: update the notification metadata to mark as read."""
        from db.models import Notification
        from sqlalchemy import func

        db = _get_db_session()
        try:
            notif = (
                db.query(Notification)
                .filter(Notification.id == notification_id, Notification.tenant_id == tenant_id)
                .first()
            )
            if not notif:
                return False
            meta = dict(notif.metadata_ or {})
            meta["read"] = True
            notif.metadata_ = meta
            db.commit()
            return True
        except Exception:
            db.rollback()
            logger.exception("notification_mark_read_postgres_failed")
            return False
        finally:
            db.close()

    # ── Stats ─────────────────────────────────────────────────────────────

    def get_stats(self, tenant_id: Optional[int] = None) -> Dict[str, Any]:
        if _IS_POSTGRES and tenant_id is not None:
            return self._get_stats_postgres(tenant_id)
        return self._get_stats_json()

    def _get_stats_json(self) -> Dict[str, Any]:
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

    def _get_stats_postgres(self, tenant_id: int) -> Dict[str, Any]:
        from db.models import Notification
        from sqlalchemy import func, cast, Date

        db = _get_db_session()
        try:
            total = db.query(func.count(Notification.id)).filter(
                Notification.tenant_id == tenant_id
            ).scalar() or 0

            today_date = datetime.now().date()
            today_count = db.query(func.count(Notification.id)).filter(
                Notification.tenant_id == tenant_id,
                cast(Notification.created_at, Date) == today_date,
            ).scalar() or 0

            rows = db.query(Notification.tipo, func.count(Notification.id)).filter(
                Notification.tenant_id == tenant_id
            ).group_by(Notification.tipo).all()
            tipos = {r[0]: r[1] for r in rows}

            return {"total": total, "hoy": today_count, "por_tipo": tipos}
        finally:
            db.close()

    # ── Clear ─────────────────────────────────────────────────────────────

    def clear(self, tenant_id: Optional[int] = None):
        if _IS_POSTGRES and tenant_id is not None:
            self._clear_postgres(tenant_id)
        else:
            self._log = []
            self._save()

    def _clear_postgres(self, tenant_id: int):
        from db.models import Notification

        db = _get_db_session()
        try:
            db.query(Notification).filter(Notification.tenant_id == tenant_id).delete()
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("notification_clear_postgres_failed")
        finally:
            db.close()

    # ── SSE streaming (shared) ────────────────────────────────────────────

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
