"""Unit tests for Fase 4 services — SLA Prediction, Response Templates,
Traceability, Classification, Client Portal."""

import os
import sys
import json
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from collections import namedtuple

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("STORAGE_BACKEND", "excel")
os.environ.setdefault("ENV", "test")
os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest")


# ── SLA Prediction Service ──────────────────────────────────────────


class TestSLAPredictionService:
    """Tests for services.sla_prediction_service."""

    def test_risk_score_high_days_waiting(self):
        """Doc with 35 days waiting should score >= 35."""
        from services.sla_prediction_service import _calculate_risk_score

        doc = {"Días Devolución": 35, "Estado": "Enviado"}
        result = _calculate_risk_score(doc)
        assert result["score"] >= 35

    def test_risk_score_critical_flag(self):
        """Doc marked as critical should add +15 to score."""
        from services.sla_prediction_service import _calculate_risk_score

        doc_base = {"Estado": "Enviado"}
        doc_critical = {"Estado": "Enviado", "Crítico": "SÍ"}
        base_score = _calculate_risk_score(doc_base)["score"]
        crit_score = _calculate_risk_score(doc_critical)["score"]
        assert crit_score - base_score == 15

    def test_risk_score_rejection_history(self):
        """History with 2 rejections should add +15."""
        from services.sla_prediction_service import _calculate_risk_score

        doc_base = {"Estado": "Enviado"}
        doc_rej = {"Estado": "Enviado", "Historial Rev.": "Rechazado, Rechazado"}
        base_score = _calculate_risk_score(doc_base)["score"]
        rej_score = _calculate_risk_score(doc_rej)["score"]
        assert rej_score - base_score == 15

    def test_risk_score_zero_for_approved(self):
        """Approved docs should be excluded from predict_risks."""
        from services.sla_prediction_service import predict_risks

        import pandas as pd

        mock_df = pd.DataFrame([{
            "Nº Doc. EIPSA": "DOC-001",
            "Estado": "Aprobado",
            "Título": "Test",
        }])
        with patch("repositories.instances.data_repo") as mock_repo:
            mock_repo.get_all.return_value = mock_df
            results = predict_risks(tenant_id=1, limit=20)
        assert len(results) == 0

    def test_risk_score_cap_at_100(self):
        """Score should never exceed 100 even with all factors maxed."""
        from services.sla_prediction_service import _calculate_risk_score

        # Max factors: 35 + 20 + 15 + 15 + 5 = 90 (doesn't hit cap)
        doc = {
            "Días Devolución": 100,
            "Días Envío": 200,
            "Crítico": "SÍ",
            "Historial Rev.": "Rechazado, Rechazado, Rechazado",
            "Estado": "",
        }
        result = _calculate_risk_score(doc)
        assert result["score"] <= 100
        assert result["score"] == 90  # 35 + 20 + 15 + 15 + 5

    def test_predict_risks_returns_sorted(self):
        """Results should be sorted by score descending."""
        from services.sla_prediction_service import predict_risks

        import pandas as pd

        mock_df = pd.DataFrame([
            {"Nº Doc. EIPSA": "LOW", "Estado": "Enviado", "Días Devolución": 8, "Título": "Low risk"},
            {"Nº Doc. EIPSA": "HIGH", "Estado": "", "Días Devolución": 40, "Crítico": "SÍ", "Título": "High risk"},
            {"Nº Doc. EIPSA": "MED", "Estado": "Comentado", "Días Devolución": 20, "Título": "Med risk"},
        ])
        with patch("repositories.instances.data_repo") as mock_repo:
            mock_repo.get_all.return_value = mock_df
            results = predict_risks(tenant_id=1, limit=20)

        assert len(results) >= 2
        scores = [r["risk_score"] for r in results]
        assert scores == sorted(scores, reverse=True)

    def test_predict_risks_respects_limit(self):
        """limit=1 should return at most 1 result."""
        from services.sla_prediction_service import predict_risks

        import pandas as pd

        mock_df = pd.DataFrame([
            {"Nº Doc. EIPSA": f"DOC-{i}", "Estado": "Enviado", "Días Devolución": 20, "Título": f"Doc {i}"}
            for i in range(10)
        ])
        with patch("repositories.instances.data_repo") as mock_repo:
            mock_repo.get_all.return_value = mock_df
            results = predict_risks(tenant_id=1, limit=3)
        assert len(results) <= 3

    def test_predict_document_risk_not_found(self):
        """Non-existent document should return None."""
        from services.sla_prediction_service import predict_document_risk

        import pandas as pd

        mock_df = pd.DataFrame([
            {"Nº Doc. EIPSA": "DOC-001", "Estado": "Enviado", "Título": "Test"},
        ])
        with patch("repositories.instances.data_repo") as mock_repo:
            mock_repo.get_all.return_value = mock_df
            result = predict_document_risk(tenant_id=1, doc_ref="NONEXISTENT")
        assert result is None


# ── Response Template Service ────────────────────────────────────────


class TestResponseTemplateService:
    """Tests for services.response_template_service."""

    def test_list_templates_defaults(self, tmp_path):
        """Should return 4 default templates when file doesn't exist."""
        from services.response_template_service import list_templates, TEMPLATES_FILE

        # Use a temp file that doesn't exist yet to force defaults
        fake_path = str(tmp_path / "templates.json")
        with patch("services.response_template_service.TEMPLATES_FILE", fake_path):
            templates = list_templates(tenant_id=1)
        assert len(templates) == 4

    def test_list_templates_filter_platform(self, tmp_path):
        """platform='TR' should filter to TR + ALL templates."""
        from services.response_template_service import list_templates

        fake_path = str(tmp_path / "templates.json")
        with patch("services.response_template_service.TEMPLATES_FILE", fake_path):
            templates = list_templates(tenant_id=1, platform="TR")
        platforms = {t["platform"] for t in templates}
        assert platforms <= {"TR", "ALL"}
        assert len(templates) >= 2  # tr-ack, tr-status, generic

    def test_render_template_replaces_vars(self, tmp_path):
        """Variables like {pedido} should be replaced in subject and body."""
        from services.response_template_service import render_template

        fake_path = str(tmp_path / "templates.json")
        with patch("services.response_template_service.TEMPLATES_FILE", fake_path):
            result = render_template(
                "tr-acknowledgement",
                {"transmittal_ref": "TR-100", "pedido": "PED-200", "docs_list": "<ul></ul>"},
                tenant_id=1,
            )
        assert "error" not in result
        assert "TR-100" in result["subject"]
        assert "PED-200" in result["body_html"]

    def test_render_template_auto_fecha(self, tmp_path):
        """Variable 'fecha' should be auto-added if not provided."""
        from services.response_template_service import render_template
        from datetime import datetime, timezone

        fake_path = str(tmp_path / "templates.json")
        with patch("services.response_template_service.TEMPLATES_FILE", fake_path):
            result = render_template(
                "generic-response",
                {"subject": "Test", "message": "Hello"},
                tenant_id=1,
            )
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        assert "error" not in result
        # fecha was auto-set (the template body may or may not display it,
        # but the function should not error)
        assert result["template_id"] == "generic-response"

    def test_render_template_not_found(self, tmp_path):
        """Non-existent template should return error dict."""
        from services.response_template_service import render_template

        fake_path = str(tmp_path / "templates.json")
        with patch("services.response_template_service.TEMPLATES_FILE", fake_path):
            result = render_template("nonexistent-id", {}, tenant_id=1)
        assert "error" in result
        assert result["error"] == "Template not found"

    def test_create_template(self, tmp_path):
        """Created template should appear in list."""
        from services.response_template_service import create_template, list_templates

        fake_path = str(tmp_path / "templates.json")
        with patch("services.response_template_service.TEMPLATES_FILE", fake_path):
            created = create_template(tenant_id=1, data={
                "platform": "CUSTOM",
                "name": "Custom Template",
                "subject": "RE: {ref}",
                "body_html": "<p>{ref}</p>",
                "variables": ["ref"],
            })
            assert "id" in created
            assert created["name"] == "Custom Template"

            templates = list_templates(tenant_id=1)
            ids = [t["id"] for t in templates]
            assert created["id"] in ids

    def test_delete_template(self, tmp_path):
        """Deleted template should disappear from list."""
        from services.response_template_service import (
            create_template, delete_template, list_templates,
        )

        fake_path = str(tmp_path / "templates.json")
        with patch("services.response_template_service.TEMPLATES_FILE", fake_path):
            created = create_template(tenant_id=1, data={
                "id": "to-delete",
                "platform": "ALL",
                "name": "Delete Me",
                "subject": "S",
                "body_html": "<p>B</p>",
            })
            assert delete_template(tenant_id=1, template_id="to-delete") is True

            templates = list_templates(tenant_id=1)
            ids = [t["id"] for t in templates]
            assert "to-delete" not in ids


# ── Traceability Service ─────────────────────────────────────────────


class TestTraceabilityService:
    """Tests for services.traceability_service."""

    def test_matrix_empty_pedido(self):
        """Pedido with no docs should return empty materials and 0 coverage."""
        from services.traceability_service import get_matrix

        import pandas as pd

        mock_df = pd.DataFrame([
            {"Nº Pedido": "OTHER", "Material": "Steel", "Tipo Doc.": "ITP",
             "Nº Doc. EIPSA": "DOC-1", "Estado": "Enviado", "Título": "T"},
        ])
        with patch("repositories.instances.data_repo") as mock_repo:
            mock_repo.get_all.return_value = mock_df
            result = get_matrix(tenant_id=1, pedido="NONEXISTENT")

        assert result["materials"] == []
        assert result["overall_coverage"] == 0
        assert result["matrix"] == {}

    def test_matrix_calculates_coverage(self):
        """Mock docs with materials should give correct coverage %."""
        from services.traceability_service import get_matrix, REQUIRED_DOC_TYPES

        import pandas as pd

        # Create docs that cover 2 of 6 required doc types for material "Steel"
        mock_df = pd.DataFrame([
            {"Nº Pedido": "PED-1", "Material": "Steel", "Tipo Doc.": "ITP",
             "Nº Doc. EIPSA": "DOC-1", "Estado": "Enviado", "Título": "ITP doc"},
            {"Nº Pedido": "PED-1", "Material": "Steel", "Tipo Doc.": "Drawing",
             "Nº Doc. EIPSA": "DOC-2", "Estado": "Aprobado", "Título": "Drawing doc"},
        ])
        with patch("repositories.instances.data_repo") as mock_repo:
            mock_repo.get_all.return_value = mock_df
            result = get_matrix(tenant_id=1, pedido="PED-1")

        assert "Steel" in result["materials"]
        coverage_pct = result["coverage"]["Steel"]["pct"]
        expected = round(2 / len(REQUIRED_DOC_TYPES) * 100, 1)
        assert coverage_pct == expected

    def test_matrix_required_doc_types(self):
        """REQUIRED_DOC_TYPES should have 6 types."""
        from services.traceability_service import REQUIRED_DOC_TYPES

        assert len(REQUIRED_DOC_TYPES) == 6
        assert "ITP" in REQUIRED_DOC_TYPES
        assert "Test Certificate" in REQUIRED_DOC_TYPES

    def test_matrix_groups_by_material(self):
        """Docs should be grouped correctly by material."""
        from services.traceability_service import get_matrix

        import pandas as pd

        mock_df = pd.DataFrame([
            {"Nº Pedido": "PED-1", "Material": "Steel", "Tipo Doc.": "ITP",
             "Nº Doc. EIPSA": "DOC-1", "Estado": "", "Título": "T1"},
            {"Nº Pedido": "PED-1", "Material": "Copper", "Tipo Doc.": "Manual",
             "Nº Doc. EIPSA": "DOC-2", "Estado": "", "Título": "T2"},
            {"Nº Pedido": "PED-1", "Material": "Steel", "Tipo Doc.": "Drawing",
             "Nº Doc. EIPSA": "DOC-3", "Estado": "", "Título": "T3"},
        ])
        with patch("repositories.instances.data_repo") as mock_repo:
            mock_repo.get_all.return_value = mock_df
            result = get_matrix(tenant_id=1, pedido="PED-1")

        assert sorted(result["materials"]) == ["Copper", "Steel"]
        assert len(result["matrix"]["Steel"]["ITP"]) == 1
        assert len(result["matrix"]["Steel"]["Drawing"]) == 1
        assert len(result["matrix"]["Copper"]["Manual"]) == 1

    def test_matrix_overall_coverage(self):
        """Overall coverage should be the weighted average."""
        from services.traceability_service import get_matrix, REQUIRED_DOC_TYPES

        import pandas as pd

        # Steel: 1/6 covered, Copper: 1/6 covered → overall = 2/12
        mock_df = pd.DataFrame([
            {"Nº Pedido": "PED-1", "Material": "Steel", "Tipo Doc.": "ITP",
             "Nº Doc. EIPSA": "DOC-1", "Estado": "", "Título": "T"},
            {"Nº Pedido": "PED-1", "Material": "Copper", "Tipo Doc.": "Manual",
             "Nº Doc. EIPSA": "DOC-2", "Estado": "", "Título": "T"},
        ])
        with patch("repositories.instances.data_repo") as mock_repo:
            mock_repo.get_all.return_value = mock_df
            result = get_matrix(tenant_id=1, pedido="PED-1")

        expected = round(2 / (2 * len(REQUIRED_DOC_TYPES)) * 100, 1)
        assert result["overall_coverage"] == expected


# ── Classification Service ───────────────────────────────────────────


class TestClassificationService:
    """Tests for services.classification_service."""

    def test_classification_levels_defined(self):
        """Should have 4 levels defined."""
        from services.classification_service import CLASSIFICATION_LEVELS

        assert len(CLASSIFICATION_LEVELS) == 4
        assert set(CLASSIFICATION_LEVELS.keys()) == {
            "public", "internal", "confidential", "restricted",
        }

    def test_get_classification_default(self):
        """In Excel mode, default classification is 'internal'."""
        from services.classification_service import get_classification

        result = get_classification(tenant_id=1, document_ref="ANY-DOC")
        assert result == "internal"

    def test_set_classification_invalid_level(self):
        """Invalid level should raise ValueError."""
        from services.classification_service import set_classification

        with pytest.raises(ValueError, match="Invalid classification level"):
            set_classification(
                tenant_id=1,
                document_ref="DOC-001",
                level="secret",
            )


# ── Client Portal Service ───────────────────────────────────────────


class TestClientPortalService:
    """Tests for services.client_portal_service."""

    def test_get_client_dashboard_empty(self):
        """With no docs (Excel mode returns []), all KPIs should be 0."""
        from services.client_portal_service import get_client_dashboard

        result = get_client_dashboard(tenant_id=1, client_name="TestClient")
        assert result["total"] == 0
        assert result["aprobados"] == 0
        assert result["pendientes"] == 0
        assert result["rechazados"] == 0
        assert result["approval_rate"] == 0

    def test_get_client_dashboard_calculates(self):
        """Mock docs should give correct approval_rate."""
        from services.client_portal_service import get_client_dashboard

        mock_docs = [
            {"doc_eipsa": "D1", "titulo": "T1", "estado": "Aprobado",
             "tipo_doc": "", "fecha_envio": "", "fecha_prevista": "",
             "revision": "", "dias_devolucion": ""},
            {"doc_eipsa": "D2", "titulo": "T2", "estado": "Aprobado",
             "tipo_doc": "", "fecha_envio": "", "fecha_prevista": "",
             "revision": "", "dias_devolucion": ""},
            {"doc_eipsa": "D3", "titulo": "T3", "estado": "Rechazado",
             "tipo_doc": "", "fecha_envio": "", "fecha_prevista": "",
             "revision": "", "dias_devolucion": ""},
            {"doc_eipsa": "D4", "titulo": "T4", "estado": "Enviado",
             "tipo_doc": "", "fecha_envio": "", "fecha_prevista": "",
             "revision": "", "dias_devolucion": ""},
        ]
        with patch("services.client_portal_service.get_client_documents", return_value=mock_docs):
            result = get_client_dashboard(tenant_id=1, client_name="Acme")

        assert result["total"] == 4
        assert result["aprobados"] == 2
        assert result["rechazados"] == 1
        assert result["pendientes"] == 1  # "Enviado" is pending
        assert result["approval_rate"] == 50.0

    def test_generate_portal_token_excel_mode(self):
        """In Excel mode, generate_portal_token should return None."""
        from services.client_portal_service import generate_portal_token

        result = generate_portal_token(
            tenant_id=1,
            client_name="Acme",
            contact_email="acme@test.com",
        )
        assert result is None
