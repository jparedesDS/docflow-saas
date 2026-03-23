"""
Detects anomalous client response times using statistical analysis.
Alerts when a document's wait time exceeds N standard deviations
from the client's historical mean.
"""
import math
from typing import Any

from repositories.instances import monitoring_service
from utils.status_constants import ESTADOS_APROBADOS, ESTADOS_EXCLUIDOS


class AnomalyDetectionService:
    def __init__(self):
        self.monitoring = monitoring_service

    def detect_anomalies(self, sigma_threshold: float = 2.0) -> dict[str, Any]:
        """Detect documents with anomalous wait times per client."""
        docs = self.monitoring.get_monitoring_data()

        # Calculate per-client statistics
        client_stats = self._calculate_client_stats(docs)

        # Find anomalies
        anomalies = []
        for d in docs:
            estado = str(d.get("Estado", "")).strip().lower()
            if estado in ESTADOS_APROBADOS or estado in ESTADOS_EXCLUIDOS or estado == "":
                continue

            cliente = str(d.get("Cliente", "")).strip()
            dias = d.get("Días Devolución")
            if not isinstance(dias, (int, float)) or dias <= 0:
                continue
            if cliente not in client_stats:
                continue

            stats = client_stats[cliente]
            if stats["std_dev"] == 0:
                continue

            z_score = (dias - stats["mean"]) / stats["std_dev"]
            if z_score >= sigma_threshold:
                anomalies.append({
                    "doc_eipsa": d.get("Nº Doc. EIPSA", ""),
                    "titulo": d.get("Título", ""),
                    "cliente": cliente,
                    "pedido": d.get("Nº Pedido", ""),
                    "responsable": d.get("Repsonsable", ""),
                    "dias_actual": dias,
                    "media_cliente": round(stats["mean"], 1),
                    "std_dev": round(stats["std_dev"], 1),
                    "z_score": round(z_score, 1),
                    "estado": d.get("Estado", ""),
                    "message": (
                        f"{cliente} normalmente responde en {round(stats['mean'])} días, "
                        f"este lleva {int(dias)} — {round(z_score, 1)}σ por encima"
                    ),
                })

        anomalies.sort(key=lambda x: x["z_score"], reverse=True)

        return {
            "anomalies": anomalies,
            "client_stats": [
                {"cliente": k, **v}
                for k, v in sorted(client_stats.items(), key=lambda x: x[1]["mean"], reverse=True)
            ],
            "threshold_sigma": sigma_threshold,
            "total_anomalies": len(anomalies),
        }

    def _calculate_client_stats(self, docs: list) -> dict:
        """Calculate mean and std dev of response days per client."""
        client_days: dict[str, list] = {}
        for d in docs:
            cliente = str(d.get("Cliente", "")).strip()
            if not cliente:
                continue
            dias = d.get("Días Devolución")
            if not isinstance(dias, (int, float)) or dias <= 0:
                continue
            client_days.setdefault(cliente, []).append(dias)

        stats = {}
        for cliente, days_list in client_days.items():
            if len(days_list) < 3:  # Need minimum sample size
                continue
            mean = sum(days_list) / len(days_list)
            variance = sum((d - mean) ** 2 for d in days_list) / len(days_list)
            std_dev = math.sqrt(variance)
            stats[cliente] = {
                "mean": mean,
                "std_dev": std_dev,
                "count": len(days_list),
                "min": min(days_list),
                "max": max(days_list),
            }
        return stats
