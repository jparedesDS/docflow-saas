"""Usage tracking service — per-tenant monthly counters."""

import os
from datetime import datetime, timezone

STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "excel")


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def get_current_month_usage(tenant_id: int) -> dict:
    """Get usage counters for the current month."""
    if STORAGE_BACKEND != "postgres":
        return {"api_calls": 0, "documents_created": 0, "emails_sent": 0, "storage_bytes": 0}

    from db.models import UsageRecord
    month = _current_month()
    session = _get_session()
    try:
        record = session.query(UsageRecord).filter(
            UsageRecord.tenant_id == tenant_id,
            UsageRecord.month == month,
        ).first()
        if not record:
            return {"api_calls": 0, "documents_created": 0, "emails_sent": 0, "storage_bytes": 0}
        return {
            "api_calls": record.api_calls,
            "documents_created": record.documents_created,
            "emails_sent": record.emails_sent,
            "storage_bytes": record.storage_bytes,
        }
    finally:
        session.close()


def increment_usage(tenant_id: int, field: str, amount: int = 1):
    """Increment a usage counter for the current month."""
    if STORAGE_BACKEND != "postgres":
        return

    from db.models import UsageRecord
    month = _current_month()
    session = _get_session()
    try:
        record = session.query(UsageRecord).filter(
            UsageRecord.tenant_id == tenant_id,
            UsageRecord.month == month,
        ).first()
        if not record:
            record = UsageRecord(
                tenant_id=tenant_id,
                month=month,
            )
            session.add(record)
            session.flush()

        current = getattr(record, field, 0)
        setattr(record, field, current + amount)
        session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()


def get_usage_history(tenant_id: int, months: int = 6) -> list:
    """Get usage history for the last N months."""
    if STORAGE_BACKEND != "postgres":
        return []

    from db.models import UsageRecord
    session = _get_session()
    try:
        records = session.query(UsageRecord).filter(
            UsageRecord.tenant_id == tenant_id,
        ).order_by(UsageRecord.month.desc()).limit(months).all()
        return [
            {
                "month": r.month,
                "api_calls": r.api_calls,
                "documents_created": r.documents_created,
                "emails_sent": r.emails_sent,
                "storage_bytes": r.storage_bytes,
            }
            for r in reversed(records)
        ]
    finally:
        session.close()
