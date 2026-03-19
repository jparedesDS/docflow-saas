"""Repository factory — FastAPI dependencies that create tenant-scoped repos.

Usage in routers:
    from repositories.factory import get_data_repo, get_consulta_repo, get_tags_repo

    @router.get("/documents")
    async def list_docs(repo = Depends(get_data_repo)):
        return repo.get_all()
"""

import os

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from repositories.base_repository import BaseRepository

STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "excel")


def _get_tenant_id(request: Request) -> int:
    """Extract tenant_id from request.state (set by JWTAuthMiddleware)."""
    user = getattr(request.state, "user", None)
    if user and "tenant_id" in user:
        return user["tenant_id"]
    return 1  # Default to EIPSA


def _get_excel_repos():
    """Import Excel singletons lazily to avoid circular imports."""
    from repositories.excel_repository import ExcelRepository
    from utils.config import DATA_ERP_PATH, CONSULTA_ERP_PATH, TAGS_PATH

    return {
        "data": ExcelRepository(DATA_ERP_PATH),
        "consulta": ExcelRepository(CONSULTA_ERP_PATH),
        "tags": ExcelRepository(TAGS_PATH, skiprows=[1]),
    }


# Cache Excel singletons
_excel_repos = None


def _ensure_excel():
    global _excel_repos
    if _excel_repos is None:
        _excel_repos = _get_excel_repos()
    return _excel_repos


# ── Factory dependencies ────────────────────────────────────────────────────


def get_data_repo(request: Request) -> BaseRepository:
    if STORAGE_BACKEND == "postgres":
        from db.database import get_db
        from db.models import Document
        from repositories.postgres_repository import PostgresRepository
        db = next(get_db())
        return PostgresRepository(db, Document, _get_tenant_id(request))
    return _ensure_excel()["data"]


def get_consulta_repo(request: Request) -> BaseRepository:
    if STORAGE_BACKEND == "postgres":
        from db.database import get_db
        from db.models import Consulta
        from repositories.postgres_repository import PostgresRepository
        db = next(get_db())
        return PostgresRepository(db, Consulta, _get_tenant_id(request))
    return _ensure_excel()["consulta"]


def get_tags_repo(request: Request) -> BaseRepository:
    if STORAGE_BACKEND == "postgres":
        from db.database import get_db
        from db.models import TagInspection
        from repositories.postgres_repository import PostgresRepository
        db = next(get_db())
        return PostgresRepository(db, TagInspection, _get_tenant_id(request))
    return _ensure_excel()["tags"]


def get_db_session(request: Request):
    """Get raw DB session for services that need direct DB access."""
    if STORAGE_BACKEND == "postgres":
        from db.database import get_db
        return next(get_db())
    return None
