from fastapi import APIRouter, Query
from services.erp_service import ErpService

router = APIRouter()
service = ErpService()


@router.get("/consulta")
def consulta_erp(query: str = Query(""), column: str = Query("")):
    return service.consulta(query=query, column=column)


@router.get("/data")
def get_erp_data():
    return service.load_data()


@router.get("/columns/data")
def get_data_columns():
    return service.get_data_columns()


@router.get("/columns/consulta")
def get_consulta_columns():
    return service.get_consulta_columns()


@router.get("/tags")
def get_tags(pedido: str = Query("")):
    return service.get_tags(pedido=pedido)
