from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.claim_service import ClaimService

router = APIRouter()
claim_service = ClaimService()


class SendClaimRequest(BaseModel):
    to: list[str]
    cc: list[str] = []


@router.get("/pedidos")
def list_claimable_pedidos():
    """Lista de pedidos con documentos Enviados y >= 15 días sin respuesta."""
    return claim_service.get_claimable_pedidos()


@router.get("/{pedido:path}/history")
def get_claim_history(pedido: str):
    """Historial de reclamaciones enviadas para un pedido."""
    return claim_service.get_pedido_history(pedido)


@router.get("/{pedido:path}/preview")
def preview_claim(pedido: str):
    """Datos del email de reclamación para un pedido concreto."""
    try:
        return claim_service.get_pedido_preview(pedido)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/trigger-reminder")
def trigger_reminder():
    """Ejecuta el job de recordatorio de reclamaciones manualmente (para pruebas)."""
    from services.claims_reminder_service import run_claims_reminder
    run_claims_reminder()
    return {"ok": True, "message": "Recordatorio ejecutado correctamente"}


@router.post("/{pedido:path}/send")
def send_claim(pedido: str, body: SendClaimRequest):
    """Genera y envía el email de reclamación por SMTP."""
    try:
        return claim_service.send_claim(pedido, body.to, body.cc)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error enviando reclamación: {e}")
