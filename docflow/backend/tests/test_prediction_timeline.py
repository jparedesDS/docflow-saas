"""Tests for enhanced order prediction and document timeline services."""

import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path

# Ensure backend directory is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("ENV", "test")
os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest")
os.environ.setdefault("STORAGE_BACKEND", "excel")


# ── Sample document fixtures ────────────────────────────────────────

def _make_doc(**overrides):
    """Create a test document dict with sensible defaults."""
    base = {
        "Nº Pedido": "PO-001",
        "Nº Doc. EIPSA": "DOC-001",
        "Título": "Test Document",
        "Estado": "Enviado",
        "Cliente": "ACME Corp",
        "Crítico": "",
        "Nº Revisión": 0,
        "Días Envío": 10,
        "Días Devolución": 5,
        "Fecha Pedido": "2025-01-01",
        "Fecha Env. Doc.": "2025-01-15",
        "Repsonsable": "JP",
        "Tipo Doc.": "Plano",
        "Historial Rev.": "",
        "Responsable": "AC",
        "Material": "Steel",
    }
    base.update(overrides)
    return base


# ── Enhanced Prediction Service Tests ────────────────────────────────


class TestEnhancedPredictionCompleted:
    """Test that a fully approved order returns days_remaining=0."""

    def test_predict_completed_order(self):
        docs = [
            _make_doc(Estado="Aprobado", **{"Nº Doc. EIPSA": f"DOC-{i}"})
            for i in range(5)
        ]
        mock_mon = MagicMock()
        with patch(
            "services.enhanced_prediction_service.monitoring_service", mock_mon
        ), patch(
            "services.enhanced_prediction_service.get_scorecard",
            return_value=[],
        ):
            mock_mon.get_monitoring_data.return_value = docs

            from services.enhanced_prediction_service import EnhancedPredictionService

            svc = EnhancedPredictionService()
            svc.monitoring = mock_mon

            result = svc.predict_orders(tenant_id=1)
            assert isinstance(result, list)
            assert len(result) == 1
            pred = result[0]
            assert pred["status"] == "completed"
            assert pred["days_remaining"] == 0
            assert pred["pct_complete"] == 100


class TestEnhancedPredictionCriticalFactor:
    """Test that critical pending docs increase prediction time."""

    def test_predict_factors_critical_docs(self):
        # Use "Comentado" estado so critical docs land in the else branch
        # (criticos_pending only counts non-aprobado/enviado/sin-enviar critical docs)
        docs = [
            _make_doc(Estado="Aprobado", **{"Nº Doc. EIPSA": "DOC-1"}),
            _make_doc(Estado="Comentado", **{"Nº Doc. EIPSA": "DOC-2", "Crítico": "Sí"}),
            _make_doc(Estado="Comentado", **{"Nº Doc. EIPSA": "DOC-3", "Crítico": "Sí"}),
            _make_doc(Estado="Enviado", **{"Nº Doc. EIPSA": "DOC-4"}),
        ]
        mock_mon = MagicMock()
        with patch(
            "services.enhanced_prediction_service.monitoring_service", mock_mon
        ), patch(
            "services.enhanced_prediction_service.get_scorecard",
            return_value=[{"client": "ACME Corp", "avg_response_days": 20, "total_docs": 50}],
        ):
            mock_mon.get_monitoring_data.return_value = docs

            from services.enhanced_prediction_service import EnhancedPredictionService

            svc = EnhancedPredictionService()
            svc.monitoring = mock_mon

            result = svc.predict_orders(tenant_id=1)
            assert len(result) == 1
            pred = result[0]
            assert pred["factors"]["critical_factor"] > 1.0
            assert pred["criticos_pending"] == 2


class TestEnhancedPredictionUnsentFactor:
    """Test that unsent docs increase prediction time."""

    def test_predict_factors_unsent_docs(self):
        docs = [
            _make_doc(Estado="Aprobado", **{"Nº Doc. EIPSA": "DOC-1"}),
            _make_doc(Estado="", **{"Nº Doc. EIPSA": "DOC-2"}),
            _make_doc(Estado="", **{"Nº Doc. EIPSA": "DOC-3"}),
        ]
        mock_mon = MagicMock()
        with patch(
            "services.enhanced_prediction_service.monitoring_service", mock_mon
        ), patch(
            "services.enhanced_prediction_service.get_scorecard",
            return_value=[{"client": "ACME Corp", "avg_response_days": 20, "total_docs": 50}],
        ):
            mock_mon.get_monitoring_data.return_value = docs

            from services.enhanced_prediction_service import EnhancedPredictionService

            svc = EnhancedPredictionService()
            svc.monitoring = mock_mon

            result = svc.predict_orders(tenant_id=1)
            assert len(result) == 1
            pred = result[0]
            assert pred["factors"]["unsent_factor"] > 1.0
            assert pred["sin_enviar"] == 2


class TestEnhancedPredictionConfidence:
    """Test confidence is based on client data availability."""

    def test_predict_confidence_low_with_little_data(self):
        docs = [
            _make_doc(Estado="Enviado", **{"Nº Doc. EIPSA": "DOC-1"}),
        ]
        # No client data in scorecard
        mock_mon = MagicMock()
        with patch(
            "services.enhanced_prediction_service.monitoring_service", mock_mon
        ), patch(
            "services.enhanced_prediction_service.get_scorecard",
            return_value=[],
        ):
            mock_mon.get_monitoring_data.return_value = docs

            from services.enhanced_prediction_service import EnhancedPredictionService

            svc = EnhancedPredictionService()
            svc.monitoring = mock_mon

            result = svc.predict_orders(tenant_id=1)
            assert len(result) == 1
            pred = result[0]
            # No client data → confidence should not be "high"
            assert pred["confidence"] in ("low", "medium")

    def test_predict_confidence_high_with_good_data(self):
        docs = [
            _make_doc(Estado="Aprobado", **{"Nº Doc. EIPSA": f"DOC-{i}"})
            for i in range(8)
        ] + [
            _make_doc(Estado="Enviado", **{"Nº Doc. EIPSA": "DOC-9"}),
            _make_doc(Estado="Enviado", **{"Nº Doc. EIPSA": "DOC-10"}),
        ]
        mock_mon = MagicMock()
        with patch(
            "services.enhanced_prediction_service.monitoring_service", mock_mon
        ), patch(
            "services.enhanced_prediction_service.get_scorecard",
            return_value=[
                {"client": "ACME Corp", "avg_response_days": 15, "total_docs": 100}
            ],
        ):
            mock_mon.get_monitoring_data.return_value = docs

            from services.enhanced_prediction_service import EnhancedPredictionService

            svc = EnhancedPredictionService()
            svc.monitoring = mock_mon

            result = svc.predict_orders(tenant_id=1)
            assert len(result) == 1
            pred = result[0]
            assert pred["confidence"] == "high"


# ── Document Timeline Service Tests ──────────────────────────────────


class TestDocTimelineBasicEvents:
    """Test timeline returns basic lifecycle events."""

    def test_timeline_basic_events(self):
        doc = _make_doc(
            Estado="Enviado",
            **{
                "Nº Doc. EIPSA": "DOC-001",
                "Fecha Pedido": "2025-01-01",
                "Fecha Env. Doc.": "2025-01-15",
            },
        )
        mock_mon = MagicMock()
        with patch(
            "services.doc_timeline_service.monitoring_service", mock_mon
        ), patch(
            "services.doc_timeline_service.list_comments",
            return_value=[],
        ), patch(
            "services.doc_timeline_service.read_json",
            return_value={},
        ):
            mock_mon.get_monitoring_data.return_value = [doc]

            from services.doc_timeline_service import DocTimelineService

            svc = DocTimelineService()
            svc.monitoring = mock_mon

            result = svc.get_timeline("DOC-001", tenant_id=1)
            assert result["doc_ref"] == "DOC-001"
            assert len(result["events"]) >= 2  # created + sent at minimum

            event_types = [e["type"] for e in result["events"]]
            assert "created" in event_types
            assert "sent" in event_types


class TestDocTimelineNotFound:
    """Test timeline returns error for non-existent document."""

    def test_timeline_doc_not_found(self):
        mock_mon = MagicMock()
        with patch(
            "services.doc_timeline_service.monitoring_service", mock_mon
        ), patch(
            "services.doc_timeline_service.list_comments",
            return_value=[],
        ), patch(
            "services.doc_timeline_service.read_json",
            return_value={},
        ):
            mock_mon.get_monitoring_data.return_value = []

            from services.doc_timeline_service import DocTimelineService

            svc = DocTimelineService()
            svc.monitoring = mock_mon

            result = svc.get_timeline("NONEXISTENT", tenant_id=1)
            assert result.get("error") == "Document not found"
            assert result["events"] == []


class TestDocTimelineComments:
    """Test timeline includes comments."""

    def test_timeline_includes_comments(self):
        doc = _make_doc(
            Estado="Enviado",
            **{
                "Nº Doc. EIPSA": "DOC-001",
                "Fecha Pedido": "2025-01-01",
                "Fecha Env. Doc.": "2025-01-15",
            },
        )
        fake_comments = [
            {
                "user_name": "Jose Paredes",
                "user_initials": "JP",
                "content": "Revisar urgente",
                "created_at": "2025-01-20T10:00:00",
            },
        ]
        mock_mon = MagicMock()
        with patch(
            "services.doc_timeline_service.monitoring_service", mock_mon
        ), patch(
            "services.doc_timeline_service.list_comments",
            return_value=fake_comments,
        ), patch(
            "services.doc_timeline_service.read_json",
            return_value={},
        ):
            mock_mon.get_monitoring_data.return_value = [doc]

            from services.doc_timeline_service import DocTimelineService

            svc = DocTimelineService()
            svc.monitoring = mock_mon

            result = svc.get_timeline("DOC-001", tenant_id=1)
            event_types = [e["type"] for e in result["events"]]
            assert "comment" in event_types


# ── API Endpoint Tests ───────────────────────────────────────────────


class TestPredictionEndpoint:
    """Test order-predictions API endpoint."""

    def test_prediction_endpoint(self, client, auth_headers):
        response = client.get(
            "/api/v1/predictions/order-predictions",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestTimelineEndpoint:
    """Test timeline API endpoint."""

    def test_timeline_endpoint_not_found(self, client, auth_headers):
        response = client.get(
            "/api/v1/predictions/timeline/NONEXISTENT-DOC",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_timeline_endpoint_returns_data(self, client, auth_headers):
        # First get a real doc ref from monitoring data
        response = client.get(
            "/api/v1/documents/monitoring",
            headers=auth_headers,
        )
        if response.status_code == 200 and response.json():
            doc_ref = response.json()[0].get("Nº Doc. EIPSA", "")
            if doc_ref:
                tl_response = client.get(
                    f"/api/v1/predictions/timeline/{doc_ref}",
                    headers=auth_headers,
                )
                assert tl_response.status_code == 200
                tl_data = tl_response.json()
                assert "doc_ref" in tl_data
                assert "events" in tl_data
                assert isinstance(tl_data["events"], list)
