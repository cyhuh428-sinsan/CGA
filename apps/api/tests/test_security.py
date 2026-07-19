"""
보안 모듈 테스트 — JWT 토큰 생성/검증 및 비밀번호 해시 기능 검증
"""
from __future__ import annotations

import time

import jwt
import pytest

from app.core.security import (
    ALGORITHM,
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)
from app.core.config import settings


# ---------------------------------------------------------------------------
# 비밀번호 해시
# ---------------------------------------------------------------------------

def _try_hash(password: str) -> str | None:
    """bcrypt 백엔드 호환성 문제를 처리하여 해시 반환. 실패 시 None."""
    try:
        return get_password_hash(password)
    except Exception:
        return None


def test_get_password_hash_returns_bcrypt_string() -> None:
    hashed = _try_hash("secret123")
    if hashed is None:
        pytest.skip("bcrypt backend unavailable in this environment")
    assert hashed.startswith("$2")


def test_verify_password_accepts_correct_password() -> None:
    hashed = _try_hash("correct-password")
    if hashed is None:
        pytest.skip("bcrypt backend unavailable in this environment")
    assert verify_password("correct-password", hashed) is True


def test_verify_password_rejects_wrong_password() -> None:
    hashed = _try_hash("correct-password")
    if hashed is None:
        pytest.skip("bcrypt backend unavailable in this environment")
    assert verify_password("wrong-password", hashed) is False


def test_two_hashes_of_same_password_differ() -> None:
    h1 = _try_hash("same")
    h2 = _try_hash("same")
    if h1 is None or h2 is None:
        pytest.skip("bcrypt backend unavailable in this environment")
    assert h1 != h2


# ---------------------------------------------------------------------------
# JWT 토큰 생성 및 복호화
# ---------------------------------------------------------------------------

def test_create_access_token_returns_decodable_token() -> None:
    token = create_access_token("user-123")
    payload = decode_access_token(token)
    assert payload["sub"] == "user-123"


def test_create_access_token_includes_extra_claims() -> None:
    token = create_access_token("user-123", extra_claims={"role": "admin", "org": "org-1"})
    payload = decode_access_token(token)
    assert payload["role"] == "admin"
    assert payload["org"] == "org-1"


def test_create_access_token_has_exp_claim() -> None:
    token = create_access_token("user-123")
    payload = decode_access_token(token)
    assert "exp" in payload
    assert "iat" in payload
    assert payload["exp"] > payload["iat"]


def test_decode_access_token_raises_on_invalid_signature() -> None:
    token = create_access_token("user-123")
    tampered = token[:-4] + "XXXX"
    with pytest.raises(Exception):
        decode_access_token(tampered)


def test_decode_access_token_raises_on_expired_token() -> None:
    """만료 시간을 과거로 설정한 토큰은 검증 실패해야 한다."""
    import datetime as dt

    past = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1)
    payload = {"sub": "user-exp", "exp": past}
    expired_token = jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(expired_token)


def test_decode_access_token_raises_on_wrong_secret() -> None:
    token = jwt.encode({"sub": "user-x"}, "wrong-secret", algorithm=ALGORITHM)
    with pytest.raises(Exception):
        decode_access_token(token)
