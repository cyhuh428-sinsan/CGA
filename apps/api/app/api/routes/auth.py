from __future__ import annotations

import re
from datetime import datetime, timezone
from urllib.parse import unquote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.responses import success_response
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models import AuditLog, Bot, BotVersion, Group, Organization, Role, SignupRequest, User, UserRole
from app.services.cga_legacy_auth import provision_legacy_user
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    SignupRequestPayload,
    UserPreferenceUpdateRequest,
)


router = APIRouter(prefix="/auth", tags=["auth"])
LAST_BOT_SCREEN_PATTERN = re.compile(r"^/studio/bots/[^/]+/versions/[^/]+/intents$")
LAST_BOT_SCREEN_DETAIL_PATTERN = re.compile(r"^/studio/bots/(?P<bot_id>[^/]+)/versions/(?P<version>[^/]+)/intents$")


def _get_user_role_codes(db: Session, user_id: UUID) -> list[str]:
    rows = db.execute(
        select(Role.code)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    ).all()
    return [row[0] for row in rows]


def _serialize_user(db: Session, user: User) -> dict[str, object]:
    group = db.scalar(select(Group).where(Group.id == user.group_id)) if user.group_id else None
    organization = db.scalar(select(Organization).where(Organization.id == user.organization_id))
    data_json = user.data_json or {}
    return {
        "id": str(user.id),
        "login_id": user.login_id,
        "name": user.name,
        "email": user.email,
        "roles": _get_user_role_codes(db, user.id),
        "group_id": str(user.group_id) if user.group_id else None,
        "group_code": group.code if group is not None else None,
        "group_name": group.name if group is not None else None,
        "organization_id": str(user.organization_id),
        "organization_name": organization.name if organization is not None else None,
        "last_bot_screen": _resolve_valid_last_bot_screen(db, user, data_json.get("last_bot_screen")),
        "favorite_bot_ids": _normalize_favorite_bot_ids(data_json.get("favorite_bot_ids")),
    }


def _normalize_last_bot_screen(value: object) -> str | None:
    if not isinstance(value, str):
        return None

    normalized = value.strip()
    if not normalized:
        return None

    if not LAST_BOT_SCREEN_PATTERN.match(normalized):
        return None

    return normalized


def _resolve_valid_last_bot_screen(db: Session, user: User, value: object) -> str | None:
    normalized = _normalize_last_bot_screen(value)
    if normalized is None or user.group_id is None:
        return None

    match = LAST_BOT_SCREEN_DETAIL_PATTERN.match(normalized)
    if match is None:
        return None

    raw_bot_id = unquote(match.group("bot_id"))
    version_name = unquote(match.group("version"))
    try:
        bot_id = UUID(raw_bot_id)
    except ValueError:
        return None

    bot = db.scalar(
        select(Bot).where(
            Bot.id == bot_id,
            Bot.organization_id == user.organization_id,
            Bot.group_id == user.group_id,
            Bot.deleted_at.is_(None),
        )
    )
    if bot is None:
        return None

    version = db.scalar(
        select(BotVersion).where(
            BotVersion.bot_id == bot.id,
            BotVersion.name == version_name,
            BotVersion.deleted_at.is_(None),
        )
    )
    if version is None:
        return None

    return f"/studio/bots/{bot.id}/versions/{version.name}/intents"


def _normalize_favorite_bot_ids(value: object) -> list[str]:
    if not isinstance(value, list):
        return []

    normalized: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        raw_bot_id = item.strip()
        if not raw_bot_id:
            continue
        try:
            bot_id = str(UUID(raw_bot_id))
        except ValueError:
            continue
        if bot_id in normalized:
            continue
        normalized.append(bot_id)
    return normalized[:20]


def _build_signup_request_json(
    payload: SignupRequestPayload,
    organization: Organization,
    group: Group,
) -> dict[str, object]:
    return {
        "login_id": payload.login_id,
        "name": payload.name,
        "comment": payload.comment,
        "preferred_language": payload.preferred_language,
        "organization": {
            "id": str(organization.id),
            "code": organization.code,
            "name": organization.name,
        },
        "group": {
            "id": str(group.id),
            "code": group.code,
            "name": group.name,
        },
        "requested_role_code": "curator",
        "status": "pending",
    }


def _get_default_organization(db: Session) -> Organization:
    organization = db.scalar(
        select(Organization).where(
            Organization.code == "default",
            Organization.status == "active",
            Organization.deleted_at.is_(None),
        )
    )
    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="기본 서버 설정을 찾을 수 없습니다.",
        )
    return organization


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    user = db.scalar(
        select(User).where(
            User.login_id == payload.login_id,
            User.deleted_at.is_(None),
        )
    )
    if user is None:
        user = provision_legacy_user(
            db,
            login_id=payload.login_id,
            password=payload.password,
        )

    if user is None:
        pending_request = db.scalar(
            select(SignupRequest).where(
                SignupRequest.login_id == payload.login_id,
                SignupRequest.status == "pending",
            )
        )
        if pending_request is not None and verify_password(payload.password, pending_request.password_hash):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="회원 가입 승인 대기중입니다. 관리자 승인 후 로그인할 수 있습니다.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다.",
        )

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다.",
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="활성 상태의 사용자만 로그인할 수 있습니다.",
        )

    user.last_login_at = datetime.now(timezone.utc)
    db.add(
        AuditLog(
            actor_user_id=user.id,
            action_type="auth.login",
            target_type="user",
            target_id=user.id,
            ip_address=request.client.host if request.client else None,
        )
    )
    db.commit()
    db.refresh(user)

    role_codes = _get_user_role_codes(db, user.id)
    token = create_access_token(
        subject=str(user.id),
        extra_claims={"roles": role_codes},
    )
    return success_response(
        request,
        {
            "access_token": token,
            "token_type": "bearer",
            "user": _serialize_user(db, user),
        },
    )


@router.get("/signup-options")
def signup_options(
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    organization = _get_default_organization(db)
    groups = db.execute(
        select(Group).where(
            Group.organization_id == organization.id,
            Group.status == "active",
            Group.deleted_at.is_(None),
        )
    ).scalars().all()

    data = {
        "organization": {
            "id": str(organization.id),
            "code": organization.code,
            "name": organization.name,
        },
        "groups": [
            {
                "id": str(group.id),
                "code": group.code,
                "name": group.name,
            }
            for group in groups
        ],
    }
    return success_response(request, data)


@router.post("/signup")
def signup(
    payload: SignupRequestPayload,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    existing_user = db.scalar(
        select(User).where(
            User.login_id == payload.login_id,
            User.deleted_at.is_(None),
        )
    )
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 사용 중인 아이디입니다.",
        )

    existing_signup = db.scalar(
        select(SignupRequest).where(
            SignupRequest.login_id == payload.login_id,
            SignupRequest.status == "pending",
        )
    )
    if existing_signup is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 승인 대기중인 회원가입 신청이 있습니다.",
        )

    organization = _get_default_organization(db)
    group = db.scalar(
        select(Group).where(
            Group.id == payload.group_id,
            Group.organization_id == organization.id,
            Group.status == "active",
            Group.deleted_at.is_(None),
        )
    )
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="선택한 그룹 정보가 올바르지 않습니다.",
        )

    signup_request = SignupRequest(
        organization_id=organization.id,
        group_id=group.id,
        login_id=payload.login_id,
        password_hash=get_password_hash(payload.password),
        name=payload.name,
        comment=payload.comment,
        preferred_language=payload.preferred_language,
        requested_role_code="curator",
        status="pending",
        data_json=_build_signup_request_json(payload, organization, group),
    )
    db.add(signup_request)

    db.add(
        AuditLog(
            actor_user_id=None,
            action_type="auth.signup_request",
            target_type="signup_request",
            target_id=signup_request.id,
            after_json={
                "login_id": payload.login_id,
                "name": payload.name,
                "preferred_language": payload.preferred_language,
                "organization_id": str(organization.id),
                "group_id": str(group.id),
                "requested_role_code": signup_request.requested_role_code,
            },
            ip_address=request.client.host if request.client else None,
        )
    )
    db.commit()

    return success_response(
        request,
        {
            "message": "회원가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.",
            "status": "pending",
        },
    )


@router.post("/logout")
def logout(
    request: Request,
    payload: LogoutRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    last_bot_screen = _resolve_valid_last_bot_screen(db, current_user, payload.last_bot_screen if payload else None)
    data_json = dict(current_user.data_json or {})
    if last_bot_screen:
        data_json["last_bot_screen"] = last_bot_screen
        current_user.data_json = data_json
        db.add(current_user)
    elif payload and payload.last_bot_screen:
        data_json.pop("last_bot_screen", None)
        current_user.data_json = data_json
        db.add(current_user)

    db.add(
        AuditLog(
            actor_user_id=current_user.id,
            action_type="auth.logout",
            target_type="user",
            target_id=current_user.id,
            ip_address=request.client.host if request.client else None,
        )
    )
    db.commit()

    return success_response(
        request,
        {
            "message": "로그아웃 처리되었습니다.",
        },
    )


@router.get("/me")
def me(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    return success_response(request, _serialize_user(db, current_user))


@router.patch("/preferences")
def update_preferences(
    payload: UserPreferenceUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    data_json = dict(current_user.data_json or {})
    before_json = {
        "favorite_bot_ids": _normalize_favorite_bot_ids(data_json.get("favorite_bot_ids")),
    }

    if payload.favorite_bot_ids is not None:
        data_json["favorite_bot_ids"] = payload.favorite_bot_ids

    current_user.data_json = data_json
    db.add(current_user)
    db.add(
        AuditLog(
            actor_user_id=current_user.id,
            action_type="auth.preferences.update",
            target_type="user",
            target_id=current_user.id,
            before_json=before_json,
            after_json={
                "favorite_bot_ids": _normalize_favorite_bot_ids(data_json.get("favorite_bot_ids")),
            },
            ip_address=request.client.host if request.client else None,
        )
    )
    db.commit()
    db.refresh(current_user)

    return success_response(request, _serialize_user(db, current_user))


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="현재 비밀번호가 일치하지 않습니다.",
        )

    current_user.password_hash = get_password_hash(payload.new_password)
    db.add(
        AuditLog(
            actor_user_id=current_user.id,
            action_type="auth.change_password",
            target_type="user",
            target_id=current_user.id,
            ip_address=request.client.host if request.client else None,
        )
    )
    db.add(current_user)
    db.commit()

    return success_response(
        request,
        {
            "message": "비밀번호가 변경되었습니다.",
        },
    )
