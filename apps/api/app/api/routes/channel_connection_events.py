"""Teams Bot Connector 전용 인증 수신 경계. 기존 Teams route는 변경하지 않는다."""
import json
from fastapi import APIRouter, HTTPException, Request, Response
from app.core.config import settings
from app.services.channel_connection_supervisor import ADAPTERS
from app.services.channel_connections import _cipher

router = APIRouter(prefix="/channel-connections", tags=["channel-connection-events"])


@router.post("/ms-teams/events")
async def teams_activity(request: Request):
    adapter = ADAPTERS.get("ms_teams")
    if not settings.channel_connection_worker_enabled or not settings.channel_connection_encryption_key or adapter is None:
        raise HTTPException(503, "TEAMS_RECEIVER_DISABLED")
    _cipher(settings.channel_connection_encryption_key)
    limit = 256 * 1024
    try:
        declared = request.headers.get("content-length")
        if declared is not None:
            if int(declared) < 0: raise ValueError()
            if int(declared) > limit: raise HTTPException(413, "TEAMS_ACTIVITY_TOO_LARGE")
    except ValueError:
        raise HTTPException(400, "TEAMS_BODY_INVALID") from None
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > limit: raise HTTPException(413, "TEAMS_ACTIVITY_TOO_LARGE")
        body.extend(chunk)
    try:
        value = json.loads(body)
        if not isinstance(value, dict): raise ValueError()
    except (ValueError, TypeError, UnicodeError):
        raise HTTPException(422, "TEAMS_BODY_INVALID") from None
    await adapter.receive(request.headers.get("authorization", ""), value)
    if value.get("type") == "invoke":
        result = {"statusCode": 200, "type": "application/vnd.microsoft.activity.message", "value": ""}
        if value.get("name") != "adaptiveCard/action":
            result = {"statusCode": 400, "type": "application/vnd.microsoft.error", "value": {"code": "TeamsInvokeUnsupported"}}
        return Response(content=json.dumps(result), media_type="application/json")
    return Response(content="{}", media_type="application/json")


@router.post("/google-chat/events")
async def google_chat_event(request: Request):
    adapter = ADAPTERS.get("google_chat")
    if not settings.channel_connection_worker_enabled or not settings.channel_connection_encryption_key or adapter is None:
        raise HTTPException(503, "GOOGLE_CHAT_RECEIVER_DISABLED")
    _cipher(settings.channel_connection_encryption_key)
    limit = 256 * 1024
    try:
        declared = request.headers.get("content-length")
        if declared is not None:
            if int(declared) < 0: raise ValueError()
            if int(declared) > limit: raise HTTPException(413, "GOOGLE_CHAT_EVENT_TOO_LARGE")
    except ValueError:
        raise HTTPException(400, "GOOGLE_CHAT_BODY_INVALID") from None
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > limit: raise HTTPException(413, "GOOGLE_CHAT_EVENT_TOO_LARGE")
        body.extend(chunk)
    try:
        value = json.loads(body)
        if not isinstance(value, dict): raise ValueError()
    except (ValueError, TypeError, UnicodeError):
        raise HTTPException(422, "GOOGLE_CHAT_BODY_INVALID") from None
    await adapter.receive(request.headers.get("authorization", ""), value)
    return Response(content="{}", media_type="application/json")
