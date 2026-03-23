"""Document classification service — manage sensitivity labels for documents."""

import os
from typing import Optional

from services.audit_service import log_change


CLASSIFICATION_LEVELS = {
    "public": 0,
    "internal": 1,
    "confidential": 2,
    "restricted": 3,
}


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


def get_classification(tenant_id: int, document_ref: str) -> str:
    """Get the classification level for a document. Defaults to 'internal'."""
    if os.getenv("STORAGE_BACKEND", "excel") != "postgres":
        return "internal"

    from db.models import Document
    session = _get_session()
    try:
        doc = session.query(Document).filter(
            Document.tenant_id == tenant_id,
        ).filter(
            Document.data["Nº Doc. EIPSA"].astext == document_ref,
        ).first()

        if not doc:
            return "internal"

        data = doc.data or {}
        return data.get("_classification", "internal")
    finally:
        session.close()


def set_classification(
    tenant_id: int,
    document_ref: str,
    level: str,
    user_initials: str = "",
) -> bool:
    """Set the classification level for a document.

    Validates level against CLASSIFICATION_LEVELS. Logs the change via audit_service.
    """
    if level not in CLASSIFICATION_LEVELS:
        raise ValueError(
            f"Invalid classification level '{level}'. "
            f"Must be one of: {', '.join(CLASSIFICATION_LEVELS.keys())}"
        )

    if os.getenv("STORAGE_BACKEND", "excel") != "postgres":
        return False

    from db.models import Document
    from sqlalchemy.orm.attributes import flag_modified

    session = _get_session()
    try:
        doc = session.query(Document).filter(
            Document.tenant_id == tenant_id,
        ).filter(
            Document.data["Nº Doc. EIPSA"].astext == document_ref,
        ).first()

        if not doc:
            return False

        data = dict(doc.data or {})
        old_level = data.get("_classification", "internal")

        if old_level == level:
            return True  # No change needed

        data["_classification"] = level
        doc.data = data
        flag_modified(doc, "data")
        session.commit()

        # Log the classification change
        log_change(
            tenant_id=tenant_id,
            entity_type="document",
            entity_id=document_ref,
            action="classification_changed",
            field_name="_classification",
            old_value=old_level,
            new_value=level,
            user_initials=user_initials,
        )

        return True
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
