"""Document comments service — tenant-aware CRUD with thread support."""

import os
from datetime import datetime, timezone
from typing import Optional


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


def list_comments(tenant_id: int, document_ref: str) -> list:
    """Return flat list of comments for a document ordered by created_at."""
    from db.models import DocumentComment
    session = _get_session()
    try:
        comments = session.query(DocumentComment).filter(
            DocumentComment.tenant_id == tenant_id,
            DocumentComment.document_ref == document_ref,
        ).order_by(DocumentComment.created_at.asc()).all()
        return [_comment_to_dict(c) for c in comments]
    finally:
        session.close()


def create_comment(
    tenant_id: int,
    document_ref: str,
    user_initials: str,
    user_name: str,
    content: str,
    mentions: list = None,
    parent_id: int = None,
) -> dict:
    """Create a new comment or reply (if parent_id is provided)."""
    from db.models import DocumentComment
    session = _get_session()
    try:
        comment = DocumentComment(
            tenant_id=tenant_id,
            document_ref=document_ref,
            user_initials=user_initials,
            user_name=user_name,
            content=content,
            mentions=mentions or [],
            parent_id=parent_id,
        )
        session.add(comment)
        session.commit()
        session.refresh(comment)
        return _comment_to_dict(comment)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def delete_comment(tenant_id: int, comment_id: int) -> bool:
    """Delete a comment by id (cascades to replies)."""
    from db.models import DocumentComment
    session = _get_session()
    try:
        comment = session.query(DocumentComment).filter(
            DocumentComment.id == comment_id,
            DocumentComment.tenant_id == tenant_id,
        ).first()
        if not comment:
            return False
        session.delete(comment)
        session.commit()
        return True
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_comment_count(tenant_id: int, document_ref: str) -> int:
    """Return the total number of comments for a document."""
    from db.models import DocumentComment
    session = _get_session()
    try:
        return session.query(DocumentComment).filter(
            DocumentComment.tenant_id == tenant_id,
            DocumentComment.document_ref == document_ref,
        ).count()
    finally:
        session.close()


def _comment_to_dict(c) -> dict:
    return {
        "id": c.id,
        "document_ref": c.document_ref,
        "parent_id": c.parent_id,
        "user_initials": c.user_initials,
        "user_name": c.user_name,
        "content": c.content,
        "mentions": c.mentions or [],
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }
