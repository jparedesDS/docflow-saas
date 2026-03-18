"""Job semanal de recordatorio de reclamaciones.

Detecta pedidos con documentos reclamables cuya última reclamación fue hace ≥7 días
(o nunca se han reclamado) y envía un email resumen + notificación en la app.
"""

from datetime import datetime

from services.claim_service import ClaimService
from services.smtp_service import send_html_email
from services.notification_service import notification_service
from utils.config import SMTP_USER


def run_claims_reminder(to=None, cc=None):
    """Job semanal: detecta pedidos pendientes y notifica por email + app.

    Args:
        to: Override recipients list. Falls back to [SMTP_USER].
        cc: Optional CC list.
    """
    svc = ClaimService()
    pedidos = svc.get_reminder_pedidos(min_days_since_last=7)

    if not pedidos:
        return {"status": "skipped", "reason": "No pending claims"}

    # Agrupar por urgencia
    high   = [p for p in pedidos if p["urgency"] == "high"]
    medium = [p for p in pedidos if p["urgency"] == "medium"]
    low    = [p for p in pedidos if p["urgency"] == "low"]

    # Construir y enviar email resumen
    html_body = _build_reminder_html(high, medium, low)
    subject = f"[DocFlow] Recordatorio Reclamaciones — {datetime.now().strftime('%d/%m/%Y')}"

    recipients = to if to else [SMTP_USER]

    send_html_email(
        to=recipients,
        cc=cc or [],
        subject=subject,
        html_body=html_body,
    )

    # Registrar notificación en la campana de la app
    notification_service.add(
        tipo="reclamacion",
        titulo=f"Recordatorio: {len(pedidos)} pedido(s) pendiente(s) de reclamar",
        detalle=f"Alta urgencia: {len(high)} | Media: {len(medium)} | Baja: {len(low)}",
        metadata={
            "pedidos": len(pedidos),
            "high": len(high),
            "medium": len(medium),
            "low": len(low),
        },
    )

    return {"status": "sent", "recipients": recipients, "pedidos": len(pedidos)}


# ─── HTML Builder ──────────────────────────────────────────────────────────────

def _build_reminder_html(high: list, medium: list, low: list) -> str:
    NAVY = "#1B3A5C"
    CYAN = "#00AEEF"
    today = datetime.now().strftime("%d/%m/%Y")
    total = len(high) + len(medium) + len(low)

    sections_html = ""

    _SECTIONS = [
        (high,   "ALTA URGENCIA",  "#C62828", "#FFEBEE", "#FFCDD2"),
        (medium, "MEDIA URGENCIA", "#E65100", "#FFF8E1", "#FFE082"),
        (low,    "BAJA URGENCIA",  "#1565C0", "#E3F2FD", "#BBDEFB"),
    ]

    for group, label, color, bg, border in _SECTIONS:
        if not group:
            continue

        rows = ""
        for p in group:
            last = p.get("last_claimed") or "—"
            if last != "—":
                try:
                    last = datetime.fromisoformat(last).strftime("%d/%m/%Y")
                except Exception:
                    pass

            rows += f"""
            <tr>
              <td style="padding:9px 12px;border-bottom:1px solid #EEE;white-space:nowrap;font-size:10pt;">{p['pedido']}</td>
              <td style="padding:9px 12px;border-bottom:1px solid #EEE;font-size:10pt;">{p['cliente'] or '—'}</td>
              <td style="padding:9px 12px;border-bottom:1px solid #EEE;font-size:10pt;">{p['material'] or '—'}</td>
              <td style="padding:9px 12px;border-bottom:1px solid #EEE;text-align:center;font-size:10pt;">{p['docs_count']}</td>
              <td style="padding:9px 12px;border-bottom:1px solid #EEE;text-align:center;font-size:10pt;">
                <span style="font-weight:700;color:{color};background:{bg};padding:2px 8px;border-radius:4px;">{p['max_dias']}</span>
              </td>
              <td style="padding:9px 12px;border-bottom:1px solid #EEE;text-align:center;font-size:10pt;color:#90A4AE;">{last}</td>
            </tr>"""

        th_style = (
            f"background:{color};color:#FFF;padding:9px 12px;font-size:9px;"
            f"font-weight:700;letter-spacing:0.06em;text-transform:uppercase;text-align:left;"
        )

        sections_html += f"""
        <p style="margin:20px 0 6px;font-size:11px;font-weight:700;color:{color};
                  text-transform:uppercase;letter-spacing:0.08em;
                  border-left:4px solid {color};padding-left:8px;">
          {label} ({len(group)} pedido{'s' if len(group) != 1 else ''})
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid {border};border-radius:6px;overflow:hidden;margin-bottom:8px;">
          <thead>
            <tr>
              <th style="{th_style}">Nº Pedido</th>
              <th style="{th_style}">Cliente</th>
              <th style="{th_style}">Material</th>
              <th style="{th_style}text-align:center;">Docs</th>
              <th style="{th_style}text-align:center;">Días máx.</th>
              <th style="{th_style}text-align:center;">Última reclamación</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>"""

    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#EEF2F9;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F9;padding:32px 0;">
<tr><td align="center">
<table width="700" cellpadding="0" cellspacing="0"
       style="max-width:700px;background:#FFFFFF;border-radius:12px;overflow:hidden;
              box-shadow:0 4px 24px rgba(30,45,125,0.12);">

  <!-- HEADER -->
  <tr>
    <td style="background:{NAVY};padding:18px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0;font-size:15px;font-weight:700;color:#FFF;letter-spacing:0.02em;">
              DocFlow — Recordatorio de Reclamaciones
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:{CYAN};text-transform:uppercase;letter-spacing:0.05em;">
              {today}
            </p>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="background:{CYAN};color:#FFF;font-size:13px;font-weight:700;
                         padding:6px 16px;border-radius:20px;">
              {total} pedido{'s' if total != 1 else ''}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="padding:24px 28px 16px;">

      <p style="margin:0 0 16px;font-size:13px;color:#37474F;line-height:1.6;">
        El siguiente resumen contiene los pedidos con documentos pendientes de reclamación
        que aún no han sido enviados en los últimos 7 días.
        Por favor, accede a DocFlow para gestionar los envíos.
      </p>

      {sections_html}

      <p style="margin:24px 0 0;text-align:center;">
        <a href="http://localhost:3000"
           style="display:inline-block;background:{NAVY};color:#FFF;font-size:12px;
                  font-weight:700;padding:10px 28px;border-radius:6px;text-decoration:none;
                  letter-spacing:0.04em;">
          Abrir DocFlow →
        </a>
      </p>

    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#F4F7FC;border-top:3px solid {CYAN};padding:14px 28px;">
      <p style="margin:0;font-size:10px;color:#90A4AE;text-align:center;">
        Generado automáticamente por DocFlow &nbsp;·&nbsp;
        <a href="mailto:{SMTP_USER}" style="color:{CYAN};text-decoration:none;">{SMTP_USER}</a>
        &nbsp;·&nbsp; EIPSA
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>"""


def get_claims_preview() -> str:
    """Generate claims reminder HTML for preview without sending."""
    svc = ClaimService()
    pedidos = svc.get_reminder_pedidos(min_days_since_last=7)

    high = [p for p in pedidos if p["urgency"] == "high"]
    medium = [p for p in pedidos if p["urgency"] == "medium"]
    low = [p for p in pedidos if p["urgency"] == "low"]

    return _build_reminder_html(high, medium, low)
