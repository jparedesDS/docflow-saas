"""E2E test fixtures — real database (SQLite in-memory), no service mocks."""

import os
import sys
import pytest
from pathlib import Path

# Backend on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Override DB BEFORE importing anything else
os.environ["ENV"] = "test"
os.environ["JWT_SECRET"] = "test-secret-e2e"
os.environ["STORAGE_BACKEND"] = "postgres"  # Use ORM path, not Excel
os.environ["DATABASE_URL"] = "sqlite://"  # In-memory SQLite

import sqlalchemy
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# ── JSONB → JSON compilation for SQLite ──────────────────────────────────────
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB


@compiles(PG_JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


# ── Patch create_engine to tolerate SQLite + pool args ───────────────────────
# db.database creates a module-level engine with pool_size/max_overflow/
# pool_pre_ping which are invalid for SQLite.  We wrap create_engine to strip
# those args when the URL is sqlite, then restore after import.
_original_create_engine = sqlalchemy.create_engine


def _safe_create_engine(url, **kwargs):
    if str(url).startswith("sqlite"):
        for key in ("pool_size", "max_overflow", "pool_pre_ping"):
            kwargs.pop(key, None)
    return _original_create_engine(url, **kwargs)


sqlalchemy.create_engine = _safe_create_engine

from db.database import Base  # noqa: E402  (must come after patches)

sqlalchemy.create_engine = _original_create_engine  # restore

# SQLite needs special handling for FK enforcement
_e2e_engine = create_engine("sqlite://", echo=False)


@event.listens_for(_e2e_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


_E2ESession = sessionmaker(bind=_e2e_engine, autocommit=False, autoflush=False)


@pytest.fixture(autouse=True)
def _setup_db(monkeypatch):
    """Create all tables before each test, drop after.

    Also patches module-level singletons that may have been initialised
    with the wrong backend (e.g. ExcelRepository when parent conftest set
    STORAGE_BACKEND=excel before our conftest could override it).
    """
    # 1. Patch DB engine/session factory used by all services
    import db.database as db_mod
    monkeypatch.setattr(db_mod, "engine", _e2e_engine)
    monkeypatch.setattr(db_mod, "SessionLocal", _E2ESession)

    # 2. Force STORAGE_BACKEND=postgres for any runtime checks
    monkeypatch.setenv("STORAGE_BACKEND", "postgres")

    # 3. Ensure router-level STORAGE_BACKEND vars pick up the override
    import routers.auth as auth_mod
    monkeypatch.setattr(auth_mod, "STORAGE_BACKEND", "postgres")

    # 4. Create tables
    Base.metadata.create_all(bind=_e2e_engine)

    # 5. Replace document repo singletons if they are ExcelRepositories
    #    (this can happen when tests/conftest.py loaded main.py first)
    import repositories.instances as inst_mod
    from repositories.postgres_repository import PostgresRepository
    from repositories.excel_repository import ExcelRepository
    from db.models import Document, Consulta, TagInspection

    _test_session = _E2ESession()

    if isinstance(inst_mod.data_repo, ExcelRepository):
        monkeypatch.setattr(
            inst_mod, "data_repo",
            PostgresRepository(_test_session, Document, tenant_id=1),
        )
    elif isinstance(inst_mod.data_repo, PostgresRepository):
        monkeypatch.setattr(inst_mod.data_repo, "db", _test_session)

    if isinstance(inst_mod.consulta_repo, ExcelRepository):
        monkeypatch.setattr(
            inst_mod, "consulta_repo",
            PostgresRepository(_test_session, Consulta, tenant_id=1),
        )
    elif isinstance(inst_mod.consulta_repo, PostgresRepository):
        monkeypatch.setattr(inst_mod.consulta_repo, "db", _test_session)

    if isinstance(inst_mod.tags_repo, ExcelRepository):
        monkeypatch.setattr(
            inst_mod, "tags_repo",
            PostgresRepository(_test_session, TagInspection, tenant_id=1),
        )
    elif isinstance(inst_mod.tags_repo, PostgresRepository):
        monkeypatch.setattr(inst_mod.tags_repo, "db", _test_session)

    # Also patch the service and monitoring_service on the documents router
    # which captured the repo at import time
    import routers.documents as docs_router_mod
    from services.document_service import DocumentService
    from services.monitoring_service import MonitoringService
    monkeypatch.setattr(docs_router_mod, "service", DocumentService(inst_mod.data_repo))
    monkeypatch.setattr(
        docs_router_mod, "monitoring_service",
        MonitoringService(inst_mod.data_repo, inst_mod.consulta_repo),
    )

    yield

    _test_session.close()
    Base.metadata.drop_all(bind=_e2e_engine)


@pytest.fixture()
def db():
    """Provide a clean DB session for test setup."""
    session = _E2ESession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client():
    """FastAPI TestClient backed by real SQLite DB."""
    from fastapi.testclient import TestClient
    from main import app
    return TestClient(app)


@pytest.fixture()
def tenant_factory(db):
    """Factory to create tenants."""
    from db.models import Tenant

    def _create(name="Test Corp", slug="test-corp", plan="enterprise", max_users=100):
        t = Tenant(name=name, slug=slug, plan=plan, max_users=max_users)
        db.add(t)
        db.commit()
        db.refresh(t)
        return t

    return _create


@pytest.fixture()
def user_factory(db):
    """Factory to create users with hashed passwords."""
    from db.models import User
    from services.auth_service import hash_password

    def _create(
        tenant_id,
        username="test.user",
        name="Test User",
        initials="TU",
        role="Document Controller",
        password="TestPass123",
    ):
        u = User(
            tenant_id=tenant_id,
            username=username,
            name=name,
            initials=initials,
            role=role,
            password_hash=hash_password(password),
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        return u

    return _create


@pytest.fixture()
def auth_token_factory():
    """Factory to create JWT tokens."""
    from services.auth_service import create_token

    def _create(
        username="test.user",
        role="Document Controller",
        initials="TU",
        tenant_id=1,
    ):
        return create_token(
            {
                "sub": username,
                "role": role,
                "initials": initials,
                "tenant_id": tenant_id,
            }
        )

    return _create


@pytest.fixture()
def setup_tenant_with_user(tenant_factory, user_factory, auth_token_factory):
    """Create a tenant + user + auth headers in one call."""

    def _create(
        tenant_name="Test Corp",
        tenant_slug="test-corp",
        plan="enterprise",
        username="test.user",
        initials="TU",
        role="Document Controller",
    ):
        tenant = tenant_factory(name=tenant_name, slug=tenant_slug, plan=plan)
        user = user_factory(
            tenant_id=tenant.id, username=username, initials=initials, role=role
        )
        token = auth_token_factory(
            username=username, role=role, initials=initials, tenant_id=tenant.id
        )
        headers = {"Authorization": f"Bearer {token}"}
        return tenant, user, headers

    return _create
