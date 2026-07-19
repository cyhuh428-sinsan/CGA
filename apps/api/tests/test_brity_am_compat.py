from app.api.routes import am
from app.api.routes import channels


def test_brity_chat_contract_accepts_text_and_profile() -> None:
    payload = am.AmChatRequest(
        sessionId="cga-session-1",
        seqNum=3,
        text="안녕하세요",
        userProfile={"userId": "user-1", "userName": "사용자 1", "channel": "CGA"},
    )

    assert payload.text == "안녕하세요"
    assert payload.message is None
    assert payload.seq_num == 3
    assert am._is_manual_request(payload) is True
    assert am._request_participant_id(payload) == "user-1"
    assert am._request_participant_name(payload) == "사용자 1"


def test_brity_session_id_is_preserved_as_external_room_key() -> None:
    payload = am.AmSessionStartRequest(sessionId="cga-session-1", seqNum=1, mode="MANUAL")

    room_request = am._room_create_request(payload, session_id_as_client_room=True)

    assert room_request.client_room_id == "cga-session-1"


def test_brity_response_uses_manual_root_fields() -> None:
    payload = am.AmChatRequest(sessionId="cga-session-1", seqNum=4, text="안녕하세요")

    response = am._manual_response(
        "bot-1",
        payload,
        {
            "activeVersion": {"versionNo": 1},
            "botMessages": [
                {
                    "messageType": "text",
                    "text": "안녕하세요. Aidot입니다.",
                    "payload": {"options": []},
                }
            ],
        },
    )

    assert response["botId"] == "bot-1"
    assert response["sessionId"] == "cga-session-1"
    assert response["seqNum"] == 4
    assert response["responseCode"] == "C20000"
    assert response["version"] == 1
    assert response["templateMessages"][0]["message"] == "안녕하세요. Aidot입니다."


def test_brity_mode_validation_rejects_unknown_mode() -> None:
    payload = am.AmSessionStartRequest(mode="UNKNOWN", seqNum=1)

    try:
        am._validate_manual_mode(payload)
    except Exception as error:
        assert getattr(error, "status_code", None) == 400
    else:
        raise AssertionError("unknown Brity mode must be rejected")


def test_dialog_start_contract_targets_a_dialog_without_user_message() -> None:
    payload = am.AmDialogStartRequest(
        targetUserId="cy25.huh",
        targetChannel="CM_CHAT",
        dialogId="dialog-1",
        dialogParams={"_order_id": "A-100"},
        systemName="Test Server",
    )

    assert payload.message is None
    assert payload.target_user_id == "cy25.huh"
    assert payload.target_channel == "CM_CHAT"
    assert payload.dialog_id == "dialog-1"
    assert payload.dialog_params == {"_order_id": "A-100"}
    assert payload.system_name == "Test Server"


def test_direct_dialog_definition_resolves_graph_id_when_dialog_list_has_no_entry() -> None:
    document = {
        "dialog_flow_graphs": [
            {"id": "graph-1", "dialogId": "dialog-1", "name": "주문 조회", "nodes": []}
        ]
    }

    dialog = channels._direct_dialog_definition(document, "dialog-1")

    assert dialog is not None
    assert dialog["id"] == "dialog-1"
    assert dialog["name"] == "주문 조회"


def test_dialog_start_chat_is_explicitly_deferred_to_queue_worker() -> None:
    payload = am.AmChatRequest(
        sessionId="cy25.huh",
        text="__external_dialog_start__",
        dialogId="dialog-1",
        deferProcessing=True,
    )

    assert payload.defer_processing is True


def test_queued_dialog_start_returns_successful_manual_acknowledgement() -> None:
    payload = am.AmChatRequest(sessionId="cy25.huh", seqNum=7, text="__external_dialog_start__")

    response = am._manual_response(
        "bot-1",
        payload,
        {"queued": True, "queueEvent": {"id": "queue-1", "status": "queued"}},
        description="Queue에 적재되었습니다.",
    )

    assert response["responseCode"] == "C20000"
    assert response["queued"] is True
    assert response["queueEvent"]["id"] == "queue-1"

def test_direct_dialog_root_session_suppresses_default_initial_flow() -> None:
    payload = am.AmSessionStartRequest(
        targetUserId="cy25.huh",
        targetChannel="CM_CHAT",
        suppressInitialMessages=True,
    )

    room_request = am._room_create_request(payload)

    assert room_request.suppress_initial_messages is True
    room_request = channels.ChannelRoomCreateRequest(
        bot_id="bot-1",
        start_immediately=not payload.suppress_initial_messages,
    )
    assert room_request.start_immediately is False


def test_direct_dialog_root_flag_is_available_to_the_queue_worker() -> None:
    payload = channels.ChannelMessageRequest(
        message="__external_dialog_start__",
        target_dialog_id="dialog-1",
        direct_dialog_root=True,
    )

    assert payload.direct_dialog_root is True
