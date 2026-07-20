from __future__ import annotations

import base64
import json
from pathlib import Path

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from fastapi import HTTPException

from app.api.routes import admin


def _signed_license(product: str = "CGA") -> tuple[str, str]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key_pem = private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
    payload: dict[str, object] = {
        "license_id": "CGA-LIC-TEST-0001",
        "product": product,
        "customer": {"name": "Sample Customer"},
        "issued_at": "2026-05-07",
        "expires_at": "2036-12-31",
        "limits": {"users": 120, "bots": 30, "apis": 50},
    }
    signature = private_key.sign(
        admin._canonical_license_payload(payload),
        padding.PKCS1v15(),
        hashes.SHA256(),
    )
    document = {
        "format": "cga-license",
        "payload": payload,
        "signature": {
            "algorithm": "RS256",
            "value": base64.urlsafe_b64encode(signature).decode("ascii").rstrip("="),
        },
    }
    return json.dumps(document, ensure_ascii=False), public_key_pem


def test_cga_signed_license_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    license_text, public_key_pem = _signed_license()
    monkeypatch.setattr(admin.settings, "cga_license_public_key", public_key_pem, raising=False)

    verified = admin._verify_license_text(license_text)

    assert verified["format"] == "cga-license"
    assert verified["payload"]["product"] == "CGA"


def test_aidot_product_is_rejected_by_cga_license_verifier(monkeypatch: pytest.MonkeyPatch) -> None:
    license_text, public_key_pem = _signed_license(product="Aidot")
    monkeypatch.setattr(admin.settings, "cga_license_public_key", public_key_pem, raising=False)

    with pytest.raises(HTTPException, match="CGA 제품 라이선스가 아닙니다"):
        admin._verify_license_text(license_text)


def test_cga_license_public_key_is_required_by_compose() -> None:
    compose = (Path(__file__).resolve().parents[3] / "docker-compose.yml").read_text(encoding="utf-8")
    assert "CGA_LICENSE_PUBLIC_KEY: ${CGA_LICENSE_PUBLIC_KEY:?CGA_LICENSE_PUBLIC_KEY is required}" in compose
