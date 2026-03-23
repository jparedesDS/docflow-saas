"""Tests for MyMorningService — personal daily work inbox."""

import os
import sys
import pytest

# Ensure backend is on sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.my_morning_service import MyMorningService


class TestReturnedDocs:
    """Only docs with return states AND Días Devolución <= 2."""

    def test_filters_recent_devolutions(self):
        svc = MyMorningService()
        docs = [
            {"Repsonsable": "JP", "Estado": "Com. Menores", "Días Devolución": 1,
             "Nº Doc. EIPSA": "D-001", "Título": "T1", "Cliente": "C1",
             "Nº Pedido": "P-001", "Crítico": ""},
            {"Repsonsable": "JP", "Estado": "Com. Menores", "Días Devolución": 10,
             "Nº Doc. EIPSA": "D-002", "Título": "T2", "Cliente": "C2",
             "Nº Pedido": "P-002", "Crítico": ""},
            {"Repsonsable": "JP", "Estado": "Aprobado", "Días Devolución": 0,
             "Nº Doc. EIPSA": "D-003", "Título": "T3", "Cliente": "C3",
             "Nº Pedido": "P-003", "Crítico": ""},
        ]
        result = svc._get_returned_docs(docs)
        assert len(result) == 1
        assert result[0]["doc_eipsa"] == "D-001"

    def test_includes_all_return_states(self):
        svc = MyMorningService()
        docs = [
            {"Estado": "Com. Menores", "Días Devolución": 0, "Nº Doc. EIPSA": "D1",
             "Título": "", "Cliente": "", "Nº Pedido": "", "Crítico": ""},
            {"Estado": "Com. Mayores", "Días Devolución": 1, "Nº Doc. EIPSA": "D2",
             "Título": "", "Cliente": "", "Nº Pedido": "", "Crítico": ""},
            {"Estado": "Rechazado", "Días Devolución": 2, "Nº Doc. EIPSA": "D3",
             "Título": "", "Cliente": "", "Nº Pedido": "", "Crítico": ""},
            {"Estado": "Comentado", "Días Devolución": 0, "Nº Doc. EIPSA": "D4",
             "Título": "", "Cliente": "", "Nº Pedido": "", "Crítico": ""},
        ]
        result = svc._get_returned_docs(docs)
        assert len(result) == 4

    def test_empty_when_no_devolutions(self):
        svc = MyMorningService()
        result = svc._get_returned_docs([])
        assert result == []


class TestSlaCritical:
    """Only non-aprobado docs with Días Devolución >= 12."""

    def test_filters_approaching_deadline(self):
        svc = MyMorningService()
        docs = [
            {"Estado": "Enviado", "Días Devolución": 20, "Nº Doc. EIPSA": "D-001",
             "Título": "T1", "Cliente": "C1", "Nº Pedido": "P-001", "Crítico": ""},
            {"Estado": "Enviado", "Días Devolución": 5, "Nº Doc. EIPSA": "D-002",
             "Título": "T2", "Cliente": "C2", "Nº Pedido": "P-002", "Crítico": ""},
            {"Estado": "Aprobado", "Días Devolución": 0, "Nº Doc. EIPSA": "D-003",
             "Título": "T3", "Cliente": "C3", "Nº Pedido": "P-003", "Crítico": ""},
        ]
        result = svc._get_sla_critical(docs)
        assert len(result) == 1
        assert result[0]["doc_eipsa"] == "D-001"
        assert result[0]["urgency"] == "medium"

    def test_urgency_levels(self):
        svc = MyMorningService()
        docs = [
            {"Estado": "Enviado", "Días Devolución": 35, "Nº Doc. EIPSA": "D-H",
             "Título": "", "Cliente": "", "Nº Pedido": "", "Crítico": ""},
            {"Estado": "Enviado", "Días Devolución": 18, "Nº Doc. EIPSA": "D-M",
             "Título": "", "Cliente": "", "Nº Pedido": "", "Crítico": ""},
            {"Estado": "Enviado", "Días Devolución": 13, "Nº Doc. EIPSA": "D-A",
             "Título": "", "Cliente": "", "Nº Pedido": "", "Crítico": ""},
        ]
        result = svc._get_sla_critical(docs)
        assert len(result) == 3
        # Sorted desc by dias_devolucion
        assert result[0]["urgency"] == "high"
        assert result[1]["urgency"] == "medium"
        assert result[2]["urgency"] == "approaching"

    def test_excludes_aprobado_and_eliminado(self):
        svc = MyMorningService()
        docs = [
            {"Estado": "Aprobado", "Días Devolución": 50, "Nº Doc. EIPSA": "D-A",
             "Título": "", "Cliente": "", "Nº Pedido": "", "Crítico": ""},
            {"Estado": "Eliminado", "Días Devolución": 50, "Nº Doc. EIPSA": "D-E",
             "Título": "", "Cliente": "", "Nº Pedido": "", "Crítico": ""},
        ]
        result = svc._get_sla_critical(docs)
        assert len(result) == 0


class TestSummaryKpis:
    """Verify percentage and count calculations."""

    def test_calculates_correctly(self):
        svc = MyMorningService()
        my_docs = [
            {"Estado": "Aprobado", "Crítico": ""},
            {"Estado": "Aprobado", "Crítico": "Sí"},
            {"Estado": "Enviado", "Crítico": ""},
            {"Estado": "", "Crítico": ""},
            {"Estado": "", "Crítico": "SI"},
        ]
        all_docs = my_docs + [
            {"Estado": "Aprobado", "Crítico": ""},
            {"Estado": "Enviado", "Crítico": ""},
        ]
        result = svc._get_summary_kpis(my_docs, all_docs)
        assert result["total"] == 5
        assert result["aprobados"] == 2
        assert result["pct_aprobados"] == 40
        assert result["enviados"] == 1
        assert result["sin_enviar"] == 2
        assert result["criticos"] == 2
        assert result["team_pct"] == round(3 / 7 * 100)

    def test_empty_docs(self):
        svc = MyMorningService()
        result = svc._get_summary_kpis([], [])
        assert result["total"] == 0
        assert result["pct_aprobados"] == 0
        assert result["team_pct"] == 0


class TestPendingClaims:
    """Only claimable items for the given user."""

    def test_filters_by_user(self):
        svc = MyMorningService()
        # Mock the claims service
        fake_claimable = [
            {"pedido": "P-001", "responsable": "JP", "docs_count": 3, "max_dias": 20},
            {"pedido": "P-002", "responsable": "AC", "docs_count": 1, "max_dias": 15},
            {"pedido": "P-003", "responsable": "JP", "docs_count": 2, "max_dias": 25},
        ]
        # Patch the method
        original = svc.claims.get_claimable_pedidos
        svc.claims.get_claimable_pedidos = lambda: fake_claimable
        try:
            result = svc._get_pending_claims("JP")
            assert len(result) == 2
            assert all(r["responsable"] == "JP" for r in result)
        finally:
            svc.claims.get_claimable_pedidos = original


class TestMorningEndpoint:
    """Verify the service returns all expected sections."""

    def test_returns_all_sections(self):
        svc = MyMorningService()
        # Use a known user to test the full pipeline
        result = svc.get_morning_data("JP")
        assert "user" in result
        assert "returned_docs" in result
        assert "sla_critical" in result
        assert "pending_claims" in result
        assert "summary_kpis" in result
        assert "generated" in result
        assert result["user"]["initials"] == "JP"
        assert isinstance(result["returned_docs"], list)
        assert isinstance(result["sla_critical"], list)
        assert isinstance(result["pending_claims"], list)
        assert isinstance(result["summary_kpis"], dict)
