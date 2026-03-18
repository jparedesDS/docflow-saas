import pandas as pd
import os
import time
from typing import List, Optional, Dict, Any
from repositories.base_repository import BaseRepository


class ExcelRepository(BaseRepository):
    """Repositorio que lee/escribe datos desde un archivo Excel con caché TTL."""

    CACHE_TTL = 60  # segundos

    def __init__(self, file_path: str, sheet_name: str = 0, skiprows=None):
        self.file_path = file_path
        self.sheet_name = sheet_name
        self.skiprows = skiprows
        self._df = None
        self._cache_time = 0

    def _load(self) -> pd.DataFrame:
        now = time.time()
        if self._df is not None and (now - self._cache_time) < self.CACHE_TTL:
            return self._df
        if not os.path.exists(self.file_path):
            return pd.DataFrame()
        self._df = pd.read_excel(self.file_path, sheet_name=self.sheet_name, engine="openpyxl", skiprows=self.skiprows)
        self._cache_time = now
        return self._df

    def _invalidate_cache(self):
        self._cache_time = 0

    def _save(self):
        if self._df is not None:
            self._df.to_excel(self.file_path, index=False, engine="openpyxl")
            self._invalidate_cache()

    def get_all(self) -> List[Dict[str, Any]]:
        df = self._load()
        if df.empty:
            return []
        return df.fillna("").to_dict(orient="records")

    def get_by_id(self, doc_id: str) -> Optional[Dict[str, Any]]:
        df = self._load()
        if df.empty:
            return None
        id_col = self._get_id_column(df)
        match = df[df[id_col].astype(str) == str(doc_id)]
        if match.empty:
            return None
        return match.iloc[0].to_dict()

    def filter(self, **kwargs) -> List[Dict[str, Any]]:
        df = self._load()
        if df.empty:
            return []
        for key, value in kwargs.items():
            if value is None or value == "":
                continue
            matching_cols = [c for c in df.columns if c.lower().replace(" ", "_") == key.lower()]
            if not matching_cols:
                matching_cols = [c for c in df.columns if key.lower() in c.lower()]
            if matching_cols:
                col = matching_cols[0]
                df = df[df[col].astype(str).str.contains(str(value), case=False, na=False)]
        return df.fillna("").to_dict(orient="records")

    def filter_by_column(self, column: str, value: str) -> List[Dict[str, Any]]:
        df = self._load()
        if df.empty or column not in df.columns:
            return []
        df = df[df[column].astype(str).str.contains(str(value), case=False, na=False)]
        return df.fillna("").to_dict(orient="records")

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        df = self._load()
        new_row = pd.DataFrame([data])
        self._df = pd.concat([df, new_row], ignore_index=True)
        self._save()
        return data

    def update(self, doc_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        df = self._load()
        if df.empty:
            return None
        id_col = self._get_id_column(df)
        mask = df[id_col].astype(str) == str(doc_id)
        if not mask.any():
            return None
        for key, value in data.items():
            if key in df.columns:
                df.loc[mask, key] = value
        self._df = df
        self._save()
        return df[mask].iloc[0].to_dict()

    def delete(self, doc_id: str) -> bool:
        df = self._load()
        if df.empty:
            return False
        id_col = self._get_id_column(df)
        mask = df[id_col].astype(str) == str(doc_id)
        if not mask.any():
            return False
        self._df = df[~mask]
        self._save()
        return True

    def get_columns(self) -> List[str]:
        df = self._load()
        return list(df.columns)

    def _get_id_column(self, df: pd.DataFrame) -> str:
        for candidate in ["ID", "id", "Documento", "documento", "Doc", "Codigo"]:
            if candidate in df.columns:
                return candidate
        return df.columns[0]
