"""Add bot list lookup index.

Revision ID: 20260611_0024
Revises: 20260611_0023
Create Date: 2026-06-11
"""

from __future__ import annotations

from alembic import op


revision = "20260611_0024"
down_revision = "20260611_0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_bots_org_group_deleted_updated",
        "bots",
        ["organization_id", "group_id", "deleted_at", "updated_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_bots_org_group_deleted_updated", table_name="bots")
