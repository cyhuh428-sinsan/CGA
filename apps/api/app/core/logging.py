from __future__ import annotations

import json
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

from app.core.config import ROOT_DIR, settings


LOG_DIR = ROOT_DIR / "logs" / "api"
LOG_MAX_BYTES = 10 * 1024 * 1024
LOG_BACKUP_COUNT = 10


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key in ("request_id", "method", "path", "status_code", "elapsed_ms", "client", "user_id", "event"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        extra = getattr(record, "extra_data", None)
        if isinstance(extra, dict):
            payload["data"] = extra
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    formatter = JsonFormatter()

    root_logger = logging.getLogger()
    root_logger.setLevel(settings.log_level.upper())

    existing_file_handlers = [
        handler
        for handler in root_logger.handlers
        if isinstance(handler, RotatingFileHandler)
        and Path(getattr(handler, "baseFilename", "")).parent == LOG_DIR
    ]
    if existing_file_handlers:
        return

    app_handler = RotatingFileHandler(
        LOG_DIR / "app.log",
        maxBytes=LOG_MAX_BYTES,
        backupCount=LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    app_handler.setFormatter(formatter)
    root_logger.addHandler(app_handler)

    error_handler = RotatingFileHandler(
        LOG_DIR / "error.log",
        maxBytes=LOG_MAX_BYTES,
        backupCount=LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    root_logger.addHandler(error_handler)


def get_logger(name: str) -> logging.Logger:
    configure_logging()
    return logging.getLogger(name)
