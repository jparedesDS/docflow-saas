"""Tests for workflows router — CRUD + approvals + feature gating + engine actions."""

import os
import pytest
from unittest.mock import patch, MagicMock


class TestWorkflowFeatureGate:
    """Workflows should be blocked for free plan tenants."""

    def test_list_workflows_blocked_on_free(self, client):
        """Free plan tenant should get 403."""
        from services.auth_service import create_token
        token = create_token({
            "sub": "free.user", "role": "admin",
            "initials": "FU", "tenant_id": 99,
        })
        headers = {"Authorization": f"Bearer {token}"}

        with patch("routers.workflows.check_feature", return_value=False):
            r = client.get("/api/v1/workflows/", headers=headers)
            assert r.status_code == 403

    def test_create_workflow_blocked_on_free(self, client):
        """Free plan tenant cannot create workflows."""
        from services.auth_service import create_token
        token = create_token({
            "sub": "free.user", "role": "admin",
            "initials": "FU", "tenant_id": 99,
        })
        headers = {"Authorization": f"Bearer {token}"}

        with patch("routers.workflows.check_feature", return_value=False):
            r = client.post("/api/v1/workflows/", json={
                "name": "Test", "trigger_type": "manual",
            }, headers=headers)
            assert r.status_code == 403


class TestWorkflowCRUD:
    """Workflow CRUD operations with mocked service."""

    def test_list_workflows(self, client, auth_headers):
        """List workflows returns array."""
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.list_workflows", return_value=[]):
            r = client.get("/api/v1/workflows/", headers=auth_headers)
            assert r.status_code == 200
            assert r.json() == []

    def test_create_workflow(self, client, auth_headers):
        """Create workflow returns 201."""
        mock_wf = {
            "id": 1, "tenant_id": 1, "name": "Test Flow",
            "trigger_type": "manual", "enabled": True,
            "conditions": [], "actions": [],
        }
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.create_workflow", return_value=mock_wf):
            r = client.post("/api/v1/workflows/", json={
                "name": "Test Flow", "trigger_type": "manual",
            }, headers=auth_headers)
            assert r.status_code == 201
            assert r.json()["name"] == "Test Flow"

    def test_get_workflow_not_found(self, client, auth_headers):
        """Get non-existent workflow returns 404."""
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.get_workflow", return_value=None):
            r = client.get("/api/v1/workflows/999", headers=auth_headers)
            assert r.status_code == 404

    def test_delete_workflow(self, client, auth_headers):
        """Delete workflow returns 204."""
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.delete_workflow", return_value=True):
            r = client.delete("/api/v1/workflows/1", headers=auth_headers)
            assert r.status_code == 204

    def test_toggle_workflow(self, client, auth_headers):
        """Toggle workflow enabled/disabled."""
        mock_wf = {"id": 1, "enabled": False}
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.toggle_workflow", return_value=mock_wf):
            r = client.patch("/api/v1/workflows/1/toggle", json={"enabled": False}, headers=auth_headers)
            assert r.status_code == 200
            assert r.json()["enabled"] is False


class TestApprovals:
    """Approval request operations."""

    def test_list_approvals(self, client, auth_headers):
        """List approvals returns array."""
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.list_approval_requests", return_value=[]):
            r = client.get("/api/v1/workflows/approvals/", headers=auth_headers)
            assert r.status_code == 200
            assert r.json() == []

    def test_create_approval(self, client, auth_headers):
        """Create approval returns 201."""
        mock_req = {
            "id": 1, "title": "Review doc", "status": "pending",
            "requested_by": "test.user",
        }
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.create_approval_request", return_value=mock_req):
            r = client.post("/api/v1/workflows/approvals/", json={
                "title": "Review doc",
            }, headers=auth_headers)
            assert r.status_code == 201
            assert r.json()["status"] == "pending"

    def test_approve_request(self, client, auth_headers):
        """Approve request returns resolved data."""
        mock_req = {"id": 1, "status": "approved"}
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.approve_request", return_value=mock_req):
            r = client.post("/api/v1/workflows/approvals/1/approve", json={
                "comment": "LGTM",
            }, headers=auth_headers)
            assert r.status_code == 200
            assert r.json()["status"] == "approved"

    def test_reject_request(self, client, auth_headers):
        """Reject request returns resolved data."""
        mock_req = {"id": 1, "status": "rejected"}
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.reject_request", return_value=mock_req):
            r = client.post("/api/v1/workflows/approvals/1/reject", json={
                "comment": "Needs rework",
            }, headers=auth_headers)
            assert r.status_code == 200
            assert r.json()["status"] == "rejected"

    def test_approve_not_found(self, client, auth_headers):
        """Approve non-existent request returns 404."""
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.approve_request", return_value=None):
            r = client.post("/api/v1/workflows/approvals/999/approve", json={
                "comment": "",
            }, headers=auth_headers)
            assert r.status_code == 404

    def test_add_comment(self, client, auth_headers):
        """Add comment to approval request."""
        mock_req = {"id": 1, "comments": [{"by": "test.user", "text": "FYI"}]}
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.add_comment", return_value=mock_req):
            r = client.post("/api/v1/workflows/approvals/1/comment", json={
                "text": "FYI",
            }, headers=auth_headers)
            assert r.status_code == 200


class TestMultiTenantIsolation:
    """Ensure tenant isolation in workflow operations."""

    def test_list_workflows_uses_tenant_id(self, client, auth_headers):
        """List workflows should pass correct tenant_id to service."""
        with patch("routers.workflows.check_feature", return_value=True) as mock_cf, \
             patch("routers.workflows.workflow_service.list_workflows", return_value=[]) as mock_list:
            client.get("/api/v1/workflows/", headers=auth_headers)
            mock_list.assert_called_once_with(1)

    def test_different_tenants_see_different_data(self, client, auth_headers, auth_headers_tenant2):
        """Different tenants should call service with their respective tenant_ids."""
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.list_workflows", return_value=[]) as mock_list:
            client.get("/api/v1/workflows/", headers=auth_headers)
            mock_list.assert_called_with(1)

            client.get("/api/v1/workflows/", headers=auth_headers_tenant2)
            mock_list.assert_called_with(2)


class TestWorkflowActions:
    """Tests for workflow engine action execution."""

    def test_change_status_action_missing_fields(self):
        """change_status without required fields returns applied=False."""
        from services.workflow_engine import _action_change_status
        result = _action_change_status(
            {"new_status": ""},
            {"document_ref": "DOC-001"},
            tenant_id=1,
        )
        assert result["action"] == "change_status"
        assert result["applied"] is False
        assert "reason" in result

    def test_change_status_action_nonexistent_doc(self):
        """change_status on non-existent document returns applied=False."""
        from services.workflow_engine import _action_change_status
        result = _action_change_status(
            {"new_status": "enviado"},
            {"document_ref": "NONEXISTENT-001"},
            tenant_id=1,
        )
        assert result["action"] == "change_status"
        assert result["applied"] is False

    def test_send_email_action_no_recipients(self):
        """send_email without recipients should not crash."""
        from services.workflow_engine import _action_send_email
        result = _action_send_email(
            {"to": "", "subject": "Test"},
            {},
            tenant_id=1,
        )
        assert result["sent"] is False
        assert result["reason"] == "no recipients"

    def test_send_email_action_with_recipients_smtp_fail(self):
        """send_email with recipients but SMTP failure returns sent=False."""
        from services.workflow_engine import _action_send_email
        with patch("services.smtp_service.send_html_email", side_effect=Exception("SMTP down")):
            result = _action_send_email(
                {"to": "user@example.com", "subject": "Test", "body": "Hello"},
                {},
                tenant_id=1,
            )
            assert result["sent"] is False
            assert result["to"] == ["user@example.com"]

    def test_send_email_action_placeholder_substitution(self):
        """send_email should substitute placeholders in subject and body."""
        from services.workflow_engine import _action_send_email
        with patch("services.smtp_service.send_html_email") as mock_send:
            result = _action_send_email(
                {"to": "user@example.com", "subject": "Doc {{doc_ref}} updated", "body": "Status: {{status}}"},
                {"doc_ref": "DOC-123", "status": "approved"},
                tenant_id=1,
            )
            assert result["subject"] == "Doc DOC-123 updated"
            assert result["sent"] is True
            # Verify HTML body contains substituted text
            call_args = mock_send.call_args
            assert "approved" in call_args.kwargs.get("html_body", call_args[1].get("html_body", ""))

    def test_escalate_request_nonexistent(self):
        """escalate_request on non-existent request should return None."""
        from services.workflow_service import escalate_request
        with patch("services.workflow_service._get_session") as mock_session:
            session = MagicMock()
            mock_session.return_value = session
            session.query.return_value.filter.return_value.first.return_value = None
            result = escalate_request(1, 999999, "test.user", "Urgent")
            assert result is None


class TestApprovalEndpoints:
    """Tests for new approval endpoints (my approvals + escalate)."""

    def test_my_approvals_endpoint(self, client, auth_headers):
        """GET /approvals/my returns list for current user."""
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.list_approval_requests", return_value=[]) as mock_list:
            r = client.get("/api/v1/workflows/approvals/my", headers=auth_headers)
            assert r.status_code == 200
            assert r.json() == []
            # Should filter by current user's initials
            mock_list.assert_called_once_with(1, assigned_to="TU")

    def test_my_approvals_blocked_on_free(self, client):
        """Free plan tenant should get 403 on /approvals/my."""
        from services.auth_service import create_token
        token = create_token({
            "sub": "free.user", "role": "admin",
            "initials": "FU", "tenant_id": 99,
        })
        headers = {"Authorization": f"Bearer {token}"}
        with patch("routers.workflows.check_feature", return_value=False):
            r = client.get("/api/v1/workflows/approvals/my", headers=headers)
            assert r.status_code == 403

    def test_escalate_endpoint_not_found(self, client, auth_headers):
        """Escalate non-existent request returns 404."""
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.escalate_request", return_value=None):
            r = client.post(
                "/api/v1/workflows/approvals/99999/escalate",
                json={"comment": "test"},
                headers=auth_headers,
            )
            assert r.status_code == 404

    def test_escalate_endpoint_success(self, client, auth_headers):
        """Escalate existing pending request returns escalated data."""
        mock_req = {"id": 1, "status": "escalated", "comments": [{"action": "escalated"}]}
        with patch("routers.workflows.check_feature", return_value=True), \
             patch("routers.workflows.workflow_service.escalate_request", return_value=mock_req):
            r = client.post(
                "/api/v1/workflows/approvals/1/escalate",
                json={"comment": "Urgent review needed"},
                headers=auth_headers,
            )
            assert r.status_code == 200
            assert r.json()["status"] == "escalated"

    def test_escalate_blocked_on_free(self, client):
        """Free plan tenant should get 403 on escalate."""
        from services.auth_service import create_token
        token = create_token({
            "sub": "free.user", "role": "admin",
            "initials": "FU", "tenant_id": 99,
        })
        headers = {"Authorization": f"Bearer {token}"}
        with patch("routers.workflows.check_feature", return_value=False):
            r = client.post(
                "/api/v1/workflows/approvals/1/escalate",
                json={"comment": "test"},
                headers=headers,
            )
            assert r.status_code == 403
