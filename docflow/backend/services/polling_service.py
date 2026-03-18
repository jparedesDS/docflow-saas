"""Servicio de polling IMAP para detectar nuevos transmittals cada 15 min.
Registra notificaciones in-app para cada email nuevo detectado.
"""

import logging
import os
from datetime import datetime
from typing import Any, Dict

from services.transmittal_service import fetch_all_emails
from services.notification_service import notification_service
from utils.json_store import read_json, write_json

logger = logging.getLogger(__name__)

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_STATUS_PATH = os.path.join(_BACKEND_DIR, "polling_status.json")
_PROCESSED_PATH = os.path.join(_BACKEND_DIR, "processed_emails.json")

POLL_INTERVAL_SECONDS = 15 * 60  # 15 minutos


def _load_processed() -> set:
    data = read_json(_PROCESSED_PATH, default=[])
    if isinstance(data, list):
        return set(data)
    return set()


def _save_processed(uids: set):
    write_json(_PROCESSED_PATH, sorted(uids))


def poll_and_process() -> Dict[str, Any]:
    """Consulta IMAP, detecta emails nuevos y genera notificaciones.

    Nunca lanza excepciones — devuelve siempre un dict con el resultado.
    """
    result = {
        "timestamp": datetime.now().isoformat(),
        "emails_found": 0,
        "new_emails": 0,
        "errors": [],
    }

    try:
        emails = fetch_all_emails()
        result["emails_found"] = len(emails)

        processed = _load_processed()
        new_count = 0

        for email in emails:
            uid = email.get("uid")
            if not uid or uid in processed:
                continue

            try:
                subject = email.get("subject", "(sin asunto)")
                platform = email.get("platform", "desconocida")
                sender = email.get("from", "")

                notification_service.add(
                    tipo="transmittal",
                    titulo=f"Nuevo transmittal ({platform})",
                    detalle=f"{subject} — de {sender}",
                    metadata={"uid": uid, "platform": platform},
                )

                processed.add(uid)
                new_count += 1
                logger.info("Nuevo transmittal detectado: uid=%s platform=%s", uid, platform)

            except Exception as exc:
                error_msg = f"Error procesando email uid={uid}: {exc}"
                logger.error(error_msg)
                result["errors"].append(error_msg)

        result["new_emails"] = new_count
        _save_processed(processed)

    except Exception as exc:
        error_msg = f"Error en polling IMAP: {exc}"
        logger.error(error_msg)
        result["errors"].append(error_msg)

    # Persistir estado
    write_json(_STATUS_PATH, result)
    return result


def get_polling_status() -> Dict[str, Any]:
    """Devuelve el estado del último polling."""
    data = read_json(_STATUS_PATH, default=None)
    if data:
        return data
    return {
        "timestamp": None,
        "emails_found": 0,
        "new_emails": 0,
        "errors": [],
        "message": "No se ha ejecutado ningún polling aún.",
    }
