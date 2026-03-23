"""Tests for bulk status update feature (transmittal → document registry)."""

import os
import sys
import pytest
from unittest.mock import patch, MagicMock, PropertyMock


class TestApplyStatuses:
    """Unit tests for transmittal_service.apply_statuses()."""

    def _make_mock_repo(self, docs):
        """Create a mock data_repo with given documents."""
        mock_repo = MagicMock()
        mock_repo.get_all.return_value = docs
        return mock_repo

    def test_apply_statuses_updates_matching_docs(self):
        """Should update documents that match by Nº Doc. EIPSA."""
        docs = [
            {"Nº Doc. EIPSA": "EIPSA-001", "Estado": "Enviado", "Título": "Doc 1"},
            {"Nº Doc. EIPSA": "EIPSA-002", "Estado": "Enviado", "Título": "Doc 2"},
        ]
        mock_repo = self._make_mock_repo(docs)
        mock_repo.update.return_value = {"Nº Doc. EIPSA": "EIPSA-001", "Estado": "Aprobado"}

        mock_notif = MagicMock()

        with patch("services.transmittal_service.data_repo", mock_repo, create=True), \
             patch("repositories.instances.data_repo", mock_repo), \
             patch("services.notification_service.notification_service", mock_notif):
            from services.transmittal_service import apply_statuses
            result = apply_statuses([
                {"doc_eipsa": "EIPSA-001", "new_status": "Aprobado", "titulo": "Doc 1"},
            ])

        assert result["updated"] == 1
        mock_repo.update.assert_called_once_with("EIPSA-001", {"Estado": "Aprobado"})

    def test_apply_statuses_skips_same_status(self):
        """Should skip when new status equals current status."""
        docs = [
            {"Nº Doc. EIPSA": "EIPSA-001", "Estado": "Aprobado", "Título": "Doc 1"},
        ]
        mock_repo = self._make_mock_repo(docs)

        with patch("repositories.instances.data_repo", mock_repo), \
             patch("services.notification_service.notification_service", MagicMock()):
            from services.transmittal_service import apply_statuses
            result = apply_statuses([
                {"doc_eipsa": "EIPSA-001", "new_status": "Aprobado", "titulo": "Doc 1"},
            ])

        assert result["skipped"] == 1
        assert result["updated"] == 0
        mock_repo.update.assert_not_called()
        assert result["details"][0]["reason"] == "same_status"

    def test_apply_statuses_skips_empty_status(self):
        """Should skip when new status is empty."""
        docs = [
            {"Nº Doc. EIPSA": "EIPSA-001", "Estado": "Enviado", "Título": "Doc 1"},
        ]
        mock_repo = self._make_mock_repo(docs)

        with patch("repositories.instances.data_repo", mock_repo), \
             patch("services.notification_service.notification_service", MagicMock()):
            from services.transmittal_service import apply_statuses
            result = apply_statuses([
                {"doc_eipsa": "EIPSA-001", "new_status": "", "titulo": "Doc 1"},
            ])

        assert result["skipped"] == 1
        assert result["updated"] == 0
        mock_repo.update.assert_not_called()
        assert result["details"][0]["reason"] == "empty_status"

    def test_apply_statuses_handles_no_match(self):
        """Should log error when document is not found in registry."""
        docs = [
            {"Nº Doc. EIPSA": "EIPSA-001", "Estado": "Enviado", "Título": "Doc 1"},
        ]
        mock_repo = self._make_mock_repo(docs)

        with patch("repositories.instances.data_repo", mock_repo), \
             patch("services.notification_service.notification_service", MagicMock()):
            from services.transmittal_service import apply_statuses
            result = apply_statuses([
                {"doc_eipsa": "NONEXISTENT-999", "new_status": "Aprobado", "titulo": "Unknown"},
            ])

        assert len(result["errors"]) == 1
        assert "NONEXISTENT-999" in result["errors"][0]
        assert result["details"][0]["result"] == "error"
        assert result["details"][0]["reason"] == "not_found"

    def test_apply_statuses_returns_summary(self):
        """Should return correct summary format with all fields."""
        docs = [
            {"Nº Doc. EIPSA": "EIPSA-001", "Estado": "Enviado", "Título": "Doc 1"},
            {"Nº Doc. EIPSA": "EIPSA-002", "Estado": "Aprobado", "Título": "Doc 2"},
        ]
        mock_repo = self._make_mock_repo(docs)
        mock_repo.update.return_value = {"Nº Doc. EIPSA": "EIPSA-001", "Estado": "Aprobado"}

        with patch("repositories.instances.data_repo", mock_repo), \
             patch("services.notification_service.notification_service", MagicMock()):
            from services.transmittal_service import apply_statuses
            result = apply_statuses([
                {"doc_eipsa": "EIPSA-001", "new_status": "Aprobado", "titulo": "Doc 1"},
                {"doc_eipsa": "EIPSA-002", "new_status": "Aprobado", "titulo": "Doc 2"},
                {"doc_eipsa": "MISSING", "new_status": "Rechazado", "titulo": "Missing"},
            ])

        assert "updated" in result
        assert "skipped" in result
        assert "errors" in result
        assert "details" in result
        assert isinstance(result["details"], list)
        assert result["updated"] == 1  # EIPSA-001 updated
        assert result["skipped"] == 1  # EIPSA-002 same status
        assert len(result["errors"]) == 1  # MISSING not found

    def test_apply_statuses_case_insensitive_match(self):
        """Should match documents case-insensitively."""
        docs = [
            {"Nº Doc. EIPSA": "EIPSA-001", "Estado": "Enviado", "Título": "Doc 1"},
        ]
        mock_repo = self._make_mock_repo(docs)
        mock_repo.update.return_value = {"Nº Doc. EIPSA": "EIPSA-001", "Estado": "Rechazado"}

        with patch("repositories.instances.data_repo", mock_repo), \
             patch("services.notification_service.notification_service", MagicMock()):
            from services.transmittal_service import apply_statuses
            result = apply_statuses([
                {"doc_eipsa": "eipsa-001", "new_status": "Rechazado", "titulo": "Doc 1"},
            ])

        assert result["updated"] == 1

    def test_apply_statuses_invalid_status(self):
        """Should skip documents with invalid status values."""
        docs = [
            {"Nº Doc. EIPSA": "EIPSA-001", "Estado": "Enviado", "Título": "Doc 1"},
        ]
        mock_repo = self._make_mock_repo(docs)

        with patch("repositories.instances.data_repo", mock_repo), \
             patch("services.notification_service.notification_service", MagicMock()):
            from services.transmittal_service import apply_statuses
            result = apply_statuses([
                {"doc_eipsa": "EIPSA-001", "new_status": "InvalidStatus", "titulo": "Doc 1"},
            ])

        assert result["skipped"] == 1
        assert result["updated"] == 0
        assert result["details"][0]["reason"] == "invalid_status"


class TestBulkStatusEndpoint:
    """Integration test for POST /api/v1/transmittals/emails/{uid}/apply-statuses."""

    def test_bulk_status_endpoint(self, client, auth_headers):
        """Should accept POST request and return result summary."""
        mock_repo = MagicMock()
        mock_repo.get_all.return_value = [
            {"Nº Doc. EIPSA": "EIPSA-001", "Estado": "Enviado", "Título": "Doc 1"},
        ]
        mock_repo.update.return_value = {"Nº Doc. EIPSA": "EIPSA-001", "Estado": "Aprobado"}

        with patch("repositories.instances.data_repo", mock_repo), \
             patch("services.notification_service.notification_service", MagicMock()):
            resp = client.post(
                "/api/v1/transmittals/emails/test-uid-123/apply-statuses",
                json={
                    "documents": [
                        {"doc_eipsa": "EIPSA-001", "new_status": "Aprobado", "titulo": "Doc 1"},
                    ]
                },
                headers=auth_headers,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert "updated" in data
        assert "skipped" in data
        assert "errors" in data
        assert "details" in data

    def test_bulk_status_endpoint_requires_auth(self, client):
        """Should return 401 without authentication."""
        resp = client.post(
            "/api/v1/transmittals/emails/test-uid/apply-statuses",
            json={"documents": []},
        )
        assert resp.status_code == 401
