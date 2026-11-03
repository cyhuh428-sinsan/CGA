"""Node CLI의 실제 packet 변환 계약 (외부 호출 없음)."""
import json
from pathlib import Path
import subprocess

import pytest

ROOT = Path(__file__).resolve().parents[3]
BRIDGE = ROOT / 'packages/shared/src/channel-bridge.mjs'


def run_packet(value):
    result = subprocess.run(['node', str(BRIDGE)], input=json.dumps(value), text=True, encoding='utf-8', capture_output=True, cwd=ROOT, timeout=15)
    assert result.stdout, result.stderr
    return result.returncode, json.loads(result.stdout)


@pytest.mark.parametrize('provider,destination,field', [
    ('ms_teams', {}, 'text'), ('slack', {'channelId': 'C123'}, 'text'),
    ('discord', {'channelId': '123456789012345678'}, 'content'),
    ('telegram', {'chatId': '123'}, 'parameters'),
    ('google_chat', {'spaceName': 'spaces/AAA'}, 'body'), ('line', {}, 'text'),
])
def test_text_replies(provider, destination, field):
    code, result = run_packet({'provider': provider, 'operation': 'replies', 'payload': {'messages': [{'text': '안녕'}], 'destination': destination}})
    assert code == 0
    packet = result['value'][0]
    assert (packet[field]['text'] if field in ('parameters', 'body') else packet[field]) == '안녕'


def test_teams_options_preserve_selection_provenance():
    _, result = run_packet({'provider': 'TEAMS', 'operation': 'replies', 'payload': {'messages': [{'id': 'msg', 'text': '선택', 'messageType': 'button', 'payload': {'sourceTalkNodeId': 'node', 'options': ['예']}}]}})
    action = result['value'][0]['attachments'][0]['content']['actions'][0]
    assert action['data'] == {'webchatRichFormVersion': '1.0', 'sourceMessageId': 'msg', 'sourceTalkNodeId': 'node', 'response': {'buttonValue': '예'}}


@pytest.mark.parametrize('message_type', ['form-a-card', 'unsupported'])
def test_unsupported_expression_falls_back_to_text(message_type):
    code, result = run_packet({'provider': 'slack', 'operation': 'replies', 'payload': {'messages': [{'text': '대체 본문', 'messageType': message_type}], 'destination': {'channelId': 'C123'}}})
    assert code == 0
    assert result['value'][0]['text'] == '대체 본문'


@pytest.mark.parametrize('value', [None, {}, {'provider': 'unknown', 'operation': 'replies', 'payload': {}}, {'provider': 'line', 'operation': 'replies', 'payload': {'messages': [None]}}])
def test_malformed_input_is_safe(value):
    code, result = run_packet(value)
    assert code == 1
    assert result == {'ok': False, 'code': 'CHANNEL_PACKET_INVALID'}


def test_slack_normalization_preserves_event_scope_and_strips_bot_mention():
    code, result = run_packet({'provider': 'SLACK', 'operation': 'normalize', 'payload': {
        'connection': {'teamId': 'T123', 'botUserId': 'U123', 'botId': 'B123'},
        'input': {'team_id': 'T123', 'type': 'event_callback', 'event': {'type': 'message', 'user': 'U456', 'channel': 'C123', 'ts': '12.34', 'text': '<@U123> 질문'}},
    }})
    assert code == 0
    event = result['value']
    assert event['message'] == '질문'
    assert event['addressed'] is True
    assert event['eventId'] == 'slack-message:12.34'
    assert event['nativeRoomKey'] == 'slack:["T123","C123",null]'


def test_selection_with_wrong_source_is_rejected():
    code, result = run_packet({'provider': 'discord', 'operation': 'selection', 'payload': {
        'source': {'id': 'first', 'participantKind': 'bot', 'payload': {'sourceTalkNodeId': 'node'}},
        'event': {'sourceMessageId': 'different', 'choiceIndex': 0},
    }})
    assert code == 1
    assert result['code'] == 'CHANNEL_PACKET_INVALID'


def test_python_can_consume_authoritative_mapping_without_alias_replacement():
    code, result = run_packet({'operation': 'mapping'})
    assert code == 0
    assert len(result['value']) == 8
    assert result['value'][2] == {'admin': 'TEAMS', 'provider': 'ms_teams', 'runtime': 'ms-teams', 'bridge': 'ms-teams'}
    assert result['value'][6] == {'admin': 'GOOGLE_CHAT', 'provider': 'google_chat', 'runtime': 'google-chat', 'bridge': 'google-chat'}


def test_python_bridge_conversion_and_missing_binary_fail_closed(monkeypatch):
    from app.services.channel_connection_bridge import convert_packet
    from app.core.config import settings
    from fastapi import HTTPException
    assert convert_packet("slack", "replies", {"messages": [{"text": "answer"}], "destination": {"channelId": "C123"}})[0]["text"] == "answer"
    monkeypatch.setattr(settings, "channel_connection_node_binary", "missing-node-task5")
    with pytest.raises(HTTPException) as error:
        convert_packet("slack", "replies", {"messages": [{"text": "answer"}], "destination": {"channelId": "C123"}})
    assert error.value.detail == "CHANNEL_PACKET_RUNTIME_UNAVAILABLE"
