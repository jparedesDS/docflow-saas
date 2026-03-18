"""
DocuSign — endpoints REST.

GET  /api/v1/docusign/envelopes         lista con filtros ?status=sent&days=30
GET  /api/v1/docusign/envelopes/{id}    detalle completo
GET  /api/v1/docusign/kpis              conteos por estado
POST /api/v1/docusign/webhook           receptor de eventos DocuSign Connect
"""
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

import requests
from services.docusign_service import get_docusign_service
from utils.config import DOCUSIGN_BASE_URL, DOCUSIGN_ACCOUNT_ID

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/debug")
def debug_info():
    """Diagnóstico: devuelve info de la cuenta DocuSign y sobres sin filtro de fecha."""
    try:
        svc = get_docusign_service()
        headers = svc._headers()
        base = svc._base()

        # Info de la cuenta
        account_resp = requests.get(
            f"{DOCUSIGN_BASE_URL}/restapi/v2.1/accounts/{DOCUSIGN_ACCOUNT_ID}",
            headers=headers, timeout=10,
        )

        # Sobres sin filtro de fecha (solo los últimos que devuelva DocuSign por defecto)
        envelopes_resp = requests.get(
            f"{base}/envelopes",
            headers=headers,
            params={"from_date": (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%SZ"), "include": "recipients"},
            timeout=15,
        )

        return {
            "base_url": DOCUSIGN_BASE_URL,
            "account_id": DOCUSIGN_ACCOUNT_ID,
            "account_status": account_resp.status_code,
            "account_info": account_resp.json() if account_resp.ok else account_resp.text,
            "envelopes_status": envelopes_resp.status_code,
            "envelopes_raw": envelopes_resp.json() if envelopes_resp.ok else envelopes_resp.text,
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/envelopes")
def list_envelopes(
    status: str | None = Query(None, description="Filtrar por estado: sent, completed, declined, voided, created, timed_out"),
    days: int = Query(30, ge=1, le=3650, description="Rango de días hacia atrás"),
):
    try:
        svc = get_docusign_service()
        return svc.list_envelopes(status=status, days=days)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("DocuSign list_envelopes error: %s", e)
        raise HTTPException(status_code=502, detail="Error comunicando con DocuSign")


@router.get("/envelopes/{envelope_id}/download")
def download_envelope(envelope_id: str):
    """Descarga el PDF combinado de un sobre completado."""
    try:
        svc = get_docusign_service()
        pdf_bytes = svc.download_combined_pdf(envelope_id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="sobre_{envelope_id}.pdf"'},
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("DocuSign download(%s) error: %s", envelope_id, e)
        raise HTTPException(status_code=502, detail="Error descargando el sobre de DocuSign")


@router.get("/envelopes/{envelope_id}")
def get_envelope(envelope_id: str):
    try:
        svc = get_docusign_service()
        return svc.get_envelope(envelope_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("DocuSign get_envelope(%s) error: %s", envelope_id, e)
        raise HTTPException(status_code=502, detail="Error obteniendo sobre de DocuSign")


@router.get("/kpis")
def get_kpis(days: int = Query(30, ge=1, le=3650)):
    try:
        svc = get_docusign_service()
        return svc.get_kpis(days=days)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("DocuSign kpis error: %s", e)
        raise HTTPException(status_code=502, detail="Error obteniendo KPIs de DocuSign")


@router.post("/webhook")
async def webhook(request: Request):
    """
    Receptor de eventos DocuSign Connect.
    DocuSign envía XML multipart; aquí logueamos el evento y actualizamos
    el cache en memoria si el servicio está activo.
    """
    try:
        body = await request.body()
        logger.info("DocuSign webhook recibido (%d bytes)", len(body))
        # En producción: parsear XML, validar HMAC, actualizar cache local
        return {"received": True}
    except Exception as e:
        logger.error("DocuSign webhook error: %s", e)
        raise HTTPException(status_code=500, detail="Error procesando webhook")
