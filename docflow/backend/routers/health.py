import os
import shutil
from datetime import datetime, timezone

from fastapi import APIRouter

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


@router.get("/")
def health_check():
    checks = {
        "data_erp": _check_file(DATA_ERP_PATH),
        "consulta_erp": _check_file(CONSULTA_ERP_PATH),
        "tags": _check_file(TAGS_PATH),
        "disk": _check_disk(DATA_ERP_PATH),
    }

    statuses = [c["status"] for c in checks.values()]
    if all(s == "ok" for s in statuses):
        overall = "ok"
    elif any(s == "fail" for s in statuses):
        overall = "degraded"
    else:
        overall = "degraded"

    return {
        "status": overall,
        "checks": checks,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
