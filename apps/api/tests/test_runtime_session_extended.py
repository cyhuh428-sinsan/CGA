"""
런타임 세션 확장 테스트 — 다양한 세션 상태 전이 경계 케이스 검증
"""
from __future__ import annotations

from app.services.runtime_session import apply_end_card_state, runtime_completion_reason


# ---------------------------------------------------------------------------
# apply_end_card_state
# ---------------------------------------------------------------------------

def test_end_card_dialog_end_sets_dialog_ended_flag() -> None:
    state: dict = {"waitingNodeId": "end-1", "currentNodeId": "end-1", "variables": {}}
    apply_end_card_state(state, end_session_immediately=False)
    assert state["dialogEnded"] is True


def test_end_card_dialog_end_clears_node_ids() -> None:
    state: dict = {"waitingNodeId": "end-1", "currentNodeId": "end-1", "variables": {}}
    apply_end_card_state(state, end_session_immediately=False)
    assert state["waitingNodeId"] == ""
    assert state["currentNodeId"] == ""


def test_end_card_session_end_sets_both_flags() -> None:
    state: dict = {"waitingNodeId": "end-1", "currentNodeId": "end-1", "variables": {"$x": 1}}
    apply_end_card_state(state, end_session_immediately=True)
    assert state["dialogEnded"] is True
    assert state["sessionEnded"] is True


def test_end_card_session_end_clears_variables() -> None:
    state: dict = {
        "waitingNodeId": "end-1",
        "currentNodeId": "end-1",
        "variables": {"$result": {"status": "ok"}, "$name": "홍길동"},
    }
    apply_end_card_state(state, end_session_immediately=True)
    assert state["variables"] == {}


def test_end_card_dialog_end_preserves_variables() -> None:
    original_vars = {"$result": {"status": "ok"}, "$name": "홍길동"}
    state: dict = {
        "waitingNodeId": "end-1",
        "currentNodeId": "end-1",
        "variables": original_vars.copy(),
    }
    apply_end_card_state(state, end_session_immediately=False)
    assert state["variables"] == original_vars


def test_end_card_returns_state() -> None:
    state: dict = {"waitingNodeId": "end-1", "currentNodeId": "end-1", "variables": {}}
    result = apply_end_card_state(state, end_session_immediately=False)
    assert result is state


# ---------------------------------------------------------------------------
# runtime_completion_reason
# ---------------------------------------------------------------------------

def test_completion_reason_session_ended_takes_priority() -> None:
    assert runtime_completion_reason({"sessionEnded": True, "dialogEnded": True, "waitingNodeId": "t"}) == "session_ended"


def test_completion_reason_dialog_ended() -> None:
    assert runtime_completion_reason({"dialogEnded": True}) == "dialog_ended"


def test_completion_reason_waiting_user_input() -> None:
    assert runtime_completion_reason({"waitingNodeId": "talk-1"}) == "waiting_user_input"


def test_completion_reason_running_when_empty_state() -> None:
    assert runtime_completion_reason({}) == "running"


def test_completion_reason_running_when_waiting_node_is_blank() -> None:
    assert runtime_completion_reason({"waitingNodeId": "  "}) == "running"
    assert runtime_completion_reason({"waitingNodeId": ""}) == "running"


def test_completion_reason_running_when_session_ended_false() -> None:
    assert runtime_completion_reason({"sessionEnded": False, "dialogEnded": False}) == "running"
