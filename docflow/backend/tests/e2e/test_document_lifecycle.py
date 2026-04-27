"""E2E tests — document lifecycle (create, list, update, audit, tenant isolation).

Documents use JSONB `data` column via PostgresRepository.
The conftest._setup_db fixture patches the singleton repos and the documents
router's service instances to use our SQLite in-memory DB.
"""

import pytest
from db.models import Document, AuditLog


class TestDocumentCreateAndList:
    """POST + GET /api/v1/documents/."""

    def test_create_and_list_documents(self, client, setup_tenant_with_user):
        tenant, user, headers = setup_tenant_with_user()

        # Create document
        r = client.post(
            "/api/v1/documents/",
            json={"Nº Doc. EIPSA": "DOC-001", "Título": "Test Document"},
            headers=headers,
        )
        assert r.status_code == 200  # create_document returns 200 (no status_code=201)
        body = r.json()
        assert body.get("Nº Doc. EIPSA") == "DOC-001"

        # List documents
        r2 = client.get("/api/v1/documents/", headers=headers)
        assert r2.status_code == 200
        docs = r2.json()
        assert isinstance(docs, list)
        doc_ids = [d.get("Nº Doc. EIPSA") for d in docs]
        assert "DOC-001" in doc_ids

    def test_create_requires_doc_eipsa(self, client, setup_tenant_with_user):
        """Missing Nº Doc. EIPSA returns 422."""
        _, _, headers = setup_tenant_with_user()

        r = client.post(
            "/api/v1/documents/",
            json={"Título": "No ID"},
            headers=headers,
        )
        assert r.status_code == 422


class TestDocumentUpdate:
    """PUT /api/v1/documents/{doc_id}."""

    def test_update_document_status(self, client, setup_tenant_with_user, db):
        tenant, user, headers = setup_tenant_with_user()

        # Seed document directly in DB via the repo's session (same engine)
        doc = Document(
            tenant_id=tenant.id,
            data={"Nº Doc. EIPSA": "DOC-002", "Título": "Update Me", "Estado": ""},
        )
        db.add(doc)
        db.commit()

        # Update status
        r = client.put(
            "/api/v1/documents/DOC-002",
            json={"Estado": "enviado"},
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json().get("Estado") == "enviado"

        # Verify via GET
        r2 = client.get("/api/v1/documents/DOC-002", headers=headers)
        assert r2.status_code == 200
        assert r2.json()["Estado"] == "enviado"


class TestDocumentAuditLog:
    """Document creation should produce an audit log entry."""

    def test_document_creates_audit_log(self, client, setup_tenant_with_user, db):
        tenant, user, headers = setup_tenant_with_user()

        # Create a document (triggers _create_side_effects → audit_service.log_change)
        client.post(
            "/api/v1/documents/",
            json={"Nº Doc. EIPSA": "DOC-AUDIT", "Título": "Audit Test"},
            headers=headers,
        )

        # Query audit log via API
        r = client.get(
            "/api/v1/audit/",
            params={"entity_type": "document"},
            headers=headers,
        )
        assert r.status_code == 200
        entries = r.json()
        assert isinstance(entries, list)
        # At least one entry for DOC-AUDIT
        matching = [e for e in entries if e.get("entity_id") == "DOC-AUDIT"]
        assert len(matching) >= 1
        assert matching[0]["action"] == "created"


class TestDocumentTenantIsolation:
    """Documents created by tenant A must not be visible to tenant B."""

    def test_tenant_isolation_documents(
        self, client, tenant_factory, user_factory, auth_token_factory, db, monkeypatch
    ):
        import repositories.instances as inst_mod

        # Tenant A
        tenant_a = tenant_factory(name="Tenant A", slug="tenant-a")
        user_factory(tenant_id=tenant_a.id, username="user.a", initials="UA")
        token_a = auth_token_factory(
            username="user.a", initials="UA", tenant_id=tenant_a.id
        )
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Tenant B
        tenant_b = tenant_factory(name="Tenant B", slug="tenant-b")
        user_factory(tenant_id=tenant_b.id, username="user.b", initials="UB")
        token_b = auth_token_factory(
            username="user.b", initials="UB", tenant_id=tenant_b.id
        )
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # Seed document for tenant A
        doc = Document(
            tenant_id=tenant_a.id,
            data={"Nº Doc. EIPSA": "DOC-PRIVATE", "Título": "Secret"},
        )
        db.add(doc)
        db.commit()

        # Tenant A can see it (switch repo tenant_id)
        monkeypatch.setattr(inst_mod.data_repo, "tenant_id", tenant_a.id)
        r_a = client.get("/api/v1/documents/", headers=headers_a)
        assert r_a.status_code == 200
        ids_a = [d.get("Nº Doc. EIPSA") for d in r_a.json()]
        assert "DOC-PRIVATE" in ids_a

        # Tenant B cannot see it
        monkeypatch.setattr(inst_mod.data_repo, "tenant_id", tenant_b.id)
        r_b = client.get("/api/v1/documents/", headers=headers_b)
        assert r_b.status_code == 200
        ids_b = [d.get("Nº Doc. EIPSA") for d in r_b.json()]
        assert "DOC-PRIVATE" not in ids_b
