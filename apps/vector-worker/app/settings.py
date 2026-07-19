from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class VectorWorkerSettings:
    storage_dir: Path
    embedding_provider: str
    embedding_model: str
    vector_dimension: int
    ollama_base_url: str
    embedding_timeout_seconds: float


def load_settings() -> VectorWorkerSettings:
    root = Path(__file__).resolve().parents[1]
    storage_dir = Path(os.getenv("AIDOT_VECTOR_STORAGE_DIR") or root / "data")
    return VectorWorkerSettings(
        storage_dir=storage_dir,
        embedding_provider=os.getenv("AIDOT_VECTOR_EMBEDDING_PROVIDER", "aidot_vector_worker").strip().lower(),
        embedding_model=os.getenv("AIDOT_VECTOR_EMBEDDING_MODEL", "semantic_engine_default").strip(),
        vector_dimension=int(os.getenv("AIDOT_VECTOR_DIMENSION", "384")),
        ollama_base_url=os.getenv("AIDOT_OLLAMA_BASE_URL", "http://192.168.220.180:11434").strip(),
        embedding_timeout_seconds=float(os.getenv("AIDOT_VECTOR_EMBEDDING_TIMEOUT_SECONDS", "60")),
    )
