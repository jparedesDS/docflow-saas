"""SQLAlchemy ORM models — all tables for multi-tenant DocFlow SaaS.

Design decisions:
- documents/consultas/tags use JSONB `data` column to preserve Excel column names
  (including typos like 'Repsonsable') without schema mapping.
- Structured tables (users, agenda, claims, etc.) use explicit columns.
- Every table has `tenant_id` FK for row-level multi-tenancy.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    BigInteger,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from db.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


# ── Tenants ──────────────────────────────────────────────────────────────────


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    plan = Column(String(50), nullable=False, default="free")
    logo_url = Column(String(500), nullable=True)
    max_users = Column(Integer, nullable=False, default=3)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    billing = relationship("BillingInfo", back_populates="tenant", uselist=False, cascade="all, delete-orphan")


# ── Users ────────────────────────────────────────────────────────────────────


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("tenant_id", "username", name="uq_users_tenant_username"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    username = Column(String(150), nullable=False)
    name = Column(String(255), nullable=False)
    initials = Column(String(10), nullable=False, default="")
    email = Column(String(255), nullable=True)
    role = Column(String(100), nullable=False, default="")
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    is_superadmin = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    tenant = relationship("Tenant", back_populates="users")


# ── Documents (data_erp.xlsx — JSONB rows) ──────────────────────────────────


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_documents_tenant", "tenant_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    data = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)


# ── Consultas (consulta_erp.xlsx — JSONB rows) ──────────────────────────────


class Consulta(Base):
    __tablename__ = "consultas"
    __table_args__ = (
        Index("ix_consultas_tenant", "tenant_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    data = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)


# ── Tags & Inspections (data_tags.xlsx — JSONB rows) ────────────────────────


class TagInspection(Base):
    __tablename__ = "tags_inspections"
    __table_args__ = (
        Index("ix_tags_inspections_tenant", "tenant_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    data = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)


# ── Agenda Items (from agenda_data.json) ─────────────────────────────────────


class AgendaItem(Base):
    __tablename__ = "agenda_items"
    __table_args__ = (
        Index("ix_agenda_items_tenant_tipo", "tenant_id", "tipo"),
    )

    id = Column(String(36), primary_key=True)  # UUID string
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    tipo = Column(String(50), nullable=False)  # "notas", "reuniones", "tareas"
    data = Column(JSONB, nullable=False, default=dict)
    owner = Column(String(50), nullable=True)
    source_doc_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)


# ── Claims Log (from claims_log.json) ────────────────────────────────────────


class ClaimLog(Base):
    __tablename__ = "claims_log"
    __table_args__ = (
        UniqueConstraint("tenant_id", "pedido", name="uq_claims_tenant_pedido"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    pedido = Column(String(100), nullable=False)
    last_claimed = Column(DateTime(timezone=True), nullable=True)
    history = Column(JSONB, nullable=False, default=list)


# ── Notifications (from notifications_log.json) ─────────────────────────────


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_tenant_tipo", "tenant_id", "tipo"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    tipo = Column(String(100), nullable=False)
    titulo = Column(String(500), nullable=False)
    detalle = Column(Text, nullable=False, default="")
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)


# ── Email Templates (from email_templates.json) ─────────────────────────────


class EmailTemplateDB(Base):
    __tablename__ = "email_templates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "template_id", name="uq_templates_tenant_tid"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(String(100), nullable=False)  # user-visible ID like "default-claim"
    nombre = Column(String(255), nullable=False)
    asunto = Column(String(500), nullable=False)
    cuerpo_html = Column(Text, nullable=False)
    variables = Column(JSONB, nullable=False, default=list)
    tipo = Column(String(100), nullable=False, default="")


# ── Scheduled Reports (from scheduled_reports.json) ─────────────────────────


class ScheduledReportDB(Base):
    __tablename__ = "scheduled_reports"
    __table_args__ = (
        UniqueConstraint("tenant_id", "report_id", name="uq_schedreports_tenant_rid"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    report_id = Column(String(100), nullable=False)  # user-visible ID
    type = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    enabled = Column(Boolean, nullable=False, default=True)
    frequency = Column(String(50), nullable=False)
    schedule = Column(JSONB, nullable=False, default=dict)
    recipients = Column(JSONB, nullable=False, default=lambda: {"to": [], "cc": []})
    options = Column(JSONB, nullable=False, default=dict)
    last_run = Column(JSONB, nullable=True)


# ── Processed Emails (from processed_emails.json) ───────────────────────────


class ProcessedEmail(Base):
    __tablename__ = "processed_emails"
    __table_args__ = (
        UniqueConstraint("tenant_id", "uid", name="uq_processed_tenant_uid"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    uid = Column(String(255), nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)


# ── Invitations (Fase 3) ────────────────────────────────────────────────────


class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    role = Column(String(100), nullable=False, default="")
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    invited_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)


# ── Tenant Settings (Fase 3) ────────────────────────────────────────────────


class TenantSetting(Base):
    __tablename__ = "tenant_settings"
    __table_args__ = (
        UniqueConstraint("tenant_id", "key", name="uq_settings_tenant_key"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    key = Column(String(255), nullable=False)
    value = Column(Text, nullable=False, default="")
    encrypted = Column(Boolean, nullable=False, default=False)


# ── Billing Info (Fase 4) ───────────────────────────────────────────────────


class BillingInfo(Base):
    __tablename__ = "billing_info"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False)
    stripe_customer_id = Column(String(255), unique=True, nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    plan = Column(String(50), nullable=False, default="free")
    status = Column(String(50), nullable=False, default="active")
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    tenant = relationship("Tenant", back_populates="billing")


# ── Usage Records (Fase 4) ──────────────────────────────────────────────────


class UsageRecord(Base):
    __tablename__ = "usage_records"
    __table_args__ = (
        UniqueConstraint("tenant_id", "month", name="uq_usage_tenant_month"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    month = Column(String(7), nullable=False)  # "2026-03"
    api_calls = Column(Integer, nullable=False, default=0)
    documents_created = Column(Integer, nullable=False, default=0)
    emails_sent = Column(Integer, nullable=False, default=0)
    storage_bytes = Column(BigInteger, nullable=False, default=0)
