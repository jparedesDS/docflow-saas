"""
Mi Mañana — Personal daily work inbox.
Aggregates data from monitoring, SLA prediction, claims, and notifications
to give each user a single view of what they need to do today.
"""
from datetime import datetime
from typing import Any

from services.claim_service import ClaimService
from repositories.instances import monitoring_service
from utils.config import USERS
from utils.status_constants import ESTADOS_APROBADOS, ESTADOS_DEVOLUCION, ESTADOS_EXCLUIDOS, is_critico


class MyMorningService:
    def __init__(self):
        self.monitoring = monitoring_service
        self.claims = ClaimService()

    def get_morning_data(self, initials: str, tenant_id: int = 0) -> dict[str, Any]:
        """Get all morning data for a user."""
        all_docs = self.monitoring.get_monitoring_data()
        my_docs = [
            d for d in all_docs
            if str(d.get("Repsonsable", "")).strip().upper() == initials.upper()
        ]

        return {
            "user": {
                "initials": initials,
                "nombre": USERS.get(initials, {}).get("nombre", initials),
            },
            "returned_docs": self._get_returned_docs(my_docs),
            "sla_critical": self._get_sla_critical(my_docs),
            "pending_claims": self._get_pending_claims(initials),
            "summary_kpis": self._get_summary_kpis(my_docs, all_docs),
            "generated": datetime.now().isoformat(),
        }

    def _get_returned_docs(self, my_docs: list) -> list:
        """Docs returned by clients in last 24-48h (devolutions)."""
        returned_states = ESTADOS_DEVOLUCION
        result = []
        for d in my_docs:
            estado = str(d.get("Estado", "")).strip().lower()
            dias_dev = d.get("Días Devolución", 999)
            if estado in returned_states and isinstance(dias_dev, (int, float)) and 0 <= dias_dev <= 2:
                result.append({
                    "doc_eipsa": d.get("Nº Doc. EIPSA", ""),
                    "titulo": d.get("Título", ""),
                    "cliente": d.get("Cliente", ""),
                    "estado": d.get("Estado", ""),
                    "dias": dias_dev,
                    "pedido": d.get("Nº Pedido", ""),
                    "critico": d.get("Crítico", ""),
                })
        return sorted(result, key=lambda x: x.get("dias", 0))

    def _get_sla_critical(self, my_docs: list) -> list:
        """Docs about to breach SLA (15d threshold)."""
        result = []
        for d in my_docs:
            estado = str(d.get("Estado", "")).strip().lower()
            if estado in ESTADOS_APROBADOS or estado in ESTADOS_EXCLUIDOS:
                continue
            dias_dev = d.get("Días Devolución")
            if not isinstance(dias_dev, (int, float)):
                continue
            if dias_dev >= 12:  # approaching 15-day SLA
                result.append({
                    "doc_eipsa": d.get("Nº Doc. EIPSA", ""),
                    "titulo": d.get("Título", ""),
                    "cliente": d.get("Cliente", ""),
                    "estado": d.get("Estado", ""),
                    "dias_devolucion": dias_dev,
                    "pedido": d.get("Nº Pedido", ""),
                    "critico": d.get("Crítico", ""),
                    "urgency": "high" if dias_dev >= 30 else "medium" if dias_dev >= 15 else "approaching",
                })
        return sorted(result, key=lambda x: x.get("dias_devolucion", 0), reverse=True)

    def _get_pending_claims(self, initials: str) -> list:
        """Claimable pedidos relevant to this user."""
        all_claimable = self.claims.get_claimable_pedidos()
        return [
            c for c in all_claimable
            if str(c.get("responsable", "")).strip().upper() == initials.upper()
        ]

    def _get_summary_kpis(self, my_docs: list, all_docs: list) -> dict:
        """Personal KPI summary."""
        total = len(my_docs)
        aprobados = sum(
            1 for d in my_docs
            if str(d.get("Estado", "")).strip().lower() == "aprobado"
        )
        enviados = sum(
            1 for d in my_docs
            if str(d.get("Estado", "")).strip().lower() == "enviado"
        )
        sin_enviar = sum(
            1 for d in my_docs
            if str(d.get("Estado", "")).strip() == ""
        )
        criticos = sum(
            1 for d in my_docs
            if is_critico(d.get("Crítico", ""))
        )

        team_total = len(all_docs)
        team_aprobados = sum(
            1 for d in all_docs
            if str(d.get("Estado", "")).strip().lower() == "aprobado"
        )

        return {
            "total": total,
            "aprobados": aprobados,
            "pct_aprobados": round(aprobados / total * 100) if total > 0 else 0,
            "enviados": enviados,
            "sin_enviar": sin_enviar,
            "criticos": criticos,
            "team_pct": round(team_aprobados / team_total * 100) if team_total > 0 else 0,
        }
