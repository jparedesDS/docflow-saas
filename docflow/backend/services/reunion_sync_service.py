"""Sincroniza reuniones desde el buzón IMAP de un usuario.
Las reuniones llegan como emails con REUNI/REUNION en el asunto.
"""
import imaplib
import email
import email.header
import email.utils
import os
import logging
from datetime import datetime
from typing import List, Dict, Any

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

IMAP_HOST = os.getenv("IMAP_HOST", "imap.soljem.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))

USER_IMAP_CREDS = {
    "JP": {
        "user": os.getenv("JP_IMAP_USER", "jose-paredes@eipsa.es"),
        "pass": os.getenv("JP_IMAP_PASS", ""),
    },
}


def _decode_header(value: str) -> str:
    if not value:
        return ""
    parts = email.header.decode_header(value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "latin-1", errors="replace"))
        else:
            decoded.append(str(part))
    return "".join(decoded).strip()


def _get_body(msg) -> str:
    """Extrae texto plano del email, con fallback a html."""
    plain = ""
    html = ""
    for part in msg.walk():
        ct = part.get_content_type()
        payload = part.get_payload(decode=True)
        if not payload:
            continue
        charset = part.get_content_charset() or "latin-1"
        text = payload.decode(charset, errors="replace")
        if ct == "text/plain" and not plain:
            plain = text
        elif ct == "text/html" and not html:
            # Quitar tags básicos
            import re
            html = re.sub(r"<[^>]+>", " ", text)
            html = re.sub(r"\s+", " ", html).strip()
    return (plain or html)[:400].strip()


def _parse_date(date_str: str):
    """Devuelve (fecha_iso, hora) desde el header Date del email."""
    try:
        parsed = email.utils.parsedate_to_datetime(date_str)
        return parsed.strftime("%Y-%m-%d"), parsed.strftime("%H:%M")
    except Exception:
        return "", ""


def fetch_reuniones_from_email(owner: str) -> List[Dict[str, Any]]:
    """
    Conecta al IMAP del owner, busca emails con REUNI en el asunto
    y devuelve lista de reuniones parseadas.
    """
    creds = USER_IMAP_CREDS.get(owner)
    if not creds or not creds["pass"]:
        logger.warning(f"Sin credenciales IMAP para owner '{owner}'")
        return []

    reuniones = []
    try:
        with imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT) as imap:
            imap.login(creds["user"], creds["pass"])
            imap.select("INBOX")

            _, nums = imap.search(None, 'SUBJECT "reuni"')
            ids = nums[0].split() if nums[0] else []

            for num in ids[:100]:
                try:
                    _, data = imap.fetch(num, "(RFC822)")
                    raw = data[0][1] if data and data[0] else None
                    if not raw:
                        continue
                    msg = email.message_from_bytes(raw)

                    subject = _decode_header(msg.get("Subject", ""))
                    date_str = msg.get("Date", "")
                    message_id = msg.get("Message-ID", "") or msg.get("Message-Id", "")
                    fecha, hora = _parse_date(date_str)
                    descripcion = _get_body(msg)

                    # Limpiar asunto: quitar saltos de línea y espacios extra
                    import re
                    titulo = re.sub(r"\s+", " ", subject).strip()

                    reuniones.append({
                        "titulo": titulo,
                        "fecha": fecha,
                        "hora_inicio": hora,
                        "hora_fin": "",
                        "ubicacion": "",
                        "descripcion": descripcion,
                        "asistentes": [],
                        "_uid": message_id.strip() if message_id else f"{titulo}_{fecha}",
                    })
                except Exception as e:
                    logger.warning(f"Error procesando mensaje {num}: {e}")

    except imaplib.IMAP4.error as e:
        logger.error(f"Error IMAP para {owner}: {e}")
    except Exception as e:
        logger.error(f"Error inesperado fetch_reuniones {owner}: {e}")

    return reuniones
