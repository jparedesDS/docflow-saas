"""Shared fixtures for DocFlow backend tests."""

import os
import sys
import json
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

# Ensure backend directory is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Set test environment
os.environ["ENV"] = "test"
os.environ["JWT_SECRET"] = "test-secret-for-pytest"
os.environ["STORAGE_BACKEND"] = "excel"

from fastapi.testclient import TestClient
from main import app
from services.auth_service import create_token, hash_password


@pytest.fixture()
def client():
    """FastAPI TestClient."""
    return TestClient(app)


@pytest.fixture()
def auth_headers():
    """Authorization headers with a valid JWT token (Document Controller, tenant_id=1)."""
    token = create_token({
        "sub": "test.user",
        "role": "Document Controller",
        "initials": "TU",
        "tenant_id": 1,
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_headers_admin():
    """Authorization headers for admin user (tenant_id=1)."""
    token = create_token({
        "sub": "admin.user",
        "role": "admin",
        "initials": "AU",
        "tenant_id": 1,
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_headers_tenant2():
    """Authorization headers for a user in tenant_id=2 (isolation testing)."""
    token = create_token({
        "sub": "other.user",
        "role": "Document Controller",
        "initials": "OU",
        "tenant_id": 2,
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_headers_no_tenant():
    """JWT without tenant_id — should be rejected."""
    from jose import jwt
    token = jwt.encode(
        {"sub": "bad.user", "role": "admin", "initials": "BU"},
        os.environ["JWT_SECRET"], algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def users_file(tmp_path):
    """Create a temporary users.json for testing."""
    users = {
        "test.user": {
            "name": "Test User",
            "initials": "TU",
            "role": "Document Controller",
            "password_hash": hash_password("TestPass123"),
        }
    }
    filepath = tmp_path / "users.json"
    filepath.write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")
    return filepath


@pytest.fixture()
def mock_stripe():
    """Mock Stripe API calls."""
    with patch("services.billing_service.stripe") as mock:
        mock.checkout.Session.create.return_value = MagicMock(url="https://checkout.stripe.com/test")
        mock.billing_portal.Session.create.return_value = MagicMock(url="https://billing.stripe.com/test")
        yield mock


@pytest.fixture()
def mock_db_session():
    """Mock database session for unit tests that don't need real DB."""
    mock_session = MagicMock()
    with patch("db.database.SessionLocal", return_value=mock_session):
        yield mock_session
