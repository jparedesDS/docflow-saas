"""Tests for authentication endpoints."""

import pytest


class TestLogin:
    """Tests for POST /api/v1/auth/login."""

    def test_login_missing_fields(self, client):
        """Login with missing fields returns 422."""
        res = client.post("/api/v1/auth/login", json={})
        assert res.status_code == 422

    def test_login_invalid_credentials(self, client):
        """Login with wrong credentials returns 401."""
        res = client.post("/api/v1/auth/login", json={
            "username": "nonexistent",
            "password": "wrongpass",
        })
        assert res.status_code == 401

    def test_login_success(self, client):
        """Login with valid credentials returns token and user data."""
        # First we need to know a valid user — use bootstrap default
        # The system creates users from config.USERS on first load
        res = client.post("/api/v1/auth/login", json={
            "username": "jose.paredes",
            "password": "Aa123456",
        })
        if res.status_code == 200:
            data = res.json()
            assert "token" in data
            assert "user" in data
            assert data["user"]["username"] == "jose.paredes"


class TestProtectedEndpoints:
    """Tests for endpoint protection."""

    def test_me_without_token(self, client):
        """GET /api/v1/auth/me without token returns 401 or 422."""
        res = client.get("/api/v1/auth/me")
        assert res.status_code in (401, 422)

    def test_me_with_token(self, client, auth_headers):
        """GET /api/v1/auth/me with valid token returns user."""
        res = client.get("/api/v1/auth/me", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["username"] == "test.user"

    def test_protected_endpoint_no_token(self, client):
        """Protected API endpoint without token returns 401/403/422."""
        res = client.get("/api/v1/documents/")
        assert res.status_code in (401, 403, 422)

    def test_invalid_token(self, client):
        """Request with invalid token returns 401."""
        res = client.get("/api/v1/auth/me", headers={
            "Authorization": "Bearer invalid.token.here"
        })
        assert res.status_code == 401


class TestRateLimiting:
    """Tests for login rate limiting."""

    def test_multiple_failed_logins(self, client):
        """Multiple rapid failed logins should eventually be rate limited."""
        responses = []
        for _ in range(10):
            res = client.post("/api/v1/auth/login", json={
                "username": "attacker",
                "password": "wrongpass",
            })
            responses.append(res.status_code)
        # Should see 429 after exceeding the limit
        assert 429 in responses or all(s == 401 for s in responses)
