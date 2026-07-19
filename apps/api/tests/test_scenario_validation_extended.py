"""
시나리오 검증 확장 테스트 — 다양한 카드 타입과 경계 케이스 검증
"""
from __future__ import annotations

from app.services.scenario_validation import validate_version_document


def _graph(nodes, links, *, dialog_id="dialog-1", dialog_name="테스트 모듈"):
    return {
        "dialogs": [{"id": dialog_id, "name": dialog_name, "dialogType": 0}],
        "dialog_flow_graphs": [
            {
                "id": "graph-1",
                "dialogId": dialog_id,
                "name": dialog_name,
                "nodes": nodes,
                "links": links,
            }
        ],
        "apis": [],
    }


def _codes(result):
    return {str(item.get("code")) for item in result.get("items", []) if isinstance(item, dict)}


# ---------------------------------------------------------------------------
# 정상 시나리오
# ---------------------------------------------------------------------------

def test_valid_start_talk_end_flow_passes() -> None:
    result = validate_version_document(
        _graph(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {"id": "talk-1", "kind": "talk", "title": "안녕하세요", "config": {}},
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "talk-1"},
                {"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"},
            ],
        )
    )
    assert result["error_count"] == 0
    assert result["blocked_dialog_ids"] == []


def test_empty_document_has_no_errors() -> None:
    result = validate_version_document({"dialogs": [], "dialog_flow_graphs": [], "apis": []})
    assert result["error_count"] == 0


# ---------------------------------------------------------------------------
# Start 카드
# ---------------------------------------------------------------------------

def test_start_card_without_next_link_blocks_dialog() -> None:
    result = validate_version_document(
        _graph(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [],
        )
    )
    assert "start.target_missing" in _codes(result)
    assert "dialog-1" in result["blocked_dialog_ids"]


# ---------------------------------------------------------------------------
# Condition 카드
# ---------------------------------------------------------------------------

def test_condition_with_else_and_targets_passes() -> None:
    result = validate_version_document(
        _graph(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {
                    "id": "cond-1",
                    "kind": "condition",
                    "title": "분기",
                    "config": {
                        "variableName": "$input",
                        "branches": [
                            {"id": "b-1", "operator": "equals", "label": "Y", "compareValue": "Y"},
                            {"id": "b-else", "operator": "else", "label": "그 외"},
                        ],
                    },
                },
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
                {"id": "end-2", "kind": "end", "title": "End2", "config": {}},
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "cond-1"},
                {"sourceNodeId": "cond-1", "sourcePort": "branch:b-1", "targetNodeId": "end-1"},
                {"sourceNodeId": "cond-1", "sourcePort": "branch:b-else", "targetNodeId": "end-2"},
            ],
        )
    )
    assert result["error_count"] == 0


def test_condition_without_else_blocks_dialog() -> None:
    result = validate_version_document(
        _graph(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {
                    "id": "cond-1",
                    "kind": "condition",
                    "title": "분기",
                    "config": {
                        "variableName": "$x",
                        "branches": [{"id": "b-1", "operator": "equals", "label": "Y", "compareValue": "Y"}],
                    },
                },
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "cond-1"},
                {"sourceNodeId": "cond-1", "sourcePort": "branch:b-1", "targetNodeId": "end-1"},
            ],
        )
    )
    assert "condition.else_missing" in _codes(result)
    assert "dialog-1" in result["blocked_dialog_ids"]


# ---------------------------------------------------------------------------
# Jump 카드
# ---------------------------------------------------------------------------

def test_jump_to_existing_card_passes() -> None:
    result = validate_version_document(
        _graph(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {"id": "talk-1", "kind": "talk", "title": "Talk", "config": {}},
                {"id": "jump-1", "kind": "jump", "title": "이동", "config": {"targetType": "card", "targetCardId": "talk-1"}},
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "talk-1"},
                {"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"},
            ],
        )
    )
    assert "jump.card_target_deleted" not in _codes(result)


def test_jump_to_deleted_card_blocks_save() -> None:
    result = validate_version_document(
        _graph(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {"id": "jump-1", "kind": "jump", "title": "이동", "config": {"targetType": "card", "targetCardId": "gone-card"}},
            ],
            [{"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "jump-1"}],
        )
    )
    assert "jump.card_target_deleted" in _codes(result)
    assert result["save_blocking_error_count"] >= 1


# ---------------------------------------------------------------------------
# 루프 감지
# ---------------------------------------------------------------------------

def test_immediate_self_loop_detected() -> None:
    result = validate_version_document(
        _graph(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {"id": "jump-1", "kind": "jump", "title": "자기참조", "config": {"targetType": "card", "targetCardId": "jump-1"}},
            ],
            [{"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "jump-1"}],
        )
    )
    assert "graph.immediate_loop" in _codes(result)


# ---------------------------------------------------------------------------
# 고아 그래프 (삭제된 dialog에 속한 graph)
# ---------------------------------------------------------------------------

def test_orphan_graph_skipped_from_error_count() -> None:
    result = validate_version_document(
        {
            "dialogs": [],
            "dialog_flow_graphs": [
                {
                    "id": "orphan-graph",
                    "dialogId": "deleted-dialog",
                    "name": "삭제됨",
                    "nodes": [{"id": "fn-1", "kind": "function", "title": "API 호출", "config": {}}],
                    "links": [],
                }
            ],
            "apis": [],
        }
    )
    assert result["error_count"] == 0


# ---------------------------------------------------------------------------
# 저장 차단 vs 실행 차단 구분
# ---------------------------------------------------------------------------

def test_condition_else_missing_does_not_block_save() -> None:
    result = validate_version_document(
        _graph(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {
                    "id": "cond-1",
                    "kind": "condition",
                    "title": "분기",
                    "config": {
                        "variableName": "$x",
                        "branches": [{"id": "b-1", "operator": "equals", "label": "Y", "compareValue": "Y"}],
                    },
                },
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "cond-1"},
                {"sourceNodeId": "cond-1", "sourcePort": "branch:b-1", "targetNodeId": "end-1"},
            ],
        )
    )
    # condition.else_missing은 실행 차단이지만 저장은 허용
    assert "condition.else_missing" in _codes(result)
    assert result["save_blocking_error_count"] == 0
