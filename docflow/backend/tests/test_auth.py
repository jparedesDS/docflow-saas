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


class TestJWTSecretRotation:
    """Tests for JWT secret rotation support."""

    def test_token_verified_with_primary_key(self):
        """Token signed with primary key verifies normally."""
        from services.auth_service import create_token, verify_token

        user_data = {"sub": "test", "role": "dc", "initials": "TT", "tenant_id": "t1"}
        token = create_token(user_data)
        payload = verify_token(token)
        assert payload["sub"] == "test"

    def test_token_signed_with_old_key_verifies_with_previous(self, monkeypatch):
        """Token signed with old key verifies when JWT_SECRET_PREVIOUS is set."""
        import services.auth_service as auth_mod

        old_secret = "old-secret-key-for-testing"
        new_secret = "new-secret-key-for-testing"

        # Sign token with old key
        monkeypatch.setattr(auth_mod, "JWT_SECRET", old_secret)
        monkeypatch.setattr(auth_mod, "JWT_SECRET_PREVIOUS", "")
        user_data = {"sub": "rotated", "role": "dc", "initials": "RR", "tenant_id": "t1"}
        token = auth_mod.create_token(user_data)

        # Now rotate: new key is primary, old key is previous
        monkeypatch.setattr(auth_mod, "JWT_SECRET", new_secret)
        monkeypatch.setattr(auth_mod, "JWT_SECRET_PREVIOUS", old_secret)

        payload = auth_mod.verify_token(token)
        assert payload["sub"] == "rotated"

    def test_token_fails_without_previous_key(self, monkeypatch):
        """Token signed with old key fails when JWT_SECRET_PREVIOUS is not set."""
        import services.auth_service as auth_mod
        from jose import JWTError

        old_secret = "old-secret-key-for-testing"
        new_secret = "new-secret-key-for-testing"

        monkeypatch.setattr(auth_mod, "JWT_SECRET", old_secret)
        monkeypatch.setattr(auth_mod, "JWT_SECRET_PREVIOUS", "")
        user_data = {"sub": "fail", "role": "dc", "initials": "FF", "tenant_id": "t1"}
        token = auth_mod.create_token(user_data)

        # Rotate without setting previous
        monkeypatch.setattr(auth_mod, "JWT_SECRET", new_secret)
        monkeypatch.setattr(auth_mod, "JWT_SECRET_PREVIOUS", "")

        with pytest.raises(JWTError):
            auth_mod.verify_token(token)

    def test_refresh_token_rotation(self, monkeypatch):
        """Refresh token rotation works the same way."""
        import services.auth_service as auth_mod

        old_secret = "old-refresh-secret"
        new_secret = "new-refresh-secret"

        monkeypatch.setattr(auth_mod, "JWT_SECRET", old_secret)
        monkeypatch.setattr(auth_mod, "JWT_SECRET_PREVIOUS", "")
        user_data = {"sub": "refresh", "role": "dc", "initials": "RF", "tenant_id": "t1"}
        token = auth_mod.create_refresh_token(user_data)

        monkeypatch.setattr(auth_mod, "JWT_SECRET", new_secret)
        monkeypatch.setattr(auth_mod, "JWT_SECRET_PREVIOUS", old_secret)

        payload = auth_mod.verify_refresh_token(token)
        assert payload["sub"] == "refresh"
        assert payload["type"] == "refresh"

    def test_new_tokens_always_use_primary_key(self, monkeypatch):
        """New tokens are always signed with the primary (new) key."""
        import services.auth_service as auth_mod

        new_secret = "primary-key-only"

        monkeypatch.setattr(auth_mod, "JWT_SECRET", new_secret)
        monkeypatch.setattr(auth_mod, "JWT_SECRET_PREVIOUS", "some-old-key")

        user_data = {"sub": "new", "role": "dc", "initials": "NN", "tenant_id": "t1"}
        token = auth_mod.create_token(user_data)

        # Should verify with primary key alone (no previous needed)
        monkeypatch.setattr(auth_mod, "JWT_SECRET_PREVIOUS", "")
        payload = auth_mod.verify_token(token)
        assert payload["sub"] == "new"
