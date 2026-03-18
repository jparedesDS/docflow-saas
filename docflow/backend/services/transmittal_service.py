import re
import pandas as pd
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path

from utils.json_store import read_json, write_json

PROCESSED_FILE = str(Path(__file__).parent.parent / "processed_emails.json")


def _load_processed() -> set:
    data = read_json(PROCESSED_FILE, default=[])
    return set(data)


def _save_processed(uid: str):
    processed = _load_processed()
    processed.add(uid)
    write_json(PROCESSED_FILE, sorted(processed))

from services import imap_service
from services.parsers import aconex_parser, sendoc_parser, gaia_parser, tr_parser, prodoc_parser, docspace_parser
from services.parsers.base_parser import (
    build_notification_html, DEFAULT_TO, DEFAULT_CC, FINAL_COLUMNS,
    compute_recipients,
)
from services import smtp_service
from services.claim_service import ClaimService

PARSERS = [tr_parser, aconex_parser, sendoc_parser, gaia_parser, prodoc_parser, docspace_parser]
PLATFORM_NAMES = {
    "tr_parser": "TÉCNICAS REUNIDAS",
    "aconex_parser": "ACONEX",
    "sendoc_parser": "SENDOC",
    "gaia_parser": "GAIA",
    "prodoc_parser": "PRODOC",
    "docspace_parser": "DOCUMENT SPACE",
}


def _detect_platform(sender: str):
    for parser in PARSERS:
        if parser.can_parse(sender):
            module_name = parser.__name__.rsplit(".", 1)[-1]
            return parser, PLATFORM_NAMES.get(module_name, "UNKNOWN")
    return None, "UNKNOWN"


def fetch_unread_emails(folder="INBOX"):
    raw_emails = imap_service.list_unread(folder)
    results = []
    for e in raw_emails:
        parser, platform = _detect_platform(e["from"])
        results.append({
            **e,
            "platform": platform,
            "parseable": parser is not None,
        })
    return results


def fetch_all_emails(folder="INBOX"):
    raw_emails = imap_service.list_all(folder)
    processed = _load_processed()
    results = []
    for e in raw_emails:
        parser, platform = _detect_platform(e["from"])
        if parser is not None:
            results.append({
                **e,
                "platform": platform,
                "parseable": True,
                "processed": e["uid"] in processed,
            })
    return results


def preview_email(uid: str, folder="INBOX"):
    msg = imap_service.fetch_email(uid, folder)
    sender = msg.get("From", "")
    subject = msg.get("Subject", "")
    date_str = msg.get("Date", "")

    try:
        dt = parsedate_to_datetime(date_str)
        received_time = dt.strftime("%d-%m-%Y %H:%M:%S")
    except Exception:
        received_time = datetime.now().strftime("%d-%m-%Y %H:%M:%S")

    html_body = imap_service.get_html_body(msg)
    if not html_body:
        raise ValueError("Email has no readable HTML body")

    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"preview_email: sender={sender}, html_body_len={len(html_body)}")
    print(f"[PREVIEW] html_body len={len(html_body)}, tiene_tabla={'<table' in html_body.lower()}", flush=True)
    print(f"[PREVIEW] html_body preview: {html_body[:600]}", flush=True)

    parser, platform = _detect_platform(sender)
    if not parser:
        raise ValueError(f"Platform not recognized for this email (sender: {sender})")

    # Para PRODOC, pasar también el texto plano (formato multi-línea)
    kwargs = {}
    if parser is prodoc_parser:
        kwargs['plain_body'] = imap_service.get_plain_body(msg)

    try:
        df = parser.parse(html_body, subject, received_time, **kwargs)
    except ValueError as e:
        logger.error(f"Parser error ({platform}): {e}")
        raise

    # Calcular destinatarios dinámicos antes de limpiar _doc_code
    suggested_to, suggested_cc = compute_recipients(df)

    # Limpiar NaN para serialización JSON
    df = df.fillna("")
    # Convertir Timestamps a string
    for col in df.columns:
        if df[col].dtype == "datetime64[ns]" or hasattr(df[col].iloc[0] if len(df) > 0 else "", "strftime"):
            df[col] = df[col].apply(lambda x: x.strftime("%d-%m-%Y") if hasattr(x, "strftime") else str(x))

    return {
        "platform": platform,
        "subject": subject,
        "from": sender,
        "date": received_time,
        "transmittal_code": parser.extract_transmittal_code(subject),
        "documents": df.to_dict(orient="records"),
        "columns": FINAL_COLUMNS,
        "suggested_to": suggested_to,
        "suggested_cc": suggested_cc,
    }


def process_and_notify(uid: str, to: list[str], cc: list[str], folder="INBOX", status_overrides: dict = {}):
    preview = preview_email(uid, folder)
    df = pd.DataFrame(preview["documents"])

    # Aplicar overrides de estado manual (para ACONEX u otras plataformas)
    for idx_str, estado in status_overrides.items():
        try:
            df.at[int(idx_str), "Estado"] = estado
        except (ValueError, KeyError):
            pass

    if df.empty:
        raise ValueError("Parsing succeeded but no documents were found")

    # Build info dict for the notification
    first = df.iloc[0]
    fecha = first.get("Fecha", "")
    if isinstance(fecha, pd.Timestamp):
        deadline = fecha + timedelta(days=15)
    else:
        deadline = datetime.now() + timedelta(days=15)

    info_dict = {
        "Nº Pedido": first.get("Nº Pedido", ""),
        "Cliente": first.get("Cliente", ""),
        "Material": first.get("Material", ""),
        "Supp.": first.get("Supp.", "S00"),
        "PO": first.get("PO", ""),
        "Fecha": str(fecha)[:10] if fecha else "",
    }

    html_body = build_notification_html(info_dict, df, deadline)
    subject = f"DEV: {first.get('Nº Pedido', '')} [{preview['subject']}]"

    # Obtener email original como bytes para adjuntar
    raw_eml = imap_service.fetch_raw(uid, folder)
    safe_name = re.sub(r'[\\/*?:"<>|]', '_', preview["subject"]) + ".eml"

    # Send email
    result = smtp_service.send_html_email(to, cc, subject, html_body, attachment_eml=raw_eml, attachment_name=safe_name)

    # Mark as read
    imap_service.mark_as_read(uid, folder)

    # Intentar guardar EML en carpeta 02 DEVOLUCIONES del pedido
    saved_path = None
    save_error = None
    try:
        pedido = str(first.get("Nº Pedido", "") or "")
        if pedido:
            folder_path = ClaimService._find_folder_for_pedido(pedido, "02 DEVOLUCIONES")
            if folder_path:
                pedido_norm = pedido.replace("/", "-").replace("\\", "-")
                date_str = datetime.now().strftime("%Y-%m-%d")
                filename = f"{date_str}_{pedido_norm}_DEV.eml"
                eml_preview = {"subject": subject, "pedido": pedido}
                eml_content = ClaimService._build_eml(eml_preview, to, cc, html_body)
                (folder_path / filename).write_text(eml_content, encoding="utf-8")
                saved_path = str(folder_path / filename)
    except Exception as exc:
        save_error = str(exc)

    return {
        "success": True,
        "email_sent": result,
        "documents_count": len(df),
        "subject": subject,
        "saved_path": saved_path,
        "save_error": save_error,
    }


def get_mappings():
    from services.parsers.base_parser import (
        PRODOC_PO_MAP, SENDOC_PO_MAP, ACONEX_PO_MAP, PRODOC_MATERIAL_MAP,
        SENDOC_MATERIAL_MAP, GAIA_MATERIAL_MAP,
        ACONEX_STATUS_MAP, SENDOC_STATUS_MAP, GAIA_STATUS_MAP,
    )
    return {
        "po_mappings": {
            "ACONEX": ACONEX_PO_MAP,
            "SENDOC": SENDOC_PO_MAP,
        },
        "material_mappings": {
            "ACONEX": PRODOC_MATERIAL_MAP,
            "SENDOC": SENDOC_MATERIAL_MAP,
            "GAIA": GAIA_MATERIAL_MAP,
        },
        "status_mappings": {
            "ACONEX": ACONEX_STATUS_MAP,
            "SENDOC": SENDOC_STATUS_MAP,
            "GAIA": GAIA_STATUS_MAP,
        },
    }
