import asyncio
import json
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4
import pytest
import jwt
from fastapi import HTTPException
from sqlalchemy.orm import sessionmaker
from test_channel_connection_state import KEY, state_db
from test_channel_connection_runtime import native_orm_bindings
from test_channel_connection_teams_auth import signed

TENANT = "11111111-1111-4111-8111-111111111111"
CLIENT = "22222222-2222-4222-8222-222222222222"
AUTHORIZATION = "Bearer " + jwt.encode({"aud": CLIENT}, "synthetic-only-test-secret-32-bytes", algorithm="HS256")


def activity(**changes):
    from datetime import datetime, timezone
    value = dict(type="message", channelId="msteams", id="activity-1", timestamp=datetime.now(timezone.utc).isoformat(),
        serviceUrl="https://smba.trafficmanager.net/amer/", channelData={"tenant": {"id": TENANT}},
        conversation={"id": "conversation-sensitive", "conversationType": "personal"},
        recipient={"id": "28:" + CLIENT}, **{"from": {"id": "actor-sensitive", "name": "Sensitive"}},
        text="question")
    return {**value, **changes}


@pytest.fixture
def teams(state_db):
    from app.services.channel_connection_teams import TeamsAdapter
    from app.services.channel_connection_runtime import ConnectionTarget
    from app.services.channel_connections import encrypt_credentials
    db, row = state_db
    row.provider = "ms_teams"; row.installation_id = TENANT; row.account_id = CLIENT
    row.target_id = "conversation-sensitive"
    credentials = dict(tenant_id=TENANT, client_id=CLIENT, client_secret="synthetic-only-secret")
    row.credential_ciphertext = encrypt_credentials(credentials, row.organization_id, row.id, KEY, "v1")
    row.credential_key_version = "v1"; db.commit()
    config = SimpleNamespace(channel_connection_encryption_key=KEY, channel_connection_key_version="v1")
    class Http:
        oauth_calls = []; sends = []
        def oauth(self, tenant, client, secret):
            self.oauth_calls.append((tenant, client, secret))
            return dict(access_token="synthetic-access", token_type="Bearer", expires_in=3600)
        def send(self, *args): self.sends.append(args); return {"id": "synthetic-receipt"}
    class Auth:
        def authenticate(self, authorization, value, client):
            assert authorization == AUTHORIZATION
            return SimpleNamespace(client_id=client, service_url=value["serviceUrl"])
    factory = sessionmaker(db.bind, expire_on_commit=False)
    adapter = TeamsAdapter(factory, owner="teams-worker", config=config, http=Http(), authenticator=Auth())
    return db, row, credentials, ConnectionTarget.from_row(row), adapter


def test_oauth_only_pending_not_connected_and_token_cached(teams):
    from app.services.channel_connection_supervisor import NativeHandshakePending
    db, row, credentials, target, adapter = teams
    async def run():
        for _ in range(2):
            with pytest.raises(NativeHandshakePending): await adapter.verify(target, credentials)
    asyncio.run(run())
    db.refresh(row)
    assert row.observed_state == "connecting" and row.accept_after is not None
    assert len(adapter.http.oauth_calls) == 1


def test_first_activity_waits_then_accepts_same_event_exactly_once(teams):
    from app.services.channel_connection_supervisor import NativeHandshakePending
    from app.services import channel_connection_state as state
    from app.models import ChannelConnectionDelivery, ChannelInstallationLease
    db, row, credentials, target, adapter = teams
    async def run():
        with pytest.raises(NativeHandshakePending): await adapter.verify(target, credentials)
        value = activity()
        receive = asyncio.create_task(adapter.receive(AUTHORIZATION, value))
        await asyncio.sleep(.1)
        identity = await adapter.verify(target, credentials)
        with adapter.sessions() as session:
            lease = session.query(ChannelInstallationLease).one()
            current = session.get(type(row), row.id)
            before = current.accept_after
            state.activate_connection(session, row.id, lease.id, adapter.owner, lease.fence, identity)
            assert current.accept_after == before
            session.commit()
        first = await receive
        second = await adapter.receive(AUTHORIZATION, value)
        assert first == second
    asyncio.run(run())
    db.expire_all()
    item = db.query(ChannelConnectionDelivery).one()
    assert item.status == "received" and item.event_json == {}


def test_wrong_tenant_target_or_recipient_cannot_establish_proof(teams):
    from app.services.channel_connection_supervisor import NativeHandshakePending
    db, row, credentials, target, adapter = teams
    async def run():
        with pytest.raises(NativeHandshakePending): await adapter.verify(target, credentials)
        for changes in [dict(channelData={"tenant": {"id": str(uuid4())}}),
                        dict(recipient={"id": "28:other"}),
                        dict(conversation={"id": "wrong", "conversationType": "personal"})]:
            with pytest.raises(HTTPException):
                await adapter.receive(AUTHORIZATION, activity(**changes))
        with pytest.raises(NativeHandshakePending): await adapter.verify(target, credentials)
    asyncio.run(run())


@pytest.mark.parametrize("change", ["generation", "fence", "owner"])
def test_new_generation_or_fence_rejects_old_proof(teams, change):
    from app.services.channel_connection_supervisor import NativeHandshakePending
    from app.models import ChannelInstallationLease
    from app.services.channel_connection_runtime import ConnectionTarget
    from app.services import channel_connection_state as state
    db, row, credentials, target, adapter = teams
    async def run():
        with pytest.raises(NativeHandshakePending): await adapter.verify(target, credentials)
        adapter._bind_activity(CLIENT, SimpleNamespace(service_url=activity()["serviceUrl"]), activity())
        assert await adapter.verify(target, credentials)
        with adapter.sessions() as session:
            prior_cutoff = state._utc(session.get(type(row), row.id).accept_after)
            lease = session.query(ChannelInstallationLease).one()
            if change == "generation": session.get(type(row), row.id).generation += 1
            else: lease.lease_expires_at = state.clock(session) - timedelta(seconds=1)
            if change == "owner": adapter.owner = "replacement-worker"
            session.commit()
            current = ConnectionTarget.from_row(session.get(type(row), row.id))
        with pytest.raises(NativeHandshakePending): await adapter.verify(current, credentials)
        with adapter.sessions() as session:
            assert state._utc(session.get(type(row), row.id).accept_after) > prior_cutoff
    asyncio.run(run())


def test_invalid_key_prevents_oauth_transport(teams):
    db, row, credentials, target, adapter = teams
    adapter.config.channel_connection_encryption_key = "invalid"
    with pytest.raises(HTTPException): asyncio.run(adapter.verify(target, credentials))
    assert not adapter.http.oauth_calls


def test_first_activity_not_ready_returns_503_not_success_ack(teams):
    from app.services.channel_connection_supervisor import NativeHandshakePending
    from app.models import ChannelConnectionDelivery
    db, row, credentials, target, adapter = teams
    async def run():
        with pytest.raises(NativeHandshakePending): await adapter.verify(target, credentials)
        with pytest.raises(HTTPException) as error:
            await asyncio.wait_for(adapter.receive(AUTHORIZATION, activity()), timeout=9)
        assert error.value.status_code == 503
    asyncio.run(run())
    assert db.query(ChannelConnectionDelivery).count() == 0


def test_supervisor_pending_first_message_native_reply_once_and_second_target(teams, signed):
    from app.services.channel_connection_supervisor import ConnectionSupervisor
    from app.services.channel_connections import encrypt_credentials
    from app.models import (Base, Bot, BotVersion, ChannelConnection, ChannelInstallationLease,
        ChannelConnectionDelivery, ChannelMessage, ChannelQueueEvent, AdminChannel)
    db, row, credentials, target, adapter = teams
    from app.services.channel_connection_teams_auth import TeamsAuthenticator
    adapter.authenticator = TeamsAuthenticator(transport=signed[-2])
    authorization = "Bearer " + signed[-1]({"aud": CLIENT})
    for table in Base.metadata.tables.values(): table.create(db.bind, checkfirst=True)
    db.get(AdminChannel, row.channel_id).code = "TEAMS"
    bot = db.get(Bot, row.bot_id)
    version = BotVersion(bot_id=bot.id, name="v1", version_no=1, status="active", version_json={
        "dialogs": [{"id":"qa", "name":"QA", "utterances":["question"], "response":"fixed Teams answer"}], "graphs":[]})
    db.add(version); db.flush(); bot.active_version_id = version.id
    bot.data_json = {"nlu_type":"ml", "nlu_model":"deep_learning_lite", "answer_mode":"fixed"}
    second = ChannelConnection(organization_id=row.organization_id, channel_id=row.channel_id, bot_id=row.bot_id,
        name="second", provider="ms_teams", installation_id=TENANT, account_id=CLIENT, target_id="second-room",
        desired_state="connected", observed_state="connecting")
    db.add(second); db.flush()
    second.credential_ciphertext = encrypt_credentials(credentials, second.organization_id, second.id, KEY, "v1")
    second.credential_key_version = "v1"; db.commit()
    config = SimpleNamespace(channel_connection_worker_enabled=True, channel_connection_encryption_key=KEY,
        channel_connection_key_version="v1")
    worker = ConnectionSupervisor(adapter.sessions, config=config, adapters={"ms_teams":adapter})
    adapter.owner = worker.owner
    async def run():
        try:
            await worker.tick()
            assert not worker.handles
            incoming = activity()
            receiving = asyncio.create_task(adapter.receive(authorization, incoming))
            await asyncio.sleep(.1)
            await worker.tick()
            await receiving
            await worker.tick()
            await adapter.receive(authorization, incoming)
            await worker.tick()
            assert len(adapter.http.sends) == 1
            second_event = activity(id="second-event", conversation={"id":"second-room", "conversationType":"personal"})
            receiving = asyncio.create_task(adapter.receive(authorization, second_event))
            await asyncio.sleep(.1)
            await worker.tick(); await receiving; await worker.tick()
            assert len(adapter.http.sends) == 2 and len(worker.handles) == 1
        finally: await worker.stop()
    asyncio.run(run())
    db.expire_all()
    assert db.query(ChannelInstallationLease).count() == 1
    assert db.query(ChannelConnectionDelivery).count() == 2
    assert {x.status for x in db.query(ChannelConnectionDelivery)} == {"sent"}
    assert db.query(ChannelQueueEvent).count() == 2
    assert db.query(ChannelMessage).filter_by(participant_kind="bot").count() == 2
    assert "fixed Teams answer" in json.dumps(adapter.http.sends)
