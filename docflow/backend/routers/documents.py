from fastapi import APIRouter, UploadFile, File, Query, HTTPException, Depends
from typing import Optional, List, Dict, Any
from services.document_service import DocumentService
from services.monitoring_service import MonitoringService
from repositories.instances import data_repo, consulta_repo
from utils.auth_middleware import get_current_user, require_scope, SCOPE_WRITE

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
):
    """Vista monitoring: merge data_erp + consulta_erp con columnas calculadas."""
    return monitoring_service.get_monitoring_data(
        pedido=pedido, cliente=cliente, estado=estado, responsable=responsable, query=q
    )


@router.get("/monitoring/status-global")
def get_status_global():
    """Vista Status Global: resumen por pedido con % de avance."""
    return monitoring_service.get_status_global()


@router.get("/monitoring/columns")
def get_monitoring_columns():
    """Columnas de la vista monitoring en orden."""
    return monitoring_service.get_monitoring_columns()


@router.get("/", response_model=List[Dict[str, Any]])
def list_documents():
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


@router.post("/")
def create_document(data: Dict[str, Any], current_user: dict = Depends(require_scope(SCOPE_WRITE))):
    result = service.create(data)
    try:
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
    except Exception:
        pass
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
    except Exception:
        pass  # Non-critical — don't fail the update

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
                        except Exception:
                            pass
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


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    return await service.process_upload(file)
