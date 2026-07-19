from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Bot, BotHub, BotHubMember, BotVersion


HUB_DEFAULT_GREETING = "\uc6d0\ud558\ub294 \ubd07\uc744 \uc120\ud0dd\ud574\uc8fc\uc138\uc694."
HUB_NO_MEMBER_MESSAGE = "\uc2e4\ud589 \uac00\ub2a5\ud55c \ubd07\uc774 \uc5c6\uc2b5\ub2c8\ub2e4."


def is_hub_bot(bot: Bot) -> bool:
    data_json = getattr(bot, "data_json", None)
    return isinstance(data_json, dict) and str(data_json.get("bot_kind") or "").strip() == "hub"


def active_hub_members(db: Session, hub_id: Any) -> list[tuple[BotHubMember, Bot, BotVersion]]:
    rows = db.execute(
        select(BotHubMember, Bot, BotVersion)
        .join(Bot, Bot.id == BotHubMember.bot_id)
        .join(BotVersion, BotVersion.id == Bot.active_version_id)
        .where(
            BotHubMember.hub_id == hub_id,
            Bot.status == "active",
            Bot.deleted_at.is_(None),
            BotVersion.status == "active",
            BotVersion.deleted_at.is_(None),
        )
        .order_by(BotHubMember.sort_order, BotHubMember.created_at)
    ).all()
    return [(member, bot, version) for member, bot, version in rows if not is_hub_bot(bot)]


def hub_configuration(db: Session, hub_bot: Bot) -> BotHub | None:
    return db.get(BotHub, hub_bot.id)


def hub_selection_output(db: Session, hub_bot: Bot) -> dict[str, Any]:
    hub = db.get(BotHub, hub_bot.id)
    if hub is None:
        return {"type": "text", "text": HUB_NO_MEMBER_MESSAGE, "options": [], "payload": {"hub": True}}

    members = active_hub_members(db, hub_bot.id)
    if not members:
        return {
            "type": "text",
            "text": str(hub.no_bot_message or HUB_NO_MEMBER_MESSAGE).strip() or HUB_NO_MEMBER_MESSAGE,
            "options": [],
            "payload": {"hub": True},
        }

    call_method = str(hub.call_method or "button").strip().lower()
    greeting_message = str(hub.greeting_message or HUB_DEFAULT_GREETING).strip() or HUB_DEFAULT_GREETING
    if call_method == "natural" and not bool(hub.show_members_in_greeting):
        return {
            "type": "text",
            "text": greeting_message,
            "options": [],
            "payload": {"hub": True, "callMethod": call_method},
        }

    options = [
        {
            "label": str(member.display_name or bot.name).strip() or bot.name,
            "value": str(bot.id),
            "botId": str(bot.id),
        }
        for member, bot, _version in members
    ]
    return {
        "type": "button",
        "text": greeting_message,
        "options": options,
        "payload": {"hub": True, "callMethod": call_method},
    }


def resolve_hub_member(
    db: Session,
    hub_bot: Bot,
    message: str,
    allowed_bot_ids: set[str] | None = None,
) -> tuple[Bot, BotVersion, BotHubMember] | None:
    hub = db.get(BotHub, hub_bot.id)
    if hub is None:
        return None

    normalized_message = str(message or "").strip()
    if not normalized_message:
        return None

    match_mode = str(hub.button_match_mode or "exact").strip().lower()
    for member, bot, version in active_hub_members(db, hub_bot.id):
        if allowed_bot_ids is not None and str(bot.id) not in allowed_bot_ids:
            continue
        label = str(member.display_name or bot.name).strip() or bot.name
        is_match = normalized_message in {label, str(bot.id), bot.name}
        if not is_match and match_mode == "contains":
            is_match = bool(label) and label in normalized_message
        if is_match:
            return bot, version, member
    return None
