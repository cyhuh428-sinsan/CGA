from __future__ import annotations

from typing import Any

from fastapi import Request


def success_response(
    request: Request,
    data: Any,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    response_meta: dict[str, Any] = {
        "request_id": getattr(request.state, "request_id", ""),
    }
    if meta:
        response_meta.update(meta)
    return {
        "data": data,
        "meta": response_meta,
    }
