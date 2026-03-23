"""Minimal conftest for unit tests — no app import, no DB required."""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("STORAGE_BACKEND", "excel")
os.environ.setdefault("ENV", "test")
os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest")
