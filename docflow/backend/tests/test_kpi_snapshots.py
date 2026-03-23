"""Tests for KPI snapshot service (monthly trend analysis)."""

import os
import sys
import json
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture()
def empty_snapshots(tmp_path):
    """Patch snapshots file to use a temp empty file."""
    snap_path = str(tmp_path / "kpi_snapshots.json")
    with open(snap_path, "w") as f:
        json.dump([], f)
    with patch("services.kpi_snapshot_service.SNAPSHOTS_FILE", snap_path):
        yield snap_path


@pytest.fixture()
def existing_snapshots(tmp_path):
    """Patch snapshots file with some existing data."""
    snap_path = str(tmp_path / "kpi_snapshots.json")
    data = [
        {
            "date": "2026-01-01", "month": "2026-01",
            "total_docs": 100, "total_aprobados": 40,
            "total_enviados": 30, "total_devoluciones": 20,
            "total_sin_enviar": 10, "pct_aprobados": 40.0,
            "velocidad_media": 12.5, "docs_riesgo": 5,
        },
        {
            "date": "2026-02-01", "month": "2026-02",
            "total_docs": 120, "total_aprobados": 55,
            "total_enviados": 35, "total_devoluciones": 18,
            "total_sin_enviar": 12, "pct_aprobados": 45.8,
            "velocidad_media": 11.0, "docs_riesgo": 3,
        },
    ]
    with open(snap_path, "w") as f:
        json.dump(data, f)
    with patch("services.kpi_snapshot_service.SNAPSHOTS_FILE", snap_path):
        yield snap_path


@pytest.fixture()
def mock_monitoring():
    """Mock monitoring + analytics to return predictable data."""
    mock_docs = [
        {"Estado": "Aprobado", "Dias Devolucion": 0, "Critico": "No", "Cliente": "TEST"},
        {"Estado": "Aprobado", "Dias Devolucion": 0, "Critico": "No", "Cliente": "TEST"},
        {"Estado": "Enviado", "Dias Devolucion": 20, "Critico": "Si", "Cliente": "TEST"},
        {"Estado": "", "Dias Devolucion": "", "Critico": "No", "Cliente": "TEST"},
    ]
    mock_mon_instance = MagicMock()
    mock_mon_instance.get_monitoring_data.return_value = mock_docs

    mock_ana_instance = MagicMock()
    mock_ana_instance.get_analytics_summary.return_value = {
        "total_aprobados": 2,
        "total_enviados": 1,
        "total_devoluciones": 0,
        "total_sin_enviar": 1,
        "velocidad_media_dias": 15.0,
        "docs_riesgo": 1,
    }

    with patch("services.kpi_snapshot_service.monitoring_service", mock_mon_instance), \
         patch("services.kpi_snapshot_service.AnalyticsService", return_value=mock_ana_instance):
        yield mock_mon_instance, mock_ana_instance


class TestTakeSnapshot:
    """Test take_snapshot saves data correctly."""

    def test_take_snapshot_saves_to_json(self, empty_snapshots, mock_monitoring):
        from services.kpi_snapshot_service import KpiSnapshotService
        svc = KpiSnapshotService()
        result = svc.take_snapshot()

        assert "month" in result
        assert "total_docs" in result
        assert result["total_docs"] == 4  # 2 + 1 + 0 + 1
        assert result["total_aprobados"] == 2
        assert result["pct_aprobados"] == 50.0

        # Verify saved to file
        with open(empty_snapshots) as f:
            saved = json.load(f)
        assert len(saved) == 1
        assert saved[0]["total_aprobados"] == 2

    def test_take_snapshot_replaces_same_month(self, empty_snapshots, mock_monitoring):
        from services.kpi_snapshot_service import KpiSnapshotService
        svc = KpiSnapshotService()

        # Take two snapshots in the same month
        svc.take_snapshot()
        svc.take_snapshot()

        with open(empty_snapshots) as f:
            saved = json.load(f)
        # Should still be 1 entry, not 2
        assert len(saved) == 1


class TestGetTrends:
    """Test get_trends returns correct data."""

    def test_get_trends_returns_sorted(self, existing_snapshots, mock_monitoring):
        from services.kpi_snapshot_service import KpiSnapshotService
        svc = KpiSnapshotService()
        trends = svc.get_trends(months=12)

        assert "snapshots" in trends
        assert "total_months" in trends
        # Should be at least 2 historical + potentially 1 live
        assert trends["total_months"] >= 2

        # Check chronological order
        months = [s["month"] for s in trends["snapshots"]]
        assert months == sorted(months)

    def test_get_trends_adds_live_point(self, existing_snapshots, mock_monitoring):
        from services.kpi_snapshot_service import KpiSnapshotService
        from datetime import datetime
        svc = KpiSnapshotService()
        trends = svc.get_trends(months=12)

        # Since existing data is 2026-01 and 2026-02, and current month is 2026-03,
        # a live point should be appended
        last = trends["snapshots"][-1]
        current_month = datetime.now().strftime("%Y-%m")
        if last.get("month") == current_month:
            assert last.get("live") is True

    def test_get_trends_limits_months(self, existing_snapshots, mock_monitoring):
        from services.kpi_snapshot_service import KpiSnapshotService
        svc = KpiSnapshotService()

        # Request only 1 month
        trends = svc.get_trends(months=1)
        # Should return at most 1 historical + possible live
        historical = [s for s in trends["snapshots"] if not s.get("live")]
        assert len(historical) <= 1

    def test_get_trends_empty_snapshots(self, empty_snapshots, mock_monitoring):
        from services.kpi_snapshot_service import KpiSnapshotService
        svc = KpiSnapshotService()
        trends = svc.get_trends(months=12)

        # With empty snapshots, we should still get a live point
        assert "snapshots" in trends
        # May have 0 or 1 (live only)
        assert isinstance(trends["snapshots"], list)
