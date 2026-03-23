"""Router for network folder synchronization."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from utils.auth_middleware import get_current_user
from services.folder_sync_service import FolderSyncService

router = APIRouter()

_service = FolderSyncService()


class LinkRequest(BaseModel):
    file_path: str
    order_number: str


@router.get("/status")
async def sync_status(user: dict = Depends(get_current_user)):
    """Current folder sync status."""
    return _service.get_status()


@router.post("/scan")
async def trigger_scan(user: dict = Depends(get_current_user)):
    """Trigger a manual folder scan."""
    return _service.scan_folder()


@router.get("/history")
async def scan_history(
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(get_current_user),
):
    """Scan history list."""
    return _service.get_scan_history(limit=limit)


@router.post("/link")
async def link_file(body: LinkRequest, user: dict = Depends(get_current_user)):
    """Link a file to an order number."""
    success = _service.link_file_to_order(body.file_path, body.order_number)
    if not success:
        raise HTTPException(status_code=404, detail="Archivo no encontrado en el registro de sync")
    return {"ok": True, "file_path": body.file_path, "order_number": body.order_number}
