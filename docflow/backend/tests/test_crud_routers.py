"""CRUD router tests with mocked services — audit, comments, filters, api-keys, webhooks."""

import pytest
from unittest.mock import patch, MagicMock


class TestAuditRouter:
    """Audit log endpoints — requires admin or DC role."""

    def test_requires_auth(self, client):
        """No auth → 401."""
        resp = client.get("/api/v1/audit/")
        assert resp.status_code == 401

    def test_list_audit_log(self, client, auth_headers):
        """DC user can list audit logs."""
        with patch("services.audit_service.get_recent_activity", return_value=[
            {"id": 1, "entity_type": "document", "action": "created", "timestamp": "2026-03-20T10:00:00"}
        ]):
            resp = client.get("/api/v1/audit/", headers=auth_headers)
            assert resp.status_code == 200
            assert isinstance(resp.json(), list)

    def test_document_log(self, client, auth_headers):
        """DC user can view audit log for specific document."""
        with patch("services.audit_service.get_entity_log", return_value=[
            {"id": 1, "entity_type": "document", "entity_id": "DOC-001"}
        ]):
            resp = client.get("/api/v1/audit/document/DOC-001", headers=auth_headers)
            assert resp.status_code == 200
            assert isinstance(resp.json(), list)

    def test_non_dc_gets_403(self, client):
        """User with non-DC/admin role → 403."""
        from services.auth_service import create_token
        token = create_token({
            "sub": "viewer.user",
            "role": "viewer",
            "initials": "VU",
            "tenant_id": 1,
        })
        headers = {"Authorization": f"Bearer {token}"}
        with patch("services.audit_service.get_recent_activity", return_value=[]):
            resp = client.get("/api/v1/audit/", headers=headers)
            assert resp.status_code == 403


class TestCommentsRouter:
    """Comments CRUD endpoints."""

    def test_requires_auth(self, client):
        """No auth → 401."""
        resp = client.get("/api/v1/comments/DOC-001")
        assert resp.status_code == 401

    def test_list_comments(self, client, auth_headers):
        """List comments for a document."""
        with patch("services.comment_service.list_comments", return_value=[
            {"id": 1, "content": "Test comment", "user_initials": "TU"}
        ]):
            resp = client.get("/api/v1/comments/DOC-001", headers=auth_headers)
            assert resp.status_code == 200
            assert isinstance(resp.json(), list)

    def test_create_comment(self, client, auth_headers):
        """Create a comment on a document."""
        with patch("services.comment_service.create_comment", return_value={
            "id": 2, "content": "New comment", "user_initials": "TU"
        }):
            resp = client.post(
                "/api/v1/comments/DOC-001",
                headers=auth_headers,
                json={"content": "New comment"},
            )
            assert resp.status_code == 200
            assert resp.json()["content"] == "New comment"

    def test_comment_count(self, client, auth_headers):
        """Get comment count for a document."""
        with patch("services.comment_service.get_comment_count", return_value=5):
            resp = client.get("/api/v1/comments/DOC-001/count", headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["count"] == 5


class TestSavedFiltersRouter:
    """Saved filters CRUD endpoints."""

    def test_requires_auth(self, client):
        """No auth → 401."""
        resp = client.get("/api/v1/filters/")
        assert resp.status_code == 401

    def test_list_filters(self, client, auth_headers):
        """List saved filters."""
        with patch("services.saved_filter_service.list_filters", return_value=[
            {"id": 1, "name": "My Filter", "entity_type": "document"}
        ]):
            resp = client.get("/api/v1/filters/", headers=auth_headers)
            assert resp.status_code == 200
            assert isinstance(resp.json(), list)

    def test_create_filter(self, client, auth_headers):
        """Create a new saved filter."""
        with patch("services.saved_filter_service.create_filter", return_value={
            "id": 2, "name": "New Filter", "entity_type": "document"
        }):
            resp = client.post(
                "/api/v1/filters/",
                headers=auth_headers,
                json={"name": "New Filter", "entity_type": "document", "filters": {"estado": "Aprobado"}},
            )
            assert resp.status_code == 200
            assert resp.json()["name"] == "New Filter"


class TestApiKeysRouter:
    """API keys endpoints — admin only, feature-gated."""

    def test_requires_auth(self, client):
        """No auth → 401."""
        resp = client.get("/api/v1/api-keys/")
        assert resp.status_code == 401

    def test_requires_admin(self, client, auth_headers):
        """Non-admin user → 403."""
        # auth_headers has role="Document Controller", not admin
        resp = client.get("/api/v1/api-keys/", headers=auth_headers)
        assert resp.status_code == 403

    def test_list_keys_ok(self, client, auth_headers_admin):
        """Admin can list API keys when feature is available."""
        with patch("services.plan_service.check_feature", return_value=True), \
             patch("services.api_key_service.list_keys", return_value=[
                 {"id": 1, "name": "prod-key", "scopes": ["read"]}
             ]):
            resp = client.get("/api/v1/api-keys/", headers=auth_headers_admin)
            assert resp.status_code == 200
            assert isinstance(resp.json(), list)

    def test_feature_gated(self, client, auth_headers_admin):
        """Admin but api_keys feature not available → 403."""
        with patch("services.plan_service.check_feature", return_value=False):
            resp = client.get("/api/v1/api-keys/", headers=auth_headers_admin)
            assert resp.status_code == 403
            assert "plan" in resp.json()["detail"].lower()


class TestWebhooksConfigRouter:
    """Webhook configuration endpoints."""

    def test_requires_auth(self, client):
        """No auth → 401."""
        resp = client.get("/api/v1/webhooks/")
        assert resp.status_code == 401

    def test_list_webhooks(self, client, auth_headers):
        """DC user can list webhooks."""
        with patch("services.webhook_service.list_webhooks", return_value=[
            {"id": 1, "name": "slack-notif", "url": "https://hooks.slack.com/...", "enabled": True}
        ]):
            resp = client.get("/api/v1/webhooks/", headers=auth_headers)
            assert resp.status_code == 200
            assert isinstance(resp.json(), list)

    def test_create_webhook(self, client, auth_headers):
        """DC user can create a webhook."""
        with patch("services.webhook_service.create_webhook", return_value={
            "id": 2, "name": "teams-notif", "url": "https://outlook.office.com/webhook/...", "enabled": True
        }):
            resp = client.post(
                "/api/v1/webhooks/",
                headers=auth_headers,
                json={
                    "name": "teams-notif",
                    "url": "https://outlook.office.com/webhook/test",
                    "platform": "teams",
                    "events": ["document_updated"],
                    "enabled": True,
                },
            )
            assert resp.status_code == 200
            assert resp.json()["name"] == "teams-notif"
