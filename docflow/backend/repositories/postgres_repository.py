"""
PostgreSQL Repository - Implementación futura.

Para migrar de Excel a PostgreSQL:

1. Instalar dependencias:
   pip install sqlalchemy psycopg2-binary alembic

2. Crear modelos SQLAlchemy en models/db_models.py

3. Configurar conexión en utils/config.py:
   DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost/docflow")

4. Implementar esta clase siguiendo la misma interfaz que ExcelRepository

5. Cambiar la inyección en los routers:
   ANTES:  repo = ExcelRepository(DATA_ERP_PATH)
   DESPUES: repo = PostgresRepository(db_session)

6. Los services y routers NO cambian.

7. Para multiempresa, añadir campo empresa_id a todas las tablas
   y filtrar siempre por empresa del usuario autenticado.
"""

# from typing import List, Optional, Dict, Any
# from sqlalchemy.orm import Session
# from repositories.base_repository import BaseRepository
#
#
# class PostgresRepository(BaseRepository):
#     def __init__(self, db: Session, model):
#         self.db = db
#         self.model = model
#
#     def get_all(self) -> List[Dict[str, Any]]:
#         rows = self.db.query(self.model).all()
#         return [row.__dict__ for row in rows]
#
#     def get_by_id(self, doc_id: str) -> Optional[Dict[str, Any]]:
#         row = self.db.query(self.model).filter(self.model.id == doc_id).first()
#         return row.__dict__ if row else None
#
#     def filter(self, **kwargs) -> List[Dict[str, Any]]:
#         query = self.db.query(self.model)
#         for key, value in kwargs.items():
#             if value and hasattr(self.model, key):
#                 query = query.filter(getattr(self.model, key).ilike(f"%{value}%"))
#         return [row.__dict__ for row in query.all()]
#
#     def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
#         row = self.model(**data)
#         self.db.add(row)
#         self.db.commit()
#         self.db.refresh(row)
#         return row.__dict__
#
#     def update(self, doc_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
#         row = self.db.query(self.model).filter(self.model.id == doc_id).first()
#         if not row:
#             return None
#         for key, value in data.items():
#             setattr(row, key, value)
#         self.db.commit()
#         return row.__dict__
#
#     def delete(self, doc_id: str) -> bool:
#         row = self.db.query(self.model).filter(self.model.id == doc_id).first()
#         if not row:
#             return False
#         self.db.delete(row)
#         self.db.commit()
#         return True
