"""PostgreSQL Repository — full implementation with row-level multi-tenancy.

Uses JSONB `data` column for documents/consultas/tags (preserves Excel column names).
Implements the same BaseRepository interface as ExcelRepository.
"""

from typing import List, Optional, Dict, Any

from sqlalchemy.orm import Session

from repositories.base_repository import BaseRepository


class PostgresRepository(BaseRepository):
    """Repository backed by PostgreSQL with automatic tenant_id filtering.

    For JSONB-based models (Document, Consulta, TagInspection), data is stored
    in a `data` JSONB column. get_all() returns the JSONB dicts directly,
    matching ExcelRepository's List[Dict] output.
    """

    # Known ID field candidates (same as ExcelRepository)
    _ID_CANDIDATES = ["ID", "id", "Documento", "documento", "Doc", "Codigo"]

    def __init__(self, db: Session, model, tenant_id: int):
        self.db = db
        self.model = model
        self.tenant_id = tenant_id
        self._is_jsonb = hasattr(model, "data")

    def _base_query(self):
        return self.db.query(self.model).filter(self.model.tenant_id == self.tenant_id)

    def _row_to_dict(self, row) -> Dict[str, Any]:
        if self._is_jsonb:
            result = dict(row.data) if row.data else {}
            result["_pg_id"] = row.id
            return result
        # Structured model — convert all columns to dict
        d = {}
        for col in row.__table__.columns:
            val = getattr(row, col.key)
            d[col.key] = val
        return d

    def get_all(self) -> List[Dict[str, Any]]:
        rows = self._base_query().all()
        return [self._row_to_dict(r) for r in rows]

    def get_by_id(self, doc_id: str) -> Optional[Dict[str, Any]]:
        if self._is_jsonb:
            # Search within JSONB data for ID field
            rows = self._base_query().all()
            for row in rows:
                data = row.data or {}
                for candidate in self._ID_CANDIDATES:
                    if candidate in data and str(data[candidate]) == str(doc_id):
                        result = dict(data)
                        result["_pg_id"] = row.id
                        return result
            return None
        # Structured model
        row = self._base_query().filter(self.model.id == doc_id).first()
        return self._row_to_dict(row) if row else None

    def filter(self, **kwargs) -> List[Dict[str, Any]]:
        if self._is_jsonb:
            rows = self._base_query().all()
            results = []
            for row in rows:
                data = row.data or {}
                match = True
                for key, value in kwargs.items():
                    if value is None or value == "":
                        continue
                    # Find matching key in data (case-insensitive)
                    matched_key = None
                    for dk in data:
                        if dk.lower().replace(" ", "_") == key.lower():
                            matched_key = dk
                            break
                    if not matched_key:
                        for dk in data:
                            if key.lower() in dk.lower():
                                matched_key = dk
                                break
                    if matched_key:
                        if str(value).lower() not in str(data.get(matched_key, "")).lower():
                            match = False
                            break
                    # If no matching key found, skip filter (matches ExcelRepository behavior)
                if match:
                    result = dict(data)
                    result["_pg_id"] = row.id
                    results.append(result)
            return results

        # Structured model
        query = self._base_query()
        for key, value in kwargs.items():
            if value is None or value == "":
                continue
            if hasattr(self.model, key):
                query = query.filter(
                    getattr(self.model, key).cast(String).ilike(f"%{value}%")
                )
        return [self._row_to_dict(r) for r in query.all()]

    def filter_by_column(self, column: str, value: str) -> List[Dict[str, Any]]:
        if self._is_jsonb:
            rows = self._base_query().all()
            results = []
            for row in rows:
                data = row.data or {}
                if column in data:
                    if str(value).lower() in str(data[column]).lower():
                        result = dict(data)
                        result["_pg_id"] = row.id
                        results.append(result)
            return results
        return self.filter(**{column: value})

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if self._is_jsonb:
            clean = {k: v for k, v in data.items() if k != "_pg_id"}
            row = self.model(tenant_id=self.tenant_id, data=clean)
        else:
            row = self.model(tenant_id=self.tenant_id, **data)
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self._row_to_dict(row)

    def update(self, doc_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if self._is_jsonb:
            rows = self._base_query().all()
            for row in rows:
                row_data = row.data or {}
                for candidate in self._ID_CANDIDATES:
                    if candidate in row_data and str(row_data[candidate]) == str(doc_id):
                        updated = dict(row_data)
                        for k, v in data.items():
                            if k != "_pg_id":
                                updated[k] = v
                        row.data = updated
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(row, "data")
                        self.db.commit()
                        self.db.refresh(row)
                        result = dict(row.data)
                        result["_pg_id"] = row.id
                        return result
            return None

        row = self._base_query().filter(self.model.id == doc_id).first()
        if not row:
            return None
        for key, value in data.items():
            if hasattr(row, key):
                setattr(row, key, value)
        self.db.commit()
        self.db.refresh(row)
        return self._row_to_dict(row)

    def delete(self, doc_id: str) -> bool:
        if self._is_jsonb:
            rows = self._base_query().all()
            for row in rows:
                row_data = row.data or {}
                for candidate in self._ID_CANDIDATES:
                    if candidate in row_data and str(row_data[candidate]) == str(doc_id):
                        self.db.delete(row)
                        self.db.commit()
                        return True
            return False

        row = self._base_query().filter(self.model.id == doc_id).first()
        if not row:
            return False
        self.db.delete(row)
        self.db.commit()
        return True

    def get_columns(self) -> List[str]:
        if self._is_jsonb:
            first = self._base_query().first()
            if first and first.data:
                return list(first.data.keys())
            return []
        return [col.key for col in self.model.__table__.columns]


# Import String for cast in filter()
from sqlalchemy import String  # noqa: E402
