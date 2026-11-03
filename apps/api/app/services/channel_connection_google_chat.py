"""Google Chat 고정 API·서비스계정·공간 신원. 기존 방/큐 연결부가 사용한다."""
from __future__ import annotations
import asyncio,hashlib,json,re,time
from dataclasses import dataclass,field
from datetime import datetime,timezone
from urllib.parse import urlencode
from urllib.request import Request,build_opener
from urllib.error import HTTPError
from uuid import UUID,uuid5,NAMESPACE_URL
import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from fastapi import HTTPException
from app.services.channel_connection_google_chat_auth import GoogleChatAuthenticator,_NoRedirect

OAUTH_URL='https://oauth2.googleapis.com/token'
CHAT_ROOT='https://chat.googleapis.com/v1/'
PROJECT_ROOT='https://cloudresourcemanager.googleapis.com/v1/projects/'


def project_id(value):
    if not isinstance(value,str) or not re.fullmatch('[a-z][a-z0-9-]{4,28}[a-z0-9]',value):raise HTTPException(422,'GOOGLE_CHAT_PROJECT_INVALID')
    return value


def resource_name(value,kind,space=None):
    segment='[A-Za-z0-9_.~-]+'
    pattern='spaces/'+segment if kind=='space' else 'users/'+segment if kind=='user' else 'spaces/'+segment+'/'+kind+'s/'+segment
    if not isinstance(value,str) or not re.fullmatch(pattern,value) or any(v in {'.','..'} for v in value.split('/')) or space is not None and not value.startswith(space+'/'):raise HTTPException(422,'GOOGLE_CHAT_RESOURCE_INVALID')
    return value


@dataclass(frozen=True)
class ServiceAccount:
    project_id:str
    client_email:str=field(repr=False)
    key_id:str=field(repr=False)
    private_key:object=field(repr=False)


def service_account(credentials):
    try:
        raw=credentials.get('service_account_json')
        if not isinstance(raw,str) or not 0<len(raw)<=24000:raise ValueError()
        value=json.loads(raw);project=value['project_id'];email=value['client_email'];keyid=value['private_key_id']
        if value.get('type')!='service_account' or not isinstance(project,str) or not re.fullmatch('[a-z][a-z0-9-]{4,28}[a-z0-9]',project):raise ValueError()
        if credentials.get('project_id',project)!=project or value.get('token_uri')!=OAUTH_URL:raise ValueError()
        if not isinstance(email,str) or not re.fullmatch('[a-zA-Z0-9_-]+@'+re.escape(project)+r'\.iam\.gserviceaccount\.com',email):raise ValueError()
        if not isinstance(keyid,str) or not re.fullmatch('[A-Za-z0-9_-]{1,200}',keyid):raise ValueError()
        key=serialization.load_pem_private_key(value['private_key'].encode(),password=None)
        if not isinstance(key,RSAPrivateKey) or key.key_size<2048:raise ValueError()
        return ServiceAccount(project,email,keyid,key)
    except (ValueError,TypeError,AttributeError,KeyError):raise HTTPException(422,'GOOGLE_CHAT_CREDENTIALS_INVALID') from None


class GoogleChatApiRejected(Exception):
    def __init__(self,status):self.status=status;super().__init__('GOOGLE_CHAT_API_REJECTED')


def _request(method,url,body,token):
    try:
        headers={'Accept':'application/json'}
        if token is not None:headers['Authorization']='Bearer '+token
        if body is not None:headers['Content-Type']='application/x-www-form-urlencoded' if url==OAUTH_URL else 'application/json'
        try:response=build_opener(_NoRedirect()).open(Request(url,data=body,headers=headers,method=method),timeout=5)
        except HTTPError as error:response=error
        with response:
            raw=response.read(1048577)
            if len(raw)>1048576:raise ValueError()
            if response.status in {400,401,403,404,409,429}:raise GoogleChatApiRejected(response.status)
            if not 200<=response.status<300:raise ValueError()
            value=json.loads(raw)
            if not isinstance(value,dict):raise ValueError()
            return value
    except GoogleChatApiRejected:raise
    except Exception:raise HTTPException(503,'GOOGLE_CHAT_TRANSPORT_FAILED') from None


class GoogleChatHttpTransport:
    def __init__(self,*,request=_request):self.request=request
    def oauth(self,identity):
        now=int(time.time());assertion=jwt.encode({'iss':identity.client_email,'scope':'https://www.googleapis.com/auth/chat.bot https://www.googleapis.com/auth/cloudplatformprojects.readonly','aud':OAUTH_URL,'iat':now,'exp':now+3600},identity.private_key,algorithm='RS256',headers={'kid':identity.key_id})
        body=urlencode({'grant_type':'urn:ietf:params:oauth:grant-type:jwt-bearer','assertion':assertion}).encode()
        return self.request('POST',OAUTH_URL,body,None)
    def get(self,path,token):
        resource_name(path,'space')
        return self.request('GET',CHAT_ROOT+path,None,token)
    def get_project(self,project,token):
        return self.request('GET',PROJECT_ROOT+project_id(project),None,token)
    def get_message(self,name,token):
        resource_name(name,'message')
        return self.request('GET',CHAT_ROOT+name,None,token)
    def send(self,space,token,body,request_id,reply_option):
        resource_name(space,'space')
        try:
            if str(UUID(request_id))!=request_id or not isinstance(body,dict) or set(body)-{'text','cardsV2','thread'}:raise ValueError()
            if 'thread' in body:resource_name(body['thread']['name'],'thread',space)
            raw=json.dumps(body,ensure_ascii=False).encode()
            if len(raw)>32000 or reply_option not in {None,'REPLY_MESSAGE_OR_FAIL'}:raise ValueError()
        except (ValueError,TypeError,KeyError):raise HTTPException(422,'GOOGLE_CHAT_PACKET_INVALID') from None
        query={'requestId':request_id}
        if reply_option:query['messageReplyOption']=reply_option
        return self.request('POST',CHAT_ROOT+space+'/messages?'+urlencode(query),raw,token)


def verify_project(http,token,identity,number):
    try:
        value=http.get_project(identity.project_id,token)
        if value.get('projectId')!=identity.project_id or value.get('projectNumber')!=number or value.get('lifecycleState')!='ACTIVE':raise ValueError()
        return identity.project_id
    except (ValueError,TypeError,KeyError,AttributeError,GoogleChatApiRejected):raise HTTPException(403,'GOOGLE_CHAT_PROJECT_VERIFICATION_FAILED') from None


def verify_space(http,token,space,bot):
    resource_name(space,'space');resource_name(bot,'user')
    try:
        value=http.get(space,token)
        if value.get('name')!=space or value.get('spaceType') not in {'DIRECT_MESSAGE','SPACE','GROUP_CHAT'}:raise ValueError()
        return value['spaceType']
    except (ValueError,TypeError,KeyError,AttributeError,GoogleChatApiRejected):raise HTTPException(403,'GOOGLE_CHAT_TARGET_VERIFICATION_FAILED') from None


from sqlalchemy import select
from app.core.config import settings
from app.models import (ChannelConnection,ChannelInstallationLease,ChannelConnectionDelivery,
    ChannelConnectionRoom,ChannelRoom,ChannelMessage,Bot)
from app.services import channel_connection_state as state
from app.services.channel_connections import encrypt_event_context,decrypt_event_context,_cipher
from app.services.channel_connection_supervisor import NativeHandshakePending
from app.services.channel_connection_runtime import ConnectionTarget
from app.services.channel_connection_bridge import convert_packet


class GoogleChatSenderMismatch(RuntimeError):
    def __init__(self):super().__init__('GOOGLE_CHAT_SENDER_VERIFICATION_FAILED')


@dataclass(frozen=True)
class GoogleChatBinding:
    target:ConnectionTarget
    credentials:dict=field(repr=False)
    project_id:str
    space_type:str


class GoogleChatAdapter:
    def __init__(self,sessions,*,owner,config=settings,http=None,authenticator=None):
        self.sessions,self.owner,self.config=sessions,owner,config
        self.http,self.authenticator=http or GoogleChatHttpTransport(),authenticator or GoogleChatAuthenticator()
        self.tokens,self.token_lock={},asyncio.Lock();self.bindings={}

    @staticmethod
    def project(value):
        if not isinstance(value,str) or not re.fullmatch('[1-9][0-9]{0,19}',value):raise HTTPException(422,'GOOGLE_CHAT_CONFIGURATION_INVALID')
        return value

    @staticmethod
    def scope(project):return 'google-chat-project:'+project_id(project)

    async def _token(self,credentials):
        identity=service_account(credentials);key=hashlib.sha256(json.dumps(credentials,sort_keys=True).encode()).hexdigest()
        async with self.token_lock:
            cached=self.tokens.get(key)
            if cached and cached[1]>time.monotonic():return cached[0]
            value=await asyncio.to_thread(self.http.oauth,identity);token=value.get('access_token');expiry=value.get('expires_in')
            if not isinstance(token,str) or not token or len(token)>32768 or any(c.isspace() for c in token) or value.get('token_type','').lower()!='bearer' or type(expiry) is not int or not 60<expiry<=86400:
                raise HTTPException(503,'GOOGLE_CHAT_ACCESS_TOKEN_INVALID')
            self.tokens[key]=token,time.monotonic()+min(expiry,3600)-60
            return token

    def _binding(self,target,lease,data):
        return dict(generation=target.generation,owner=self.owner,fence=lease.fence,
            scope=state._digest([str(target.organization_id),str(target.id),str(target.bot_id),target.installation_id,target.account_id,target.target_id,data]))

    def _seal(self,row,purpose,value):
        version=self.config.channel_connection_key_version
        return dict(ciphertext=encrypt_event_context(value,row.organization_id,row.id,
            self.config.channel_connection_encryption_key,version+':google-chat:'+purpose),key_version=version)

    def _unseal(self,row,purpose,saved):
        return decrypt_event_context(saved['ciphertext'],row.organization_id,row.id,
            self.config.channel_connection_encryption_key,saved['key_version']+':google-chat:'+purpose)

    def _prepare(self,target,kind,project):
        data=dict(project_id=project,space_type=kind)
        with self.sessions() as db:
            row=state._connection(db,target.id,lock=False)
            if ConnectionTarget.from_row(row)!=target:raise HTTPException(409,'CONNECTION_CHANGED')
            state._target_active(db,row)
            lease=state.claim_installation(db,row,self.owner,ttl_seconds=60,listener_scope=self.scope(project),exclusive=True)
            if lease is None:raise HTTPException(409,'GOOGLE_CHAT_APP_SCOPE_IN_USE')
            # PostgreSQL common claim enforces cross-org exclusivity; also fail closed in scoped SQLite QA.
            other=db.scalar(select(ChannelInstallationLease.id).where(ChannelInstallationLease.provider=='google_chat',
                ChannelInstallationLease.listener_scope_hash==lease.listener_scope_hash,
                ChannelInstallationLease.organization_id!=row.organization_id,ChannelInstallationLease.owner.is_not(None),
                ChannelInstallationLease.lease_expires_at>state.clock(db)))
            if other is not None:raise HTTPException(409,'GOOGLE_CHAT_APP_SCOPE_IN_USE')
            row=state._connection(db,target.id)
            if ConnectionTarget.from_row(row)!=target:raise HTTPException(409,'CONNECTION_CHANGED')
            state._target_active(db,row);cursor=dict(lease.cursor_json or {})
            if cursor.get('google_chat_identity_errors',{}).get(str(row.id))==row.generation:raise HTTPException(403,'GOOGLE_CHAT_SENDER_VERIFICATION_FAILED')
            markers=dict(cursor.get('google_chat_bindings',{}));proofs=dict(cursor.get('google_chat_proofs',{}))
            prepared=dict(cursor.get('google_chat_prepared',{}));marker=self._binding(target,lease,data);old=markers.get(str(row.id))
            if old!=marker:
                proofs.pop(str(row.id),None)
                if old is not None or row.accept_after is None:row.accept_after=state.clock(db)
                row.observed_state='connecting'
            elif row.observed_state!='connected':row.observed_state='connecting'
            markers[str(row.id)]=marker;prepared[str(row.id)]=self._seal(row,'binding',dict(binding=marker,data=data))
            cursor.update(google_chat_bindings=markers,google_chat_proofs=proofs,google_chat_prepared=prepared);lease.cursor_json=cursor
            row.lease_owner,row.lease_expires_at=self.owner,lease.lease_expires_at
            saved=proofs.get(str(row.id));ready=False
            if isinstance(saved,dict):
                if self._unseal(row,'handshake',saved)!=dict(binding=marker):raise HTTPException(409,'GOOGLE_CHAT_PROOF_SCOPE_MISMATCH')
                ready=True
            db.commit();return ready,marker

    async def verify(self,target,credentials):
        _cipher(self.config.channel_connection_encryption_key)
        if target.provider!='google_chat':raise HTTPException(422,'GOOGLE_CHAT_CONFIGURATION_INVALID')
        self.project(target.installation_id);resource_name(target.account_id,'user');resource_name(target.target_id,'space')
        identity=service_account(credentials);token=await self._token(credentials)
        project=await asyncio.to_thread(verify_project,self.http,token,identity,target.installation_id)
        kind=await asyncio.to_thread(verify_space,self.http,token,target.target_id,target.account_id)
        ready,marker=await asyncio.to_thread(self._prepare,target,kind,project)
        if not ready:raise NativeHandshakePending()
        self.bindings[target.id]=GoogleChatBinding(target,dict(credentials),project,kind)
        return dict(installation_id=target.installation_id,account_id=target.account_id,listener_scope=self.scope(project),
            exclusive=True,project_id=project,space_type=kind,pending_activation={k:marker[k] for k in ('generation','owner','fence')})

    async def open(self,targets,credentials,identity):return GoogleChatListener(self,targets,credentials)

    def _candidate(self,project):
        with self.sessions() as db:
            return db.scalar(select(ChannelConnection.id).where(ChannelConnection.provider=='google_chat',
                ChannelConnection.installation_id==project,ChannelConnection.desired_state=='connected',ChannelConnection.deleted_at.is_(None)).limit(1))

    def _lookup(self,project,space):
        resource_name(space,'space')
        with self.sessions() as db:
            leases=db.scalars(select(ChannelInstallationLease).where(ChannelInstallationLease.provider=='google_chat',
                ChannelInstallationLease.installation_id==project,ChannelInstallationLease.owner==self.owner,
                ChannelInstallationLease.lease_expires_at>state.clock(db)).with_for_update()).all()
            selected=[]
            for lease in leases:
                cursor=dict(lease.cursor_json or {})
                rows=db.scalars(select(ChannelConnection).where(ChannelConnection.provider=='google_chat',
                    ChannelConnection.organization_id==lease.organization_id,ChannelConnection.installation_id==project,
                    ChannelConnection.target_id==space,ChannelConnection.desired_state=='connected',ChannelConnection.deleted_at.is_(None)).with_for_update()).all()
                for row in rows:
                    state._target_active(db,row)
                    saved=cursor.get('google_chat_prepared',{}).get(str(row.id))
                    if not isinstance(saved,dict):continue
                    value=self._unseal(row,'binding',saved);data=value['data'];marker=self._binding(ConnectionTarget.from_row(row),lease,data)
                    if value.get('binding')!=marker or cursor.get('google_chat_bindings',{}).get(str(row.id))!=marker:continue
                    if lease.listener_scope_hash!=state._listener_scope(row,self.scope(data['project_id'])):continue
                    if cursor.get('google_chat_identity_errors',{}).get(str(row.id))==row.generation:raise HTTPException(403,'GOOGLE_CHAT_SENDER_VERIFICATION_FAILED')
                    selected.append((row.id,row.generation,lease.id,lease.fence,data,marker,ConnectionTarget.from_row(row)))
            if len(selected)!=1:raise HTTPException(403,'GOOGLE_CHAT_TARGET_FORBIDDEN')
            return selected[0]

    def _selection(self,db,row,event):
        try:identifier=UUID(event.get('sourceMessageId'))
        except (ValueError,TypeError,AttributeError):raise HTTPException(422,'GOOGLE_CHAT_SELECTION_INVALID') from None
        scope=[row.provider,row.installation_id,row.account_id,row.target_id,event['nativeRoomKey']]
        source=db.scalar(select(ChannelMessage).join(ChannelRoom,ChannelRoom.id==ChannelMessage.room_id)
            .join(Bot,Bot.id==ChannelRoom.bot_id).join(ChannelConnectionRoom,ChannelConnectionRoom.room_id==ChannelRoom.id)
            .where(ChannelConnectionRoom.connection_id==row.id,ChannelConnectionRoom.native_room_hash==state._digest(scope),
                ChannelMessage.id==identifier,ChannelMessage.participant_kind=='bot',ChannelMessage.channel_type=='google-chat',
                ChannelMessage.deleted_at.is_(None),ChannelRoom.deleted_at.is_(None),ChannelRoom.bot_id==row.bot_id,
                Bot.organization_id==row.organization_id,Bot.deleted_at.is_(None)))
        if source is None or row.accept_after is not None and state._utc(source.created_at)<state._utc(row.accept_after):raise HTTPException(403,'GOOGLE_CHAT_SELECTION_INVALID')
        return convert_packet('google_chat','selection',dict(source=dict(id=str(source.id),participantKind='bot',
            messageType=source.message_type,text=source.text,payload=source.payload_json),event=event))

    def _accept(self,selected,event):
        cid,generation,lid,fence,data,marker,target=selected
        with self.sessions() as db:
            lease=state._installation(db,lid,self.owner,fence);row=state._connection(db,cid)
            if row.generation!=generation or self._binding(ConnectionTarget.from_row(row),lease,data)!=marker:raise HTTPException(409,'CONNECTION_CHANGED')
            state._target_active(db,row)
            if row.organization_id!=lease.organization_id or state._listener_scope(row,self.scope(data['project_id']))!=lease.listener_scope_hash:raise HTTPException(409,'INSTALLATION_SCOPE_MISMATCH')
            cursor=dict(lease.cursor_json or {})
            if cursor.get('google_chat_bindings',{}).get(str(cid))!=marker:raise HTTPException(409,'CONNECTION_CHANGED')
            if cursor.get('google_chat_identity_errors',{}).get(str(cid))==generation:raise HTTPException(403,'GOOGLE_CHAT_SENDER_VERIFICATION_FAILED')
            event=dict(event)
            if 'sourceMessageId' in event:event['message']=self._selection(db,row,event)
            state._event(event)
            proofs=dict(cursor.get('google_chat_proofs',{}));proofs[str(cid)]=self._seal(row,'handshake',dict(binding=marker))
            cursor['google_chat_proofs']=proofs;lease.cursor_json=cursor
            if row.observed_state!='connected':db.commit();return None
            item=state.accept_delivery(db,cid,lid,self.owner,fence,event,key=self.config.channel_connection_encryption_key,
                version=self.config.channel_connection_key_version)
            # 송신 requestId용 UUID는 접수 원입력 hash를 바꾸지 않고 암호문에만 보관한다.
            context=decrypt_event_context(item.context_ciphertext,item.organization_id,item.id,self.config.channel_connection_encryption_key,item.context_key_version)
            if 'google_chat_delivery_id' not in context and 'event' not in context:
                context['google_chat_delivery_id']=str(item.id)
                item.context_ciphertext=encrypt_event_context(context,item.organization_id,item.id,
                    self.config.channel_connection_encryption_key,item.context_key_version)
            result=dict(delivery_id=str(item.id));db.commit();return result

    async def receive(self,authorization,body):
        try:
            parts=authorization.split(' ')
            if len(parts)!=2 or parts[0].lower()!='bearer' or len(authorization)>20000:raise ValueError()
            project=self.project(jwt.decode(parts[1],options={'verify_signature':False})['aud'])
        except (jwt.PyJWTError,ValueError,TypeError,KeyError,AttributeError,HTTPException):raise HTTPException(401,'GOOGLE_CHAT_AUTHENTICATION_FAILED') from None
        if not await asyncio.to_thread(self._candidate,project):raise HTTPException(401,'GOOGLE_CHAT_AUTHENTICATION_FAILED')
        await asyncio.to_thread(self.authenticator.authenticate,authorization,project)
        if body.get('type') not in {'MESSAGE','CARD_CLICKED'}:return dict(ignored=True)
        space=body.get('space')
        if not isinstance(space,dict):raise HTTPException(422,'GOOGLE_CHAT_EVENT_INVALID')
        selected=await asyncio.to_thread(self._lookup,project,space.get('name'));cid,generation,lid,fence,data,marker,target=selected
        event=await asyncio.to_thread(convert_packet,'google_chat','normalize',dict(input=body,
            connection=dict(botUserName=target.account_id,spaceName=target.target_id,spaceType=data['space_type'])))
        if event is None or not event['addressed'] or event['participantKind']!='user':return dict(ignored=True)
        try:
            stamp=datetime.fromisoformat(body['eventTime'])
            if stamp.tzinfo is None:raise ValueError()
        except (ValueError,TypeError,KeyError):raise HTTPException(422,'GOOGLE_CHAT_EVENT_TIME_INVALID') from None
        event['occurredAt']=stamp.astimezone(timezone.utc).isoformat()
        event['destination']=dict(project=project,project_id=data['project_id'],bot=target.account_id,space=target.target_id,
            space_type=data['space_type'],generation=generation,spaceName=event['spaceName'],threadName=event['threadName'])
        deadline=time.monotonic()+5
        while time.monotonic()<deadline:
            result=await asyncio.to_thread(self._accept,selected,event)
            if result is not None:return result
            await asyncio.sleep(.05)
        raise HTTPException(503,'GOOGLE_CHAT_RECEIVER_NOT_READY')


class GoogleChatListener:
    def __init__(self,adapter,targets,credentials):
        self.adapter=adapter
        self.targets=self._targets(targets);self.stopped=asyncio.Event();self.blocked=set()
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

    def record_send_failure(self,db,target,error,installation_id,owner,fence):
        if not isinstance(error,GoogleChatSenderMismatch):return
        lease=state._installation(db,installation_id,owner,fence);row=state._connection(db,target.id)
        if ConnectionTarget.from_row(row)!=target or row.organization_id!=lease.organization_id or row.listener_scope_hash!=lease.listener_scope_hash:raise HTTPException(409,'CONNECTION_CHANGED')
        cursor=dict(lease.cursor_json or {});errors=dict(cursor.get('google_chat_identity_errors',{}));proofs=dict(cursor.get('google_chat_proofs',{}))
        errors[str(row.id)]=row.generation;proofs.pop(str(row.id),None)
        cursor.update(google_chat_identity_errors=errors,google_chat_proofs=proofs);lease.cursor_json=cursor
        row.observed_state,row.last_error_code='error','GOOGLE_CHAT_SENDER_VERIFICATION_FAILED'

    async def _receipt(self,target,result,token):
        name=resource_name(result.get('name'),'message',target.target_id)
        if 'sender' not in result:result=await asyncio.to_thread(self.adapter.http.get_message,name,token)
        sender=result.get('sender')
        if result.get('name')!=name or not isinstance(sender,dict) or sender.get('type')!='BOT' or sender.get('name')!=target.account_id:
            self.blocked.add((target.id,target.generation));raise GoogleChatSenderMismatch()
        return name

    async def send(self,target,packets,event):
        context=event.get('destination',{})
        binding=self.targets.get(target.id)
        if self.stopped.is_set() or binding is None or binding.target!=target or (target.id,target.generation) in self.blocked:raise HTTPException(409,'CONNECTION_CHANGED')
        expected=dict(project=target.installation_id,project_id=binding.project_id,bot=target.account_id,space=target.target_id,generation=target.generation,space_type=binding.space_type)
        if any(context.get(k)!=v for k,v in expected.items()):raise HTTPException(409,'GOOGLE_CHAT_PROOF_SCOPE_MISMATCH')
        kind=context.get('space_type');thread=context.get('threadName')
        if kind not in {'SPACE','GROUP_CHAT','DIRECT_MESSAGE'} or context.get('spaceName')!=target.target_id:raise HTTPException(422,'GOOGLE_CHAT_PACKET_INVALID')
        if thread is not None:resource_name(thread,'thread',target.target_id)
        try:
            did=event['google_chat_delivery_id']
            if str(UUID(did))!=did or not isinstance(packets,list) or len(packets)>20:raise ValueError()
            for packet in packets:
                body=packet['body']
                if set(packet)-{'parent','body','messageReplyOption'} or packet['parent']!=target.target_id or set(body)-{'text','cardsV2','thread'}:raise ValueError()
                if body.get('thread',{}).get('name')!=thread or packet.get('messageReplyOption')!=('REPLY_MESSAGE_OR_FAIL' if thread else None) or len(json.dumps(body,ensure_ascii=False).encode())>32000:raise ValueError()
        except (ValueError,TypeError,KeyError,AttributeError):raise HTTPException(422,'GOOGLE_CHAT_PACKET_INVALID') from None
        token=await self.adapter._token(binding.credentials);receipts=[]
        for index,packet in enumerate(packets):
            if self.stopped.is_set() or self.targets.get(target.id)!=binding or (target.id,target.generation) in self.blocked:raise HTTPException(409,'CONNECTION_CHANGED')
            result=await asyncio.to_thread(self.adapter.http.send,target.target_id,token,packet['body'],
                str(uuid5(NAMESPACE_URL,'cga-google-chat:'+did+':'+str(index))),packet.get('messageReplyOption') if kind=='SPACE' else None)
            receipt=await self._receipt(target,result,token)
            if self.stopped.is_set() or self.targets.get(target.id)!=binding:raise HTTPException(409,'CONNECTION_CHANGED')
            receipts.append(receipt)
        return receipts
