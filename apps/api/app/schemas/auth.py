from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator
import re


LOGIN_ID_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9._@]{0,29}$")
PASSWORD_PATTERN = re.compile(r"^[A-Za-z0-9\-!@#$%^&*()_+]{8,30}$")
NAME_PATTERN = re.compile(r"^[A-Za-z0-9가-힣\s]{1,20}$")


class LoginRequest(BaseModel):
    login_id: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class UserPreferenceUpdateRequest(BaseModel):
    favorite_bot_ids: list[str] | None = None

    @field_validator("favorite_bot_ids")
    @classmethod
    def validate_favorite_bot_ids(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None

        normalized: list[str] = []
        for item in value:
            slug = item.strip()
            if not slug:
                continue
            if not LOGIN_ID_PATTERN.match(slug.replace("-", "a")) and not re.match(r"^[a-z0-9가-힣-]{1,150}$", slug):
                raise ValueError("즐겨찾기 봇 식별자가 올바르지 않습니다.")
            if slug not in normalized:
                normalized.append(slug)

        return normalized[:20]


class LogoutRequest(BaseModel):
    last_bot_screen: str | None = Field(default=None, max_length=300)

    @field_validator("last_bot_screen")
    @classmethod
    def validate_last_bot_screen(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        if not normalized.startswith("/studio/bots/") or "/versions/" not in normalized or not normalized.endswith("/intents"):
            raise ValueError("마지막 봇 화면 경로가 올바르지 않습니다.")
        return normalized


class SignupRequestPayload(BaseModel):
    login_id: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=8, max_length=30)
    password_confirm: str = Field(min_length=8, max_length=30)
    name: str = Field(min_length=1, max_length=20)
    comment: str | None = Field(default=None, max_length=30)
    preferred_language: str = Field(default="ko", min_length=2, max_length=10)
    group_id: UUID

    @field_validator("login_id")
    @classmethod
    def validate_login_id(cls, value: str) -> str:
        normalized = value.strip()
        if not LOGIN_ID_PATTERN.match(normalized):
            raise ValueError("아이디는 영문으로 시작하고 영문/숫자/마침표(.)/골뱅이(@)/언더바(_)만 사용할 수 있습니다.")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not PASSWORD_PATTERN.match(value):
            raise ValueError("비밀번호는 8~30자의 영문/숫자/특수문자(-!@#$%^&*()_+)만 사용할 수 있습니다.")
        return value

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not NAME_PATTERN.match(normalized):
            raise ValueError("이름은 특수문자 없이 20자 이내로 입력해주세요.")
        return normalized

    @field_validator("comment")
    @classmethod
    def normalize_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("preferred_language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"ko", "en"}:
            raise ValueError("지원하지 않는 언어입니다.")
        return normalized

    @model_validator(mode="after")
    def validate_password_confirm(self) -> "SignupRequestPayload":
        if self.password != self.password_confirm:
            raise ValueError("비밀번호와 비밀번호 확인이 일치하지 않습니다.")
        return self


class UserSummary(BaseModel):
    id: UUID
    login_id: str
    name: str
    email: str | None
    roles: list[str]
    group_id: UUID | None = None
    group_code: str | None = None
    group_name: str | None = None
    organization_id: UUID | None = None
    organization_name: str | None = None
    last_bot_screen: str | None = None
    favorite_bot_ids: list[str] = Field(default_factory=list)


class LoginResponseData(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSummary
