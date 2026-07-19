from __future__ import annotations

from app.core.version_storage import build_version_dialog_asset_rows, build_version_dialog_flow_graph_rows


def test_build_version_dialog_asset_rows_extracts_table_fields() -> None:
    document = {
        "dialogs": [
            {"id": "module-1", "dialogType": 0, "name": "모듈", "displayName": "모듈 표시"},
            {"id": "intent-1", "dialogType": "1", "dialogName": "해지"},
            {"id": "unknown-1", "dialogType": 99, "intent_name": "기타"},
            {"dialogType": 1, "name": "id 없음"},
            "invalid",
        ]
    }

    rows = build_version_dialog_asset_rows(document)

    assert rows == [
        {
            "dialog_id": "module-1",
            "kind": "module",
            "name": "모듈",
            "display_name": "모듈 표시",
            "payload_json": {"id": "module-1", "dialogType": 0, "name": "모듈", "displayName": "모듈 표시"},
            "sort_order": 0,
        },
        {
            "dialog_id": "intent-1",
            "kind": "intent",
            "name": "해지",
            "display_name": "해지",
            "payload_json": {"id": "intent-1", "dialogType": "1", "dialogName": "해지"},
            "sort_order": 1,
        },
        {
            "dialog_id": "unknown-1",
            "kind": "dialog",
            "name": "기타",
            "display_name": "기타",
            "payload_json": {"id": "unknown-1", "dialogType": 99, "intent_name": "기타"},
            "sort_order": 2,
        },
    ]


def test_build_version_dialog_asset_rows_does_not_mutate_source() -> None:
    document = {"dialogs": [{"id": "intent-1", "dialogType": 1, "name": "해지"}]}

    rows = build_version_dialog_asset_rows(document)
    rows[0]["payload_json"]["name"] = "변경"

    assert document["dialogs"][0]["name"] == "해지"


def test_build_version_dialog_flow_graph_rows_extracts_graphs() -> None:
    document = {
        "dialog_flow_graphs": [
            {"dialogId": "intent-1", "nodes": [], "links": []},
            {"dialog_id": "intent-2", "nodes": [{"id": "start"}]},
            {"nodes": []},
            "invalid",
        ]
    }

    rows = build_version_dialog_flow_graph_rows(document)

    assert rows == [
        {
            "dialog_id": "intent-1",
            "payload_json": {"dialogId": "intent-1", "nodes": [], "links": []},
        },
        {
            "dialog_id": "intent-2",
            "payload_json": {"dialog_id": "intent-2", "nodes": [{"id": "start"}]},
        },
    ]


def test_build_version_dialog_flow_graph_rows_does_not_mutate_source() -> None:
    document = {"dialog_flow_graphs": [{"dialogId": "intent-1", "nodes": [{"id": "start"}]}]}

    rows = build_version_dialog_flow_graph_rows(document)
    rows[0]["payload_json"]["nodes"][0]["id"] = "changed"

    assert document["dialog_flow_graphs"][0]["nodes"][0]["id"] == "start"
