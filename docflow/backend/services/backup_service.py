import os
import shutil
import json
import logging
from datetime import datetime, timedelta

from utils.config import BASE_DIR, BACKUP_DEST

logger = logging.getLogger(__name__)

FILES_TO_BACKUP = [
    "data_erp.xlsx",
    "consulta_erp.xlsx",
    "data_tags.xlsx",
    "agenda_data.json",
    "claims_log.json",
    "processed_emails.json",
]

RETENTION_DAYS = 30

_last_status: dict = {}


def _get_folder_size(path: str) -> int:
    total = 0
    for dirpath, _dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            try:
                total += os.path.getsize(fp)
            except OSError:
                pass
    return total


def _cleanup_old_backups() -> int:
    """Delete backup folders older than RETENTION_DAYS. Returns count deleted."""
    removed = 0
    if not os.path.isdir(BACKUP_DEST):
        return removed
    cutoff = datetime.now() - timedelta(days=RETENTION_DAYS)
    for name in os.listdir(BACKUP_DEST):
        folder = os.path.join(BACKUP_DEST, name)
        if not os.path.isdir(folder):
            continue
        try:
            folder_time = datetime.strptime(name, "%Y-%m-%d_%H%M%S")
        except ValueError:
            continue
        if folder_time < cutoff:
            shutil.rmtree(folder, ignore_errors=True)
            removed += 1
            logger.info("Backup antiguo eliminado: %s", name)
    return removed


def run_backup() -> dict:
    """Execute backup. Suitable for APScheduler job."""
    global _last_status
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    dest_folder = os.path.join(BACKUP_DEST, timestamp)
    copied = []
    skipped = []

    try:
        os.makedirs(dest_folder, exist_ok=True)

        for filename in FILES_TO_BACKUP:
            src = os.path.join(BASE_DIR, filename)
            if os.path.isfile(src):
                shutil.copy2(src, os.path.join(dest_folder, filename))
                copied.append(filename)
            else:
                skipped.append(filename)
                logger.warning("Archivo no encontrado, omitido: %s", src)

        removed = _cleanup_old_backups()
        size = _get_folder_size(dest_folder)

        _last_status = {
            "success": True,
            "timestamp": timestamp,
            "dest": dest_folder,
            "copied": copied,
            "skipped": skipped,
            "size_bytes": size,
            "old_removed": removed,
        }
        logger.info("Backup completado: %s (%d archivos, %d bytes)", dest_folder, len(copied), size)

    except Exception as e:
        logger.exception("Error en backup")
        _last_status = {
            "success": False,
            "timestamp": timestamp,
            "error": str(e),
            "copied": copied,
            "skipped": skipped,
        }

    return _last_status


def get_backup_status() -> dict:
    """Return last backup status or empty dict if never run."""
    return _last_status if _last_status else {"success": None, "message": "No se ha ejecutado ningún backup aún."}
