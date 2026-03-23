"""Integration tests for Fase 4 routers — Classification, Predictions,
Response Templates, Portal."""

import os
import sys
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("STORAGE_BACKEND", "excel")
os.environ.setdefault("ENV", "test")
os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest")


# ── Classification Router ────────────────────────────────────────────


class TestClassificationRouter:

    def test_get_classification_requires_auth(self, client):
        r = client.get("/api/v1/classification/DOC-001")
        assert r.status_code == 401

    def test_get_classification_ok(self, client, auth_headers):
        with patch(
            "routers.classification.get_classification", return_value="confidential"
        ):
            r = client.get("/api/v1/classification/DOC-001", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["document_ref"] == "DOC-001"
        assert data["level"] == "confidential"

    def test_put_classification_ok(self, client, auth_headers):
        with patch(
            "routers.classification.set_classification", return_value=True
        ):
            r = client.put(
                "/api/v1/classification/DOC-001",
                json={"level": "restricted"},
                headers=auth_headers,
            )
        assert r.status_code == 200
        assert r.json()["level"] == "restricted"

    def test_put_classification_invalid_level(self, client, auth_headers):
        r = client.put(
            "/api/v1/classification/DOC-001",
            json={"level": "secret"},
            headers=auth_headers,
        )
        assert r.status_code == 400


# ── Predictions Router ───────────────────────────────────────────────


class TestPredictionsRouter:

    def test_at_risk_requires_auth(self, client):
        r = client.get("/api/v1/predictions/at-risk")
        assert r.status_code == 401

    def test_at_risk_returns_list(self, client, auth_headers):
        mock_data = [
            {"doc_eipsa": "DOC-1", "risk_score": 80, "reasons": ["test"], "actions": []},
        ]
        with patch(
            "routers.predictions.predict_risks", return_value=mock_data
        ):
            r = client.get("/api/v1/predictions/at-risk", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) == 1

    def test_document_prediction_ok(self, client, auth_headers):
        mock_risk = {
            "doc_eipsa": "DOC-1", "risk_score": 45,
            "reasons": ["15 días esperando"], "actions": ["Recordar"],
            "titulo": "Test", "estado": "Enviado",
        }
        with patch(
            "routers.predictions.predict_document_risk", return_value=mock_risk
        ):
            r = client.get(
                "/api/v1/predictions/document/DOC-1", headers=auth_headers
            )
        assert r.status_code == 200
        assert r.json()["risk_score"] == 45

    def test_document_prediction_not_found(self, client, auth_headers):
        with patch(
            "routers.predictions.predict_document_risk", return_value=None
        ):
            r = client.get(
                "/api/v1/predictions/document/NOPE", headers=auth_headers
            )
        assert r.status_code == 404


# ── Response Templates Router ────────────────────────────────────────


class TestResponseTemplatesRouter:

    def test_list_templates_requires_auth(self, client):
        r = client.get("/api/v1/response-templates/")
        assert r.status_code == 401

    def test_list_templates_ok(self, client, auth_headers):
        mock_list = [{"id": "t1", "name": "Template 1"}]
        with patch(
            "routers.response_templates.list_templates", return_value=mock_list
        ):
            r = client.get("/api/v1/response-templates/", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_template_ok(self, client, auth_headers):
        mock_created = {
            "id": "custom-1", "platform": "ALL", "name": "New",
            "subject": "S", "body_html": "<p>B</p>", "variables": [],
        }
        with patch(
            "routers.response_templates.create_template", return_value=mock_created
        ):
            r = client.post(
                "/api/v1/response-templates/",
                json={
                    "name": "New",
                    "subject": "S",
                    "body_html": "<p>B</p>",
                },
                headers=auth_headers,
            )
        assert r.status_code == 200
        assert r.json()["id"] == "custom-1"

    def test_render_template_ok(self, client, auth_headers):
        mock_rendered = {
            "subject": "RE: TR-100", "body_html": "<p>ok</p>",
            "template_id": "tr-acknowledgement",
        }
        with patch(
            "routers.response_templates.render_template", return_value=mock_rendered
        ):
            r = client.post(
                "/api/v1/response-templates/render",
                json={
                    "template_id": "tr-acknowledgement",
                    "variables": {"transmittal_ref": "TR-100"},
                },
                headers=auth_headers,
            )
        assert r.status_code == 200
        assert "TR-100" in r.json()["subject"]

    def test_delete_template_not_found(self, client, auth_headers):
        with patch(
            "routers.response_templates.delete_template", return_value=False
        ):
            r = client.delete(
                "/api/v1/response-templates/nonexistent",
                headers=auth_headers,
            )
        assert r.status_code == 404


# ── Portal Router ────────────────────────────────────────────────────


class TestPortalRouter:

    def test_create_access_requires_auth(self, client):
        r = client.post(
            "/api/v1/portal/access",
            json={"client_name": "Acme", "contact_email": "a@b.com"},
        )
        assert r.status_code == 401

    def test_create_access_ok(self, client, auth_headers):
        with patch(
            "routers.portal.generate_portal_token", return_value="portal_abc123"
        ):
            r = client.post(
                "/api/v1/portal/access",
                json={"client_name": "Acme", "contact_email": "a@b.com"},
                headers=auth_headers,
            )
        assert r.status_code == 200
        assert r.json()["token"] == "portal_abc123"
        assert r.json()["client_name"] == "Acme"

    def test_portal_documents_valid_token(self, client):
        mock_client = {
            "id": 1, "tenant_id": 1,
            "client_name": "Acme", "contact_email": "a@b.com",
        }
        mock_docs = [{"doc_eipsa": "DOC-1", "titulo": "Test"}]
        with patch("routers.portal.validate_portal_token", return_value=mock_client), \
             patch("routers.portal.get_client_documents", return_value=mock_docs):
            r = client.get("/api/v1/portal/documents?token=valid_tok")
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_portal_documents_invalid_token(self, client):
        with patch("routers.portal.validate_portal_token", return_value=None):
            r = client.get("/api/v1/portal/documents?token=bad_token")
        assert r.status_code == 401

    def test_portal_dashboard_valid_token(self, client):
        mock_client = {
            "id": 1, "tenant_id": 1,
            "client_name": "Acme", "contact_email": "a@b.com",
        }
        mock_kpis = {
            "client_name": "Acme", "total": 10, "aprobados": 5,
            "pendientes": 3, "rechazados": 2, "approval_rate": 50.0,
        }
        with patch("routers.portal.validate_portal_token", return_value=mock_client), \
             patch("routers.portal.get_client_dashboard", return_value=mock_kpis):
            r = client.get("/api/v1/portal/dashboard?token=valid_tok")
        assert r.status_code == 200
        assert r.json()["approval_rate"] == 50.0


# ── Tenant Isolation ─────────────────────────────────────────────────


class TestTenantIsolation:

    def test_classification_passes_tenant_id(self, client, auth_headers, auth_headers_tenant2):
        """Verify tenant_id from token is forwarded to service."""
        with patch(
            "routers.classification.get_classification", return_value="internal"
        ) as mock_get:
            client.get("/api/v1/classification/DOC-1", headers=auth_headers)
            mock_get.assert_called_with(1, "DOC-1")

            client.get("/api/v1/classification/DOC-1", headers=auth_headers_tenant2)
            mock_get.assert_called_with(2, "DOC-1")

    def test_predictions_passes_tenant_id(self, client, auth_headers, auth_headers_tenant2):
        """Verify tenant_id from token is forwarded to predictions service."""
        with patch(
            "routers.predictions.predict_risks", return_value=[]
        ) as mock_pred:
            client.get("/api/v1/predictions/at-risk", headers=auth_headers)
            mock_pred.assert_called_with(1, 20)

            client.get("/api/v1/predictions/at-risk", headers=auth_headers_tenant2)
            mock_pred.assert_called_with(2, 20)
