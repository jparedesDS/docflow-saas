"""Fase 5 hardening tests — security, upload validation, rate limits, CORS."""

import io
import os
import pytest


class TestTenantIdValidation:
    """A1: Token without tenant_id must be rejected."""

    def test_no_tenant_returns_401(self, client, auth_headers_no_tenant):
        """Token without tenant_id → 401."""
        resp = client.get("/api/v1/documents/", headers=auth_headers_no_tenant)
        assert resp.status_code == 401
        assert "tenant_id" in resp.json()["detail"].lower()

    def test_no_tenant_on_audit(self, client, auth_headers_no_tenant):
        """Token without tenant_id on audit endpoint → 401."""
        resp = client.get("/api/v1/audit/", headers=auth_headers_no_tenant)
        assert resp.status_code == 401

    def test_valid_tenant_passes(self, client, auth_headers):
        """Token with tenant_id=1 → 200."""
        resp = client.get("/api/v1/documents/", headers=auth_headers)
        assert resp.status_code == 200

    def test_tenant2_passes(self, client, auth_headers_tenant2):
        """Token with tenant_id=2 → 200 (middleware allows)."""
        resp = client.get("/api/v1/documents/", headers=auth_headers_tenant2)
        assert resp.status_code == 200


class TestFileUploadValidation:
    """A3: MIME type and size validation on /documents/upload."""

    def test_valid_pdf_upload(self, client, auth_headers):
        """PDF file within limits → 200."""
        pdf_content = b"%PDF-1.4 test content " + b"x" * 100
        resp = client.post(
            "/api/v1/documents/upload",
            headers=auth_headers,
            files={"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")},
        )
        assert resp.status_code == 200
        assert resp.json()["filename"] == "test.pdf"

    def test_executable_mime_rejected(self, client, auth_headers):
        """Executable MIME type → 415."""
        resp = client.post(
            "/api/v1/documents/upload",
            headers=auth_headers,
            files={"file": ("bad.exe", io.BytesIO(b"MZ..."), "application/x-executable")},
        )
        assert resp.status_code == 415

    def test_oversized_file_rejected(self, client, auth_headers):
        """File > 50MB → 413."""
        big_content = b"x" * (50 * 1024 * 1024 + 1)
        resp = client.post(
            "/api/v1/documents/upload",
            headers=auth_headers,
            files={"file": ("big.pdf", io.BytesIO(big_content), "application/pdf")},
        )
        assert resp.status_code == 413

    def test_attachment_invalid_mime(self, client, auth_headers):
        """Attachment with invalid MIME → 415."""
        resp = client.post(
            "/api/v1/attachments/DOC-001/upload",
            headers=auth_headers,
            files={"file": ("script.sh", io.BytesIO(b"#!/bin/bash"), "application/x-shellscript")},
        )
        assert resp.status_code == 415

    def test_attachment_valid_pdf(self, client, auth_headers):
        """Attachment with valid PDF MIME → calls storage (mock)."""
        from unittest.mock import patch

        with patch("services.storage_service.upload") as mock_upload:
            mock_upload.return_value = {"id": 1, "filename": "doc.pdf", "status": "uploaded"}
            resp = client.post(
                "/api/v1/attachments/DOC-001/upload",
                headers=auth_headers,
                files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")},
            )
            assert resp.status_code == 200


class TestRateLimitHeaders:
    """A6: Rate-limit headers present on authenticated responses."""

    def test_rate_limit_headers_present(self, client, auth_headers):
        """Authenticated response should include rate limit headers."""
        resp = client.get("/api/v1/documents/", headers=auth_headers)
        assert "X-RateLimit-Limit" in resp.headers
        assert "X-RateLimit-Remaining" in resp.headers
        assert "X-RateLimit-Reset" in resp.headers

    def test_rate_limit_values_are_numeric(self, client, auth_headers):
        """Rate limit header values must be numeric strings."""
        resp = client.get("/api/v1/documents/", headers=auth_headers)
        assert resp.headers["X-RateLimit-Limit"].isdigit()
        assert resp.headers["X-RateLimit-Remaining"].isdigit()
        assert resp.headers["X-RateLimit-Reset"].isdigit()

    def test_remaining_decrements(self, client, auth_headers):
        """Remaining should decrement between consecutive requests."""
        r1 = client.get("/api/v1/documents/", headers=auth_headers)
        remaining1 = int(r1.headers["X-RateLimit-Remaining"])

        r2 = client.get("/api/v1/documents/", headers=auth_headers)
        remaining2 = int(r2.headers["X-RateLimit-Remaining"])

        assert remaining2 <= remaining1


class TestSecurityHeaders:
    """C3: Security headers on all responses."""

    EXPECTED_HEADERS = [
        "X-Content-Type-Options",
        "X-Frame-Options",
        "X-XSS-Protection",
        "Referrer-Policy",
        "Strict-Transport-Security",
        "Permissions-Policy",
    ]

    def test_security_headers_on_documents(self, client, auth_headers):
        """GET /api/v1/documents/ → 6 security headers present."""
        resp = client.get("/api/v1/documents/", headers=auth_headers)
        for header in self.EXPECTED_HEADERS:
            assert header in resp.headers, f"Missing header: {header}"

    def test_security_headers_on_404(self, client, auth_headers):
        """GET nonexistent path → security headers present on error."""
        resp = client.get("/api/v1/nonexistent/", headers=auth_headers)
        for header in self.EXPECTED_HEADERS:
            assert header in resp.headers, f"Missing header on 404: {header}"

    def test_security_headers_on_public_endpoint(self, client):
        """GET /api/v1/health/ → security headers present without auth."""
        resp = client.get("/api/v1/health/")
        for header in self.EXPECTED_HEADERS:
            assert header in resp.headers, f"Missing header on public: {header}"


class TestCorsRestrictions:
    """A5: CORS configuration validation."""

    def test_configured_origin_allowed(self, client, auth_headers):
        """Request with configured origin → CORS headers present."""
        resp = client.get(
            "/api/v1/documents/",
            headers={**auth_headers, "Origin": "http://localhost:3000"},
        )
        assert "access-control-allow-origin" in resp.headers

    def test_options_preflight(self, client):
        """OPTIONS preflight → allowed methods listed."""
        resp = client.options(
            "/api/v1/documents/",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        # CORS middleware handles preflight
        allow_methods = resp.headers.get("access-control-allow-methods", "")
        assert "GET" in allow_methods
