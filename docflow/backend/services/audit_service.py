"""Audit trail service — logs entity changes for compliance."""

import os
from datetime import datetime, timezone
from typing import Optional


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


def log_change(
    tenant_id: int,
    entity_type: str,
    entity_id: str,
    action: str,
    user_initials: str = "",
    user_name: str = "",
    field_name: str = None,
    old_value: str = None,
    new_value: str = None,
    metadata: dict = None,
):
    """Log a single change to an entity."""
    if os.getenv("STORAGE_BACKEND", "excel") != "postgres":
        return  # No audit in Excel mode
    from db.models import AuditLog
    session = _get_session()
    try:
        log = AuditLog(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=str(entity_id),
            action=action,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            user_initials=user_initials,
            user_name=user_name,
            metadata_=metadata or {},
        )
        session.add(log)
        session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()


def log_entity_changes(
    tenant_id: int,
    entity_type: str,
    entity_id: str,
    old_data: dict,
    new_data: dict,
    user_initials: str = "",
    user_name: str = "",
):
    """Compare old_data and new_data dicts and log each changed field."""
    all_keys = set(list(old_data.keys()) + list(new_data.keys()))
    for key in all_keys:
        old_val = old_data.get(key)
        new_val = new_data.get(key)
        if str(old_val) != str(new_val):
            log_change(
                tenant_id=tenant_id,
                entity_type=entity_type,
                entity_id=entity_id,
                action="updated",
                field_name=key,
                old_value=old_val,
                new_value=new_val,
                user_initials=user_initials,
                user_name=user_name,
            )


def get_entity_log(
    tenant_id: int,
    entity_type: str,
    entity_id: str,
    limit: int = 50,
) -> list:
    """Get audit log for a specific entity."""
    if os.getenv("STORAGE_BACKEND", "excel") != "postgres":
        return []
    from db.models import AuditLog
    session = _get_session()
    try:
        logs = session.query(AuditLog).filter(
            AuditLog.tenant_id == tenant_id,
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == str(entity_id),
        ).order_by(AuditLog.created_at.desc()).limit(limit).all()
        return [_log_to_dict(l) for l in logs]
    finally:
        session.close()


def get_recent_activity(
    tenant_id: int,
    limit: int = 50,
    entity_type: Optional[str] = None,
    user_initials: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> list:
    """Get recent audit activity for a tenant with optional filters."""
    if os.getenv("STORAGE_BACKEND", "excel") != "postgres":
        return []
    from db.models import AuditLog
    session = _get_session()
    try:
        query = session.query(AuditLog).filter(AuditLog.tenant_id == tenant_id)
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        if user_initials:
            query = query.filter(AuditLog.user_initials == user_initials)
        if date_from:
            query = query.filter(AuditLog.created_at >= date_from)
        if date_to:
            query = query.filter(AuditLog.created_at <= date_to)
        logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
        return [_log_to_dict(l) for l in logs]
    finally:
        session.close()


def _log_to_dict(log) -> dict:
    return {
        "id": log.id,
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "action": log.action,
        "field_name": log.field_name,
        "old_value": log.old_value,
        "new_value": log.new_value,
        "user_initials": log.user_initials,
        "user_name": log.user_name,
        "metadata": log.metadata_,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }
