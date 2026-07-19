from __future__ import annotations

import hashlib

import pytest

from app.services.cga_legacy_auth import (
    LEGACY_ROLE_MAP,
    resolve_legacy_identity,
    verify_legacy_password,
)


def _credential(password: str) -> dict[str, object]:
    salt = "0123456789abcdef0123456789abcdef"
    iterations = 120_000
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
        dklen=32,
    )
    return {
        "algorithm": "pbkdf2-sha256",
        "iterations": iterations,
        "digest": "sha256",
        "salt": salt,
        "hash": digest.hex(),
    }


def _state(role: str, *, user_status: str = "active", membership_status: str = "active"):
    return {
        "users": [
            {
                "id": "legacy-user",
                "name": "기존 사용자",
                "locale": "ko",
                "status": user_status,
            }
        ],
        "memberships": [
            {
                "user_id": "legacy-user",
                "group_id": "g-support",
                "role": role,
                "status": membership_status,
            }
        ],
        "groups": [
            {
                "id": "g-support",
                "name": "Support Bot Group",
                "status": "active",
            }
        ],
    }


def test_verify_legacy_password_accepts_cga_pbkdf2_sha256() -> None:
    credential = _credential("correct-password")

    assert verify_legacy_password("correct-password", credential) is True
    assert verify_legacy_password("wrong-password", credential) is False


@pytest.mark.parametrize(
    ("legacy_role", "aidot_role"),
    list(LEGACY_ROLE_MAP.items()),
)
def test_resolve_legacy_identity_preserves_role_mapping(
    legacy_role: str,
    aidot_role: str,
) -> None:
    identity = resolve_legacy_identity(
        _state(legacy_role),
        {"users": {"legacy-user": _credential("secret")}},
        "legacy-user",
        "secret",
    )

    assert identity is not None
    assert identity.group_code == "g-support"
    assert identity.group_name == "Support Bot Group"
    assert identity.legacy_role_code == legacy_role
    assert identity.aidot_role_code == aidot_role


@pytest.mark.parametrize(
    ("user_status", "membership_status", "password"),
    [
        ("inactive", "active", "secret"),
        ("active", "pending", "secret"),
        ("active", "active", "wrong-password"),
    ],
)
def test_resolve_legacy_identity_rejects_ineligible_login(
    user_status: str,
    membership_status: str,
    password: str,
) -> None:
    identity = resolve_legacy_identity(
        _state(
            "viewer",
            user_status=user_status,
            membership_status=membership_status,
        ),
        {"users": {"legacy-user": _credential("secret")}},
        "legacy-user",
        password,
    )

    assert identity is None
