"""
Enhanced order completion prediction.
Considers: client historical behavior, critical doc distribution,
temporal patterns (critical docs approved last), and revision history.
"""

from datetime import datetime, timedelta
from typing import Any

import logging

from services.supplier_scorecard_service import get_scorecard
from repositories.instances import monitoring_service
from utils.status_constants import is_critico

logger = logging.getLogger(__name__)


class EnhancedPredictionService:
    def __init__(self):
        self.monitoring = monitoring_service

    def predict_orders(self, tenant_id: int = 0) -> list[dict[str, Any]]:
        """Predict completion dates for all active orders."""
        docs = self.monitoring.get_monitoring_data()

        # Get client behavior data
        client_stats = self._get_client_stats(tenant_id)

        # Group by pedido
        pedidos: dict[str, list] = {}
        for d in docs:
            p = str(d.get("Nº Pedido", "")).strip()
            if not p:
                continue
            pedidos.setdefault(p, []).append(d)

        predictions = []
        for pedido, pdocs in pedidos.items():
            pred = self._predict_single_order(pedido, pdocs, client_stats)
            if pred:
                predictions.append(pred)

        # Sort by estimated days remaining
        predictions.sort(key=lambda x: x.get("days_remaining", 999))
        return predictions

    def _predict_single_order(
        self, pedido: str, docs: list, client_stats: dict
    ) -> dict | None:
        """Predict completion for a single order."""
        total = len(docs)
        if total == 0:
            return None

        first = docs[0]
        cliente = str(first.get("Cliente", "")).strip()

        # Count statuses
        aprobados = 0
        enviados = 0
        sin_enviar = 0
        criticos_pending = 0
        total_criticos = 0
        max_revision = 0

        for d in docs:
            estado = str(d.get("Estado", "")).strip().lower()
            doc_is_critico = is_critico(d.get("Crítico", ""))
            rev = 0
            try:
                rev = int(d.get("Nº Revisión", 0))
            except (ValueError, TypeError):
                pass
            max_revision = max(max_revision, rev)

            if doc_is_critico:
                total_criticos += 1

            if estado == "aprobado":
                aprobados += 1
            elif estado == "enviado":
                enviados += 1
            elif estado == "":
                sin_enviar += 1
            else:
                if doc_is_critico:
                    criticos_pending += 1

        pct_complete = round(aprobados / total * 100) if total else 0
        pending = total - aprobados

        if pending == 0:
            return {
                "pedido": pedido,
                "cliente": cliente,
                "status": "completed",
                "pct_complete": 100,
                "days_remaining": 0,
                "confidence": "high",
                "total": total,
                "aprobados": aprobados,
            }

        # Get client avg response time
        cs = client_stats.get(cliente, {})
        client_avg_days = cs.get("avg_response_days", 20)  # default 20 days

        # Calculate prediction factors
        base_days = client_avg_days * (pending / total)  # Linear baseline

        # Factor 1: Critical docs remaining (they take longer, done last)
        critical_factor = 1.0
        if criticos_pending > 0 and total_criticos > 0:
            critical_ratio = criticos_pending / total_criticos
            critical_factor = 1.0 + (critical_ratio * 0.3)  # Up to 30% more time

        # Factor 2: High revision count suggests complex project
        revision_factor = 1.0 + (max_revision * 0.05)  # 5% more per revision level

        # Factor 3: Sin enviar docs need extra time (sending + review)
        unsent_factor = 1.0
        if sin_enviar > 0:
            unsent_ratio = sin_enviar / pending
            unsent_factor = 1.0 + (unsent_ratio * 0.5)  # 50% more for unsent portion

        # Combined prediction
        predicted_days = base_days * critical_factor * revision_factor * unsent_factor
        predicted_days = max(1, round(predicted_days))

        # Confidence based on data quality
        confidence = "high"
        if cs.get("total_docs", 0) < 5:
            confidence = "medium"
        if cs.get("total_docs", 0) < 2:
            confidence = "low"
        if sin_enviar > pending * 0.5:
            confidence = "low"  # Too many unsent

        predicted_date = (
            datetime.now() + timedelta(days=predicted_days)
        ).strftime("%Y-%m-%d")

        return {
            "pedido": pedido,
            "cliente": cliente,
            "status": "in_progress",
            "pct_complete": pct_complete,
            "total": total,
            "aprobados": aprobados,
            "pending": pending,
            "sin_enviar": sin_enviar,
            "criticos_pending": criticos_pending,
            "days_remaining": predicted_days,
            "predicted_date": predicted_date,
            "confidence": confidence,
            "client_avg_days": round(client_avg_days, 1),
            "factors": {
                "base_days": round(base_days, 1),
                "critical_factor": round(critical_factor, 2),
                "revision_factor": round(revision_factor, 2),
                "unsent_factor": round(unsent_factor, 2),
            },
        }

    def _get_client_stats(self, tenant_id: int) -> dict:
        """Get client response time statistics from supplier scorecard."""
        try:
            scorecard = get_scorecard(tenant_id)
            return {s["client"]: s for s in scorecard} if scorecard else {}
        except Exception as e:
            logger.warning(f"Failed to load client stats for tenant {tenant_id}: {e}")
            return {}
