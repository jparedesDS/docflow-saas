from fastapi import APIRouter, HTTPException
from services.monitoring_service import MonitoringService
from services.analytics_service import AnalyticsService
from repositories.instances import data_repo, consulta_repo
import json, os

router = APIRouter()

CLAIMS_LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "claims_log.json")

_monitoring_service = MonitoringService(data_repo, consulta_repo)


def _get_service():
    return _monitoring_service


def _load_claims_log() -> dict:
    path = os.path.normpath(CLAIMS_LOG_PATH)
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _filter_by_pedido(docs: list, pedido: str) -> list:
    norm = MonitoringService._normalize_pedido(pedido)
    return [
        d for d in docs
        if MonitoringService._normalize_pedido(str(d.get("Nº Pedido", ""))) == norm
    ]


@router.get("/list")
def list_pedidos():
    """Devuelve la lista de pedidos (normalizados) disponibles."""
    svc = _get_service()
    docs = svc.get_monitoring_data()
    pedidos = sorted(set(
        MonitoringService._normalize_pedido(str(d.get("Nº Pedido", "")))
        for d in docs
        if d.get("Nº Pedido")
    ))
    return pedidos


@router.get("/{pedido:path}/dashboard")
def project_dashboard(pedido: str):
    """KPIs del pedido: total docs, % aprobado, pendientes, dias respuesta media, reclamaciones."""
    svc = _get_service()
    analytics = AnalyticsService()
    all_docs = svc.get_monitoring_data()
    docs = _filter_by_pedido(all_docs, pedido)

    if not docs:
        raise HTTPException(status_code=404, detail=f"No se encontraron documentos para el pedido {pedido}")

    total = len(docs)
    aprobados = sum(1 for d in docs if str(d.get("Estado", "")).lower().strip() in analytics.ESTADOS_APROBADOS)
    enviados = sum(1 for d in docs if str(d.get("Estado", "")).lower().strip() in analytics.ESTADOS_ENVIADOS)
    devueltos = sum(1 for d in docs if str(d.get("Estado", "")).lower().strip() in analytics.ESTADOS_DEVOLUCION)
    sin_enviar = sum(1 for d in docs if str(d.get("Estado", "")).strip() == "")
    criticos = sum(1 for d in docs if str(d.get("Crítico", "")).lower().strip() in ("sí", "si"))

    dias_vals = [
        d["Días Devolución"]
        for d in docs
        if isinstance(d.get("Días Devolución"), (int, float)) and d["Días Devolución"] > 0
    ]
    avg_dias = round(sum(dias_vals) / len(dias_vals), 1) if dias_vals else 0

    # Claims info
    claims_log = _load_claims_log()
    norm = MonitoringService._normalize_pedido(pedido)
    claims_info = claims_log.get(norm, claims_log.get(pedido, {}))
    claims_sent = len(claims_info.get("history", []))

    cliente = next((str(d.get("Cliente", "")) for d in docs if d.get("Cliente")), "")

    return {
        "pedido": pedido,
        "cliente": cliente,
        "total": total,
        "aprobados": aprobados,
        "pct_aprobado": round(aprobados / total * 100, 1) if total else 0,
        "enviados": enviados,
        "devueltos": devueltos,
        "sin_enviar": sin_enviar,
        "criticos": criticos,
        "avg_dias_respuesta": avg_dias,
        "claims_sent": claims_sent,
        "last_claimed": claims_info.get("last_claimed", None),
    }


@router.get("/{pedido:path}/timeline")
def project_timeline(pedido: str):
    """Actividad cronologica: envios, devoluciones, reclamaciones."""
    svc = _get_service()
    all_docs = svc.get_monitoring_data()
    docs = _filter_by_pedido(all_docs, pedido)

    events = []

    for d in docs:
        doc_id = str(d.get("Nº Doc. EIPSA", ""))
        titulo = str(d.get("Título", ""))
        estado = str(d.get("Estado", "")).strip()
        fecha_env = str(d.get("Fecha Env. Doc.", "")).strip()
        rev = str(d.get("Nº Revisión", ""))

        if fecha_env and fecha_env != "":
            events.append({
                "date": fecha_env,
                "type": "submission",
                "doc": doc_id,
                "title": titulo,
                "rev": rev,
                "detail": f"Enviado Rev. {rev}",
            })

        if estado.lower() in AnalyticsService.ESTADOS_DEVOLUCION:
            events.append({
                "date": fecha_env or "",
                "type": "return",
                "doc": doc_id,
                "title": titulo,
                "rev": rev,
                "detail": f"Devuelto: {estado}",
            })

    # Claims from log
    claims_log = _load_claims_log()
    norm = MonitoringService._normalize_pedido(pedido)
    claims_info = claims_log.get(norm, claims_log.get(pedido, {}))
    for claim in claims_info.get("history", []):
        events.append({
            "date": claim.get("sent_at", ""),
            "type": "claim",
            "doc": "",
            "title": f"Reclamacion ({claim.get('docs_count', 0)} docs)",
            "rev": "",
            "detail": f"Enviada a {claim.get('to', '')}",
        })

    # Sort by date descending
    def sort_key(e):
        d = e.get("date", "")
        if not d:
            return ""
        return d

    events.sort(key=sort_key, reverse=True)
    return events


@router.get("/{pedido:path}/documents")
def project_documents(pedido: str):
    """Documentos filtrados del pedido con sus estados."""
    svc = _get_service()
    all_docs = svc.get_monitoring_data()
    docs = _filter_by_pedido(all_docs, pedido)
    return docs
