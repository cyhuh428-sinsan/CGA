from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_production_rejects_development_credentials() -> None:
    with pytest.raises(ValidationError):
        Settings(app_env="production", _env_file=None)


def test_production_accepts_explicit_secure_credentials() -> None:
    settings = Settings(
        app_env="production",
        database_url="postgresql+psycopg://cga_user:strong-password@shared-db:5432/cga",
        jwt_secret="a-secure-random-jwt-secret-with-32-characters",
        initial_admin_password="a-strong-initial-admin-password",
        _env_file=None,
    )

    assert settings.app_env == "production"


def test_legacy_asset_root_is_optional(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CGA_LEGACY_ASSET_ROOT", raising=False)

    assert Settings(_env_file=None).legacy_asset_root_path is None


def test_legacy_asset_root_resolves_when_configured(tmp_path: Path) -> None:
    configured = Settings(_env_file=None, cga_legacy_asset_root=str(tmp_path))

    assert configured.legacy_asset_root_path == tmp_path.resolve()


def test_richform_adds_configured_legacy_asset_directories(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api.routes import richform

    monkeypatch.setattr(richform.settings, "cga_legacy_asset_root", str(tmp_path))

    assert set(richform._allowed_local_image_roots()) >= {
        tmp_path / "temp",
        tmp_path / "bot-images",
        tmp_path / "storage" / "temp",
        tmp_path / "storage" / "bot-images",
    }
