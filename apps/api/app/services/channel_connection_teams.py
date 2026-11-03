"""Teams native HTTP 수신/회신. 모델·대화는 기존 방/전달 작업자가 처리한다."""
from __future__ import annotations
import asyncio,base64,binascii,hashlib,json,time
from dataclasses import dataclass,field
from datetime import datetime,timezone
from urllib.parse import urlencode,quote
from urllib.request import Request,build_opener
from uuid import UUID
import jwt
from fastapi import HTTPException
from sqlalchemy import select
from app.core.config import settings
from app.models import ChannelConnection,ChannelInstallationLease,ChannelConnectionDelivery
from app.services import channel_connection_state as state
from app.services.channel_connections import encrypt_event_context,decrypt_event_context,_cipher
from app.services.channel_connection_supervisor import NativeHandshakePending
from app.services.channel_connection_runtime import ConnectionTarget
from app.services.channel_connection_bridge import convert_packet
from app.services.channel_connection_teams_auth import TeamsAuthenticator,validate_teams_service_url,_NoRedirect


def _uuid(value):
    try:
        if not isinstance(value,str) or str(UUID(value))!=value:raise ValueError()
        return value
    except (ValueError,TypeError):raise HTTPException(422,'TEAMS_CONFIGURATION_INVALID') from None


def _text(value,maximum=512):
    if not isinstance(value,str) or not value or len(value)>maximum:raise HTTPException(422,'TEAMS_ACTIVITY_INVALID')
    return value


def _post(url,headers,body):
    try:
        with build_opener(_NoRedirect()).open(Request(url,data=body,headers=headers,method='POST'),timeout=5) as response:
            raw=response.read(1048577)
            if not 200<=response.status<300 or len(raw)>1048576:raise ValueError()
            value=json.loads(raw)
            if not isinstance(value,dict):raise ValueError()
            return value
    except Exception:raise HTTPException(503,'TEAMS_TRANSPORT_FAILED') from None


class TeamsHttpTransport:
    def __init__(self,*,post=_post):self.post=post
    def oauth(self,tenant,client,secret):
        tenant=_uuid(tenant);client=_uuid(client)
        if not isinstance(secret,str) or not secret or len(secret)>24000:raise HTTPException(422,'TEAMS_CONFIGURATION_INVALID')
        body=urlencode({'grant_type':'client_credentials','client_id':client,'client_secret':secret,'scope':'https://api.botframework.com/.default'}).encode()
        return self.post('https://login.microsoftonline.com/'+tenant+'/oauth2/v2.0/token',{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body)
    def send(self,service,conversation,activity,token,packet):
        service=validate_teams_service_url(service);conversation=_text(conversation,1800);activity=_text(activity)
        if not isinstance(token,str) or not token or len(token)>32768 or any(c.isspace() for c in token):raise HTTPException(503,'TEAMS_ACCESS_TOKEN_INVALID')
        raw=json.dumps(packet,ensure_ascii=False).encode()
        if len(raw)>28000:raise HTTPException(422,'TEAMS_PACKET_LIMIT')
        url=service+'v3/conversations/'+quote(conversation,safe='')+'/activities/'+quote(activity,safe='')
        return self.post(url,{'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json'},raw)



@dataclass(frozen=True)
class TeamsCredentialBinding:
    target: ConnectionTarget
    credentials: tuple = field(repr=False)


class TeamsAdapter:
    def __init__(self, sessions, *, owner, config=settings, http=None, authenticator=None):
        self.sessions, self.owner, self.config = sessions, owner, config
        self.http, self.authenticator = http or TeamsHttpTransport(), authenticator or TeamsAuthenticator()
        self.tokens, self.token_lock = {}, asyncio.Lock()
        self.credential_bindings = {}

    @staticmethod
    def scope(client): return 'teams-app:' + _uuid(client)

    async def _token(self, credentials):
        tenant, client = _uuid(credentials.get('tenant_id')), _uuid(credentials.get('client_id'))
        secret = credentials.get('client_secret')
        key = hashlib.sha256(json.dumps(credentials, sort_keys=True).encode()).hexdigest()
        async with self.token_lock:
            cached = self.tokens.get(key)
            if cached and cached[1] > time.monotonic(): return cached[0]
            value = await asyncio.to_thread(self.http.oauth, tenant, client, secret)
            token, expiry = value.get('access_token'), value.get('expires_in')
            if (not isinstance(token, str) or not token or len(token) > 32768 or any(c.isspace() for c in token)
                or value.get('token_type', '').lower() != 'bearer' or type(expiry) is not int or not 60 < expiry <= 86400):
                raise HTTPException(503, 'TEAMS_ACCESS_TOKEN_INVALID')
            self.tokens[key] = token, time.monotonic() + min(expiry, 3600) - 60
            return token

    def _binding(self, target, lease):
        return {'generation': target.generation, 'owner': self.owner, 'fence': lease.fence,
            'scope': state.scoped_hash(json.dumps([target.installation_id, target.account_id, target.target_id]))}

    def _prepare(self, target):
        with self.sessions() as db:
            row = state._connection(db, target.id, lock=False)
            if row.generation != target.generation: raise HTTPException(409, 'CONNECTION_CHANGED')
            state._target_active(db, row)
            lease = state.claim_installation(db, row, self.owner, ttl_seconds=60,
                listener_scope=self.scope(target.account_id), exclusive=True)
            if lease is None: raise HTTPException(409, 'TEAMS_APP_SCOPE_IN_USE')
            row = state._connection(db, target.id)
            if row.generation != target.generation: raise HTTPException(409, 'CONNECTION_CHANGED')
            state._target_active(db, row)
            cursor = dict(lease.cursor_json or {})
            bindings, proofs = dict(cursor.get('teams_bindings', {})), dict(cursor.get('teams_proofs', {}))
            marker = self._binding(target, lease)
            old = bindings.get(str(row.id))
            if old != marker:
                proofs.pop(str(row.id), None)
                row.accept_after = state.clock(db)
                row.observed_state = 'connecting'
            bindings[str(row.id)] = marker
            cursor.update(teams_bindings=bindings, teams_proofs=proofs)
            lease.cursor_json = cursor
            row.lease_owner, row.lease_expires_at = self.owner, lease.lease_expires_at
            proof = proofs.get(str(row.id))
            value = None
            if isinstance(proof, dict) and proof.get('binding') == marker:
                value = decrypt_event_context(proof['ciphertext'], row.organization_id, row.id,
                    self.config.channel_connection_encryption_key, proof['key_version'])
                if value.get('binding') != marker: raise HTTPException(409, 'TEAMS_PROOF_SCOPE_MISMATCH')
                validate_teams_service_url(value.get('service_url'))
            db.commit()
            return value, marker

    async def verify(self, target, credentials):
        _cipher(self.config.channel_connection_encryption_key)
        if target.provider != 'ms_teams' or (_uuid(credentials.get('tenant_id')), _uuid(credentials.get('client_id'))) != (target.installation_id, target.account_id):
            raise HTTPException(422, 'TEAMS_CONFIGURATION_INVALID')
        await self._token(credentials)
        proof, marker = await asyncio.to_thread(self._prepare, target)
        if proof is None: raise NativeHandshakePending()
        self.credential_bindings[target.id]=TeamsCredentialBinding(target,tuple(sorted(credentials.items())))
        return dict(installation_id=target.installation_id, account_id=target.account_id,
            listener_scope=self.scope(target.account_id), exclusive=True, service_url=proof['service_url'],
            pending_activation={k: marker[k] for k in ('generation', 'owner', 'fence')})

    async def open(self, targets, credentials, identity):
        if not targets or dict(self.credential_binding(targets[0]).credentials)!=credentials:raise HTTPException(409,'CONNECTION_CHANGED')
        return TeamsListener(self, targets)

    def credential_binding(self,target):
        binding=self.credential_bindings.get(target.id)
        if binding is None or binding.target!=target:raise HTTPException(409,'CONNECTION_CHANGED')
        return binding

    def _client_candidate(self, client):
        with self.sessions() as db:
            return db.scalar(select(ChannelConnection.id).where(ChannelConnection.provider == 'ms_teams',
                ChannelConnection.account_id == client, ChannelConnection.desired_state == 'connected',
                ChannelConnection.deleted_at.is_(None)).limit(1))

    def _bind_activity(self, client, verified, activity):
        data = activity.get('channelData')
        if not isinstance(data, dict) or not isinstance(data.get('tenant'), dict): raise HTTPException(422, 'TEAMS_ACTIVITY_INVALID')
        tenant = _uuid(data['tenant'].get('id'))
        conversation, recipient, sender = activity.get('conversation'), activity.get('recipient'), activity.get('from')
        if not all(isinstance(v, dict) for v in (conversation, recipient, sender)): raise HTTPException(422, 'TEAMS_ACTIVITY_INVALID')
        room, recipient_id, sender_id = _text(conversation.get('id'), 1800), _text(recipient.get('id')), _text(sender.get('id'))
        if recipient_id != '28:' + client: raise HTTPException(403, 'TEAMS_RECIPIENT_FORBIDDEN')
        channel = data.get('channel', {})
        if not isinstance(channel, dict): raise HTTPException(422, 'TEAMS_ACTIVITY_INVALID')
        target_id = _text(channel.get('id') or room, 200)
        with self.sessions() as db:
            # Lease first, then connection: same order as common runtime fencing.
            scope_hash = state._digest(['ms_teams', 'verified-listener', self.scope(client)])
            leases = db.scalars(select(ChannelInstallationLease).where(
                ChannelInstallationLease.provider == 'ms_teams',
                ChannelInstallationLease.listener_scope_hash == scope_hash,
                ChannelInstallationLease.owner == self.owner,
                ChannelInstallationLease.lease_expires_at > state.clock(db)).with_for_update()).all()
            if len(leases) != 1: raise HTTPException(503, 'TEAMS_RECEIVER_NOT_READY')
            lease = leases[0]
            candidates = db.scalars(select(ChannelConnection).where(ChannelConnection.provider == 'ms_teams',
                ChannelConnection.organization_id == lease.organization_id, ChannelConnection.account_id == client,
                ChannelConnection.installation_id == tenant, ChannelConnection.target_id == target_id,
                ChannelConnection.desired_state == 'connected', ChannelConnection.deleted_at.is_(None))
                .with_for_update()).all()
            cursor = dict(lease.cursor_json or {})
            candidates = [r for r in candidates if cursor.get('teams_bindings', {}).get(str(r.id)) == self._binding(ConnectionTarget.from_row(r), lease)]
            if len(candidates) != 1: raise HTTPException(403, 'TEAMS_TARGET_FORBIDDEN')
            row = candidates[0]; state._target_active(db, row)
            marker = self._binding(ConnectionTarget.from_row(row), lease)
            proof = dict(tenant=tenant, client=client, target=target_id, service_url=verified.service_url, binding=marker)
            self._event(activity, proof, room, sender_id, recipient_id)
            proofs = dict(cursor.get('teams_proofs', {}))
            proofs[str(row.id)] = dict(binding=marker, ciphertext=encrypt_event_context(proof, row.organization_id,
                row.id, self.config.channel_connection_encryption_key, self.config.channel_connection_key_version),
                key_version=self.config.channel_connection_key_version)
            cursor['teams_proofs'] = proofs; lease.cursor_json = cursor
            row.last_checked_at = state.clock(db)
            result = (row.id, row.generation, lease.id, lease.fence)
            db.commit()
            return result, proof, room, sender_id, recipient_id

    @staticmethod
    def _event(activity,proof,conversation_id,sender_id,recipient_id):
        try:
            stamp=datetime.fromisoformat(_text(activity.get('timestamp'),100))
            if stamp.tzinfo is None:raise ValueError()
        except (ValueError,TypeError):raise HTTPException(422,'TEAMS_ACTIVITY_TIME_INVALID') from None
        event_id=_text(activity.get('id'));conversation=activity['conversation'];kind='bot' if activity['from'].get('role')=='bot' or sender_id.startswith('28:') else 'user'
        mode=conversation.get('conversationType')
        if mode not in {'personal','groupChat','channel'}:raise HTTPException(422,'TEAMS_CONVERSATION_TYPE_INVALID')
        text=activity.get('text') or '';addressed=mode=='personal'
        if not isinstance(text,str):raise HTTPException(422,'TEAMS_ACTIVITY_INVALID')
        entities=activity.get('entities') or []
        if not isinstance(entities,list):raise HTTPException(422,'TEAMS_ACTIVITY_INVALID')
        for entity in entities:
            if isinstance(entity,dict) and entity.get('type')=='mention' and isinstance(entity.get('mentioned'),dict) and entity['mentioned'].get('id')==recipient_id:
                mention=entity.get('text')
                if isinstance(mention,str) and mention and mention in text:addressed=True;text=text.replace(mention,'')
        if isinstance(activity.get('value'),dict):
            wire=activity['value']
            if wire.get('webchatRichFormVersion')!='1.0' or not wire.get('sourceMessageId') or not wire.get('sourceTalkNodeId'):raise HTTPException(422,'TEAMS_CARD_RESPONSE_INVALID')
            response=wire.get('response')
            if not isinstance(response,dict):raise HTTPException(422,'TEAMS_CARD_RESPONSE_INVALID')
            response=dict(response)
            for key,value in wire.items():
                if key not in {'webchatRichFormVersion','sourceMessageId','sourceTalkNodeId','response','__cga_buttonValue'}:response[key]=value
            for key,value in wire.items():
                if key.startswith('__cga_input_'):
                    try:
                        encoded=key[len('__cga_input_'):];original=base64.b64decode(encoded+'='*(-len(encoded)%4),altchars=b'-_',validate=True).decode('utf-8')
                        if not original or base64.urlsafe_b64encode(original.encode()).decode().rstrip('=')!=encoded:raise ValueError()
                    except (ValueError,UnicodeError,binascii.Error):raise HTTPException(422,'TEAMS_CARD_RESPONSE_INVALID') from None
                    response.pop(key,None);response[original]=value
            if '__cga_buttonValue' in wire:response['buttonValue']=wire['__cga_buttonValue']
            standard={key:wire[key] for key in ('webchatRichFormVersion','sourceMessageId','sourceTalkNodeId')};standard['response']=response
            text=json.dumps(standard,ensure_ascii=False,sort_keys=True);addressed=True
        text=text.strip();tenant=proof['tenant']
        event={'eventId':'teams:'+state.scoped_hash(json.dumps([conversation_id,event_id])),'nativeRoomKey':'teams:'+state.scoped_hash(json.dumps([tenant,conversation_id])),
            'nativeParticipantKey':'teams:'+kind+':'+state.scoped_hash(json.dumps([tenant,sender_id])),'participantKind':kind,'participantName':str(activity['from'].get('name') or sender_id)[:120],
            'roomMode':'private' if mode=='personal' else 'shared','addressed':addressed,'message':text,'occurredAt':stamp.astimezone(timezone.utc).isoformat()}
        state._event(event);return event


    def _accept(self, binding, event):
        cid, generation, lease_id, fence = binding
        with self.sessions() as db:
            lease = state._installation(db, lease_id, self.owner, fence)
            row = state._connection(db, cid)
            if row.generation != generation: raise HTTPException(409, 'CONNECTION_CHANGED')
            state._target_active(db, row)
            event=dict(event)
            try:selection=json.loads(event['message'])
            except (ValueError,TypeError):selection=None
            if isinstance(selection,dict) and selection.get('webchatRichFormVersion')=='1.0':
                event['message']=self._selection(db,row,event,selection)
            if row.observed_state != 'connected': return None
            item = state.accept_delivery(db, cid, lease_id, self.owner, fence, event,
                key=self.config.channel_connection_encryption_key, version=self.config.channel_connection_key_version)
            result = {'delivery_id': str(item.id)}
            db.commit()
            return result

    def _selection(self,db,row,event,selection):
        from app.models import ChannelConnectionRoom,ChannelRoom,ChannelMessage,Bot
        try:identifier=UUID(selection.get('sourceMessageId'))
        except (ValueError,TypeError,AttributeError):raise HTTPException(422,'TEAMS_CARD_RESPONSE_INVALID') from None
        scope=[row.provider,row.installation_id,row.account_id,row.target_id,event['nativeRoomKey']]
        source=db.scalar(select(ChannelMessage).join(ChannelRoom,ChannelRoom.id==ChannelMessage.room_id)
            .join(Bot,Bot.id==ChannelRoom.bot_id).join(ChannelConnectionRoom,ChannelConnectionRoom.room_id==ChannelRoom.id)
            .where(ChannelConnectionRoom.connection_id==row.id,ChannelConnectionRoom.native_room_hash==state._digest(scope),
                ChannelMessage.id==identifier,ChannelMessage.participant_kind=='bot',ChannelMessage.channel_type=='ms-teams',
                ChannelMessage.deleted_at.is_(None),ChannelRoom.deleted_at.is_(None),ChannelRoom.bot_id==row.bot_id,
                Bot.organization_id==row.organization_id,Bot.deleted_at.is_(None)))
        if (source is None or row.accept_after is not None and state._utc(source.created_at)<state._utc(row.accept_after)
            or selection.get('sourceTalkNodeId')!=(source.payload_json or {}).get('sourceTalkNodeId')):
            raise HTTPException(403,'TEAMS_CARD_RESPONSE_INVALID')
        packets=convert_packet('ms_teams','replies',{'messages':[dict(id=str(source.id),participantKind='bot',
            messageType=source.message_type,text=source.text,payload=source.payload_json)],'destination':{}})
        inputs={};actions=[]
        def visit(value):
            if isinstance(value,list):
                for child in value:visit(child)
            elif isinstance(value,dict):
                kind=value.get('type','')
                if kind.startswith('Input.') and isinstance(value.get('id'),str):
                    field=value['id']
                    if field=='__cga_buttonValue':field='buttonValue'
                    elif field.startswith('__cga_input_'):
                        encoded=field[len('__cga_input_'):];field=base64.urlsafe_b64decode(encoded+'='*(-len(encoded)%4)).decode()
                    inputs[field]=value
                if kind in {'Action.Submit','Action.Execute'}:actions.append(value.get('data',{}).get('response',{}))
                for child in value.values():visit(child)
        visit(packets)
        response=selection.get('response')
        if not isinstance(response,dict):raise HTTPException(422,'TEAMS_CARD_RESPONSE_INVALID')
        for field,control in inputs.items():
            if field not in response:continue
            value=response[field]
            if control['type']=='Input.ChoiceSet':
                values=value.split(',') if control.get('isMultiSelect') and isinstance(value,str) else [value]
                if any(v not in [c.get('value') for c in control.get('choices',[])] for v in values):raise HTTPException(403,'TEAMS_CARD_RESPONSE_INVALID')
            elif control['type']=='Input.Toggle':
                if value not in [control.get('valueOn','true'),control.get('valueOff','false')]:raise HTTPException(403,'TEAMS_CARD_RESPONSE_INVALID')
            elif not isinstance(value,(str,int,float)) or isinstance(value,bool):raise HTTPException(403,'TEAMS_CARD_RESPONSE_INVALID')
        for fixed in actions:
            if not isinstance(fixed,dict):continue
            expected={**fixed,**{key:value for key,value in response.items() if key in inputs}}
            if response==expected:
                return json.dumps(dict(webchatRichFormVersion='1.0',sourceMessageId=str(source.id),
                    sourceTalkNodeId=source.payload_json['sourceTalkNodeId'],response=response),ensure_ascii=False,sort_keys=True)
        raise HTTPException(403,'TEAMS_CARD_RESPONSE_INVALID')

    async def receive(self, authorization, activity):
        try:
            parts = authorization.split(' ')
            if len(parts) != 2 or parts[0].lower() != 'bearer' or len(authorization) > 20000: raise ValueError()
            client = _uuid(jwt.decode(parts[1], options={'verify_signature': False})['aud'])
        except (jwt.PyJWTError, ValueError, TypeError, KeyError, HTTPException):
            raise HTTPException(401, 'TEAMS_AUTHENTICATION_FAILED') from None
        if not await asyncio.to_thread(self._client_candidate, client): raise HTTPException(401, 'TEAMS_AUTHENTICATION_FAILED')
        verified = await asyncio.to_thread(self.authenticator.authenticate, authorization, activity, client)
        if activity.get('type') == 'invoke' and activity.get('name') == 'adaptiveCard/action':
            value = activity.get('value')
            if not isinstance(value, dict): raise HTTPException(422, 'TEAMS_CARD_RESPONSE_INVALID')
            if value.get('trigger') == 'automatic': return {'ignored': True}
            action = value.get('action')
            if value.get('trigger') not in {None, 'manual'} or not isinstance(action, dict) or action.get('type') != 'Action.Execute' or not isinstance(action.get('data'), dict):
                raise HTTPException(422, 'TEAMS_CARD_RESPONSE_INVALID')
            activity = {**activity, 'type': 'message', 'value': action['data']}
        if activity.get('type') != 'message': return {'ignored': True}
        binding, proof, room, sender, recipient = await asyncio.to_thread(self._bind_activity, client, verified, activity)
        event = self._event(activity, proof, room, sender, recipient)
        event['destination'] = dict(tenant=proof['tenant'], client=client, target=proof['target'],
            generation=binding[1], service_url=verified.service_url, conversation_id=room,
            activity_id=activity['id'], sender_id=sender, recipient_id=recipient)
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            result = await asyncio.to_thread(self._accept, binding, event)
            if result is not None: return result
            await asyncio.sleep(.05)
        raise HTTPException(503, 'TEAMS_RECEIVER_NOT_READY')


class TeamsListener:
    """수신 route는 원장에 commit하고 공통 runtime이 송신 fencing을 단독 소유한다."""
    def __init__(self, adapter, targets):
        self.adapter = adapter
        self.scope=(targets[0].installation_id,targets[0].account_id)
        self.bindings=self._bindings(targets)
        self.targets = {t.id: t for t in targets}
        self.stopped = asyncio.Event()

    def _bindings(self,targets):
        bindings={}
        for target in targets:
            if (target.installation_id,target.account_id)!=self.scope:raise HTTPException(403,'TEAMS_PROOF_SCOPE_MISMATCH')
            bindings[target.id]=self.adapter.credential_binding(target)
        return bindings

    async def listen(self, receive): await self.stopped.wait()
    async def update(self, targets):
        bindings=self._bindings(targets)
        self.targets = {t.id: t for t in targets};self.bindings=bindings
    async def close(self): self.stopped.set()

    async def send(self, target, packets, event):
        context = event.get('destination', {})
        if self.stopped.is_set() or self.targets.get(target.id) != target: raise HTTPException(409, 'CONNECTION_CHANGED')
        binding=self.adapter.credential_binding(target)
        if self.bindings.get(target.id)!=binding:raise HTTPException(409,'CONNECTION_CHANGED')
        if (context.get('tenant'), context.get('client'), context.get('target'), context.get('generation')) != (
            target.installation_id, target.account_id, target.target_id, target.generation):
            raise HTTPException(409, 'TEAMS_PROOF_SCOPE_MISMATCH')
        service = validate_teams_service_url(context.get('service_url'))
        if not isinstance(packets, list) or len(packets) > 20: raise HTTPException(422, 'TEAMS_PACKET_LIMIT')
        prepared = []
        for message in packets:
            packet = {**message, 'from': {'id': context['recipient_id']}, 'recipient': {'id': context['sender_id']},
                'conversation': {'id': context['conversation_id']}, 'replyToId': context['activity_id']}
            if len(json.dumps(packet, ensure_ascii=False).encode()) > 28000: raise HTTPException(422, 'TEAMS_PACKET_LIMIT')
            prepared.append(packet)
        token = await self.adapter._token(dict(binding.credentials))
        ids = []
        for packet in prepared:
            if (self.stopped.is_set() or self.targets.get(target.id) != target
                or self.bindings.get(target.id)!=binding or self.adapter.credential_binding(target)!=binding):raise HTTPException(409,'CONNECTION_CHANGED')
            result = await asyncio.to_thread(self.adapter.http.send, service, context['conversation_id'],
                context['activity_id'], token, packet)
            ids.append(_text(result.get('id')))
        return ids
