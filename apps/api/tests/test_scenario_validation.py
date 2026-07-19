from app.services.scenario_validation import scenario_validation_block_reason, scenario_validation_error_detail, validate_version_document


def _dialog(dialog_id: str = "dialog-1") -> dict[str, object]:
    return {
        "id": dialog_id,
        "name": "테스트 모듈",
        "displayName": "테스트 모듈",
        "dialogType": 0,
    }


def _document(nodes: list[dict[str, object]], links: list[dict[str, object]], *, apis: list[dict[str, object]] | None = None) -> dict[str, object]:
    return {
        "dialogs": [_dialog()],
        "dialog_flow_graphs": [
            {
                "id": "graph-1",
                "dialogId": "dialog-1",
                "name": "테스트 모듈",
                "nodes": nodes,
                "links": links,
            }
        ],
        "apis": apis or [],
    }


def _codes(result: dict[str, object]) -> set[str]:
    return {str(item.get("code")) for item in result.get("items", []) if isinstance(item, dict)}


def test_condition_requires_else_branch_and_targets() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {
                    "id": "condition-1",
                    "kind": "condition",
                    "title": "분기",
                    "config": {
                        "variableName": "$input",
                        "branches": [
                            {"id": "branch-1", "operator": "equals", "label": "조건 1", "compareValue": "Y"},
                        ],
                    },
                },
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "condition-1"},
                {"sourceNodeId": "condition-1", "sourcePort": "branch:branch-1", "targetNodeId": "end-1"},
            ],
        )
    )

    assert result["error_count"] == 1
    assert _codes(result) == {"condition.else_missing"}
    assert result["blocked_dialog_ids"] == ["dialog-1"]
    assert result["save_blocking_error_count"] == 0
    assert result["save_blocked_dialog_ids"] == []


def test_scenario_validation_block_reason_includes_location() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {
                    "id": "condition-1",
                    "kind": "condition",
                    "title": "분기",
                    "config": {
                        "variableName": "$input",
                        "branches": [
                            {"id": "branch-1", "operator": "equals", "label": "조건 1", "compareValue": "Y"},
                        ],
                    },
                },
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "condition-1"},
                {"sourceNodeId": "condition-1", "sourcePort": "branch:branch-1", "targetNodeId": "end-1"},
            ],
        )
    )

    reason = scenario_validation_block_reason(result)

    assert "대화 설계 오류가 있는 운영버전은 실행할 수 없습니다." in reason
    assert "테스트 모듈 / 분기" in reason
    assert "Condition 카드에는 '그 외의 경우' 분기가 1개 이상 필요합니다." in reason
    assert scenario_validation_error_detail(result) == "테스트 모듈 / 분기: Condition 카드에는 '그 외의 경우' 분기가 1개 이상 필요합니다."


def test_jump_missing_target_blocks_dialog() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {
                    "id": "jump-1",
                    "kind": "jump",
                    "title": "이동",
                    "config": {"targetType": "card", "targetCardId": "deleted-card"},
                },
            ],
            [{"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "jump-1"}],
        )
    )

    codes = _codes(result)
    assert result["error_count"] == 2
    assert "jump.card_target_deleted" in codes
    assert "graph.terminal_path_missing" in codes
    assert result["blocked_dialog_ids"] == ["dialog-1"]
    assert result["save_blocking_error_count"] == 1
    assert result["save_blocked_dialog_ids"] == ["dialog-1"]
    assert [item["code"] for item in result["save_blocking_items"]] == ["jump.card_target_deleted"]


def test_function_missing_method_and_output_flow_block_dialog() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {
                    "id": "function-1",
                    "kind": "function",
                    "title": "API 호출",
                    "config": {"apiId": "api-1", "methodId": "deleted-method"},
                },
            ],
            [{"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "function-1"}],
            apis=[{"id": "api-1", "methods": [{"id": "method-1"}]}],
        )
    )

    codes = _codes(result)
    assert result["error_count"] == 3
    assert "function.method_missing" in codes
    assert "function.flow_target_missing" in codes
    assert "graph.terminal_path_missing" in codes
    assert result["blocked_dialog_ids"] == ["dialog-1"]
    assert result["save_blocking_error_count"] == 1
    assert result["save_blocked_dialog_ids"] == ["dialog-1"]
    assert [item["code"] for item in result["save_blocking_items"]] == ["function.flow_target_missing"]


def test_function_missing_api_blocks_dialog_without_blocking_save() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {
                    "id": "function-1",
                    "kind": "function",
                    "title": "API 호출",
                    "config": {"apiId": "", "methodId": ""},
                },
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "function-1"},
                {"sourceNodeId": "function-1", "sourcePort": "next", "targetNodeId": "end-1"},
            ],
        )
    )

    codes = _codes(result)
    assert result["error_count"] == 2
    assert "function.api_missing" in codes
    assert "function.method_missing" in codes
    assert result["blocked_dialog_ids"] == ["dialog-1"]
    assert result["save_blocking_error_count"] == 0
    assert result["save_blocked_dialog_ids"] == []


def test_function_missing_output_mapping_blocks_dialog() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {
                    "id": "function-1",
                    "kind": "function",
                    "title": "API 호출",
                    "config": {"apiId": "api-1", "methodId": "method-1", "outputMappings": []},
                },
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "function-1"},
                {"sourceNodeId": "function-1", "sourcePort": "next", "targetNodeId": "end-1"},
            ],
            apis=[{"id": "api-1", "methods": [{"id": "method-1"}]}],
        )
    )

    assert result["error_count"] == 1
    assert _codes(result) == {"function.output_missing"}
    assert result["blocked_dialog_ids"] == ["dialog-1"]
    assert result["save_blocking_error_count"] == 1
    assert result["save_blocked_dialog_ids"] == ["dialog-1"]
    assert [item["code"] for item in result["save_blocking_items"]] == ["function.output_missing"]


def test_condition_branch_target_missing_blocks_save() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {
                    "id": "condition-1",
                    "kind": "condition",
                    "title": "분기",
                    "config": {
                        "variableName": "$input",
                        "branches": [
                            {"id": "branch-1", "operator": "equals", "label": "조건 1", "compareValue": "Y"},
                            {"id": "branch-else", "operator": "else", "label": "그 외의 경우"},
                        ],
                    },
                },
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "condition-1"},
                {"sourceNodeId": "condition-1", "sourcePort": "branch:branch-else", "targetNodeId": "end-1"},
            ],
        )
    )

    assert "condition.branch_target_missing" in _codes(result)
    assert result["save_blocking_error_count"] == 1
    assert result["save_blocked_dialog_ids"] == ["dialog-1"]
    assert [item["code"] for item in result["save_blocking_items"]] == ["condition.branch_target_missing"]


def test_condition_branch_target_deleted_blocks_save() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {
                    "id": "condition-1",
                    "kind": "condition",
                    "title": "분기",
                    "config": {
                        "variableName": "$input",
                        "branches": [
                            {"id": "branch-1", "operator": "equals", "label": "조건 1", "compareValue": "Y"},
                            {"id": "branch-else", "operator": "else", "label": "그 외의 경우"},
                        ],
                    },
                },
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "condition-1"},
                {"sourceNodeId": "condition-1", "sourcePort": "branch:branch-1", "targetNodeId": "deleted-card"},
                {"sourceNodeId": "condition-1", "sourcePort": "branch:branch-else", "targetNodeId": "end-1"},
            ],
        )
    )

    assert "condition.branch_target_deleted" in _codes(result)
    assert result["save_blocking_error_count"] == 1
    assert result["save_blocked_dialog_ids"] == ["dialog-1"]
    assert [item["code"] for item in result["save_blocking_items"]] == ["condition.branch_target_deleted"]


def test_orphan_graph_does_not_create_hidden_error_count() -> None:
    result = validate_version_document(
        {
            "dialogs": [],
            "dialog_flow_graphs": [
                {
                    "id": "orphan-graph",
                    "dialogId": "deleted-dialog",
                    "name": "삭제된 모듈",
                    "nodes": [
                        {
                            "id": "function-1",
                            "kind": "function",
                            "title": "API 호출",
                            "config": {},
                        }
                    ],
                    "links": [],
                }
            ],
        }
    )

    assert result["error_count"] == 0
    assert result["blocked_dialog_ids"] == []


def test_start_card_requires_existing_next_target_when_present() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {"id": "talk-1", "kind": "talk", "title": "Talk", "config": {}},
            ],
            [],
        )
    )

    assert result["error_count"] == 1
    assert _codes(result) == {"start.target_missing"}
    assert result["blocked_dialog_ids"] == ["dialog-1"]


def test_reference_fragment_does_not_block_dialog() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {"id": "talk-1", "kind": "talk", "title": "Talk 1", "config": {}},
                {"id": "talk-2", "kind": "talk", "title": "Talk 2", "config": {}},
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "talk-1"},
                {"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"},
            ],
        )
    )

    assert result["error_count"] == 0
    assert _codes(result) == set()
    assert result["blocked_dialog_ids"] == []


def test_start_flow_requires_terminal_path() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {"id": "talk-1", "kind": "talk", "title": "Talk", "config": {}},
            ],
            [{"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "talk-1"}],
        )
    )

    assert result["error_count"] == 2
    assert _codes(result) == {"graph.terminal_path_missing", "link.runtime_output_missing"}
    assert result["items"][0]["node_id"] == "start-1"
    assert result["blocked_dialog_ids"] == ["dialog-1"]
    assert result["save_blocking_error_count"] == 1
    assert result["save_blocked_dialog_ids"] == ["dialog-1"]


def test_runtime_card_missing_output_blocks_save() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {"id": "talk-1", "kind": "talk", "title": "Talk", "config": {"messages": ["안녕하세요"]}},
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [{"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "talk-1"}],
        )
    )

    assert "link.runtime_output_missing" in _codes(result)
    assert result["save_blocking_error_count"] == 1
    assert result["save_blocked_dialog_ids"] == ["dialog-1"]
    assert [item["code"] for item in result["save_blocking_items"]] == ["link.runtime_output_missing"]


def test_runtime_link_deleted_target_blocks_save() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {"id": "talk-1", "kind": "talk", "title": "Talk", "config": {}},
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "talk-1"},
                {"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "deleted-card"},
            ],
        )
    )

    assert "link.runtime_target_missing" in _codes(result)
    assert result["save_blocking_error_count"] == 1
    assert result["save_blocked_dialog_ids"] == ["dialog-1"]
    assert [item["code"] for item in result["save_blocking_items"]] == ["link.runtime_target_missing"]


def test_reference_fragment_deleted_link_does_not_block_dialog() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {"id": "talk-1", "kind": "talk", "title": "Talk 1", "config": {}},
                {"id": "talk-ref", "kind": "talk", "title": "참조 Talk", "config": {}},
                {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "talk-1"},
                {"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"},
                {"sourceNodeId": "talk-ref", "sourcePort": "next", "targetNodeId": "deleted-card"},
            ],
        )
    )

    assert result["error_count"] == 0
    assert result["save_blocking_error_count"] == 0
    assert result["blocked_dialog_ids"] == []


def test_start_flow_flags_immediate_loop_without_talk_wait() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {
                    "id": "jump-1",
                    "kind": "jump",
                    "title": "Jump",
                    "config": {"targetType": "card", "targetCardId": "jump-1"},
                },
            ],
            [{"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "jump-1"}],
        )
    )

    codes = _codes(result)
    assert "graph.immediate_loop" in codes
    assert "graph.terminal_path_missing" in codes
    assert result["blocked_dialog_ids"] == ["dialog-1"]


def test_script_card_design_errors_block_dialog() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {
                    "id": "script-1",
                    "kind": "script",
                    "title": "스크립트",
                    "config": {
                        "code": "",
                        "parameters": [{"id": "param-1", "name": "1invalid"}],
                        "returnVariables": [
                            {"id": "return-1", "variableName": "", "scriptVariableName": ""},
                            {"id": "return-2", "variableName": "$ok", "scriptVariableName": "bad-name"},
                        ],
                    },
                },
            ],
            [{"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "script-1"}],
        )
    )

    codes = _codes(result)
    assert "script.flow_target_missing" in codes
    assert "script.code_missing" in codes
    assert "script.parameter_name_invalid" in codes
    assert "script.return_variable_missing" in codes
    assert "script.return_script_variable_missing" in codes
    assert "script.return_script_variable_invalid" in codes
    assert result["blocked_dialog_ids"] == ["dialog-1"]


def test_talk_card_design_errors_block_dialog() -> None:
    result = validate_version_document(
        _document(
            [
                {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
                {
                    "id": "talk-form",
                    "kind": "talk",
                    "title": "폼",
                    "config": {
                        "messageType": "form",
                        "messages": ["not-json"],
                        "responseType": "form-relay",
                        "responseVariableName": "",
                    },
                },
                {
                    "id": "talk-link",
                    "kind": "talk",
                    "title": "링크",
                    "config": {
                        "messageType": "link-button",
                        "messages": [],
                        "linkButtonItems": [{"id": "link-1", "label": "", "url": ""}],
                        "responseType": "extract-entity",
                        "responseEntityBindingIds": [],
                    },
                },
            ],
            [
                {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "talk-form"},
                {"sourceNodeId": "talk-form", "sourcePort": "next", "targetNodeId": "talk-link"},
            ],
        )
    )

    codes = _codes(result)
    assert "talk.form_invalid_json" in codes
    assert "talk.response_variable_missing" in codes
    assert "talk.link_button_label_missing" in codes
    assert "talk.link_button_url_missing" in codes
    assert "talk.entity_extraction_missing" in codes
    assert result["blocked_dialog_ids"] == ["dialog-1"]
