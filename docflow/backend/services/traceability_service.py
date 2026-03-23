"""Material Traceability service — matrix of materials × document types with coverage."""

import os
from collections import defaultdict

# Required document types per material for audit compliance
REQUIRED_DOC_TYPES = [
    "ITP",
    "Test Certificate",
    "Data Sheet",
    "Drawing",
    "Calculation",
    "Manual",
]


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


def get_matrix(tenant_id: int, pedido: str) -> dict:
    """Build a traceability matrix: materials × document types.

    If documents have a Material column populated, returns mode="material"
    with the full matrix. Otherwise falls back to mode="doctype_summary"
    grouping by document type.
    """
    docs = _get_docs_for_pedido(tenant_id, pedido)

    if not docs:
        return {
            "pedido": pedido,
            "mode": "empty",
            "materials": [],
            "doc_types": REQUIRED_DOC_TYPES,
            "matrix": {},
            "coverage": {},
            "overall_coverage": 0,
        }

    has_materials = any(doc.get("Material", "").strip() for doc in docs)

    if has_materials:
        return _build_material_matrix(docs, pedido)
    else:
        return _build_doctype_summary(docs, pedido)


def _build_material_matrix(docs: list, pedido: str) -> dict:
    """Original matrix logic: materials × document types."""
    matrix = defaultdict(lambda: defaultdict(list))
    materials_set = set()
    doc_types_set = set(REQUIRED_DOC_TYPES)

    for doc in docs:
        material = doc.get("Material", "").strip()
        tipo_doc = doc.get("Tipo Doc.", "").strip()
        doc_ref = doc.get("Nº Doc. EIPSA", "")

        if not material:
            continue

        materials_set.add(material)
        if tipo_doc:
            doc_types_set.add(tipo_doc)
            matrix[material][tipo_doc].append({
                "doc_ref": doc_ref,
                "estado": doc.get("Estado", ""),
                "titulo": doc.get("Título", doc.get("Titulo", "")),
            })

    materials = sorted(materials_set)
    doc_types = sorted(doc_types_set)

    coverage = {}
    total_covered = 0
    total_required = 0

    for mat in materials:
        mat_docs = matrix.get(mat, {})
        required = len(REQUIRED_DOC_TYPES)
        covered = sum(1 for dt in REQUIRED_DOC_TYPES if mat_docs.get(dt))
        coverage[mat] = {
            "total_required": required,
            "covered": covered,
            "pct": round(covered / required * 100, 1) if required > 0 else 0,
        }
        total_covered += covered
        total_required += required

    overall = round(total_covered / total_required * 100, 1) if total_required > 0 else 0

    matrix_dict = {}
    for mat in materials:
        matrix_dict[mat] = {}
        for dt in doc_types:
            matrix_dict[mat][dt] = matrix[mat].get(dt, [])

    return {
        "pedido": pedido,
        "mode": "material",
        "materials": materials,
        "doc_types": doc_types,
        "matrix": matrix_dict,
        "coverage": coverage,
        "overall_coverage": overall,
    }


APPROVED_STATES = {"aprobado", "approved", "aprobado con comentarios"}


def _build_doctype_summary(docs: list, pedido: str) -> dict:
    """Fallback when Material column is empty: group by document type."""
    type_stats = defaultdict(lambda: {"total": 0, "aprobados": 0, "enviados": 0, "pendientes": 0})

    for doc in docs:
        tipo = doc.get("Tipo Doc.", "").strip()
        if not tipo:
            tipo = "Sin tipo"
        estado = doc.get("Estado", "").strip().lower()

        type_stats[tipo]["total"] += 1
        if estado in APPROVED_STATES:
            type_stats[tipo]["aprobados"] += 1
        elif estado == "enviado":
            type_stats[tipo]["enviados"] += 1
        else:
            type_stats[tipo]["pendientes"] += 1

    total_docs = sum(s["total"] for s in type_stats.values())
    total_approved = sum(s["aprobados"] for s in type_stats.values())
    overall = round(total_approved / total_docs * 100, 1) if total_docs > 0 else 0

    return {
        "pedido": pedido,
        "mode": "doctype_summary",
        "materials": [],
        "doc_types": sorted(type_stats.keys()),
        "matrix": {},
        "coverage": {},
        "overall_coverage": overall,
        "type_stats": dict(type_stats),
        "total_docs": total_docs,
        "total_approved": total_approved,
    }


def _get_docs_for_pedido(tenant_id: int, pedido: str) -> list:
    """Get all documents for a given pedido."""
    if os.getenv("STORAGE_BACKEND", "excel") != "postgres":
        try:
            import pandas as pd
            from repositories.instances import data_repo
            records = data_repo.get_all()
            if isinstance(records, pd.DataFrame):
                df = records
            else:
                if not records:
                    return []
                df = pd.DataFrame(records)
            if df.empty:
                return []
            if "Nº Pedido" not in df.columns:
                return []
            filtered = df[df["Nº Pedido"].astype(str).str.strip() == pedido.strip()]
            return filtered.to_dict("records")
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Error loading traceability data: %s", e)
            return []

    from db.models import Document
    session = _get_session()
    try:
        rows = session.query(Document).filter(
            Document.tenant_id == tenant_id,
            Document.data["Nº Pedido"].astext == pedido.strip(),
        ).all()
        return [row.data for row in rows]
    finally:
        session.close()
