"""Singleton repository instances shared across the application.

Supports two backends via STORAGE_BACKEND env var:
  - "excel" (default): ExcelRepository singletons — original behavior
  - "postgres": PostgresRepository with tenant_id=1 (EIPSA default)

For per-request tenant-scoped repos, use repositories.factory dependencies instead.
"""

import os

from repositories.excel_repository import ExcelRepository
from utils.config import DATA_ERP_PATH, CONSULTA_ERP_PATH, TAGS_PATH

STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "excel")

if STORAGE_BACKEND == "postgres":
    from db.database import SessionLocal
    from db.models import Document, Consulta, TagInspection
    from repositories.postgres_repository import PostgresRepository

    _session = SessionLocal()
    data_repo = PostgresRepository(_session, Document, tenant_id=1)
    consulta_repo = PostgresRepository(_session, Consulta, tenant_id=1)
    tags_repo = PostgresRepository(_session, TagInspection, tenant_id=1)
else:
    data_repo = ExcelRepository(DATA_ERP_PATH)
    consulta_repo = ExcelRepository(CONSULTA_ERP_PATH)
    tags_repo = ExcelRepository(TAGS_PATH, skiprows=[1])
