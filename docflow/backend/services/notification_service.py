"""Servicio de notificaciones / log de actividad.
Almacena en memoria las acciones realizadas (reclamaciones, exportaciones, etc.)
para trazabilidad dentro de la sesión. En el futuro puede persistirse a BD.
"""

import os
from datetime import datetime
from typing import List, Dict, Any, Optional

from utils.json_store import read_json, write_json

# Archivo local para persistir entre reinicios del servidor
_LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "notifications_log.json")


class NotificationService:
    def __init__(self):
        self._log: List[Dict[str, Any]] = []
        self._load()

    def _load(self):
        self._log = read_json(_LOG_PATH, default=[])

    def _save(self):
        try:
            write_json(_LOG_PATH, self._log[-500:])
        except Exception:
            pass

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


# Singleton
notification_service = NotificationService()
