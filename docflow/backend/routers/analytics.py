import re

import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from services.analytics_service import AnalyticsService
from services.monitoring_service import MonitoringService
from services.supplier_scorecard_service import get_scorecard
from repositories.instances import data_repo, consulta_repo
from services.smtp_service import send_html_email

router = APIRouter()

monitoring_service = MonitoringService(data_repo, consulta_repo)
analytics_service = AnalyticsService()


@router.get("/summary")
def get_analytics_summary():
    """Devuelve métricas de análisis de documentación para el dashboard Analytics."""
    docs = monitoring_service.get_monitoring_data()
    return analytics_service.get_analytics_summary(docs)


class AlertsRequest(BaseModel):
    dias_umbral: int = 15
    destinatarios: list[str]
    cc: Optional[list[str]] = []


@router.post("/alerts/send")
def send_alerts(req: AlertsRequest):
    """Envía alerta por email con documentos que llevan más de N días sin movimiento."""
    docs = monitoring_service.get_monitoring_data()
    summary = analytics_service.get_analytics_summary(docs)
    urgencias = [u for u in summary.get("urgencias", []) if u["dias"] >= req.dias_umbral]

    if not urgencias:
        return {"sent": False, "message": "No hay documentos que superen el umbral", "count": 0}

    def fila_html(u):
        bg = "#FFF5F5" if u["critico"] else "#FFFFFF"
        color_dias = "#DC2626" if u["dias"] > 30 else "#D97706"
        doc_ref = u["doc_eipsa"] or u["pedido"]
        critico_badge = "⚠ CRÍTICO" if u["critico"] else ""
        td = "padding:6px 10px;border-bottom:1px solid #E8ECF0"
        return (
            f"<tr style='background:{bg}'>"
            f"<td style='{td}'>{doc_ref}</td>"
            f"<td style='{td}'>{u['titulo']}</td>"
            f"<td style='{td}'>{u['cliente']}</td>"
            f"<td style='{td}'>{u['responsable']}</td>"
            f"<td style='{td};text-align:center;font-weight:700;color:{color_dias}'>{u['dias']}d</td>"
            f"<td style='{td}'>{u['estado']}</td>"
            f"<td style='{td};text-align:center'>{critico_badge}</td>"
            f"</tr>"
        )

    filas = "".join(fila_html(u) for u in urgencias)

    html = f"""
    <div style='font-family:Arial,sans-serif;max-width:900px;margin:0 auto'>
      <h2 style='color:#1B3A5C'>Alerta DocFlow — Documentos sin movimiento ≥ {req.dias_umbral} días</h2>
      <p style='color:#64748B'>Se han detectado <strong>{len(urgencias)}</strong> documentos que llevan más de {req.dias_umbral} días sin movimiento.</p>
      <table style='width:100%;border-collapse:collapse;font-size:13px'>
        <thead>
          <tr style='background:#1B3A5C;color:#FFF'>
            <th style='padding:8px 10px;text-align:left'>Documento</th>
            <th style='padding:8px 10px;text-align:left'>Título</th>
            <th style='padding:8px 10px;text-align:left'>Cliente</th>
            <th style='padding:8px 10px;text-align:left'>Responsable</th>
            <th style='padding:8px 10px;text-align:center'>Días</th>
            <th style='padding:8px 10px;text-align:left'>Estado</th>
            <th style='padding:8px 10px;text-align:center'>Crítico</th>
          </tr>
        </thead>
        <tbody>{filas}</tbody>
      </table>
      <p style='color:#94A3B8;font-size:11px;margin-top:16px'>Generado automáticamente por DocFlow</p>
    </div>
    """

    send_html_email(
        to=req.destinatarios,
        cc=req.cc or [],
        subject=f"[DocFlow] Alerta: {len(urgencias)} documentos ≥ {req.dias_umbral} días sin movimiento",
        html_body=html,
    )
    return {"sent": True, "count": len(urgencias)}


@router.get("/scorecard")
def get_scorecard_endpoint():
    """Scorecard de proveedores/clientes — mapea campos del servicio a lo que espera el frontend."""
    data = get_scorecard(tenant_id=0)
    return [
        {
            "client": row.get("client", ""),
            "score": row.get("score", 0),
            "approval_rate": row.get("approval_rate_first_rev", 0),
            "avg_response_days": row.get("avg_response_days", 0),
            "critical_docs": row.get("critical_docs_count", 0),
            "total_docs": row.get("total_docs", 0),
            "trend": [],
        }
        for row in data
    ]


@router.get("/s-curve")
def get_s_curve():
    """Curva S global — baseline lineal vs % acumulado de aprobados por mes."""
    docs = monitoring_service.get_monitoring_data()
    if not docs:
        return {"baseline": [], "actual": [], "predicted": []}

    df = pd.DataFrame(docs)
    # Determinar columna de fecha
    date_col = None
    for col in ("Fecha Env. Doc.", "Fecha Pedido"):
        if col in df.columns:
            date_col = col
            break
    if not date_col:
        return {"baseline": [], "actual": [], "predicted": []}

    df["_date"] = df[date_col].fillna("")
    df = df[df["_date"] != ""]
    if df.empty:
        return {"baseline": [], "actual": [], "predicted": []}

    # Extraer mes (YYYY-MM)
    df["_month"] = df["_date"].str[:7]
    total = len(df)

    # Agrupar por mes
    months = {}
    for _, row in df.iterrows():
        m = row["_month"]
        if m not in months:
            months[m] = {"approved": 0, "total": 0}
        months[m]["total"] += 1
        estado = str(row.get("Estado", "") or "")
        if re.search(r"aprobado", estado, re.IGNORECASE):
            months[m]["approved"] += 1

    keys = sorted(months.keys())
    if not keys:
        return {"baseline": [], "actual": [], "predicted": []}

    step = 100.0 / len(keys)
    baseline = []
    actual = []
    cum_approved = 0

    for i, m in enumerate(keys):
        cum_approved += months[m]["approved"]
        baseline.append({"month": m, "value": round(step * (i + 1))})
        actual.append({"month": m, "value": round((cum_approved / total) * 100)})

    return {"baseline": baseline, "actual": actual, "predicted": []}
