"""File storage service — local filesystem storage with DB metadata tracking."""

import os
from datetime import datetime, timezone
from typing import Optional


UPLOAD_BASE_DIR = os.getenv("UPLOAD_DIR", "uploads")


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


def upload(
    tenant_id: int,
    document_ref: str,
    filename: str,
    content_bytes: bytes,
    content_type: str = "application/octet-stream",
    uploaded_by: str = "",
) -> dict:
    """Upload a file to local storage and record metadata in DB.

    Storage path: uploads/{tenant_id}/{document_ref}/{filename}
    """
    from db.models import DocumentAttachment

    # Build storage directory and path
    storage_dir = os.path.join(UPLOAD_BASE_DIR, str(tenant_id), document_ref)
    os.makedirs(storage_dir, exist_ok=True)
    storage_path = os.path.join(storage_dir, filename)

    # Write file to disk
    with open(storage_path, "wb") as f:
        f.write(content_bytes)

    # Record metadata in DB
    session = _get_session()
    try:
        attachment = DocumentAttachment(
            tenant_id=tenant_id,
            document_ref=document_ref,
            filename=filename,
            content_type=content_type,
            size_bytes=len(content_bytes),
            storage_path=storage_path,
            uploaded_by=uploaded_by,
        )
        session.add(attachment)
        session.commit()
        session.refresh(attachment)
        return _attachment_to_dict(attachment)
    except Exception:
        session.rollback()
        # Clean up file on DB failure
        if os.path.exists(storage_path):
            os.remove(storage_path)
        raise
    finally:
        session.close()


def download(tenant_id: int, document_ref: str, filename: str) -> Optional[bytes]:
    """Download a file by reading it from the local filesystem.

    Returns bytes or None if not found.
    """
    from db.models import DocumentAttachment
    session = _get_session()
    try:
        attachment = session.query(DocumentAttachment).filter(
            DocumentAttachment.tenant_id == tenant_id,
            DocumentAttachment.document_ref == document_ref,
            DocumentAttachment.filename == filename,
        ).first()
        if not attachment:
            return None
        if not os.path.exists(attachment.storage_path):
            return None
        with open(attachment.storage_path, "rb") as f:
            return f.read()
    finally:
        session.close()


def list_files(tenant_id: int, document_ref: str) -> list:
    """List all attachments for a document."""
    from db.models import DocumentAttachment
    session = _get_session()
    try:
        attachments = session.query(DocumentAttachment).filter(
            DocumentAttachment.tenant_id == tenant_id,
            DocumentAttachment.document_ref == document_ref,
        ).order_by(DocumentAttachment.created_at.desc()).all()
        return [_attachment_to_dict(a) for a in attachments]
    finally:
        session.close()


def delete_file(tenant_id: int, attachment_id: int) -> bool:
    """Delete an attachment record and its file from disk."""
    from db.models import DocumentAttachment
    session = _get_session()
    try:
        attachment = session.query(DocumentAttachment).filter(
            DocumentAttachment.id == attachment_id,
            DocumentAttachment.tenant_id == tenant_id,
        ).first()
        if not attachment:
            return False

        # Remove file from disk
        if os.path.exists(attachment.storage_path):
            os.remove(attachment.storage_path)

        session.delete(attachment)
        session.commit()
        return True
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _attachment_to_dict(a) -> dict:
    return {
        "id": a.id,
        "document_ref": a.document_ref,
        "filename": a.filename,
        "content_type": a.content_type,
        "size_bytes": a.size_bytes,
        "storage_path": a.storage_path,
        "uploaded_by": a.uploaded_by,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }
