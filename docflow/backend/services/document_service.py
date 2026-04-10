from typing import List, Optional, Dict, Any
from fastapi import UploadFile
from repositories.base_repository import BaseRepository


class DocumentService:
    def __init__(self, repo: BaseRepository):
        self.repo = repo

    def list_all(self) -> List[Dict[str, Any]]:
        return self.repo.get_all()

    def get_by_id(self, doc_id: str) -> Optional[Dict[str, Any]]:
        return self.repo.get_by_id(doc_id)

    def filter_documents(
        self,
        estado: Optional[str] = None,
        cliente: Optional[str] = None,
        responsable: Optional[str] = None,
        query: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        filters = {}
        if estado:
            filters["estado"] = estado
        if cliente:
            filters["cliente"] = cliente
        if responsable:
            filters["responsable"] = responsable
        if query:
            # Búsqueda general: filtrar por cualquier campo que contenga el texto
            all_docs = self.repo.get_all()
            results = []
            for doc in all_docs:
                for val in doc.values():
                    if query.lower() in str(val).lower():
                        results.append(doc)
                        break
            return results
        return self.repo.filter(**filters)

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.repo.create(data)

    def update(self, doc_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return self.repo.update(doc_id, data)

    def delete(self, doc_id: str) -> bool:
        return self.repo.delete(doc_id)

    async def process_upload(self, file: UploadFile) -> dict:
        content = await file.read()
        return {"filename": file.filename, "size": len(content), "status": "uploaded"}

    def list_paginated(self, page: int, page_size: int) -> dict:
        """Return paginated document list."""
        return self.repo.get_paginated(page=page, page_size=page_size)

    def get_columns(self) -> List[str]:
        return self.repo.get_columns()
