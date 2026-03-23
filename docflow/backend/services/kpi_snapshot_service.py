"""Monthly KPI snapshots for trend analysis.

Stores a snapshot of key metrics on the 1st of each month.
Historical data stored in kpi_snapshots.json via json_store.
"""

import os
from datetime import datetime
from typing import Any

import logging

from utils.json_store import read_json, write_json
from services.analytics_service import AnalyticsService
from repositories.instances import monitoring_service

logger = logging.getLogger(__name__)

SNAPSHOTS_FILE = os.path.join(os.path.dirname(__file__), "..", "kpi_snapshots.json")


class KpiSnapshotService:
    def __init__(self):
        self.analytics = AnalyticsService()
        self.monitoring = monitoring_service

    def _build_snapshot_dict(self, summary: dict) -> dict:
        """Build a snapshot dictionary from an analytics summary."""
        total = (summary.get("total_aprobados", 0) + summary.get("total_enviados", 0) +
                 summary.get("total_devoluciones", 0) + summary.get("total_sin_enviar", 0))
        aprobados = summary.get("total_aprobados", 0)
        return {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "month": datetime.now().strftime("%Y-%m"),
            "total_docs": total,
            "total_aprobados": aprobados,
            "total_enviados": summary.get("total_enviados", 0),
            "total_devoluciones": summary.get("total_devoluciones", 0),
            "total_sin_enviar": summary.get("total_sin_enviar", 0),
            "pct_aprobados": round(aprobados / total * 100) if total > 0 else 0,
            "velocidad_media": summary.get("velocidad_media_dias", 0),
            "docs_riesgo": summary.get("docs_riesgo", 0),
        }

    def take_snapshot(self) -> dict:
        """Take a snapshot of current KPIs and persist to JSON."""
        docs = self.monitoring.get_monitoring_data()
        summary = self.analytics.get_analytics_summary(docs)

        snapshot = self._build_snapshot_dict(summary)

        # Save to history
        snapshots = read_json(SNAPSHOTS_FILE, default=[])
        # Replace if same month already exists
        snapshots = [s for s in snapshots if s.get("month") != snapshot["month"]]
        snapshots.append(snapshot)
        snapshots.sort(key=lambda x: x["month"])
        write_json(SNAPSHOTS_FILE, snapshots)

        return snapshot

    def get_trends(self, months: int = 12) -> dict[str, Any]:
        """Get KPI trends for the last N months."""
        snapshots = read_json(SNAPSHOTS_FILE, default=[])
        recent = snapshots[-months:] if len(snapshots) > months else list(snapshots)

        # If we have data, check if a live point is needed
        current_month = datetime.now().strftime("%Y-%m")
        last_month = recent[-1].get("month", "") if recent else ""

        if last_month != current_month:
            # Add live snapshot without saving to disk
            try:
                docs = self.monitoring.get_monitoring_data()
                summary = self.analytics.get_analytics_summary(docs)
                live = self._build_snapshot_dict(summary)
                live["live"] = True
                recent.append(live)
            except Exception as e:
                logger.warning(f"Failed to build live KPI snapshot: {e}")

        return {
            "snapshots": recent,
            "total_months": len(recent),
        }
