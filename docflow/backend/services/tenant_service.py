"""Tenant management service — registration, lookup, settings."""

import os
import re
from datetime import datetime, timezone
from typing import Optional

from services.auth_service import hash_password
from utils.encryption import encrypt_value, decrypt_value

STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "excel")


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


def register_tenant(name: str, slug: str, admin_email: str, admin_password: str, admin_name: str = "") -> dict:
    """Create a new tenant with its admin user. Returns tenant + user + JWT."""
    from db.models import Tenant, User, BillingInfo
    from services.auth_service import create_token, create_refresh_token

    # Validate slug
    slug = slug.lower().strip()
    if not re.match(r'^[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]$', slug):
        raise ValueError("Slug must be 3-50 chars, lowercase alphanumeric and hyphens only")

    session = _get_session()
    try:
        # Check uniqueness
        existing = session.query(Tenant).filter(Tenant.slug == slug).first()
        if existing:
            raise ValueError(f"Organization '{slug}' already exists")

        # Create tenant
        tenant = Tenant(
            name=name,
            slug=slug,
            plan="free",
            max_users=3,
        )
        session.add(tenant)
        session.flush()

        # Create admin user
        username = admin_email.split("@")[0].lower().replace(" ", ".")
        admin_display = admin_name or username
        initials = "".join(w[0].upper() for w in admin_display.split()[:2]) or username[:2].upper()

        user = User(
            tenant_id=tenant.id,
            username=username,
            name=admin_display,
            initials=initials,
            email=admin_email,
            role="admin",
            password_hash=hash_password(admin_password),
            is_active=True,
        )
        session.add(user)

        # Create billing placeholder
        billing = BillingInfo(
            tenant_id=tenant.id,
            plan="free",
            status="active",
        )
        session.add(billing)

        session.commit()

        # Generate JWT
        user_data = {
            "sub": username,
            "role": "admin",
            "initials": initials,
            "tenant_id": tenant.id,
        }
        token = create_token(user_data)
        refresh = create_refresh_token(user_data)

        return {
            "tenant": {
                "id": tenant.id,
                "name": tenant.name,
                "slug": tenant.slug,
                "plan": tenant.plan,
            },
            "user": {
                "username": username,
                "name": admin_display,
                "initials": initials,
                "role": "admin",
                "email": admin_email,
            },
            "token": token,
            "refresh_token": refresh,
        }
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_tenant(tenant_id: int) -> Optional[dict]:
    from db.models import Tenant
    session = _get_session()
    try:
        t = session.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not t:
            return None
        return {
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "plan": t.plan,
            "logo_url": t.logo_url,
            "max_users": t.max_users,
            "is_active": t.is_active,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
    finally:
        session.close()


def update_tenant(tenant_id: int, updates: dict) -> Optional[dict]:
    from db.models import Tenant
    session = _get_session()
    try:
        t = session.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not t:
            return None
        allowed = {"name", "logo_url"}
        for key, val in updates.items():
            if key in allowed and hasattr(t, key):
                setattr(t, key, val)
        session.commit()
        return get_tenant(tenant_id)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_tenant_users_count(tenant_id: int) -> int:
    from db.models import User
    session = _get_session()
    try:
        return session.query(User).filter(
            User.tenant_id == tenant_id,
            User.is_active == True,
        ).count()
    finally:
        session.close()


# ── Invitations ──────────────────────────────────────────────────────────────


def create_invitation(tenant_id: int, email: str, role: str, invited_by: int = None) -> dict:
    """Generate an invitation token for a new user."""
    import secrets
    from datetime import timedelta
    from db.models import Invitation, Tenant

    session = _get_session()
    try:
        # Check tenant user limit
        tenant = session.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ValueError("Tenant not found")

        from services.plan_service import check_quota
        if not check_quota(tenant_id, "users", 1):
            raise ValueError(f"User limit reached for plan '{tenant.plan}'")

        token = secrets.token_urlsafe(32)
        invitation = Invitation(
            tenant_id=tenant_id,
            email=email,
            role=role,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            invited_by=invited_by,
        )
        session.add(invitation)
        session.commit()

        return {
            "email": email,
            "role": role,
            "token": token,
            "expires_at": invitation.expires_at.isoformat(),
        }
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def list_pending_invitations(tenant_id: int) -> list:
    """List all pending (not accepted, not expired) invitations for a tenant."""
    from db.models import Invitation
    session = _get_session()
    try:
        invitations = session.query(Invitation).filter(
            Invitation.tenant_id == tenant_id,
            Invitation.accepted_at == None,
            Invitation.expires_at > datetime.now(timezone.utc),
        ).order_by(Invitation.created_at.desc()).all()
        return [
            {
                "id": inv.id,
                "email": inv.email,
                "role": inv.role,
                "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
            }
            for inv in invitations
        ]
    finally:
        session.close()


def cancel_invitation(tenant_id: int, invitation_id: int):
    """Cancel (delete) a pending invitation."""
    from db.models import Invitation
    session = _get_session()
    try:
        invitation = session.query(Invitation).filter(
            Invitation.id == invitation_id,
            Invitation.tenant_id == tenant_id,
        ).first()
        if not invitation:
            raise ValueError("Invitation not found")
        if invitation.accepted_at is not None:
            raise ValueError("Invitation already accepted")
        session.delete(invitation)
        session.commit()
    except ValueError:
        raise
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def accept_invitation(token: str, name: str, password: str) -> dict:
    """Accept an invitation and create the user account."""
    from db.models import Invitation, User
    from services.auth_service import create_token, create_refresh_token

    session = _get_session()
    try:
        invitation = session.query(Invitation).filter(
            Invitation.token == token,
            Invitation.accepted_at == None,
        ).first()

        if not invitation:
            raise ValueError("Invalid or expired invitation")

        if invitation.expires_at < datetime.now(timezone.utc):
            raise ValueError("Invitation has expired")

        # Create user
        username = invitation.email.split("@")[0].lower().replace(" ", ".")
        initials = "".join(w[0].upper() for w in name.split()[:2]) or username[:2].upper()

        user = User(
            tenant_id=invitation.tenant_id,
            username=username,
            name=name,
            initials=initials,
            email=invitation.email,
            role=invitation.role,
            password_hash=hash_password(password),
            is_active=True,
        )
        session.add(user)

        # Mark invitation as accepted
        invitation.accepted_at = datetime.now(timezone.utc)

        session.commit()

        # Generate JWT
        user_data = {
            "sub": username,
            "role": invitation.role,
            "initials": initials,
            "tenant_id": invitation.tenant_id,
        }

        return {
            "token": create_token(user_data),
            "refresh_token": create_refresh_token(user_data),
            "user": {
                "username": username,
                "name": name,
                "initials": initials,
                "role": invitation.role,
            },
        }
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ── Tenant Settings ──────────────────────────────────────────────────────────


def get_tenant_setting(tenant_id: int, key: str, default: str = "") -> str:
    from db.models import TenantSetting
    session = _get_session()
    try:
        setting = session.query(TenantSetting).filter(
            TenantSetting.tenant_id == tenant_id,
            TenantSetting.key == key,
        ).first()
        if not setting:
            return os.getenv(key, default)
        if setting.encrypted:
            return decrypt_value(setting.value)
        return setting.value
    finally:
        session.close()


def set_tenant_setting(tenant_id: int, key: str, value: str, encrypted: bool = False):
    from db.models import TenantSetting
    session = _get_session()
    try:
        stored_value = encrypt_value(value) if encrypted else value
        setting = session.query(TenantSetting).filter(
            TenantSetting.tenant_id == tenant_id,
            TenantSetting.key == key,
        ).first()
        if setting:
            setting.value = stored_value
            setting.encrypted = encrypted
        else:
            setting = TenantSetting(
                tenant_id=tenant_id,
                key=key,
                value=stored_value,
                encrypted=encrypted,
            )
            session.add(setting)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
