from __future__ import annotations

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
