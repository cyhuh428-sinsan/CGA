"""Align default roles and initial accounts.

Revision ID: 20260504_0012
Revises: 20260504_0011
Create Date: 2026-05-04 21:40:00
"""

from __future__ import annotations

from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision = "20260504_0012"
down_revision = "20260504_0011"
branch_labels = None
depends_on = None


ROLE_ROWS = [
    ("curator", "큐레이터"),
    ("operation_manager", "운영관리자"),
    ("system_manager", "시스템관리자"),
    ("it_admin", "IT관리자"),
]

PERMISSION_ROWS = [
    ("user.read", "사용자 조회"),
    ("user.write", "사용자 수정"),
    ("bot.read", "봇 조회"),
    ("bot.write", "봇 수정"),
    ("flow.write", "플로우 수정"),
    ("api.read", "API 조회"),
    ("api.write", "API 수정"),
    ("conversation.read", "대화 조회"),
]

ROLE_PERMISSIONS = {
    "curator": ["bot.read", "bot.write", "flow.write", "conversation.read"],
    "operation_manager": ["bot.read", "bot.write", "flow.write", "api.read", "api.write", "conversation.read"],
    "system_manager": ["user.read", "user.write", "bot.read", "bot.write", "flow.write", "api.read", "api.write", "conversation.read"],
    "it_admin": ["user.read", "user.write", "bot.read", "bot.write", "flow.write", "api.read", "api.write", "conversation.read"],
}


def upgrade() -> None:
    conn = op.get_bind()

    for code, name in ROLE_ROWS:
        conn.execute(
            sa.text(
                """
                INSERT INTO roles (id, code, name)
                VALUES (:id, :code, :name)
                ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL
                """
            ),
            {"id": uuid4(), "code": code, "name": name},
        )

    for code, name in PERMISSION_ROWS:
        conn.execute(
            sa.text(
                """
                INSERT INTO permissions (id, code, name)
                VALUES (:id, :code, :name)
                ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL
                """
            ),
            {"id": uuid4(), "code": code, "name": name},
        )

    role_ids = dict(conn.execute(sa.text("SELECT code, id FROM roles WHERE code = ANY(:codes)"), {"codes": list(ROLE_PERMISSIONS)}).all())
    permission_codes = sorted({permission for permissions in ROLE_PERMISSIONS.values() for permission in permissions})
    permission_ids = dict(conn.execute(sa.text("SELECT code, id FROM permissions WHERE code = ANY(:codes)"), {"codes": permission_codes}).all())

    for role_code, permission_codes_for_role in ROLE_PERMISSIONS.items():
        role_id = role_ids.get(role_code)
        if role_id is None:
            continue
        conn.execute(sa.text("DELETE FROM role_permissions WHERE role_id = :role_id"), {"role_id": role_id})
        for permission_code in permission_codes_for_role:
            permission_id = permission_ids.get(permission_code)
            if permission_id is None:
                continue
            conn.execute(
                sa.text(
                    """
                    INSERT INTO role_permissions (id, role_id, permission_id)
                    VALUES (:id, :role_id, :permission_id)
                    """
                ),
                {"id": uuid4(), "role_id": role_id, "permission_id": permission_id},
            )

    conn.execute(
        sa.text(
            """
            UPDATE users
               SET status = 'inactive', deleted_at = NOW(), updated_at = NOW()
             WHERE login_id IN ('aidot_itadmin', 'aidot_curator')
               AND deleted_at IS NULL
            """
        )
    )

    conn.execute(
        sa.text(
            """
            WITH default_groups AS (
                SELECT organization_id, id AS default_group_id
                  FROM groups
                 WHERE code = 'RSH0000000'
                   AND deleted_at IS NULL
            )
            UPDATE users
               SET group_id = default_groups.default_group_id,
                   updated_at = NOW()
              FROM groups AS source_groups, default_groups
             WHERE users.group_id = source_groups.id
               AND source_groups.organization_id = default_groups.organization_id
               AND source_groups.code <> 'RSH0000000'
            """
        )
    )
    conn.execute(
        sa.text(
            """
            WITH default_groups AS (
                SELECT organization_id, id AS default_group_id
                  FROM groups
                 WHERE code = 'RSH0000000'
                   AND deleted_at IS NULL
            )
            UPDATE bots
               SET group_id = default_groups.default_group_id,
                   updated_at = NOW()
              FROM groups AS source_groups, default_groups
             WHERE bots.group_id = source_groups.id
               AND source_groups.organization_id = default_groups.organization_id
               AND source_groups.code <> 'RSH0000000'
            """
        )
    )
    conn.execute(
        sa.text(
            """
            UPDATE groups
               SET status = 'inactive', deleted_at = NOW(), updated_at = NOW()
             WHERE code <> 'RSH0000000'
               AND deleted_at IS NULL
            """
        )
    )
    row = conn.execute(
        sa.text(
            """
            SELECT users.id AS user_id, roles.id AS role_id
              FROM users
              JOIN roles ON roles.code = 'it_admin'
             WHERE users.login_id = 'master'
             LIMIT 1
            """
        )
    ).mappings().first()

    if row is None:
        return

    conn.execute(
        sa.text(
            """
            UPDATE users
               SET status = 'active', deleted_at = NULL, updated_at = NOW()
             WHERE id = :user_id
            """
        ),
        {"user_id": row["user_id"]},
    )
    conn.execute(sa.text("DELETE FROM user_roles WHERE user_id = :user_id AND role_id <> :role_id"), row)
    exists = conn.execute(
        sa.text("SELECT 1 FROM user_roles WHERE user_id = :user_id AND role_id = :role_id"),
        row,
    ).first()
    if exists is None:
        conn.execute(
            sa.text("INSERT INTO user_roles (id, user_id, role_id) VALUES (:id, :user_id, :role_id)"),
            {"id": uuid4(), "user_id": row["user_id"], "role_id": row["role_id"]},
        )


def downgrade() -> None:
    pass
