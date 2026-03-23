"""
Visual timeline showing the complete lifecycle of a document.
Aggregates events from: monitoring data, audit log, comments, revision history.
"""

from datetime import datetime
from typing import Any

import logging

from services.comment_service import list_comments
from repositories.instances import monitoring_service
from utils.json_store import read_json

logger = logging.getLogger(__name__)


class DocTimelineService:
    def __init__(self):
        self.monitoring = monitoring_service

    def get_timeline(self, doc_ref: str, tenant_id: int = 0) -> dict[str, Any]:
        """Get complete timeline for a document."""
        docs = self.monitoring.get_monitoring_data()

        # Find the document
        doc = None
        for d in docs:
            if (
                str(d.get("Nº Doc. EIPSA", "")).strip().lower()
                == doc_ref.strip().lower()
            ):
                doc = d
                break

        if not doc:
            return {"error": "Document not found", "events": [], "doc_ref": doc_ref}

        events: list[dict[str, Any]] = []

        # Event 1: Creation/Registration (from Fecha Pedido or earliest date)
        fecha_pedido = doc.get("Fecha Pedido")
        if fecha_pedido and str(fecha_pedido).strip():
            events.append(
                {
                    "type": "created",
                    "date": str(fecha_pedido),
                    "title": "Documento registrado",
                    "description": (
                        f"Pedido {doc.get('Nº Pedido', '')} — {doc.get('Cliente', '')}"
                    ),
                    "icon": "file-plus",
                }
            )

        # Event 2: First sent (from Fecha Env. Doc.)
        fecha_envio = doc.get("Fecha Env. Doc.")
        if fecha_envio and str(fecha_envio).strip():
            events.append(
                {
                    "type": "sent",
                    "date": str(fecha_envio),
                    "title": "Enviado al cliente",
                    "description": (
                        f"Días hasta envío: {doc.get('Días Envío', 'N/A')}"
                    ),
                    "icon": "paper-plane",
                }
            )

        # Event 3: Revision history (from Historial Rev. field)
        historial = doc.get("Historial Rev.", "")
        if historial and str(historial).strip():
            events.append(
                {
                    "type": "revision",
                    "date": "",  # No exact date available
                    "title": f"Revisión {doc.get('Nº Revisión', '')}",
                    "description": f"Historial: {historial}",
                    "icon": "git-branch",
                }
            )

        # Event 4: Comments (from comment_service)
        try:
            comments = list_comments(tenant_id, doc_ref)
            for c in comments if isinstance(comments, list) else []:
                events.append(
                    {
                        "type": "comment",
                        "date": c.get("created_at", ""),
                        "title": (
                            f"Comentario de "
                            f"{c.get('user_name', c.get('user_initials', ''))}"
                        ),
                        "description": c.get("content", "")[:100],
                        "icon": "chat-circle",
                    }
                )
        except Exception as e:
            logger.warning(f"Failed to load comments for {doc_ref}: {e}")

        # Event 5: Claims (from claims log)
        try:
            claims_log = read_json("claims_log.json", default={})
            pedido = doc.get("Nº Pedido", "")
            if pedido and pedido in claims_log:
                claim_data = claims_log[pedido]
                history = claim_data.get("history", [])
                for h in history:
                    events.append(
                        {
                            "type": "claim",
                            "date": h.get("date", h.get("claimed_at", "")),
                            "title": "Reclamación enviada",
                            "description": f"Pedido {pedido}",
                            "icon": "warning",
                        }
                    )
        except Exception as e:
            logger.warning(f"Failed to load claims for {doc_ref}: {e}")

        # Event 6: Current status (latest event)
        estado = doc.get("Estado", "")
        if estado:
            events.append(
                {
                    "type": "status",
                    "date": datetime.now().strftime("%Y-%m-%d"),
                    "title": f"Estado: {estado}",
                    "description": (
                        f"Días devolución: {doc.get('Días Devolución', 'N/A')}"
                    ),
                    "icon": (
                        "check-circle"
                        if str(estado).lower() == "aprobado"
                        else "clock"
                    ),
                    "estado": estado,
                }
            )

        # Sort events by date (best effort)
        events.sort(key=lambda x: x.get("date", "9999"))

        return {
            "doc_ref": doc_ref,
            "document": {
                "titulo": doc.get("Título", ""),
                "cliente": doc.get("Cliente", ""),
                "pedido": doc.get("Nº Pedido", ""),
                "estado": doc.get("Estado", ""),
                "responsable": doc.get("Repsonsable", ""),
                "critico": doc.get("Crítico", ""),
                "tipo_doc": doc.get("Tipo Doc.", ""),
            },
            "events": events,
            "total_events": len(events),
        }
