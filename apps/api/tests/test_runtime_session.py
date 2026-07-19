from app.services.runtime_session import apply_end_card_state, runtime_completion_reason


def test_end_card_dialog_end_preserves_session_variables() -> None:
    state = {
        "waitingNodeId": "end-1",
        "currentNodeId": "end-1",
        "variables": {"$result": {"status": "ok"}},
        "sessionEnded": False,
    }

    apply_end_card_state(state, end_session_immediately=False)

    assert state["dialogEnded"] is True
    assert state["sessionEnded"] is False
    assert state["variables"] == {"$result": {"status": "ok"}}
    assert state["waitingNodeId"] == ""
    assert state["currentNodeId"] == ""


def test_end_card_session_end_clears_variables() -> None:
    state = {
        "waitingNodeId": "end-1",
        "currentNodeId": "end-1",
        "variables": {"$result": {"status": "ok"}},
    }

    apply_end_card_state(state, end_session_immediately=True)

    assert state["dialogEnded"] is True
    assert state["sessionEnded"] is True
    assert state["variables"] == {}
    assert state["waitingNodeId"] == ""
    assert state["currentNodeId"] == ""


def test_runtime_completion_reason() -> None:
    assert runtime_completion_reason({"sessionEnded": True, "dialogEnded": True}) == "session_ended"
    assert runtime_completion_reason({"dialogEnded": True}) == "dialog_ended"
    assert runtime_completion_reason({"waitingNodeId": "talk-1"}) == "waiting_user_input"
    assert runtime_completion_reason({}) == "running"
