"""API key management service — create, validate, list, and revoke API keys."""

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


def _hash_key(raw_key: str) -> str:
    """Hash a raw API key using SHA-256."""
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def create_key(
    tenant_id: int,
    name: str,
    scopes: list,
    created_by: str,
    expires_days: int = None,
) -> dict:
    """Generate a new API key, store its hash, and return the raw key (only time visible).

    Key format: df_ + 32 random URL-safe chars.
    """
    from db.models import ApiKey

    raw_key = "df_" + secrets.token_urlsafe(32)
    key_hash = _hash_key(raw_key)
    key_prefix = raw_key[:8]  # "df_xxxxx" for display

    expires_at = None
    if expires_days is not None and expires_days > 0:
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_days)

    session = _get_session()
    try:
        api_key = ApiKey(
            tenant_id=tenant_id,
            name=name,
            key_hash=key_hash,
            key_prefix=key_prefix,
            scopes=scopes or ["read"],
            expires_at=expires_at,
            created_by=created_by,
        )
        session.add(api_key)
        session.commit()
        session.refresh(api_key)

        result = _key_to_dict(api_key)
        result["raw_key"] = raw_key  # Only returned on creation
        return result
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def validate_key(raw_key: str) -> Optional[dict]:
    """Validate a raw API key. Returns dict with tenant_id and scopes, or None.

    Updates last_used_at on successful validation.
    """
    from db.models import ApiKey

    key_hash = _hash_key(raw_key)
    session = _get_session()
    try:
        api_key = session.query(ApiKey).filter(
            ApiKey.key_hash == key_hash,
        ).first()

        if not api_key:
            return None

        # Check expiration
        if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
            return None

        # Update last_used_at
        api_key.last_used_at = datetime.now(timezone.utc)
        session.commit()

        return {
            "tenant_id": api_key.tenant_id,
            "scopes": api_key.scopes or [],
            "name": api_key.name,
            "key_id": api_key.id,
        }
    except Exception:
        session.rollback()
        return None
    finally:
        session.close()


def list_keys(tenant_id: int) -> list:
    """List all API keys for a tenant. Never includes the hash, only the prefix."""
    from db.models import ApiKey
    session = _get_session()
    try:
        keys = session.query(ApiKey).filter(
            ApiKey.tenant_id == tenant_id,
        ).order_by(ApiKey.created_at.desc()).all()
        return [_key_to_dict(k) for k in keys]
    finally:
        session.close()


def delete_key(tenant_id: int, key_id: int) -> bool:
    """Delete (revoke) an API key."""
    from db.models import ApiKey
    session = _get_session()
    try:
        api_key = session.query(ApiKey).filter(
            ApiKey.id == key_id,
            ApiKey.tenant_id == tenant_id,
        ).first()
        if not api_key:
            return False
        session.delete(api_key)
        session.commit()
        return True
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def revoke_key(tenant_id: int, key_id: int) -> bool:
    """Alias for delete_key — revoke an API key."""
    return delete_key(tenant_id, key_id)


def _key_to_dict(k) -> dict:
    return {
        "id": k.id,
        "name": k.name,
        "key_prefix": k.key_prefix,
        "scopes": k.scopes or [],
        "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
        "expires_at": k.expires_at.isoformat() if k.expires_at else None,
        "created_by": k.created_by,
        "created_at": k.created_at.isoformat() if k.created_at else None,
    }
