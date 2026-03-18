"""Singleton ExcelRepository instances shared across the application."""

from repositories.excel_repository import ExcelRepository
from utils.config import DATA_ERP_PATH, CONSULTA_ERP_PATH, TAGS_PATH

data_repo = ExcelRepository(DATA_ERP_PATH)
consulta_repo = ExcelRepository(CONSULTA_ERP_PATH)
tags_repo = ExcelRepository(TAGS_PATH, skiprows=[1])
