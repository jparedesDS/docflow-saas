from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional
import io
from services.report_service import ReportService
from services.monitoring_service import MonitoringService
from repositories.instances import data_repo, consulta_repo
from services.notification_service import notification_service

SHARED_DRIVE_PATH = r"M:\Comunes\JOSE\01 MONITORING REPORT"

router = APIRouter()

monitoring_service = MonitoringService(data_repo, consulta_repo)
report_service = ReportService()


@router.get("/summary")
def get_summary():
    """Obtener resumen estadístico de documentos."""
    docs = monitoring_service.get_monitoring_data()
    return report_service.generate_summary(docs)


@router.get("/download/excel")
def download_excel(
    estado: Optional[str] = Query(None),
    cliente: Optional[str] = Query(None),
    responsable: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
):
    """Descargar reporte Excel filtrado (formato monitoring report)."""
    docs = monitoring_service.get_monitoring_data(
        estado=estado, cliente=cliente, responsable=responsable, query=q
    )
    excel_bytes = report_service.generate_excel_report(docs)
    filtros = [f for f in [estado, cliente, responsable, q] if f]
    notification_service.add(
        "exportacion",
        f"Excel exportado ({len(docs)} docs)",
        f"Filtros: {', '.join(filtros)}" if filtros else "Sin filtros",
        {"cantidad": len(docs)},
    )
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=monitoring_report_docflow.xlsx"},
    )


@router.get("/monitoring-report")
def get_monitoring_report():
    """Datos del monitoring report divididos en secciones + KPIs."""
    return monitoring_service.get_monitoring_report_sections()


@router.get("/download/monitoring-excel")
def download_monitoring_excel():
    """Descarga el Excel multi-hoja formateado del monitoring report."""
    from datetime import datetime
    sections = monitoring_service.get_monitoring_report_sections()
    excel_bytes = report_service.generate_monitoring_excel(sections)
    today = datetime.now().strftime("%Y-%m-%d")
    filename = f"Monitoring_Report_{today}.xlsx"
    notification_service.add(
        "exportacion",
        f"Monitoring Report Excel generado",
        f"Secciones: {sections['kpis'].get('total', 0)} docs totales",
        sections["kpis"],
    )
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/weekly-executive")
def send_weekly_executive_endpoint():
    """Genera y envía el resumen ejecutivo semanal."""
    try:
        from services.weekly_summary_service import send_executive_email
        result = send_executive_email()
        return result
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.get("/weekly-executive/preview")
def preview_weekly_executive():
    """Preview HTML del email ejecutivo."""
    try:
        from services.weekly_summary_service import get_executive_preview
        from fastapi.responses import HTMLResponse
        html = get_executive_preview()
        return HTMLResponse(content=html)
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.post("/weekly-personal")
def send_weekly_personal_endpoint():
    """Genera y envía emails personales a cada doc controller."""
    try:
        from services.weekly_summary_service import send_personal_emails
        result = send_personal_emails()
        return result
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.get("/weekly-personal/preview")
def preview_weekly_personal(initials: str = Query("JP")):
    """Preview HTML del email personal de un usuario."""
    try:
        from services.weekly_summary_service import get_personal_preview
        from fastapi.responses import HTMLResponse
        html = get_personal_preview(initials)
        return HTMLResponse(content=html)
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.get("/monthly-pdf")
def get_monthly_pdf(month: int = None, year: int = None):
    """Genera y descarga el informe mensual PDF."""
    from datetime import datetime
    if not month or not year:
        now = datetime.now()
        month = month or now.month
        year = year or now.year
    try:
        from services.pdf_report_service import generate_monthly_pdf
        pdf_bytes = generate_monthly_pdf(month, year)
        import io
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=Informe_{year}_{month:02d}.pdf"},
        )
    except ImportError:
        return JSONResponse({"ok": False, "error": "reportlab no instalado. Ejecuta: pip install reportlab"}, status_code=500)
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.get("/weekly-pdf")
def get_weekly_pdf():
    """Genera y descarga el informe semanal PDF."""
    from datetime import datetime
    try:
        from services.pdf_report_service import generate_weekly_pdf
        pdf_bytes = generate_weekly_pdf()
        filename = f"Informe_Semanal_{datetime.now().strftime('%Y-%m-%d')}.pdf"
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except ImportError:
        return JSONResponse({"ok": False, "error": "reportlab no instalado"}, status_code=500)
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.get("/monthly-pdf/preview")
def preview_monthly_pdf(month: int = None, year: int = None):
    """Preview HTML del informe mensual en el navegador."""
    from datetime import datetime
    from fastapi.responses import HTMLResponse
    if not month or not year:
        now = datetime.now()
        month = month or now.month
        year = year or now.year
    try:
        from services.pdf_report_service import generate_preview_html
        html = generate_preview_html(month, year)
        return HTMLResponse(content=html)
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.post("/copy-to-shared")
def copy_to_shared_drive():
    """Genera y copia el monitoring report a la carpeta compartida de red."""
    sections = monitoring_service.get_monitoring_report_sections()
    excel_bytes = report_service.generate_monitoring_excel(sections)
    result = report_service.copy_to_shared_drive(excel_bytes, SHARED_DRIVE_PATH)
    if result["ok"]:
        notification_service.add(
            "exportacion",
            "Monitoring Report copiado a carpeta compartida",
            result["path"],
            result,
        )
        return JSONResponse({"ok": True, "path": result["path"], "filename": result["filename"]})
    else:
        return JSONResponse({"ok": False, "error": result["error"]}, status_code=500)
