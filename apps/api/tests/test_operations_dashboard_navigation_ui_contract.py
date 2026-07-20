from __future__ import annotations

from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]


def _read(relative_path: str) -> str:
    return (ROOT_DIR / relative_path).read_text(encoding="utf-8")


def test_admin_menu_omits_operations_dashboard() -> None:
    admin_layout = _read("apps/web/components/admin-console-layout.tsx")
    studio_rail = _read("apps/web/components/studio-rail.tsx")

    legacy_item = '{ href: "/admin/operations-dashboard", label: "운영 대시보드" },'
    assert legacy_item not in admin_layout
    assert legacy_item not in studio_rail


def test_operations_menu_routes_db_dashboard_to_admin_screen() -> None:
    studio_rail = _read("apps/web/components/studio-rail.tsx")

    assert '{ code: "DB", label: "DB 운영 대시보드", href: "/admin/operations-dashboard" },' in studio_rail
    assert 'const isDbOperationsDashboardPath = pathname === "/admin/operations-dashboard";' in studio_rail
    assert 'const isAdminPath = pathname.startsWith("/admin") && !isDbOperationsDashboardPath;' in studio_rail
    assert "isDbOperationsDashboardPath ||" in studio_rail


def test_operations_role_keeps_dashboard_access_after_menu_removal() -> None:
    admin_layout = _read("apps/web/components/admin-console-layout.tsx")

    assert 'const operationsHrefs = ["/admin/operations-dashboard",' in admin_layout
