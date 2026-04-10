"""Tests for pagination support — documents and monitoring endpoints."""

import pytest


class TestDocumentsPagination:
    """GET /api/v1/documents/ pagination behavior."""

    def test_list_without_pagination_returns_list(self, client, auth_headers):
        """Backward compat: no page param → plain list."""
        resp = client.get("/api/v1/documents/", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_with_pagination_returns_paginated(self, client, auth_headers):
        """With page param → paginated response with items/total/page/page_size/pages."""
        resp = client.get("/api/v1/documents/?page=1&page_size=10", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "pages" in data
        assert data["page"] == 1
        assert data["page_size"] == 10
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["pages"], int)

    def test_page_size_default(self, client, auth_headers):
        """page without page_size → defaults to 50."""
        resp = client.get("/api/v1/documents/?page=1", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["page_size"] == 50

    def test_page_size_max_limit(self, client, auth_headers):
        """page_size > 200 → 422 validation error."""
        resp = client.get("/api/v1/documents/?page=1&page_size=201", headers=auth_headers)
        assert resp.status_code == 422

    def test_page_zero_invalid(self, client, auth_headers):
        """page=0 → 422 validation error (ge=1)."""
        resp = client.get("/api/v1/documents/?page=0", headers=auth_headers)
        assert resp.status_code == 422

    def test_page_size_zero_invalid(self, client, auth_headers):
        """page_size=0 → 422 validation error (ge=1)."""
        resp = client.get("/api/v1/documents/?page=1&page_size=0", headers=auth_headers)
        assert resp.status_code == 422


class TestMonitoringPagination:
    """GET /api/v1/documents/monitoring pagination behavior."""

    def test_monitoring_without_pagination_returns_list(self, client, auth_headers):
        """Backward compat: no page param → plain list."""
        resp = client.get("/api/v1/documents/monitoring", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_monitoring_with_pagination_returns_paginated(self, client, auth_headers):
        """With page param → paginated response."""
        resp = client.get("/api/v1/documents/monitoring?page=1", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "pages" in data
        assert data["page"] == 1

    def test_monitoring_pagination_with_filters(self, client, auth_headers):
        """Pagination works together with query filters."""
        resp = client.get(
            "/api/v1/documents/monitoring?estado=Aprobado&page=1&page_size=5",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)
        assert data["page_size"] == 5

    def test_monitoring_page_size_max(self, client, auth_headers):
        """page_size > 200 → 422."""
        resp = client.get(
            "/api/v1/documents/monitoring?page=1&page_size=201",
            headers=auth_headers,
        )
        assert resp.status_code == 422


class TestPaginatedResponseModel:
    """Unit tests for the PaginatedResponse Pydantic model."""

    def test_model_creation(self):
        from models.pagination import PaginatedResponse

        resp = PaginatedResponse(
            items=[{"id": 1}, {"id": 2}],
            total=100,
            page=1,
            page_size=50,
            pages=2,
        )
        assert resp.total == 100
        assert resp.pages == 2
        assert len(resp.items) == 2

    def test_model_serialization(self):
        from models.pagination import PaginatedResponse

        resp = PaginatedResponse(
            items=["a", "b", "c"],
            total=3,
            page=1,
            page_size=10,
            pages=1,
        )
        data = resp.model_dump()
        assert data["items"] == ["a", "b", "c"]
        assert data["total"] == 3


class TestBaseRepositoryPagination:
    """Unit tests for BaseRepository.get_paginated default implementation."""

    def test_get_paginated_basic(self):
        from repositories.base_repository import BaseRepository

        class FakeRepo(BaseRepository):
            def get_all(self):
                return [{"id": i} for i in range(25)]

            def get_by_id(self, doc_id):
                return None

            def filter(self, **kwargs):
                return self.get_all()

            def create(self, data):
                return data

            def update(self, doc_id, data):
                return None

            def delete(self, doc_id):
                return False

        repo = FakeRepo()
        result = repo.get_paginated(page=1, page_size=10)
        assert result["total"] == 25
        assert result["page"] == 1
        assert result["page_size"] == 10
        assert result["pages"] == 3
        assert len(result["items"]) == 10

    def test_get_paginated_last_page(self):
        from repositories.base_repository import BaseRepository

        class FakeRepo(BaseRepository):
            def get_all(self):
                return [{"id": i} for i in range(25)]

            def get_by_id(self, doc_id):
                return None

            def filter(self, **kwargs):
                return self.get_all()

            def create(self, data):
                return data

            def update(self, doc_id, data):
                return None

            def delete(self, doc_id):
                return False

        repo = FakeRepo()
        result = repo.get_paginated(page=3, page_size=10)
        assert len(result["items"]) == 5
        assert result["page"] == 3

    def test_get_paginated_empty(self):
        from repositories.base_repository import BaseRepository

        class FakeRepo(BaseRepository):
            def get_all(self):
                return []

            def get_by_id(self, doc_id):
                return None

            def filter(self, **kwargs):
                return []

            def create(self, data):
                return data

            def update(self, doc_id, data):
                return None

            def delete(self, doc_id):
                return False

        repo = FakeRepo()
        result = repo.get_paginated(page=1, page_size=10)
        assert result["total"] == 0
        assert result["pages"] == 1
        assert len(result["items"]) == 0
