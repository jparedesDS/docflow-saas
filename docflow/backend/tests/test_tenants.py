"""Tests for tenants router — registration, invitations."""

import pytest
from unittest.mock import patch, MagicMock


class TestTenantRegistration:
    """Tenant registration endpoint."""

    def test_register_endpoint_exists(self, client):
        """POST /tenants/register should be a public endpoint."""
        # Just check it doesn't return 401 (it's a public path)
        r = client.post("/api/v1/tenants/register", json={
            "name": "Test Org",
            "slug": "test-org",
            "admin_email": "admin@test.com",
            "admin_password": "Aa123456",
        })
        # In excel mode this may fail with 500 (no DB), but not 401
        assert r.status_code != 401


class TestTenantInfo:
    """Tenant info endpoints."""

    def test_tenant_me_requires_auth(self, client):
        """GET /tenants/me requires auth."""
        r = client.get("/api/v1/tenants/me")
        assert r.status_code == 401

    def test_tenant_invitations_requires_auth(self, client):
        """Invitation endpoints require auth."""
        r = client.get("/api/v1/tenants/invitations")
        assert r.status_code == 401
