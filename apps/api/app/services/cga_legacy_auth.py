from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models import Group, Organization, Role, User, UserRole


LEGACY_ROLE_MAP: dict[str, str] = {
    "group_admin": "system_manager",
    "builder": "curator",
    "reviewer": "reviewer",
    "operator": "operation_manager",
    "viewer": "viewer",
}


@dataclass(frozen=True)
class LegacyIdentity:
    login_id: str
    name: str
    locale: str
    group_code: str
    group_name: str
    legacy_role_code: str
    aidot_role_code: str


def _load_collection(db: Session, collection_key: str) -> dict[str, Any] | None:
    payload = db.execute(
        text(
            "SELECT payload FROM cga_state_store "
            "WHERE collection_key = :collection_key"
        ),
        {"collection_key": collection_key},
    ).scalar_one_or_none()
    return payload if isinstance(payload, dict) else None


def verify_legacy_password(password: str, credential: object) -> bool:
    if not isinstance(credential, dict):
        return False
    if credential.get("algorithm") != "pbkdf2-sha256":
        return False

    try:
        iterations = int(credential.get("iterations", 120_000))
        digest = str(credential.get("digest", "sha256"))
        salt = str(credential["salt"])
        expected = bytes.fromhex(str(credential["hash"]))
    except (KeyError, TypeError, ValueError):
        return False

    if digest != "sha256" or not 1 <= iterations <= 1_000_000 or not expected:
        return False

    actual = hashlib.pbkdf2_hmac(
        digest,
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
        dklen=len(expected),
    )
    return hmac.compare_digest(actual, expected)


def resolve_legacy_identity(
    access_state: object,
    credentials: object,
    login_id: str,
    password: str,
) -> LegacyIdentity | None:
    if not isinstance(access_state, dict) or not isinstance(credentials, dict):
        return None

    users = access_state.get("users")
    memberships = access_state.get("memberships")
    groups = access_state.get("groups")
    credential_users = credentials.get("users")
    if not all(isinstance(value, list) for value in (users, memberships, groups)):
        return None
    if not isinstance(credential_users, dict):
        return None

    user = next(
        (
            item
            for item in users
            if isinstance(item, dict)
            and item.get("id") == login_id
            and item.get("status") == "active"
        ),
        None,
    )
    if user is None or not verify_legacy_password(password, credential_users.get(login_id)):
        return None

    membership = next(
        (
            item
            for item in memberships
            if isinstance(item, dict)
            and item.get("user_id") == login_id
            and item.get("status") == "active"
        ),
        None,
    )
    if membership is None:
        return None

    legacy_role_code = str(membership.get("role", ""))
    aidot_role_code = LEGACY_ROLE_MAP.get(legacy_role_code)
    if aidot_role_code is None:
        return None

    group_code = str(membership.get("group_id", ""))
    group = next(
        (
            item
            for item in groups
            if isinstance(item, dict)
            and item.get("id") == group_code
            and item.get("status") == "active"
        ),
        None,
    )
    if group is None:
        return None

    return LegacyIdentity(
        login_id=login_id,
        name=str(user.get("name") or login_id),
        locale=str(user.get("locale") or "ko"),
        group_code=group_code,
        group_name=str(group.get("name") or group_code),
        legacy_role_code=legacy_role_code,
        aidot_role_code=aidot_role_code,
    )


def provision_legacy_user(
    db: Session,
    *,
    login_id: str,
    password: str,
) -> User | None:
    access_state = _load_collection(db, "access_state")
    credentials = _load_collection(db, "auth_credentials")
    identity = resolve_legacy_identity(access_state, credentials, login_id, password)
    if identity is None:
        return None

    organization = db.scalar(
        select(Organization).where(
            Organization.code == "default",
            Organization.status == "active",
            Organization.deleted_at.is_(None),
        )
    )
    if organization is None:
        return None

    group = db.scalar(
        select(Group).where(
            Group.organization_id == organization.id,
            Group.code == identity.group_code,
            Group.deleted_at.is_(None),
        )
    )
    if group is None:
        group = Group(
            organization_id=organization.id,
            code=identity.group_code,
            name=identity.group_name,
            status="active",
            data_json={
                "source": "cga_state_store",
                "legacy_group_id": identity.group_code,
            },
        )
        db.add(group)
        db.flush()

    role = db.scalar(
        select(Role).where(
            Role.code == identity.aidot_role_code,
            Role.deleted_at.is_(None),
        )
    )
    if role is None:
        return None

    user = User(
        organization_id=organization.id,
        group_id=group.id,
        login_id=identity.login_id,
        password_hash=get_password_hash(password),
        name=identity.name,
        email=None,
        status="active",
        data_json={
            "auth_source": "cga_state_store",
            "legacy_role_code": identity.legacy_role_code,
            "preferred_language": identity.locale,
        },
        is_protected=False,
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role_id=role.id))
    db.flush()
    return user
