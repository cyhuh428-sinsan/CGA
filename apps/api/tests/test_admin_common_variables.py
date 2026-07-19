from __future__ import annotations

from app.api.routes.admin import SYSTEM_COMMON_VARIABLES
from app.services.scenario_validation import SYSTEM_VARIABLE_NAMES


def test_admin_common_system_variables_cover_runtime_reserved_variables() -> None:
    admin_names = {str(item["name"]) for item in SYSTEM_COMMON_VARIABLES}
    internal_only = {"input", "result"}

    missing_names = sorted(SYSTEM_VARIABLE_NAMES - internal_only - admin_names)

    assert missing_names == []
