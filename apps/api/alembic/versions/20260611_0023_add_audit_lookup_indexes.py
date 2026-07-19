"""Add audit lookup indexes.

Revision ID: 20260611_0023
Revises: 20260608_0022
Create Date: 2026-06-11
"""

from __future__ import annotations

from alembic import op


revision = "20260611_0023"
down_revision = "20260608_0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_audit_logs_action_target_created_at",
        "audit_logs",
        ["action_type", "target_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_audit_logs_target_type_target_id_created_at",
        "audit_logs",
        ["target_type", "target_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_audit_logs_target_type_target_id_created_at", table_name="audit_logs")
    op.drop_index("idx_audit_logs_action_target_created_at", table_name="audit_logs")
