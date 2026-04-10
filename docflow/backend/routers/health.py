import os
import shutil
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from utils.config import DATA_ERP_PATH, CONSULTA_ERP_PATH, TAGS_PATH

router = APIRouter()


def _check_file(path: str) -> dict:
    """Check if a file exists and is readable."""
    try:
        exists = os.path.isfile(path)
        if not exists:
            return {"status": "fail", "exists": False, "readable": False, "path": path}
        readable = os.access(path, os.R_OK)
        size_mb = round(os.path.getsize(path) / (1024 * 1024), 2)
        return {
            "status": "ok" if readable else "fail",
            "exists": True,
            "readable": readable,
            "size_mb": size_mb,
            "path": path,
        }
    except Exception as e:
        return {"status": "fail", "error": str(e), "path": path}


def _check_disk(path: str) -> dict:
    """Check disk space on the drive where path resides."""
    try:
        usage = shutil.disk_usage(os.path.splitdrive(path)[0] or "/")
        free_gb = round(usage.free / (1024 ** 3), 2)
        total_gb = round(usage.total / (1024 ** 3), 2)
        used_pct = round((usage.used / usage.total) * 100, 1)
        status = "ok" if used_pct < 90 else ("degraded" if used_pct < 95 else "fail")
        return {
            "status": status,
            "free_gb": free_gb,
            "total_gb": total_gb,
            "used_pct": used_pct,
        }
    except Exception as e:
        return {"status": "fail", "error": str(e)}


def _check_database() -> dict:
    """Check database connectivity."""
    try:
        storage = os.getenv("STORAGE_BACKEND", "excel")
        if storage != "postgres":
            return {"status": "ok", "backend": "excel"}
        from db.database import SessionLocal
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
            return {"status": "ok", "backend": "postgres"}
        finally:
            db.close()
    except Exception as e:
        return {"status": "fail", "error": str(e)}


def _check_redis() -> dict:
    """Check Redis connectivity."""
    try:
        from utils.redis_client import get_redis
        client = get_redis()
        if client:
            client.ping()
            return {"status": "ok"}
        return {"status": "ok", "note": "not configured"}
    except Exception as e:
        return {"status": "degraded", "error": str(e)}


@router.get("/liveness")
def liveness():
    """Simple liveness probe — always returns 200 if the process is alive."""
    return {"status": "ok"}


@router.get("/")
def readiness():
    """Readiness probe — checks data files, disk, database, and Redis."""
    checks = {
        "data_erp": _check_file(DATA_ERP_PATH),
        "consulta_erp": _check_file(CONSULTA_ERP_PATH),
        "tags": _check_file(TAGS_PATH),
        "disk": _check_disk(DATA_ERP_PATH),
        "database": _check_database(),
        "redis": _check_redis(),
    }

    statuses = [c["status"] for c in checks.values()]
    if all(s == "ok" for s in statuses):
        overall = "ok"
        status_code = 200
    elif checks.get("database", {}).get("status") == "fail":
        overall = "fail"
        status_code = 503
    else:
        overall = "degraded"
        status_code = 200

    return JSONResponse(
        status_code=status_code,
        content={
            "status": overall,
            "checks": checks,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
