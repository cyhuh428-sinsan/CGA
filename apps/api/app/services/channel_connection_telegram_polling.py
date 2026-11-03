"""Telegram polling의 offset/접수 상태를 기존 PostgreSQL lease·원장에 보호 저장한다."""
from __future__ import annotations
import asyncio,json,math,time,hashlib
from dataclasses import dataclass,field
from datetime import datetime,timezone,timedelta
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.orm import object_session
from fastapi import HTTPException
from app.core.config import settings
from app.models import ChannelConnection,ChannelConnectionDelivery,ChannelInstallationLease
from app.services import channel_connection_state as state
from app.services.channel_connections import encrypt_event_context,decrypt_event_context


@dataclass(frozen=True)
class CallbackReservation:
    claim_id:str
    callback_id:str=field(repr=False)


class TelegramState:
    def __init__(self,sessions,*,lease_id,owner,fence,bot_id):self.sessions=sessions;self.lease_id=lease_id;self.owner=owner;self.fence=fence;self.bot_id=bot_id
    def lease(self,db):
        lease=state._installation(db,self.lease_id,self.owner,self.fence)
        if lease.provider!='telegram' or lease.listener_scope_hash!=state._digest(['telegram','verified-listener','telegram-bot:'+self.bot_id]):raise HTTPException(409,'INSTALLATION_SCOPE_MISMATCH')
        return lease
    def _load(self,lease):
        saved=(lease.cursor_json or {}).get('telegram_polling')
        if saved is None:return {'bot_id':self.bot_id,'offset':0,'targets':{},'epoch':0,'last_commit_at':None,'idle_reset_at':None,'last_update_lower_bound':None}
        try:
            if not isinstance(saved,dict) or set(saved)!={'ciphertext','key_version'}:raise ValueError()
            wrapper=decrypt_event_context(saved['ciphertext'],lease.organization_id,lease.id,settings.channel_connection_encryption_key,saved['key_version'])
            if set(wrapper)!={'purpose','value'} or wrapper['purpose']!='telegram-polling':raise ValueError()
            value=wrapper['value']
            required={'bot_id','offset','targets','epoch','last_commit_at','idle_reset_at','last_update_lower_bound'}
            if not isinstance(value,dict) or not required<=set(value) or set(value)-required-{'idle_reset'}:raise ValueError()
            receipt=value.get('idle_reset')
            if receipt is not None:
                if not isinstance(receipt,dict) or set(receipt)!={'reason','recorded_at','previous_offset','epoch','expired_updates_recoverable'} or receipt['reason']!='TELEGRAM_LONG_IDLE' or receipt['expired_updates_recoverable'] is not False or type(receipt['previous_offset']) is not int or not 1<=receipt['previous_offset']<=9007199254740991 or type(receipt['epoch']) is not int or receipt['epoch']!=value['epoch'] or receipt['recorded_at']!=value['idle_reset_at'] or datetime.fromisoformat(receipt['recorded_at']).tzinfo is None:raise ValueError()
            for identifier,proof in value['targets'].items():
                from uuid import UUID
                UUID(identifier)
                if not isinstance(proof,dict) or set(proof)!={'generation','cutoff','ready'} or type(proof['generation']) is not int or proof['generation']<1 or type(proof['ready']) is not bool or datetime.fromisoformat(proof['cutoff']).tzinfo is None:raise ValueError()
        except (KeyError,TypeError,ValueError,AttributeError):raise HTTPException(409,'TELEGRAM_CURSOR_INVALID') from None
        if value.get('bot_id')!=self.bot_id or type(value.get('offset')) is not int or not 0<=value['offset']<=9007199254740991 or not isinstance(value.get('targets'),dict):raise HTTPException(409,'TELEGRAM_CURSOR_INVALID')
        value.setdefault('epoch',0);value.setdefault('last_commit_at',None);value.setdefault('idle_reset_at',None);value.setdefault('last_update_lower_bound',None)
        if type(value['epoch']) is not int or value['epoch']<0:raise HTTPException(409,'TELEGRAM_CURSOR_INVALID')
        for key in ['last_commit_at','idle_reset_at','last_update_lower_bound']:
            if value[key] is not None:
                try:
                    stamp=datetime.fromisoformat(value[key])
                    if stamp.tzinfo is None:raise ValueError()
                except (TypeError,ValueError):raise HTTPException(409,'TELEGRAM_CURSOR_INVALID') from None
        return value
    def _save(self,lease,value):
        cursor=dict(lease.cursor_json or {});version=settings.channel_connection_key_version
        cursor['telegram_polling']={'ciphertext':encrypt_event_context({'purpose':'telegram-polling','value':value},lease.organization_id,lease.id,settings.channel_connection_encryption_key,version),'key_version':version};lease.cursor_json=cursor
    def load_cursor(self):
        with self.sessions() as db:return self._load(self.lease(db))
    def pending_targets(self):
        from app.services.channel_connection_runtime import ConnectionTarget
        with self.sessions() as db:
            lease=self.lease(db)
            rows=db.scalars(select(ChannelConnection).where(ChannelConnection.organization_id==lease.organization_id,
                ChannelConnection.provider=='telegram',ChannelConnection.listener_scope_hash==lease.listener_scope_hash,
                ChannelConnection.desired_state=='connected',ChannelConnection.deleted_at.is_(None)).order_by(ChannelConnection.id).with_for_update()).all()
            result=[]
            for row in rows:
                state._target_active(db,row);result.append(ConnectionTarget.from_row(row))
            return result
    def poll_cursor(self,targets=None):
        from app.models import AuditLog
        with self.sessions() as db:
            lease=self.lease(db);value=self._load(lease)
            if targets is not None:
                from app.services.channel_connection_runtime import ConnectionTarget
                allowed=False
                for target in targets:
                    try:
                        row=state._live(db,target.id,self.lease_id,self.owner,self.fence)
                        allowed=allowed or ConnectionTarget.from_row(row)==target
                    except HTTPException as error:
                        if error.status_code not in {404,409}:raise
                if not allowed:raise HTTPException(409,'TELEGRAM_TARGET_MISSING')
            anchor=value['last_update_lower_bound']
            if value['offset'] and anchor is None:raise HTTPException(409,'TELEGRAM_CURSOR_TIME_UNKNOWN')
            now=state.clock(db)
            # 24h 보관 지연은 발생하한에 포함한다. 60초는 20초 poll/25초 HTTP와 전송 전 5초 여유를 덮는다.
            if value['offset'] and now-datetime.fromisoformat(anchor)>=timedelta(days=7,seconds=-60):
                receipt={'reason':'TELEGRAM_LONG_IDLE','recorded_at':now.isoformat(),'previous_offset':value['offset'],'epoch':value['epoch']+1,'expired_updates_recoverable':False}
                value.update(offset=0,epoch=receipt['epoch'],idle_reset_at=receipt['recorded_at'],idle_reset=receipt,last_update_lower_bound=None)
                self._save(lease,value)
                db.add(AuditLog(action_type='system.connection.telegram_idle_reset',target_type='channel_installation_lease',target_id=lease.id,after_json=receipt));db.commit()
            return {**value,'request_started_at':now.isoformat()}
    def assert_current(self,target=None):
        with self.sessions() as db:
            lease=self.lease(db)
            if target is not None:
                row=state._live(db,target.id,self.lease_id,self.owner,self.fence)
                from app.services.channel_connection_runtime import ConnectionTarget
                if ConnectionTarget.from_row(row)!=target:raise HTTPException(409,'CONNECTION_CHANGED')
    def pending_valid(self,target):
        from app.services.channel_connection_runtime import ConnectionTarget
        with self.sessions() as db:
            lease=self.lease(db)
            try:
                row=state._connection(db,target.id);state._target_active(db,row)
                return ConnectionTarget.from_row(row)==target and row.listener_scope_hash==lease.listener_scope_hash and row.organization_id==lease.organization_id
            except HTTPException as error:
                if error.status_code not in {404,409}:raise
                return False
    def restore_binding(self,binding,pending):
        from app.services.channel_connection_runtime import ConnectionTarget
        if binding.bot_user_id!=self.bot_id or binding.target not in pending:return False
        with self.sessions() as db:
            lease=self.lease(db);value=self._load(lease)
            proof=value['targets'].get(str(binding.target.id))
            if not proof or proof['ready'] is not True or proof['generation']!=binding.target.generation:return False
            try:row=state._live(db,binding.target.id,self.lease_id,self.owner,self.fence)
            except HTTPException as error:
                if error.status_code not in {403,404,409}:raise
                return False
            return ConnectionTarget.from_row(row)==binding.target and row.organization_id==lease.organization_id and row.listener_scope_hash==lease.listener_scope_hash
    def fail_pending(self):
        from app.models import AuditLog
        with self.sessions() as db:
            lease=self.lease(db)
            # local buffer만 폐기한다. offset/epoch는 절대 재설정하지 않는다.
            db.add(AuditLog(action_type='system.connection.telegram_pending_failed',target_type='channel_installation_lease',target_id=lease.id,
                after_json={'reason':'TELEGRAM_PENDING_FAILED','recorded_at':state.clock(db).isoformat()}));db.commit()
    def callback_event(self,target,event):
        # ACK의 가변 상태/claim이 아니라 최초 입력의 deadline만 재구성한다.
        with self.sessions() as db:
            self.lease(db);row=state._live(db,target.id,self.lease_id,self.owner,self.fence)
            if row.generation!=target.generation:raise HTTPException(409,'CONNECTION_CHANGED')
            scope=[row.provider,row.installation_id,row.account_id,row.target_id,event['nativeRoomKey']]
            item=db.scalar(select(ChannelConnectionDelivery).where(ChannelConnectionDelivery.connection_id==row.id,
                ChannelConnectionDelivery.event_key==state._digest([scope,event['eventId']])).with_for_update())
            if item is None:return event
            saved=self.context(item)
            if 'event' in saved:saved=saved['event']
            ack=saved.get('telegram_ack')
            if not isinstance(ack,dict):raise HTTPException(409,'NATIVE_EVENT_CONFLICT')
            return {**event,'occurredAt':saved.get('occurredAt',event.get('occurredAt')),
                'telegram_ack':{**event['telegram_ack'],'expires_at':ack['expires_at']}}
    def restore_selection(self,target,event):
        from uuid import UUID
        from app.models import ChannelConnectionRoom,ChannelRoom,ChannelMessage,Bot
        try:identifier=UUID(event.get('sourceMessageId'))
        except (ValueError,TypeError,AttributeError):raise HTTPException(422,'TELEGRAM_SELECTION_INVALID') from None
        with self.sessions() as db:
            self.lease(db);row=state._live(db,target.id,self.lease_id,self.owner,self.fence)
            if row.generation!=target.generation:raise HTTPException(409,'CONNECTION_CHANGED')
            scope=[row.provider,row.installation_id,row.account_id,row.target_id,event.get('nativeRoomKey')]
            source=db.scalar(select(ChannelMessage).join(ChannelRoom,ChannelRoom.id==ChannelMessage.room_id)
                .join(Bot,Bot.id==ChannelRoom.bot_id).join(ChannelConnectionRoom,ChannelConnectionRoom.room_id==ChannelRoom.id)
                .where(ChannelConnectionRoom.connection_id==row.id,ChannelConnectionRoom.native_room_hash==state._digest(scope),
                    ChannelMessage.id==identifier,ChannelMessage.participant_kind=='bot',ChannelMessage.channel_type=='telegram',
                    ChannelMessage.deleted_at.is_(None),ChannelRoom.deleted_at.is_(None),ChannelRoom.bot_id==row.bot_id,
                    Bot.organization_id==row.organization_id,Bot.deleted_at.is_(None)))
            if source is None or row.accept_after is not None and state._utc(source.created_at)<state._utc(row.accept_after):raise HTTPException(403,'TELEGRAM_SELECTION_INVALID')
            packet={'id':str(source.id),'participantKind':'bot','messageType':source.message_type,'text':source.text,'payload':source.payload_json}
            return convert_packet('telegram','selection',{'source':packet,'event':event})
    def advance(self,update_id,*,request_started_at,targets=()):
        if type(update_id) is not int or not 0<=update_id<9007199254740991:raise HTTPException(422,'TELEGRAM_UPDATE_INVALID')
        with self.sessions() as db:
            lease=self.lease(db);value=self._load(lease)
            from app.services.channel_connection_runtime import ConnectionTarget
            for target in sorted(set(targets),key=lambda t:str(t.id)):
                row=state._live(db,target.id,self.lease_id,self.owner,self.fence)
                if ConnectionTarget.from_row(row)!=target:raise HTTPException(409,'CONNECTION_CHANGED')
            now=state.clock(db)
            try:
                started=datetime.fromisoformat(request_started_at)
                if started.tzinfo is None or started>now:raise ValueError()
            except (ValueError,TypeError):raise HTTPException(409,'TELEGRAM_POLL_TIME_INVALID') from None
            if update_id>=value['offset']:value.update(offset=update_id+1,last_commit_at=now.isoformat(),last_update_lower_bound=(started-timedelta(hours=24)).isoformat())
            self._save(lease,value);db.commit()
    def prepare_targets(self,targets):
        with self.sessions() as db:
            lease=self.lease(db);value=self._load(lease);boundary=0
            for target in sorted(targets,key=lambda t:str(t.target.id)):
                row=state._live(db,target.target.id,self.lease_id,self.owner,self.fence)
                if row.organization_id!=lease.organization_id or row.provider!='telegram' or state._listener_scope(row,'telegram-bot:'+self.bot_id)!=lease.listener_scope_hash:raise HTTPException(409,'INSTALLATION_SCOPE_MISMATCH')
                if row.generation!=target.target.generation:raise HTTPException(409,'CONNECTION_CHANGED')
                try:state._target_active(db,row)
                except HTTPException:continue
                saved=value['targets'].get(str(row.id))
                if isinstance(saved,dict) and saved.get('generation')==row.generation and saved.get('ready') is True:
                    cutoff=datetime.fromisoformat(saved['cutoff'])
                    if cutoff.tzinfo is None:raise HTTPException(409,'TELEGRAM_CURSOR_INVALID')
                else:
                    stamp=math.ceil(state.clock(db).timestamp());cutoff=datetime.fromtimestamp(stamp,timezone.utc);boundary=max(boundary,stamp)
                    value['targets'][str(row.id)]={'generation':row.generation,'cutoff':cutoff.isoformat(),'ready':False}
                row.accept_after=cutoff
            self._save(lease,value);db.commit();return boundary
    def mark_ready(self,targets):
        with self.sessions() as db:
            lease=self.lease(db);value=self._load(lease)
            for target in targets:
                row=state._live(db,target.target.id,self.lease_id,self.owner,self.fence)
                if row.generation!=target.target.generation:raise HTTPException(409,'CONNECTION_CHANGED')
                saved=value['targets'].get(str(target.target.id))
                if isinstance(saved,dict) and saved.get('generation')==target.target.generation:saved['ready']=True
            self._save(lease,value);db.commit()
    def context(self,item):
        return decrypt_event_context(item.context_ciphertext,item.organization_id,item.id,settings.channel_connection_encryption_key,item.context_key_version) if item.context_ciphertext else {}
    def write_context(self,item,value):
        version=settings.channel_connection_key_version;item.context_ciphertext=encrypt_event_context(value,item.organization_id,item.id,settings.channel_connection_encryption_key,version);item.context_key_version=version
    def terminal(self,item,ctx,status,code):
        item.status=status;item.last_error_code=code;ctx.pop('callback_id',None);ctx['telegram_ack']['status']=status;self.write_context(item,ctx)
    def can_execute(self,item):
        if item.status!='received':return False
        ctx=self.context(item);ack=ctx.get('telegram_ack')
        if ack is None:return True
        if ack.get('status')=='confirmed':return True
        deadline=ack.get('expires_at')
        if ack.get('status') in {'pending','sending'} and (type(deadline) not in {int,float} or not math.isfinite(deadline) or deadline<=state.clock(object_session(item)).timestamp()):
            unknown=ack.get('status')=='sending';self.terminal(item,ctx,'unknown' if unknown else 'failed','TELEGRAM_ACK_UNKNOWN' if unknown else 'TELEGRAM_ACK_EXPIRED')
        return False
    def locked(self,db,did,lease):
        initial=db.get(ChannelConnectionDelivery,did)
        if initial is None or initial.organization_id!=lease.organization_id:return None,None
        row=db.scalar(select(ChannelConnection).where(ChannelConnection.id==initial.connection_id).with_for_update())
        item=db.scalar(select(ChannelConnectionDelivery).where(ChannelConnectionDelivery.id==did).with_for_update().execution_options(populate_existing=True))
        if row is None or row.provider!='telegram' or row.organization_id!=lease.organization_id:return None,None
        if row.listener_scope_hash!=lease.listener_scope_hash:raise HTTPException(409,'INSTALLATION_SCOPE_MISMATCH')
        return row,item
    def reserve_ack(self,did):
        with self.sessions() as db:
            lease=self.lease(db);row,item=self.locked(db,did,lease)
            if item is None:return None
            ctx=self.context(item);ack=ctx.get('telegram_ack',{})
            if item.status!='received' or ack.get('status')!='pending':
                if item.status in {'failed','cancelled'} and 'callback_id' in ctx:ctx.pop('callback_id');self.write_context(item,ctx);db.commit()
                return None
            if row.deleted_at is not None or row.generation!=item.generation or row.desired_state!='connected':self.terminal(item,ctx,'cancelled','CONNECTION_CHANGED');db.commit();return None
            state._live(db,row.id,self.lease_id,self.owner,self.fence);self.can_execute(item)
            if item.status!='received':db.commit();return None
            identifier=ctx.get('callback_id')
            if not isinstance(identifier,str) or not 0<len(identifier)<=200:self.terminal(item,ctx,'failed','TELEGRAM_ACK_INVALID');db.commit();return None
            claim=str(uuid4());ack.update(status='sending',claim_id=claim);self.write_context(item,ctx);db.commit();return CallbackReservation(claim,identifier)
    def finish_ack(self,did,claim_id,outcome):
        if outcome not in {'confirmed','unknown','rejected'}:raise ValueError('INVALID_ACK_OUTCOME')
        with self.sessions() as db:
            lease=self.lease(db)
            row,item=self.locked(db,did,lease)
            if item is None:return False
            ctx=self.context(item);ack=ctx.get('telegram_ack',{})
            if item.status!='received' or ack.get('status')!='sending' or ack.get('claim_id')!=claim_id:return False
            if row.deleted_at is not None or row.generation!=item.generation or row.desired_state!='connected':self.terminal(item,ctx,'cancelled','CONNECTION_CHANGED')
            elif outcome=='confirmed':ctx.pop('callback_id',None);ack['status']='confirmed';self.write_context(item,ctx)
            else:self.terminal(item,ctx,'unknown' if outcome=='unknown' else 'failed','TELEGRAM_ACK_UNKNOWN' if outcome=='unknown' else 'TELEGRAM_ACK_REJECTED')
            db.commit();return True
from app.services.channel_connection_bridge import convert_packet


class PollBatch(list):
    """HTTP 요청 시점의 binding·시간·epoch를 await 뒤에도 유지한다."""
    def __init__(self,value,bindings,digest,cursor):
        super().__init__(value);self.bindings=bindings;self.digest=digest;self.cursor=cursor


class TelegramListener:
    def __init__(self,adapter,targets,gate,digest):
        self.adapter=adapter;self.gate=gate;self.digest=digest;self.bot_id=targets[0].bot_user_id
        self.stopped=False;self.buffer=[];self.offset=0;self.epoch=0;self.request_started_at=None
        self.targets={t.target.id:t for t in targets};self.poll_binding=targets[0];self.pending_targets=[];self.deferred=[];self.checkpoints=[]
    def accepts_target(self,target):
        return target.bot_user_id==self.bot_id and hashlib.sha256(target.credentials['bot_token'].encode()).hexdigest()==self.digest
    def can_execute(self,item):return self.gate.can_execute(item)
    def _current(self,binding,digest):
        if self.stopped or digest!=self.digest or self.targets.get(binding.target.id)!=binding or self.adapter.binding(binding.target)!=binding:
            raise HTTPException(409,'CONNECTION_CHANGED')
    async def prepare(self,targets):
        if any(not self.accepts_target(t) for t in targets):raise HTTPException(403,'INSTALLATION_SCOPE_MISMATCH')
        boundary=await asyncio.to_thread(self.gate.prepare_targets,targets)
        if boundary:await asyncio.sleep(max(0,boundary-time.time()))
        if self.stopped:raise HTTPException(409,'TELEGRAM_LISTENER_STOPPED')
        self.targets={t.target.id:t for t in targets}
        self.offset=(await asyncio.to_thread(self.gate.load_cursor))['offset']
    async def update(self,targets):
        bindings=[self.adapter.binding(t) for t in targets]
        digest=self.digest;poll_binding=self.poll_binding
        rotated=[]
        for binding in bindings:
            if self.accepts_target(binding) or self.targets.get(binding.target.id)==binding:continue
            if await asyncio.to_thread(self.gate.restore_binding,binding,self.pending_targets):continue
            rotated.append(binding)
        if rotated:
            for b in rotated:
                previous=self.targets.get(b.target.id)
                if previous is None or b.target.generation<=previous.target.generation or b.bot_user_id!=self.bot_id:
                    raise HTTPException(403,'INSTALLATION_SCOPE_MISMATCH')
            if len({b.credentials['bot_token'] for b in rotated})!=1:raise HTTPException(403,'INSTALLATION_SCOPE_MISMATCH')
            # verify()가 getMe/chat/webhook을 확인한 token만 현행 polling에 적용한다.
            digest=hashlib.sha256(rotated[0].credentials['bot_token'].encode()).hexdigest()
            poll_binding=rotated[0]
            if self.deferred:await self._fail_pending('TELEGRAM_PENDING_SCOPE_CHANGED')
            # 같은 bot의 기존 target은 검증 당시 credential을 유지하고 송신한다.
        boundary=await asyncio.to_thread(self.gate.prepare_targets,bindings)
        if boundary:await asyncio.sleep(max(0,boundary-time.time()))
        await asyncio.to_thread(self.gate.mark_ready,bindings)
        if self.stopped:raise HTTPException(409,'TELEGRAM_LISTENER_STOPPED')
        self.targets,self.digest,self.poll_binding={b.target.id:b for b in bindings},digest,poll_binding
    async def close(self):
        self.stopped=True;self.buffer=[];self.deferred=[];self.checkpoints=[];self.poll_binding=None;self.targets={}
    async def _fail_pending(self,code):
        self.adapter.not_before[self.bot_id]=time.monotonic()+5
        self.buffer=[];self.deferred=[];self.checkpoints=[]
        await asyncio.to_thread(self.gate.fail_pending)
        raise HTTPException(503,code)
    async def poll(self,*,timeout=20):
        from app.services.channel_connection_telegram import TelegramApiRejected
        if self.stopped or not self.targets:raise HTTPException(409,'TELEGRAM_LISTENER_STOPPED')
        digest=self.digest;bindings=dict(self.targets)
        binding=self.poll_binding
        def request():
            prepared=time.monotonic();cursor=self.gate.poll_cursor([b.target for b in bindings.values()])
            if time.monotonic()-prepared>5:raise HTTPException(503,'TELEGRAM_POLL_PREPARATION_EXPIRED')
            value=self.adapter.http.call('getUpdates',binding.credentials['bot_token'],{'offset':cursor['offset'],'limit':100,'timeout':timeout,'allowed_updates':['message','callback_query']})
            return value,{**cursor,'received_at':datetime.now(timezone.utc).isoformat()}
        try:value,cursor=await asyncio.to_thread(request)
        except TelegramApiRejected as error:
            self.adapter.not_before[self.bot_id]=time.monotonic()+max(5,error.retry_after or 5);raise
        if self.stopped or digest!=self.digest:raise HTTPException(409,'CONNECTION_CHANGED')
        await asyncio.to_thread(self.gate.assert_current)
        if not isinstance(value,list) or len(value)>100:raise HTTPException(503,'TELEGRAM_POLL_INVALID')
        self.offset=cursor['offset'];self.epoch=cursor['epoch'];self.request_started_at=cursor['request_started_at']
        return PollBatch(value,bindings,digest,cursor)
    async def listen(self,accept):
        while not self.stopped:
            await self._drain(accept)
            batch=self.buffer;self.buffer=[]
            if not batch:
                digest=self.digest
                try:batch=await self.poll()
                except HTTPException as error:
                    if error.detail=='CONNECTION_CHANGED' and digest!=self.digest and not self.stopped:continue
                    raise
            if not batch:await asyncio.sleep(.05)
            for update in batch:
                if self.stopped:return
                try:await self.handle(update,accept,batch=batch)
                except HTTPException as error:
                    if error.detail!='CONNECTION_CHANGED':raise
    def _pending(self,update,bindings):
        query=update.get('callback_query');message=query.get('message') if isinstance(query,dict) else update.get('message')
        if not isinstance(message,dict) or not isinstance(message.get('chat'),dict):return None
        chat=str(message['chat'].get('id'))
        if any(t.chat_id==chat for t in bindings.values()):return None
        pending=[t for t in self.pending_targets if t.target_id==chat]
        if len(pending)>1:raise HTTPException(409,'TELEGRAM_TARGET_AMBIGUOUS')
        return pending[0] if pending else None
    async def _complete(self,identifier):
        for entry in self.checkpoints:
            if entry[0]==identifier:entry[1]=True
        # 저장 성공 전 메모리 prefix를 제거/전진하지 않는다.
        through=None;count=0
        for entry in self.checkpoints:
            if not entry[1]:break
            through,started=entry[0],entry[2];count+=1
        if through is not None:
            expected=[target for entry in self.checkpoints[:count] for target in entry[3]]
            await asyncio.to_thread(self.gate.advance,through,request_started_at=started,targets=expected)
            if self.stopped:return
            self.offset=max(self.offset,through+1);self.checkpoints=self.checkpoints[count:]
        # pending 뒤의 완료 update는 최대 하나의 범위 끝으로 압축한다.
        compact=[]
        for entry in self.checkpoints:
            if entry[1] and compact and compact[-1][1]:
                entry[3]=list(set(entry[3]+compact[-1][3]));compact[-1]=entry
            else:compact.append(entry)
        self.checkpoints=compact
    async def _drain(self,accept):
        for entry in list(self.deferred):
            update,expected,batch=entry
            if not await asyncio.to_thread(self.gate.pending_valid,expected):
                await self._fail_pending('TELEGRAM_PENDING_SCOPE_CHANGED')
            binding=self.targets.get(expected.id)
            if binding is None:continue
            if binding.target!=expected or batch.digest!=self.digest:
                await self._fail_pending('TELEGRAM_PENDING_SCOPE_CHANGED')
            try:await self.dispatch(update,accept,{expected.id:binding},batch)
            except HTTPException as error:
                definite=error.status_code==422 and error.detail in {'TELEGRAM_EVENT_TIME_INVALID','CHANNEL_PACKET_INVALID','TELEGRAM_SELECTION_INVALID'}
                rejected=error.status_code in {403,404,409} and error.detail in {'TELEGRAM_SELECTION_INVALID','CONNECTION_TARGET_INACTIVE','CONNECTION_NOT_FOUND'}
                if not definite and not rejected:raise
            self.deferred.remove(entry);await self._complete(update['update_id'])
    async def handle(self,update,accept,*,batch=None):
        if self.stopped:raise HTTPException(409,'TELEGRAM_LISTENER_STOPPED')
        identifier=update.get('update_id') if isinstance(update,dict) else None
        if type(identifier) is not int or not 0<=identifier<9007199254740991:raise HTTPException(422,'TELEGRAM_UPDATE_INVALID')
        if batch is None:
            cursor=await asyncio.to_thread(self.gate.poll_cursor)
            batch=PollBatch([],dict(self.targets),self.digest,cursor)
        if batch.digest!=self.digest:raise HTTPException(409,'CONNECTION_CHANGED')
        await asyncio.to_thread(self.gate.assert_current)
        if identifier<self.offset or any(x[0]==identifier for x in self.checkpoints):return
        query=update.get('callback_query');message=query.get('message') if isinstance(query,dict) else update.get('message')
        chat=str((message.get('chat') or {}).get('id')) if isinstance(message,dict) and isinstance(message.get('chat'),dict) else None
        expected=[b.target for b in batch.bindings.values() if b.chat_id==chat]
        self.checkpoints.append([identifier,False,batch.cursor['request_started_at'],expected])
        pending=self._pending(update,batch.bindings)
        if pending is not None:
            self.checkpoints[-1][3]=[pending]
            size=len(json.dumps(update).encode())
            if len(self.deferred)>=64 or sum(len(json.dumps(x[0]).encode()) for x in self.deferred)+size>1048576:
                await self._fail_pending('TELEGRAM_PENDING_LIMIT')
            self.deferred.append((update,pending,batch));return
        try:await self.dispatch(update,accept,batch.bindings,batch)
        except HTTPException as error:
            if error.detail=='CONNECTION_CHANGED':
                self.checkpoints=[x for x in self.checkpoints if x[0]!=identifier]
                raise
            definite=error.status_code==422 and error.detail in {'TELEGRAM_EVENT_TIME_INVALID','CHANNEL_PACKET_INVALID','TELEGRAM_SELECTION_INVALID'}
            disconnected=error.status_code in {403,404,409} and error.detail in {'TELEGRAM_SELECTION_INVALID','CONNECTION_CHANGED','CONNECTION_TARGET_INACTIVE','CONNECTION_NOT_FOUND'}
            if not definite and not disconnected:raise
        await self._complete(identifier)
    async def dispatch(self,update,accept,bindings,batch):
        query=update.get('callback_query');message=query.get('message') if isinstance(query,dict) else update.get('message')
        if not isinstance(message,dict) or not isinstance(message.get('chat'),dict):return
        targets=[b for b in bindings.values() if b.chat_id==str(message['chat'].get('id'))]
        if len(targets)>1:raise HTTPException(409,'TELEGRAM_TARGET_AMBIGUOUS')
        if not targets:return
        binding=targets[0];self._current(binding,batch.digest)
        await asyncio.to_thread(self.gate.assert_current,binding.target)
        normalized=await asyncio.to_thread(convert_packet,'telegram','normalize',{'input':update,'connection':{'botUserId':binding.bot_user_id,'botUsername':binding.bot_username,'chatId':binding.chat_id,'chatType':binding.chat_type}})
        self._current(binding,batch.digest)
        if normalized is None:return
        if batch.cursor['epoch']:normalized['eventId']='telegram-epoch:'+str(batch.cursor['epoch'])+':'+normalized['eventId']
        if isinstance(query,dict):
            normalized['message']=await asyncio.to_thread(self.gate.restore_selection,binding.target,normalized)
            stamp=datetime.fromisoformat(batch.cursor.get('received_at',batch.cursor['request_started_at'])).timestamp()
        else:stamp=message.get('date')
        try:
            if type(stamp) not in {int,float} or not math.isfinite(stamp) or stamp<1:raise ValueError()
            normalized['occurredAt']=datetime.fromtimestamp(stamp,timezone.utc).isoformat()
        except (ValueError,TypeError,OverflowError):raise HTTPException(422,'TELEGRAM_EVENT_TIME_INVALID') from None
        normalized.update(bot_id=self.bot_id,chat_id=binding.chat_id,thread_id=normalized.get('threadId'),generation=binding.target.generation)
        normalized['destination']={**normalized.get('destination',{}),'chatId':binding.chat_id,'threadId':normalized.get('threadId'),'generation':binding.target.generation}
        if isinstance(query,dict):
            callback=query.get('id')
            if not isinstance(callback,str) or not 0<len(callback)<=200:raise HTTPException(422,'TELEGRAM_EVENT_TIME_INVALID')
            normalized.update(callback_id=callback,telegram_ack={'status':'pending','expires_at':stamp+10})
            normalized=await asyncio.to_thread(self.gate.callback_event,binding.target,normalized)
        self._current(binding,batch.digest)
        committed=await accept(binding.target.id,normalized)
        self._current(binding,batch.digest)
        if committed is None:raise RuntimeError('TELEGRAM_COMMIT_UNCONFIRMED')
        if isinstance(query,dict):
            reservation=await asyncio.to_thread(self.gate.reserve_ack,committed)
            if reservation is not None:
                self._current(binding,batch.digest)
                from app.services.channel_connection_telegram import TelegramApiRejected
                outcome='unknown'
                try:
                    result=await asyncio.wait_for(asyncio.to_thread(self.adapter.http.call,'answerCallbackQuery',binding.credentials['bot_token'],{'callback_query_id':reservation.callback_id}),2)
                    if result is True:outcome='confirmed'
                except asyncio.CancelledError:
                    await asyncio.shield(asyncio.to_thread(self.gate.finish_ack,committed,reservation.claim_id,'unknown'));raise
                except TelegramApiRejected:outcome='rejected'
                except Exception:pass
                await asyncio.to_thread(self.gate.finish_ack,committed,reservation.claim_id,outcome)
    async def send(self,target,packets,context):
        binding=self.targets.get(target.id)
        if binding is None or binding.target!=target:raise HTTPException(409,'TELEGRAM_SEND_REJECTED')
        target=binding
        from app.services.channel_connection_telegram import TelegramApiRejected,_id
        try:
            binding=target
            self._current(target,self.digest)
            if self.stopped or self.targets.get(target.target.id)!=target or (context.get('bot_id'),context.get('chat_id'),context.get('generation'))!=(self.bot_id,binding.chat_id,target.target.generation):raise ValueError()
            if not isinstance(packets,list) or len(packets)>20:raise ValueError()
            for packet in packets:
                if not isinstance(packet,dict) or set(packet)!={'method','parameters'} or packet['method'] not in {'sendMessage','sendPhoto'}:raise ValueError()
                p=packet['parameters'];fields={'chat_id','message_thread_id','text','parse_mode','reply_markup'} if packet['method']=='sendMessage' else {'chat_id','message_thread_id','photo','caption','parse_mode','reply_markup'}
                if not isinstance(p,dict) or set(p)-fields or p.get('chat_id')!=binding.chat_id or p.get('message_thread_id')!=context.get('thread_id') or len(json.dumps(packet,ensure_ascii=False).encode())>1000000:raise ValueError()
                if packet['method']=='sendPhoto' and not binding.can_send_photos:raise ValueError()
        except (ValueError,TypeError,KeyError):raise HTTPException(409,'TELEGRAM_SEND_REJECTED') from None
        receipts=[]
        for packet in packets:
            try:
                self._current(target,self.digest)
            except (HTTPException,ValueError):
                if not receipts:raise HTTPException(409,'TELEGRAM_SEND_REJECTED') from None
                raise RuntimeError('TELEGRAM_SEND_REVOKED') from None
            try:result=await asyncio.to_thread(self.adapter.http.call,packet['method'],binding.credentials['bot_token'],packet['parameters'])
            except TelegramApiRejected:
                if not receipts:raise HTTPException(409,'TELEGRAM_SEND_REJECTED') from None
                raise RuntimeError('TELEGRAM_PARTIAL_DELIVERY') from None
            if not isinstance(result,dict) or not isinstance(result.get('chat'),dict) or _id(result['chat'].get('id'))!=binding.chat_id or result.get('message_thread_id')!=context.get('thread_id'):raise RuntimeError('TELEGRAM_RECEIPT_UNCONFIRMED')
            receipts.append(binding.chat_id+':'+_id(result.get('message_id'),positive=True))
        return receipts
