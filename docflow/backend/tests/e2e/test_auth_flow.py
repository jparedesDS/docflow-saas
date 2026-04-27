"""E2E tests — authentication flow (login, tokens, protected endpoints)."""

from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt


class TestLoginFlow:
    """POST /api/v1/auth/login with real DB users."""

    def test_login_valid_credentials(self, client, setup_tenant_with_user):
        """Login with correct username/password returns 200 + token."""
        tenant, user, _ = setup_tenant_with_user()

        r = client.post(
            "/api/v1/auth/login",
            json={"username": "test.user", "password": "TestPass123"},
        )

        assert r.status_code == 200
        body = r.json()
        assert "token" in body
        assert "refresh_token" in body
        assert body["user"]["username"] == "test.user"
        assert body["user"]["initials"] == "TU"
        assert body["user"]["tenant_id"] == tenant.id

    def test_login_invalid_password(self, client, setup_tenant_with_user):
        """Login with wrong password returns 401."""
        setup_tenant_with_user()

        r = client.post(
            "/api/v1/auth/login",
            json={"username": "test.user", "password": "WrongPassword"},
        )

        assert r.status_code == 401
        assert "Invalid credentials" in r.json()["detail"]

    def test_login_nonexistent_user(self, client, setup_tenant_with_user):
        """Login with unknown username returns 401."""
        setup_tenant_with_user()

        r = client.post(
            "/api/v1/auth/login",
            json={"username": "nobody", "password": "TestPass123"},
        )

        assert r.status_code == 401


class TestTokenProtection:
    """Access control with valid/invalid/missing tokens."""

    def test_access_protected_endpoint_with_token(self, client, setup_tenant_with_user):
        """Valid token grants access to /api/v1/auth/me."""
        tenant, user, headers = setup_tenant_with_user()

        r = client.get("/api/v1/auth/me", headers=headers)

        assert r.status_code == 200
        body = r.json()
        assert body["username"] == "test.user"
        assert body["tenant_id"] == tenant.id

    def test_access_without_token(self, client, setup_tenant_with_user):
        """Missing Authorization header returns 401."""
        setup_tenant_with_user()

        r = client.get("/api/v1/auth/me")

        assert r.status_code in (401, 422)

    def test_expired_token(self, client, setup_tenant_with_user):
        """Token with exp in the past returns 401."""
        import os
        setup_tenant_with_user()

        expired_payload = {
            "sub": "test.user",
            "role": "Document Controller",
            "initials": "TU",
            "tenant_id": 1,
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        }
        expired_token = jwt.encode(
            expired_payload,
            os.environ["JWT_SECRET"],
            algorithm="HS256",
        )

        r = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"},
        )

        assert r.status_code == 401

    def test_token_missing_tenant_id(self, client, setup_tenant_with_user):
        """Token without tenant_id is rejected by JWTAuthMiddleware."""
        import os
        setup_tenant_with_user()

        payload = {
            "sub": "test.user",
            "role": "Document Controller",
            "initials": "TU",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        }
        token = jwt.encode(
            payload,
            os.environ["JWT_SECRET"],
            algorithm="HS256",
        )

        r = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert r.status_code == 401
        assert "tenant_id" in r.json()["detail"].lower()


class TestPublicEndpoints:
    """Public paths should be accessible without a token."""

    def test_health_liveness(self, client):
        """GET /api/v1/health/liveness is public — no auth required."""
        r = client.get("/api/v1/health/liveness")

        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_root(self, client):
        """GET / is public — no auth required."""
        r = client.get("/")

        assert r.status_code == 200
        assert "DocFlow" in r.json()["message"]
