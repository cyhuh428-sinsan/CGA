"""Teams packet·회신 경계. HTTP만 double이고 Node 변환기는 실제 실행한다."""
import asyncio
import json
import pytest
from fastapi import HTTPException
from test_channel_connection_teams_adapter import teams, TENANT, CLIENT
from test_channel_connection_state import state_db


async def verified_open(teams):
    from app.services.channel_connection_supervisor import NativeHandshakePending
    from test_channel_connection_teams_adapter import activity
    from types import SimpleNamespace
    db,row,credentials,target,adapter=teams
    with pytest.raises(NativeHandshakePending):await adapter.verify(target,credentials)
    adapter._bind_activity(CLIENT,SimpleNamespace(service_url=activity()['serviceUrl']),activity())
    identity=await adapter.verify(target,credentials)
    adapter.http.oauth_calls.clear()
    return await adapter.open([target],credentials,identity)


def context(target):
    return {"destination": dict(tenant=TENANT, client=CLIENT, target=target.target_id,
        generation=target.generation, service_url="https://smba.trafficmanager.net/amer/",
        conversation_id="conversation-sensitive", activity_id="a/1", sender_id="actor-sensitive", recipient_id="28:"+CLIENT)}


def test_node_packet_and_listener_send_targeted_reply(teams):
    from app.services.channel_connection_bridge import convert_packet
    db, row, credentials, target, adapter = teams
    event = context(target)
    packets = convert_packet("ms_teams", "replies", {"messages": [{"text": "답변", "payload": {}}], "destination": event["destination"]})
    assert packets and packets[0]["type"] == "message"
    async def run():
        listener = await verified_open(teams)
        adapter.sessions = lambda: pytest.fail("adapter send reentered common runtime DB lock")
        assert await listener.send(target, packets, event) == ["synthetic-receipt"]
        await listener.close()
        with pytest.raises(HTTPException): await listener.send(target, packets, event)
    asyncio.run(run())
    args = adapter.http.sends[0]
    assert args[:4] == ("https://smba.trafficmanager.net/amer/", "conversation-sensitive", "a/1", "synthetic-access")
    assert args[4]["recipient"] == {"id": "actor-sensitive"} and args[4]["replyToId"] == "a/1"


@pytest.mark.parametrize("changed", [dict(generation=999), dict(tenant="other"), dict(client="other"),
    dict(target="other"), dict(service_url="https://127.0.0.1/")])
def test_reply_scope_mismatch_never_submits_http(teams, changed):
    db, row, credentials, target, adapter = teams
    event = context(target); event["destination"].update(changed)
    async def run():
        listener = await verified_open(teams)
        with pytest.raises(HTTPException): await listener.send(target, [{"type": "message", "text": "hi"}], event)
    asyncio.run(run())
    assert not adapter.http.sends and not adapter.http.oauth_calls


def test_http_transport_fixed_oauth_and_encoded_reply_path():
    from app.services.channel_connection_teams import TeamsHttpTransport
    calls = []
    def post(url, headers, body): calls.append((url, headers, body)); return {"id": "receipt"}
    http = TeamsHttpTransport(post=post)
    http.oauth(TENANT, CLIENT, "synthetic-only-secret")
    http.send("https://smba.trafficmanager.net/amer/", "a/b", "x/y", "synthetic-access", {"type": "message"})
    assert calls[0][0] == "https://login.microsoftonline.com/"+TENANT+"/oauth2/v2.0/token"
    assert b"scope=https%3A%2F%2Fapi.botframework.com%2F.default" in calls[0][2]
    assert calls[1][0] == "https://smba.trafficmanager.net/amer/v3/conversations/a%2Fb/activities/x%2Fy"


def test_shared_unaddressed_and_mention_and_adaptive_card_events():
    from app.services.channel_connection_teams import TeamsAdapter
    from test_channel_connection_teams_adapter import activity
    value = activity(conversation={"id":"group", "conversationType":"groupChat"})
    proof = {"tenant": TENANT}
    def parse(value): return TeamsAdapter._event(value, proof, "group", "actor", "28:"+CLIENT)
    assert parse(value)["addressed"] is False
    mentioned = {**value, "text":"<at>bot</at> 질문", "entities":[{"type":"mention", "text":"<at>bot</at>", "mentioned":{"id":"28:"+CLIENT}}]}
    result = parse(mentioned)
    assert result["addressed"] is True and result["message"] == "질문"
    card = {**value, "value": {"webchatRichFormVersion":"1.0", "sourceMessageId":"message", "sourceTalkNodeId":"node", "response": {"answer":"a"}}}
    result = parse(card)
    assert result["addressed"] is True and json.loads(result["message"])["response"] == {"answer":"a"}
