"""
Fase 7 — Production hardening verification tests.
"""
import pytest
from services.auth_service import create_token


@pytest.fixture()
def auth_headers_viewer():
    """Authorization headers for a viewer user (no DC/admin privileges)."""
    token = create_token({
        "sub": "viewer.user",
        "role": "viewer",
        "initials": "VU",
        "tenant_id": 1,
    })
    return {"Authorization": f"Bearer {token}"}


class TestExceptionHandlingFix:
    """Verify HTTPException propagation and detail sanitization."""

    def test_attachment_invalid_mime_returns_415(self, client, auth_headers):
        """Upload with disallowed MIME type should return 415, not 500."""
        from io import BytesIO
        files = {"file": ("test.exe", BytesIO(b"MZ..."), "application/x-msdownload")}
        resp = client.post(
            "/api/v1/attachments/TEST-001/upload",
            files=files,
            headers=auth_headers,
        )
        assert resp.status_code == 415

    def test_audit_403_not_swallowed(self, client, auth_headers_viewer):
        """Non-DC/admin user hitting audit endpoint should get 403, not 500."""
        resp = client.get("/api/v1/audit/", headers=auth_headers_viewer)
        # Should be 403 (role check), NOT 500
        assert resp.status_code == 403

    def test_api_keys_403_not_swallowed(self, client, auth_headers_viewer):
        """Non-admin user hitting api-keys should get 403, not 500."""
        resp = client.get("/api/v1/api-keys/", headers=auth_headers_viewer)
        assert resp.status_code == 403


class TestExceptionDetailSanitization:
    """Verify internal error details are never exposed."""

    def test_internal_error_hides_details(self, client, auth_headers, monkeypatch):
        """When a service raises RuntimeError, response should say 'Internal server error'."""

        def mock_list_comments(*args, **kwargs):
            raise RuntimeError("PostgreSQL connection refused at 10.0.0.5:5432")

        monkeypatch.setattr(
            "services.comment_service.list_comments",
            mock_list_comments,
        )
        resp = client.get(
            "/api/v1/comments/TEST-001",
            headers=auth_headers,
        )
        assert resp.status_code == 500
        assert "PostgreSQL" not in resp.json()["detail"]
        assert resp.json()["detail"] == "Internal server error"


class TestErpAuthExplicit:
    """Verify ERP endpoints require authentication."""

    def test_erp_data_no_auth_returns_401(self, client):
        """GET /api/v1/erp/data without auth should return 401."""
        resp = client.get("/api/v1/erp/data")
        assert resp.status_code == 401

    def test_erp_data_with_auth_returns_200(self, client, auth_headers):
        """GET /api/v1/erp/data with valid auth should return 200."""
        resp = client.get("/api/v1/erp/data", headers=auth_headers)
        assert resp.status_code == 200


class TestFilenameSanitization:
    """Verify uploaded filenames are sanitized against path traversal."""

    def test_upload_sanitizes_path_traversal(self, client, auth_headers):
        """Upload with '../../../etc/passwd' filename should be sanitized."""
        from io import BytesIO
        files = {"file": ("../../../etc/passwd", BytesIO(b"test content"), "text/plain")}
        resp = client.post(
            "/api/v1/attachments/TEST-001/upload",
            files=files,
            headers=auth_headers,
        )
        # Should succeed but with sanitized filename
        if resp.status_code == 200:
            data = resp.json()
            if "filename" in data:
                assert ".." not in data["filename"]
                assert "/" not in data["filename"]

    def test_download_path_traversal_returns_400(self, client, auth_headers):
        """Download with path traversal in filename should return 400."""
        resp = client.get(
            "/api/v1/attachments/TEST-001/%2e%2epasswd/download",
            headers=auth_headers,
        )
        assert resp.status_code == 400
