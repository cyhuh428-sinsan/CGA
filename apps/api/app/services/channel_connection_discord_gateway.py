"""Discord ACK와 Gateway cursor를 현행 암호화 원장에 보관한다."""
from __future__ import annotations
from dataclasses import dataclass,field
from uuid import uuid4
import math,re
from sqlalchemy import select
from sqlalchemy.orm import object_session
from fastapi import HTTPException
from app.core.config import settings
from app.models import ChannelConnection,ChannelConnectionDelivery,ChannelInstallationLease
from app.services import channel_connection_state as state
from app.services.channel_connections import encrypt_event_context,decrypt_event_context

@dataclass(frozen=True)
class AckReservation:
    claim_id:str
    interaction_id:str
    callback_token:str=field(repr=False)

class DiscordState:
    def __init__(self,sessions,*,lease_id,owner,fence,scope=None,key=None,version=None):
        self.sessions=sessions;self.lease_id=lease_id;self.owner=owner;self.fence=fence;self.scope=scope
        self.key=settings.channel_connection_encryption_key if key is None else key
        self.version=settings.channel_connection_key_version if version is None else version
        self.cutoffs={};self.loaded_cursor=None

    def _lease(self,db):
        lease=state._installation(db,self.lease_id,self.owner,self.fence)
        expected=state._digest(['discord','verified-listener',self.scope]) if self.scope else None
        if lease.provider!='discord' or expected is not None and lease.listener_scope_hash!=expected:
            raise HTTPException(409,'INSTALLATION_SCOPE_MISMATCH')
        return lease

    def context(self,item):
        return decrypt_event_context(item.context_ciphertext,item.organization_id,item.id,self.key,item.context_key_version)

    def _write(self,item,value):
        item.context_ciphertext=encrypt_event_context(value,item.organization_id,item.id,self.key,self.version)
        item.context_key_version=self.version

    def _terminal(self,item,ctx,status,code):
        item.status=status;item.last_error_code=code
        ctx.pop('callback_token',None);ctx['discord_ack']['status']=status;self._write(item,ctx)

    def can_execute(self,item):
        if item.status!='received':return False
        ctx=self.context(item);ack=ctx.get('discord_ack')
        if ack is None:return True
        if not isinstance(ack,dict):return False
        if ack.get('status')=='confirmed':return True
        if ack.get('status') in {'pending','sending'}:
            expires=ack.get('expires_at');db=object_session(item)
            if type(expires) not in {int,float} or not math.isfinite(expires) or expires<=state.clock(db).timestamp():
                unknown=ack.get('status')=='sending'
                self._terminal(item,ctx,'unknown' if unknown else 'failed','DISCORD_ACK_UNKNOWN' if unknown else 'DISCORD_ACK_EXPIRED')
        return False

    def _locked(self,db,did,lease):
        initial=db.get(ChannelConnectionDelivery,did)
        if initial is None or initial.organization_id!=lease.organization_id:return None,None
        row=state._connection(db,initial.connection_id)
        item=state._delivery(db,did)
        if row.organization_id!=lease.organization_id or row.provider!='discord' or row.listener_scope_hash!=lease.listener_scope_hash:
            raise HTTPException(409,'INSTALLATION_SCOPE_MISMATCH')
        return row,item

    def reserve_ack(self,did):
        with self.sessions() as db:
            lease=self._lease(db);row,item=self._locked(db,did,lease)
            if item is None:return None
            ctx=self.context(item);ack=ctx.get('discord_ack',{})
            if item.status!='received' or ack.get('status')!='pending':
                if item.status in {'failed','cancelled'} and 'callback_token' in ctx:
                    ctx.pop('callback_token',None);self._write(item,ctx);db.commit()
                return None
            if row.generation!=item.generation or row.desired_state!='connected':
                self._terminal(item,ctx,'cancelled','CONNECTION_CHANGED');db.commit();return None
            state._live(db,row.id,self.lease_id,self.owner,self.fence)
            self.can_execute(item)
            if item.status!='received':db.commit();return None
            token=ctx.get('callback_token');iid=ctx.get('interaction_id')
            if not isinstance(token,str) or not token or not isinstance(iid,str) or not re.fullmatch('[1-9][0-9]{0,19}',iid):
                self._terminal(item,ctx,'failed','DISCORD_ACK_INVALID');db.commit();return None
            claim=str(uuid4());ack.update(status='sending',claim_id=claim);self._write(item,ctx);db.commit()
            return AckReservation(claim,iid,token)

    def finish_ack(self,did,claim_id,outcome):
        if outcome not in {'confirmed','unknown','rejected'}:raise ValueError('INVALID_ACK_OUTCOME')
        with self.sessions() as db:
            lease=self._lease(db);row,item=self._locked(db,did,lease)
            if item is None:return False
            ctx=self.context(item);ack=ctx.get('discord_ack',{})
            if item.status!='received' or ack.get('status')!='sending' or ack.get('claim_id')!=claim_id:return False
            if row.generation!=item.generation or row.desired_state!='connected':
                self._terminal(item,ctx,'cancelled','CONNECTION_CHANGED')
            elif outcome=='confirmed':
                ctx.pop('callback_token',None);ack['status']='confirmed';self._write(item,ctx)
            else:self._terminal(item,ctx,'unknown' if outcome=='unknown' else 'failed','DISCORD_ACK_UNKNOWN' if outcome=='unknown' else 'DISCORD_ACK_REJECTED')
            db.commit();return True

    def _protect(self,lease,purpose,value):
        return {'ciphertext':encrypt_event_context({'purpose':purpose,'value':value},lease.organization_id,lease.id,self.key,self.version),'key_version':self.version}

    def pending_targets(self):
        from app.services.channel_connection_runtime import ConnectionTarget
        with self.sessions() as db:
            lease=self._lease(db)
            rows=db.scalars(select(ChannelConnection).where(ChannelConnection.organization_id==lease.organization_id,
                ChannelConnection.provider=='discord',ChannelConnection.listener_scope_hash==lease.listener_scope_hash,
                ChannelConnection.desired_state=='connected',ChannelConnection.deleted_at.is_(None)).order_by(ChannelConnection.id).with_for_update()).all()
            result=[]
            for row in rows:
                state._target_active(db,row);result.append(ConnectionTarget.from_row(row))
            return result

    def pending_valid(self,target):
        from app.services.channel_connection_runtime import ConnectionTarget
        with self.sessions() as db:
            lease=self._lease(db)
            try:
                row=state._connection(db,target.id);state._target_active(db,row)
                return ConnectionTarget.from_row(row)==target and row.listener_scope_hash==lease.listener_scope_hash and row.organization_id==lease.organization_id and row.provider=='discord'
            except HTTPException as error:
                if error.status_code not in {404,409}:raise
                return False

    def restore_selection(self,target,event):
        from uuid import UUID
        from app.models import ChannelConnectionRoom,ChannelRoom,ChannelMessage,Bot
        try:identifier=UUID(event.get('sourceMessageId'))
        except (ValueError,TypeError,AttributeError):raise HTTPException(422,'DISCORD_SELECTION_INVALID') from None
        with self.sessions() as db:
            self._lease(db);row=state._live(db,target.id,self.lease_id,self.owner,self.fence)
            if row.generation!=target.generation:raise HTTPException(409,'CONNECTION_CHANGED')
            scope=[row.provider,row.installation_id,row.account_id,row.target_id,event.get('nativeRoomKey')]
            source=db.scalar(select(ChannelMessage).join(ChannelRoom,ChannelRoom.id==ChannelMessage.room_id)
                .join(Bot,Bot.id==ChannelRoom.bot_id).join(ChannelConnectionRoom,ChannelConnectionRoom.room_id==ChannelRoom.id)
                .where(ChannelConnectionRoom.connection_id==row.id,ChannelConnectionRoom.native_room_hash==state._digest(scope),
                    ChannelMessage.id==identifier,ChannelMessage.participant_kind=='bot',ChannelMessage.channel_type=='discord',
                    ChannelMessage.deleted_at.is_(None),ChannelRoom.deleted_at.is_(None),ChannelRoom.bot_id==row.bot_id,
                    Bot.organization_id==row.organization_id,Bot.deleted_at.is_(None)))
            if source is None:raise HTTPException(403,'DISCORD_SELECTION_INVALID')
            packet={'id':str(source.id),'participantKind':'bot','messageType':source.message_type,'text':source.text,'payload':source.payload_json}
            return convert_packet('discord','selection',{'source':packet,'event':event})

    def fresh_cutoff(self,targets):
        with self.sessions() as db:
            lease=self._lease(db);now=state.clock(db)
            for binding in sorted(targets,key=lambda t:str(t.target.id)):
                target=binding.target;row=state._live(db,target.id,self.lease_id,self.owner,self.fence)
                if row.generation!=target.generation:raise HTTPException(409,'CONNECTION_CHANGED')
                row.accept_after=now
                self.cutoffs[str(row.id)]={'generation':row.generation,'accept_after':now.isoformat()}
            self._persist_cutoffs(lease)
            db.commit()

    def resume_cutoffs(self,targets,cursor):
        if self.loaded_cursor is None or _session(cursor)!=_session(self.loaded_cursor):raise HTTPException(409,'CONNECTION_CHANGED')
        with self.sessions() as db:
            lease=self._lease(db)
            for binding in sorted(targets,key=lambda t:str(t.target.id)):
                row=state._live(db,binding.target.id,self.lease_id,self.owner,self.fence)
                if row.generation!=binding.target.generation:raise HTTPException(409,'CONNECTION_CHANGED')
                proof=self.cutoffs.get(str(row.id))
                if proof and proof['generation']==row.generation:row.accept_after=datetime.fromisoformat(proof['accept_after'])
                else:self.cutoffs[str(row.id)]={'generation':row.generation,'accept_after':state._utc(row.accept_after).isoformat()}
            self._persist_cutoffs(lease)
            db.commit()

    def restore_binding(self,binding,cursor,pending):
        from app.services.channel_connection_runtime import ConnectionTarget
        target=binding.target
        if (target not in pending or self.loaded_cursor is None or _session(cursor)!=_session(self.loaded_cursor)
            or (binding.application_id,binding.bot_user_id)!=(cursor.get('application_id'),cursor.get('bot_user_id'))):return False
        with self.sessions() as db:
            lease=self._lease(db)
            saved=(lease.cursor_json or {}).get('discord_gateway')
            if saved is None:return False
            wrapper=self._unprotect(lease,saved);proof=wrapper['target_cutoffs'].get(str(target.id))
            if (_session(wrapper['value'])!=_session(cursor) or proof is None
                or proof!=self.cutoffs.get(str(target.id)) or proof['generation']!=target.generation):return False
            try:row=state._live(db,target.id,self.lease_id,self.owner,self.fence)
            except HTTPException as error:
                if error.status_code not in {404,409}:raise
                return False
            return ConnectionTarget.from_row(row)==target

    def _persist_cutoffs(self,lease):
        saved=(lease.cursor_json or {}).get('discord_gateway')
        if saved is None:return
        wrapper=self._unprotect(lease,saved);wrapper['target_cutoffs']=dict(self.cutoffs)
        cursor=dict(lease.cursor_json or {})
        cursor['discord_gateway']={'ciphertext':encrypt_event_context(wrapper,lease.organization_id,lease.id,self.key,self.version),'key_version':self.version}
        lease.cursor_json=cursor

    def _unprotect(self,lease,saved):
        if not isinstance(saved,dict) or set(saved)!={'ciphertext','key_version'}:raise HTTPException(422,'DISCORD_CURSOR_INVALID')
        wrapper=decrypt_event_context(saved['ciphertext'],lease.organization_id,lease.id,self.key,saved['key_version'])
        if not isinstance(wrapper,dict) or set(wrapper)!={'purpose','value','target_cutoffs'} or wrapper['purpose']!='discord-gateway':raise HTTPException(422,'DISCORD_CURSOR_INVALID')
        _validate_cursor(wrapper['value']);_validate_cutoffs(wrapper['target_cutoffs'])
        return wrapper

    def reset_cursor(self,targets,reason,from_sequence,through_sequence):
        from app.models import AuditLog
        if reason not in {'DISCORD_SESSION_EXPIRED','DISCORD_SESSION_INVALID','DISCORD_RESUME_WINDOW_EXCEEDED'}:raise ValueError('INVALID_GATEWAY_RESET')
        if any(v is not None and (type(v) is not int or v<0) for v in [from_sequence,through_sequence]):raise ValueError('INVALID_GATEWAY_SEQUENCE')
        with self.sessions() as db:
            lease=self._lease(db);cursor=dict(lease.cursor_json or {});cursor.pop('discord_gateway',None)
            receipt={'reason':reason,'from_sequence':from_sequence,'through_sequence':through_sequence,'end_unknown':True,'recorded_at':state.clock(db).isoformat()}
            cursor['discord_gateway_reset']=self._protect(lease,'discord-gateway-reset',receipt)
            lease.cursor_json=cursor
            db.add(AuditLog(action_type='system.connection.discord_resume_reset',target_type='channel_installation_lease',target_id=lease.id,after_json=receipt));db.commit()
            self.cutoffs={};self.loaded_cursor=None

    def save_cursor(self,value):
        _validate_cursor(value)
        with self.sessions() as db:
            lease=self._lease(db);cursor=dict(lease.cursor_json or {})
            saved=cursor.get('discord_gateway')
            if saved is not None:
                previous=self._unprotect(lease,saved)['value']
                if _session(previous)!=_session(value) or value.get('sequence',-1)<previous.get('sequence',-1):raise HTTPException(409,'CONNECTION_CHANGED')
            wrapper={'purpose':'discord-gateway','value':value,'target_cutoffs':dict(self.cutoffs)}
            cursor['discord_gateway']={'ciphertext':encrypt_event_context(wrapper,lease.organization_id,lease.id,self.key,self.version),'key_version':self.version}
            lease.cursor_json=cursor;db.commit()

    def start_cursor(self,value):
        _validate_cursor(value)
        with self.sessions() as db:
            lease=self._lease(db);cursor=dict(lease.cursor_json or {})
            wrapper={'purpose':'discord-gateway','value':value,'target_cutoffs':{}}
            cursor['discord_gateway']={'ciphertext':encrypt_event_context(wrapper,lease.organization_id,lease.id,self.key,self.version),'key_version':self.version}
            lease.cursor_json=cursor;db.commit()
            self.cutoffs={};self.loaded_cursor=None

    def load_cursor(self):
        with self.sessions() as db:
            lease=self._lease(db);saved=(lease.cursor_json or {}).get('discord_gateway')
            if saved is None:return None
            wrapper=self._unprotect(lease,saved)
            self.cutoffs=wrapper['target_cutoffs'];self.loaded_cursor=wrapper['value']
            return wrapper['value']

import asyncio,json,hashlib,logging,time
from urllib.parse import urlsplit,parse_qs
from app.services.channel_connection_bridge import convert_packet
from datetime import datetime,timezone


def _session(value):return tuple(value.get(k) for k in ('application_id','bot_user_id','token_hash','session_id','resume_url'))


def _validate_cutoffs(value):
    from uuid import UUID
    try:
        if not isinstance(value,dict) or len(value)>10000:raise ValueError()
        for identifier,proof in value.items():
            if str(UUID(identifier))!=identifier or not isinstance(proof,dict) or set(proof)!={'generation','accept_after'} or type(proof['generation']) is not int or proof['generation']<1:raise ValueError()
            if not isinstance(proof['accept_after'],str) or len(proof['accept_after'])>64 or datetime.fromisoformat(proof['accept_after']).tzinfo is None:raise ValueError()
    except (ValueError,TypeError,AttributeError):raise HTTPException(422,'DISCORD_CURSOR_INVALID') from None


def validate_gateway_url(value):
    try:
        if not isinstance(value,str) or len(value)>2048 or any(c.isspace() for c in value) or '\\' in value:raise ValueError()
        p=urlsplit(value);q=parse_qs(p.query,strict_parsing=True)
        if p.scheme!='wss' or not re.fullmatch(r'gateway(?:-[a-z0-9]+)*\.discord\.gg',p.hostname or '') or p.port not in {None,443} or p.username is not None or p.password is not None or p.path not in {'','/'} or p.fragment or any(k not in {'v','encoding'} for k in q) or q.get('v',['10'])!=['10'] or q.get('encoding',['json'])!=['json']:raise ValueError()
        return 'wss://'+p.hostname+'/?v=10&encoding=json'
    except (ValueError,TypeError):raise HTTPException(403,'DISCORD_GATEWAY_DESTINATION_UNTRUSTED') from None



def _validate_cursor(value):
    fields={'application_id','bot_user_id','token_hash','session_id','resume_url','sequence'}
    if value=={}:return
    if not isinstance(value,dict) or set(value)!=fields:raise HTTPException(422,'DISCORD_CURSOR_INVALID')
    if any(not isinstance(value[k],str) or not re.fullmatch('[1-9][0-9]{0,19}',value[k]) for k in ['application_id','bot_user_id']):raise HTTPException(422,'DISCORD_CURSOR_INVALID')
    if not isinstance(value['token_hash'],str) or not re.fullmatch('[0-9a-f]{64}',value['token_hash']) or not isinstance(value['session_id'],str) or not 0<len(value['session_id'])<=512 or type(value['sequence']) is not int or not 0<=value['sequence']<=9223372036854775807:raise HTTPException(422,'DISCORD_CURSOR_INVALID')
    validate_gateway_url(value['resume_url'])


class ResumeWindowExceeded(Exception):
    """수신 공백의 범위만 기록하고 같은 재개를 무한 반복하지 않는다."""


async def _reset_for_error(gate,targets,cursor,sequence,error):
    code=getattr(getattr(error,'rcvd',None),'code',None)
    sent=getattr(getattr(error,'sent',None),'code',None)
    if code in {1000,1001,4007,4009}:reason='DISCORD_SESSION_EXPIRED'
    elif isinstance(error,ResumeWindowExceeded) or sent==1009:reason='DISCORD_RESUME_WINDOW_EXCEEDED'
    else:return
    await asyncio.to_thread(gate.reset_cursor,list(targets),reason,cursor.get('sequence'),sequence)


def _frame(raw):
    try:
        if not isinstance(raw,(str,bytes)):raise ValueError()
        if len(raw.encode() if isinstance(raw,str) else raw)>1048576:raise ResumeWindowExceeded()
        value=json.loads(raw)
        if not isinstance(value,dict) or type(value.get('op')) is not int:raise ValueError()
        return value
    except (ValueError,TypeError,UnicodeError):raise HTTPException(422,'DISCORD_FRAME_INVALID') from None


class DiscordSocketTransport:
    async def open(self,url):
        from websockets.asyncio.client import connect
        from websockets.exceptions import SecurityError
        class StrictConnect(connect):
            def process_redirect(self,error):return SecurityError('DISCORD_GATEWAY_REDIRECT_FORBIDDEN')
        logger=logging.getLogger('cga.private.discord.websocket');logger.disabled=True;logger.propagate=False
        try:return await StrictConnect(validate_gateway_url(url),proxy=None,open_timeout=5,ping_interval=None,close_timeout=2,max_size=1048576,max_queue=8,compression=None,logger=logger)
        except Exception:raise HTTPException(503,'DISCORD_GATEWAY_UNAVAILABLE') from None


async def open_gateway(adapter,targets,gate):
    if not targets or any(t.application_id!=targets[0].application_id or hashlib.sha256(t.credentials['bot_token'].encode()).hexdigest()!=hashlib.sha256(targets[0].credentials['bot_token'].encode()).hexdigest() for t in targets):raise HTTPException(403,'DISCORD_GATEWAY_SCOPE_MISMATCH')
    binding=targets[0];token=binding.credentials['bot_token'];app=binding.application_id
    if adapter.open_not_before.get((app,hashlib.sha256(token.encode()).hexdigest()),0)>time.monotonic():raise HTTPException(503,'DISCORD_GATEWAY_RECONNECT_DELAY')
    adapter.open_not_before[(app,hashlib.sha256(token.encode()).hexdigest())]=time.monotonic()+5
    ws=None;listener=None;saved=None
    try:
        info=await asyncio.to_thread(adapter.http.call,'GET','/gateway/bot',token)
        if info.get('shards')!=1:raise ValueError()
        saved=await asyncio.to_thread(gate.load_cursor)
        digest=hashlib.sha256(token.encode()).hexdigest()
        resumable=bool(saved and (saved.get('application_id'),saved.get('bot_user_id'),saved.get('token_hash'))==(app,binding.bot_user_id,digest) and isinstance(saved.get('session_id'),str) and saved['session_id'] and type(saved.get('sequence')) is int and saved['sequence']>=0)
        url=validate_gateway_url(saved['resume_url'] if resumable else info.get('url'))
        if not resumable:
            limit=info.get('session_start_limit',{})
            if type(limit.get('remaining')) is not int or limit['remaining']<=0:
                reset=limit.get('reset_after',60000)
                adapter.open_not_before[(app,hashlib.sha256(token.encode()).hexdigest())]=time.monotonic()+max(5,min(86400,reset/1000 if isinstance(reset,(int,float)) else 60));raise ValueError()
        ws=await adapter.socket.open(url);hello=_frame(await asyncio.wait_for(ws.recv(),5))
        interval=(hello.get('d') or {}).get('heartbeat_interval')
        if hello['op']!=10 or type(interval) not in {int,float} or not math.isfinite(interval) or not 100<=interval<=300000:raise ValueError()
        listener=DiscordListener(adapter,targets,ws,gate,interval/1000,digest,saved if resumable else None)
        if resumable:packet={'op':6,'d':{'token':token,'session_id':saved['session_id'],'seq':saved['sequence']}}
        else:packet={'op':2,'d':{'token':token,'intents':4609,'properties':{'os':'linux','browser':'CGA','device':'CGA'}}}
        if len(json.dumps(packet).encode())>4096:raise ValueError()
        await ws.send(json.dumps(packet));listener.heartbeat=asyncio.create_task(listener._heartbeat())
        async with asyncio.timeout(10):
            size=0
            while True:
                frame=_frame(await ws.recv())
                if await listener.control(frame):continue
                if frame['op']!=0:raise ValueError()
                seq=frame.get('s')
                if type(seq) is not int or seq<0:raise ValueError()
                listener.received_sequence=seq
                if not resumable:
                    data=frame.get('d') or {}
                    if frame.get('t')!='READY' or (data.get('user') or {}).get('id')!=binding.bot_user_id or (data.get('user') or {}).get('bot') is not True or (data.get('application') or {}).get('id')!=app:raise ValueError()
                    sid=data.get('session_id')
                    if not isinstance(sid,str) or not 0<len(sid)<=512:raise ValueError()
                    listener.cursor={'application_id':app,'bot_user_id':binding.bot_user_id,'token_hash':digest,'session_id':sid,'resume_url':validate_gateway_url(data.get('resume_gateway_url')),'sequence':seq}
                    await asyncio.to_thread(gate.start_cursor,listener.cursor);return listener
                size+=len(json.dumps(frame).encode())
                if len(listener.buffer)>=64 or size>1048576:raise ResumeWindowExceeded()
                if seq<=saved['sequence']:raise ValueError()
                listener.buffer.append(frame)
                if frame.get('t')=='RESUMED':listener.resumed=True;return listener
    except BaseException as error:
        try:await _reset_for_error(gate,targets,listener.cursor if listener else saved or {},listener.received_sequence if listener else None,error)
        finally:
            if listener is not None:await listener.close()
        if listener is None and ws is not None:
            try:await ws.close(code=4000)
            except Exception:pass
        if isinstance(error,asyncio.CancelledError):raise
        raise HTTPException(503,'DISCORD_GATEWAY_HANDSHAKE_FAILED') from None


class DiscordListener:
    def __init__(self,adapter,targets,ws,gate,interval,digest,cursor):
        self.adapter=adapter;self.ws=ws;self.gate=gate;self.interval=interval;self.digest=digest;self.app_id=targets[0].application_id
        self.targets={t.target.id:t for t in targets if self.accepts_target(t)};self.cursor=dict(cursor or {});self.received_sequence=self.cursor.get('sequence');self.awaiting_ack=False;self.stopped=False;self.heartbeat=None;self.resumed=False;self.buffer=[]
        self.revision=0;self.socket_changed=asyncio.Event()
        self.pending_targets=[];self.deferred=[];self.checkpoints=[]
    def accepts_target(self,target):return target.application_id==self.app_id and hashlib.sha256(target.credentials['bot_token'].encode()).hexdigest()==self.digest
    def can_execute(self,item):return self.gate.can_execute(item)
    async def update(self,targets):
        if self.stopped:raise HTTPException(409,'DISCORD_LISTENER_STOPPED')
        bindings=[self.adapter.binding(t) for t in targets]
        replacement=None
        for binding in bindings:
            if binding.application_id!=self.app_id:raise HTTPException(403,'DISCORD_GATEWAY_SCOPE_MISMATCH')
            previous=self.targets.get(binding.target.id)
            if binding!=previous and not self.accepts_target(binding):
                # 새 session에 확립된 기존 target만 fresh REST 검증 binding을 복원한다.
                if self.resumed and await asyncio.to_thread(self.gate.restore_binding,binding,self.cursor,self.pending_targets):continue
                if previous is None or binding.target.generation<=previous.target.generation:raise HTTPException(403,'DISCORD_GATEWAY_SCOPE_MISMATCH')
                if replacement is not None and replacement.credentials!=binding.credentials:raise HTTPException(403,'DISCORD_GATEWAY_SCOPE_MISMATCH')
                replacement=binding
        prepared={t.target.id:t for t in bindings}
        if replacement is not None:
            if self.deferred:
                await asyncio.to_thread(self.gate.reset_cursor,list(self.targets.values()),'DISCORD_SESSION_INVALID',self.cursor.get('sequence'),self.received_sequence)
            fresh=await open_gateway(self.adapter,[replacement],self.gate)
            try:
                if not fresh.resumed:await asyncio.to_thread(self.gate.fresh_cutoff,list(prepared.values()))
                pending=await asyncio.to_thread(self.gate.pending_targets)
                if self.stopped:raise HTTPException(409,'DISCORD_LISTENER_STOPPED')
            except BaseException:
                await fresh.close();raise
            # Handshake 확정 뒤에만 socket·cursor·인증 세대를 원자 교체한다.
            old_heartbeat=self.heartbeat
            if fresh.heartbeat:fresh.heartbeat.cancel()
            if old_heartbeat:old_heartbeat.cancel()
            previous_ws=self.ws
            self.ws,self.digest,self.interval=fresh.ws,fresh.digest,fresh.interval
            self.cursor,self.received_sequence,self.buffer=fresh.cursor,fresh.received_sequence,fresh.buffer
            self.resumed=fresh.resumed;self.pending_targets=pending
            self.deferred=[];self.checkpoints=[]
            self.awaiting_ack=False;self.targets=prepared;self.revision+=1;self.socket_changed.set()
            self.heartbeat=asyncio.create_task(self._heartbeat())
            async def cleanup():
                await asyncio.gather(*(t for t in (old_heartbeat,fresh.heartbeat) if t),return_exceptions=True)
                await previous_ws.close(code=4000)
            closing=asyncio.create_task(cleanup())
            try:await asyncio.shield(closing)
            except asyncio.CancelledError:
                await closing;raise
            return
        if prepared!=self.targets:
            added=[binding for identifier,binding in prepared.items() if self.targets.get(identifier)!=binding]
            if self.resumed and added:await asyncio.to_thread(self.gate.resume_cutoffs,added,self.cursor)
            elif added:await asyncio.to_thread(self.gate.fresh_cutoff,added)
            self.targets=prepared;self.revision+=1;self.socket_changed.set()
    async def close(self):
        self.stopped=True
        self.socket_changed.set()
        self.deferred=[];self.checkpoints=[];self.pending_targets=[];self.buffer=[]
        if self.heartbeat and self.heartbeat is not asyncio.current_task():
            self.heartbeat.cancel();await asyncio.gather(self.heartbeat,return_exceptions=True)
        await self.ws.close(code=4000)
    async def heartbeat_once(self):
        if self.awaiting_ack:raise RuntimeError('DISCORD_HEARTBEAT_ACK_MISSING')
        await self.ws.send(json.dumps({'op':1,'d':self.received_sequence}));self.awaiting_ack=True
    async def _heartbeat(self):
        try:
            while not self.stopped:
                await asyncio.sleep(self.interval);await self.heartbeat_once()
        except asyncio.CancelledError:raise
        except Exception:
            self.stopped=True;await self.ws.close(code=4000)
    async def control(self,frame):
        op=frame['op']
        if op==11:self.awaiting_ack=False;return True
        if op==1:
            await self.ws.send(json.dumps({'op':1,'d':self.received_sequence}));self.awaiting_ack=True;return True
        if op==9:
            if frame.get('d') is not True:await asyncio.to_thread(self.gate.reset_cursor,list(self.targets.values()),'DISCORD_SESSION_INVALID',self.cursor.get('sequence'),self.received_sequence)
            raise RuntimeError('DISCORD_SESSION_INVALID')
        if op==7:raise RuntimeError('DISCORD_RESUME_REQUIRED')
        return False
    async def _receive_frame(self,ws):
        raw=await ws.recv()
        return raw,self.revision,dict(self.targets)

    async def listen(self,accept):
        while not self.stopped:
            await self._drain_deferred(accept)
            source=self.ws;revision=self.revision
            bindings=dict(self.targets)
            if self.buffer:
                frame=self.buffer.pop(0)
            else:
                reading=asyncio.create_task(self._receive_frame(source));changed=asyncio.create_task(self.socket_changed.wait())
                try:
                    done,_=await asyncio.wait({reading,changed},return_when=asyncio.FIRST_COMPLETED)
                    if source is not self.ws or reading not in done:
                        self.socket_changed.clear();continue
                    raw,revision,bindings=reading.result();self.socket_changed.clear()
                    frame=_frame(raw)
                except Exception as error:
                    await _reset_for_error(self.gate,self.targets.values(),self.cursor,self.received_sequence,error);raise
                finally:
                    for task in (reading,changed):
                        if not task.done():task.cancel()
                    await asyncio.gather(reading,changed,return_exceptions=True)
            if source is not self.ws:continue
            if await self.control(frame):continue
            try:await self.handle(frame,accept,source=source,revision=revision,bindings=bindings)
            except ResumeWindowExceeded as error:
                await _reset_for_error(self.gate,self.targets.values(),self.cursor,self.received_sequence,error);raise
            except HTTPException as error:
                if error.status_code!=409 or error.detail!='CONNECTION_CHANGED':raise

    def _current(self,binding,source,revision):
        if self.stopped or source is not self.ws or self.targets.get(binding.target.id)!=binding or self.adapter.binding(binding.target)!=binding:
            raise HTTPException(409,'CONNECTION_CHANGED')

    async def handle(self,frame,accept,*,source,revision,bindings=None):
        if self.stopped:raise HTTPException(409,'DISCORD_LISTENER_STOPPED')
        if source is not self.ws:raise HTTPException(409,'CONNECTION_CHANGED')
        seq=frame.get('s')
        if frame.get('op')!=0 or type(seq) is not int or seq<0:raise HTTPException(422,'DISCORD_FRAME_INVALID')
        self.received_sequence=max(seq,self.received_sequence if self.received_sequence is not None else -1)
        if seq<=self.cursor.get('sequence',-1):return
        if any(x[0]==seq for x in self.checkpoints):return
        snapshot=dict(self.targets) if bindings is None else bindings
        self.checkpoints.append([seq,False])
        pending=self._pending_target(frame,snapshot)
        if pending is not None:
            if len(self.deferred)>=64 or sum(len(json.dumps(x[0]).encode()) for x in self.deferred)+len(json.dumps(frame).encode())>1048576:raise ResumeWindowExceeded()
            self.deferred.append((frame,source,pending));return
        try:await self._dispatch(frame,accept,source=source,revision=revision,bindings=snapshot)
        except HTTPException as error:
            if error.status_code not in {404,409} or error.detail not in {'CONNECTION_CHANGED','CONNECTION_TARGET_INACTIVE','CONNECTION_NOT_FOUND'}:raise
        if source is self.ws:
            await self._complete(seq)

    def _pending_target(self,frame,bindings):
        if frame.get('t') not in {'MESSAGE_CREATE','INTERACTION_CREATE'}:return None
        data=frame.get('d') or {};channel=data.get('channel_id') or (data.get('channel') or {}).get('id');guild=data.get('guild_id')
        if any((t.guild_id,t.channel_id)==(guild,channel) for t in bindings.values()):return None
        pending=[t for t in self.pending_targets if (None if t.installation_id=='DM' else t.installation_id,t.target_id)==(guild,channel)]
        if len(pending)>1:raise HTTPException(409,'DISCORD_TARGET_AMBIGUOUS')
        return pending[0] if pending else None

    async def _complete(self,seq):
        for checkpoint in self.checkpoints:
            if checkpoint[0]==seq:checkpoint[1]=True
        compact=[]
        for checkpoint in self.checkpoints:
            if checkpoint[1] and compact and compact[-1][1]:compact[-1]=checkpoint
            else:compact.append(checkpoint)
        self.checkpoints=compact
        through=None
        while self.checkpoints and self.checkpoints[0][1]:through=self.checkpoints.pop(0)[0]
        if through is not None:
            source=self.ws;confirmed={**self.cursor,'sequence':through}
            await asyncio.to_thread(self.gate.save_cursor,confirmed)
            if source is self.ws and _session(self.cursor)==_session(confirmed):self.cursor=confirmed

    async def _drain_deferred(self,accept):
        for entry in list(self.deferred):
            frame,source,expected=entry;binding=self.targets.get(expected.id)
            if not await asyncio.to_thread(self.gate.pending_valid,expected):
                await asyncio.to_thread(self.gate.reset_cursor,list(self.targets.values()),'DISCORD_SESSION_INVALID',self.cursor.get('sequence'),self.received_sequence)
                raise RuntimeError('DISCORD_DEFERRED_SCOPE_CHANGED')
            if binding is None:continue
            if source is not self.ws or binding.target!=expected:
                await asyncio.to_thread(self.gate.reset_cursor,list(self.targets.values()),'DISCORD_SESSION_INVALID',self.cursor.get('sequence'),self.received_sequence)
                raise RuntimeError('DISCORD_DEFERRED_SCOPE_CHANGED')
            self._current(binding,source,self.revision)
            await self._dispatch(frame,accept,source=source,revision=self.revision,bindings={expected.id:binding})
            self.deferred.remove(entry);await self._complete(frame['s'])
    async def _dispatch(self,frame,accept,*,source,revision,bindings):
        if frame.get('t') not in {'MESSAGE_CREATE','INTERACTION_CREATE'}:return
        data=frame.get('d')
        if not isinstance(data,dict):raise HTTPException(422,'DISCORD_FRAME_INVALID')
        channel=data.get('channel_id') or (data.get('channel') or {}).get('id');guild=data.get('guild_id')
        targets=[t for t in bindings.values() if (t.guild_id,t.channel_id)==(guild,channel)]
        if len(targets)>1:raise HTTPException(409,'DISCORD_TARGET_AMBIGUOUS')
        if not targets:return
        target=targets[0];binding=target
        self._current(target,source,revision)
        normalized=await asyncio.to_thread(convert_packet,'discord','normalize',{'input':frame,'connection':{'applicationId':binding.application_id,'botUserId':binding.bot_user_id,'guildId':binding.guild_id,'channelId':binding.channel_id,'channelType':binding.channel_type}})
        if normalized is None:return
        if normalized.get('sourceMessageId') is not None:
            normalized['message']=await asyncio.to_thread(self.gate.restore_selection,target.target,normalized)
            self._current(target,source,revision)
        # 모든 이벤트는 Discord snowflake 시각을 사용한다. 클라이언트 시각/ID를 신뢰하지 않는다.
        identifier=data.get('id')
        if not isinstance(identifier,str) or not re.fullmatch('[1-9][0-9]{0,19}',identifier):raise HTTPException(422,'DISCORD_FRAME_INVALID')
        stamp=((int(identifier)>>22)+1420070400000)/1000
        normalized['occurredAt']=datetime.fromtimestamp(stamp,timezone.utc).isoformat()
        context={'application_id':binding.application_id,'bot_user_id':binding.bot_user_id,'guild_id':guild,'channel_id':channel,'generation':target.target.generation}
        interaction=frame['t']=='INTERACTION_CREATE'
        if interaction:
            token=data.get('token')
            if not isinstance(token,str) or not token or len(token)>24000 or any(c.isspace() for c in token):raise HTTPException(422,'DISCORD_CALLBACK_INVALID')
            context.update(interaction_id=identifier,callback_token=token,discord_ack={'status':'pending','expires_at':stamp+3})
        normalized.update(context)
        normalized['destination']={**normalized.get('destination',{}),'application_id':binding.application_id,'bot_user_id':binding.bot_user_id,'guild_id':guild,'channel_id':channel,'channelId':channel,'generation':target.target.generation}
        self._current(target,source,revision)
        committed=await accept(target.target.id,normalized)
        self._current(target,source,revision)
        if committed is None:raise RuntimeError('DISCORD_COMMIT_UNCONFIRMED')
        if interaction:
            reservation=await asyncio.to_thread(self.gate.reserve_ack,committed)
            if reservation is not None:
                self._current(target,source,revision)
                outcome='unknown'
                try:
                    await asyncio.wait_for(asyncio.to_thread(self.adapter.http.ack,reservation.interaction_id,reservation.callback_token),2)
                    outcome='confirmed'
                except asyncio.CancelledError:
                    await asyncio.shield(asyncio.to_thread(self.gate.finish_ack,committed,reservation.claim_id,'unknown'));raise
                except Exception as error:
                    from app.services.channel_connection_discord import DiscordApiRejected
                    if isinstance(error,DiscordApiRejected):outcome='rejected'
                await asyncio.to_thread(self.gate.finish_ack,committed,reservation.claim_id,outcome)

    async def send(self,target,packets,context):
        from app.services.channel_connection_discord import DiscordApiRejected,EMBED
        try:
            binding=self.targets.get(target.id)
            if binding is None or binding.target!=target:raise ValueError()
            self._current(binding,self.ws,self.revision)
            b=binding
            if self.stopped or self.targets.get(target.id)!=binding or (context.get('application_id'),context.get('bot_user_id'),context.get('guild_id'),context.get('channel_id'),context.get('generation'))!=(b.application_id,b.bot_user_id,b.guild_id,b.channel_id,target.generation):raise ValueError()
            if not isinstance(packets,list) or len(packets)>20:raise ValueError()
            bodies=[]
            for packet in packets:
                if not isinstance(packet,dict) or set(packet)-{'channel_id','content','allowed_mentions','embeds','components'} or packet.get('channel_id')!=b.channel_id or len(json.dumps(packet,ensure_ascii=False).encode())>1000000:raise ValueError()
                if packet.get('allowed_mentions')!={'parse':[],'replied_user':False} or packet.get('embeds') and not b.permissions&EMBED:raise ValueError()
                bodies.append({k:v for k,v in packet.items() if k!='channel_id'})
        except (ValueError,TypeError,KeyError):raise HTTPException(409,'DISCORD_SEND_REJECTED') from None
        receipts=[]
        for body in bodies:
            try:
                if self.stopped or self.targets.get(target.id)!=binding:raise ValueError()
                self._current(binding,self.ws,self.revision)
            except (HTTPException,ValueError):
                if not receipts:raise HTTPException(409,'DISCORD_SEND_REJECTED') from None
                raise RuntimeError('DISCORD_SEND_REVOKED') from None
            try:result=await asyncio.to_thread(self.adapter.http.call,'POST','/channels/'+b.channel_id+'/messages',b.credentials['bot_token'],body)
            except DiscordApiRejected:
                if not receipts:raise HTTPException(409,'DISCORD_SEND_REJECTED') from None
                raise RuntimeError('DISCORD_PARTIAL_DELIVERY') from None
            identifier=result.get('id')
            if result.get('channel_id')!=b.channel_id or not isinstance(identifier,str) or not re.fullmatch('[1-9][0-9]{0,19}',identifier):raise RuntimeError('DISCORD_RECEIPT_UNCONFIRMED')
            receipts.append(b.channel_id+':'+identifier)
        return receipts
