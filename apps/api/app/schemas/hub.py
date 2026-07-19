from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


HubCallMethod = Literal["button", "natural"]
HubButtonMatchMode = Literal["exact", "contains"]


class HubMemberInput(BaseModel):
    bot_id: UUID
    display_name: str | None = Field(default=None, max_length=150)
    use_as_small_talk: bool = False


class HubMembersUpdateRequest(BaseModel):
    members: list[HubMemberInput] = Field(default_factory=list, max_length=100)


class HubCallRuleInput(BaseModel):
    id: str | None = Field(default=None, max_length=120)
    name: str | None = Field(default=None, max_length=120)
    expression: str = Field(min_length=1, max_length=500)
    enabled: bool = True


class HubBotStationChannelInput(BaseModel):
    channel_id: str = Field(min_length=1, max_length=120)
    channel_code: str = Field(min_length=1, max_length=120)
    channel_name: str = Field(min_length=1, max_length=150)
    enabled: bool = False


class HubBotStationUpdateRequest(BaseModel):
    connected: bool = False
    enabled: bool = False
    channels: list[HubBotStationChannelInput] = Field(default_factory=list, max_length=100)


class HubSettingsUpdateRequest(BaseModel):
    call_method: HubCallMethod | None = None
    button_match_mode: HubButtonMatchMode | None = None
    greeting_message: str | None = Field(default=None, max_length=2000)
    intent_cutoff_score: float | None = Field(default=None, ge=0.01, le=0.99)
    similar_intent_score: float | None = Field(default=None, ge=0.01, le=0.99)
    max_intent_candidates: int | None = Field(default=None, ge=1, le=10)
    show_members_in_greeting: bool | None = None
    unrecognized_message: str | None = Field(default=None, max_length=2000)
    multiple_candidates_message: str | None = Field(default=None, max_length=2000)
    runtime_error_message: str | None = Field(default=None, max_length=2000)
    conversation_in_progress_message: str | None = Field(default=None, max_length=2000)
    timeout_seconds: int | None = Field(default=None, ge=1, le=86400)
    apply_timeout_to_push: bool | None = None
    timeout_message: str | None = Field(default=None, max_length=2000)
    no_bot_label: str | None = Field(default=None, max_length=120)
    no_bot_message: str | None = Field(default=None, max_length=2000)
    hub_call_rules: list[HubCallRuleInput] | None = Field(default=None, max_length=50)
