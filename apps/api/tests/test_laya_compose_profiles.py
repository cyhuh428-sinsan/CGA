from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def _compose() -> str:
    return (ROOT / "docker-compose.yml").read_text(encoding="utf-8")


def test_laya_services_are_profile_gated_and_not_published():
    compose = _compose()
    assert 'profiles: ["laya-cpu"]' in compose
    assert 'profiles: ["laya-gpu"]' in compose
    assert "- laya-serve" in compose
    laya_block = compose[compose.index("  laya-cpu:"):compose.index("  studio:")]
    assert "ports:" not in laya_block
    assert "HF_HUB_OFFLINE: \"1\"" in laya_block


def test_gpu_service_reserves_nvidia_device_and_cpu_service_does_not():
    compose = _compose()
    cpu_block = compose[compose.index("  laya-cpu:"):compose.index("  laya-gpu:")]
    gpu_block = compose[compose.index("  laya-gpu:"):compose.index("  studio:")]
    assert "driver: nvidia" not in cpu_block
    assert "driver: nvidia" in gpu_block
    assert "LAYA_DEVICE: cuda" in gpu_block
    assert "LAYA_DEVICE: cpu" in cpu_block


def test_api_receives_laya_settings_and_stays_off_by_default():
    compose = _compose()
    assert "LAYA_SERVE_BASE_URL: ${CGA_LAYA_SERVE_BASE_URL:-}" in compose
