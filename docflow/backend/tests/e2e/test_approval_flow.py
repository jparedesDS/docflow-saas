"""E2E tests — approval request flow (create, approve, reject, escalate, filter)."""

import pytest
from db.models import ApprovalRequest


@pytest.fixture(autouse=True)
def _enable_workflows(monkeypatch):
    """Allow workflow/approval endpoints regardless of tenant plan."""
    monkeypatch.setattr(
        "services.plan_service.check_feature", lambda tid, feat: True
    )


class TestApprovalCRUD:
    """POST + GET /api/v1/workflows/approvals/."""

    def test_create_and_list_approvals(self, client, setup_tenant_with_user):
        tenant, _, headers = setup_tenant_with_user()

        r = client.post(
            "/api/v1/workflows/approvals/",
            json={
                "title": "Review DOC-100",
                "description": "Please review",
                "document_ref": "DOC-100",
                "assigned_to": "TU",
            },
            headers=headers,
        )
        assert r.status_code == 201
        body = r.json()
        assert body["title"] == "Review DOC-100"
        assert body["status"] == "pending"
        assert body["requested_by"] == "test.user"

        # List
        r2 = client.get("/api/v1/workflows/approvals/", headers=headers)
        assert r2.status_code == 200
        titles = [a["title"] for a in r2.json()]
        assert "Review DOC-100" in titles


class TestApproveReject:
    """Approve and reject approval requests."""

    def _create_approval(self, client, headers, title="Approval Test"):
        r = client.post(
            "/api/v1/workflows/approvals/",
            json={"title": title, "assigned_to": "TU"},
            headers=headers,
        )
        assert r.status_code == 201
        return r.json()

    def test_approve_with_comment(self, client, setup_tenant_with_user):
        """Approve a pending request with a comment."""
        _, _, headers = setup_tenant_with_user()
        approval = self._create_approval(client, headers, "Approve Me")

        r = client.post(
            f"/api/v1/workflows/approvals/{approval['id']}/approve",
            json={"comment": "Looks good"},
            headers=headers,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "approved"

        # Verify comment is stored
        comments = body.get("comments", [])
        assert any(c.get("text") == "Looks good" for c in comments)

    def test_reject_approval(self, client, setup_tenant_with_user):
        """Reject a pending request."""
        _, _, headers = setup_tenant_with_user()
        approval = self._create_approval(client, headers, "Reject Me")

        r = client.post(
            f"/api/v1/workflows/approvals/{approval['id']}/reject",
            json={"comment": "Needs rework"},
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

    def test_cannot_approve_already_resolved(self, client, setup_tenant_with_user):
        """Approving an already-approved request returns 404 (not pending)."""
        _, _, headers = setup_tenant_with_user()
        approval = self._create_approval(client, headers, "Double Resolve")

        # First approve
        r1 = client.post(
            f"/api/v1/workflows/approvals/{approval['id']}/approve",
            json={"comment": "OK"},
            headers=headers,
        )
        assert r1.status_code == 200

        # Try to reject the same one
        r2 = client.post(
            f"/api/v1/workflows/approvals/{approval['id']}/reject",
            json={"comment": "Too late"},
            headers=headers,
        )
        assert r2.status_code == 404

    def test_escalate_approval(self, client, setup_tenant_with_user):
        """Escalate a pending approval."""
        _, _, headers = setup_tenant_with_user()
        approval = self._create_approval(client, headers, "Escalate Me")

        r = client.post(
            f"/api/v1/workflows/approvals/{approval['id']}/escalate",
            json={"comment": "Needs manager attention"},
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "escalated"


class TestApprovalFilter:
    """Filter approvals by status."""

    def test_filter_by_status(self, client, setup_tenant_with_user):
        _, _, headers = setup_tenant_with_user()

        # Create 2 approvals
        r1 = client.post(
            "/api/v1/workflows/approvals/",
            json={"title": "First", "assigned_to": "TU"},
            headers=headers,
        )
        r2 = client.post(
            "/api/v1/workflows/approvals/",
            json={"title": "Second", "assigned_to": "TU"},
            headers=headers,
        )
        assert r1.status_code == 201
        assert r2.status_code == 201

        first_id = r1.json()["id"]

        # Approve the first one
        client.post(
            f"/api/v1/workflows/approvals/{first_id}/approve",
            json={"comment": "Done"},
            headers=headers,
        )

        # Filter pending only
        r = client.get(
            "/api/v1/workflows/approvals/",
            params={"status": "pending"},
            headers=headers,
        )
        assert r.status_code == 200
        pending = r.json()
        assert len(pending) == 1
        assert pending[0]["title"] == "Second"
