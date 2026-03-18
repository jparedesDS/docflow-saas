from fastapi import APIRouter, UploadFile, File, Query, HTTPException
from typing import Optional, List, Dict, Any
from services.document_service import DocumentService
from services.monitoring_service import MonitoringService
from repositories.instances import data_repo, consulta_repo

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
def create_document(data: Dict[str, Any]):
    return service.create(data)


@router.put("/{doc_id}")
def update_document(doc_id: str, data: Dict[str, Any]):
    result = service.update(doc_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return result


@router.delete("/{doc_id}")
def delete_document(doc_id: str):
    if not service.delete(doc_id):
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return {"detail": "Eliminado"}


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    return await service.process_upload(file)
