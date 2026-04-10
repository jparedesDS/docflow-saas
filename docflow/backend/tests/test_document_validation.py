"""Tests for document Pydantic schemas and validated endpoint."""

import pytest
from unittest.mock import patch, MagicMock
from pydantic import ValidationError

from models.document import DocumentCreate, DocumentUpdate, DocumentResponse


# ---------------------------------------------------------------------------
# Unit tests — Pydantic models
# ---------------------------------------------------------------------------

class TestDocumentCreateSchema:
    """Unit tests for DocumentCreate model."""

    def test_create_with_aliases(self):
        """Create using Excel column names (aliases)."""
        doc = DocumentCreate(**{
            "Nº Doc. EIPSA": "EIPSA-001",
            "Título": "Test Document",
            "Nº Pedido": "PED-001",
        })
        assert doc.doc_eipsa == "EIPSA-001"
        assert doc.titulo == "Test Document"
        assert doc.pedido == "PED-001"

    def test_create_with_python_names(self):
        """Create using Python field names (populate_by_name=True)."""
        doc = DocumentCreate(doc_eipsa="EIPSA-002", titulo="Test 2")
        assert doc.doc_eipsa == "EIPSA-002"
        assert doc.titulo == "Test 2"

    def test_create_missing_required_raises(self):
        """Missing required fields should raise ValidationError."""
        with pytest.raises(ValidationError):
            DocumentCreate()  # Missing doc_eipsa and titulo

    def test_create_missing_doc_eipsa_raises(self):
        """Missing only doc_eipsa should raise ValidationError."""
        with pytest.raises(ValidationError):
            DocumentCreate(titulo="Has title only")

    def test_create_missing_titulo_raises(self):
        """Missing only titulo should raise ValidationError."""
        with pytest.raises(ValidationError):
            DocumentCreate(doc_eipsa="EIPSA-005")

    def test_dump_by_alias(self):
        """model_dump(by_alias=True) should produce Excel column names."""
        doc = DocumentCreate(doc_eipsa="EIPSA-003", titulo="Test 3", pedido="PED-003")
        data = doc.model_dump(by_alias=True, exclude_none=True)
        assert "Nº Doc. EIPSA" in data
        assert "Título" in data
        assert "Nº Pedido" in data
        assert data["Nº Doc. EIPSA"] == "EIPSA-003"

    def test_dump_by_python_name(self):
        """model_dump() without by_alias uses Python field names."""
        doc = DocumentCreate(doc_eipsa="EIPSA-006", titulo="Test 6")
        data = doc.model_dump()
        assert "doc_eipsa" in data
        assert "titulo" in data

    def test_responsable_typo_preserved(self):
        """The intentional 'Repsonsable' typo must be preserved in aliases."""
        doc = DocumentCreate(
            doc_eipsa="EIPSA-004",
            titulo="Test 4",
            responsable="JP",
        )
        data = doc.model_dump(by_alias=True, exclude_none=True)
        assert "Repsonsable" in data
        assert "Responsable" not in data  # NOT the correct spelling
        assert data["Repsonsable"] == "JP"

    def test_default_pedido_empty_string(self):
        """Pedido defaults to empty string, not None."""
        doc = DocumentCreate(doc_eipsa="EIPSA-007", titulo="Test 7")
        assert doc.pedido == ""

    def test_optional_fields_default_none(self):
        """Optional fields default to None."""
        doc = DocumentCreate(doc_eipsa="EIPSA-008", titulo="Test 8")
        assert doc.cliente is None
        assert doc.estado is None
        assert doc.responsable is None
        assert doc.tipo_documento is None
        assert doc.rev is None
        assert doc.supp is None
        assert doc.material is None
        assert doc.critico is None

    def test_all_fields_populated(self):
        """All fields can be set together."""
        doc = DocumentCreate(
            doc_eipsa="EIPSA-009",
            titulo="Complete Document",
            pedido="PED-009",
            cliente="ACME Corp",
            estado="Aprobado",
            responsable="JP",
            tipo_documento="Plano",
            rev="A",
            supp="S1",
            material="Acero",
            critico="Sí",
        )
        data = doc.model_dump(by_alias=True, exclude_none=True)
        assert len(data) == 11  # All 11 fields present


class TestDocumentUpdateSchema:
    """Unit tests for DocumentUpdate model."""

    def test_update_all_optional(self):
        """Update schema should allow partial updates."""
        update = DocumentUpdate(**{"Estado": "aprobado"})
        assert update.estado == "aprobado"
        data = update.model_dump(by_alias=True, exclude_none=True)
        assert data == {"Estado": "aprobado"}

    def test_update_empty_is_valid(self):
        """Empty update body is valid (all fields optional)."""
        update = DocumentUpdate()
        data = update.model_dump(by_alias=True, exclude_none=True)
        assert data == {}

    def test_update_multiple_fields(self):
        """Multiple fields can be updated at once."""
        update = DocumentUpdate(
            estado="Rechazado",
            responsable="AC",
            rev="B",
        )
        data = update.model_dump(by_alias=True, exclude_none=True)
        assert data["Estado"] == "Rechazado"
        assert data["Repsonsable"] == "AC"
        assert data["Rev."] == "B"

    def test_update_with_alias_keys(self):
        """Update using Excel alias keys."""
        update = DocumentUpdate(**{
            "Título": "New Title",
            "Nº Pedido": "PED-NEW",
        })
        assert update.titulo == "New Title"
        assert update.pedido == "PED-NEW"

    def test_update_responsable_typo_preserved(self):
        """The intentional 'Repsonsable' typo must be preserved."""
        update = DocumentUpdate(**{"Repsonsable": "LB"})
        data = update.model_dump(by_alias=True, exclude_none=True)
        assert "Repsonsable" in data
        assert data["Repsonsable"] == "LB"


class TestDocumentResponseSchema:
    """Unit tests for DocumentResponse model (pass-through)."""

    def test_response_allows_extra_fields(self):
        """DocumentResponse should allow arbitrary extra fields."""
        resp = DocumentResponse(**{
            "Nº Doc. EIPSA": "EIPSA-100",
            "Título": "Response Test",
            "custom_field": "custom_value",
        })
        # extra="allow" means all fields are accessible
        assert resp.model_dump()["custom_field"] == "custom_value"

    def test_response_empty_is_valid(self):
        """Empty response body is valid."""
        resp = DocumentResponse()
        assert resp.model_dump() == {}


# ---------------------------------------------------------------------------
# Integration tests — router endpoints
# ---------------------------------------------------------------------------

class TestDocumentEndpointValidation:
    """Integration tests for document create with validation."""

    def test_create_document_without_required_fields_returns_422(self, client, auth_headers):
        """POST /documents/ with empty data should return 422 (light validation)."""
        resp = client.post("/api/v1/documents/", json={}, headers=auth_headers)
        assert resp.status_code == 422

    def test_create_document_missing_titulo_returns_422(self, client, auth_headers):
        """POST /documents/ with only doc number but no title should return 422."""
        resp = client.post(
            "/api/v1/documents/",
            json={"Nº Doc. EIPSA": "TEST-001"},
            headers=auth_headers,
        )
        assert resp.status_code == 422
        assert "Título" in resp.json()["detail"]

    @patch("services.document_service.DocumentService.create")
    def test_create_document_with_valid_data(self, mock_create, client, auth_headers):
        """POST /documents/ with valid EIPSA data should succeed."""
        mock_create.return_value = {
            "Nº Doc. EIPSA": "TEST-001",
            "Título": "Test Document",
            "Nº Pedido": "PED-TEST",
            "Estado": "",
        }
        resp = client.post("/api/v1/documents/", json={
            "Nº Doc. EIPSA": "TEST-001",
            "Título": "Test Document",
            "Nº Pedido": "PED-TEST",
            "Estado": "",
        }, headers=auth_headers)
        assert resp.status_code == 200

    def test_create_document_requires_auth(self, client):
        """POST /documents/ without auth should return 401."""
        resp = client.post("/api/v1/documents/", json={
            "Nº Doc. EIPSA": "TEST-001",
            "Título": "Test Document",
        })
        assert resp.status_code == 401


class TestValidatedEndpoint:
    """Integration tests for the new /validated endpoint with strict schema."""

    def test_validated_requires_auth(self, client):
        """POST /documents/validated without auth should return 401."""
        resp = client.post("/api/v1/documents/validated", json={
            "Nº Doc. EIPSA": "TEST-001",
            "Título": "Test Document",
        })
        assert resp.status_code == 401

    def test_validated_missing_fields_returns_422(self, client, auth_headers):
        """POST /documents/validated with empty body should return 422."""
        resp = client.post(
            "/api/v1/documents/validated",
            json={},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_validated_missing_titulo_returns_422(self, client, auth_headers):
        """POST /documents/validated missing titulo should return 422."""
        resp = client.post(
            "/api/v1/documents/validated",
            json={"Nº Doc. EIPSA": "TEST-001"},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @patch("services.document_service.DocumentService.create")
    def test_validated_with_alias_keys(self, mock_create, client, auth_headers):
        """POST /documents/validated with Excel column names should succeed."""
        mock_create.return_value = {
            "Nº Doc. EIPSA": "TEST-V01",
            "Título": "Validated Doc",
            "Nº Pedido": "PED-V01",
        }
        resp = client.post(
            "/api/v1/documents/validated",
            json={
                "Nº Doc. EIPSA": "TEST-V01",
                "Título": "Validated Doc",
                "Nº Pedido": "PED-V01",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        mock_create.assert_called_once()
        call_data = mock_create.call_args[0][0]
        assert call_data["Nº Doc. EIPSA"] == "TEST-V01"

    @patch("services.document_service.DocumentService.create")
    def test_validated_with_python_names(self, mock_create, client, auth_headers):
        """POST /documents/validated with Python field names should also work."""
        mock_create.return_value = {
            "Nº Doc. EIPSA": "TEST-V02",
            "Título": "Validated Doc 2",
        }
        resp = client.post(
            "/api/v1/documents/validated",
            json={
                "doc_eipsa": "TEST-V02",
                "titulo": "Validated Doc 2",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        mock_create.assert_called_once()
        # Data sent to service should use alias (Excel) names
        call_data = mock_create.call_args[0][0]
        assert "Nº Doc. EIPSA" in call_data

    @patch("services.document_service.DocumentService.create")
    def test_validated_responsable_typo(self, mock_create, client, auth_headers):
        """POST /documents/validated preserves 'Repsonsable' typo."""
        mock_create.return_value = {
            "Nº Doc. EIPSA": "TEST-V03",
            "Título": "Typo Test",
            "Repsonsable": "JP",
        }
        resp = client.post(
            "/api/v1/documents/validated",
            json={
                "Nº Doc. EIPSA": "TEST-V03",
                "Título": "Typo Test",
                "Repsonsable": "JP",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        call_data = mock_create.call_args[0][0]
        assert "Repsonsable" in call_data
        assert call_data["Repsonsable"] == "JP"

    @patch("services.document_service.DocumentService.create")
    def test_validated_excludes_none_fields(self, mock_create, client, auth_headers):
        """POST /documents/validated should not send None fields to service."""
        mock_create.return_value = {
            "Nº Doc. EIPSA": "TEST-V04",
            "Título": "Minimal",
        }
        resp = client.post(
            "/api/v1/documents/validated",
            json={
                "Nº Doc. EIPSA": "TEST-V04",
                "Título": "Minimal",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        call_data = mock_create.call_args[0][0]
        # Only non-None fields: doc_eipsa, titulo, pedido (default "")
        assert "Nº Doc. EIPSA" in call_data
        assert "Título" in call_data
        assert "Nº Pedido" in call_data  # default ""
        # None fields should be excluded
        assert "Cliente" not in call_data
        assert "Repsonsable" not in call_data
