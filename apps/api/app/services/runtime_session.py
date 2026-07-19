from __future__ import annotations

from typing import Any


def apply_end_card_state(state: dict[str, Any], *, end_session_immediately: bool) -> dict[str, Any]:
    state["waitingNodeId"] = ""
    state["currentNodeId"] = ""
    state["dialogEnded"] = True
    if end_session_immediately:
        state["sessionEnded"] = True
        state["variables"] = {}
    return state


def runtime_completion_reason(state: dict[str, Any]) -> str:
    if state.get("sessionEnded") is True:
        return "session_ended"
    if state.get("dialogEnded") is True:
        return "dialog_ended"
    if str(state.get("waitingNodeId") or "").strip():
        return "waiting_user_input"
    return "running"
