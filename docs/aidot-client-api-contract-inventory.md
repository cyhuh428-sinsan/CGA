# Aidot Client API Contract Inventory

Status: Draft compatibility inventory. Not implemented.

## Purpose

This document lists Aidot client-facing API contracts that CGA must preserve when CGA-generated Bot Servers or CGA-produced clients claim Aidot-compatible mode.

The inventory is based on current Aidot source files:

- `D:\Project\Aidot\apps\api\app\api\routes\webchat.py`
- `D:\Project\Aidot\apps\api\app\api\routes\am.py`
- `D:\Project\Aidot\apps\api\app\api\routes\channels.py`
- `D:\Project\Aidot\apps\api\app\core\responses.py`
- `D:\Project\Aidot\apps\api\app\services\runtime_variables.py`
- `D:\Project\Aidot\apps\api\app\services\runtime_session.py`

## Global Response Shape

Aidot success responses use this wrapper:

```json
{
  "data": {},
  "meta": {
    "request_id": ""
  }
}
```

CGA-compatible client APIs should preserve this shape unless a joint Aidot+CGA contract change is approved.

## Auth Header

Client/channel APIs use:

```text
X-Aidot-Webchat-Key
```

Rules:

- If server-side key is empty, requests are allowed.
- If server-side key exists, missing or mismatched header returns unauthorized.
- CGA-compatible Bot Servers should support the same header for Aidot-compatible mode.

## Webchat Lightweight API

Source file:

- `D:\Project\Aidot\apps\api\app\api\routes\webchat.py`

### GET /api/v1/webchat/bootstrap

Purpose:

- List active webchat bots and participants.

Response data fields:

- `bots`
- `participants`

Bot fields currently include:

- `id`
- `name`
- `slug`
- `groupId`
- `groupName`
- `activeVersionId`
- `activeVersionName`
- `activeVersionNo`
- `activatedAt`

Participant fields currently include:

- `id`
- `kind`
- `name`
- `botSlug` for bot participants

### POST /api/v1/webchat/bots/{bot_slug}/rooms/{room_id}/messages

Request body:

```json
{
  "message": "hello",
  "participant_id": "visitor"
}
```

Rules:

- `message` is required, 1 to 4000 chars.
- `participant_id` is optional, max 120 chars.

Response data fields:

- `roomId`
- `bot`
- `activeVersion`
- `userMessage`
- `botMessage`
- `intent`

Compatibility notes:

- CGA-produced web clients must be able to call this endpoint when connected to Aidot.
- CGA-generated Bot Servers should expose this behavior when supporting Aidot lightweight webchat mode.

## AM Compatibility API

Source file:

- `D:\Project\Aidot\apps\api\app\api\routes\am.py`

Base request fields:

- `channelType`, default `webchat`
- `clientRoomId`
- `participantId`, default `visitor`
- `participantName`, default user display name

### POST /api/v1/am/{bot_id}/rooms

Purpose:

- Create or resolve a room/session for a bot and channel.

Response data fields include:

- `sessionId`
- `roomId`
- `channelType`
- `room`

### POST /api/v1/am/{bot_id}/session/start

Purpose:

- Start or reuse a session.

Request may include:

- `roomId`
- `sessionId`
- `clientRoomId`

Response data fields include:

- `sessionId`
- `roomId`
- `channelType`
- `initialMessages`

### POST /api/v1/am/{bot_id}/chat

Purpose:

- Send one chat message through the AM compatibility layer.

Request fields include:

- `roomId` or `sessionId` or `clientRoomId`
- `message`
- `sourceTalkNodeId`
- base participant/channel fields

Response data fields include:

- `sessionId`
- `roomId`
- `channelType`
- fields returned by channel message processing

### POST /api/v1/am/{bot_id}/dialog/start

Purpose:

- Start session and immediately send first message.

Response data fields include:

- normal chat response fields
- `started: true`

### POST /api/v1/am/{bot_id}/session/end

Purpose:

- End an open session.

Response data fields include:

- `sessionId`
- `roomId`
- `channelType`
- `ended: true`
- `room`

Compatibility notes:

- AM endpoints are important for installed messenger or adapter-style clients.
- CGA clients should not invent a separate session API when this contract is sufficient.

## Channel Runtime API

Source file:

- `D:\Project\Aidot\apps\api\app\api\routes\channels.py`

Request models:

```text
ChannelConnectRequest
- client_id

ChannelRoomCreateRequest
- bot_slug
- client_room_id
- participant_id
- participant_name

ChannelMessageRequest
- message
- participant_id
- source_talk_node_id
- defer_processing
```

### GET /api/v1/channels/health

Response data fields:

- `status`
- `channels`

### POST /api/v1/channels/{channel_type}/connect

Purpose:

- Connect a client/channel and list available active bots.

### GET /api/v1/channels/{channel_type}/bots

Purpose:

- List active bots for a channel.

### POST /api/v1/channels/{channel_type}/rooms

Purpose:

- Create a channel room.

Response data fields include:

- `room`
- `messages`
- `initialMessages`

### GET /api/v1/channels/{channel_type}/rooms

Purpose:

- List channel rooms.

### GET /api/v1/channels/{channel_type}/rooms/{room_id}

Purpose:

- Read a room and its messages.

Response data fields include:

- `room`
- `messages`

### DELETE /api/v1/channels/{channel_type}/rooms/{room_id}

Purpose:

- Close/archive a client room.

Response data fields:

- `roomId`
- `deleted`

### POST /api/v1/channels/{channel_type}/rooms/{room_id}/messages

Purpose:

- Send a channel message and receive bot messages.

Response data fields include:

- `roomId`
- `channelType`
- `userMessage`
- `botMessage`
- `botMessages`
- `runtime`

Runtime fields currently include:

- `dialogEnded`
- `sessionEnded`
- `completionReason`
- `runtimeEvents`

### POST /api/v1/channels/{channel_type}/queues/process

Purpose:

- Process queued channel runtime events.

Compatibility notes:

- This is the richer shared runtime channel contract.
- CGA-generated Bot Servers should preserve this contract for Aidot-compatible channel clients.

## Runtime Variable and Function Contract

Source file:

- `D:\Project\Aidot\apps\api\app\services\runtime_variables.py`

Variable rules:

- Variable keys are normalized with `$` prefix.
- Variables can be accessed by direct name or `$name`.
- Object path access is supported.
- Template rendering uses `{{ expression }}`.

Supported function categories include:

- value helpers: `target`, `value`, `default`, `empty`, `notempty`, `toString`, `toNumber`, `toBoolean`
- collection helpers: `size`, `at`, `first`, `last`, `range`
- text helpers: `splitBy`, `concat`, `contains`, `substring`, `trim`, `lower`, `upper`, `replace`, `equals`, `startsWith`, `endsWith`, `matches`
- math helpers: `add`, `sub`, `multi`, `div`
- date helpers: `year`, `month`, `day`, `hour`, `format`, `addDays`, `diffDays`, `before`, `after`
- object helpers: `get`, `exists`, `jsonPath`

Compatibility notes:

- CGA must not rename or change these functions in Aidot-compatible mode.
- Optional CGA additions must be additive and capability-gated.

## Runtime Session Contract

Source file:

- `D:\Project\Aidot\apps\api\app\services\runtime_session.py`

Known runtime completion reasons:

- `session_ended`
- `dialog_ended`
- `waiting_for_user`
- `running`

Compatibility notes:

- CGA should preserve these meanings in channel runtime responses.

## CGA Change Policy

When CGA needs a new client capability:

1. Prefer optional extension fields.
2. Keep existing Aidot fields and meanings unchanged.
3. Add capability detection before exposing CGA-only client behavior.
4. If behavior must change, change Aidot and CGA together under a shared contract.

## Open Follow-up

This inventory is a first contract map.
Before implementation, each endpoint should be tested against a real Aidot webchat/client flow and then converted into formal OpenAPI-style examples.
