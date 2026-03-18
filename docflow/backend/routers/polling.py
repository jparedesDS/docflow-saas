"""Router para el servicio de polling IMAP."""

from fastapi import APIRouter

from services.polling_service import get_polling_status, poll_and_process

router = APIRouter(prefix="/polling", tags=["polling"])


@router.get("/status")
def status():
    """Devuelve el estado del último polling."""
    return get_polling_status()


@router.post("/trigger")
def trigger():
    """Ejecuta un polling manual."""
    result = poll_and_process()
    return result
