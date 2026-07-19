"""Create admin default messages table.

Revision ID: 20260505_0014
Revises: 20260505_0013
Create Date: 2026-05-05 23:10:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260505_0014"
down_revision = "20260505_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_default_messages",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("message_key", sa.String(length=80), nullable=False),
        sa.Column("message_name", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("language", sa.String(length=20), nullable=False),
        sa.Column("scope", sa.String(length=20), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("data_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_admin_default_messages_organization_id"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_admin_default_messages_created_by"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], name="fk_admin_default_messages_updated_by"),
        sa.UniqueConstraint("organization_id", "message_key", "language", name="uq_admin_default_messages_org_key_language"),
    )
    op.create_index("idx_admin_default_messages_org", "admin_default_messages", ["organization_id"], unique=False)
    op.create_index("idx_admin_default_messages_category", "admin_default_messages", ["category"], unique=False)
    op.create_index("idx_admin_default_messages_status", "admin_default_messages", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_admin_default_messages_status", table_name="admin_default_messages")
    op.drop_index("idx_admin_default_messages_category", table_name="admin_default_messages")
    op.drop_index("idx_admin_default_messages_org", table_name="admin_default_messages")
    op.drop_table("admin_default_messages")
