from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.version_documents import normalize_version_document
from app.models import Bot, BotVersion, VersionDialogAsset, VersionDialogFlowGraph


def _first_string(source: dict[str, Any], keys: list[str]) -> str | None:
    for key in keys:
        value = source.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _dialog_kind(dialog: dict[str, Any]) -> str:
    dialog_type = dialog.get("dialogType")
    if dialog_type == 0 or (isinstance(dialog_type, str) and dialog_type.strip() == "0"):
        return "module"
    if dialog_type == 1 or (isinstance(dialog_type, str) and dialog_type.strip() == "1"):
        return "intent"
    return "dialog"


def build_version_dialog_asset_rows(document: dict[str, Any] | None) -> list[dict[str, Any]]:
    normalized = normalize_version_document(document)
    rows: list[dict[str, Any]] = []

    for sort_order, dialog in enumerate(normalized["dialogs"]):
        if not isinstance(dialog, dict):
            continue

        dialog_id = _first_string(dialog, ["id", "dialogId", "dialog_id"])
        if dialog_id is None:
            continue

        rows.append(
            {
                "dialog_id": dialog_id,
                "kind": _dialog_kind(dialog),
                "name": _first_string(dialog, ["name", "dialogName", "dialog_name", "intentName", "intent_name"]),
                "display_name": _first_string(
                    dialog,
                    ["displayName", "display_name", "name", "dialogName", "dialog_name", "intentName", "intent_name"],
                ),
                "payload_json": deepcopy(dialog),
                "sort_order": sort_order,
            }
        )

    return rows


def build_version_dialog_flow_graph_rows(document: dict[str, Any] | None) -> list[dict[str, Any]]:
    normalized = normalize_version_document(document)
    rows: list[dict[str, Any]] = []

    for graph in normalized["dialog_flow_graphs"]:
        if not isinstance(graph, dict):
            continue

        dialog_id = _first_string(graph, ["dialogId", "dialog_id", "id"])
        if dialog_id is None:
            continue

        rows.append(
            {
                "dialog_id": dialog_id,
                "payload_json": deepcopy(graph),
            }
        )

    return rows


def sync_version_dialog_assets(
    db: Session,
    bot: Bot,
    version: BotVersion,
    version_json: dict[str, Any],
) -> None:
    now = datetime.now(timezone.utc)
    next_rows = build_version_dialog_asset_rows(version_json)
    next_by_id = {str(row["dialog_id"]): row for row in next_rows}
    current_rows = db.scalars(
        select(VersionDialogAsset).where(
            VersionDialogAsset.version_id == version.id,
            VersionDialogAsset.deleted_at.is_(None),
        )
    ).all()
    current_by_id = {row.dialog_id: row for row in current_rows}

    for dialog_id, row_data in next_by_id.items():
        row = current_by_id.get(dialog_id)
        if row is None:
            row = VersionDialogAsset(
                bot_id=bot.id,
                version_id=version.id,
                dialog_id=dialog_id,
            )
        row.bot_id = bot.id
        row.version_id = version.id
        row.kind = str(row_data["kind"])
        row.name = row_data["name"]
        row.display_name = row_data["display_name"]
        row.payload_json = row_data["payload_json"]
        row.sort_order = int(row_data["sort_order"])
        row.deleted_at = None
        db.add(row)

    for dialog_id, row in current_by_id.items():
        if dialog_id not in next_by_id:
            row.deleted_at = now
            db.add(row)


def sync_version_dialog_flow_graphs(
    db: Session,
    bot: Bot,
    version: BotVersion,
    version_json: dict[str, Any],
) -> None:
    now = datetime.now(timezone.utc)
    next_rows = build_version_dialog_flow_graph_rows(version_json)
    next_by_id = {str(row["dialog_id"]): row for row in next_rows}
    current_rows = db.scalars(
        select(VersionDialogFlowGraph).where(
            VersionDialogFlowGraph.version_id == version.id,
            VersionDialogFlowGraph.deleted_at.is_(None),
        )
    ).all()
    current_by_id = {row.dialog_id: row for row in current_rows}

    for dialog_id, row_data in next_by_id.items():
        row = current_by_id.get(dialog_id)
        if row is None:
            row = VersionDialogFlowGraph(
                bot_id=bot.id,
                version_id=version.id,
                dialog_id=dialog_id,
            )
        row.bot_id = bot.id
        row.version_id = version.id
        row.payload_json = row_data["payload_json"]
        row.deleted_at = None
        db.add(row)

    for dialog_id, row in current_by_id.items():
        if dialog_id not in next_by_id:
            row.deleted_at = now
            db.add(row)


def sync_version_dialog_split_tables(
    db: Session,
    bot: Bot,
    version: BotVersion,
    version_json: dict[str, Any],
    *,
    include_dialogs: bool,
    include_graphs: bool,
) -> None:
    if include_dialogs:
        sync_version_dialog_assets(db, bot, version, version_json)
    if include_graphs:
        sync_version_dialog_flow_graphs(db, bot, version, version_json)
