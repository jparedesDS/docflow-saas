import os
import re
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any

import pandas as pd

from services.monitoring_service import MonitoringService
from services.parsers.base_parser import compute_recipients, get_responsable_email, _load_logo_b64
from services.smtp_service import send_html_email
from repositories.instances import data_repo, consulta_repo
from utils.config import SMTP_USER
from utils.json_store import read_json, write_json

CLAIMS_LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "claims_log.json")

URGENCY_THRESHOLDS = {"low": 15, "medium": 30, "high": 60}


# ─── Helpers de log ───────────────────────────────────────────────────────────

def _load_log() -> dict:
    return read_json(CLAIMS_LOG_PATH, default={})


def _save_log(log: dict):
    write_json(CLAIMS_LOG_PATH, log)


# ─── Servicio principal ───────────────────────────────────────────────────────

class ClaimService:

    def __init__(self):
        self._data_repo = data_repo
        self._consulta_repo = consulta_repo
        self._monitoring = MonitoringService(self._data_repo, self._consulta_repo)

    def _get_claimable_docs(self) -> list[dict[str, Any]]:
        """Devuelve todos los docs con Estado='Enviado' y Días Devolución >= 15."""
        all_docs = self._monitoring.get_monitoring_data()
        result = []
        for doc in all_docs:
            estado = str(doc.get("Estado", "") or "").strip().lower()
            if estado != "enviado":
                continue
            dias = doc.get("Días Devolución", "")
            try:
                if int(float(dias)) >= 15:
                    result.append(doc)
            except (ValueError, TypeError):
                pass
        return result

    def get_claimable_pedidos(self) -> list[dict[str, Any]]:
        """Lista de pedidos con documentos reclamables, ordenados por urgencia."""
        docs = self._get_claimable_docs()
        log = _load_log()

        # Agrupar por Nº Pedido (normalizado)
        groups: dict[str, list] = {}
        for doc in docs:
            pedido = MonitoringService._normalize_pedido(
                str(doc.get("Nº Pedido", "") or "").strip()
            )
            groups.setdefault(pedido, []).append(doc)

        result = []
        for pedido, pedido_docs in groups.items():
            dias_list = []
            for d in pedido_docs:
                try:
                    dias_list.append(int(float(d.get("Días Devolución", 0) or 0)))
                except (ValueError, TypeError):
                    dias_list.append(0)

            max_dias = max(dias_list) if dias_list else 0
            first = pedido_docs[0]

            if max_dias >= URGENCY_THRESHOLDS["high"]:
                urgency = "high"
            elif max_dias >= URGENCY_THRESHOLDS["medium"]:
                urgency = "medium"
            else:
                urgency = "low"

            entry = log.get(pedido, {})
            last_claimed = entry.get("last_claimed") or entry.get("sent_at")
            result.append({
                "pedido": pedido,
                "po": str(first.get("Nº PO", "") or ""),
                "cliente": str(first.get("Cliente", "") or ""),
                "responsable": str(first.get("Responsable", "") or ""),
                "material": str(first.get("Material", "") or ""),
                "docs_count": len(pedido_docs),
                "max_dias": max_dias,
                "urgency": urgency,
                "last_claimed": last_claimed,
            })

        # Más urgentes primero
        result.sort(key=lambda x: -x["max_dias"])
        return result

    def get_reminder_pedidos(self, min_days_since_last: int = 7) -> list[dict]:
        """Pedidos que necesitan recordatorio: reclamables + no enviado en últimos N días."""
        from datetime import timezone
        pedidos = self.get_claimable_pedidos()
        log = _load_log()
        result = []
        for p in pedidos:
            pedido = p["pedido"]
            entry = log.get(pedido, {})
            last_claimed = entry.get("last_claimed")
            if last_claimed:
                last_dt = datetime.fromisoformat(last_claimed)
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                dias_desde = (datetime.now(timezone.utc) - last_dt).days
                if dias_desde < min_days_since_last:
                    continue  # Ya reclamado recientemente
            result.append(p)
        return result

    def get_pedido_preview(self, pedido: str) -> dict[str, Any]:
        """Datos completos para el preview del email de un pedido."""
        docs = self._get_claimable_docs()
        pedido_docs = [
            d for d in docs
            if MonitoringService._normalize_pedido(
                str(d.get("Nº Pedido", "") or "")
            ) == pedido
        ]

        if not pedido_docs:
            raise ValueError(f"No hay documentos reclamables para el pedido {pedido}")

        first = pedido_docs[0]
        po = str(first.get("Nº PO", "") or "")
        cliente = str(first.get("Cliente", "") or "")

        # Calcular To/CC usando compute_recipients de base_parser
        df = pd.DataFrame(pedido_docs)
        # Añadir _doc_code si tenemos Nº Doc. EIPSA
        if "Nº Doc. EIPSA" in df.columns:
            df["_doc_code"] = df["Nº Doc. EIPSA"].astype(str).str.extract(r'-([A-Z]{2,4})-', expand=False).fillna("")
        suggested_to, suggested_cc = compute_recipients(df)

        subject = f"RECLAIMS: {pedido} / PO: {po} // DOC. UNDER REVIEW"

        # Preparar filas de tabla
        table_rows = []
        for doc in pedido_docs:
            dias = ""
            try:
                dias = int(float(doc.get("Días Devolución", "") or 0))
            except (ValueError, TypeError):
                dias = ""

            fecha_env = doc.get("Fecha Env. Doc.", "") or doc.get("Fecha", "")
            if hasattr(fecha_env, "strftime"):
                fecha_env = fecha_env.strftime("%d-%m-%Y")
            elif fecha_env:
                fecha_env = str(fecha_env).split(" ")[0].split("T")[0]

            table_rows.append({
                "order_no": str(doc.get("Nº Pedido", "") or ""),
                "po_no": po,
                "client_doc_no": str(doc.get("Nº Doc. Cliente", "") or ""),
                "eipsa_doc_no": str(doc.get("Nº Doc. EIPSA", "") or ""),
                "title": str(doc.get("Título", "") or ""),
                "status": str(doc.get("Estado", "") or ""),
                "revision": str(doc.get("Nº Revisión", "") or ""),
                "sent_date": fecha_env,
                "return_days": dias,
            })

        # Ordenar por días descendente
        table_rows.sort(key=lambda x: -(x["return_days"] if isinstance(x["return_days"], int) else 0))

        return {
            "pedido": pedido,
            "po": po,
            "cliente": cliente,
            "subject": subject,
            "docs_count": len(table_rows),
            "table_rows": table_rows,
            "suggested_to": suggested_to,
            "suggested_cc": suggested_cc,
        }

    def get_pedido_history(self, pedido: str) -> dict[str, Any]:
        """Devuelve el historial de reclamaciones de un pedido."""
        log = _load_log()
        entry = log.get(pedido, {})
        if "history" not in entry:
            # Migrar formato antiguo
            history = []
            if "sent_at" in entry:
                history.append({
                    "sent_at": entry["sent_at"],
                    "to": entry.get("to", []),
                    "cc": entry.get("cc", []),
                    "docs_count": entry.get("docs_count", 0),
                })
        else:
            history = entry["history"]
        return {"pedido": pedido, "count": len(history), "entries": history}

    def send_claim(self, pedido: str, to: list[str], cc: list[str]) -> dict[str, Any]:
        """Genera el HTML profesional y lo envía por SMTP."""
        preview = self.get_pedido_preview(pedido)
        html = self._build_html(preview)
        result = send_html_email(to, cc, preview["subject"], html)

        # Guardar en log con historial multi-entrada
        log = _load_log()
        now_iso = datetime.now().isoformat()
        existing = log.get(pedido, {})

        # Migrar formato antiguo si no tiene history
        if "history" not in existing:
            history = []
            if "sent_at" in existing:
                history.append({
                    "sent_at": existing["sent_at"],
                    "to": existing.get("to", []),
                    "cc": existing.get("cc", []),
                    "docs_count": existing.get("docs_count", 0),
                })
        else:
            history = existing["history"]

        history.append({
            "sent_at": now_iso,
            "to": to,
            "cc": cc,
            "docs_count": preview["docs_count"],
        })

        log[pedido] = {
            "last_claimed": now_iso,
            "history": history,
        }
        _save_log(log)

        # Intentar guardar EML en carpeta del pedido
        saved_path = None
        save_error = None
        try:
            folder = self._find_reclamaciones_folder(pedido)
            if folder:
                pedido_norm = pedido.replace("/", "-").replace("\\", "-")
                date_str = datetime.now().strftime("%Y-%m-%d")
                filename = f"{date_str}_{pedido_norm}_RECLAIM.eml"
                eml_path = folder / filename
                eml_content = self._build_eml(preview, to, cc, html)
                eml_path.write_text(eml_content, encoding="utf-8")
                saved_path = str(eml_path)
            # Si folder es None: carpeta del pedido no encontrada, saved_path sigue None
        except Exception as exc:
            save_error = str(exc)

        return {
            "success": True,
            "pedido": pedido,
            "docs_count": preview["docs_count"],
            "subject": preview["subject"],
            "recipients": result.get("recipients", []),
            "saved_path": saved_path,
            "save_error": save_error,
        }

    # ─── EML / carpeta helpers ──────────────────────────────────────────────────

    @staticmethod
    def _find_folder_for_pedido(pedido: str, subfolder: str) -> "Path | None":
        """Busca la carpeta `subfolder` del pedido en M:\\base de datos de pedidos\\."""
        # Extraer año de 2 dígitos: P-22/075 → 22, PA-26/019 → 26
        m = re.search(r'[A-Z]+-(\d{2})', pedido)
        if not m:
            return None
        yy = m.group(1)
        year_full = f"20{yy}"

        base = Path(r"M:\base de datos de pedidos") / f"Año {year_full}" / f"{year_full} Pedidos"
        if not base.exists():
            return None

        # Normalizar pedido para comparación (slash → guion)
        pedido_norm = pedido.replace("/", "-").replace("\\", "-").upper()

        # Buscar subcarpeta cuyo nombre empiece con el pedido normalizado
        match_dir = None
        try:
            for entry in base.iterdir():
                if entry.is_dir() and entry.name.upper().startswith(pedido_norm):
                    match_dir = entry
                    break
        except PermissionError:
            return None

        if not match_dir:
            return None

        target = match_dir / "2-Tecnico" / "00 DOCUMENTACIÓN" / subfolder
        if not target.exists():
            os.makedirs(target, exist_ok=True)
        return target

    @staticmethod
    def _find_reclamaciones_folder(pedido: str) -> "Path | None":
        """Busca la carpeta 01 RECLAMACIONES del pedido."""
        return ClaimService._find_folder_for_pedido(pedido, "01 RECLAMACIONES")

    @staticmethod
    def _build_eml(preview: dict, to: list[str], cc: list[str], html_body: str) -> str:
        """Genera un EML RFC 2822 con cuerpo HTML."""
        msg = MIMEMultipart("alternative")
        msg["From"] = SMTP_USER
        msg["To"] = ", ".join(to)
        if cc:
            msg["CC"] = ", ".join(cc)
        msg["Subject"] = preview["subject"]
        msg["Date"] = datetime.now().strftime("%a, %d %b %Y %H:%M:%S +0000")
        msg["MIME-Version"] = "1.0"
        msg.attach(MIMEText(html_body, "html", "utf-8"))
        return msg.as_string()

    # ─── HTML builder ─────────────────────────────────────────────────────────

    def _build_html(self, preview: dict) -> str:
        NAVY = "#1B3A5C"
        CYAN = "#00AEEF"

        STATUS_EN = {
            "Enviado": "Submitted",
            "Aprobado": "Approved",
            "Rechazado": "Rejected",
            "En Revisión": "Under Review",
            "Aprobado con Com.": "Approved w/ Comments",
            "Aprobado con com. menores": "Approved w/ Min. Comments",
        }

        # Logo
        logo_b64 = _load_logo_b64()
        logo_html = (
            f'<img src="data:image/png;base64,{logo_b64}" alt="EIPSA" '
            f'style="display:block;height:28px;width:auto;" />'
            if logo_b64
            else '<span style="color:#FFFFFF;font-size:15px;font-weight:700;letter-spacing:0.04em;">EIPSA</span>'
        )

        rows_html = ""
        for i, row in enumerate(preview["table_rows"]):
            bg_row = "#F4F7FC" if i % 2 == 0 else "#FFFFFF"
            sep  = f"border-bottom:1px solid #DDE3F5;border-right:1px solid #DDE3F5;"
            sep_last = "border-bottom:1px solid #DDE3F5;"
            cell = f"background:{bg_row};padding:11px 14px;font-size:10pt;line-height:1.4;color:#263238;"

            dias = row["return_days"]
            dias_cell = (
                f'<span style="font-weight:700;color:#C62828;background:#FFEBEE;'
                f'padding:2px 7px;border-radius:4px;">{dias}</span>'
                if isinstance(dias, int) and dias > 0
                else (str(dias) if dias != "" else '<span style="color:#B0BEC5;">—</span>')
            )

            status_val = row["status"]
            status_en  = STATUS_EN.get(status_val, status_val)
            status_style = f"background:#E3F2FD;color:#1565C0;border:1px solid #BBDEFB;"
            if status_val == "Aprobado":
                status_style = "background:#E8F5E9;color:#2E7D32;border:1px solid #C8E6C9;"
            elif status_val == "Rechazado":
                status_style = "background:#FFEBEE;color:#C62828;border:1px solid #FFCDD2;"
            elif "Com" in status_val:
                status_style = "background:#FFF8E1;color:#E65100;border:1px solid #FFE082;"

            rows_html += f"""
            <tr>
              <td style="{cell}{sep}white-space:nowrap;">{row['order_no']}</td>
              <td style="{cell}{sep}white-space:nowrap;font-family:monospace;">{row['po_no']}</td>
              <td style="{cell}{sep}">{row['client_doc_no'] or '<span style="color:#B0BEC5;">—</span>'}</td>
              <td style="{cell}{sep}white-space:nowrap;font-family:monospace;">{row['eipsa_doc_no']}</td>
              <td style="{cell}{sep}">{row['title']}</td>
              <td style="{cell}{sep}text-align:center;">
                <span style="padding:3px 10px;border-radius:4px;font-size:9pt;font-weight:700;white-space:nowrap;{status_style}">{status_en}</span>
              </td>
              <td style="{cell}{sep}text-align:center;">{row['revision'] or '—'}</td>
              <td style="{cell}{sep}white-space:nowrap;font-family:monospace;">{row['sent_date'] or '—'}</td>
              <td style="{cell}{sep_last}text-align:center;white-space:nowrap;">{dias_cell}</td>
            </tr>"""

        today = datetime.now().strftime("%d/%m/%Y")
        pedido    = preview["pedido"]
        po        = preview["po"]
        cliente   = preview["cliente"]
        docs_count = preview["docs_count"]
        doc_label  = "document" if docs_count == 1 else "documents"
        preheader  = f"{pedido} · {cliente} · {docs_count} doc(s) pending review"

        th = (f"background:{NAVY};color:#FFFFFF;padding:10px 14px;font-size:9px;font-weight:700;"
              f"letter-spacing:0.06em;text-transform:uppercase;text-align:left;"
              f"border-right:1px solid #234B73;")

        return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#EEF2F9;font-family:Arial,Helvetica,sans-serif;">

<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#EEF2F9;">{preheader}</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F9;padding:32px 0;">
<tr><td align="center">
<table width="800" cellpadding="0" cellspacing="0" style="max-width:800px;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(30,45,125,0.12);">

  <!-- ═══ HEADER ═══ -->
  <tr>
    <td style="background:{NAVY};padding:16px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">{logo_html}</td>
          <td style="vertical-align:middle;text-align:right;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#FFFFFF;letter-spacing:0.02em;">
              Document Reclaim Notice
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:{CYAN};letter-spacing:0.04em;text-transform:uppercase;">
              Ref: {pedido}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ BODY ═══ -->
  <tr>
    <td style="padding:24px 28px 8px;">

      <p style="margin:0 0 4px;font-size:13px;color:{NAVY};font-weight:600;">Dear All,</p>
      <p style="margin:0 0 20px;font-size:12px;color:#37474F;line-height:1.6;">
        Please find below the list of documents submitted for review under
        <strong>Order {pedido}</strong>{f' / PO <strong>{po}</strong>' if po else ''}
        {f' — <strong>{cliente}</strong>' if cliente else ''}.
        The following <strong>{docs_count} {doc_label}</strong> have been sent pending review
        and have not yet been returned by the customer.
      </p>

      <!-- Tabla -->
      <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:{CYAN};text-transform:uppercase;letter-spacing:0.08em;">
        Pending Documents ({docs_count})
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-radius:8px;overflow:hidden;border:1px solid #DDE3F5;margin-bottom:24px;">
        <thead>
          <tr>
            <th style="{th}">Order No.</th>
            <th style="{th}">PO No.</th>
            <th style="{th}">Client Doc. No.</th>
            <th style="{th}">EIPSA Doc. No.</th>
            <th style="{th}">Title</th>
            <th style="{th}">Status</th>
            <th style="{th}">Rev.</th>
            <th style="{th}">Sent Date</th>
            <th style="{th}border-right:none;">Return Days</th>
          </tr>
        </thead>
        <tbody>{rows_html}</tbody>
      </table>

      <p style="margin:0 0 6px;font-size:12px;color:#37474F;line-height:1.6;">
        We kindly request you to confirm the review status of the above documents at your earliest convenience,
        or let us know if any additional information is required on your end.
      </p>
      <p style="margin:0 0 24px;font-size:12px;color:#37474F;">
        Best regards,<br>
        <strong>EIPSA — Document Control</strong>
      </p>

    </td>
  </tr>

  <!-- ═══ FOOTER ═══ -->
  <tr>
    <td style="background:#F4F7FC;border-top:3px solid {CYAN};padding:16px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0;font-size:12px;font-weight:700;color:{NAVY};">
              ESPAÑOLA DE INSTRUMENTACIÓN PRIMARIA, S.A.
            </p>
            <p style="margin:3px 0 0;font-size:11px;color:#90A4AE;">
              <a href="mailto:{SMTP_USER}" style="color:{CYAN};text-decoration:none;">{SMTP_USER}</a>
              &nbsp;·&nbsp;
              <a href="https://www.eipsa.es" style="color:{CYAN};text-decoration:none;">www.eipsa.es</a>
            </p>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <p style="margin:0;font-size:10px;color:#B0BEC5;">
              Generated by DocFlow &nbsp;·&nbsp; {today}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr>
</table>

</body>
</html>"""
