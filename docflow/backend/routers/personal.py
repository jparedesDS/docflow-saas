from fastapi import APIRouter
from services.analytics_service import AnalyticsService
from services.monitoring_service import MonitoringService
from services import agenda_service
from repositories.instances import data_repo, consulta_repo
from utils.config import USERS

router = APIRouter()

_monitoring = MonitoringService(data_repo, consulta_repo)
_analytics = AnalyticsService()


@router.get("/overview")
def get_personal_overview():
    """Agrega KPIs de analytics + tareas pendientes + urgencias por cada trabajador."""
    docs = _monitoring.get_monitoring_data()
    summary = _analytics.get_analytics_summary(docs)

    # Índice de KPIs por iniciales (campo "responsable" en por_responsable_doc)
    kpis_by_iniciales = {
        r["responsable"]: r
        for r in summary.get("por_responsable_doc", [])
    }

    # Índice de urgencias por responsable
    urgencias_by_resp: dict[str, list] = {}
    for u in summary.get("urgencias", []):
        resp = (u.get("responsable") or "").strip()
        if resp:
            urgencias_by_resp.setdefault(resp, []).append(u)

    workers = []
    for iniciales, info in USERS.items():
        kpis_raw = kpis_by_iniciales.get(iniciales, {})
        kpis = {
            "total":           kpis_raw.get("total", 0),
            "aprobados":       kpis_raw.get("aprobados", 0),
            "pct":             kpis_raw.get("pct", 0),
            "devoluciones":    kpis_raw.get("devoluciones", 0),
            "criticos":        kpis_raw.get("criticos", 0),
            "vel_media":       kpis_raw.get("vel_media", 0),
            "sin_enviar":      kpis_raw.get("sin_enviar", 0),
            "tasa_devolucion": kpis_raw.get("tasa_devolucion", 0),
            "dias_envio_media": kpis_raw.get("dias_envio_media", 0),
            "revision_media":  kpis_raw.get("revision_media", 0),
        }

        tareas = agenda_service.get_tareas(iniciales)
        tareas_pendientes = [
            {
                "id":           t.get("id"),
                "titulo":       t.get("titulo", ""),
                "prioridad":    t.get("prioridad", "media"),
                "estado":       t.get("estado", "pendiente"),
                "fecha_limite": t.get("fecha_limite", ""),
                "descripcion":  t.get("descripcion", ""),
            }
            for t in tareas
            if t.get("auto_generated") is True
            and t.get("estado") not in ("completada", "completado")
        ]

        urgencias = [
            {
                "doc_eipsa": u.get("doc_eipsa", ""),
                "titulo":    u.get("titulo", ""),
                "dias":      u.get("dias", 0),
                "estado":    u.get("estado", ""),
                "critico":   u.get("critico", False),
                "cliente":   u.get("cliente", ""),
                "pedido":    u.get("pedido", ""),
            }
            for u in urgencias_by_resp.get(iniciales, [])
        ]

        workers.append({
            "iniciales": iniciales,
            "nombre":    info["nombre"],
            "kpis":      kpis,
            "tareas_pendientes": tareas_pendientes,
            "urgencias": urgencias,
        })

    return {"workers": workers}


@router.post("/sync-all")
def sync_all_workers():
    """Sincroniza tareas desde Excel para todos los trabajadores."""
    all_docs = _monitoring.get_monitoring_data()
    results = {}
    for iniciales in USERS:
        pending = [
            d for d in all_docs
            if str(d.get("Repsonsable", "") or "").strip() == iniciales
            and (d.get("Estado", "") or "").strip().lower() in agenda_service.ESTADOS_PENDIENTES
        ]
        result = agenda_service.sync_tareas(iniciales, pending)
        results[iniciales] = result

    return {"synced": results}
