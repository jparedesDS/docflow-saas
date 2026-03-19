"""Initial multi-tenant schema + EIPSA seed data.

Revision ID: 001
Revises: None
Create Date: 2026-03-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Tenants ──
    op.create_table(
        "tenants",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("plan", sa.String(50), nullable=False, server_default="free"),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("max_users", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_tenants_slug", "tenants", ["slug"])

    # ── Users ──
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("username", sa.String(150), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("initials", sa.String(10), nullable=False, server_default=""),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("role", sa.String(100), nullable=False, server_default=""),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_superadmin", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"])
    op.create_unique_constraint("uq_users_tenant_username", "users", ["tenant_id", "username"])

    # ── Documents (JSONB) ──
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("data", JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_documents_tenant", "documents", ["tenant_id"])

    # ── Consultas (JSONB) ──
    op.create_table(
        "consultas",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("data", JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_consultas_tenant", "consultas", ["tenant_id"])

    # ── Tags & Inspections (JSONB) ──
    op.create_table(
        "tags_inspections",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("data", JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_tags_inspections_tenant", "tags_inspections", ["tenant_id"])

    # ── Agenda Items ──
    op.create_table(
        "agenda_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tipo", sa.String(50), nullable=False),
        sa.Column("data", JSONB(), nullable=False, server_default="{}"),
        sa.Column("owner", sa.String(50), nullable=True),
        sa.Column("source_doc_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_agenda_items_tenant_tipo", "agenda_items", ["tenant_id", "tipo"])

    # ── Claims Log ──
    op.create_table(
        "claims_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pedido", sa.String(100), nullable=False),
        sa.Column("last_claimed", sa.DateTime(timezone=True), nullable=True),
        sa.Column("history", JSONB(), nullable=False, server_default="[]"),
    )
    op.create_index("ix_claims_log_tenant", "claims_log", ["tenant_id"])
    op.create_unique_constraint("uq_claims_tenant_pedido", "claims_log", ["tenant_id", "pedido"])

    # ── Notifications ──
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tipo", sa.String(100), nullable=False),
        sa.Column("titulo", sa.String(500), nullable=False),
        sa.Column("detalle", sa.Text(), nullable=False, server_default=""),
        sa.Column("metadata", JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_tenant_tipo", "notifications", ["tenant_id", "tipo"])

    # ── Email Templates ──
    op.create_table(
        "email_templates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("template_id", sa.String(100), nullable=False),
        sa.Column("nombre", sa.String(255), nullable=False),
        sa.Column("asunto", sa.String(500), nullable=False),
        sa.Column("cuerpo_html", sa.Text(), nullable=False),
        sa.Column("variables", JSONB(), nullable=False, server_default="[]"),
        sa.Column("tipo", sa.String(100), nullable=False, server_default=""),
    )
    op.create_index("ix_email_templates_tenant", "email_templates", ["tenant_id"])
    op.create_unique_constraint("uq_templates_tenant_tid", "email_templates", ["tenant_id", "template_id"])

    # ── Scheduled Reports ──
    op.create_table(
        "scheduled_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_id", sa.String(100), nullable=False),
        sa.Column("type", sa.String(100), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("frequency", sa.String(50), nullable=False),
        sa.Column("schedule", JSONB(), nullable=False, server_default="{}"),
        sa.Column("recipients", JSONB(), nullable=False, server_default='{"to":[],"cc":[]}'),
        sa.Column("options", JSONB(), nullable=False, server_default="{}"),
        sa.Column("last_run", JSONB(), nullable=True),
    )
    op.create_index("ix_scheduled_reports_tenant", "scheduled_reports", ["tenant_id"])
    op.create_unique_constraint("uq_schedreports_tenant_rid", "scheduled_reports", ["tenant_id", "report_id"])

    # ── Processed Emails ──
    op.create_table(
        "processed_emails",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uid", sa.String(255), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_processed_emails_tenant", "processed_emails", ["tenant_id"])
    op.create_unique_constraint("uq_processed_tenant_uid", "processed_emails", ["tenant_id", "uid"])

    # ── Invitations ──
    op.create_table(
        "invitations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(100), nullable=False, server_default=""),
        sa.Column("token", sa.String(255), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invited_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_invitations_tenant", "invitations", ["tenant_id"])
    op.create_index("ix_invitations_token", "invitations", ["token"])

    # ── Tenant Settings ──
    op.create_table(
        "tenant_settings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key", sa.String(255), nullable=False),
        sa.Column("value", sa.Text(), nullable=False, server_default=""),
        sa.Column("encrypted", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("ix_tenant_settings_tenant", "tenant_settings", ["tenant_id"])
    op.create_unique_constraint("uq_settings_tenant_key", "tenant_settings", ["tenant_id", "key"])

    # ── Billing Info ──
    op.create_table(
        "billing_info",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("stripe_customer_id", sa.String(255), unique=True, nullable=True),
        sa.Column("stripe_subscription_id", sa.String(255), nullable=True),
        sa.Column("plan", sa.String(50), nullable=False, server_default="free"),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Usage Records ──
    op.create_table(
        "usage_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("api_calls", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("documents_created", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("emails_sent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("storage_bytes", sa.BigInteger(), nullable=False, server_default="0"),
    )
    op.create_index("ix_usage_records_tenant", "usage_records", ["tenant_id"])
    op.create_unique_constraint("uq_usage_tenant_month", "usage_records", ["tenant_id", "month"])

    # ── Seed EIPSA as tenant_id=1 ──
    op.execute(
        "INSERT INTO tenants (id, name, slug, plan, max_users) "
        "VALUES (1, 'EIPSA', 'eipsa', 'enterprise', 25)"
    )


def downgrade() -> None:
    op.drop_table("usage_records")
    op.drop_table("billing_info")
    op.drop_table("tenant_settings")
    op.drop_table("invitations")
    op.drop_table("processed_emails")
    op.drop_table("scheduled_reports")
    op.drop_table("email_templates")
    op.drop_table("notifications")
    op.drop_table("claims_log")
    op.drop_table("agenda_items")
    op.drop_table("tags_inspections")
    op.drop_table("consultas")
    op.drop_table("documents")
    op.drop_table("users")
    op.drop_table("tenants")
