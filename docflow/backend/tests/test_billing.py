"""Tests for billing router — Stripe checkout, portal, webhooks."""

import pytest
from unittest.mock import patch, MagicMock


class TestBillingEndpoints:
    """Billing API endpoints."""

    def test_billing_info_requires_auth(self, client):
        """Billing info endpoint requires authentication."""
        r = client.get("/api/v1/billing/info")
        assert r.status_code == 401

    def test_billing_info_returns_data(self, client, auth_headers):
        """Billing info returns plan data."""
        with patch("services.billing_service.get_billing_info", return_value={
            "plan": "enterprise", "status": "active",
        }):
            r = client.get("/api/v1/billing/info", headers=auth_headers)
            assert r.status_code == 200

    def test_usage_requires_auth(self, client):
        """Usage endpoint requires authentication."""
        r = client.get("/api/v1/billing/usage")
        assert r.status_code == 401
