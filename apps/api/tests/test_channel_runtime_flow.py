import sys
import types
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch
from urllib.error import HTTPError

from fastapi import HTTPException
from PIL import Image


session_module = types.ModuleType("app.db.session")
session_module.SessionLocal = object
original_session_module = sys.modules.get("app.db.session")
sys.modules.setdefault("app.db.session", session_module)

models_module = types.ModuleType("app.models")
for model_name in (
    "AdminChannel",
    "AdminDefaultMessage",
    "AdminLicense",
    "AdminTemplate",
    "AuditLog",
    "Bot",
    "BotHub",
    "BotHubMember",
    "BotVersion",
    "ChannelMessage",
    "ChannelQueueEvent",
    "ChannelRoom",
    "CommonVariable",
    "Group",
    "Organization",
    "Role",
    "SignupRequest",
    "User",
    "UserRole",
):
    setattr(models_module, model_name, type(model_name, (), {}))
original_models_module = sys.modules.get("app.models")
sys.modules.setdefault("app.models", models_module)

from app.api.routes.channels import KakaoWebhookRequest, _apply_active_version_to_room, _apply_blocklist_patterns, _botstation_channel_connection, _channel_request_token, _execute_function_node, _function_output_value, get_kakao_image, _handle_pre_nlu_settings, _handle_runtime_message, _initial_runtime_state_for_version, _is_structured_talk_input, _log_preview, _kakao_response_from_serialized_messages, _kakao_response_log_summary, _normalize_kakao_webhook_request, _prepare_answer_rag_variables, _rule_expression_matches, _runtime_block_reason, _reset_stalled_waiting_talk_state, _run_runtime, _select_dialog, _select_dialog_for_bot, _should_run_intent_fallback, _smalltalk_match, _store_form_result_variable, _talk_output, _verify_kakao_channel_request, channel_health, connect_channel_options, create_channel_room_options, kakao_webhook, list_channel_bots_options
from app.services.scenario_validation import scenario_validation_from_version
from app.services.vector_search import VectorIntentMatch

if original_session_module is None:
    sys.modules.pop("app.db.session", None)
else:
    sys.modules["app.db.session"] = original_session_module
if original_models_module is None:
    sys.modules.pop("app.models", None)
else:
    sys.modules["app.models"] = original_models_module


class _FakeBot:
    def __init__(self, data_json: dict[str, object] | None = None) -> None:
        self.data_json = data_json or {"nlu_type": "ml", "nlu_model": "deep_learning_lite", "answer_mode": "fixed"}
        self.id = "bot-1"
        self.name = "테스트봇"
        self.slug = "demo-bot"


class _FakeVersion:
    def __init__(self, version_json: dict[str, object]) -> None:
        self.id = "version-1"
        self.name = "v1"
        self.version_json = version_json


class _FakeRequest:
    state = types.SimpleNamespace(request_id="test-request")


def test_channel_health_includes_kakao_operational_summary() -> None:
    response = channel_health(_FakeRequest())

    data = response["data"]
    assert data["status"] == "ok"
    assert "kakao" in data["channels"]
    kakao = next(item for item in data["details"] if item["channel"] == "kakao")
    assert kakao["provider"] == "kakao"
    assert kakao["renderer"] == "kakao"
    assert kakao["webhook_endpoint"] == "/api/v1/channels/kakao/webhook"
    assert kakao["auth_header"] == "X-Aidot-Channel-Token"
    assert kakao["supported_outputs"] == ["simpleText", "quickReplies", "basicCard", "listCard", "carousel"]
    assert "kakao.webhook.responded" in kakao["logging_events"]


def test_runtime_rule_expression_matches_text_and_regex() -> None:
    assert _rule_expression_matches("고객 지원", "고객 지원을 받고 싶어요")
    assert _rule_expression_matches(r"/^고객\s+지원$/", "고객 지원")
    assert not _rule_expression_matches(r"/^고객\s+지원$/", "고객 지원을 받고 싶어요")


def test_smalltalk_match_supports_multiple_user_messages() -> None:
    bot = _FakeBot(
        {
            "settings_by_version": {
                "v1": {
                    "smalltalk": {
                        "enabled": True,
                        "items": [
                            {
                                "id": "smalltalk-1",
                                "title": "가입안내",
                                "userMessages": ["가입안내", "가입 방법 알려줘"],
                                "botMessages": ["가입안내 드립니다."],
                                "enabled": True,
                            }
                        ],
                    }
                }
            }
        }
    )
    matched = _smalltalk_match(bot, _FakeVersion({}), "가입 방법 알려줘")

    assert matched is not None
    assert matched["matchedUtterance"] == "가입 방법 알려줘"
    assert matched["response"] == "가입안내 드립니다."


def test_smalltalk_match_randomly_selects_one_bot_message() -> None:
    bot = _FakeBot(
        {
            "settings_by_version": {
                "v1": {
                    "smalltalk": {
                        "enabled": True,
                        "items": [
                            {
                                "id": "smalltalk-1",
                                "title": "인사",
                                "userMessages": ["안녕"],
                                "botMessages": ["안녕하세요.", "반갑습니다."],
                                "enabled": True,
                            }
                        ],
                    }
                }
            }
        }
    )

    with patch("app.api.routes.channels.random.choice", return_value="반갑습니다.") as choice:
        matched = _smalltalk_match(bot, _FakeVersion({}), "안녕")

    assert matched is not None
    assert matched["response"] == "반갑습니다."
    choice.assert_called_once_with(["안녕하세요.", "반갑습니다."])


def test_text_blocklist_removes_matching_text_before_nlu() -> None:
    bot = _FakeBot(
        {
            "settings_by_version": {
                "v1": {
                    "blocklists": [
                        {"id": "blocklist-1", "name": "좀", "type": "word", "pattern": "좀", "enabled": True}
                    ]
                }
            }
        }
    )

    effective_message, applied = _apply_blocklist_patterns(bot, _FakeVersion({}), "좀 더 자세히 말해줘")

    assert effective_message == "더 자세히 말해줘"
    assert [item["id"] for item in applied] == ["blocklist-1"]


def test_regex_blocklist_removes_matching_text_before_nlu() -> None:
    bot = _FakeBot(
        {
            "settings_by_version": {
                "v1": {
                    "blocklists": [
                        {"id": "blocklist-1", "name": "호칭", "type": "regex", "pattern": r"\s*부탁해", "enabled": True}
                    ]
                }
            }
        }
    )

    effective_message, applied = _apply_blocklist_patterns(bot, _FakeVersion({}), "상세히 말해줘 부탁해")

    assert effective_message == "상세히 말해줘"
    assert [item["id"] for item in applied] == ["blocklist-1"]

def test_blocklist_pre_nlu_uses_effective_message_without_short_circuiting() -> None:
    bot = _FakeBot(
        {
            "settings_by_version": {
                "v1": {
                    "blocklists": [
                        {"id": "blocklist-1", "name": "좀", "type": "word", "pattern": "좀", "enabled": True}
                    ]
                }
            }
        }
    )

    outputs, state, selected_dialog, handled, effective_message = _handle_pre_nlu_settings(
        {}, {}, bot, _FakeVersion({}), "좀 더 자세히 말해줘", {}, "SIMULATOR"
    )

    assert outputs == []
    assert selected_dialog is None
    assert handled is False
    assert effective_message == "더 자세히 말해줘"
    assert state["runtimeEvents"][-1]["event"] == "channel.runtime.blocklist_applied"

def _document(nodes: list[dict[str, object]], links: list[dict[str, object]], *, apis: list[dict[str, object]] | None = None) -> dict[str, object]:
    return {
        "dialogs": [
            {
                "id": "dialog-1",
                "name": "테스트 모듈",
                "displayName": "테스트 모듈",
                "dialogType": 0,
            }
        ],
        "dialog_flow_graphs": [
            {
                "id": "graph-1",
                "dialogId": "dialog-1",
                "name": "테스트 모듈",
                "nodes": nodes,
                "links": links,
            }
        ],
        "apis": apis or [],
    }


def test_answer_rag_uses_precomputed_answer_before_vector_search() -> None:
    bot = _FakeBot({"nlu_type": "semantic", "nlu_model": "semantic_engine_default", "answer_mode": "semantic_rag"})
    version = _FakeVersion(
        {
            "system_config": {
                "answer_training": {
                    "precomputed_answers": {
                        "by_intent_id": {
                            "intent-price": {
                                "documentId": "answer-1",
                                "title": "요금 문의",
                                "text": "요금은 월 1만원입니다.",
                                "score": 1.0,
                                "intentId": "intent-price",
                                "intentName": "요금 문의",
                                "sourceType": "text",
                                "sourceTitle": "답변",
                                "page": "",
                                "metadata": {"intentId": "intent-price", "intentName": "요금 문의"},
                            }
                        },
                        "by_intent_name": {},
                    }
                }
            }
        }
    )
    runtime_state = {"variables": {}}

    _prepare_answer_rag_variables(runtime_state, bot, version, "요금 알려줘", {"id": "intent-price", "name": "요금 문의"})

    assert runtime_state["variables"]["$_semantic_answer_text"] == "요금은 월 1만원입니다."
    assert runtime_state["variables"]["$_semantic_answer_intent_id"] == "intent-price"
    assert runtime_state["variables"]["$_rag_answer_text"] == "요금은 월 1만원입니다."
    assert runtime_state["variables"]["$_rag_answer_intent_id"] == "intent-price"


def test_llm_answer_uses_llm_generated_answer_text() -> None:
    bot = _FakeBot({"nlu_type": "llm", "nlu_model": "llm_engine_default", "answer_mode": "llm"})
    version = _FakeVersion({})
    runtime_state = {"variables": {}}

    class FakeLlmClient:
        def __init__(self, config: object) -> None:
            self.config = config

        def chat(self, *, system_prompt: str, user_prompt: str, json_mode: bool = False) -> object:
            assert "사용자 질문: 상담사 전환" in user_prompt
            return types.SimpleNamespace(content='{"answer":"상담사 연결 요청을 확인했습니다."}')

    with patch("app.api.routes.channels.LlmChatClient", FakeLlmClient):
        _prepare_answer_rag_variables(
            runtime_state,
            bot,
            version,
            "상담사 전환",
            {"id": "intent-transfer", "name": "상담원 연결 요청"},
        )

    assert runtime_state["variables"]["$_llm_answer_text"] == "상담사 연결 요청을 확인했습니다."
    assert runtime_state["variables"]["$_llm_answers"][0]["text"] == "상담사 연결 요청을 확인했습니다."


def test_llm_answer_keeps_llm_answer_even_when_same_as_query() -> None:
    bot = _FakeBot({"nlu_type": "llm", "nlu_model": "llm_engine_default", "answer_mode": "llm"})
    version = _FakeVersion({})
    runtime_state = {"variables": {}}

    class FakeLlmClient:
        def __init__(self, config: object) -> None:
            self.config = config

        def chat(self, *, system_prompt: str, user_prompt: str, json_mode: bool = False) -> object:
            return types.SimpleNamespace(content='{"answer":"상담사 전환"}')

    with patch("app.api.routes.channels.LlmChatClient", FakeLlmClient):
        _prepare_answer_rag_variables(
            runtime_state,
            bot,
            version,
            "상담사 전환",
            {"id": "intent-transfer", "name": "상담원 연결 요청"},
        )

    assert runtime_state["variables"]["$_llm_answer_text"] == "상담사 전환"
    assert runtime_state["variables"]["$_llm_answers"][0]["text"] == "상담사 전환"


def _state() -> dict[str, object]:
    return {"graphId": "graph-1", "dialogId": "dialog-1", "variables": {}}


def _as_variables(state: dict[str, object]) -> dict[str, object]:
    variables = state.get("variables")
    return variables if isinstance(variables, dict) else {}


def _events(state: dict[str, object]) -> list[dict[str, object]]:
    events = state.get("runtimeEvents")
    return events if isinstance(events, list) else []


def test_channel_options_endpoints_do_not_require_channel_api_key() -> None:
    request = _FakeRequest()

    connect = connect_channel_options("webchat", request)
    bots = list_channel_bots_options("webchat", request)
    rooms = create_channel_room_options("webchat", request)

    assert connect["data"] == {"channelType": "webchat", "connected": True}
    assert bots["data"] == {"channelType": "webchat", "bots": []}
    assert rooms["data"] == {"channelType": "webchat", "room": None}
    assert connect["meta"]["request_id"] == "test-request"


def test_normalize_kakao_webhook_request_builds_common_channel_shape() -> None:
    normalized = _normalize_kakao_webhook_request(
        {
            "userRequest": {
                "utterance": "안녕",
                "user": {
                    "id": "kakao-user-1",
                },
            },
            "action": {
                "clientExtra": {
                    "botId": "11111111-1111-1111-1111-111111111111",
                }
            },
        }
    )

    assert normalized["channel"] == "kakao"
    assert normalized["bot_id"] == "11111111-1111-1111-1111-111111111111"
    assert normalized["channel_user_id"] == "kakao-user-1"
    assert normalized["channel_room_id"] == "kakao:11111111-1111-1111-1111-111111111111:kakao-user-1"
    assert normalized["utterance"] == "안녕"


def test_kakao_webhook_returns_runtime_ready_payload(monkeypatch) -> None:
    import app.api.routes.channels as channels_module

    room_id = "11111111-1111-1111-1111-111111111111"
    called: dict[str, object] = {}

    def _fake_create_room(channel_type, payload, _request, x_aidot_webchat_key=None):
        called["room_channel"] = channel_type
        called["room_bot_id"] = payload.bot_id
        called["room_client_room_id"] = payload.client_room_id
        called["room_participant_id"] = payload.participant_id
        called["room_use_configured_initial_messages"] = payload.use_configured_initial_messages
        return {"data": {"room": {"id": room_id}, "messages": [{"id": "bot-initial-1", "text": "첫 인사"}]}}

    def _fake_create_room_message(channel_type, incoming_room_id, payload, _request, x_aidot_webchat_key=None):
        called["message_channel"] = channel_type
        called["message_room_id"] = str(incoming_room_id)
        called["message_text"] = payload.message
        called["message_participant_id"] = payload.participant_id
        return {
            "data": {
                "queued": False,
                "bot": {"slug": "aidot-bot"},
                "activeVersion": {"name": "v1"},
                "queueEvent": {"id": "queue-1"},
                "userMessage": {"id": "user-1", "text": "테스트"},
                "botMessage": {"id": "bot-2", "text": "반갑습니다."},
                "botMessages": [{"id": "bot-2", "text": "반갑습니다."}],
            }
        }

    monkeypatch.setattr(channels_module, "create_channel_room", _fake_create_room)
    monkeypatch.setattr(channels_module, "create_channel_room_message", _fake_create_room_message)
    monkeypatch.setattr(channels_module, "_verify_kakao_channel_request", lambda *_args, **_kwargs: None)

    response = kakao_webhook(
        KakaoWebhookRequest(
            userRequest={"utterance": "테스트", "user": {"id": "kakao-user-1"}},
            action={"clientExtra": {"botId": "11111111-1111-1111-1111-111111111111"}},
        ),
        _FakeRequest(),
        bot_id=None,
        x_aidot_channel_token=None,
    )

    assert response["version"] == "2.0"
    assert response["template"]["outputs"][0]["simpleText"]["text"] == "반갑습니다."
    assert called["room_channel"] == "kakao"
    assert called["room_bot_id"] == "11111111-1111-1111-1111-111111111111"
    assert called["room_participant_id"] == "kakao-user-1"
    assert called["room_use_configured_initial_messages"] is False
    assert called["message_channel"] == "kakao"
    assert called["message_room_id"] == room_id
    assert called["message_text"] == "테스트"
    assert called["message_participant_id"] == "kakao-user-1"


def test_kakao_webhook_prefers_configured_initial_message_without_utterance(monkeypatch) -> None:
    import app.api.routes.channels as channels_module

    called: dict[str, object] = {}

    def _fake_create_room(channel_type, payload, _request, x_aidot_webchat_key=None):
        called["room_use_configured_initial_messages"] = payload.use_configured_initial_messages
        return {
            "data": {
                "room": {
                    "id": "11111111-1111-1111-1111-111111111111",
                    "bot": {
                        "initialMessages": [
                            {"type": "text", "text": "안녕하세요. Aidot입니다.", "options": []},
                        ],
                    },
                },
                "messages": [
                    {"id": "runtime-error", "text": "대화 흐름 설정 오류로 대화를 계속할 수 없습니다."},
                ],
            }
        }

    def _unexpected_message(*_args, **_kwargs):
        raise AssertionError("발화가 없는 최초 카카오 호출은 사용자 메시지를 생성하지 않아야 합니다.")

    monkeypatch.setattr(channels_module, "create_channel_room", _fake_create_room)
    monkeypatch.setattr(channels_module, "create_channel_room_message", _unexpected_message)
    monkeypatch.setattr(channels_module, "_verify_kakao_channel_request", lambda *_args, **_kwargs: None)

    response = kakao_webhook(
        KakaoWebhookRequest(
            userRequest={"user": {"id": "kakao-user-1"}},
            action={"clientExtra": {"botId": "11111111-1111-1111-1111-111111111111"}},
        ),
        _FakeRequest(),
        bot_id=None,
        x_aidot_channel_token=None,
    )

    assert response["template"]["outputs"][0]["simpleText"]["text"] == "안녕하세요. Aidot입니다."
    assert called["room_use_configured_initial_messages"] is True


def test_kakao_webhook_logs_received_and_responded(monkeypatch) -> None:
    import app.api.routes.channels as channels_module

    events: list[tuple[str, str, dict[str, object]]] = []

    class _FakeLogger:
        def info(self, message: str, extra: dict[str, object] | None = None) -> None:
            events.append(("info", message, extra or {}))

        def warning(self, message: str, extra: dict[str, object] | None = None) -> None:
            events.append(("warning", message, extra or {}))

        def exception(self, message: str, extra: dict[str, object] | None = None) -> None:
            events.append(("exception", message, extra or {}))

    monkeypatch.setattr(channels_module, "logger", _FakeLogger())
    monkeypatch.setattr(channels_module, "_verify_kakao_channel_request", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        channels_module,
        "create_channel_room",
        lambda *_args, **_kwargs: {
            "data": {
                "room": {"id": "550e8400-e29b-41d4-a716-446655440000"},
                "messages": [{"id": "bot-initial-1", "text": "첫 인사"}],
            }
        },
    )
    monkeypatch.setattr(
        channels_module,
        "create_channel_room_message",
        lambda *_args, **_kwargs: {
            "data": {
                "botMessages": [
                    {
                        "id": "bot-2",
                        "text": "안녕하세요!",
                        "payload": {"options": ["요금 안내", "상담사 연결"]},
                    }
                ]
            }
        },
    )

    response = kakao_webhook(
        KakaoWebhookRequest(
            userRequest={"utterance": "테스트", "user": {"id": "kakao-user-1"}},
            action={"clientExtra": {"botId": "11111111-1111-1111-1111-111111111111"}},
        ),
        _FakeRequest(),
        bot_id=None,
        x_aidot_channel_token=None,
    )

    assert response["template"]["outputs"][0]["simpleText"]["text"] == "안녕하세요!"
    received = next(item for item in events if item[2].get("event") == "kakao.webhook.received")
    responded = next(item for item in events if item[2].get("event") == "kakao.webhook.responded")
    assert received[0] == "info"
    assert received[2]["channel"] == "kakao"
    assert received[2]["has_utterance"] is True
    assert responded[0] == "info"
    assert responded[2]["room_id"] == "550e8400-e29b-41d4-a716-446655440000"
    assert responded[2]["output_types"] == ["simpleText"]
    assert responded[2]["quick_reply_count"] == 2
    assert responded[2]["fallback_used"] is False
    assert responded[2]["fallback_reasons"] == []


def test_kakao_webhook_logs_rejected_request(monkeypatch) -> None:
    import app.api.routes.channels as channels_module

    events: list[tuple[str, str, dict[str, object]]] = []

    class _FakeLogger:
        def info(self, message: str, extra: dict[str, object] | None = None) -> None:
            events.append(("info", message, extra or {}))

        def warning(self, message: str, extra: dict[str, object] | None = None) -> None:
            events.append(("warning", message, extra or {}))

        def exception(self, message: str, extra: dict[str, object] | None = None) -> None:
            events.append(("exception", message, extra or {}))

    def _raise_auth_failure(*_args, **_kwargs) -> None:
        raise HTTPException(status_code=401, detail="Kakao 채널 인증에 실패했습니다.")

    monkeypatch.setattr(channels_module, "logger", _FakeLogger())
    monkeypatch.setattr(channels_module, "_verify_kakao_channel_request", _raise_auth_failure)

    try:
        kakao_webhook(
            KakaoWebhookRequest(
                userRequest={"utterance": "테스트", "user": {"id": "kakao-user-1"}},
                action={"clientExtra": {"botId": "11111111-1111-1111-1111-111111111111"}},
            ),
            _FakeRequest(),
            bot_id=None,
            x_aidot_channel_token="wrong-token",
        )
    except HTTPException as exc:
        assert exc.status_code == 401
    else:
        raise AssertionError("Expected HTTPException")

    rejected = next(item for item in events if item[2].get("event") == "kakao.webhook.rejected")
    assert rejected[0] == "warning"
    assert rejected[2]["status_code"] == 401
    assert rejected[2]["detail"] == "Kakao 채널 인증에 실패했습니다."


def test_channel_request_token_prefers_admin_channel_auth_config() -> None:
    admin_channel = SimpleNamespace(
        data_json={
            "auth_config": {
                "token": "admin-token",
            }
        }
    )

    token = _channel_request_token(admin_channel, {"appSecret": "bot-secret"})

    assert token == "admin-token"


def test_channel_request_token_falls_back_to_botstation_secret() -> None:
    admin_channel = SimpleNamespace(data_json={"auth_config": {}})

    token = _channel_request_token(admin_channel, {"appSecret": "bot-secret"})

    assert token == "bot-secret"


def test_log_preview_masks_sensitive_values() -> None:
    preview = _log_preview(
        {
            "token": "channel-secret",
            "nested": {"authorization": "Bearer abc.def.ghi"},
            "message": "api_key=private-key",
        }
    )

    assert "channel-secret" not in preview
    assert "abc.def.ghi" not in preview
    assert "private-key" not in preview
    assert '"token": "***"' in preview

def test_verify_kakao_channel_request_rejects_mismatched_token(monkeypatch) -> None:
    import app.api.routes.channels as channels_module

    class _FakeSessionContext:
        def __enter__(self) -> object:
            return object()

        def __exit__(self, exc_type, exc, tb) -> bool:
            return False

    monkeypatch.setattr(
        channels_module,
        "SessionLocal",
        lambda: _FakeSessionContext(),
    )
    monkeypatch.setattr(
        channels_module,
        "_get_active_bot_version",
        lambda *_args, **_kwargs: (SimpleNamespace(organization_id="org-1"), SimpleNamespace(), None),
    )
    monkeypatch.setattr(
        channels_module,
        "_ensure_botstation_connection",
        lambda *_args, **_kwargs: {"appSecret": "expected-token"},
    )
    monkeypatch.setattr(
        channels_module,
        "_get_active_admin_channel",
        lambda *_args, **_kwargs: SimpleNamespace(data_json={"auth_config": {}}),
    )

    try:
        _verify_kakao_channel_request("aidot-bot", "wrong-token")
    except HTTPException as error:
        assert error.status_code == 401
        assert error.detail == "Kakao 채널 인증에 실패했습니다."
    else:
        raise AssertionError("토큰이 다르면 인증 오류가 발생해야 합니다.")


def test_kakao_response_from_serialized_messages_supports_quick_replies() -> None:
    response = _kakao_response_from_serialized_messages(
        [
            {
                "text": "다음 중 선택하세요",
                "payload": {
                    "options": ["요금 안내", "상담사 연결"],
                },
            }
        ]
    )

    assert response["version"] == "2.0"
    assert response["template"]["outputs"][0]["simpleText"]["text"] == "다음 중 선택하세요"
    assert [item["label"] for item in response["template"]["quickReplies"]] == ["요금 안내", "상담사 연결"]


def test_kakao_response_from_serialized_messages_reads_rich_form_buttons() -> None:
    response = _kakao_response_from_serialized_messages(
        [
            {
                "text": "다음 중 선택하세요",
                "payload": {
                    "richForm": [
                        {
                            "type": "BUTTON",
                            "button": [
                                {"title": "확인", "value": "확인", "type": "submit"},
                                {"title": "취소", "value": "취소", "type": "submit"},
                            ],
                        }
                    ],
                },
            }
        ]
    )

    assert [item["messageText"] for item in response["template"]["quickReplies"]] == ["확인", "취소"]


def test_kakao_response_from_serialized_messages_supports_link_quick_replies() -> None:
    response = _kakao_response_from_serialized_messages(
        [
            {
                "text": "도움말을 선택하세요",
                "payload": {
                    "options": [
                        {"label": "홈페이지", "url": "https://example.com/home"},
                        {"label": "상담 연결", "value": "상담 연결"},
                    ],
                },
            }
        ]
    )

    replies = response["template"]["quickReplies"]
    assert replies[0]["action"] == "webLink"
    assert replies[0]["label"] == "홈페이지"
    assert replies[0]["webLinkUrl"] == "https://example.com/home"
    assert replies[1]["action"] == "message"
    assert replies[1]["messageText"] == "상담 연결"


def test_kakao_response_from_serialized_messages_reads_rich_form_link_buttons() -> None:
    response = _kakao_response_from_serialized_messages(
        [
            {
                "text": "원하는 항목을 선택하세요",
                "payload": {
                    "richForm": [
                        {
                            "type": "BUTTON",
                            "button": [
                                {"title": "상품 보기", "url": "https://example.com/products", "type": "link"},
                                {"title": "상담사 연결", "value": "상담사 연결", "type": "submit"},
                            ],
                        }
                    ],
                },
            }
        ]
    )

    replies = response["template"]["quickReplies"]
    assert replies[0]["action"] == "webLink"
    assert replies[0]["webLinkUrl"] == "https://example.com/products"
    assert replies[1]["action"] == "message"
    assert replies[1]["messageText"] == "상담사 연결"


def test_kakao_response_from_serialized_messages_renders_basic_card_for_public_image() -> None:
    response = _kakao_response_from_serialized_messages(
        [
            {
                "text": "이미지 안내",
                "payload": {
                    "richForm": [
                        {"type": "FORM_TITLE", "title": "카드 제목"},
                        {"type": "TEXT", "text": "카드 설명"},
                        {
                            "type": "IMAGE",
                            "url": "https://example.com/image.png",
                            "title": "이미지 제목",
                            "text": "이미지 설명",
                            "link": "https://example.com/detail",
                        },
                    ],
                },
            }
        ]
    )

    card = response["template"]["outputs"][0]["basicCard"]
    assert card["thumbnail"]["imageUrl"] == "https://example.com/image.png"
    assert card["thumbnail"]["fixedRatio"] is True
    assert card["title"] == "이미지 제목"
    assert card["description"] == "이미지 설명"
    assert card["buttons"][0]["webLinkUrl"] == "https://example.com/detail"


def test_kakao_response_from_serialized_messages_renders_basic_card_from_runtime_card_payload() -> None:
    response = _kakao_response_from_serialized_messages(
        [
            {
                "text": "상품 안내",
                "payload": {
                    "card": {
                        "title": "카드 제목",
                        "description": "카드 설명",
                        "imageUrl": "https://example.com/card.png",
                    },
                    "options": [
                        {"label": "자세히 보기", "url": "https://example.com/detail"},
                    ],
                },
            }
        ]
    )

    card = response["template"]["outputs"][0]["basicCard"]
    assert card["title"] == "카드 제목"
    assert card["description"] == "카드 설명"
    assert card["thumbnail"]["imageUrl"] == "https://example.com/card.png"
    assert card["thumbnail"]["fixedRatio"] is True
    assert card["buttons"][0]["webLinkUrl"] == "https://example.com/detail"


def test_kakao_response_from_serialized_messages_renders_carousel_from_runtime_payload() -> None:
    messages = [
        {
            "text": "캐러셀 안내",
            "payload": {
                "carousel": {
                    "title": "캐러셀 제목",
                    "imageUrl": "https://example.com/carousel.png",
                    "itemTitle": "상품 1",
                    "itemContents": "상품 설명",
                    "itemButtonLabel": "상세 보기",
                    "itemButtonValue": "상세 보기",
                    "buttonType": "Button",
                    "bottomButtonLabel": "다음 보기",
                    "bottomButtonValue": "다음 보기",
                },
            },
        }
    ]
    response = _kakao_response_from_serialized_messages(messages)

    carousel = response["template"]["outputs"][0]["carousel"]
    assert carousel["type"] == "basicCard"
    assert carousel["items"][0]["title"] == "상품 1"
    assert carousel["items"][0]["description"] == "상품 설명"
    assert carousel["items"][0]["thumbnail"]["imageUrl"] == "https://example.com/carousel.png"
    assert carousel["items"][0]["thumbnail"]["fixedRatio"] is False
    assert carousel["items"][0]["buttons"][0]["messageText"] == "상세 보기"
    assert response["template"]["quickReplies"][0]["messageText"] == "다음 보기"


def test_kakao_response_from_serialized_messages_adds_basic_card_buttons_from_rich_form() -> None:
    response = _kakao_response_from_serialized_messages(
        [
            {
                "text": "카드 안내",
                "payload": {
                    "richForm": [
                        {"type": "FORM_TITLE", "title": "카드 제목"},
                        {
                            "type": "IMAGE",
                            "url": "https://example.com/card.png",
                            "title": "이미지 제목",
                        },
                        {
                            "type": "BUTTON",
                            "button": [
                                {"title": "자세히", "url": "https://example.com/detail", "type": "link"},
                                {"title": "상담 연결", "value": "상담 연결", "type": "submit"},
                            ],
                        },
                    ],
                },
            }
        ]
    )

    buttons = response["template"]["outputs"][0]["basicCard"]["buttons"]
    assert buttons[0]["action"] == "webLink"
    assert buttons[0]["webLinkUrl"] == "https://example.com/detail"
    assert buttons[1]["action"] == "message"
    assert buttons[1]["messageText"] == "상담 연결"


def test_kakao_response_from_serialized_messages_falls_back_when_image_is_not_public_url() -> None:
    messages = [
        {
            "text": "이미지 안내",
            "payload": {
                "richForm": [
                    {
                        "type": "IMAGE",
                        "url": "/files/temp/sample.png",
                        "title": "이미지 제목",
                    }
                ],
                "options": ["확인"],
            },
        }
    ]
    response = _kakao_response_from_serialized_messages(messages)
    summary = _kakao_response_log_summary(response, messages)

    assert response["template"]["outputs"][0]["simpleText"]["text"] == "이미지 안내"
    assert response["template"]["quickReplies"][0]["label"] == "확인"
    assert summary["fallback_used"] is True
    assert summary["fallback_reasons"] == ["rich_form_non_public_image_url"]


def test_kakao_response_log_summary_reports_unsupported_rich_form_component() -> None:
    messages = [
        {
            "text": "표를 확인하세요",
            "payload": {
                "richForm": [
                    {"type": "FORM_TITLE", "title": "안내"},
                    {"type": "TABLE", "dataTitle": ["값"], "dataValue": [{"value": "A"}]},
                ],
            },
        }
    ]
    response = _kakao_response_from_serialized_messages(messages)
    summary = _kakao_response_log_summary(response, messages)

    assert response["template"]["outputs"][0]["simpleText"]["text"] == "표를 확인하세요"
    assert summary["fallback_used"] is True
    assert "unsupported_rich_form_component:TABLE" in summary["fallback_reasons"]


def test_kakao_response_from_serialized_messages_converts_local_carousel_image_to_public_url(tmp_path, monkeypatch) -> None:
    image_dir = tmp_path / "storage" / "temp"
    image_dir.mkdir(parents=True)
    Image.new("RGB", (340, 226), "navy").save(image_dir / "carousel.png", format="JPEG")
    monkeypatch.setattr("app.api.routes.channels.ROOT_DIR", tmp_path)
    monkeypatch.setattr("app.api.routes.channels.settings.next_public_api_base_url", "https://api-aidot.example.com")
    messages = [
        {
            "text": "캐러셀 안내",
            "payload": {
                "carousel": {
                    "title": "캐러셀 제목",
                    "imageUrl": "/files/temp/carousel.png",
                    "itemTitle": "상품 1",
                    "itemContents": "상품 설명",
                },
            },
        }
    ]

    response = _kakao_response_from_serialized_messages(messages)
    summary = _kakao_response_log_summary(response, messages)
    image_response = get_kakao_image("/files/temp/carousel.png")

    carousel = response["template"]["outputs"][0]["carousel"]
    image_url = carousel["items"][0]["thumbnail"]["imageUrl"]
    assert image_url.startswith("https://api-aidot.example.com/api/v1/channels/kakao/images?path=%2Ffiles%2Ftemp%2Fcarousel.png&v=contain-v1-")
    assert image_response.media_type == "image/jpeg"
    with Image.open(BytesIO(image_response.body)) as image:
        assert image.size == (800, 400)
        assert image.getpixel((0, 200)) == (255, 255, 255)
        assert image.getpixel((400, 200))[2] > 50
    assert summary["fallback_used"] is False
    assert summary["fallback_reasons"] == []

def test_kakao_response_from_serialized_messages_renders_list_card_from_table_payload() -> None:
    response = _kakao_response_from_serialized_messages(
        [
            {
                "text": "상품 목록을 확인하세요",
                "payload": {
                    "columns": ["상품명", "설명", "이미지"],
                    "rows": [
                        {
                            "상품명": "노트 10",
                            "설명": "가용성 점검 불가 정보",
                            "이미지": "https://example.com/note10.png",
                        },
                        {
                            "상품명": "노트 11",
                            "설명": "후속 점검 필요",
                            "이미지": "https://example.com/note11.png",
                        },
                    ],
                },
            }
        ]
    )

    list_card = response["template"]["outputs"][0]["listCard"]
    assert list_card["header"]["title"] == "상품 목록을 확인하세요"
    assert len(list_card["items"]) == 2
    assert list_card["items"][0]["title"] == "노트 10"
    assert list_card["items"][0]["description"] == "가용성 점검 불가 정보"
    assert list_card["items"][0]["imageUrl"] == "https://example.com/note10.png"


def test_kakao_response_from_serialized_messages_falls_back_when_image_is_not_public_url_legacy_assertion() -> None:
    response = _kakao_response_from_serialized_messages(
        [
            {
                "text": "이미지 안내",
                "payload": {
                    "richForm": [
                        {
                            "type": "IMAGE",
                            "url": "/files/temp/sample.png",
                            "title": "이미지 제목",
                        }
                    ],
                    "options": ["확인"],
                },
            }
        ]
    )

    assert response["template"]["outputs"][0]["simpleText"]["text"] == "이미지 안내"
    assert response["template"]["quickReplies"][0]["label"] == "확인"


def test_reset_stalled_waiting_talk_state_releases_invalid_wait_state() -> None:
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "config": {"messageType": "table", "responseType": "single-select"},
            }
        ],
        [],
    )
    state = {
        "graphId": "graph-1",
        "dialogId": "dialog-1",
        "currentNodeId": "talk-1",
        "waitingNodeId": "",
        "__runtimeTransitionLocked": True,
        "__runtimeReturnBlocked": True,
    }

    recovered = _reset_stalled_waiting_talk_state(document, state, "KAKAO")

    assert recovered is True
    assert state["graphId"] == ""
    assert state["dialogId"] == ""
    assert state["currentNodeId"] == ""
    assert state["waitingNodeId"] == ""
    assert "__runtimeTransitionLocked" not in state
    assert "__runtimeReturnBlocked" not in state

def test_reset_stalled_waiting_talk_state_keeps_normal_waiting_talk() -> None:
    document = _document(
        [{"id": "talk-1", "kind": "talk", "config": {"messageType": "table", "responseType": "single-select"}}],
        [],
    )
    state = {
        "graphId": "graph-1",
        "dialogId": "dialog-1",
        "currentNodeId": "talk-1",
        "waitingNodeId": "talk-1",
        "__runtimeTransitionLocked": True,
    }

    recovered = _reset_stalled_waiting_talk_state(document, state, "KAKAO")

    assert recovered is False
    assert state["waitingNodeId"] == "talk-1"
    assert state["__runtimeTransitionLocked"] is True

def test_talk_output_returns_card_payload_for_card_message_type() -> None:
    node = {
        "id": "talk-card-1",
        "title": "카드 안내",
        "config": {
            "messageType": "card",
            "basicMessages": ["상품을 안내합니다."],
            "messages": ["상품 제목", "https://example.com/card.png", "상품 설명"],
        },
    }

    output = _talk_output(node, {})

    assert output is not None
    assert output["type"] == "card"
    assert output["text"] == "상품을 안내합니다."
    assert output["payload"]["card"]["title"] == "상품 제목"
    assert output["payload"]["card"]["imageUrl"] == "https://example.com/card.png"
    assert output["payload"]["card"]["description"] == "상품 설명"


def test_talk_output_returns_dtmf_payload() -> None:
    node = {
        "id": "talk-dtmf-1",
        "config": {
            "messageType": "dtmf",
            "basicMessages": ["주민등록번호 앞자리를 입력하세요."],
            "messages": ["6", "4", "#", "15", "30"],
        },
    }

    output = _talk_output(node, {})

    assert output is not None
    assert output["type"] == "dtmf"
    assert output["text"] == "주민등록번호 앞자리를 입력하세요."
    assert output["payload"] == {
        "dtmf": {
            "minLength": 4,
            "maxLength": 6,
            "endCharacter": "#",
            "firstInputTimeoutMs": 1500,
            "overallInputTimeoutMs": 3000,
        },
        "sourceTalkNodeId": "talk-dtmf-1",
    }


def test_runtime_dtmf_response_validates_and_stores_normalized_number() -> None:
    document = _document(
        [
            {
                "id": "talk-dtmf-1",
                "kind": "talk",
                "config": {
                    "messageType": "dtmf",
                    "messages": ["6", "4", "#", "10", "10"],
                    "responseVariableName": "$pin",
                },
            },
            {"id": "end-1", "kind": "end", "config": {}},
        ],
        [{"sourceNodeId": "talk-dtmf-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )
    state = {**_state(), "currentNodeId": "talk-dtmf-1", "waitingNodeId": "talk-dtmf-1"}

    invalid_outputs, invalid_state = _handle_runtime_message(document, state, "12#")

    assert invalid_outputs[0]["type"] == "dtmf"
    assert invalid_state["waitingNodeId"] == "talk-dtmf-1"

    outputs, completed_state = _handle_runtime_message(document, state, "1234#")

    assert outputs == []
    assert completed_state["variables"]["$pin"] == "1234"
    assert completed_state["waitingNodeId"] == ""

def test_talk_output_marks_single_select_table_as_selectable() -> None:
    node = {
        "id": "talk-table-1",
        "config": {
            "messageType": "table",
            "responseType": "single-select",
            "tableVariableItemId": "users",
            "tableColumnMappings": [
                {"column": "id"},
                {"column": "name"},
            ],
        },
    }

    output = _talk_output(node, {"__items": {"users": [{"id": "1", "name": "김철수"}]}})

    assert output is not None
    assert output["type"] == "table"
    assert output["payload"]["selectable"] is True
    assert output["payload"]["keyColumn"] == ""

def test_talk_output_returns_carousel_payload_for_carousel_message_type() -> None:
    node = {
        "id": "talk-carousel-1",
        "title": "캐러셀 안내",
        "config": {
            "messageType": "carousel",
            "basicMessages": ["캐러셀 안내문"],
            "messages": [
                "캐러셀 제목",
                "https://example.com/carousel.png",
                "상품 1",
                "상품 설명",
                "상세 보기",
                "상세 보기",
                "Button",
                "다음 보기",
                "다음 보기",
            ],
        },
    }

    output = _talk_output(node, {})

    assert output is not None
    assert output["type"] == "carousel"
    assert output["text"] == "캐러셀 안내문"
    assert output["payload"]["carousel"]["title"] == "캐러셀 제목"
    assert output["payload"]["carousel"]["imageUrl"] == "https://example.com/carousel.png"
    assert output["payload"]["carousel"]["itemTitle"] == "상품 1"
    assert output["payload"]["carousel"]["itemContents"] == "상품 설명"
    assert output["payload"]["carousel"]["buttonType"] == "Button"


def test_channel_health_reports_list_card_in_supported_outputs() -> None:
    response = channel_health(_FakeRequest())

    kakao_detail = next(item for item in response["data"]["details"] if item["provider"] == "kakao")
    assert "listCard" in kakao_detail["supported_outputs"]


def test_botstation_connection_allows_legacy_default_when_unconfigured() -> None:
    bot = _FakeBot({"nlu_type": "ml", "nlu_model": "deep_learning_lite", "answer_mode": "fixed"})
    version = _FakeVersion(_document([], []))

    connection = _botstation_channel_connection(bot, version, "webchat")

    assert connection is not None
    assert connection["channelCode"] == "WEBCHAT"
    assert connection["source"] == "legacy-default"


def test_botstation_connection_requires_enabled_matching_channel() -> None:
    bot = _FakeBot(
        {
            "settings_by_version": {
                "v1": {
                    "botstation": {
                        "connected": True,
                        "enabled": True,
                        "channels": [
                            {"channelCode": "WEBCHAT", "enabled": True, "botIdentifier": "demo-bot"},
                            {"channelCode": "KAKAO", "enabled": False, "botIdentifier": "demo-bot"},
                        ],
                    }
                }
            },
            "nlu_type": "ml",
            "nlu_model": "deep_learning_lite",
            "answer_mode": "fixed",
        }
    )
    version = _FakeVersion(_document([], []))

    assert _botstation_channel_connection(bot, version, "webchat") is not None
    assert _botstation_channel_connection(bot, version, "kakao") is None
    assert _botstation_channel_connection(bot, version, "ms-teams") is None


def test_botstation_connection_rejects_mismatched_identifier() -> None:
    bot = _FakeBot(
        {
            "settings_by_version": {
                "v1": {
                    "botstation": {
                        "connected": True,
                        "enabled": True,
                        "channels": [
                            {"channelCode": "WEBCHAT", "enabled": True, "botIdentifier": "other-bot"},
                        ],
                    }
                }
            },
            "nlu_type": "ml",
            "nlu_model": "deep_learning_lite",
            "answer_mode": "fixed",
        }
    )
    version = _FakeVersion(_document([], []))

    assert _botstation_channel_connection(bot, version, "webchat") is None


def test_initial_runtime_state_uses_snake_case_system_variables() -> None:
    bot = _FakeBot({"bot_kind": "hub"})
    version = _FakeVersion(_document([], []))

    state = _initial_runtime_state_for_version(bot, version, "webchat")
    variables = _as_variables(state)

    assert variables["$_bot_id"] == "bot-1"
    assert variables["$_bot_name"] == "테스트봇"
    assert variables["$_bot_hub_id"] == "bot-1"
    assert variables["$_bot_hub_name"] == "테스트봇"
    assert variables["$_channel_id"] == "WEBCHAT"
    assert variables["$_dialog_id"] == "dialog-1"
    assert variables["$_session_id"] == ""
    assert variables["$_user_id"] == ""
    assert variables["$_user_name"] == ""
    assert "$_date_time" in variables
    assert "$_today" in variables
    assert "$_locNm" not in variables
    assert "$_botName" not in variables
    assert "$_botId" not in variables
    assert "$_dialogID" not in variables


def test_active_version_application_keeps_room_session_and_resets_runtime() -> None:
    bot = _FakeBot({"bot_kind": "hub"})
    version = _FakeVersion(_document([], []))
    version.id = "version-2"
    version.name = "v2"
    room = SimpleNamespace(
        id="room-1",
        bot_version_id="version-1",
        participant_id="kakao-user-1",
        participant_name="카카오 사용자",
        metadata_json={"variables": {"$_session_id": "old-session"}},
    )

    previous_version_id = _apply_active_version_to_room(room, bot, version, "kakao")
    variables = _as_variables(room.metadata_json)
    event = next(item for item in _events(room.metadata_json) if item["event"] == "channel.runtime.active_version_applied")

    assert previous_version_id == "version-1"
    assert room.bot_version_id == "version-2"
    assert variables["$_session_id"] == "room-1"
    assert variables["$_user_id"] == "kakao-user-1"
    assert variables["$_user_name"] == "카카오 사용자"
    assert variables["$_channel_id"] == "KAKAO"
    assert event["data"]["previousVersionId"] == "version-1"
    assert event["data"]["activeVersionId"] == "version-2"

def test_select_dialog_prioritizes_exact_training_utterance() -> None:
    document = {
        "dialogs": [
            {
                "id": "intent-1",
                "dialogType": 1,
                "name": "암진단비",
                "utterances": [{"text": "암 진단비 알려줘"}],
            },
            {
                "id": "intent-2",
                "dialogType": 1,
                "name": "보험료",
                "utterances": [{"text": "암 진단비 알려줘 보험료"}],
            },
            {
                "id": "module-1",
                "dialogType": 0,
                "name": "참조 모듈",
                "utterances": [{"text": "암 진단비 알려줘"}],
            },
        ],
        "dialog_flow_graphs": [],
        "apis": [],
    }

    selected, score = _select_dialog(document, "암 진단비 알려줘", prefer_exact_utterance=True)

    assert selected is not None
    assert selected["id"] == "intent-1"
    assert score == 1.0


def test_select_dialog_for_bot_uses_saved_deep_learning_lite_model() -> None:
    document = {
        "dialogs": [
            {
                "id": "intent-agent",
                "dialogType": 1,
                "name": "상담사 전환 요청",
                "utterances": [{"text": "상담사로 바꿔줘"}],
            }
        ],
        "dialog_flow_graphs": [],
        "apis": [],
    }
    bot = _FakeBot({"nlu_type": "ml", "nlu_model": "deep_learning_lite"})
    version = _FakeVersion(document)

    with patch(
        "app.api.routes.channels.classify_deep_learning_lite_model",
        return_value={"dialog_id": "intent-agent", "dialog_name": "상담사 전환 요청", "score": 0.8442},
    ) as classify:
        selected, score = _select_dialog_for_bot(document, bot, version, "상담사 바꿔줘")

    classify.assert_called_once_with(version, "상담사 바꿔줘", version_settings={})
    assert selected is not None
    assert selected["id"] == "intent-agent"
    assert score == 0.8442
def test_select_dialog_for_bot_uses_semantic_vector_search() -> None:
    document = {
        "dialogs": [
            {
                "id": "intent-1",
                "dialogType": 1,
                "name": "암진단비",
                "utterances": [{"text": "암 진단비 알려줘"}],
            }
        ],
        "dialog_flow_graphs": [],
        "apis": [],
    }
    bot = _FakeBot(
        {
            "nlu_type": "semantic",
            "nlu_model": "semantic_engine_default",
            "answer_mode": "fixed",
            "vector_connections": {
                "intent": {
                    "enabled": True,
                    "endpoint_url": "https://vector.example.com/intent/search",
                    "index_name": "aidot-intent",
                }
            },
        }
    )
    version = _FakeVersion(document)

    with patch(
        "app.api.routes.channels.IntentVectorSearchClient.search",
        return_value=[VectorIntentMatch(intent_id="intent-1", intent_name="", score=0.91)],
    ):
        selected, score = _select_dialog_for_bot(document, bot, version, "암 보장 알려줘")

    assert selected is not None
    assert selected["id"] == "intent-1"
    assert score == 0.91


def test_select_dialog_for_bot_prefers_semantic_intent_name_exact_match() -> None:
    document = {
        "dialogs": [
            {
                "id": "intent-1",
                "dialogType": 1,
                "name": "용어 설명",
                "utterances": [{"text": "무슨 뜻이야"}],
            },
            {
                "id": "intent-2",
                "dialogType": 1,
                "name": "상품 설명 요청",
                "utterances": [{"text": "상품 설명"}],
            },
        ],
        "dialog_flow_graphs": [],
        "apis": [],
    }
    bot = _FakeBot(
        {
            "nlu_type": "semantic",
            "nlu_model": "semantic_engine_default",
            "answer_mode": "fixed",
            "vector_connections": {
                "intent": {
                    "enabled": True,
                    "endpoint_url": "https://vector.example.com/intent/search",
                    "index_name": "aidot-intent",
                }
            },
        }
    )
    version = _FakeVersion(document)

    with patch("app.api.routes.channels.IntentVectorSearchClient.search") as search:
        selected, score = _select_dialog_for_bot(document, bot, version, "용어설명")

    search.assert_not_called()
    assert selected is not None
    assert selected["id"] == "intent-1"
    assert score == 1.0


def test_button_selection_contains_option_accepts_embedded_button_text() -> None:
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "버튼",
                "config": {
                    "responseType": "single-select",
                    "messages": ["예", "아니오"],
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )
    state = {"graphId": "graph-1", "dialogId": "dialog-1", "waitingNodeId": "talk-1", "variables": {}}

    outputs, next_state = _handle_runtime_message(document, state, "네 예 입니다", {}, "WEBCHAT", "contains")

    assert outputs == []
    assert next_state["dialogEnded"] is True


def test_button_selection_exact_option_rejects_embedded_button_text() -> None:
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "버튼",
                "config": {
                    "responseType": "single-select",
                    "messages": ["예", "아니오"],
                },
            },
        ],
        [],
    )
    state = {"graphId": "graph-1", "dialogId": "dialog-1", "waitingNodeId": "talk-1", "variables": {}}

    outputs, next_state = _handle_runtime_message(document, state, "네 예 입니다", {}, "WEBCHAT", "exact")

    assert outputs[0]["type"] == "button"
    assert next_state["waitingNodeId"] == "talk-1"


def test_reference_fragment_does_not_block_scenario_validation() -> None:
    document = _document(
        [
            {"id": "start-1", "kind": "start", "title": "대화 시작", "config": {}},
            {"id": "talk-1", "kind": "talk", "title": "Talk 1", "config": {"messages": ["시작"]}},
            {"id": "condition-1", "kind": "condition", "title": "분기", "config": {"variableName": "$input", "branches": [{"id": "branch-else", "operator": "else", "label": "기본", "compareValue": ""}]}},
            {"id": "talk-2", "kind": "talk", "title": "Talk 2", "config": {"messages": ["완료"]}},
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
            {"id": "talk-reference", "kind": "talk", "title": "참조 Talk", "config": {"messages": ["참조"]}},
            {"id": "condition-reference", "kind": "condition", "title": "참조 분기", "config": {"variableName": "$input", "branches": [{"id": "branch-ref", "operator": "equals", "label": "참조 조건", "compareValue": "Y"}]}},
        ],
        [
            {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "talk-1"},
            {"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "condition-1"},
            {"sourceNodeId": "condition-1", "sourcePort": "branch:branch-else", "targetNodeId": "talk-2"},
            {"sourceNodeId": "talk-2", "sourcePort": "next", "targetNodeId": "end-1"},
            {"sourceNodeId": "talk-reference", "sourcePort": "next", "targetNodeId": "condition-1"},
            {"sourceNodeId": "condition-reference", "sourcePort": "branch:branch-ref", "targetNodeId": "end-1"},
        ],
    )

    diagnostics = scenario_validation_from_version(document)

    assert diagnostics["error_count"] == 0
    assert diagnostics["blocked_dialog_ids"] == []


def test_condition_without_else_returns_flow_error_and_ends_dialog() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "condition-1",
                "kind": "condition",
                "title": "분기",
                "config": {
                    "variableName": "$input",
                    "branches": [
                        {"id": "branch-1", "operator": "equals", "label": "조건 1", "compareValue": "Y"},
                    ],
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "condition-1", "sourcePort": "branch:branch-1", "targetNodeId": "end-1"}],
    )

    outputs, next_state = _run_runtime(document, state, "condition-1")

    assert outputs == [{"type": "text", "text": "대화 흐름 설정 오류로 대화를 계속할 수 없습니다.", "options": []}]
    assert next_state["dialogEnded"] is True
    event = _events(next_state)[0]
    assert event["event"] == "channel.runtime.condition_no_else"
    assert event["data"]["evaluatedBranches"] == [
        {
            "branchId": "branch-1",
            "branchLabel": "조건 1",
            "operator": "equals",
            "compareValue": "Y",
            "matched": False,
        }
    ]


def test_condition_flow_error_uses_default_message_override() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "condition-1",
                "kind": "condition",
                "title": "분기",
                "config": {
                    "variableName": "$input",
                    "branches": [
                        {"id": "branch-1", "operator": "equals", "label": "조건 1", "compareValue": "Y"},
                    ],
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "condition-1", "sourcePort": "branch:branch-1", "targetNodeId": "end-1"}],
    )

    outputs, _next_state = _run_runtime(
        document,
        state,
        "condition-1",
        {"runtime_flow_error": "관리자 설정 흐름 오류 메시지"},
    )

    assert outputs == [{"type": "text", "text": "관리자 설정 흐름 오류 메시지", "options": []}]


def test_condition_card_can_evaluate_builtin_function_expression() -> None:
    state = {**_state(), "variables": {"$items": ["사과", "배", "감"]}}
    document = _document(
        [
            {
                "id": "condition-1",
                "kind": "condition",
                "title": "분기",
                "config": {
                    "variableName": "{{$items.size()}}",
                    "branches": [
                        {"id": "branch-1", "operator": "equals", "label": "3개", "compareValue": "3"},
                        {"id": "branch-else", "operator": "else", "label": "기본", "compareValue": ""},
                    ],
                },
            },
            {"id": "talk-1", "kind": "talk", "title": "Talk", "config": {"messages": ["성공"]}},
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [
            {"sourceNodeId": "condition-1", "sourcePort": "branch:branch-1", "targetNodeId": "talk-1"},
            {"sourceNodeId": "condition-1", "sourcePort": "branch:branch-else", "targetNodeId": "end-1"},
        ],
    )

    outputs, next_state = _run_runtime(document, state, "condition-1")

    assert outputs[0]["type"] == "text"
    assert outputs[0]["text"] == "성공"
    assert outputs[0]["options"] == []
    condition_event = next(event for event in _events(next_state) if event["event"] == "channel.runtime.condition_selected")
    assert condition_event["data"]["value"] == "3"
    assert condition_event["data"]["branchId"] == "branch-1"


def test_runtime_block_reason_rejects_version_with_scenario_errors() -> None:
    document = _document(
        [
            {"id": "start-1", "kind": "start", "title": "대화 시작", "config": {}},
            {
                "id": "condition-1",
                "kind": "condition",
                "title": "분기",
                "config": {
                    "variableName": "$input",
                    "branches": [
                        {"id": "branch-1", "operator": "equals", "label": "조건 1", "compareValue": "Y"},
                    ],
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [
            {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "condition-1"},
            {"sourceNodeId": "condition-1", "sourcePort": "branch:branch-1", "targetNodeId": "end-1"},
        ],
    )

    reason = _runtime_block_reason(_FakeBot(), _FakeVersion(document))

    assert reason == (
        "대화 설계 오류가 있는 운영버전은 실행할 수 없습니다. "
        "테스트 모듈 / 분기: Condition 카드에는 '그 외의 경우' 분기가 1개 이상 필요합니다. "
        "오류를 수정한 뒤 다시 학습/운영 지정해주세요."
    )


def test_runtime_block_reason_rejects_unsupported_answer_mode() -> None:
    document = _document(
        [
            {"id": "start-1", "kind": "start", "title": "대화 시작", "config": {}},
            {"id": "talk-1", "kind": "talk", "title": "Talk", "config": {"messages": ["안내"]}},
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [
            {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "talk-1"},
            {"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"},
        ],
    )

    reason = _runtime_block_reason(
        _FakeBot({"nlu_type": "ml", "nlu_model": "deep_learning_lite", "answer_mode": "llm"}),
        _FakeVersion(document),
    )

    assert reason == "선택한 답변 방식은 아직 실행 엔진에 연결되지 않았습니다. 현재 실행 가능한 답변 방식은 정해진 답변, Semantic RAG 답변, LLM RAG 답변입니다."


def test_initial_runtime_state_uses_first_graph_when_greeting_module_is_not_set() -> None:
    document = _document(
        [
            {"id": "start-1", "kind": "start", "title": "Start", "config": {}},
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "첫 안내",
                "config": {"messageType": "text", "basicMessages": ["안녕하세요."]},
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [
            {"sourceNodeId": "start-1", "sourcePort": "next", "targetNodeId": "talk-1"},
            {"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"},
        ],
    )

    state = _initial_runtime_state_for_version(_FakeBot(), _FakeVersion(document))

    assert state["graphId"] == "graph-1"
    assert state["dialogId"] == "dialog-1"
    assert state["currentNodeId"] == "talk-1"
    assert state["waitingNodeId"] == ""


def test_condition_success_records_selected_branch() -> None:
    state = {**_state(), "variables": {"$input": "Y"}}
    document = _document(
        [
            {
                "id": "condition-1",
                "kind": "condition",
                "title": "분기",
                "config": {
                    "variableName": "$input",
                    "branches": [
                        {"id": "branch-1", "operator": "equals", "label": "조건 1", "compareValue": "Y"},
                        {"id": "branch-else", "operator": "else", "label": "그 외의 경우"},
                    ],
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [
            {"sourceNodeId": "condition-1", "sourcePort": "branch:branch-1", "targetNodeId": "end-1"},
            {"sourceNodeId": "condition-1", "sourcePort": "branch:branch-else", "targetNodeId": "end-1"},
        ],
    )

    _, next_state = _run_runtime(document, state, "condition-1")
    event = next(item for item in _events(next_state) if item["event"] == "channel.runtime.condition_selected")

    assert event["data"]["branchId"] == "branch-1"
    assert event["data"]["branchLabel"] == "조건 1"
    assert event["data"]["selectedByElse"] is False
    assert event["data"]["evaluatedBranches"] == [
        {
            "branchId": "branch-1",
            "branchLabel": "조건 1",
            "operator": "equals",
            "compareValue": "Y",
            "matched": True,
        }
    ]
    assert event["data"]["targetNodeId"] == "end-1"


def test_condition_else_records_failed_branch_evaluations() -> None:
    state = {**_state(), "variables": {"$input": "N"}}
    document = _document(
        [
            {
                "id": "condition-1",
                "kind": "condition",
                "title": "분기",
                "config": {
                    "variableName": "$input",
                    "branches": [
                        {"id": "branch-1", "operator": "equals", "label": "조건 1", "compareValue": "Y"},
                        {"id": "branch-else", "operator": "else", "label": "그 외의 경우"},
                    ],
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [
            {"sourceNodeId": "condition-1", "sourcePort": "branch:branch-1", "targetNodeId": "end-1"},
            {"sourceNodeId": "condition-1", "sourcePort": "branch:branch-else", "targetNodeId": "end-1"},
        ],
    )

    _, next_state = _run_runtime(document, state, "condition-1")
    event = next(item for item in _events(next_state) if item["event"] == "channel.runtime.condition_selected")

    assert event["data"]["branchId"] == "branch-else"
    assert event["data"]["branchLabel"] == "그 외의 경우"
    assert event["data"]["selectedByElse"] is True
    assert event["data"]["evaluatedBranches"] == [
        {
            "branchId": "branch-1",
            "branchLabel": "조건 1",
            "operator": "equals",
            "compareValue": "Y",
            "matched": False,
        }
    ]
    assert event["data"]["targetNodeId"] == "end-1"


def test_function_failure_uses_exception_flow_when_connected() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "function-1",
                "kind": "function",
                "title": "API 호출",
                "config": {"apiId": "missing-api", "methodId": "missing-method"},
            },
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "예외 안내",
                "config": {"messageType": "text", "basicMessages": ["예외 흐름입니다."]},
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [
            {"sourceNodeId": "function-1", "sourcePort": "exception", "targetNodeId": "talk-1"},
            {"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"},
        ],
    )

    outputs, next_state = _run_runtime(document, state, "function-1")

    assert outputs == [{"type": "text", "text": "예외 흐름입니다.", "options": [], "payload": {"sourceTalkNodeId": "talk-1"}}]
    assert next_state["dialogEnded"] is True
    assert any(event["event"] == "channel.runtime.function_exception_flow" for event in _events(next_state))


def test_jump_success_records_target_dialog() -> None:
    state = _state()
    document = {
        "dialogs": [
            {"id": "dialog-1", "name": "시작 모듈", "displayName": "시작 모듈", "dialogType": 0},
            {"id": "dialog-2", "name": "대상 모듈", "displayName": "대상 모듈", "dialogType": 0},
        ],
        "dialog_flow_graphs": [
            {
                "id": "graph-1",
                "dialogId": "dialog-1",
                "name": "시작 모듈",
                "nodes": [
                    {
                        "id": "jump-1",
                        "kind": "jump",
                        "title": "이동",
                        "config": {"targetType": "dialog", "targetDialogId": "dialog-2", "targetDialogName": "대상 모듈"},
                    }
                ],
                "links": [],
            },
            {
                "id": "graph-2",
                "dialogId": "dialog-2",
                "name": "대상 모듈",
                "nodes": [{"id": "end-1", "kind": "end", "title": "End", "config": {}}],
                "links": [],
            },
        ],
        "apis": [],
    }

    _, next_state = _run_runtime(document, state, "jump-1")
    event = next(item for item in _events(next_state) if item["event"] == "channel.runtime.jump_dialog_selected")

    assert event["data"]["targetDialogId"] == "dialog-2"
    assert event["data"]["targetGraphId"] == "graph-2"
    assert next_state["dialogEnded"] is True


def test_jump_missing_card_returns_module_error_and_records_detail() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "jump-1",
                "kind": "jump",
                "title": "카드 이동",
                "config": {"targetType": "card", "targetCardId": "missing-card"},
            },
        ],
        [],
    )

    outputs, next_state = _run_runtime(document, state, "jump-1")
    event = next(item for item in _events(next_state) if item["event"] == "channel.runtime.jump_card_missing")

    assert outputs == [{"type": "text", "text": "연결할 대화 모듈을 찾지 못했습니다.", "options": []}]
    assert next_state["dialogEnded"] is True
    assert next_state["waitingNodeId"] == ""
    assert event["level"] == "error"
    assert event["message"] == "Jump 카드가 이동할 카드를 찾지 못했습니다."
    assert event["data"]["targetCardId"] == "missing-card"


def test_jump_missing_target_uses_default_message_override() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "jump-1",
                "kind": "jump",
                "title": "카드 이동",
                "config": {"targetType": "card", "targetCardId": "missing-card"},
            },
        ],
        [],
    )

    outputs, _next_state = _run_runtime(
        document,
        state,
        "jump-1",
        {"runtime_module_not_found": "관리자 설정 모듈 없음 메시지"},
    )

    assert outputs == [{"type": "text", "text": "관리자 설정 모듈 없음 메시지", "options": []}]


def test_jump_missing_dialog_returns_module_error_and_records_detail() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "jump-1",
                "kind": "jump",
                "title": "모듈 이동",
                "config": {"targetType": "dialog", "targetDialogId": "missing-dialog", "targetDialogName": "없는 모듈"},
            },
        ],
        [],
    )

    outputs, next_state = _run_runtime(document, state, "jump-1")
    event = next(item for item in _events(next_state) if item["event"] == "channel.runtime.jump_dialog_missing")

    assert outputs == [{"type": "text", "text": "연결할 대화 모듈을 찾지 못했습니다.", "options": []}]
    assert next_state["dialogEnded"] is True
    assert next_state["waitingNodeId"] == ""
    assert event["level"] == "error"
    assert event["message"] == "Jump 카드가 이동할 의도/모듈을 찾지 못했습니다."
    assert event["data"]["targetDialogId"] == "missing-dialog"
    assert event["data"]["targetDialogName"] == "없는 모듈"


def test_talk_runtime_records_output_and_wait_state() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "질문",
                "config": {"messageType": "text", "basicMessages": ["이름을 입력하세요."], "responseType": "relay"},
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )

    outputs, next_state = _run_runtime(document, state, "talk-1")
    event = next(item for item in _events(next_state) if item["event"] == "channel.runtime.talk_completed")

    assert outputs == [{"type": "text", "text": "이름을 입력하세요.", "options": [], "payload": {"sourceTalkNodeId": "talk-1"}}]
    assert next_state["waitingNodeId"] == "talk-1"
    assert event["data"]["messageType"] == "text"
    assert event["data"]["responseType"] == "relay"
    assert event["data"]["outputType"] == "text"
    assert event["data"]["hasOutput"] is True
    assert event["data"]["waitsForResponse"] is True
    assert event["data"]["nextNodeId"] == "end-1"


def test_form_relay_talk_waits_for_rich_form_submit() -> None:
    state = _state()
    rich_form = '{"type":"BUTTON","button":[{"key":"ok","title":"확인","value":"OK","type":"submit"}]}'
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "리치폼",
                "config": {
                    "messageType": "form",
                    "messages": [rich_form],
                    "responseType": "form-relay",
                    "responseVariableName": "$result",
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )

    outputs, next_state = _run_runtime(document, state, "talk-1")
    event = next(item for item in _events(next_state) if item["event"] == "channel.runtime.talk_completed")

    assert outputs[0]["type"] == "form"
    assert next_state["waitingNodeId"] == "talk-1"
    assert event["data"]["responseType"] == "form-relay"
    assert event["data"]["waitsForResponse"] is True


def test_form_relay_display_only_rich_form_continues() -> None:
    state = _state()
    rich_form = '{"type":"FORM_TITLE","title":"안내"}'
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "리치폼 안내",
                "config": {
                    "messageType": "form",
                    "messages": [rich_form],
                    "responseType": "form-relay",
                    "responseVariableName": "$result",
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )

    outputs, next_state = _run_runtime(document, state, "talk-1")
    event = next(item for item in _events(next_state) if item["event"] == "channel.runtime.talk_completed")

    assert outputs[0]["type"] == "form"
    assert next_state["waitingNodeId"] == ""
    assert next_state["dialogEnded"] is True
    assert event["data"]["waitsForResponse"] is False


def test_rich_form_multiple_root_components_are_preserved() -> None:
    state = _state()
    rich_form = '{"type":"FORM_TITLE","title":"입력"}, {"type":"TEXT","text":"텍스트1"}, {"type":"TEXT","text":"텍스트2"}'
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "리치폼 안내",
                "config": {
                    "messageType": "form",
                    "messages": [rich_form],
                    "responseType": "none",
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )

    outputs, _next_state = _run_runtime(document, state, "talk-1")

    assert outputs[0]["type"] == "form"
    assert [item["type"] for item in outputs[0]["payload"]["richForm"]] == ["FORM_TITLE", "TEXT", "TEXT"]


def test_rich_form_multiple_message_components_are_preserved() -> None:
    state = _state()
    input_component = '{"type":"TEXTAREA","key":"input","title":"질문내용","value":"TEXTAREA"}'
    button_component = '{"type":"BUTTON","button":[{"key":"submit","title":"확인","value":"submit","type":"submit"}]}'
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "리치폼 입력",
                "config": {
                    "messageType": "form",
                    "messages": [input_component, button_component],
                    "responseType": "form-relay",
                },
            },
        ],
        [],
    )

    outputs, next_state = _run_runtime(document, state, "talk-1")

    assert outputs[0]["type"] == "form"
    assert [item["type"] for item in outputs[0]["payload"]["richForm"]] == ["TEXTAREA", "BUTTON"]
    assert next_state["waitingNodeId"] == "talk-1"


def test_rich_form_recovers_components_from_malformed_channel_template() -> None:
    state = _state()
    rich_form = '{"type":"TEXTAREA","key":"questionContent"}}, {"type":"BUTTON","button":[{"title":"확인","value":"submit","type":"submit"}]}'
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "리치폼 입력",
                "config": {
                    "messageType": "form",
                    "messages": [rich_form],
                    "responseType": "form-relay",
                },
            },
        ],
        [],
    )

    outputs, _next_state = _run_runtime(document, state, "talk-1")

    assert [item["type"] for item in outputs[0]["payload"]["richForm"]] == ["TEXTAREA", "BUTTON"]


def test_rich_form_dedupes_concatenated_duplicate_components() -> None:
    state = _state()
    rich_form = '[{"type":"TOGGLEBUTTON","key":"toggle1"},{"type":"BUTTON","button":[{"title":"확인","type":"submit"}]}][{"type":"TOGGLEBUTTON","key":"toggle1"},{"type":"BUTTON","button":[{"title":"확인","type":"submit"}]}]'
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "리치폼 입력",
                "config": {
                    "messageType": "form",
                    "messages": [rich_form],
                    "responseType": "form-relay",
                },
            },
        ],
        [],
    )

    outputs, _next_state = _run_runtime(document, state, "talk-1")

    assert [item["type"] for item in outputs[0]["payload"]["richForm"]] == ["TOGGLEBUTTON", "BUTTON"]


def test_talk_runtime_records_empty_output_warning() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "빈 출력",
                "config": {"messageType": "text", "basicMessages": [], "messages": [], "responseType": "none"},
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )

    outputs, next_state = _run_runtime(document, state, "talk-1")
    event = next(item for item in _events(next_state) if item["event"] == "channel.runtime.talk_completed")

    assert outputs == []
    assert next_state["dialogEnded"] is True
    assert event["level"] == "warning"
    assert event["data"]["hasOutput"] is False
    assert event["data"]["waitsForResponse"] is False
    assert event["data"]["nextNodeId"] == "end-1"


def test_link_button_talk_runtime_outputs_kakao_ready_actions() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "링크 버튼",
                "config": {
                    "messageType": "link-button",
                    "basicMessages": ["원하는 항목을 선택하세요."],
                    "linkButtonItems": [
                        {"id": "link-1", "label": "홈페이지", "url": "https://example.com/home"},
                        {"id": "link-2", "label": "이용안내", "url": "https://example.com/help"},
                    ],
                    "responseType": "none",
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )

    outputs, next_state = _run_runtime(document, state, "talk-1")
    event = next(item for item in _events(next_state) if item["event"] == "channel.runtime.talk_completed")

    assert outputs == [
        {
            "type": "link-button",
            "text": "원하는 항목을 선택하세요.",
            "options": [
                {"label": "홈페이지", "url": "https://example.com/home"},
                {"label": "이용안내", "url": "https://example.com/help"},
            ],
            "payload": {"sourceTalkNodeId": "talk-1"},
        }
    ]
    assert event["data"]["messageType"] == "link-button"
    assert event["data"]["outputType"] == "link-button"
    assert event["data"]["hasOutput"] is True


def test_form_relay_response_records_variable_update_event() -> None:
    state = {**_state(), "waitingNodeId": "talk-1"}
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "리치폼",
                "config": {
                    "messageType": "form",
                    "responseType": "form-relay",
                    "responseVariableName": "$formResult",
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )
    message = '{"response":{"toggle-2":{"value":"Y"}}}'

    handled, next_node_id = _store_form_result_variable(document, state, "talk-1", message, "WEBCHAT")
    event = next(item for item in _events(state) if item["event"] == "channel.runtime.form_response_stored")

    assert handled is True
    assert next_node_id == "end-1"
    assert state["variables"]["$formResult.response.toggle-2.value"] == "Y"
    assert event["data"]["variableName"] == "$formResult"
    assert "$formResult.response.toggle-2.value" in event["data"]["updatedVariables"]


def test_form_relay_without_next_node_does_not_route_to_intent_fallback() -> None:
    state = {**_state(), "waitingNodeId": "talk-1"}
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "리치폼",
                "config": {
                    "messageType": "form",
                    "responseType": "form-relay",
                    "responseVariableName": "$formResult",
                },
            },
        ],
        [],
    )

    handled, next_node_id = _store_form_result_variable(document, state, "talk-1", '{"response":{"name":{"value":"신산"}}}', "WEBCHAT")

    assert handled is True
    assert next_node_id is None
    assert _should_run_intent_fallback([], handled, True) is False
    assert state["variables"]["$formResult.response.name.value"] == "신산"


def test_form_single_select_stores_rich_form_response_object() -> None:
    state = {**_state(), "waitingNodeId": "talk-1"}
    rich_form = '{"type":"BUTTON","direction":"vertical","button":[{"key":"input","title":"FORM TITLE","value":"FORM TITLE","type":"submit"},{"key":"input","title":"INPUT","value":"INPUT","type":"submit"}]}'
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "리치폼 선택",
                "config": {
                    "messageType": "form",
                    "messages": [rich_form],
                    "responseType": "single-select",
                    "responseVariableName": "$select",
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )
    message = '{"webchatRichFormVersion":"1.0","response":{"input":{"value":"FORM TITLE"},"buttonValue":"FORM TITLE"}}'

    handled, next_node_id = _store_form_result_variable(document, state, "talk-1", message, "WEBCHAT")
    outputs, next_state = _handle_runtime_message(document, state, message, {}, "WEBCHAT")

    assert handled is False
    assert next_node_id is None
    assert outputs == []
    assert next_state["variables"]["$select.response.buttonValue"] == "FORM TITLE"
    assert next_state["variables"]["$select.response.input.value"] == "FORM TITLE"
    assert next_state["dialogEnded"] is True


def test_single_select_response_is_treated_as_structured_input() -> None:
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "리치폼 선택",
                "config": {
                    "messageType": "form",
                    "responseType": "single-select",
                    "responseVariableName": "$select",
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )
    message = '{"webchatRichFormVersion":"1.0","response":{"input":{"value":"FORM TITLE"},"buttonValue":"FORM TITLE"}}'

    assert _is_structured_talk_input(document, "talk-1", message, "WEBCHAT") is True
    assert _should_run_intent_fallback([], False, False, True) is False


def test_single_select_response_is_treated_as_structured_input_without_source_node_id() -> None:
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "리치폼 선택",
                "config": {
                    "messageType": "form",
                    "responseType": "single-select",
                    "responseVariableName": "$select",
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )
    message = '{"webchatRichFormVersion":"1.0","response":{"input":{"value":"FORM TITLE"},"buttonValue":"FORM TITLE"}}'

    assert _is_structured_talk_input(document, None, message, "WEBCHAT", waiting_talk_node_id="talk-1") is True
    assert _should_run_intent_fallback([], False, False, True) is False


def test_store_form_result_variable_uses_waiting_node_when_source_talk_node_id_missing() -> None:
    state = {**_state(), "waitingNodeId": "talk-1"}
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "리치폼",
                "config": {
                    "messageType": "form",
                    "responseType": "form-relay",
                    "responseVariableName": "$formResult",
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )
    message = '{"response":{"name":{"value":"신산"}}}'

    handled, next_node_id = _store_form_result_variable(document, state, None, message, "WEBCHAT", waiting_talk_node_id="talk-1")

    assert handled is True
    assert next_node_id == "end-1"
    assert state["variables"]["$formResult.response.name.value"] == "신산"


def test_extract_entity_source_talk_payload_is_treated_as_structured_input() -> None:
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "엔티티 추출 응답",
                "config": {
                    "messageType": "text",
                    "responseType": "extract-entity",
                    "responseVariableName": "$entity",
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )
    message = '{"response":{"value":"ok"}}'

    assert _is_structured_talk_input(document, "talk-1", message, "WEBCHAT") is True
    assert _should_run_intent_fallback([], False, False, True) is False


def test_relay_talk_payload_with_rich_form_button_is_treated_as_structured_input() -> None:
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "바로 전달 응답",
                "config": {
                    "messageType": "text",
                    "responseType": "relay",
                    "responseVariableName": "$relay",
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )
    message = '{"buttonValue":"CONFIRM"}'

    assert _is_structured_talk_input(document, "talk-1", message, "WEBCHAT") is True
    assert _should_run_intent_fallback([], False, False, True) is False


def test_talk_response_records_variable_update_event() -> None:
    state = {**_state(), "waitingNodeId": "talk-1"}
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "이름 질문",
                "config": {
                    "messageType": "text",
                    "responseType": "relay",
                    "responseVariableName": "$name",
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )

    _, next_state = _handle_runtime_message(document, state, "신산", {}, "WEBCHAT")
    event = next(item for item in _events(next_state) if item["event"] == "channel.runtime.talk_response_stored")

    assert next_state["variables"]["$name"] == "신산"
    assert event["data"]["updatedVariables"] == ["$name"]
    assert event["data"]["valuePreviews"]["$name"] == "신산"
    assert event["data"]["nextNodeId"] == "end-1"


def test_form_relay_style_response_records_response_object_for_relay() -> None:
    state = {**_state(), "waitingNodeId": "talk-1"}
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "폼 응답 전달",
                "config": {
                    "messageType": "form",
                    "responseType": "relay",
                    "responseVariableName": "$result",
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "talk-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )
    message = '{"response":{"name":{"value":"신산"},"age":{"value":"42"}}}'

    _, next_state = _handle_runtime_message(document, state, message, {}, "WEBCHAT")
    event = next(item for item in _events(next_state) if item["event"] == "channel.runtime.talk_response_stored")

    assert next_state["variables"]["$result.response.name.value"] == "신산"
    assert next_state["variables"]["$result.response.age.value"] == "42"
    assert "$result.response.name.value" in event["data"]["updatedVariables"]
    assert event["data"]["nextNodeId"] == "end-1"


def test_function_failure_without_exception_flow_returns_error_and_ends_dialog() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "function-1",
                "kind": "function",
                "title": "API 호출",
                "config": {"apiId": "missing-api", "methodId": "missing-method"},
            }
        ],
        [],
    )

    outputs, next_state = _run_runtime(document, state, "function-1")

    assert outputs == [{"type": "text", "text": "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", "options": []}]
    assert next_state["dialogEnded"] is True
    assert _events(next_state)[0]["event"] == "channel.runtime.function_failed"


def test_function_failure_uses_default_message_override() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "function-1",
                "kind": "function",
                "title": "API 호출",
                "config": {"apiId": "missing-api", "methodId": "missing-method"},
            }
        ],
        [],
    )

    outputs, _next_state = _run_runtime(
        document,
        state,
        "function-1",
        {"system_error": "관리자 설정 시스템 오류 메시지"},
    )

    assert outputs == [{"type": "text", "text": "관리자 설정 시스템 오류 메시지", "options": []}]


def test_end_card_session_flag_controls_variable_lifetime() -> None:
    document = _document(
        [
            {"id": "end-keep", "kind": "end", "title": "End", "config": {"endSessionImmediately": False}},
            {"id": "end-close", "kind": "end", "title": "End", "config": {"endSessionImmediately": True}},
        ],
        [],
    )
    keep_state = {**_state(), "variables": {"$result": {"status": "ok"}}}
    close_state = {**_state(), "variables": {"$result": {"status": "ok"}}}

    _, kept = _run_runtime(document, keep_state, "end-keep")
    _, closed = _run_runtime(document, close_state, "end-close")

    assert kept["dialogEnded"] is True
    assert kept.get("sessionEnded") is not True
    assert kept["variables"] == {"$result": {"status": "ok"}}
    assert closed["dialogEnded"] is True
    assert closed["sessionEnded"] is True
    assert closed["variables"] == {}


def test_end_card_message_renders_result_object() -> None:
    document = _document(
        [
            {
                "id": "end-1",
                "kind": "end",
                "title": "End",
                "config": {"message": "종료합니다. {{$result}}", "endSessionImmediately": False},
            },
        ],
        [],
    )
    state = {**_state(), "variables": {"$result": {"status": "ok", "count": 2}}}

    outputs, next_state = _run_runtime(document, state, "end-1")

    assert outputs == [{"type": "text", "text": '종료합니다. {"status": "ok", "count": 2}', "options": []}]
    assert next_state["dialogEnded"] is True
    assert next_state["variables"] == {"$result": {"status": "ok", "count": 2}}


def test_variable_card_renders_template_values_before_storing() -> None:
    state = {**_state(), "variables": {"$result": {"status": "ok", "items": [{"label": "첫번째"}]}}}
    document = _document(
        [
            {
                "id": "variable-1",
                "kind": "variable",
                "title": "결과 저장",
                "config": {
                    "items": [
                        {"id": "item-1", "variableName": "$summary", "value": "상태={{$result.status}}, 항목={{$result.items[0].label}}"}
                    ]
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "variable-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )

    _, next_state = _run_runtime(document, state, "variable-1")

    assert next_state["variables"]["$summary"] == "상태=ok, 항목=첫번째"
    assert next_state["variables"]["__items"]["item-1"] == "상태=ok, 항목=첫번째"
    variable_event = next(event for event in _events(next_state) if event["event"] == "channel.runtime.variable_completed")
    assert variable_event["data"]["updatedVariables"] == ["$summary"]
    assert variable_event["data"]["updatedItems"] == ["item-1"]
    assert variable_event["data"]["valuePreviews"]["$summary"] == "상태=ok, 항목=첫번째"


def test_function_output_path_supports_bracket_array_index() -> None:
    response = {
        "items": [{"label": "첫번째", "value": 1}],
        "response": {"toggle-2": {"value": "Y"}},
    }

    assert _function_output_value(response, "root.items[0].label") == "첫번째"
    assert _function_output_value(response, "root.items[].value") == 1
    assert _function_output_value(response, 'root["response"]["toggle-2"].value') == "Y"


def test_function_success_records_updated_output_variables() -> None:
    class _Response:
        status = 200
        reason = "OK"

        def __enter__(self) -> "_Response":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return b'{"items":[{"label":"first"}],"ok":true}'

    state = _state()
    variables = _as_variables(state)
    node = {
        "id": "function-1",
        "kind": "function",
        "title": "API 호출",
        "config": {
            "apiId": "api-1",
            "methodId": "method-1",
            "outputMappings": [{"variableName": "$firstLabel", "path": "root.items[0].label"}],
        },
    }
    document = _document(
        [node],
        [],
        apis=[
            {
                "id": "api-1",
                "name": "테스트 API",
                "baseUrl": "http://example.test",
                "methods": [{"id": "method-1", "name": "조회", "httpMethod": "GET", "methodUrl": "/items"}],
            }
        ],
    )

    with patch("app.api.routes.channels.urlopen", return_value=_Response()):
        ok = _execute_function_node(document, node, variables, state, document["dialog_flow_graphs"][0])

    assert ok is True
    assert variables["$firstLabel"] == "first"
    assert variables["__lastFunctionResult"]["updatedVariables"] == [
        "$firstLabel",
        "$result",
        "$apiResult.__status",
        "$result.__status",
    ]
    assert variables["__lastFunctionResult"]["valuePreviews"]["$firstLabel"] == "first"


def test_function_http_error_records_request_and_response_detail() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "function-1",
                "kind": "function",
                "title": "API 호출",
                "config": {
                    "apiId": "api-1",
                    "methodId": "method-1",
                    "parameterMappings": [{"parameterId": "param-1", "value": "{{$input}}"}],
                },
            }
        ],
        [],
        apis=[
            {
                "id": "api-1",
                "name": "테스트 API",
                "baseUrl": "http://example.test",
                "methods": [
                    {
                        "id": "method-1",
                        "name": "조회",
                        "httpMethod": "GET",
                        "methodUrl": "/items",
                        "parameters": [{"id": "param-1", "name": "q", "location": "query"}],
                    }
                ],
            }
        ],
    )
    state["variables"] = {"$input": "검색어"}
    error = HTTPError("http://example.test/items?q=%EA%B2%80%EC%83%89%EC%96%B4", 503, "Service Unavailable", {}, BytesIO(b'{"error":"down"}'))

    with patch("app.api.routes.channels.urlopen", side_effect=error):
        outputs, next_state = _run_runtime(document, state, "function-1")

    function_event = next(event for event in _events(next_state) if event["event"] == "channel.runtime.function_failed")
    data = function_event["data"]

    assert outputs == [{"type": "text", "text": "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", "options": []}]
    assert function_event["level"] == "error"
    assert data["ok"] is False
    assert data["status"] == 503
    assert data["statusText"] == "Service Unavailable"
    assert data["apiName"] == "테스트 API"
    assert data["methodName"] == "조회"
    assert data["url"].endswith("/items?q=%EA%B2%80%EC%83%89%EC%96%B4")
    assert data["request"]["parameterValues"] == {"q": "검색어"}
    assert data["responsePreview"] == '{"error": "down"}'


def test_function_missing_api_config_uses_runtime_error_message() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "function-1",
                "kind": "function",
                "title": "API 호출",
                "config": {"apiId": "", "methodId": ""},
            }
        ],
        [],
    )

    outputs, next_state = _run_runtime(document, state, "function-1")
    function_event = next(event for event in _events(next_state) if event["event"] == "channel.runtime.function_failed")

    assert outputs == [{"type": "text", "text": "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", "options": []}]
    assert function_event["level"] == "error"
    assert function_event["data"]["message"] == "Function 카드의 API 또는 Method가 설정되어 있지 않습니다."


def test_function_parameter_missing_variable_is_recorded_as_runtime_event() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "function-1",
                "kind": "function",
                "title": "API 호출",
                "config": {
                    "apiId": "api-1",
                    "methodId": "method-1",
                    "parameterMappings": [{"parameterId": "param-1", "value": "{{$missing.value}}"}],
                },
            }
        ],
        [],
        apis=[
            {
                "id": "api-1",
                "name": "테스트 API",
                "baseUrl": "http://127.0.0.1:9",
                "methods": [
                    {
                        "id": "method-1",
                        "name": "조회",
                        "httpMethod": "GET",
                        "methodUrl": "/items",
                        "parameters": [{"id": "param-1", "name": "q", "location": "query"}],
                    }
                ],
            }
        ],
    )

    _, next_state = _run_runtime(document, state, "function-1")

    event = next(
        event
        for event in _events(next_state)
        if event["event"] == "channel.runtime.variable_empty" and event["data"]["expression"] == "$missing.value"
    )
    assert event["data"]["rootVariable"] == "$missing"
    assert event["data"]["path"] == "value"
    assert event["data"]["rootVariablePresent"] is False
    assert event["data"]["availableVariables"] == []


def test_variable_empty_log_marks_existing_root_with_missing_path() -> None:
    state = {**_state(), "variables": {"$result": {"status": "ok"}}}
    document = _document(
        [
            {
                "id": "talk-1",
                "kind": "talk",
                "title": "결과출력",
                "config": {"messageType": "text", "basicMessages": ["결과={{$result.missing}}"]},
            }
        ],
        [],
    )

    _run_runtime(document, state, "talk-1")
    event = next(item for item in _events(state) if item["event"] == "channel.runtime.variable_empty")

    assert event["data"]["rootVariable"] == "$result"
    assert event["data"]["path"] == "missing"
    assert event["data"]["rootVariablePresent"] is True
    assert event["data"]["rootValuePreview"] == '{"status": "ok"}'
    assert event["data"]["availableVariables"] == ["$result"]


def test_script_runtime_records_updated_and_missing_variables() -> None:
    state = _state()
    document = _document(
        [
            {
                "id": "script-1",
                "kind": "script",
                "title": "스크립트",
                "config": {
                    "code": 'const ok = {"value": 1};',
                    "returnVariables": [
                        {"id": "return-1", "variableName": "$scriptOk", "scriptVariableName": "ok"},
                        {"id": "return-2", "variableName": "$scriptMissing", "scriptVariableName": "missing"},
                    ],
                },
            },
            {"id": "end-1", "kind": "end", "title": "End", "config": {}},
        ],
        [{"sourceNodeId": "script-1", "sourcePort": "next", "targetNodeId": "end-1"}],
    )

    _, next_state = _run_runtime(document, state, "script-1")
    script_event = next(event for event in _events(next_state) if event["event"] == "channel.runtime.script_completed")

    assert next_state["variables"]["$scriptOk"] == {"value": 1}
    assert next_state["variables"]["$scriptMissing"] == ""
    assert script_event["level"] == "warning"
    assert script_event["data"]["updatedVariables"] == ["$scriptOk", "$scriptMissing"]
    assert script_event["data"]["missingScriptVariables"] == ["missing"]


def test_runtime_flow_limit_returns_error_and_ends_dialog() -> None:
    state = _state()
    document = _document(
        [
            {"id": "jump-1", "kind": "jump", "title": "반복", "config": {"targetType": "card", "targetCardId": "jump-1"}},
        ],
        [],
    )

    outputs, next_state = _run_runtime(document, state, "jump-1")
    event = next(item for item in _events(next_state) if item["event"] == "channel.runtime.flow_limit_exceeded")

    assert outputs == [{"type": "text", "text": "대화 흐름 실행 한도를 초과했습니다.", "options": []}]
    assert next_state["dialogEnded"] is True
    assert next_state["waitingNodeId"] == ""
    assert next_state["currentNodeId"] == ""
    assert event["level"] == "error"
    assert event["data"]["limit"] == 40


def test_kakao_response_from_serialized_messages_makes_selectable_list_card_items_message_actions() -> None:
    response = _kakao_response_from_serialized_messages(
        [
            {
                "text": "사용자를 선택하세요",
                "payload": {
                    "columns": ["id", "name", "email", "isVIP"],

                    "selectable": True,
                    "rows": [{"id": "1", "name": "김철수", "email": "chulsoo@example.com", "isVIP": "true"}],
                },
            }
        ]
    )

    item = response["template"]["outputs"][0]["listCard"]["items"][0]
    assert item["title"] == "김철수"
    assert item["description"] == "chulsoo@example.com / true"
    assert item["action"] == "message"
    assert item["messageText"] == "1"
