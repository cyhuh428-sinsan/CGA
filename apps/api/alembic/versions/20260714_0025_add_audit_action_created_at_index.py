"""Add audit action and time lookup index.

Revision ID: 20260714_0025
Revises: 20260611_0024
Create Date: 2026-07-14
"""

from __future__ import annotations

from alembic import op


revision = "20260714_0025"
down_revision = "20260611_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_audit_logs_action_created_at",
        "audit_logs",
        ["action_type", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_audit_logs_action_created_at", table_name="audit_logs")