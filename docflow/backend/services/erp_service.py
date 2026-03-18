from repositories.instances import data_repo as _data_repo, consulta_repo as _consulta_repo, tags_repo as _tags_repo
from typing import List, Dict, Any


class ErpService:
    def __init__(self, data_path: str = "", consulta_path: str = "", tags_path: str = ""):
        self.data_repo = _data_repo
        self.consulta_repo = _consulta_repo
        self.tags_repo = _tags_repo

    def load_data(self) -> List[Dict[str, Any]]:
        return self.data_repo.get_all()

    def consulta(self, query: str = "", column: str = "") -> List[Dict[str, Any]]:
        if not query:
            return self.consulta_repo.get_all()
        if column:
            return self.consulta_repo.filter_by_column(column=column, value=query)
        return self.consulta_repo.filter(query=query)

    def get_data_columns(self) -> List[str]:
        return self.data_repo.get_columns()

    def get_consulta_columns(self) -> List[str]:
        return self.consulta_repo.get_columns()

    def get_tags(self, pedido: str = "") -> List[Dict[str, Any]]:
        if not self.tags_repo:
            return []
        if not pedido:
            return self.tags_repo.get_all()
        return self.tags_repo.filter_by_column(column="Nº Pedido", value=pedido)
