"""Aidot 핵심 API 접근 경계 통합 회귀 테스트."""

from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_returns_operational_status() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_protected_core_endpoints_reject_anonymous_requests() -> None:
    protected_paths = [
        "/api/v1/auth/me",
        "/api/v1/bots",
        "/api/v1/admin/users",
        f"/api/v1/bots/{uuid4()}/versions",
    ]

    with TestClient(app) as client:
        responses = [client.get(path) for path in protected_paths]

    assert [response.status_code for response in responses] == [401, 401, 401, 401]


def test_api_response_includes_operational_request_headers() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["X-Request-Id"]
    assert response.headers["X-Response-Time-Ms"]
    assert response.headers["X-Db-Time-Ms"]
    assert response.headers["X-Db-Query-Count"]

