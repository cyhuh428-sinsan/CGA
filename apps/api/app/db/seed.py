from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models import (
    Group,
    Organization,
    Permission,
    Role,
    RolePermission,
    User,
    UserRole,
)


ROLE_DEFINITIONS = {
    "curator": "큐레이터",
    "operation_manager": "운영관리자",
    "system_manager": "시스템관리자",
    "it_admin": "IT관리자",
    "reviewer": "검토자",
    "viewer": "조회자",
}
PERMISSION_DEFINITIONS = {
    "user.read": "사용자 조회",
    "user.write": "사용자 수정",
    "bot.read": "봇 조회",
    "bot.write": "봇 수정",
    "flow.write": "플로우 수정",
    "api.read": "API 조회",
    "api.write": "API 수정",
    "conversation.read": "대화 조회",
}
ROLE_PERMISSION_MAP = {
    "curator": [
        "bot.read",
        "bot.write",
        "flow.write",
        "api.read",
        "conversation.read",
    ],
    "operation_manager": [
        "bot.read",
        "bot.write",
        "flow.write",
        "api.read",
        "api.write",
        "conversation.read",
    ],
    "system_manager": [
        "user.read",
        "user.write",
        "bot.read",
        "bot.write",
        "flow.write",
        "api.read",
        "api.write",
        "conversation.read",
    ],
    "it_admin": [
        "user.read",
        "user.write",
        "bot.read",
        "bot.write",
        "flow.write",
        "api.read",
        "api.write",
        "conversation.read",
    ],
    "reviewer": [
        "bot.read",
        "api.read",
        "conversation.read",
    ],
    "viewer": [
        "bot.read",
        "api.read",
        "conversation.read",
    ],
}

def _ensure_role_permissions(
    role_by_code: dict[str, Role],
    permission_by_code: dict[str, Permission],
) -> list[RolePermission]:
    mappings: list[RolePermission] = []
    for role_code, permission_codes in ROLE_PERMISSION_MAP.items():
        role = role_by_code[role_code]
        for permission_code in permission_codes:
            permission = permission_by_code[permission_code]
            mappings.append(RolePermission(role_id=role.id, permission_id=permission.id))
    return mappings


def _build_group_json(group: Group, organization: Organization) -> dict[str, object]:
    return {
        "id": str(group.id),
        "code": group.code,
        "name": group.name,
        "status": group.status,
        "organization_id": str(organization.id),
        "organization_name": organization.name,
    }


def _build_user_json(user: User, group: Group, organization: Organization, role_code: str) -> dict[str, object]:
    return {
        "id": str(user.id),
        "login_id": user.login_id,
        "name": user.name,
        "email": user.email,
        "status": user.status,
        "group_id": str(group.id),
        "group_name": group.name,
        "organization_id": str(organization.id),
        "organization_name": organization.name,
        "roles": [role_code],
        "is_protected": user.is_protected,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    }


def _build_bot_json(
    *,
    bot_kind: str,
    bot_mode: str,
    profile_key: str,
    language: str,
    nlu_engine: str,
    introduction: str,
) -> dict[str, object]:
    return {
        "bot_kind": bot_kind,
        "bot_mode": bot_mode,
        "profile_key": profile_key,
        "language": language,
        "nlu_engine": nlu_engine,
        "introduction": introduction,
    }


def seed_initial_data() -> None:
    with SessionLocal() as session:
        organization = session.scalar(select(Organization).where(Organization.code == "default"))
        if organization is None:
            organization = Organization(name="기본 서버", code="default", status="active")
            session.add(organization)
            session.flush()
        else:
            organization.name = "기본 서버"
            organization.status = "active"
            session.add(organization)

        role_by_code: dict[str, Role] = {}
        for code, name in ROLE_DEFINITIONS.items():
            role = session.scalar(select(Role).where(Role.code == code))
            if role is None:
                role = Role(code=code, name=name)
                session.add(role)
                session.flush()
            role_by_code[code] = role

        permission_by_code: dict[str, Permission] = {}
        for code, name in PERMISSION_DEFINITIONS.items():
            permission = session.scalar(select(Permission).where(Permission.code == code))
            if permission is None:
                permission = Permission(code=code, name=name)
                session.add(permission)
                session.flush()
            permission_by_code[code] = permission

        for mapping in _ensure_role_permissions(role_by_code, permission_by_code):
            existing_mapping = session.scalar(
                select(RolePermission).where(
                    RolePermission.role_id == mapping.role_id,
                    RolePermission.permission_id == mapping.permission_id,
                )
            )
            if existing_mapping is None:
                session.add(mapping)

        group_definitions = [
            ("RSH0000000", "기본그룹"),
        ]
        group_by_code: dict[str, Group] = {}
        for code, name in group_definitions:
            group = session.scalar(
                select(Group).where(
                    Group.organization_id == organization.id,
                    Group.code == code,
                )
            )
            if group is None:
                group = Group(
                    organization_id=organization.id,
                    code=code,
                    name=name,
                    status="active",
                )
                session.add(group)
                session.flush()
            group.data_json = _build_group_json(group, organization)
            session.add(group)
            group_by_code[code] = group

        default_group = group_by_code["RSH0000000"]
        for retired_group in session.scalars(
            select(Group).where(
                Group.organization_id == organization.id,
                Group.code != "RSH0000000",
                Group.deleted_at.is_(None),
            )
        ).all():
            for linked_user in session.scalars(select(User).where(User.group_id == retired_group.id)).all():
                linked_user.group_id = default_group.id
                session.add(linked_user)
            for linked_bot in session.scalars(select(Bot).where(Bot.group_id == retired_group.id)).all():
                linked_bot.group_id = default_group.id
                session.add(linked_bot)
            retired_group.status = "inactive"
            retired_group.deleted_at = datetime.now(timezone.utc)
            session.add(retired_group)
        user_definitions = [
            ("master", "Master", "it_admin", "RSH0000000", True),
        ]
        user_by_login: dict[str, User] = {}
        retired_login_ids = {"aidot_itadmin", "aidot_curator"}
        for retired_user in session.scalars(
            select(User).where(
                User.login_id.in_(retired_login_ids),
                User.deleted_at.is_(None),
            )
        ).all():
            retired_user.status = "inactive"
            retired_user.deleted_at = datetime.now(timezone.utc)
            session.add(retired_user)

        for login_id, name, role_code, group_code, is_protected in user_definitions:
            user = session.scalar(select(User).where(User.login_id == login_id))
            if user is None:
                user = User(
                    organization_id=organization.id,
                    group_id=group_by_code[group_code].id,
                    login_id=login_id,
                    password_hash=get_password_hash(settings.initial_admin_password),
                    name=name,
                    email=None,
                    status="active",
                    data_json={},
                    is_protected=is_protected,
                )
                session.add(user)
                session.flush()
            else:
                user.organization_id = organization.id
                user.group_id = group_by_code[group_code].id
                user.name = name
                user.status = "active"
                user.deleted_at = None
                user.is_protected = is_protected
                if login_id == "master":
                    user.password_hash = get_password_hash(settings.initial_admin_password)
                session.add(user)
            user.data_json = _build_user_json(
                user,
                group_by_code[group_code],
                organization,
                role_code,
            )
            session.add(user)
            user_by_login[login_id] = user

            target_role_id = role_by_code[role_code].id
            for assigned_role in session.scalars(
                select(UserRole).where(UserRole.user_id == user.id)
            ).all():
                if assigned_role.role_id != target_role_id:
                    session.delete(assigned_role)

            existing_role = session.scalar(
                select(UserRole).where(
                    UserRole.user_id == user.id,
                    UserRole.role_id == target_role_id,
                )
            )
            if existing_role is None:
                session.add(
                    UserRole(
                        user_id=user.id,
                        role_id=target_role_id,
                    )
                )

        session.commit()


if __name__ == "__main__":
    seed_initial_data()
