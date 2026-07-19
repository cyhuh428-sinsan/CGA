"""Create admin licenses table.

Revision ID: 20260507_0015
Revises: 20260505_0014
Create Date: 2026-05-07 10:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260507_0015"
down_revision = "20260505_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_licenses",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("license_id", sa.String(length=120), nullable=False),
        sa.Column("product", sa.String(length=80), nullable=False),
        sa.Column("customer_name", sa.String(length=200), nullable=False),
        sa.Column("issued_at_text", sa.String(length=40), nullable=True),
        sa.Column("expires_at_text", sa.String(length=40), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("license_text", sa.Text(), nullable=False),
        sa.Column("signature_value", sa.Text(), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("applied_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_admin_licenses_organization_id"),
        sa.ForeignKeyConstraint(["applied_by"], ["users.id"], name="fk_admin_licenses_applied_by"),
        sa.UniqueConstraint("organization_id", "license_id", name="uq_admin_licenses_organization_license"),
    )
    op.create_index("idx_admin_licenses_org", "admin_licenses", ["organization_id"], unique=False)
    op.create_index("idx_admin_licenses_status", "admin_licenses", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_admin_licenses_status", table_name="admin_licenses")
    op.drop_index("idx_admin_licenses_org", table_name="admin_licenses")
    op.drop_table("admin_licenses")