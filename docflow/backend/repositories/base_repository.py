from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any


class BaseRepository(ABC):
    """Interfaz abstracta de repositorio. Implementar con Excel o PostgreSQL."""

    @abstractmethod
    def get_all(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_by_id(self, doc_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def filter(self, **kwargs) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        pass

    @abstractmethod
    def update(self, doc_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def delete(self, doc_id: str) -> bool:
        pass

    def get_paginated(self, page: int = 1, page_size: int = 50, **filters) -> dict:
        """Get paginated results. Default implementation uses get_all + slicing."""
        all_items = self.filter(**filters) if filters else self.get_all()
        total = len(all_items)
        pages = max(1, (total + page_size - 1) // page_size)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "items": all_items[start:end],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": pages,
        }
