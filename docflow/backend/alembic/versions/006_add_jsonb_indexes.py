"""Add JSONB indexes for common query filters.

Revision ID: 006
Revises: 005
Create Date: 2026-03-24
"""
from typing import Sequence, Union

from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Btree indexes on frequently filtered JSONB fields
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_estado ON documents ((data->>'Estado'))")
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_cliente ON documents ((data->>'Cliente'))")
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_pedido ON documents ((data->>'Nº Pedido'))")
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_responsable ON documents ((data->>'Repsonsable'))")
    op.execute("CREATE INDEX IF NOT EXISTS ix_consultas_responsable ON consultas ((data->>'Responsable'))")
    op.execute("CREATE INDEX IF NOT EXISTS ix_consultas_pedido ON consultas ((data->>'Nº Pedido'))")
    # GIN indexes for containment queries
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_data_gin ON documents USING gin (data)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_consultas_data_gin ON consultas USING gin (data)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_documents_estado")
    op.execute("DROP INDEX IF EXISTS ix_documents_cliente")
    op.execute("DROP INDEX IF EXISTS ix_documents_pedido")
    op.execute("DROP INDEX IF EXISTS ix_documents_responsable")
    op.execute("DROP INDEX IF EXISTS ix_consultas_responsable")
    op.execute("DROP INDEX IF EXISTS ix_consultas_pedido")
    op.execute("DROP INDEX IF EXISTS ix_documents_data_gin")
    op.execute("DROP INDEX IF EXISTS ix_consultas_data_gin")
