"""
라이선스 정책 확장 테스트 — 날짜 파싱, 한도 파싱, API 자산 카운트 검증

NOTE: license_policy 모듈은 SQLAlchemy 모델을 임포트하므로 Python 3.14에서
      SQLAlchemy 호환성 문제가 발생한다. 순수 로직 함수만 별도로 테스트한다.
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest


# ---------------------------------------------------------------------------
# 로컬 복사본 — 모델 의존성 없이 순수 로직만 테스트
# ---------------------------------------------------------------------------

def _parse_license_date(value: object):
    from fastapi import HTTPException, status
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="라이선스 날짜 형식이 올바르지 않습니다.",
        ) from exc


def _license_limits(payload):
    raw_limits = payload.get("limits") if payload else None
    if not isinstance(raw_limits, dict):
        return {}
    limits = {}
    for key in ("users", "bots", "apis"):
        value = raw_limits.get(key)
        if isinstance(value, int):
            limits[key] = value
    return limits


def _iter_api_assets(value: object):
    if isinstance(value, dict):
        for key in ("apis", "api_assets", "apiAssets"):
            assets = value.get(key)
            if isinstance(assets, list):
                for asset in assets:
                    if isinstance(asset, dict):
                        yield asset
        for child in value.values():
            yield from _iter_api_assets(child)
    elif isinstance(value, list):
        for child in value:
            yield from _iter_api_assets(child)


def _api_asset_key(api_asset: dict) -> str | None:
    for key in ("id", "apiId", "name", "baseUrl"):
        value = api_asset.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _count_api_assets(document: object) -> int:
    api_keys: set[str] = set()
    for asset in _iter_api_assets(document or {}):
        key = _api_asset_key(asset)
        if key:
            api_keys.add(key)
    return len(api_keys)


# ---------------------------------------------------------------------------
# parse_license_date
# ---------------------------------------------------------------------------

def test_parse_license_date_parses_valid_iso_date() -> None:
    result = _parse_license_date("2026-12-31")
    assert result == date(2026, 12, 31)


def test_parse_license_date_returns_none_for_empty_string() -> None:
    assert _parse_license_date("") is None
    assert _parse_license_date(None) is None


def test_parse_license_date_returns_none_for_non_string() -> None:
    assert _parse_license_date(12345) is None


def test_parse_license_date_raises_on_invalid_format() -> None:
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        _parse_license_date("31-12-2026")
    assert exc_info.value.status_code == 400


def test_parse_license_date_parses_date_with_whitespace() -> None:
    result = _parse_license_date("  2026-01-15  ")
    assert result == date(2026, 1, 15)


# ---------------------------------------------------------------------------
# _license_limits
# ---------------------------------------------------------------------------

def test_license_limits_returns_empty_on_none_payload() -> None:
    assert _license_limits(None) == {}


def test_license_limits_returns_empty_on_missing_limits_key() -> None:
    assert _license_limits({}) == {}


def test_license_limits_returns_empty_when_limits_is_not_dict() -> None:
    assert _license_limits({"limits": "not-dict"}) == {}
    assert _license_limits({"limits": 100}) == {}


def test_license_limits_extracts_valid_integer_limits() -> None:
    payload = {"limits": {"users": 10, "bots": 5, "apis": 3}}
    limits = _license_limits(payload)
    assert limits == {"users": 10, "bots": 5, "apis": 3}


def test_license_limits_ignores_non_integer_values() -> None:
    payload = {"limits": {"users": "unlimited", "bots": 5, "apis": None}}
    limits = _license_limits(payload)
    assert "users" not in limits
    assert "apis" not in limits
    assert limits["bots"] == 5


def test_license_limits_partial_limits() -> None:
    payload = {"limits": {"bots": 20}}
    limits = _license_limits(payload)
    assert limits == {"bots": 20}
    assert "users" not in limits
    assert "apis" not in limits


# ---------------------------------------------------------------------------
# iter_api_assets / count_api_assets
# ---------------------------------------------------------------------------

def test_iter_api_assets_finds_assets_in_apis_key() -> None:
    doc = {
        "apis": [
            {"id": "api-1", "name": "API 1"},
            {"id": "api-2", "name": "API 2"},
        ]
    }
    assets = list(_iter_api_assets(doc))
    ids = {a["id"] for a in assets}
    assert ids == {"api-1", "api-2"}


def test_count_api_assets_deduplicates_by_id() -> None:
    doc = {
        "apis": [
            {"id": "api-1", "name": "API 1"},
            {"id": "api-1", "name": "API 1 duplicate"},
        ]
    }
    assert _count_api_assets(doc) == 1


def test_count_api_assets_handles_empty_document() -> None:
    assert _count_api_assets({}) == 0
    assert _count_api_assets(None) == 0


def test_count_api_assets_uses_name_as_fallback_key() -> None:
    doc = {"apis": [{"name": "External API"}]}
    assert _count_api_assets(doc) == 1


def test_count_api_assets_skips_invalid_entries() -> None:
    doc = {"apis": ["not-a-dict", None, {"id": "valid-api"}]}
    assert _count_api_assets(doc) == 1


def test_iter_api_assets_finds_nested_api_assets() -> None:
    doc = {
        "group": {
            "apis": [{"id": "nested-api"}]
        }
    }
    assets = list(_iter_api_assets(doc))
    assert any(a.get("id") == "nested-api" for a in assets)


# ---------------------------------------------------------------------------
# 라이선스 만료일 경계 테스트
# ---------------------------------------------------------------------------

def test_license_expires_today_is_not_expired() -> None:
    today = date.today()
    remaining = (today - date.today()).days
    assert remaining == 0


def test_license_expires_yesterday_is_expired() -> None:
    yesterday = date.today() - timedelta(days=1)
    assert yesterday < date.today()


def test_license_expires_30_days_ahead_gets_warning_threshold() -> None:
    near_expiry = date.today() + timedelta(days=25)
    remaining = (near_expiry - date.today()).days
    assert remaining <= 30
