"""Unified search service and endpoint tests."""

import pytest
from unittest.mock import patch, MagicMock


MOCK_DOCS = [
    {
        "Nº Doc. EIPSA": "P-24/001-EI-DT-001",
        "Nº Doc. Cliente": "CLT-DOC-001",
        "Nº Pedido": "P-24/001",
        "Título": "Data Sheet Pressure Transmitter",
        "Cliente": "Técnicas Reunidas",
        "Nº PO": "PO-4500123",
        "Estado": "Enviado",
        "Repsonsable": "JP",
        "Material": "Pressure Transmitter",
    },
    {
        "Nº Doc. EIPSA": "P-24/001-EI-DT-002",
        "Nº Doc. Cliente": "CLT-DOC-002",
        "Nº Pedido": "P-24/001",
        "Título": "Data Sheet Level Gauge",
        "Cliente": "Técnicas Reunidas",
        "Nº PO": "PO-4500123",
        "Estado": "Aprobado",
        "Repsonsable": "AC",
        "Material": "Level Gauge",
    },
    {
        "Nº Doc. EIPSA": "P-24/002-ME-PL-001",
        "Nº Doc. Cliente": "SHELL-DOC-001",
        "Nº Pedido": "P-24/002",
        "Título": "General Arrangement Drawing",
        "Cliente": "Shell Global",
        "Nº PO": "PO-7700456",
        "Estado": "",
        "Repsonsable": "JM",
        "Material": "Control Valve",
    },
]


class TestUnifiedSearchService:
    """Unit tests for UnifiedSearchService."""

    def _make_service(self):
        """Create service with mocked monitoring data."""
        mock_mon = MagicMock()
        mock_mon.get_monitoring_data.return_value = MOCK_DOCS

        mock_claim = MagicMock()
        mock_claim.get_claimable_pedidos.return_value = [
            {
                "pedido": "P-24/001",
                "cliente": "Técnicas Reunidas",
                "docs_count": 1,
                "max_dias": 25,
                "urgency": "low",
            },
        ]

        with patch("services.unified_search_service.monitoring_service", mock_mon), \
             patch("services.unified_search_service.ClaimService", return_value=mock_claim):
            from services.unified_search_service import UnifiedSearchService
            svc = UnifiedSearchService()
            svc.monitoring = mock_mon
            svc.claims = mock_claim
            return svc

    def test_search_finds_document_by_number(self):
        svc = self._make_service()
        result = svc.search("P-24/001-EI-DT-001")
        assert result["total"] > 0
        doc_results = [r for r in result["results"] if r["category"] == "document"]
        assert any(r["id"] == "p-24/001-ei-dt-001" for r in doc_results)

    def test_search_finds_pedido(self):
        svc = self._make_service()
        result = svc.search("P-24/001")
        assert result["total"] > 0
        pedido_results = [r for r in result["results"] if r["category"] == "pedido"]
        assert len(pedido_results) > 0
        assert pedido_results[0]["title"] == "P-24/001"

    def test_search_finds_by_client(self):
        svc = self._make_service()
        result = svc.search("Shell")
        assert result["total"] > 0
        # Should find Shell Global documents
        found_shell = any(
            "shell" in r.get("description", "").lower() or
            "shell" in r.get("subtitle", "").lower()
            for r in result["results"]
        )
        assert found_shell

    def test_search_relevance_ordering(self):
        svc = self._make_service()
        result = svc.search("P-24/001-EI-DT-001")
        assert result["total"] > 0
        # Exact doc match should score highest
        first = result["results"][0]
        assert first["category"] == "document"
        # All results should be sorted by score descending
        scores = [r["score"] for r in result["results"]]
        assert scores == sorted(scores, reverse=True)

    def test_search_empty_query(self):
        svc = self._make_service()
        result = svc.search("")
        assert result["total"] == 0
        assert result["results"] == []

    def test_search_short_query(self):
        svc = self._make_service()
        result = svc.search("P")
        assert result["total"] == 0
        assert result["results"] == []

    def test_search_categories_counted(self):
        svc = self._make_service()
        result = svc.search("P-24/001")
        categories = result["categories"]
        # Should have at least document and pedido categories
        assert isinstance(categories, dict)
        total_from_cats = sum(categories.values())
        assert total_from_cats == result["total"]

    def test_search_claims(self):
        svc = self._make_service()
        result = svc.search("Técnicas")
        claim_results = [r for r in result["results"] if r["category"] == "claim"]
        assert len(claim_results) > 0

    def test_search_limit(self):
        svc = self._make_service()
        result = svc.search("P-24", limit=2)
        assert len(result["results"]) <= 2

    def test_search_whitespace_trimmed(self):
        svc = self._make_service()
        result = svc.search("  Shell  ")
        assert result["total"] > 0
        assert result["query"] == "Shell"


class TestUnifiedSearchEndpoint:
    """Integration tests for the /search/unified endpoint."""

    def test_unified_search_endpoint(self, client, auth_headers):
        resp = client.get("/api/v1/search/unified?q=test", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert "total" in data
        assert "categories" in data

    def test_unified_search_empty_query(self, client, auth_headers):
        resp = client.get("/api/v1/search/unified?q=", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0

    def test_unified_search_no_auth(self, client):
        resp = client.get("/api/v1/search/unified?q=test")
        assert resp.status_code == 401

    def test_unified_search_with_limit(self, client, auth_headers):
        resp = client.get("/api/v1/search/unified?q=P&limit=5", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) <= 5
