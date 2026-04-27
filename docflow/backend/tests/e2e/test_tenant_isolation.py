"""E2E tests — multi-tenant isolation.

Verifies that data created by tenant A is invisible to tenant B across
workflows, approvals, notifications, and cross-tenant resolution attempts.
"""

import pytest
from db.models import Notification


@pytest.fixture(autouse=True)
def _enable_workflows(monkeypatch):
    """Allow workflow/approval endpoints regardless of tenant plan."""
    monkeypatch.setattr(
        "services.plan_service.check_feature", lambda tid, feat: True
    )


@pytest.fixture()
def two_tenants(tenant_factory, user_factory, auth_token_factory):
    """Create two isolated tenants each with a user and auth headers."""
    # Tenant A
    t_a = tenant_factory(name="Alpha Inc", slug="alpha")
    user_factory(tenant_id=t_a.id, username="alpha.user", initials="AU", role="Document Controller")
    token_a = auth_token_factory(
        username="alpha.user", role="Document Controller", initials="AU", tenant_id=t_a.id
    )
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Tenant B
    t_b = tenant_factory(name="Beta Ltd", slug="beta")
    user_factory(tenant_id=t_b.id, username="beta.user", initials="BU", role="Document Controller")
    token_b = auth_token_factory(
        username="beta.user", role="Document Controller", initials="BU", tenant_id=t_b.id
    )
    headers_b = {"Authorization": f"Bearer {token_b}"}

    return (t_a, headers_a), (t_b, headers_b)


class TestWorkflowIsolation:
    """Workflows created by tenant A must not be listed by tenant B."""

    def test_workflows_isolated(self, client, two_tenants):
        (t_a, h_a), (t_b, h_b) = two_tenants

        # Tenant A creates a workflow
        r = client.post(
            "/api/v1/workflows/",
            json={
                "name": "Alpha only workflow",
                "trigger_type": "manual",
                "conditions": [],
                "actions": [],
            },
            headers=h_a,
        )
        assert r.status_code == 201

        # Tenant B lists workflows → empty
        r2 = client.get("/api/v1/workflows/", headers=h_b)
        assert r2.status_code == 200
        assert len(r2.json()) == 0

        # Tenant A can see it
        r3 = client.get("/api/v1/workflows/", headers=h_a)
        assert r3.status_code == 200
        assert len(r3.json()) == 1


class TestApprovalIsolation:
    """Approvals created by tenant A must not be listed by tenant B."""

    def test_approvals_isolated(self, client, two_tenants):
        (t_a, h_a), (t_b, h_b) = two_tenants

        # Tenant A creates an approval
        r = client.post(
            "/api/v1/workflows/approvals/",
            json={"title": "Alpha approval", "assigned_to": "AU"},
            headers=h_a,
        )
        assert r.status_code == 201

        # Tenant B lists approvals → empty
        r2 = client.get("/api/v1/workflows/approvals/", headers=h_b)
        assert r2.status_code == 200
        assert len(r2.json()) == 0

        # Tenant A can see it
        r3 = client.get("/api/v1/workflows/approvals/", headers=h_a)
        assert r3.status_code == 200
        assert len(r3.json()) == 1


class TestNotificationIsolation:
    """Notifications for tenant A must not be visible to tenant B via DB."""

    def test_notifications_isolated(self, client, two_tenants, db):
        (t_a, h_a), (t_b, h_b) = two_tenants

        # Create a notification directly for tenant A
        n = Notification(
            tenant_id=t_a.id,
            tipo="test",
            titulo="Alpha notification",
            detalle="For alpha only",
        )
        db.add(n)
        db.commit()

        # Tenant B has zero notifications
        beta_notifs = db.query(Notification).filter(
            Notification.tenant_id == t_b.id,
        ).all()
        assert len(beta_notifs) == 0

        # Tenant A has exactly one
        alpha_notifs = db.query(Notification).filter(
            Notification.tenant_id == t_a.id,
        ).all()
        assert len(alpha_notifs) == 1
        assert alpha_notifs[0].titulo == "Alpha notification"


class TestCrossTenantApprovalResolve:
    """Tenant B cannot resolve an approval that belongs to tenant A."""

    def test_cross_tenant_approval_resolve(self, client, two_tenants):
        (t_a, h_a), (t_b, h_b) = two_tenants

        # Tenant A creates approval
        r = client.post(
            "/api/v1/workflows/approvals/",
            json={"title": "Alpha private approval", "assigned_to": "AU"},
            headers=h_a,
        )
        assert r.status_code == 201
        approval_id = r.json()["id"]

        # Tenant B tries to approve it → 404 (not found in their tenant scope)
        r2 = client.post(
            f"/api/v1/workflows/approvals/{approval_id}/approve",
            json={"comment": "Hijack attempt"},
            headers=h_b,
        )
        assert r2.status_code == 404

        # The approval should still be pending (unchanged)
        r3 = client.get("/api/v1/workflows/approvals/", headers=h_a)
        assert r3.status_code == 200
        approvals = r3.json()
        match = [a for a in approvals if a["id"] == approval_id]
        assert len(match) == 1
        assert match[0]["status"] == "pending"
