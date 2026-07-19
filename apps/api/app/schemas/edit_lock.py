from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


EditLockArea = Literal["start", "flow", "settings"]


class EditLockTargetRequest(BaseModel):
    bot_id: UUID
    version_id: UUID
    dialog_id: str = Field(min_length=1, max_length=120)
    area: EditLockArea = "flow"


class EditLockReleaseRequest(BaseModel):
    lock_id: UUID | None = None
    bot_id: UUID | None = None
    version_id: UUID | None = None
    dialog_id: str | None = Field(default=None, max_length=120)
    area: EditLockArea | None = None
