"""Add group and signup request tables.

Revision ID: 20260425_0003
Revises: 20260424_0002
Create Date: 2026-04-25 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260425_0003"
down_revision = "20260424_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_groups_organization_id"),
        sa.UniqueConstraint("organization_id", "code", name="uq_groups_organization_id_code"),
    )
    op.create_index("idx_groups_organization_id", "groups", ["organization_id"], unique=False)
    op.create_index("idx_groups_status", "groups", ["status"], unique=False)

    op.create_table(
        "signup_requests",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("group_id", sa.Uuid(), nullable=False),
        sa.Column("login_id", sa.String(length=80), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("preferred_language", sa.String(length=10), nullable=False),
        sa.Column("requested_role_code", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("reviewed_user_id", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_signup_requests_organization_id"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], name="fk_signup_requests_group_id"),
        sa.ForeignKeyConstraint(["reviewed_user_id"], ["users.id"], name="fk_signup_requests_reviewed_user_id"),
    )
    op.create_index("idx_signup_requests_login_id", "signup_requests", ["login_id"], unique=False)
    op.create_index("idx_signup_requests_status", "signup_requests", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_signup_requests_status", table_name="signup_requests")
    op.drop_index("idx_signup_requests_login_id", table_name="signup_requests")
    op.drop_table("signup_requests")
    op.drop_index("idx_groups_status", table_name="groups")
    op.drop_index("idx_groups_organization_id", table_name="groups")
    op.drop_table("groups")
