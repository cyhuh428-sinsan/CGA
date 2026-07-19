from __future__ import annotations

import re
from typing import Any

from app.core.version_documents import normalize_version_document


CONDITION_OPERATORS_REQUIRING_VALUE = {
    "equals",
    "not-equals",
    "contains",
    "greater-than",
    "greater-or-equal",
    "less-than",
    "less-or-equal",
    "regex",
}

SCRIPT_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_$][0-9A-Za-z_$]*$")

SYSTEM_VARIABLE_NAMES = {
    "input",
    "result",
    "_bot_hub_id",
    "_bot_hub_name",
    "_bot_id",
    "_bot_name",
    "_channel_id",
    "_date_time",
    "_dialog_id",
    "_dialog_start_time",
    "_id",
    "_msg",
    "_session_id",
    "_today",
    "_user_id",
    "_user_name",
    "_rag_answers",
    "_rag_answer_text",
    "_rag_answer_score",
    "_rag_answer_intent_id",
    "_rag_answer_intent_name",
    "_rag_answer_source_type",
    "_rag_answer_source_title",
    "_rag_answer_page",
    "_semantic_answers",
    "_semantic_answer_text",
    "_semantic_answer_score",
    "_semantic_answer_intent_id",
    "_semantic_answer_intent_name",
    "_semantic_answer_source_type",
    "_semantic_answer_source_title",
    "_semantic_answer_page",
    "_llm_answers",
    "_llm_answer_text",
    "_llm_answer_score",
    "_llm_answer_intent_id",
    "_llm_answer_intent_name",
    "_llm_answer_source_type",
    "_llm_answer_source_title",
    "_llm_answer_page",
}

SAVE_BLOCKING_ERROR_CODES = {
    "condition.branch_target_missing",
    "condition.branch_target_deleted",
    "function.output_missing",
    "function.flow_target_missing",
    "jump.card_target_missing",
    "jump.card_target_deleted",
    "jump.dialog_target_missing",
    "jump.dialog_target_deleted",
    "link.runtime_output_missing",
    "link.runtime_target_missing",
    "script.flow_target_missing",
}


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _text(value: Any) -> str:
    return str(value or "").strip()


def _variable_root(value: str) -> str:
    expression = _text(value)
    if expression.startswith("$"):
        expression = expression[1:].lstrip()
    for suffix in (".target()", ".value()"):
        if expression.endswith(suffix):
            expression = expression[: -len(suffix)]
    return expression.split(".", 1)[0]


def _template_variable_refs(value: Any) -> set[str]:
    text = str(value or "")
    return {_variable_root(match.group(1)) for match in re.finditer(r"\{\{\s*([^}]+?)\s*\}\}", text) if _variable_root(match.group(1))}


def _collect_text_refs(value: Any) -> set[str]:
    refs: set[str] = set()
    if isinstance(value, str):
        refs.update(_template_variable_refs(value))
    elif isinstance(value, list):
        for item in value:
            refs.update(_collect_text_refs(item))
    elif isinstance(value, dict):
        for item in value.values():
            refs.update(_collect_text_refs(item))
    return refs


def _add_variable_ref_error(
    items: list[dict[str, Any]],
    *,
    known_variables: set[str],
    reported_refs: set[tuple[str, str]],
    variable_name: str,
    graph: dict[str, Any],
    dialog: dict[str, Any] | None,
    node: dict[str, Any],
) -> None:
    root = _variable_root(variable_name)
    if not root or root in known_variables:
        return
    node_id = _text(node.get("id"))
    key = (node_id, root)
    if key in reported_refs:
        return
    reported_refs.add(key)
    items.append(
        _item(
            code="variable.reference_missing",
            message=f"대화 카드에서 정의되지 않은 변수 '${root}'를 사용하고 있습니다.",
            graph=graph,
            dialog=dialog,
            node=node,
        )
    )


def _dialog_name(dialog: dict[str, Any] | None, graph: dict[str, Any] | None) -> str:
    dialog = _as_dict(dialog)
    graph = _as_dict(graph)
    return _text(dialog.get("displayName") or dialog.get("name") or graph.get("name")) or "-"


def _item(
    *,
    code: str,
    message: str,
    graph: dict[str, Any] | None = None,
    dialog: dict[str, Any] | None = None,
    node: dict[str, Any] | None = None,
    severity: str = "error",
) -> dict[str, Any]:
    graph = _as_dict(graph)
    dialog = _as_dict(dialog)
    node = _as_dict(node)
    return {
        "severity": severity,
        "code": code,
        "message": message,
        "dialog_id": _text(dialog.get("id") or graph.get("dialogId")),
        "dialog_name": _dialog_name(dialog, graph),
        "graph_id": _text(graph.get("id")),
        "graph_name": _text(graph.get("name")),
        "node_id": _text(node.get("id")),
        "node_title": _text(node.get("title")),
        "node_kind": _text(node.get("kind")),
    }


def _dialog_by_id(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        _text(dialog.get("id")): dialog
        for dialog in _as_list(document.get("dialogs"))
        if isinstance(dialog, dict) and _text(dialog.get("id"))
    }


def _graph_by_dialog_id(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        _text(graph.get("dialogId")): graph
        for graph in _as_list(document.get("dialog_flow_graphs"))
        if isinstance(graph, dict) and _text(graph.get("dialogId"))
    }


def _graph_by_name(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        _text(graph.get("name")): graph
        for graph in _as_list(document.get("dialog_flow_graphs"))
        if isinstance(graph, dict) and _text(graph.get("name"))
    }


def _link_target(graph: dict[str, Any], node_id: str, source_port: str = "next") -> str:
    for link in _as_list(graph.get("links")):
        if not isinstance(link, dict):
            continue
        if _text(link.get("sourceNodeId")) == node_id and _text(link.get("sourcePort") or "next") == source_port:
            return _text(link.get("targetNodeId"))
    return ""


def _node_successor_ids(graph: dict[str, Any], node: dict[str, Any], node_ids: set[str]) -> list[str]:
    node_id = _text(node.get("id"))
    kind = _text(node.get("kind"))
    config = _as_dict(node.get("config"))
    successor_ids: list[str] = []
    if kind == "condition":
        for branch in _as_list(config.get("branches")):
            if isinstance(branch, dict):
                target_id = _link_target(graph, node_id, f"branch:{_text(branch.get('id'))}")
                if target_id:
                    successor_ids.append(target_id)
    elif kind == "jump":
        if _text(config.get("targetType")) == "card":
            successor_ids.append(_text(config.get("targetCardId")))
        elif _text(config.get("targetType")) == "dialog":
            successor_ids.append(_link_target(graph, node_id))
    else:
        successor_ids.append(_link_target(graph, node_id))
        if kind in {"variable", "function", "script"}:
            successor_ids.append(_link_target(graph, node_id, "exception"))
    return [successor_id for successor_id in successor_ids if successor_id in node_ids]


def _validate_start_flow(
    items: list[dict[str, Any]],
    *,
    graph: dict[str, Any],
    dialog: dict[str, Any] | None,
    nodes: list[dict[str, Any]],
    node_ids: set[str],
) -> None:
    start_nodes = [node for node in nodes if _text(node.get("kind")) == "start"]
    for node in start_nodes:
        target_id = _link_target(graph, _text(node.get("id")))
        if not target_id:
            items.append(_item(code="start.target_missing", message="Start 카드의 다음 연결 대상이 없습니다.", graph=graph, dialog=dialog, node=node))
        elif target_id not in node_ids:
            items.append(_item(code="start.target_deleted", message="Start 카드가 삭제된 카드로 연결되어 있습니다.", graph=graph, dialog=dialog, node=node))


def _reachable_node_ids(
    graph: dict[str, Any],
    nodes: list[dict[str, Any]],
    node_ids: set[str],
    *,
    include_start_on_broken_flow: bool = False,
) -> set[str]:
    start_node = next((node for node in nodes if _text(node.get("kind")) == "start"), None)
    if start_node is None:
        return set()
    start_id = _text(start_node.get("id"))
    first_target_id = _link_target(graph, start_id)
    if first_target_id not in node_ids:
        return {start_id} if include_start_on_broken_flow and start_id else set()
    reachable = {start_id}
    queue = [start_id]
    while queue:
        source_id = queue.pop(0)
        source_node = next((node for node in nodes if _text(node.get("id")) == source_id), None)
        if source_node is None:
            continue
        for target_id in _node_successor_ids(graph, source_node, node_ids):
            if target_id not in reachable:
                reachable.add(target_id)
                queue.append(target_id)
    return reachable


def _validate_reachable_flow(
    items: list[dict[str, Any]],
    *,
    graph: dict[str, Any],
    dialog: dict[str, Any] | None,
    nodes: list[dict[str, Any]],
    node_ids: set[str],
) -> None:
    _reachable_node_ids(graph, nodes, node_ids)
    # Cards outside the Start flow can be kept as reference fragments.
    # They are not runtime paths, so they must not block training or execution.


def _validate_runtime_output_targets(
    items: list[dict[str, Any]],
    *,
    graph: dict[str, Any],
    dialog: dict[str, Any] | None,
    nodes_by_id: dict[str, dict[str, Any]],
    reachable_node_ids: set[str],
) -> None:
    for node_id in reachable_node_ids:
        node = nodes_by_id.get(node_id)
        if node is None:
            continue
        kind = _text(node.get("kind"))
        if kind in {"start", "end", "condition", "function", "jump", "script"}:
            continue
        if not _link_target(graph, node_id):
            items.append(_item(code="link.runtime_output_missing", message="실행 경로의 카드에 다음 연결 대상이 없습니다.", graph=graph, dialog=dialog, node=node))


def _validate_terminal_flow(
    items: list[dict[str, Any]],
    *,
    graph: dict[str, Any],
    dialog: dict[str, Any] | None,
    nodes: list[dict[str, Any]],
    node_ids: set[str],
) -> None:
    start_node = next((node for node in nodes if _text(node.get("kind")) == "start"), None)
    if start_node is None:
        return
    first_target_id = _link_target(graph, _text(start_node.get("id")))
    if first_target_id not in node_ids:
        return
    reverse_links: dict[str, list[str]] = {}
    for node in nodes:
        source_id = _text(node.get("id"))
        if not source_id:
            continue
        for target_id in _node_successor_ids(graph, node, node_ids):
            reverse_links.setdefault(target_id, []).append(source_id)
    terminal_ids = [_text(node.get("id")) for node in nodes if _text(node.get("kind")) == "end" and _text(node.get("id"))]
    terminal_reachable: set[str] = set()
    queue = list(terminal_ids)
    while queue:
        node_id = queue.pop(0)
        if not node_id or node_id in terminal_reachable:
            continue
        terminal_reachable.add(node_id)
        for predecessor_id in reverse_links.get(node_id, []):
            if predecessor_id not in terminal_reachable:
                queue.append(predecessor_id)
    if _text(start_node.get("id")) not in terminal_reachable:
        items.append(_item(code="graph.terminal_path_missing", message="Start 카드에서 시작한 대화 흐름이 End 카드로 이어지지 않습니다.", graph=graph, dialog=dialog, node=start_node))


def _validate_immediate_loop_flow(
    items: list[dict[str, Any]],
    *,
    graph: dict[str, Any],
    dialog: dict[str, Any] | None,
    nodes: list[dict[str, Any]],
    node_ids: set[str],
) -> None:
    start_node = next((node for node in nodes if _text(node.get("kind")) == "start"), None)
    if start_node is None:
        return
    nodes_by_id = {_text(node.get("id")): node for node in nodes if _text(node.get("id"))}
    visited: set[str] = set()
    stack: list[str] = []

    def visit(node_id: str) -> dict[str, Any] | None:
        node = nodes_by_id.get(node_id)
        if node is None or _text(node.get("kind")) == "end":
            return None
        if node_id in stack:
            cycle_node_ids = stack[stack.index(node_id) :]
            has_user_wait = any(_text(nodes_by_id.get(cycle_node_id, {}).get("kind")) == "talk" for cycle_node_id in cycle_node_ids)
            return None if has_user_wait else node
        if node_id in visited:
            return None
        visited.add(node_id)
        stack.append(node_id)
        for successor_id in _node_successor_ids(graph, node, node_ids):
            loop_node = visit(successor_id)
            if loop_node is not None:
                return node if _text(node.get("kind")) == "jump" else loop_node
        stack.pop()
        return None

    loop_node = visit(_text(start_node.get("id")))
    if loop_node is not None:
        items.append(_item(code="graph.immediate_loop", message="사용자 응답 대기 없이 반복 실행되는 대화 흐름이 있습니다.", graph=graph, dialog=dialog, node=loop_node))


def _validate_condition(
    items: list[dict[str, Any]],
    *,
    graph: dict[str, Any],
    dialog: dict[str, Any] | None,
    node: dict[str, Any],
    node_ids: set[str],
) -> None:
    config = _as_dict(node.get("config"))
    if not _text(config.get("variableName")):
        items.append(_item(code="condition.variable_missing", message="Condition 카드의 조건 판단 변수가 없습니다.", graph=graph, dialog=dialog, node=node))

    branches = [branch for branch in _as_list(config.get("branches")) if isinstance(branch, dict)]
    else_branches = [branch for branch in branches if _text(branch.get("operator")) == "else"]
    if not else_branches:
        items.append(_item(code="condition.else_missing", message="Condition 카드에는 '그 외의 경우' 분기가 1개 이상 필요합니다.", graph=graph, dialog=dialog, node=node))
    for branch in branches:
        branch_id = _text(branch.get("id"))
        operator = _text(branch.get("operator"))
        target_id = _link_target(graph, _text(node.get("id")), f"branch:{branch_id}") if branch_id else ""
        if operator in CONDITION_OPERATORS_REQUIRING_VALUE and not _text(branch.get("compareValue")):
            items.append(_item(code="condition.compare_value_missing", message="Condition 분기의 비교값이 없습니다.", graph=graph, dialog=dialog, node=node))
        if not target_id:
            label = "그 외의 경우" if operator == "else" else "조건"
            items.append(_item(code="condition.branch_target_missing", message=f"Condition 카드의 {label} 분기 연결 대상이 없습니다.", graph=graph, dialog=dialog, node=node))
        elif target_id not in node_ids:
            items.append(_item(code="condition.branch_target_deleted", message="Condition 분기가 삭제된 카드로 연결되어 있습니다.", graph=graph, dialog=dialog, node=node))


def _validate_jump(
    items: list[dict[str, Any]],
    *,
    document: dict[str, Any],
    graph: dict[str, Any],
    dialog: dict[str, Any] | None,
    node: dict[str, Any],
    node_ids: set[str],
) -> None:
    config = _as_dict(node.get("config"))
    target_type = _text(config.get("targetType") or "dialog")
    if target_type == "card":
        target_card_id = _text(config.get("targetCardId"))
        if not target_card_id:
            items.append(_item(code="jump.card_target_missing", message="Jump 카드의 이동 대상 카드가 없습니다.", graph=graph, dialog=dialog, node=node))
        elif target_card_id not in node_ids:
            items.append(_item(code="jump.card_target_deleted", message="Jump 카드가 삭제된 카드로 연결되어 있습니다.", graph=graph, dialog=dialog, node=node))
        return

    target_dialog_id = _text(config.get("targetDialogId"))
    target_dialog_name = _text(config.get("targetDialogName"))
    graphs_by_dialog = _graph_by_dialog_id(document)
    graphs_by_name = _graph_by_name(document)
    if not target_dialog_id and not target_dialog_name:
        items.append(_item(code="jump.dialog_target_missing", message="Jump 카드의 이동 대상 의도/모듈이 없습니다.", graph=graph, dialog=dialog, node=node))
    elif target_dialog_id and target_dialog_id not in graphs_by_dialog:
        items.append(_item(code="jump.dialog_target_deleted", message="Jump 카드가 삭제되었거나 흐름이 없는 의도/모듈로 연결되어 있습니다.", graph=graph, dialog=dialog, node=node))
    elif target_dialog_name and target_dialog_name not in graphs_by_name:
        items.append(_item(code="jump.dialog_target_deleted", message="Jump 카드가 삭제되었거나 흐름이 없는 의도/모듈로 연결되어 있습니다.", graph=graph, dialog=dialog, node=node))


def _validate_function(
    items: list[dict[str, Any]],
    *,
    document: dict[str, Any],
    graph: dict[str, Any],
    dialog: dict[str, Any] | None,
    node: dict[str, Any],
) -> None:
    config = _as_dict(node.get("config"))
    api_id = _text(config.get("apiId"))
    method_id = _text(config.get("methodId"))
    apis: list[dict[str, Any]] = []
    for key in ("apis", "api_assets", "apiAssets"):
        apis = [api for api in _as_list(document.get(key)) if isinstance(api, dict)]
        if apis:
            break
    api = next((item for item in apis if _text(item.get("id")) == api_id), None)
    method = next((item for item in _as_list(_as_dict(api).get("methods")) if isinstance(item, dict) and _text(item.get("id")) == method_id), None)
    if not api_id or api is None:
        items.append(_item(code="function.api_missing", message="Function 카드에 연결된 API가 없습니다.", graph=graph, dialog=dialog, node=node))
    if not method_id or method is None:
        items.append(_item(code="function.method_missing", message="Function 카드에 연결된 API Method가 없습니다.", graph=graph, dialog=dialog, node=node))
    if method is not None and not _as_list(config.get("outputMappings")):
        items.append(_item(code="function.output_missing", message="Function 카드의 출력 Parameter가 선택되지 않았습니다.", graph=graph, dialog=dialog, node=node))
    if not _link_target(graph, _text(node.get("id")), "next") and not _link_target(graph, _text(node.get("id")), "exception"):
        items.append(_item(code="function.flow_target_missing", message="Function 카드 실행 이후 이동할 카드가 없습니다.", graph=graph, dialog=dialog, node=node))


def _validate_talk(
    items: list[dict[str, Any]],
    *,
    graph: dict[str, Any],
    dialog: dict[str, Any] | None,
    node: dict[str, Any],
) -> None:
    config = _as_dict(node.get("config"))
    message_type = _text(config.get("messageType") or "text")
    messages = [str(item or "") for item in _as_list(config.get("messages"))]
    first_message = _text(messages[0] if messages else "")
    if message_type == "html" and not first_message:
        items.append(_item(code="talk.html_missing", message="Talk 카드의 HTML 메시지가 없습니다.", graph=graph, dialog=dialog, node=node))
    if message_type == "form":
        if not first_message:
            items.append(_item(code="talk.form_missing", message="Talk 카드의 Form Message가 없습니다.", graph=graph, dialog=dialog, node=node))
        elif not first_message.startswith(("{", "[")):
            items.append(_item(code="talk.form_invalid_json", message="Talk 카드의 Form Message가 JSON 형식이 아닙니다.", graph=graph, dialog=dialog, node=node))
    if message_type == "form-a-card":
        if not first_message:
            items.append(_item(code="talk.form_a_card_missing", message="Talk 카드의 Form(A Card) 메시지가 없습니다.", graph=graph, dialog=dialog, node=node))
        elif not first_message.startswith(("{", "[")):
            items.append(_item(code="talk.form_a_card_invalid_json", message="Talk 카드의 Form(A Card) 메시지가 JSON 형식이 아닙니다.", graph=graph, dialog=dialog, node=node))
    if message_type == "card" and not first_message:
        items.append(_item(code="talk.card_title_missing", message="Talk 카드의 카드 타이틀이 없습니다.", graph=graph, dialog=dialog, node=node))
    if message_type == "carousel":
        if not first_message:
            items.append(_item(code="talk.carousel_title_missing", message="Talk 카드의 Carousel Title이 없습니다.", graph=graph, dialog=dialog, node=node))
        if not _text(messages[2] if len(messages) > 2 else ""):
            items.append(_item(code="talk.carousel_item_title_missing", message="Talk 카드의 Item Title이 없습니다.", graph=graph, dialog=dialog, node=node))
        if not _text(messages[3] if len(messages) > 3 else ""):
            items.append(_item(code="talk.carousel_item_contents_missing", message="Talk 카드의 Item Contents가 없습니다.", graph=graph, dialog=dialog, node=node))
    if message_type == "button" and any(not _text(message) for message in messages):
        items.append(_item(code="talk.button_missing", message="Talk 카드의 Button 값이 없습니다.", graph=graph, dialog=dialog, node=node))
    if message_type == "table" and config.get("tableUseVariable") is True and not _text(config.get("tableVariableItemId")):
        items.append(_item(code="talk.table_variable_missing", message="Talk 카드의 리스트 변수가 선택되지 않았습니다.", graph=graph, dialog=dialog, node=node))
    if message_type == "link-button":
        for item in _as_list(config.get("linkButtonItems")):
            if not isinstance(item, dict):
                continue
            if not _text(item.get("label")):
                items.append(_item(code="talk.link_button_label_missing", message="Talk 카드의 Link Button Label이 없습니다.", graph=graph, dialog=dialog, node=node))
            if not _text(item.get("url")):
                items.append(_item(code="talk.link_button_url_missing", message="Talk 카드의 Link Button URL이 없습니다.", graph=graph, dialog=dialog, node=node))

    response_type = _text(config.get("responseType"))
    if response_type == "extract-entity" and len(_as_list(config.get("responseEntityBindingIds"))) == 0:
        items.append(_item(code="talk.entity_extraction_missing", message="Talk 카드의 추출할 개체가 선택되지 않았습니다.", graph=graph, dialog=dialog, node=node))
    if response_type in {"relay", "single-select", "form-relay"} and not _variable_root(str(config.get("responseVariableName") or "")):
        items.append(_item(code="talk.response_variable_missing", message="Talk 카드의 응답 저장 변수가 없습니다.", graph=graph, dialog=dialog, node=node))


def _validate_script(
    items: list[dict[str, Any]],
    *,
    graph: dict[str, Any],
    dialog: dict[str, Any] | None,
    node: dict[str, Any],
) -> None:
    config = _as_dict(node.get("config"))
    if not _link_target(graph, _text(node.get("id")), "next"):
        items.append(_item(code="script.flow_target_missing", message="Script 카드 실행 이후 이동할 카드가 없습니다.", graph=graph, dialog=dialog, node=node))
    if not _text(config.get("code")):
        items.append(_item(code="script.code_missing", message="Script 카드의 스크립트 코드가 없습니다.", graph=graph, dialog=dialog, node=node))
    for parameter in _as_list(config.get("parameters")):
        if not isinstance(parameter, dict):
            continue
        name = _text(parameter.get("name"))
        if not name:
            items.append(_item(code="script.parameter_name_missing", message="Script 카드의 파라미터명이 없습니다.", graph=graph, dialog=dialog, node=node))
        elif not SCRIPT_IDENTIFIER_PATTERN.match(name):
            items.append(_item(code="script.parameter_name_invalid", message="Script 카드의 파라미터명이 JavaScript 변수명 규칙에 맞지 않습니다.", graph=graph, dialog=dialog, node=node))
    for return_variable in _as_list(config.get("returnVariables")):
        if not isinstance(return_variable, dict):
            continue
        variable_name = _variable_root(str(return_variable.get("variableName") or ""))
        script_variable_name = _text(return_variable.get("scriptVariableName"))
        if not variable_name:
            items.append(_item(code="script.return_variable_missing", message="Script 카드의 리턴 변수명이 없습니다.", graph=graph, dialog=dialog, node=node))
        if not script_variable_name:
            items.append(_item(code="script.return_script_variable_missing", message="Script 카드의 스크립트 변수명이 없습니다.", graph=graph, dialog=dialog, node=node))
        elif not SCRIPT_IDENTIFIER_PATTERN.match(script_variable_name):
            items.append(_item(code="script.return_script_variable_invalid", message="Script 카드의 스크립트 변수명이 JavaScript 변수명 규칙에 맞지 않습니다.", graph=graph, dialog=dialog, node=node))


def _collect_declared_variables(document: dict[str, Any]) -> set[str]:
    variables = set(SYSTEM_VARIABLE_NAMES)
    for graph in _as_list(document.get("dialog_flow_graphs")):
        if not isinstance(graph, dict):
            continue
        for node in _as_list(graph.get("nodes")):
            if not isinstance(node, dict):
                continue
            config = _as_dict(node.get("config"))
            kind = _text(node.get("kind"))
            if kind == "variable":
                for item in _as_list(config.get("items")):
                    if isinstance(item, dict):
                        root = _variable_root(str(item.get("variableName") or ""))
                        if root:
                            variables.add(root)
            if kind == "script":
                for item in _as_list(config.get("returnVariables")):
                    if isinstance(item, dict):
                        root = _variable_root(str(item.get("variableName") or ""))
                        if root:
                            variables.add(root)
            if kind == "function":
                result_root = _variable_root(str(config.get("resultVariableName") or "apiResult"))
                if result_root:
                    variables.add(result_root)
                for item in _as_list(config.get("outputMappings")):
                    if isinstance(item, dict):
                        root = _variable_root(str(item.get("variableName") or ""))
                        if root:
                            variables.add(root)
            if kind == "talk":
                response_root = _variable_root(str(config.get("responseVariableName") or ""))
                if response_root:
                    variables.add(response_root)
                for extraction in _as_list(config.get("responseEntityExtractions")):
                    if isinstance(extraction, dict):
                        root = _variable_root(str(extraction.get("variableName") or ""))
                        if root:
                            variables.add(root)
    return variables


def _validate_variable_references(
    items: list[dict[str, Any]],
    *,
    graph: dict[str, Any],
    dialog: dict[str, Any] | None,
    node: dict[str, Any],
    known_variables: set[str],
    reported_refs: set[tuple[str, str]],
) -> None:
    config = _as_dict(node.get("config"))
    kind = _text(node.get("kind"))
    refs = _collect_text_refs(config)
    if kind == "condition":
        refs.add(_variable_root(str(config.get("variableName") or "")))
    if kind == "function":
        for mapping in _as_list(config.get("parameterMappings")):
            if isinstance(mapping, dict):
                refs.update(_template_variable_refs(mapping.get("value")))
    for ref in sorted(refs):
        _add_variable_ref_error(items, known_variables=known_variables, reported_refs=reported_refs, variable_name=ref, graph=graph, dialog=dialog, node=node)


def validate_version_document(version_json: dict[str, Any] | None) -> dict[str, Any]:
    document = normalize_version_document(version_json or {})
    dialogs = _dialog_by_id(document)
    known_variables = _collect_declared_variables(document)
    reported_variable_refs: set[tuple[str, str]] = set()
    items: list[dict[str, Any]] = []

    for graph in _as_list(document.get("dialog_flow_graphs")):
        if not isinstance(graph, dict):
            continue
        dialog_id = _text(graph.get("dialogId"))
        dialog = dialogs.get(dialog_id)
        if dialog_id and dialog is None:
            # Orphaned flow graphs can remain after an intent/module is removed.
            # They are not executable from the visible intent/module list, so they
            # must not block training or runtime. Keep them out of error_count.
            continue
        nodes = [node for node in _as_list(graph.get("nodes")) if isinstance(node, dict)]
        node_ids = {_text(node.get("id")) for node in nodes if _text(node.get("id"))}
        if not nodes:
            items.append(_item(code="graph.nodes_missing", message="대화 흐름에 카드가 없습니다.", graph=graph, dialog=dialog))
            continue
        _validate_start_flow(items, graph=graph, dialog=dialog, nodes=nodes, node_ids=node_ids)
        reachable_node_ids = _reachable_node_ids(graph, nodes, node_ids, include_start_on_broken_flow=True)
        _validate_reachable_flow(items, graph=graph, dialog=dialog, nodes=nodes, node_ids=node_ids)
        _validate_immediate_loop_flow(items, graph=graph, dialog=dialog, nodes=nodes, node_ids=node_ids)
        _validate_terminal_flow(items, graph=graph, dialog=dialog, nodes=nodes, node_ids=node_ids)
        nodes_by_id = {_text(node.get("id")): node for node in nodes if _text(node.get("id"))}
        _validate_runtime_output_targets(items, graph=graph, dialog=dialog, nodes_by_id=nodes_by_id, reachable_node_ids=reachable_node_ids)
        for link in _as_list(graph.get("links")):
            if not isinstance(link, dict):
                continue
            source_id = _text(link.get("sourceNodeId"))
            if source_id not in reachable_node_ids:
                continue
            source_node = nodes_by_id.get(source_id)
            if source_node is None:
                continue
            if _text(source_node.get("kind")) == "condition":
                continue
            if _text(link.get("targetNodeId")) not in node_ids:
                items.append(_item(code="link.runtime_target_missing", message="실행 경로의 연결선이 삭제된 카드로 연결되어 있습니다.", graph=graph, dialog=dialog, node=source_node))
        for node in nodes:
            node_id = _text(node.get("id"))
            if node_id and node_id not in reachable_node_ids and _text(node.get("kind")) != "start":
                continue
            kind = _text(node.get("kind"))
            _validate_variable_references(items, graph=graph, dialog=dialog, node=node, known_variables=known_variables, reported_refs=reported_variable_refs)
            if kind == "condition":
                _validate_condition(items, graph=graph, dialog=dialog, node=node, node_ids=node_ids)
            elif kind == "jump":
                _validate_jump(items, document=document, graph=graph, dialog=dialog, node=node, node_ids=node_ids)
            elif kind == "function":
                _validate_function(items, document=document, graph=graph, dialog=dialog, node=node)
            elif kind == "talk":
                _validate_talk(items, graph=graph, dialog=dialog, node=node)
            elif kind == "script":
                _validate_script(items, graph=graph, dialog=dialog, node=node)

    errors = [item for item in items if item.get("severity") == "error"]
    warnings = [item for item in items if item.get("severity") == "warning"]
    save_blocking_items = [item for item in errors if str(item.get("code") or "") in SAVE_BLOCKING_ERROR_CODES]
    blocked_dialog_ids = sorted({_text(item.get("dialog_id")) for item in errors if _text(item.get("dialog_id"))})
    save_blocked_dialog_ids = sorted({_text(item.get("dialog_id")) for item in save_blocking_items if _text(item.get("dialog_id"))})
    return {
        "status": "error" if errors else "ok",
        "error_count": len(errors),
        "warning_count": len(warnings),
        "save_blocking_error_count": len(save_blocking_items),
        "blocked_dialog_ids": blocked_dialog_ids,
        "save_blocked_dialog_ids": save_blocked_dialog_ids,
        "save_blocking_items": save_blocking_items,
        "items": items,
    }


def attach_scenario_validation(version_json: dict[str, Any] | None) -> dict[str, Any]:
    document = normalize_version_document(version_json or {})
    system_config = dict(document.get("system_config") or {})
    system_config["scenario_validation"] = validate_version_document(document)
    document["system_config"] = system_config
    return document


def scenario_validation_from_version(version_json: dict[str, Any] | None) -> dict[str, Any]:
    document = normalize_version_document(version_json or {})
    return validate_version_document(document)


def scenario_validation_error_detail(diagnostics: dict[str, Any]) -> str:
    first_error = next(
        (item for item in _as_list(diagnostics.get("items")) if _as_dict(item).get("severity") == "error"),
        None,
    )
    if not isinstance(first_error, dict):
        return "대화 설계 오류가 있습니다."

    dialog_name = _text(first_error.get("dialog_name") or first_error.get("dialogName") or first_error.get("graph_name") or first_error.get("graphName"))
    node_title = _text(first_error.get("node_title") or first_error.get("nodeTitle"))
    message = _text(first_error.get("message"))
    code = _text(first_error.get("code"))
    location = " / ".join(item for item in (dialog_name, node_title) if item)
    detail = message or code or "대화 설계 오류가 있습니다."
    if location:
        detail = f"{location}: {detail}"
    return detail


def scenario_validation_block_reason(diagnostics: dict[str, Any]) -> str:
    detail = scenario_validation_error_detail(diagnostics)
    return f"대화 설계 오류가 있는 운영버전은 실행할 수 없습니다. {detail} 오류를 수정한 뒤 다시 학습/운영 지정해주세요."


def has_scenario_errors(version_json: dict[str, Any] | None) -> bool:
    return int(scenario_validation_from_version(version_json).get("error_count") or 0) > 0


def save_blocking_scenario_items(validation: dict[str, Any]) -> list[dict[str, Any]]:
    items = validation.get("save_blocking_items")
    if isinstance(items, list):
        return [item for item in items if isinstance(item, dict)]
    return [
        item
        for item in _as_list(validation.get("items"))
        if isinstance(item, dict) and str(item.get("code") or "") in SAVE_BLOCKING_ERROR_CODES
    ]
