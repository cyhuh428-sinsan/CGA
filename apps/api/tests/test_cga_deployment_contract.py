from __future__ import annotations

from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]

WEB_INTERNAL_API_FILES = (
    "apps/web/lib/api.ts",
    "apps/web/app/api/v1/[...path]/route.ts",
    "apps/web/app/api/studio/rag/_shared.ts",
    "apps/web/app/assets/[...segments]/route.ts",
    "apps/web/app/files/[category]/[...segments]/route.ts",
    "apps/web/app/health/ready/route.ts",
)


def _read(relative_path: str) -> str:
    return (ROOT_DIR / relative_path).read_text(encoding="utf-8")


def test_web_server_uses_cga_internal_api_variable_only() -> None:
    for relative_path in WEB_INTERNAL_API_FILES:
        source = _read(relative_path)
        assert "CGA_INTERNAL_API_BASE_URL" in source, relative_path
        assert "AIDOT_INTERNAL_API_BASE_URL" not in source, relative_path
        assert "NEXT_PUBLIC_API_BASE_URL" not in source, relative_path


def test_compose_exposes_cga_api_only_through_proxy_network() -> None:
    compose = _read("docker-compose.yml")
    assert "container_name: cga-studio" in compose
    assert "container_name: cga-api" in compose
    assert "CGA_INTERNAL_API_BASE_URL: http://cga-api:8000" in compose
    assert '"4173:4173"' in compose
    assert '"8000:8000"' not in compose
    assert "- .:/workspace" not in compose
    assert "/home/ubuntu/deploy/cga:/workspace" not in compose
    assert "name: proxy-network" in compose


def test_deployment_document_declares_external_api_proxy() -> None:
    deployment = _read("docs/cga-daon-deployment.md")
    assert "api-cga.sinsan.kr" in deployment
    assert "http://cga-api:8000" in deployment


def test_docker_context_excludes_secrets_and_host_dependencies() -> None:
    dockerignore = _read(".dockerignore")
    for required_pattern in (".env", "**/node_modules", "**/.next", ".cga-data"):
        assert required_pattern in dockerignore


def test_web_container_preserves_shared_package_layout() -> None:
    dockerfile = _read("apps/web/Dockerfile")
    assert "WORKDIR /workspace/apps/web" in dockerfile
    assert "COPY packages/shared /workspace/packages/shared" in dockerfile


def test_api_uses_cga_service_branding() -> None:
    main_source = _read("apps/api/app/main.py")
    config_source = _read("apps/api/app/core/config.py")
    assert 'title="CGA API"' in main_source
    assert '"message": "CGA API is running."' in main_source
    assert 'app_name: str = "CGA API"' in config_source
    assert "/cga" in config_source


def test_api_container_runs_migrations_and_safe_bootstrap() -> None:
    dockerfile = _read("apps/api/Dockerfile")
    start_script = _read("apps/api/scripts/start-cga-api.sh")
    assert 'CMD ["/workspace/apps/api/scripts/start-cga-api.sh"]' in dockerfile
    assert "alembic upgrade head" in start_script
    assert "python -m app.db.bootstrap" in start_script
    assert "exec python -m uvicorn" in start_script
