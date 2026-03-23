"""Core router integration tests — documents, ERP, reports, notifications, projects, analytics, search."""

import pytest


class TestDocumentsRouter:
    """Documents CRUD and monitoring endpoints."""

    def test_list_documents(self, client, auth_headers):
        resp = client.get("/api/v1/documents/", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_columns(self, client, auth_headers):
        resp = client.get("/api/v1/documents/columns", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_monitoring(self, client, auth_headers):
        resp = client.get("/api/v1/documents/monitoring", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_status_global(self, client, auth_headers):
        resp = client.get("/api/v1/documents/monitoring/status-global", headers=auth_headers)
        assert resp.status_code == 200

    def test_monitoring_columns(self, client, auth_headers):
        resp = client.get("/api/v1/documents/monitoring/columns", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_search(self, client, auth_headers):
        resp = client.get("/api/v1/documents/search", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestErpRouter:
    """ERP data and consulta endpoints."""

    def test_get_data(self, client, auth_headers):
        resp = client.get("/api/v1/erp/data", headers=auth_headers)
        assert resp.status_code == 200

    def test_consulta(self, client, auth_headers):
        resp = client.get("/api/v1/erp/consulta", headers=auth_headers)
        assert resp.status_code == 200

    def test_data_columns(self, client, auth_headers):
        resp = client.get("/api/v1/erp/columns/data", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_consulta_columns(self, client, auth_headers):
        resp = client.get("/api/v1/erp/columns/consulta", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestReportsRouter:
    """Reports summary and monitoring report."""

    def test_summary(self, client, auth_headers):
        resp = client.get("/api/v1/reports/summary", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), dict)

    def test_monitoring_report(self, client, auth_headers):
        resp = client.get("/api/v1/reports/monitoring-report", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)

    def test_requires_auth(self, client):
        """Unauthenticated request -> 401."""
        resp = client.get("/api/v1/reports/summary")
        assert resp.status_code == 401


class TestNotificationsRouter:
    """Notifications list and stats."""

    def test_list_notifications(self, client, auth_headers):
        resp = client.get("/api/v1/notifications/", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_stats(self, client, auth_headers):
        resp = client.get("/api/v1/notifications/stats", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "por_tipo" in data

    def test_filter_by_tipo(self, client, auth_headers):
        resp = client.get("/api/v1/notifications/?tipo=exportacion", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestProjectsRouter:
    """Projects list and dashboard."""

    def test_list_projects(self, client, auth_headers):
        resp = client.get("/api/v1/projects/list", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_requires_auth(self, client):
        """Unauthenticated request -> 401."""
        resp = client.get("/api/v1/projects/list")
        assert resp.status_code == 401

    def test_dashboard_nonexistent(self, client, auth_headers):
        """Dashboard for non-existent project -> 404."""
        resp = client.get("/api/v1/projects/NONEXISTENT-99999/dashboard", headers=auth_headers)
        assert resp.status_code == 404


class TestAnalyticsRouter:
    """Analytics summary, s-curve, scorecard."""

    def test_summary(self, client, auth_headers):
        resp = client.get("/api/v1/analytics/summary", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), dict)

    def test_s_curve(self, client, auth_headers):
        resp = client.get("/api/v1/analytics/s-curve", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "baseline" in data
        assert "actual" in data

    def test_scorecard(self, client, auth_headers):
        resp = client.get("/api/v1/analytics/scorecard", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestSearchRouter:
    """Faceted search endpoints."""

    def test_faceted_search(self, client, auth_headers):
        resp = client.get("/api/v1/search/faceted", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "count" in data
        assert "facets" in data
        assert "results" in data

    def test_faceted_with_filters(self, client, auth_headers):
        resp = client.get("/api/v1/search/faceted?q=test&limit=10", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "count" in data

    def test_natural_requires_api_key(self, client, auth_headers):
        """Natural search without ANTHROPIC_API_KEY -> 500."""
        resp = client.post(
            "/api/v1/search/natural",
            headers=auth_headers,
            json={"query": "documentos pendientes"},
        )
        # Without API key, should return 500 with detail about ANTHROPIC_API_KEY
        assert resp.status_code == 500
        assert "ANTHROPIC_API_KEY" in resp.json().get("detail", "")
