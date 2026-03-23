from fastapi import APIRouter, Depends, Query
from services.erp_service import ErpService
from utils.auth_middleware import get_current_user

router = APIRouter()
service = ErpService()


@router.get("/consulta")
def consulta_erp(
    query: str = Query(""),
    column: str = Query(""),
    current_user: dict = Depends(get_current_user),
):
    return service.consulta(query=query, column=column)


@router.get("/data")
def get_erp_data(current_user: dict = Depends(get_current_user)):
    return service.load_data()


@router.get("/columns/data")
def get_data_columns(current_user: dict = Depends(get_current_user)):
    return service.get_data_columns()


@router.get("/columns/consulta")
def get_consulta_columns(current_user: dict = Depends(get_current_user)):
    return service.get_consulta_columns()


@router.get("/tags")
def get_tags(
    pedido: str = Query(""),
    current_user: dict = Depends(get_current_user),
):
    return service.get_tags(pedido=pedido)
