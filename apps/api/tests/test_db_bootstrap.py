from __future__ import annotations

from app.db.bootstrap import bootstrap_required


def test_bootstrap_is_required_for_empty_cga_database() -> None:
    assert bootstrap_required(organization_exists=False, existing_role_codes=set()) is True


def test_bootstrap_is_skipped_after_required_foundation_exists() -> None:
    assert (
        bootstrap_required(
            organization_exists=True,
            existing_role_codes={
                "curator",
                "operation_manager",
                "system_manager",
                "it_admin",
                "reviewer",
                "viewer",
            },
        )
        is False
    )


def test_bootstrap_repairs_partial_foundation() -> None:
    assert bootstrap_required(organization_exists=True, existing_role_codes={"curator"}) is True
