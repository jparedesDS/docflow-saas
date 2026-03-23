"""Saved filters service — tenant-aware CRUD for user filter presets."""

import os
from datetime import datetime, timezone
from typing import Optional


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


def list_filters(
    tenant_id: int,
    user_initials: str,
    entity_type: str = "document",
) -> list:
    """List all saved filters for a user within a tenant."""
    from db.models import SavedFilter
    session = _get_session()
    try:
        filters = session.query(SavedFilter).filter(
            SavedFilter.tenant_id == tenant_id,
            SavedFilter.user_initials == user_initials,
            SavedFilter.entity_type == entity_type,
        ).order_by(SavedFilter.created_at.desc()).all()
        return [_filter_to_dict(f) for f in filters]
    finally:
        session.close()


def create_filter(
    tenant_id: int,
    user_initials: str,
    name: str,
    entity_type: str,
    filters: dict,
    sort_config: dict = None,
) -> dict:
    """Create a new saved filter."""
    from db.models import SavedFilter
    session = _get_session()
    try:
        sf = SavedFilter(
            tenant_id=tenant_id,
            user_initials=user_initials,
            name=name,
            entity_type=entity_type,
            filters=filters,
            sort_config=sort_config,
            is_default=False,
        )
        session.add(sf)
        session.commit()
        session.refresh(sf)
        return _filter_to_dict(sf)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def delete_filter(tenant_id: int, filter_id: int) -> bool:
    """Delete a saved filter by id."""
    from db.models import SavedFilter
    session = _get_session()
    try:
        sf = session.query(SavedFilter).filter(
            SavedFilter.id == filter_id,
            SavedFilter.tenant_id == tenant_id,
        ).first()
        if not sf:
            return False
        session.delete(sf)
        session.commit()
        return True
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def set_default(tenant_id: int, user_initials: str, filter_id: int) -> bool:
    """Set a filter as default, unsetting all other defaults for this user/entity_type."""
    from db.models import SavedFilter
    session = _get_session()
    try:
        # Find the target filter
        target = session.query(SavedFilter).filter(
            SavedFilter.id == filter_id,
            SavedFilter.tenant_id == tenant_id,
            SavedFilter.user_initials == user_initials,
        ).first()
        if not target:
            return False

        # Unset all other defaults for this user + entity_type
        session.query(SavedFilter).filter(
            SavedFilter.tenant_id == tenant_id,
            SavedFilter.user_initials == user_initials,
            SavedFilter.entity_type == target.entity_type,
            SavedFilter.id != filter_id,
        ).update({"is_default": False})

        # Set the target as default
        target.is_default = True
        session.commit()
        return True
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _filter_to_dict(f) -> dict:
    return {
        "id": f.id,
        "user_initials": f.user_initials,
        "name": f.name,
        "entity_type": f.entity_type,
        "filters": f.filters or {},
        "is_default": f.is_default,
        "sort_config": f.sort_config,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }
