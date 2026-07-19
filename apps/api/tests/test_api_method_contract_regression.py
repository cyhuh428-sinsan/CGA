"""Aidot 핵심 API HTTP 메서드 계약 회귀 테스트."""

from __future__ import annotations

from collections.abc import Iterable

from app.api.routes.auth import router as auth_router
from app.api.routes.bots import router as bots_router
from app.api.routes.edit_locks import router as edit_locks_router


def _methods(router, path: str) -> set[str]:
    methods: set[str] = set()
    for route in router.routes:
        if route.path == path:
            methods.update(route.methods or set())
    return methods


def test_auth_http_methods_are_stable() -> None:
    assert _methods(auth_router, "/auth/login") == {"POST"}
    assert _methods(auth_router, "/auth/logout") == {"POST"}
    assert _methods(auth_router, "/auth/me") == {"GET"}
    assert _methods(auth_router, "/auth/signup") == {"POST"}
    assert _methods(auth_router, "/auth/change-password") == {"POST"}


def test_bot_http_methods_are_stable() -> None:
    assert _methods(bots_router, "/bots") == {"GET", "POST"}
    assert _methods(bots_router, "/bots/{bot_id}") == {"GET", "PATCH", "DELETE"}
    assert _methods(bots_router, "/bots/{bot_id}/versions") == {"GET", "POST"}
    assert _methods(bots_router, "/bots/{bot_id}/versions/{version_id}") == {"GET", "PATCH", "DELETE"}


def test_version_asset_http_methods_are_stable() -> None:
    assert _methods(bots_router, "/bots/{bot_id}/versions/{version_id}/dialogs") == {"GET", "PATCH"}
    assert _methods(bots_router, "/bots/{bot_id}/versions/{version_id}/entities") == {"GET", "PATCH"}
    assert _methods(bots_router, "/bots/{bot_id}/versions/{version_id}/dictionary") == {"GET", "PATCH"}
    assert _methods(bots_router, "/bots/{bot_id}/versions/{version_id}/apis") == {"GET", "PATCH"}


def test_edit_lock_http_methods_are_stable() -> None:
    assert _methods(edit_locks_router, "/edit-locks/acquire") == {"POST"}
    assert _methods(edit_locks_router, "/edit-locks/heartbeat") == {"POST"}
    assert _methods(edit_locks_router, "/edit-locks/release") == {"POST"}
    assert _methods(edit_locks_router, "/edit-locks/force-release") == {"POST"}
    assert _methods(edit_locks_router, "/edit-locks/status") == {"GET"}
