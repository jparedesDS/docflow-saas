import imaplib
import email as email_lib
from email.header import decode_header
from email.utils import parsedate_to_datetime

from services import imap_service
from utils.config import IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS


def _decode_header_value(value):
    if not value:
        return ""
    parts = decode_header(value)
    result = []
    for data, charset in parts:
        if isinstance(data, bytes):
            result.append(data.decode(charset or "utf-8", errors="replace"))
        else:
            result.append(data)
    return "".join(result)


def _connect(folder="INBOX", imap_user=None, imap_pass=None):
    conn = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    conn.login(imap_user or IMAP_USER, imap_pass or IMAP_PASS)
    conn.select(folder)
    return conn


def list_emails(folder: str = "INBOX", filter: str = "all", imap_user=None, imap_pass=None) -> list:
    """
    Retorna lista de emails con flags is_read.
    filter: 'all' | 'unread'
    """
    conn = _connect(folder, imap_user, imap_pass)
    try:
        search_criterion = "ALL" if filter == "all" else "UNSEEN"
        _, data = conn.search(None, search_criterion)
        uids = data[0].split() if data[0] else []

        results = []
        for uid in uids:
            _, msg_data = conn.fetch(uid, "(BODY.PEEK[HEADER] FLAGS)")
            if not msg_data or not msg_data[0]:
                continue

            # msg_data[0] puede ser tupla (header_bytes, flags_line) o la API IMAP
            # El fetch "(BODY.PEEK[HEADER] FLAGS)" devuelve:
            #   msg_data[0][1] = bytes del header
            #   msg_data[1] o la cadena literal contiene FLAGS
            raw_header = msg_data[0][1]
            msg = email_lib.message_from_bytes(raw_header)

            # Obtener flags: buscar en la respuesta literal
            flags_str = ""
            for item in msg_data:
                if isinstance(item, bytes):
                    flags_str = item.decode(errors="replace")
                elif isinstance(item, tuple) and len(item) > 0:
                    s = item[0].decode(errors="replace") if isinstance(item[0], bytes) else str(item[0])
                    flags_str += " " + s

            is_read = "\\Seen" in flags_str

            subject = _decode_header_value(msg.get("Subject", ""))
            sender = _decode_header_value(msg.get("From", ""))
            date_str = msg.get("Date", "")
            try:
                dt = parsedate_to_datetime(date_str)
                date_iso = dt.isoformat()
            except Exception:
                date_iso = date_str

            results.append({
                "uid": uid.decode(),
                "subject": subject,
                "from": sender,
                "date": date_iso,
                "is_read": is_read,
            })

        return list(reversed(results))
    finally:
        conn.close()
        conn.logout()


def get_email_detail(uid: str, folder: str = "INBOX", imap_user=None, imap_pass=None) -> dict:
    """
    Retorna detalle completo de un email: headers + cuerpo HTML + plain.
    """
    msg = imap_service.fetch_email(uid, folder, imap_user, imap_pass)

    subject = _decode_header_value(msg.get("Subject", ""))
    sender = _decode_header_value(msg.get("From", ""))
    to = _decode_header_value(msg.get("To", ""))
    cc = _decode_header_value(msg.get("Cc", ""))
    date_str = msg.get("Date", "")
    try:
        from email.utils import parsedate_to_datetime as _p
        date_iso = _p(date_str).isoformat()
    except Exception:
        date_iso = date_str

    html_body = imap_service.get_html_body(msg)
    plain_body = imap_service.get_plain_body(msg)

    return {
        "uid": uid,
        "subject": subject,
        "from": sender,
        "to": to,
        "cc": cc,
        "date": date_iso,
        "html_body": html_body,
        "plain_body": plain_body,
    }


def mark_read(uid: str, folder: str = "INBOX", imap_user=None, imap_pass=None) -> dict:
    """Marca un email como leído."""
    imap_service.mark_as_read(uid, folder, imap_user, imap_pass)
    return {"ok": True, "uid": uid}
