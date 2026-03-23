"""Tests for Team Workload (Feature #3) and Anomaly Detection (Feature #6)."""

import math
import pytest
from unittest.mock import patch, MagicMock

from services.analytics_service import AnalyticsService
from services.anomaly_detection_service import AnomalyDetectionService


# ── Helpers ────────────────────────────────────────────────────────────────

def _make_doc(repsonsable, estado="enviado", dias_devolucion=10, cliente="ClienteA", critico=""):
    """Create a minimal doc dict matching the monitoring data shape."""
    return {
        "Nº Pedido": "P001",
        "Nº Doc. EIPSA": f"DOC-{repsonsable}-001",
        "Título": f"Doc de {repsonsable}",
        "Repsonsable": repsonsable,
        "Responsable": "JM",
        "Estado": estado,
        "Cliente": cliente,
        "Días Devolución": dias_devolucion,
        "Días Envío": 5,
        "Crítico": critico,
        "Tipo Doc.": "Plano",
        "Nº Revisión": 1,
    }


def _make_docs_for_workload():
    """Create a set of docs with varying loads to test overload detection."""
    docs = []
    # AC gets 50 docs — should be overloaded
    for i in range(50):
        docs.append(_make_doc("AC", estado="enviado", dias_devolucion=5))
    # LB gets 20 docs — normal
    for i in range(20):
        docs.append(_make_doc("LB", estado="enviado", dias_devolucion=8))
    # CCH gets 10 docs — might be underloaded
    for i in range(10):
        docs.append(_make_doc("CCH", estado="aprobado", dias_devolucion=0))
    # LM gets 15 docs — normal
    for i in range(15):
        docs.append(_make_doc("LM", estado="enviado", dias_devolucion=12))
    return docs


# ── Feature #3: Team Workload ─────────────────────────────────────────────

class TestTeamWorkload:
    """Tests for AnalyticsService.get_team_workload()."""

    def test_team_workload_calculates_overload(self):
        """Members >1 sigma above mean should be flagged as overloaded."""
        svc = AnalyticsService()
        docs = _make_docs_for_workload()
        result = svc.get_team_workload(docs)

        assert "members" in result
        assert "avg_load" in result
        assert "max_load" in result
        assert "std_dev" in result
        assert "alerts" in result

        # AC has 50 docs, avg ~23.75, should be overloaded
        ac_member = next((m for m in result["members"] if m["responsable"] == "AC"), None)
        assert ac_member is not None
        assert ac_member["overload"] is True

        # Should have at least one alert for AC
        ac_alert = next((a for a in result["alerts"] if a["responsable"] == "AC"), None)
        assert ac_alert is not None
        assert ac_alert["type"] == "overload"

    def test_team_workload_empty_docs(self):
        """Empty docs should return empty structure."""
        svc = AnalyticsService()
        result = svc.get_team_workload([])

        assert result["members"] == []
        assert result["avg_load"] == 0
        assert result["max_load"] == 0
        assert result["alerts"] == []

    def test_team_workload_stats_math(self):
        """Verify avg_load and std_dev calculation."""
        svc = AnalyticsService()
        docs = _make_docs_for_workload()
        result = svc.get_team_workload(docs)

        totals = [m["total"] for m in result["members"]]
        expected_avg = sum(totals) / len(totals)
        expected_std = math.sqrt(sum((t - expected_avg) ** 2 for t in totals) / len(totals))

        assert result["avg_load"] == round(expected_avg, 1)
        assert result["std_dev"] == round(expected_std, 1)
        assert result["max_load"] == max(totals)

    def test_team_workload_excludes_hidden(self):
        """Members in OCULTAR_DOC set (SI, ES, Sin Asignar) should be excluded."""
        svc = AnalyticsService()
        docs = [
            _make_doc("AC"),
            _make_doc("SI"),
            _make_doc("ES"),
            _make_doc("Sin Asignar"),
        ]
        result = svc.get_team_workload(docs)
        names = [m["responsable"] for m in result["members"]]
        assert "SI" not in names
        assert "ES" not in names
        assert "Sin Asignar" not in names
        assert "AC" in names


# ── Feature #6: Anomaly Detection ─────────────────────────────────────────

class TestAnomalyDetection:
    """Tests for AnomalyDetectionService."""

    def _make_client_docs(self, cliente, dias_list, estado="enviado"):
        """Create docs for a single client with specified response days."""
        docs = []
        for i, dias in enumerate(dias_list):
            docs.append({
                "Nº Pedido": f"P-{cliente}-{i}",
                "Nº Doc. EIPSA": f"DOC-{cliente}-{i:03d}",
                "Título": f"Doc {i}",
                "Repsonsable": "AC",
                "Responsable": "JM",
                "Estado": estado,
                "Cliente": cliente,
                "Días Devolución": dias,
                "Tipo Doc.": "Plano",
            })
        return docs

    @patch.object(AnomalyDetectionService, "__init__", lambda self: None)
    def test_anomaly_detection_finds_outliers(self):
        """Docs >2 sigma should be detected as anomalies."""
        svc = AnomalyDetectionService()
        # ClientA: normal docs at 10, 12, 11, 9, 10 + one outlier at 50
        docs = self._make_client_docs("ClientA", [10, 12, 11, 9, 10, 50])
        svc.monitoring = MagicMock()
        svc.monitoring.get_monitoring_data.return_value = docs

        result = svc.detect_anomalies(sigma_threshold=2.0)

        assert result["total_anomalies"] >= 1
        outlier = result["anomalies"][0]
        assert outlier["cliente"] == "ClientA"
        assert outlier["dias_actual"] == 50
        assert outlier["z_score"] >= 2.0

    @patch.object(AnomalyDetectionService, "__init__", lambda self: None)
    def test_anomaly_detection_needs_minimum_samples(self):
        """Clients with <3 docs should be excluded from anomaly detection."""
        svc = AnomalyDetectionService()
        # ClientB: only 2 docs — should be excluded
        docs = self._make_client_docs("ClientB", [10, 100])
        svc.monitoring = MagicMock()
        svc.monitoring.get_monitoring_data.return_value = docs

        result = svc.detect_anomalies(sigma_threshold=2.0)

        assert result["total_anomalies"] == 0
        assert len(result["client_stats"]) == 0

    @patch.object(AnomalyDetectionService, "__init__", lambda self: None)
    def test_anomaly_z_score_calculation(self):
        """Verify z-score math: z = (x - mean) / std_dev."""
        svc = AnomalyDetectionService()
        # 5 docs at 10d each, 1 outlier at 40d
        # mean = (10*5 + 40) / 6 = 15.0
        # variance = (5*(10-15)^2 + (40-15)^2) / 6 = (125 + 625) / 6 = 125.0
        # std_dev = sqrt(125) = 11.18
        # z_score for 40d = (40 - 15) / 11.18 = 2.236
        docs = self._make_client_docs("TestClient", [10, 10, 10, 10, 10, 40])
        svc.monitoring = MagicMock()
        svc.monitoring.get_monitoring_data.return_value = docs

        result = svc.detect_anomalies(sigma_threshold=2.0)

        assert result["total_anomalies"] >= 1
        outlier = result["anomalies"][0]
        expected_mean = 15.0
        expected_std = math.sqrt(125.0)
        expected_z = (40 - expected_mean) / expected_std

        assert abs(outlier["z_score"] - round(expected_z, 1)) <= 0.1

    @patch.object(AnomalyDetectionService, "__init__", lambda self: None)
    def test_anomaly_skips_approved_docs(self):
        """Approved and empty-status docs should not be flagged."""
        svc = AnomalyDetectionService()
        docs = self._make_client_docs("ClientC", [10, 10, 10, 10, 50], estado="aprobado")
        svc.monitoring = MagicMock()
        svc.monitoring.get_monitoring_data.return_value = docs

        result = svc.detect_anomalies(sigma_threshold=2.0)
        assert result["total_anomalies"] == 0

    @patch.object(AnomalyDetectionService, "__init__", lambda self: None)
    def test_anomaly_client_stats_structure(self):
        """Client stats should include mean, std_dev, count, min, max."""
        svc = AnomalyDetectionService()
        docs = self._make_client_docs("ClientD", [5, 10, 15, 20, 25])
        svc.monitoring = MagicMock()
        svc.monitoring.get_monitoring_data.return_value = docs

        result = svc.detect_anomalies()
        assert len(result["client_stats"]) == 1
        stat = result["client_stats"][0]
        assert "cliente" in stat
        assert "mean" in stat
        assert "std_dev" in stat
        assert "count" in stat
        assert "min" in stat
        assert "max" in stat
        assert stat["count"] == 5


class TestEndpoints:
    """Test the API endpoints via TestClient."""

    def test_team_workload_endpoint(self, client, auth_headers):
        """GET /api/v1/analytics/team-workload should return valid structure."""
        resp = client.get("/api/v1/analytics/team-workload", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "members" in data
        assert "avg_load" in data
        assert "max_load" in data
        assert "alerts" in data
        assert isinstance(data["members"], list)

    def test_anomaly_endpoint(self, client, auth_headers):
        """GET /api/v1/analytics/anomalies should return valid structure."""
        resp = client.get("/api/v1/analytics/anomalies", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "anomalies" in data
        assert "client_stats" in data
        assert "threshold_sigma" in data
        assert "total_anomalies" in data
        assert data["threshold_sigma"] == 2.0

    def test_anomaly_endpoint_custom_sigma(self, client, auth_headers):
        """GET /api/v1/analytics/anomalies?sigma=3.0 should accept custom sigma."""
        resp = client.get("/api/v1/analytics/anomalies?sigma=3.0", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["threshold_sigma"] == 3.0
