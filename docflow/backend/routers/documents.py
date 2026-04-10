import structlog
from fastapi import APIRouter, UploadFile, File, Query, HTTPException, Depends
from typing import Optional, List, Dict, Any
from services.document_service import DocumentService
from services.monitoring_service import MonitoringService
from repositories.instances import data_repo, consulta_repo
from utils.auth_middleware import get_current_user, require_scope, SCOPE_WRITE
from models.document import (
    DocumentCreate as DocumentCreateSchema,
    DocumentUpdate as DocumentUpdateSchema,
)

logger = structlog.get_logger("docflow.routers.documents")

router = APIRouter()

service = DocumentService(data_repo)
monitoring_service = MonitoringService(data_repo, consulta_repo)


@router.get("/monitoring")
def get_monitoring(
    pedido: Optional[str] = Query(None),
    cliente: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    responsable: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=200),
):
    """Vista monitoring: merge data_erp + consulta_erp con columnas calculadas."""
    data = monitoring_service.get_monitoring_data(
        pedido=pedido, cliente=cliente, estado=estado, responsable=responsable, query=q
    )
    if page is not None:
        ps = page_size or 50
        total = len(data)
        pages = max(1, (total + ps - 1) // ps)
        start = (page - 1) * ps
        return {"items": data[start:start + ps], "total": total, "page": page, "page_size": ps, "pages": pages}
    return data


@router.get("/monitoring/status-global")
def get_status_global():
    """Vista Status Global: resumen por pedido con % de avance."""
    return monitoring_service.get_status_global()


@router.get("/monitoring/columns")
def get_monitoring_columns():
    """Columnas de la vista monitoring en orden."""
    return monitoring_service.get_monitoring_columns()


@router.get("/")
def list_documents(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=200),
):
    if page is not None:
        return service.list_paginated(page, page_size or 50)
    return service.list_all()


@router.get("/columns")
def get_columns():
    return service.get_columns()


@router.get("/search")
def search_documents(
    estado: Optional[str] = Query(None),
    cliente: Optional[str] = Query(None),
    responsable: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
):
    return service.filter_documents(
        estado=estado, cliente=cliente, responsable=responsable, query=q
    )


@router.get("/{doc_id}")
def get_document(doc_id: str):
    doc = service.get_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return doc


def _create_side_effects(result: dict, current_user: dict):
    """Audit log + workflow trigger after document creation."""
    tenant_id = current_user.get("tenant_id", 1)
    doc_id = result.get("Nº Doc. EIPSA", "") if isinstance(result, dict) else ""
    from services.audit_service import log_change
    log_change(
        tenant_id=tenant_id,
        entity_type="document",
        entity_id=doc_id,
        action="created",
        user_initials=current_user.get("initials", ""),
        user_name=current_user.get("username", ""),
    )
    from services.workflow_engine import on_event
    on_event(tenant_id, "document_received", {"document_ref": doc_id, "document": result})


@router.post("/validated", status_code=201)
def create_document_validated(
    body: DocumentCreateSchema,
    current_user: dict = Depends(require_scope(SCOPE_WRITE)),
):
    """Create a document with strict Pydantic schema validation."""
    data = body.model_dump(by_alias=True, exclude_none=True)
    result = service.create(data)
    try:
        _create_side_effects(result, current_user)
    except Exception as exc:
        logger.warning("create_document_side_effects_failed", error=str(exc))
    return result


@router.post("/")
def create_document(data: Dict[str, Any], current_user: dict = Depends(require_scope(SCOPE_WRITE))):
    if not data.get("Nº Doc. EIPSA") and not data.get("doc_eipsa"):
        raise HTTPException(status_code=422, detail="Nº Doc. EIPSA is required")
    if not data.get("Título") and not data.get("titulo"):
        raise HTTPException(status_code=422, detail="Título is required")
    result = service.create(data)
    try:
        _create_side_effects(result, current_user)
    except Exception as exc:
        logger.warning("create_document_side_effects_failed", error=str(exc))
    return result


@router.put("/{doc_id}")
def update_document(doc_id: str, data: Dict[str, Any], current_user: dict = Depends(require_scope(SCOPE_WRITE))):
    # Get old data for audit trail
    old_doc = service.get_by_id(doc_id)
    result = service.update(doc_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    # Audit trail + workflow engine trigger
    try:
        from services.audit_service import log_entity_changes
        tenant_id = current_user.get("tenant_id", 1)
        log_entity_changes(
            tenant_id=tenant_id,
            entity_type="document",
            entity_id=doc_id,
            old_data=old_doc or {},
            new_data=result,
            user_initials=current_user.get("initials", ""),
            user_name=current_user.get("username", ""),
        )
        # Trigger workflow engine on status change
        old_status = (old_doc or {}).get("Estado", "")
        new_status = result.get("Estado", "")
        if old_status != new_status and new_status:
            from services.workflow_engine import on_event
            on_event(tenant_id, "status_changed", {
                "document_ref": doc_id,
                "old_status": old_status,
                "new_status": new_status,
                "document": result,
            })
        # Dispatch webhooks
        from services.webhook_service import dispatch_event
        dispatch_event(tenant_id, "document_updated", {
            "document_ref": doc_id,
            "changes": data,
        })
    except Exception as exc:
        logger.warning("update_document_side_effects_failed", doc_id=doc_id, error=str(exc))

    return result


@router.post("/batch")
def batch_action(body: Dict[str, Any], current_user: dict = Depends(require_scope(SCOPE_WRITE))):
    """Batch operations on multiple documents."""
    doc_ids = body.get("doc_ids", [])
    action = body.get("action", "")
    payload = body.get("payload", {})

    if not doc_ids or not action:
        raise HTTPException(status_code=400, detail="doc_ids and action are required")

    tenant_id = current_user.get("tenant_id", 1)
    results = {"success": 0, "failed": 0, "errors": []}

    for doc_id in doc_ids:
        try:
            if action == "update_status":
                new_status = payload.get("status", "")
                if new_status:
                    old_doc = service.get_by_id(doc_id)
                    result = service.update(doc_id, {"Estado": new_status})
                    if result:
                        results["success"] += 1
                        try:
                            from services.audit_service import log_change
                            log_change(
                                tenant_id=tenant_id,
                                entity_type="document",
                                entity_id=doc_id,
                                action="batch_status_change",
                                field_name="Estado",
                                old_value=(old_doc or {}).get("Estado", ""),
                                new_value=new_status,
                                user_initials=current_user.get("initials", ""),
                                user_name=current_user.get("username", ""),
                            )
                        except Exception as exc:
                            logger.warning("batch_audit_log_failed", doc_id=doc_id, error=str(exc))
                    else:
                        results["failed"] += 1
            elif action == "assign_responsible":
                responsible = payload.get("responsible", "")
                if responsible:
                    result = service.update(doc_id, {"Repsonsable": responsible})
                    if result:
                        results["success"] += 1
                    else:
                        results["failed"] += 1
            elif action == "export":
                results["success"] += 1  # Export handled client-side
            else:
                results["errors"].append(f"Unknown action: {action}")
                break
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"{doc_id}: {str(e)}")

    return results


@router.delete("/{doc_id}")
def delete_document(doc_id: str, current_user: dict = Depends(require_scope(SCOPE_WRITE))):
    if not service.delete(doc_id):
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return {"detail": "Eliminado"}


from utils.upload_config import MAX_UPLOAD_SIZE, ALLOWED_MIME_TYPES


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_scope(SCOPE_WRITE)),
):
    # ── Validate MIME type before reading body ────────────────────
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"File type not allowed: {file.content_type}",
        )

    # ── Read and validate size ────────────────────────────────────
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large — max {MAX_UPLOAD_SIZE // (1024 * 1024)} MB",
        )

    return {"filename": file.filename, "size": len(content), "status": "uploaded"}


@router.post("/cache/invalidate")
def invalidate_cache(current_user: dict = Depends(require_scope(SCOPE_WRITE))):
    """Invalidate all document-related caches (admin only)."""
    if current_user.get("role") not in ("admin", "superadmin", "dc"):
        raise HTTPException(status_code=403, detail="Admin access required")
    from utils.cache import invalidate_all
    invalidate_all()
    return {"detail": "Cache invalidated"}
