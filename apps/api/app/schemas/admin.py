from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


RoleCode = Literal["curator", "operation_manager", "system_manager", "it_admin", "reviewer", "viewer"]
AccountStatus = Literal["active", "inactive", "locked", "password_reset"]
GroupStatus = Literal["active", "inactive"]
CommonVariableKind = Literal["system", "user"]
ChannelStatus = Literal["active", "inactive"]
TemplateStatus = Literal["active", "inactive"]
DefaultMessageStatus = Literal["active", "inactive"]
DefaultMessageScope = Literal["global", "group"]
CachePurgeDomain = Literal["version_sections", "studio_read_models"]


class AdminVersionStorageBackfillRequest(BaseModel):
    bot_id: UUID | None = None
    group_id: UUID | None = None
    limit: int = Field(default=100, ge=1, le=1000)
    dry_run: bool = False


class AdminGroupOption(BaseModel):
    id: UUID
    code: str
    name: str


class SignupApprovalRequest(BaseModel):
    role_code: RoleCode = "curator"
    group_id: UUID | None = None


class UserRoleUpdateRequest(BaseModel):
    role_code: RoleCode


class UserStatusUpdateRequest(BaseModel):
    status: AccountStatus


class UserGroupUpdateRequest(BaseModel):
    group_id: UUID


class UserInfoUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    role_code: RoleCode
    group_id: UUID
    status: AccountStatus


class AdminCachePurgeRequest(BaseModel):
    domain: CachePurgeDomain = "version_sections"


class GroupCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class GroupUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    status: GroupStatus


class CommonVariableCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    value: str = Field(min_length=1, max_length=4000)
    description: str | None = Field(default=None, max_length=2000)


class CommonVariableUpdateRequest(BaseModel):
    value: str = Field(min_length=1, max_length=4000)
    description: str | None = Field(default=None, max_length=2000)


class CommonVariableImportItem(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    value: str = Field(min_length=1, max_length=4000)
    description: str | None = Field(default=None, max_length=2000)


class CommonVariableImportRequest(BaseModel):
    items: list[CommonVariableImportItem]


class ChannelCreateRequest(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    provider: str = Field(default="webchat", min_length=1, max_length=80)
    renderer_type: str = Field(default="webchat", min_length=1, max_length=80)
    endpoint_url: str | None = Field(default=None, max_length=1000)
    auth_type: str = Field(default="none", max_length=80)
    auth_config: dict[str, object] = Field(default_factory=dict)
    description: str | None = Field(default=None, max_length=2000)
    status: ChannelStatus = "active"


class ChannelUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    provider: str = Field(default="webchat", min_length=1, max_length=80)
    renderer_type: str = Field(default="webchat", min_length=1, max_length=80)
    endpoint_url: str | None = Field(default=None, max_length=1000)
    auth_type: str = Field(default="none", max_length=80)
    auth_config: dict[str, object] = Field(default_factory=dict)
    description: str | None = Field(default=None, max_length=2000)
    status: ChannelStatus


class TemplateCreateRequest(BaseModel):
    channel_code: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    renderer_type: str = Field(min_length=1, max_length=80)
    item_types: str = Field(default="", max_length=1000)
    description: str | None = Field(default=None, max_length=2000)
    status: TemplateStatus = "active"


class TemplateUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    renderer_type: str = Field(min_length=1, max_length=80)
    item_types: str = Field(default="", max_length=1000)
    description: str | None = Field(default=None, max_length=2000)
    status: TemplateStatus



class DefaultMessageUpdateRequest(BaseModel):
    message_text: str = Field(min_length=1, max_length=4000)
    description: str | None = Field(default=None, max_length=2000)

class LicenseApplyRequest(BaseModel):
    license_text: str = Field(min_length=1, max_length=100_000)


class AdminLicenseCurrent(BaseModel):
    id: UUID
    license_id: str
    product: str
    customer_name: str
    issued_at: str | None = None
    expires_at: str | None = None
    status: str
    features: dict[str, object] = {}
    binding: dict[str, object] = {}
    updated_at: datetime


class AdminLicenseUsageItem(BaseModel):
    key: str
    label: str
    limit: int | None = None
    used: int
    remaining: int | None = None
    expires_at: str | None = None


class AdminLicenseStatusResponse(BaseModel):
    installed: bool
    message: str
    license: AdminLicenseCurrent | None = None
    usage: list[AdminLicenseUsageItem] = []
class AdminDefaultMessageItem(BaseModel):
    id: UUID
    message_key: str
    message_name: str
    category: str
    category_label: str
    language: str
    scope: DefaultMessageScope
    scope_label: str
    message_text: str
    default_message_text: str | None = None
    is_modified: bool = False
    description: str | None = None
    status: DefaultMessageStatus
    status_label: str
    updated_at: datetime
    updater_name: str
    data_json: dict = {}


class AdminUserListItem(BaseModel):
    id: UUID
    kind: Literal["user", "signup_request"]
    login_id: str
    name: str
    group_name: str
    role_code: RoleCode
    role_name: str
    requested_at: datetime
    signup_status: str
    account_status: str
    is_protected: bool = False


class AdminUserDetail(BaseModel):
    id: UUID
    kind: Literal["user", "signup_request"]
    login_id: str
    name: str
    organization_name: str
    group_name: str
    group_id: UUID
    role_code: RoleCode
    role_name: str
    requested_at: datetime
    signup_status: str
    account_status: str
    comment: str | None = None
    preferred_language: str = "ko"
    is_protected: bool = False
    available_groups: list[AdminGroupOption] = []
    data_json: dict = {}


class AdminLoginHistoryItem(BaseModel):
    id: str
    login_id: str
    name: str
    group_name: str
    role_name: str
    ip_address: str | None = None
    login_at: datetime
    logout_at: datetime | None = None


class AdminTrainingHistoryItem(BaseModel):
    id: UUID
    group_name: str
    bot_name: str
    version_no: int
    nlu_type: str | None = None
    nlu_model: str | None = None
    training_status: str
    user_login_id: str
    started_at: datetime
    completed_at: datetime
    data_json: dict = {}


class AdminConversationHistoryItem(BaseModel):
    id: str
    group_name: str
    channel_name: str
    bot_name: str
    version_no: int | None = None
    user_key: str
    intent_or_module_name: str
    uttered_at: datetime
    result: str
    data_json: dict = {}


class AdminApiCallHistoryItem(BaseModel):
    id: str
    method: str
    filters: str
    api_name: str
    api_type: str
    url: str
    transfer_type: str
    channel_name: str
    group_name: str
    bot_name: str
    version_no: int
    intent_name: str
    response_code: str
    user_key: str
    called_at: datetime
    data_json: dict = {}


class AdminQueueHistoryItem(BaseModel):
    id: str
    intent_name: str
    sender_system: str
    priority: str
    parameter: str
    channel_name: str
    bot_name: str
    receiver: str
    receive_status: str
    requested_at: datetime
    status_changed_at: datetime
    data_json: dict = {}


class AdminIntentFeedbackItem(BaseModel):
    id: str
    group_name: str
    bot_name: str
    version_no: int
    channel_name: str
    intent_name: str
    average_score: float
    feedback_count: int
    data_json: dict = {}


class AdminGroupListItem(BaseModel):
    id: UUID
    code: str
    name: str
    status: str
    creator_name: str
    updater_name: str
    updated_at: datetime


class AdminGroupDetail(BaseModel):
    id: UUID
    code: str
    name: str
    status: GroupStatus
    status_label: str
    creator_name: str
    updater_name: str
    created_at: datetime
    updated_at: datetime
    user_count: int
    data_json: dict = {}


class AdminCommonVariableItem(BaseModel):
    id: UUID
    kind: CommonVariableKind
    name: str
    value: str
    description: str | None = None
    updated_at: datetime
    updater_name: str
    data_json: dict = {}


class AdminChannelItem(BaseModel):
    id: UUID
    code: str
    name: str
    description: str | None = None
    status: ChannelStatus
    status_label: str
    creator_name: str
    updater_name: str
    updated_at: datetime
    data_json: dict = {}


class AdminTemplateItem(BaseModel):
    id: UUID
    channel_code: str
    channel_name: str
    name: str
    renderer_type: str
    item_count: int
    item_types: str
    description: str | None = None
    status: TemplateStatus
    status_label: str
    creator_name: str
    updater_name: str
    updated_at: datetime
    data_json: dict = {}
