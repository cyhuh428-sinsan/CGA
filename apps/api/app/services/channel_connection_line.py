"""LINE 원문 서명·고정 API·대상 신원. 기존 CGA 런타임을 사용한다."""
from __future__ import annotations
import asyncio,json,re,time
from dataclasses import dataclass,field
from threading import Semaphore
from types import MappingProxyType
from datetime import datetime,timezone
from urllib.request import Request,build_opener
from urllib.error import HTTPError
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import object_session
from uuid import UUID
from app.models import (ChannelConnection,ChannelInstallationLease,ChannelConnectionDelivery,
    ChannelConnectionRoom,ChannelMessage,ChannelRoom,Bot)
from app.services import channel_connection_state as state
from app.services.channel_connections import encrypt_event_context,decrypt_event_context,decrypt_credentials,_cipher
from app.services.channel_connection_runtime import ConnectionTarget
from app.services.channel_connection_bridge import convert_packet
from app.services.channel_connection_line_auth import verify_line_signature
from app.core.config import settings
from app.services.channel_connection_google_chat_auth import _NoRedirect

ROOT='https://api.line.me/v2/bot/'


def source_type(value):
    if not isinstance(value,str) or not re.fullmatch('[UCR][a-f0-9]{32}',value):raise HTTPException(422,'LINE_SOURCE_INVALID')
    return {'U':'user','C':'group','R':'room'}[value[0]]


def credentials(value):
    token=value.get('access_token');secret=value.get('channel_secret')
    if not isinstance(token,str) or not token or len(token)>8192 or any(c.isspace() for c in token) or not isinstance(secret,str) or not secret.strip() or len(secret)>4096:raise HTTPException(422,'LINE_CREDENTIALS_INVALID')
    return token,secret


class LineApiRejected(Exception):pass


def _request(method,url,body,token):
    try:
        headers={'Accept':'application/json','Authorization':'Bearer '+token}
        if body is not None:headers['Content-Type']='application/json'
        try:response=build_opener(_NoRedirect()).open(Request(url,data=body,headers=headers,method=method),timeout=5)
        except HTTPError as error:response=error
        with response:
            raw=response.read(1048577)
            if len(raw)>1048576:raise ValueError()
            if response.status in {400,401,403,404,409,429}:raise LineApiRejected()
            if not 200<=response.status<300:raise ValueError()
            value=json.loads(raw)
            if not isinstance(value,dict):raise ValueError()
            return value
    except LineApiRejected:raise
    except Exception:raise HTTPException(503,'LINE_TRANSPORT_FAILED') from None


def reply_body(body):
    try:
        if not isinstance(body,dict) or set(body)!={'replyToken','messages'} or not isinstance(body['replyToken'],str) or not 0<len(body['replyToken'])<=1024 or not isinstance(body['messages'],list) or not 1<=len(body['messages'])<=5:raise ValueError()
        data=json.dumps(body,ensure_ascii=False).encode()
        if len(data)>262144 or any(not isinstance(p,dict) or not isinstance(p.get('type'),str) for p in body['messages']):raise ValueError()
        return data
    except (ValueError,TypeError):raise HTTPException(422,'LINE_REPLY_INVALID') from None


class LineHttpTransport:
    def __init__(self,*,request=_request):self.request=request
    def bot_info(self,token):return self.request('GET',ROOT+'info',None,token)
    def reply(self,token,body):return self.request('POST',ROOT+'message/reply',reply_body(body),token)


@dataclass(frozen=True)
class LineBinding:
    target:object
    credentials:dict=field(repr=False)
    source_type:str


class LineAdapter:
    def __init__(self,sessions,*,owner,config=settings,http=None):
        self.sessions,self.owner,self.config=sessions,owner,config
        self.http=http or LineHttpTransport();self.bindings={}

    @staticmethod
    def scope(bot):
        if source_type(bot)!='user':raise HTTPException(422,'LINE_BOT_INVALID')
        return 'line-bot:'+bot

    async def verify(self,target,value):
        _cipher(self.config.channel_connection_encryption_key)
        token,_=credentials(value);scope=self.scope(target.account_id);kind=source_type(target.target_id)
        if target.provider!='line' or target.installation_id!=target.account_id:raise HTTPException(422,'LINE_CONFIGURATION_INVALID')
        try:
            info=await asyncio.to_thread(self.http.bot_info,token)
            if info.get('userId')!=target.account_id:raise ValueError()
        except (LineApiRejected,ValueError,TypeError,AttributeError):raise HTTPException(403,'LINE_BOT_VERIFICATION_FAILED') from None
        ready,marker=await asyncio.to_thread(self._prepare,target,kind,value)
        if not ready:
            from app.services.channel_connection_supervisor import NativeHandshakePending
            raise NativeHandshakePending()
        self.bindings[target.id]=LineBinding(target,MappingProxyType(dict(value)),kind)
        return dict(installation_id=target.installation_id,account_id=target.account_id,listener_scope=scope,
            exclusive=True,source_type=kind,pending_activation={k:marker[k] for k in ('generation','owner','fence')})

    def _binding(self,target,lease):
        return dict(generation=target.generation,owner=self.owner,fence=lease.fence,
            scope=state._digest([str(target.organization_id),str(target.id),str(target.bot_id),target.installation_id,target.account_id,target.target_id]))

    def _seal(self,row,purpose,value):
        version=self.config.channel_connection_key_version
        return dict(ciphertext=encrypt_event_context(value,row.organization_id,row.id,
            self.config.channel_connection_encryption_key,version+':line:'+purpose),key_version=version)

    def _unseal(self,row,purpose,saved):
        return decrypt_event_context(saved['ciphertext'],row.organization_id,row.id,
            self.config.channel_connection_encryption_key,saved['key_version']+':line:'+purpose)

    def _credentials(self,row):
        return decrypt_credentials(row.credential_ciphertext,row.organization_id,row.id,
            self.config.channel_connection_encryption_key,row.credential_key_version)

    def _prepare(self,target,kind,value):
        _cipher(self.config.channel_connection_encryption_key)
        with self.sessions() as db:
            row=state._connection(db,target.id,lock=False)
            if ConnectionTarget.from_row(row)!=target or self._credentials(row)!=value:raise HTTPException(409,'CONNECTION_CHANGED')
            state._target_active(db,row)
            lease=state.claim_installation(db,row,self.owner,ttl_seconds=60,listener_scope=self.scope(target.account_id),exclusive=True)
            if lease is None:raise HTTPException(409,'LINE_APP_SCOPE_IN_USE')
            other=db.scalar(select(ChannelInstallationLease.id).where(ChannelInstallationLease.provider=='line',
                ChannelInstallationLease.listener_scope_hash==lease.listener_scope_hash,
                ChannelInstallationLease.organization_id!=row.organization_id,ChannelInstallationLease.owner.is_not(None),
                ChannelInstallationLease.lease_expires_at>state.clock(db)))
            if other is not None:raise HTTPException(409,'LINE_APP_SCOPE_IN_USE')
            row=state._connection(db,target.id)
            if ConnectionTarget.from_row(row)!=target or self._credentials(row)!=value:raise HTTPException(409,'CONNECTION_CHANGED')
            state._target_active(db,row);cursor=dict(lease.cursor_json or {})
            markers=dict(cursor.get('line_bindings',{}));proofs=dict(cursor.get('line_proofs',{}));prepared=dict(cursor.get('line_prepared',{}))
            marker=self._binding(target,lease);old=markers.get(str(row.id))
            saved=prepared.get(str(row.id));credential_hash=state._digest(value)
            changed=old!=marker or saved is not None and self._unseal(row,'binding',saved).get('credential_hash')!=credential_hash
            if changed:
                proofs.pop(str(row.id),None)
                if old is not None or row.accept_after is None:row.accept_after=state.clock(db)
                row.observed_state='connecting'
            elif row.observed_state!='connected':row.observed_state='connecting'
            markers[str(row.id)]=marker;prepared[str(row.id)]=self._seal(row,'binding',dict(binding=marker,credential_hash=credential_hash))
            cursor.update(line_bindings=markers,line_proofs=proofs,line_prepared=prepared);lease.cursor_json=cursor
            row.lease_owner,row.lease_expires_at=self.owner,lease.lease_expires_at
            saved=proofs.get(str(row.id));ready=False
            if isinstance(saved,dict):
                if self._unseal(row,'handshake',saved)!=dict(binding=marker):raise HTTPException(409,'LINE_PROOF_SCOPE_MISMATCH')
                ready=True
            db.commit();return ready,marker

    async def open(self,targets,credentials,identity):return LineListener(self,targets)

    def _candidates(self):
        with self.sessions() as db:
            leases=db.scalars(select(ChannelInstallationLease).where(ChannelInstallationLease.provider=='line',
                ChannelInstallationLease.owner==self.owner,ChannelInstallationLease.lease_expires_at>state.clock(db))).all()
            result=[]
            for lease in leases:
                cursor=lease.cursor_json or {}
                for cid,saved in cursor.get('line_prepared',{}).items():
                    try:row=db.get(ChannelConnection,UUID(cid))
                    except (ValueError,TypeError):continue
                    if row is None or row.deleted_at is not None or row.desired_state!='connected' or row.organization_id!=lease.organization_id or row.provider!='line' or row.installation_id!=row.account_id:continue
                    try:state._target_active(db,row)
                    except HTTPException as error:
                        if error.detail=='CONNECTION_TARGET_INACTIVE':continue
                        raise
                    target=ConnectionTarget.from_row(row);marker=self._binding(target,lease)
                    if cursor.get('line_bindings',{}).get(cid)!=marker or lease.listener_scope_hash!=state._listener_scope(row,self.scope(row.account_id)):continue
                    value=self._credentials(row);proof=self._unseal(row,'binding',saved)
                    if proof!=dict(binding=marker,credential_hash=state._digest(value)):continue
                    result.append((target,lease.id,lease.fence,marker,value))
            return result

    def _selection(self,db,row,event):
        try:identifier=UUID(event.get('sourceMessageId'))
        except (ValueError,TypeError,AttributeError):raise HTTPException(422,'LINE_SELECTION_INVALID') from None
        scope=[row.provider,row.installation_id,row.account_id,row.target_id,event['nativeRoomKey']]
        source=db.scalar(select(ChannelMessage).join(ChannelRoom,ChannelRoom.id==ChannelMessage.room_id)
            .join(Bot,Bot.id==ChannelRoom.bot_id).join(ChannelConnectionRoom,ChannelConnectionRoom.room_id==ChannelRoom.id)
            .where(ChannelConnectionRoom.connection_id==row.id,ChannelConnectionRoom.native_room_hash==state._digest(scope),
                ChannelMessage.id==identifier,ChannelMessage.participant_kind=='bot',ChannelMessage.channel_type=='line',
                ChannelMessage.deleted_at.is_(None),ChannelRoom.deleted_at.is_(None),ChannelRoom.bot_id==row.bot_id,
                Bot.organization_id==row.organization_id,Bot.deleted_at.is_(None)))
        if source is None or row.accept_after is not None and state._utc(source.created_at)<state._utc(row.accept_after):raise HTTPException(403,'LINE_SELECTION_INVALID')
        return convert_packet('line','selection',dict(source=dict(id=str(source.id),participantKind='bot',
            messageType=source.message_type,text=source.text,payload=source.payload_json),event=event))

    def _accept(self,selected,event,reply_token,received_at,input_hash):
        target,lid,fence,marker,value=selected
        with self.sessions() as db:
            lease=state._installation(db,lid,self.owner,fence);row=state._connection(db,target.id)
            if ConnectionTarget.from_row(row)!=target or self._binding(target,lease)!=marker or self._credentials(row)!=value:raise HTTPException(409,'CONNECTION_CHANGED')
            state._target_active(db,row)
            if row.organization_id!=lease.organization_id or state._listener_scope(row,self.scope(row.account_id))!=lease.listener_scope_hash:raise HTTPException(409,'INSTALLATION_SCOPE_MISMATCH')
            cursor=dict(lease.cursor_json or {})
            if cursor.get('line_bindings',{}).get(str(row.id))!=marker:raise HTTPException(409,'CONNECTION_CHANGED')
            event=dict(event)
            if 'sourceMessageId' in event:event['message']=self._selection(db,row,event)
            state._event(event)
            scope=[row.provider,row.installation_id,row.account_id,row.target_id,event['nativeRoomKey']]
            immutable={k:v for k,v in event.items() if k not in {'timestamp','redelivery','occurredAt','replyToken'}}
            event_key=state._digest([scope,event['eventId']]);request_hash=state._digest([scope,immutable]);token_hash=state.scoped_hash(reply_token)
            events=dict(cursor.get('line_events',{}));receipt=events.get(state.scoped_hash(event['eventId']))
            if receipt is not None:
                if receipt.get('connection')!=str(row.id) or receipt.get('request_hash')!=request_hash or receipt.get('token_hash')!=token_hash or receipt.get('input_hash')!=input_hash:raise HTTPException(409,'NATIVE_EVENT_CONFLICT')
                item=db.scalar(select(ChannelConnectionDelivery).where(ChannelConnectionDelivery.connection_id==row.id,ChannelConnectionDelivery.event_key==event_key))
                if item is None or str(item.id)!=receipt.get('delivery') or item.request_hash!=request_hash:raise HTTPException(409,'LINE_EVENT_RECEIPT_UNAVAILABLE')
                context=decrypt_event_context(item.context_ciphertext,item.organization_id,item.id,self.config.channel_connection_encryption_key,item.context_key_version)
                original=context.get('event',context)
                if original.get('line_reply',{}).get('reply_hash')!=token_hash:raise HTTPException(409,'NATIVE_EVENT_CONFLICT')
                db.commit();return str(item.id)
            existing=db.scalar(select(ChannelConnectionDelivery.id).where(ChannelConnectionDelivery.connection_id==row.id,ChannelConnectionDelivery.event_key==event_key))
            if existing is not None:raise HTTPException(409,'LINE_EVENT_RECEIPT_UNAVAILABLE')
            tokens=dict(cursor.get('line_reply_tokens',{}))
            if token_hash in tokens:raise HTTPException(409,'LINE_REPLY_TOKEN_REUSED')
            proofs=dict(cursor.get('line_proofs',{}));proofs[str(row.id)]=self._seal(row,'handshake',dict(binding=marker))
            cursor['line_proofs']=proofs;lease.cursor_json=cursor
            if row.observed_state!='connected':db.commit();return None
            item=state.accept_delivery(db,row.id,lid,self.owner,fence,event,key=self.config.channel_connection_encryption_key,version=self.config.channel_connection_key_version)
            if item.request_hash!=request_hash:raise HTTPException(409,'NATIVE_EVENT_CONFLICT')
            context={**event,'line_reply':dict(reply_token=reply_token,reply_hash=token_hash,received_at=received_at,input_hash=input_hash)}
            item.context_ciphertext=encrypt_event_context(context,item.organization_id,item.id,self.config.channel_connection_encryption_key,item.context_key_version)
            tokens[token_hash]=dict(delivery=str(item.id),connection=str(row.id),generation=row.generation);cursor['line_reply_tokens']=tokens
            events[state.scoped_hash(event['eventId'])]=dict(delivery=str(item.id),connection=str(row.id),request_hash=request_hash,token_hash=token_hash,input_hash=input_hash,received_at=received_at)
            cursor['line_events']=events;lease.cursor_json=cursor
            db.commit();return str(item.id)

    def _received_at(self):
        with self.sessions() as db:return state.clock(db).timestamp()

    async def receive(self,signature,raw):
        if not isinstance(raw,bytes) or len(raw)>262144:raise HTTPException(413,'LINE_EVENT_TOO_LARGE')
        received_at=await asyncio.to_thread(self._received_at);candidates=await asyncio.to_thread(self._candidates);authenticated=[]
        for candidate in candidates:
            try:verify_line_signature(raw,signature,credentials(candidate[4])[1])
            except HTTPException:continue
            authenticated.append(candidate)
        if not authenticated:raise HTTPException(401,'LINE_AUTHENTICATION_FAILED')
        try:
            body=json.loads(raw)
            if not isinstance(body,dict) or not isinstance(body.get('events'),list) or len(body['events'])>100:raise ValueError()
        except (ValueError,TypeError,UnicodeError):raise HTTPException(422,'LINE_BODY_INVALID') from None
        matched=[c for c in authenticated if c[0].account_id==body.get('destination')]
        if not matched:raise HTTPException(403,'LINE_TARGET_FORBIDDEN')
        deliveries=[]
        for index,native in enumerate(body['events']):
            if not isinstance(native,dict):raise HTTPException(422,'LINE_EVENT_INVALID')
            if native.get('mode')=='standby' or native.get('type') not in {'message','postback'}:continue
            if native.get('mode','active')!='active':raise HTTPException(422,'LINE_EVENT_INVALID')
            if 'deliveryContext' in native and not isinstance(native['deliveryContext'],dict):raise HTTPException(422,'LINE_EVENT_INVALID')
            source=native.get('source',{})
            if not isinstance(source,dict):raise HTTPException(422,'LINE_EVENT_INVALID')
            kind=source.get('type');sid=source.get('userId' if kind=='user' else 'groupId' if kind=='group' else 'roomId')
            choices=[c for c in matched if c[0].target_id==sid and source_type(sid)==kind]
            if len(choices)!=1:raise HTTPException(403,'LINE_TARGET_FORBIDDEN')
            if not source.get('userId'):continue
            selected=choices[0];target=selected[0]
            event=await asyncio.to_thread(convert_packet,'line','normalize',dict(input=body,eventIndex=index,
                connection=dict(botUserId=target.account_id,sourceType=kind,sourceId=sid)))
            if event is None or not event['addressed']:continue
            reply=event.pop('replyToken',None)
            if not isinstance(reply,str) or not 0<len(reply)<=1024:raise HTTPException(422,'LINE_REPLY_TOKEN_INVALID')
            stamp=event.get('timestamp')
            if type(stamp) is not int or stamp<=0 or stamp>received_at*1000:raise HTTPException(422,'LINE_EVENT_TIME_INVALID')
            event['occurredAt']=datetime.fromtimestamp(stamp/1000,timezone.utc).isoformat()
            event['destination']=dict(bot=target.account_id,source=target.target_id,source_type=kind,generation=target.generation)
            canonical={k:v for k,v in native.items() if k not in {'replyToken','deliveryContext'}}
            if 'deliveryContext' in native:
                canonical['deliveryContext']={k:v for k,v in native['deliveryContext'].items() if k!='isRedelivery'}
            input_hash=state._digest(dict(destination=body['destination'],event=canonical))
            deadline=time.monotonic()+5
            while True:
                did=await asyncio.to_thread(self._accept,selected,event,reply,received_at,input_hash)
                if did is not None:deliveries.append(did);break
                if time.monotonic()>=deadline:raise HTTPException(503,'LINE_RECEIVER_NOT_READY')
                await asyncio.sleep(.05)
        return dict(deliveries=deliveries)


class LineListener:
    def __init__(self,adapter,targets):
        self.adapter=adapter;self.targets=self._targets(targets);self.stopped=asyncio.Event()

    def _targets(self,targets):
        result={}
        for target in targets:
            binding=self.adapter.bindings.get(target.id)
            if binding is None or binding.target!=target:raise HTTPException(409,'CONNECTION_CHANGED')
            result[target.id]=binding
        return result

    async def update(self,targets):self.targets=self._targets(targets)
    async def listen(self,receive):await self.stopped.wait()
    async def close(self):self.stopped.set()

    @staticmethod
    def _window(context,event,now):
        received=context.get('received_at');stamp=event.get('timestamp')
        return type(received) in {int,float} and 0<=now-received<55 and (not event.get('redelivery') or type(stamp) is int and 0<=now*1000-stamp<1200000)

    def _context(self,item):
        value=decrypt_event_context(item.context_ciphertext,item.organization_id,item.id,
            self.adapter.config.channel_connection_encryption_key,item.context_key_version)
        return value.get('event',value)

    def _reservation(self,db,item,event):
        target=self.targets.get(item.connection_id)
        if target is None or target.target.generation!=item.generation:raise HTTPException(409,'CONNECTION_CHANGED')
        spec=target.target;row=db.get(ChannelConnection,spec.id)
        lease=db.scalar(select(ChannelInstallationLease).where(ChannelInstallationLease.organization_id==spec.organization_id,
            ChannelInstallationLease.provider=='line',ChannelInstallationLease.listener_scope_hash==state._listener_scope(row,self.adapter.scope(spec.account_id))))
        if lease is None:raise HTTPException(409,'INSTALLATION_LEASE_LOST')
        state._live(db,row.id,lease.id,self.adapter.owner,lease.fence)
        if ConnectionTarget.from_row(row)!=spec or self.adapter._credentials(row)!=target.credentials:raise HTTPException(409,'CONNECTION_CHANGED')
        context=event.get('line_reply',{});reply=context.get('reply_token')
        if not isinstance(reply,str) or not 0<len(reply)<=1024 or context.get('reply_hash')!=state.scoped_hash(reply):raise HTTPException(409,'LINE_REPLY_NOT_AVAILABLE')
        expected=dict(delivery=str(item.id),connection=str(row.id),generation=row.generation)
        if (lease.cursor_json or {}).get('line_reply_tokens',{}).get(context['reply_hash'])!=expected:raise HTTPException(409,'LINE_REPLY_RESERVATION_LOST')
        scope=[row.provider,row.installation_id,row.account_id,row.target_id,event['nativeRoomKey']]
        immutable={k:v for k,v in event.items() if k not in {'timestamp','redelivery','occurredAt','replyToken','line_reply'}}
        receipt=(lease.cursor_json or {}).get('line_events',{}).get(state.scoped_hash(event['eventId']))
        if item.event_key!=state._digest([scope,event['eventId']]) or item.request_hash!=state._digest([scope,immutable]) or not isinstance(receipt,dict) or receipt.get('delivery')!=str(item.id) or receipt.get('request_hash')!=item.request_hash or receipt.get('token_hash')!=context['reply_hash'] or receipt.get('input_hash')!=context.get('input_hash') or receipt.get('received_at')!=context.get('received_at'):raise HTTPException(409,'LINE_REPLY_NOT_AVAILABLE')
        if not self._window(context,event,state.clock(db).timestamp()):raise HTTPException(409,'LINE_REPLY_EXPIRED')
        return lease,row,target

    def can_execute(self,item):
        try:self._reservation(object_session(item),item,self._context(item))
        except HTTPException as error:
            item.status='failed';item.last_error_code=error.detail if error.detail.startswith('LINE_REPLY_') else 'LINE_REPLY_NOT_AVAILABLE';item.deadline_at=None
            return False
        return True

    def prepare_send(self,db,target,item,event,packets,*,cancelled):
        lease,row,binding=self._reservation(db,item,event)
        if item.status!='sending' or not item.send_claim_id or item.installation_fence!=lease.fence or item.generation!=row.generation or binding.target!=target or self.stopped.is_set() or cancelled.is_set():raise HTTPException(409,'LINE_REPLY_NOT_AVAILABLE')
        if self._context(item)!=event:raise HTTPException(409,'LINE_REPLY_NOT_AVAILABLE')
        destination=dict(bot=target.account_id,source=target.target_id,source_type=binding.source_type,generation=target.generation)
        if event.get('destination')!=destination:raise HTTPException(409,'LINE_PROOF_SCOPE_MISMATCH')
        reply_body(dict(replyToken=event['line_reply']['reply_token'],messages=packets))
        # anchor는 DB clock 조회 전: 대기 시간은 잔여 창을 늘릴 수 없다.
        anchor=time.monotonic();now=state.clock(db).timestamp();meta=event['line_reply']
        deadlines=[meta['received_at']+55,state._utc(lease.lease_expires_at).timestamp(),state._utc(row.lease_expires_at).timestamp()]
        if event.get('redelivery'):deadlines.append(event['timestamp']/1000+1200)
        return LineSendGuard(binding,anchor+min(deadlines)-now,state._digest(event),state._digest(packets),cancelled)

    def _post(self,target,packets,event,guard):
        # 이 함수는 실제 HTTP executor 안에서 실행한다. 늦은 실행은 POST 전에 거부한다.
        if not isinstance(guard,LineSendGuard) or not guard.once.acquire(blocking=False):raise HTTPException(409,'LINE_REPLY_NOT_AVAILABLE')
        if self.stopped.is_set() or guard.cancelled.is_set() or time.monotonic()>=guard.expires_at or self.targets.get(target.id)!=guard.binding or guard.binding.target!=target or state._digest(event)!=guard.event_hash or state._digest(packets)!=guard.packet_hash:raise HTTPException(409,'LINE_REPLY_NOT_AVAILABLE')
        body=dict(replyToken=event['line_reply']['reply_token'],messages=packets);reply_body(body)
        token,_=credentials(guard.binding.credentials)
        result=self.adapter.http.reply(token,body)
        if self.stopped.is_set() or guard.cancelled.is_set() or self.targets.get(target.id)!=guard.binding:raise HTTPException(409,'CONNECTION_CHANGED')
        messages=result.get('sentMessages') if isinstance(result,dict) else None
        if not isinstance(messages,list) or len(messages)!=len(packets):raise RuntimeError('LINE_REPLY_RECEIPT_UNKNOWN')
        identifiers=[]
        for message in messages:
            identifier=message.get('id') if isinstance(message,dict) else None
            if type(identifier) is int and identifier>0:identifier=str(identifier)
            if not isinstance(identifier,str) or not re.fullmatch('[A-Za-z0-9_-]{1,200}',identifier):raise RuntimeError('LINE_REPLY_RECEIPT_UNKNOWN')
            identifiers.append(identifier)
        return identifiers

    async def send(self,target,packets,event,*,send_guard=None):
        # 이 송신 시도만의 복사본이며 guard·토큰은 원래 event/hash에 추가 저장하지 않는다.
        packets=json.loads(json.dumps(packets));event=json.loads(json.dumps(event))
        return await asyncio.to_thread(self._post,target,packets,event,send_guard)


@dataclass(frozen=True)
class LineSendGuard:
    binding:LineBinding=field(repr=False)
    expires_at:float
    event_hash:str
    packet_hash:str
    cancelled:object=field(repr=False)
    once:object=field(default_factory=lambda:Semaphore(1),repr=False,compare=False)
