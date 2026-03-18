"""
Weekly email system: Executive + Personal emails.
Sent every Monday at 08:00 via APScheduler.
"""

import json
import os
import time
from datetime import date, datetime, timedelta
from typing import Any, Dict, List

import anthropic

from repositories.instances import data_repo, consulta_repo
from services.monitoring_service import MonitoringService
from services.smtp_service import send_html_email
from utils.config import ANTHROPIC_API_KEY, USERS


# ── Estado display config ─────────────────────────────────────────────────

_ESTADO_COLORS = {
    "aprobado":     ("Aprobado",     "#16A34A"),
    "enviado":      ("Enviado",      "#2563EB"),
    "com. menores": ("Com. Menores", "#D97706"),
    "com. mayores": ("Com. Mayores", "#DB2777"),
    "comentado":    ("Comentado",    "#CA8A04"),
    "rechazado":    ("Rechazado",    "#DC2626"),
    "sin enviar":   ("Sin Enviar",   "#64748B"),
}

ESTADOS_APROBADOS = {"aprobado"}
ESTADOS_PENDIENTES = {"enviado", "com. menores", "com. mayores", "rechazado", "comentado"}
ESTADOS_DEVOLUCION = {"com. menores", "com. mayores", "rechazado", "comentado"}


# ── Helpers para filtrado semanal ─────────────────────────────────────────

def _get_weekly_range():
    """Return (start_thursday, end_thursday) for the current week window."""
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    days_since_thu = (today.weekday() - 3) % 7
    end_thursday = today - timedelta(days=days_since_thu)
    start_thursday = end_thursday - timedelta(days=7)
    return start_thursday, end_thursday


def _parse_fecha_envio(val):
    """Parse a date value from Excel (mirrors MonitoringService._parse_date)."""
    if val is None or val == "":
        return None
    if isinstance(val, (datetime, date)):
        return val if isinstance(val, datetime) else datetime.combine(val, datetime.min.time())
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s.split(" ")[0] if "T" not in s else s.split("T")[0], fmt)
        except ValueError:
            continue
    return None


def _filter_weekly_docs(docs, start, end):
    """Filter docs with activity in the [start, end) window.

    Includes a doc if:
      - Fecha Env. Doc. is within the range (sent this week), OR
      - Estado is pending AND Días Devolución <= 7 (recent client activity)
    """
    result = []
    for d in docs:
        # Criterion 1: sent this week
        fecha_env = _parse_fecha_envio(d.get("Fecha Env. Doc."))
        if fecha_env and start <= fecha_env < end:
            result.append(d)
            continue
        # Criterion 2: pending with recent activity
        estado = str(d.get("Estado", "") or "").lower().strip()
        dias = d.get("Días Devolución")
        if estado in ESTADOS_PENDIENTES and isinstance(dias, (int, float)) and 0 < dias <= 7:
            result.append(d)
    return result


# ═══════════════════════════════════════════════════════════════════════════
# CAPA 1: RECOLECCION DE DATOS
# ═══════════════════════════════════════════════════════════════════════════


def _collect_executive_data() -> dict:
    """Collect KPIs for the executive email (weekly window: Thursday to Thursday)."""
    monitoring = MonitoringService(data_repo, consulta_repo)
    all_docs = monitoring.get_monitoring_data()

    # Weekly range
    start, end = _get_weekly_range()
    weekly_docs = _filter_weekly_docs(all_docs, start, end)

    total_weekly = len(weekly_docs)

    # KPIs over weekly subset
    total_aprobados = sum(
        1 for d in weekly_docs
        if str(d.get("Estado", "") or "").lower().strip() in ESTADOS_APROBADOS
    )
    pct_aprobados = round(total_aprobados / total_weekly * 100) if total_weekly else 0

    dias_pendientes = []
    docs_riesgo = 0
    a_vencer_3d = 0
    for d in weekly_docs:
        estado = str(d.get("Estado", "") or "").lower().strip()
        dias = d.get("Días Devolución")
        if estado in ESTADOS_PENDIENTES and isinstance(dias, (int, float)) and dias > 0:
            dias_pendientes.append(dias)
            if dias > 15:
                docs_riesgo += 1
            if 0 < dias <= 3:
                a_vencer_3d += 1

    velocidad_media = round(sum(dias_pendientes) / len(dias_pendientes), 1) if dias_pendientes else 0

    # Global approval % for context
    total_global = len(all_docs)
    aprobados_global = sum(
        1 for d in all_docs
        if str(d.get("Estado", "") or "").lower().strip() in ESTADOS_APROBADOS
    )
    pct_global = round(aprobados_global / total_global * 100) if total_global else 0

    # Formatted docs list for the table
    formatted_docs = []
    for d in weekly_docs:
        estado = str(d.get("Estado", "") or "").lower().strip()
        if estado in ESTADOS_APROBADOS:
            continue
        dias = d.get("Días Devolución", 0)
        if not isinstance(dias, (int, float)):
            dias = 0
        estado_display, _ = _ESTADO_COLORS.get(estado or "sin enviar", (estado.title(), "#64748B"))
        formatted_docs.append({
            "doc_eipsa": str(d.get("Nº Doc. EIPSA", "") or ""),
            "titulo": str(d.get("Título", "") or ""),
            "cliente": str(d.get("Cliente", "") or ""),
            "estado": estado,
            "estado_display": estado_display,
            "dias": int(dias) if isinstance(dias, (int, float)) else 0,
        })
    formatted_docs.sort(key=lambda x: x["dias"], reverse=True)

    return {
        "fecha": datetime.now().strftime("%Y-%m-%d"),
        "week_start": start.strftime("%d/%m"),
        "week_end": end.strftime("%d/%m"),
        "total_docs": total_weekly,
        "total_aprobados": total_aprobados,
        "pct_aprobados": pct_aprobados,
        "velocidad_media": velocidad_media,
        "docs_riesgo": docs_riesgo,
        "a_vencer_3d": a_vencer_3d,
        "total_global": total_global,
        "pct_global": pct_global,
        "weekly_docs": formatted_docs,
    }


def _collect_personal_data(initials: str, docs: list, team_avg_pct: float,
                           week_start_str: str = "", week_end_str: str = "") -> dict:
    """Collect data for a single user's personal email (devoluciones only)."""
    user_info = USERS.get(initials, {})
    nombre = user_info.get("nombre", initials)

    my_docs = [d for d in docs if str(d.get("Repsonsable", "") or "").strip() == initials]
    my_total = len(my_docs)
    my_approved = sum(
        1 for d in my_docs
        if str(d.get("Estado", "") or "").lower().strip() in ESTADOS_APROBADOS
    )
    my_pct = round(my_approved / my_total * 100) if my_total else 0

    # Filter: only devoluciones (client responded) with recent activity
    my_devoluciones = []
    for d in my_docs:
        estado = str(d.get("Estado", "") or "").lower().strip()
        if estado not in ESTADOS_DEVOLUCION:
            continue
        dias = d.get("Días Devolución")
        if isinstance(dias, (int, float)) and 0 < dias <= 7:
            my_devoluciones.append(d)

    # KPIs over weekly devoluciones
    my_devol_count = len(my_devoluciones)
    my_critical = 0
    my_expiring = 0
    my_pending = []
    for d in my_devoluciones:
        estado = str(d.get("Estado", "") or "").lower().strip()
        dias = d.get("Días Devolución", 0)
        if not isinstance(dias, (int, float)):
            dias = 0
        critico = str(d.get("Crítico", "") or "").lower().strip()
        if critico in ("sí", "si"):
            my_critical += 1
        if 0 < dias <= 3:
            my_expiring += 1

        estado_display, _ = _ESTADO_COLORS.get(estado or "sin enviar", (estado.title(), "#64748B"))
        my_pending.append({
            "doc_eipsa": str(d.get("Nº Doc. EIPSA", "") or ""),
            "titulo": str(d.get("Título", "") or ""),
            "cliente": str(d.get("Cliente", "") or ""),
            "estado": estado,
            "estado_display": estado_display,
            "dias": int(dias) if isinstance(dias, (int, float)) else 0,
        })

    my_pending.sort(key=lambda x: x["dias"], reverse=True)

    return {
        "initials": initials,
        "nombre": nombre,
        "my_total": my_total,
        "my_approved": my_approved,
        "my_pct": my_pct,
        "my_devol_count": my_devol_count,
        "team_avg_pct": team_avg_pct,
        "my_pending": my_pending,
        "my_critical": my_critical,
        "my_expiring": my_expiring,
        "week_start": week_start_str,
        "week_end": week_end_str,
    }


# ═══════════════════════════════════════════════════════════════════════════
# CAPA 2: RENDERIZADO HTML
# ═══════════════════════════════════════════════════════════════════════════


def _escape(text: str) -> str:
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _email_shell(title: str, subtitle: str, content: str) -> str:
    """Full HTML email wrapper: dark header + indigo bar + footer."""
    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#EEF2F9;font-family:Arial,Helvetica,sans-serif;">

<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#EEF2F9;">
{_escape(title)} &middot; {_escape(subtitle)}
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F9;padding:32px 0;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(30,45,125,0.10);">

  <!-- HEADER -->
  <tr>
    <td style="background:#1A1D27;padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="height:4px;background:#4F46E5;font-size:1px;">&nbsp;</td></tr>
        <tr>
          <td style="padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">
              {_escape(title)}
            </h1>
            <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">
              {_escape(subtitle)}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CONTENT -->
  {content}

  <!-- FOOTER -->
  <tr>
    <td style="padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="height:3px;background:#4F46E5;font-size:1px;">&nbsp;</td></tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:12px;font-weight:700;color:#1A1D27;">EIPSA</p>
                  <p style="margin:3px 0 0;font-size:11px;color:#94a3b8;">documentacion@eipsa.es</p>
                </td>
                <td style="text-align:right;vertical-align:middle;">
                  <p style="margin:0;font-size:10px;color:#94a3b8;">Generado por DocFlow</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>"""


def _kpi_cards_html(cards: list) -> str:
    """Render a 2x3 grid of KPI cards. Each card: (value, label, color)."""
    def _card(value: str, label: str, color: str) -> str:
        return (
            f'<td width="33%" align="center" style="padding:0 4px;">'
            f'<table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">'
            f'<tr><td style="height:4px;background:{color};font-size:1px;">&nbsp;</td></tr>'
            f'<tr><td style="padding:12px 8px;text-align:center;background:#ffffff;">'
            f'<p style="margin:0;font-size:24px;font-weight:800;color:{color};line-height:1;">{_escape(value)}</p>'
            f'<p style="margin:4px 0 0;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">{label}</p>'
            f'</td></tr></table></td>'
        )

    row1 = "".join(_card(*c) for c in cards[:3])
    row2 = "".join(_card(*c) for c in cards[3:6]) if len(cards) > 3 else ""
    spacer = '<tr><td colspan="3" style="height:8px;font-size:1px;">&nbsp;</td></tr>' if row2 else ""
    row2_html = f"<tr>{row2}</tr>" if row2 else ""
    return (
        f'<table width="100%" cellpadding="0" cellspacing="0">'
        f'<tr>{row1}</tr>{spacer}{row2_html}</table>'
    )


def _docs_table_html(docs: list, max_rows: int = 20) -> str:
    """Render a table of pending documents."""
    if not docs:
        return ""
    th = (
        "background:#1A1D27;color:#ffffff;padding:10px 12px;font-size:10px;"
        "font-weight:700;letter-spacing:0.06em;text-transform:uppercase;text-align:left;"
    )
    rows = ""
    for i, d in enumerate(docs[:max_rows]):
        bg = "#F8FAFC" if i % 2 == 0 else "#FFFFFF"
        doc_eipsa = _escape(d["doc_eipsa"][:20])
        titulo = _escape(d["titulo"][:30])
        cliente = _escape(d["cliente"][:15])
        dias = d["dias"]
        estado_raw = d["estado"]
        _, estado_color = _ESTADO_COLORS.get(estado_raw, (estado_raw.title(), "#64748B"))
        estado_display = d.get("estado_display", estado_raw.title())

        if dias > 15:
            dias_color = "#DC2626"
        elif dias > 7:
            dias_color = "#D97706"
        else:
            dias_color = "#1e293b"

        rows += (
            f'<tr style="background:{bg};">'
            f'<td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1e293b;'
            f"font-family:'Courier New',monospace;white-space:nowrap;\">{doc_eipsa}</td>"
            f'<td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1e293b;">{titulo}</td>'
            f'<td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1e293b;">{cliente}</td>'
            f'<td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">'
            f'<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:600;'
            f'color:#fff;background:{estado_color};">{estado_display}</span></td>'
            f'<td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;'
            f'color:{dias_color};text-align:center;">{dias}</td>'
            f'</tr>'
        )

    remaining = len(docs) - max_rows
    if remaining > 0:
        rows += (
            f'<tr><td colspan="5" style="padding:8px 12px;text-align:center;font-size:11px;color:#64748b;">'
            f'... y {remaining} documentos m&aacute;s</td></tr>'
        )

    return (
        f'<table cellpadding="0" cellspacing="0" style="width:100%;border-radius:8px;'
        f'overflow:hidden;border:1px solid #e2e8f0;">'
        f'<thead><tr>'
        f'<th style="{th}">Doc. EIPSA</th>'
        f'<th style="{th}">T&iacute;tulo</th>'
        f'<th style="{th}">Cliente</th>'
        f'<th style="{th}">Estado</th>'
        f'<th style="{th}text-align:center;">D&iacute;as</th>'
        f'</tr></thead>'
        f'<tbody>{rows}</tbody></table>'
    )


def _alert_box_html(count: int, message: str, color: str) -> str:
    """Colored alert box (amber/red)."""
    if color == "amber":
        bg, border, text = "#FFFBEB", "#FDE68A", "#92400E"
        icon = "&#9888;"
    else:
        bg, border, text = "#FEF2F2", "#FECACA", "#991B1B"
        icon = "&#9888;"
    return (
        f'<table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:8px;">'
        f'<tr><td style="padding:12px 16px;background:{bg};border:1px solid {border};border-radius:8px;">'
        f'<p style="margin:0;font-size:13px;color:{text};font-weight:600;">'
        f'{icon} <strong>{count}</strong> {_escape(message)}</p>'
        f'</td></tr></table>'
    )


def _comparison_html(my_pct: int, team_avg: float) -> str:
    """My % vs team average mini widget."""
    diff = my_pct - team_avg
    if diff > 0:
        arrow, color, label = "&#9650;", "#16A34A", f"+{diff:.0f}pp vs equipo"
    elif diff < 0:
        arrow, color, label = "&#9660;", "#DC2626", f"{diff:.0f}pp vs equipo"
    else:
        arrow, color, label = "&#9644;", "#64748B", "igual que equipo"
    return (
        f'<span style="font-size:11px;color:{color};font-weight:600;">'
        f'{arrow} {label}</span>'
    )


# ── Executive email render ────────────────────────────────────────────────

def _render_executive_html(data: dict, ai_paragraph: str) -> str:
    """Render the executive email body."""
    cards = [
        (str(data["total_docs"]), "Movimientos", "#2563EB"),
        (f'{data["total_aprobados"]} ({data["pct_aprobados"]}%)', "Aprobados", "#16A34A"),
        (f'{data["velocidad_media"]}d', "Vel. Media", "#4F46E5"),
        (str(data["docs_riesgo"]), "En Riesgo", "#DC2626"),
        (str(data["a_vencer_3d"]), "Vencen 3d", "#D97706"),
        (f'{data["pct_global"]}%', "Aprob. Global", "#0D9488"),
    ]

    # Docs table
    table = _docs_table_html(data.get("weekly_docs", []))
    table_section = ""
    if table:
        table_section = (
            f'<p style="margin:0 0 12px;font-size:10px;font-weight:700;color:#4F46E5;'
            f'text-transform:uppercase;letter-spacing:0.08em;">Movimientos de la Semana</p>'
            f'{table}'
        )

    content = f"""
  <tr>
    <td style="padding:24px 28px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
      {_kpi_cards_html(cards)}
    </td>
  </tr>
  <tr>
    <td style="padding:24px 28px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-left:4px solid #4F46E5;background:#F5F3FF;padding:16px 20px;border-radius:0 8px 8px 0;">
            <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.7;">
              {_escape(ai_paragraph.strip())}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 28px 24px;">
      {table_section}
    </td>
  </tr>"""

    return _email_shell(
        "DocFlow \u2014 Resumen Ejecutivo",
        f"Semana del {data['week_start']} al {data['week_end']}",
        content,
    )


# ── Personal email render ─────────────────────────────────────────────────

def _render_personal_html(data: dict) -> str:
    """Render a personal email for one doc controller (devoluciones only)."""
    pending_count = len(data["my_pending"])

    # Mini KPI cards (3)
    cards = [
        (str(data["my_devol_count"]), "Devoluciones", "#2563EB"),
        (f'{data["my_pct"]}%', "Mi Aprob.", "#16A34A"),
        (str(pending_count), "Pendientes", "#D97706" if pending_count > 0 else "#16A34A"),
    ]

    # Alerts
    alerts = ""
    if data["my_expiring"] > 0:
        alerts += _alert_box_html(data["my_expiring"], "devoluciones vencen en 3 d\u00edas", "amber")
    if data["my_critical"] > 0:
        alerts += _alert_box_html(data["my_critical"], "devoluciones cr\u00edticas pendientes", "red")

    # Green box if no pending
    if pending_count == 0:
        green_box = (
            '<table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;">'
            '<tr><td style="padding:16px 20px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;text-align:center;">'
            '<p style="margin:0;font-size:14px;color:#16A34A;font-weight:700;">&#10003; Sin devoluciones pendientes esta semana</p>'
            '<p style="margin:4px 0 0;font-size:12px;color:#16A34A;">No hay documentos devueltos por el cliente esta semana</p>'
            '</td></tr></table>'
        )
    else:
        green_box = ""

    # Docs table
    table = _docs_table_html(data["my_pending"]) if pending_count > 0 else ""

    # Section header for table
    table_section = ""
    if table:
        table_section = (
            f'<p style="margin:0 0 12px;font-size:10px;font-weight:700;color:#4F46E5;'
            f'text-transform:uppercase;letter-spacing:0.08em;">Devoluciones de la Semana</p>'
            f'{table}'
        )

    content = f"""
  <tr>
    <td style="padding:24px 28px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
      {_kpi_cards_html(cards)}
      <p style="margin:10px 0 0;text-align:center;">{_comparison_html(data["my_pct"], data["team_avg_pct"])}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 28px 24px;">
      {alerts}
      {green_box}
      {table_section}
    </td>
  </tr>"""

    subtitle = f'{data["nombre"]} ({data["initials"]})'
    if data.get("week_start") and data.get("week_end"):
        subtitle += f' \u2014 Semana del {data["week_start"]} al {data["week_end"]}'

    return _email_shell(
        "DocFlow \u2014 Tu Resumen Semanal",
        subtitle,
        content,
    )


# ═══════════════════════════════════════════════════════════════════════════
# AI PARAGRAPH
# ═══════════════════════════════════════════════════════════════════════════


def _build_ai_prompt(data: dict) -> str:
    return f"""Eres un asistente ejecutivo de EIPSA (ingeniería de documentación técnica).
Genera un PÁRRAFO EJECUTIVO BREVE (2-3 frases narrativas) en ESPAÑOL con estos datos
de la semana ({data['week_start']} al {data['week_end']}):

- Movimientos esta semana: {data['total_docs']}
- Aprobados esta semana: {data['pct_aprobados']}% ({data['total_aprobados']}/{data['total_docs']})
- Velocidad media devolución: {data['velocidad_media']} días
- Documentos en riesgo (>15 días): {data['docs_riesgo']}
- A vencer en 3 días: {data['a_vencer_3d']}
- Aprobación global del proyecto: {data['pct_global']}% ({data['total_global']} docs totales)

Menciona la tendencia general, el punto de atención más crítico, y una acción recomendada.
Solo un párrafo corto narrativo. Sin HTML ni markdown. Sé directo y accionable."""


def _fallback_paragraph(data: dict) -> str:
    return (
        f"Esta semana ({data['week_start']} al {data['week_end']}) se registraron "
        f"{data['total_docs']} movimientos con una velocidad media de devolución de "
        f"{data['velocidad_media']} días. El {data['pct_aprobados']}% está aprobado "
        f"({data['total_aprobados']}/{data['total_docs']}), con una aprobación global "
        f"del proyecto del {data['pct_global']}%. Hay {data['docs_riesgo']} documentos "
        f"en riesgo y {data['a_vencer_3d']} por vencer en 3 días."
    )


def _generate_ai_paragraph(data: dict) -> str:
    api_key = (ANTHROPIC_API_KEY or "").strip()
    if not api_key:
        return _fallback_paragraph(data)
    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": _build_ai_prompt(data)}],
        )
        return message.content[0].text
    except Exception:
        return _fallback_paragraph(data)


# ═══════════════════════════════════════════════════════════════════════════
# CAPA 3: API PUBLICA
# ═══════════════════════════════════════════════════════════════════════════


def send_executive_email(to=None, cc=None) -> dict:
    """Generate and send the executive summary email.

    Args:
        to: Override recipients list. Falls back to WEEKLY_EXECUTIVE_RECIPIENTS env var.
        cc: Optional CC list.
    """
    data = _collect_executive_data()
    ai_paragraph = _generate_ai_paragraph(data)
    html = _render_executive_html(data, ai_paragraph)
    subject = f"DocFlow \u2014 Resumen Ejecutivo ({data['fecha']})"

    if to:
        recipients = to
    else:
        recipients_raw = os.getenv("WEEKLY_EXECUTIVE_RECIPIENTS", "")
        recipients = [r.strip() for r in recipients_raw.split(",") if r.strip()]

    if not recipients:
        return {"status": "skipped", "reason": "No recipients configured"}

    send_html_email(to=recipients, cc=cc or [], subject=subject, html_body=html)
    return {"status": "sent", "type": "executive", "recipients": recipients, "fecha": data["fecha"]}


def send_personal_emails(to_cc=None, user_filter=None) -> dict:
    """Generate and send personal emails to each doc controller.

    Args:
        to_cc: Optional CC list added to each individual email.
        user_filter: "all" or list of initials to filter (e.g. ["JP","AC"]).
    """
    monitoring = MonitoringService(data_repo, consulta_repo)
    docs = monitoring.get_monitoring_data()

    # Weekly range
    start, end = _get_weekly_range()
    week_start_str = start.strftime("%d/%m")
    week_end_str = end.strftime("%d/%m")

    # Team average approval %
    total_all = len(docs)
    approved_all = sum(
        1 for d in docs
        if str(d.get("Estado", "") or "").lower().strip() in ESTADOS_APROBADOS
    )
    team_avg_pct = round(approved_all / total_all * 100, 1) if total_all else 0

    # Filter users if specified
    users_to_send = USERS
    if user_filter and user_filter != "all" and isinstance(user_filter, list):
        users_to_send = {k: v for k, v in USERS.items() if k in user_filter}

    sent_to = []
    for initials, user_info in users_to_send.items():
        pdata = _collect_personal_data(initials, docs, team_avg_pct, week_start_str, week_end_str)
        if pdata["my_total"] == 0:
            continue
        html = _render_personal_html(pdata)
        fecha = datetime.now().strftime("%Y-%m-%d")
        subject = f"DocFlow \u2014 Tu Resumen Semanal ({fecha})"
        email = user_info["emails"][0]
        send_html_email(to=[email], cc=to_cc or [], subject=subject, html_body=html)
        sent_to.append(email)
        time.sleep(1)

    return {"status": "sent", "type": "personal", "sent_to": sent_to, "count": len(sent_to)}


def get_executive_preview() -> str:
    """Generate the executive email HTML without sending."""
    data = _collect_executive_data()
    ai_paragraph = _generate_ai_paragraph(data)
    return _render_executive_html(data, ai_paragraph)


def get_personal_preview(initials: str) -> str:
    """Generate a personal email HTML for preview."""
    monitoring = MonitoringService(data_repo, consulta_repo)
    docs = monitoring.get_monitoring_data()

    # Weekly range
    start, end = _get_weekly_range()
    week_start_str = start.strftime("%d/%m")
    week_end_str = end.strftime("%d/%m")

    total_all = len(docs)
    approved_all = sum(
        1 for d in docs
        if str(d.get("Estado", "") or "").lower().strip() in ESTADOS_APROBADOS
    )
    team_avg_pct = round(approved_all / total_all * 100, 1) if total_all else 0

    pdata = _collect_personal_data(initials, docs, team_avg_pct, week_start_str, week_end_str)
    return _render_personal_html(pdata)
