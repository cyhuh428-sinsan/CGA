"""단일 TS provider mapping의 Python 소비 경계. 실패 시 추정하지 않는다."""
from __future__ import annotations

from functools import lru_cache
import json
from pathlib import Path
import subprocess

from fastapi import HTTPException
from app.core.config import settings

BRIDGE = Path(__file__).resolve().parents[4] / "packages/shared/src/channel-bridge.mjs"


@lru_cache(maxsize=1)
def provider_mapping() -> tuple[dict[str, str], ...]:
    try:
        result = subprocess.run([settings.channel_connection_node_binary, str(BRIDGE)],
            input='{"operation":"mapping"}', text=True, capture_output=True,
            timeout=10, check=True, encoding="utf-8")
        envelope = json.loads(result.stdout)
        rows = envelope["value"]
        if envelope.get("ok") is not True or not isinstance(rows, list) or len(rows) != 8:
            raise ValueError()
        keys = {"admin", "provider", "runtime", "bridge"}
        if any(not isinstance(row, dict) or set(row) != keys or
               any(not isinstance(value, str) or not value or len(value) > 40 for value in row.values()) for row in rows):
            raise ValueError()
        for key in keys:
            if len({row[key] for row in rows}) != len(rows):
                raise ValueError()
        return tuple(rows)
    except (OSError, subprocess.SubprocessError, ValueError, KeyError, TypeError):
        raise HTTPException(503, "CHANNEL_PACKET_RUNTIME_UNAVAILABLE") from None


def normalize_channel_provider(value: str) -> str:
    for row in provider_mapping():
        if value in (row["admin"], row["provider"], row["runtime"]):
            return row["provider"]
    raise HTTPException(422, "CHANNEL_PROVIDER_INVALID")


def channel_mapping(value: str) -> dict[str, str]:
    for row in provider_mapping():
        if value in (row["admin"], row["provider"], row["runtime"]):
            return row
    raise HTTPException(422, "CHANNEL_PROVIDER_INVALID")


def convert_packet(provider: str, direction: str, payload: dict):
    try:
        response = subprocess.run([settings.channel_connection_node_binary, str(BRIDGE)],
            input=json.dumps({"provider": provider, "operation": direction, "payload": payload}, ensure_ascii=False),
            text=True, capture_output=True, timeout=10, encoding="utf-8", check=False)
        value = json.loads(response.stdout)
        if response.returncode or value.get("ok") is not True:
            raise HTTPException(422, "CHANNEL_PACKET_INVALID")
        return value["value"]
    except (OSError, subprocess.SubprocessError, ValueError, KeyError, TypeError):
        raise HTTPException(503, "CHANNEL_PACKET_RUNTIME_UNAVAILABLE") from None
