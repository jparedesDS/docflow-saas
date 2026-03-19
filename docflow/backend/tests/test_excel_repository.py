"""Tests for ExcelRepository with temporary Excel files."""

import os
import sys
import pytest
import pandas as pd
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture()
def temp_excel(tmp_path):
    """Create a temporary Excel file with sample data."""
    filepath = tmp_path / "test_data.xlsx"
    df = pd.DataFrame({
        "Nº Pedido": ["P-24/001", "P-24/002", "P-24/003"],
        "Estado": ["En revisión", "Aprobado", ""],
        "Repsonsable": ["JP", "AC", "JM"],
    })
    df.to_excel(filepath, index=False)
    return filepath


class TestExcelRepository:
    """Tests for ExcelRepository CRUD operations."""

    def test_load_excel(self, temp_excel):
        """Load an Excel file and verify data."""
        from repositories.excel_repository import ExcelRepository
        repo = ExcelRepository(str(temp_excel))
        records = repo.get_all()
        assert len(records) == 3
        assert "Nº Pedido" in repo.get_columns()

    def test_filter_by_column(self, temp_excel):
        """Filter DataFrame by column value."""
        from repositories.excel_repository import ExcelRepository
        repo = ExcelRepository(str(temp_excel))
        filtered = repo.filter_by_column("Repsonsable", "JP")
        assert len(filtered) == 1
        assert filtered[0]["Nº Pedido"] == "P-24/001"

    def test_empty_estado_is_pending(self, temp_excel):
        """Empty Estado should be treated as pending."""
        from repositories.excel_repository import ExcelRepository
        repo = ExcelRepository(str(temp_excel))
        records = repo.get_all()
        pending = [r for r in records if r["Estado"] == ""]
        assert len(pending) == 1
        assert pending[0]["Nº Pedido"] == "P-24/003"

    def test_nonexistent_file(self, tmp_path):
        """Repository with nonexistent file should handle gracefully."""
        from repositories.excel_repository import ExcelRepository
        filepath = str(tmp_path / "nonexistent.xlsx")
        repo = ExcelRepository(filepath)
        records = repo.get_all()
        assert records is None or len(records) == 0
