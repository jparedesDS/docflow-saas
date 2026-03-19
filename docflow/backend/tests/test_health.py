"""Tests for health check endpoints."""


class TestHealth:
    """Tests for /api/v1/health/ endpoints."""

    def test_liveness(self, client):
        """GET /api/v1/health/liveness always returns 200."""
        res = client.get("/api/v1/health/liveness")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"

    def test_readiness(self, client):
        """GET /api/v1/health/ returns health status with checks."""
        res = client.get("/api/v1/health/")
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        assert "checks" in data
        assert "timestamp" in data


class TestPublicPaths:
    """Verify that public paths don't require auth."""

    def test_root(self, client):
        """GET / returns API info."""
        res = client.get("/")
        assert res.status_code == 200
        assert "DocFlow" in res.json().get("message", "")

    def test_health_no_auth(self, client):
        """Health endpoints should not require authentication."""
        res = client.get("/api/v1/health/liveness")
        assert res.status_code == 200

    def test_docs_accessible(self, client):
        """OpenAPI docs should be accessible without auth."""
        res = client.get("/docs")
        assert res.status_code == 200

    def test_openapi_json(self, client):
        """OpenAPI JSON should be accessible without auth."""
        res = client.get("/openapi.json")
        assert res.status_code == 200
