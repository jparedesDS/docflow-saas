"""Shared fixtures for DocFlow backend tests."""

import os
import sys
import json
import pytest
from pathlib import Path

# Ensure backend directory is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Set test environment
os.environ["ENV"] = "test"
os.environ["JWT_SECRET"] = "test-secret-for-pytest"

from fastapi.testclient import TestClient
from main import app
from services.auth_service import create_token, hash_password


@pytest.fixture()
def client():
    """FastAPI TestClient."""
    return TestClient(app)


@pytest.fixture()
def auth_headers():
    """Authorization headers with a valid JWT token."""
    token = create_token({
        "sub": "test.user",
        "role": "Document Controller",
        "initials": "TU",
    })
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
