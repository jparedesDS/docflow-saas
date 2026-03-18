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
