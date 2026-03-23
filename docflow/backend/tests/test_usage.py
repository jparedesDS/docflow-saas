"""Tests for usage service — tracking and quotas."""

import pytest
from unittest.mock import patch


class TestUsageTracking:
    """Usage tracking endpoints."""

    def test_usage_endpoint_requires_auth(self, client):
        """Usage endpoint requires authentication."""
        r = client.get("/api/v1/billing/usage")
        assert r.status_code == 401

    def test_usage_history_requires_auth(self, client):
        """Usage history endpoint requires authentication."""
        r = client.get("/api/v1/billing/usage/history")
        assert r.status_code == 401
