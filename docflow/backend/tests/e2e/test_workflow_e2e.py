"""E2E tests — workflow engine (CRUD, triggers, conditions, notifications).

Workflows require the 'workflows' feature flag.  We monkeypatch
check_feature globally so all E2E tests in this module pass that gate.
"""

import pytest
from db.models import Document, Notification, Workflow


@pytest.fixture(autouse=True)
def _enable_workflows(monkeypatch):
    """Allow workflow endpoints regardless of tenant plan."""
    monkeypatch.setattr(
        "services.plan_service.check_feature", lambda tid, feat: True
    )


# ── Workflow CRUD ───────────────────────────────────────────────────────────


class TestWorkflowCRUD:
    """Create, list, delete workflows."""

    def test_create_workflow_crud(self, client, setup_tenant_with_user):
        tenant, _, headers = setup_tenant_with_user()

        # Create
        r = client.post(
            "/api/v1/workflows/",
            json={
                "name": "Notify on receive",
                "trigger_type": "document_received",
                "conditions": [],
                "actions": [{"type": "notify", "title": "Doc received"}],
            },
            headers=headers,
        )
        assert r.status_code == 201
        wf = r.json()
        wf_id = wf["id"]
        assert wf["name"] == "Notify on receive"

        # List
        r2 = client.get("/api/v1/workflows/", headers=headers)
        assert r2.status_code == 200
        names = [w["name"] for w in r2.json()]
        assert "Notify on receive" in names

        # Delete
        r3 = client.delete(f"/api/v1/workflows/{wf_id}", headers=headers)
        assert r3.status_code == 204

        # Verify deleted
        r4 = client.get("/api/v1/workflows/", headers=headers)
        assert all(w["id"] != wf_id for w in r4.json())

    def test_toggle_workflow(self, client, setup_tenant_with_user):
        """Create and then disable a workflow."""
        tenant, _, headers = setup_tenant_with_user()

        r = client.post(
            "/api/v1/workflows/",
            json={
                "name": "Toggle Test",
                "trigger_type": "status_changed",
                "conditions": [],
                "actions": [],
                "enabled": True,
            },
            headers=headers,
        )
        assert r.status_code == 201
        wf_id = r.json()["id"]

        # Toggle off
        r2 = client.patch(
            f"/api/v1/workflows/{wf_id}/toggle",
            json={"enabled": False},
            headers=headers,
        )
        assert r2.status_code == 200
        assert r2.json()["enabled"] is False

        # Verify
        r3 = client.get(f"/api/v1/workflows/{wf_id}", headers=headers)
        assert r3.json()["enabled"] is False


# ── Workflow Engine Trigger ─────────────────────────────────────────────────


class TestWorkflowTrigger:
    """Verify the workflow engine fires when a document status changes."""

    def _create_status_workflow(self, client, headers, condition_value="enviado"):
        """Helper: create a workflow that triggers on status_changed with
        a condition checking new_status == condition_value and action notify.
        """
        r = client.post(
            "/api/v1/workflows/",
            json={
                "name": f"Notify on {condition_value}",
                "trigger_type": "status_changed",
                "conditions": [
                    {
                        "field": "new_status",
                        "operator": "equals",
                        "value": condition_value,
                    }
                ],
                "actions": [
                    {
                        "type": "notify",
                        "title": f"Status changed to {condition_value}",
                    }
                ],
                "enabled": True,
            },
            headers=headers,
        )
        assert r.status_code == 201
        return r.json()

    def test_workflow_triggers_on_status_change(
        self, client, setup_tenant_with_user, db
    ):
        """Update doc to 'enviado' -> matching workflow creates a Notification."""
        tenant, _, headers = setup_tenant_with_user()
        self._create_status_workflow(client, headers, "enviado")

        # Seed document
        doc = Document(
            tenant_id=tenant.id,
            data={"Nº Doc. EIPSA": "DOC-WF1", "Título": "WF Test", "Estado": ""},
        )
        db.add(doc)
        db.commit()

        # Update status -> triggers workflow engine
        r = client.put(
            "/api/v1/documents/DOC-WF1",
            json={"Estado": "enviado"},
            headers=headers,
        )
        assert r.status_code == 200

        # Refresh session to see commits from other sessions (workflow engine)
        db.expire_all()

        # Check notification was created in DB
        notifications = (
            db.query(Notification)
            .filter(
                Notification.tenant_id == tenant.id,
                Notification.tipo == "workflow",
            )
            .all()
        )
        assert len(notifications) >= 1
        assert any("enviado" in n.titulo for n in notifications)

    def test_workflow_conditions_prevent_execution(
        self, client, setup_tenant_with_user, db
    ):
        """Condition requires 'aprobado' but doc updated to 'enviado' -> no notification."""
        tenant, _, headers = setup_tenant_with_user()
        self._create_status_workflow(client, headers, "aprobado")

        doc = Document(
            tenant_id=tenant.id,
            data={"Nº Doc. EIPSA": "DOC-WF2", "Título": "No Match", "Estado": ""},
        )
        db.add(doc)
        db.commit()

        client.put(
            "/api/v1/documents/DOC-WF2",
            json={"Estado": "enviado"},
            headers=headers,
        )

        db.expire_all()
        notifications = (
            db.query(Notification)
            .filter(
                Notification.tenant_id == tenant.id,
                Notification.tipo == "workflow",
            )
            .all()
        )
        assert len(notifications) == 0

    def test_disabled_workflow_does_not_trigger(
        self, client, setup_tenant_with_user, db
    ):
        """A disabled workflow should not fire even if conditions match."""
        tenant, _, headers = setup_tenant_with_user()
        wf = self._create_status_workflow(client, headers, "enviado")

        # Disable
        client.patch(
            f"/api/v1/workflows/{wf['id']}/toggle",
            json={"enabled": False},
            headers=headers,
        )

        doc = Document(
            tenant_id=tenant.id,
            data={
                "Nº Doc. EIPSA": "DOC-WF3",
                "Título": "Disabled WF",
                "Estado": "",
            },
        )
        db.add(doc)
        db.commit()

        client.put(
            "/api/v1/documents/DOC-WF3",
            json={"Estado": "enviado"},
            headers=headers,
        )

        db.expire_all()
        notifications = (
            db.query(Notification)
            .filter(
                Notification.tenant_id == tenant.id,
                Notification.tipo == "workflow",
            )
            .all()
        )
        assert len(notifications) == 0
