"""Tests for workflows router — CRUD + approvals + feature gating."""

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
