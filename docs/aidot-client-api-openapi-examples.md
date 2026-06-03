# Aidot Client API OpenAPI-Style Examples

Status: Draft compatibility examples. Not implemented.

## Purpose

This document expands the Aidot client API inventory into OpenAPI-style request and response examples.

CGA must use these examples as compatibility references when:

- CGA-generated Bot Servers support Aidot-compatible clients.
- CGA-produced clients connect to Aidot Bot Servers.
- Optional CGA client features need safe fallback.

## Common Rules

### Success Response Wrapper

```json
{
  "data": {},
  "meta": {
    "request_id": "req_123"
  }
}
```

### Auth Header

```http
X-Aidot-Webchat-Key: <shared-key>
```

If Aidot server has no webchat key configured, the header may be omitted.
If a key is configured, missing or mismatched keys return unauthorized.

## 1. Webchat Bootstrap

```http
GET /api/v1/webchat/bootstrap
```

Response example:

```json
{
  "data": {
    "bots": [
      {
        "id": "bot-uuid",
        "name": "Customer Support Bot",
        "slug": "customer-support-bot",
        "groupId": "group-uuid",
        "groupName": "Default Group",
        "activeVersionId": "version-uuid",
        "activeVersionName": "v1",
        "activeVersionNo": 1,
        "activatedAt": "2026-06-03T00:00:00+00:00"
      }
    ],
    "participants": [
      {
        "id": "visitor",
        "kind": "user",
        "name": "사용자"
      },
      {
        "id": "bot-uuid",
        "kind": "bot",
        "name": "Customer Support Bot",
        "botSlug": "customer-support-bot"
      }
    ]
  },
  "meta": {
    "request_id": "req_123"
  }
}
```

CGA compatibility requirement:

- CGA-produced web clients must be able to read this response from Aidot.
- CGA-generated Bot Servers in Aidot-compatible mode should return equivalent fields.

## 2. Webchat Message

```http
POST /api/v1/webchat/bots/{bot_slug}/rooms/{room_id}/messages
```

Request example:

```json
{
  "message": "What are your business hours?",
  "participant_id": "visitor"
}
```

Response example:

```json
{
  "data": {
    "roomId": "room-001",
    "bot": {
      "id": "bot-uuid",
      "name": "Customer Support Bot",
      "slug": "customer-support-bot"
    },
    "activeVersion": {
      "id": "version-uuid",
      "name": "v1",
      "versionNo": 1
    },
    "userMessage": {
      "participantId": "visitor",
      "text": "What are your business hours?",
      "createdAt": "2026-06-03T00:00:00+00:00"
    },
    "botMessage": {
      "participantId": "bot-uuid",
      "participantKind": "bot",
      "text": "We are open from 9 AM to 6 PM.",
      "createdAt": "2026-06-03T00:00:00+00:00"
    },
    "intent": {
      "id": "intent-uuid",
      "name": "business_hours",
      "score": 100
    }
  },
  "meta": {
    "request_id": "req_124"
  }
}
```

CGA compatibility requirement:

- Do not rename `roomId`, `bot`, `activeVersion`, `userMessage`, `botMessage`, or `intent` in Aidot-compatible mode.
- CGA-only additions must be optional fields.

## 3. AM Session Start

```http
POST /api/v1/am/{bot_id}/session/start
```

Request example:

```json
{
  "channelType": "webchat",
  "clientRoomId": "client-room-001",
  "participantId": "visitor",
  "participantName": "User"
}
```

Response example:

```json
{
  "data": {
    "room": {
      "id": "room-uuid",
      "channelType": "webchat",
      "clientRoomId": "client-room-001",
      "participantId": "visitor",
      "participantName": "User",
      "status": "open"
    },
    "sessionId": "room-uuid",
    "roomId": "room-uuid",
    "channelType": "webchat",
    "initialMessages": []
  },
  "meta": {
    "request_id": "req_125"
  }
}
```

CGA compatibility requirement:

- `sessionId` and `roomId` must both be accepted as session references where Aidot accepts both.
- `channelType` must remain stable.

## 4. AM Chat

```http
POST /api/v1/am/{bot_id}/chat
```

Request example:

```json
{
  "channelType": "webchat",
  "roomId": "room-uuid",
  "message": "I want to book a visit.",
  "participantId": "visitor",
  "sourceTalkNodeId": "talk-node-001"
}
```

Response example:

```json
{
  "data": {
    "sessionId": "room-uuid",
    "roomId": "room-uuid",
    "channelType": "webchat",
    "userMessage": {
      "id": "message-user-uuid",
      "sender": "user",
      "text": "I want to book a visit."
    },
    "botMessage": {
      "id": "message-bot-uuid",
      "sender": "bot",
      "text": "Please select a date."
    },
    "botMessages": [
      {
        "id": "message-bot-uuid",
        "sender": "bot",
        "text": "Please select a date."
      }
    ],
    "runtime": {
      "dialogEnded": false,
      "sessionEnded": false,
      "completionReason": "waiting_for_user",
      "runtimeEvents": []
    }
  },
  "meta": {
    "request_id": "req_126"
  }
}
```

CGA compatibility requirement:

- `botMessage` is the latest bot message.
- `botMessages` is the full list returned for the turn.
- Runtime status fields must keep Aidot meanings.

## 5. AM Dialog Start

```http
POST /api/v1/am/{bot_id}/dialog/start
```

Request example:

```json
{
  "channelType": "webchat",
  "clientRoomId": "client-room-001",
  "message": "Start reservation",
  "participantId": "visitor"
}
```

Response rule:

- Same as AM chat response.
- Adds `started: true`.

## 6. AM Session End

```http
POST /api/v1/am/{bot_id}/session/end
```

Request example:

```json
{
  "channelType": "webchat",
  "roomId": "room-uuid"
}
```

Response example:

```json
{
  "data": {
    "sessionId": "room-uuid",
    "roomId": "room-uuid",
    "channelType": "webchat",
    "ended": true,
    "room": {
      "id": "room-uuid",
      "status": "closed"
    }
  },
  "meta": {
    "request_id": "req_127"
  }
}
```

## 7. Channel Health

```http
GET /api/v1/channels/health
```

Response example:

```json
{
  "data": {
    "status": "ok",
    "channels": ["webchat"]
  },
  "meta": {
    "request_id": "req_128"
  }
}
```

## 8. Channel Connect

```http
POST /api/v1/channels/{channel_type}/connect
```

Request example:

```json
{
  "client_id": "client-001"
}
```

Response rule:

- Returns available active bots for the channel.
- Must use the common success response wrapper.

## 9. Channel Room Create

```http
POST /api/v1/channels/{channel_type}/rooms
```

Request example:

```json
{
  "bot_slug": "customer-support-bot",
  "client_room_id": "client-room-001",
  "participant_id": "visitor",
  "participant_name": "User"
}
```

Response example:

```json
{
  "data": {
    "room": {
      "id": "room-uuid",
      "channelType": "webchat",
      "clientRoomId": "client-room-001",
      "participantId": "visitor",
      "participantName": "User",
      "status": "open"
    },
    "messages": [],
    "initialMessages": []
  },
  "meta": {
    "request_id": "req_129"
  }
}
```

## 10. Channel Message

```http
POST /api/v1/channels/{channel_type}/rooms/{room_id}/messages
```

Request example:

```json
{
  "message": "Hello",
  "participant_id": "visitor",
  "source_talk_node_id": "talk-node-001",
  "defer_processing": false
}
```

Immediate processing response example:

```json
{
  "data": {
    "roomId": "room-uuid",
    "channelType": "webchat",
    "userMessage": {
      "id": "message-user-uuid",
      "sender": "user",
      "text": "Hello"
    },
    "botMessage": {
      "id": "message-bot-uuid",
      "sender": "bot",
      "text": "Hello. How can I help you?"
    },
    "botMessages": [
      {
        "id": "message-bot-uuid",
        "sender": "bot",
        "text": "Hello. How can I help you?"
      }
    ],
    "runtime": {
      "dialogEnded": false,
      "sessionEnded": false,
      "completionReason": "waiting_for_user",
      "runtimeEvents": []
    }
  },
  "meta": {
    "request_id": "req_130"
  }
}
```

Deferred processing response rule:

- `botMessage` is `null`.
- `botMessages` is an empty list.
- Queue event metadata is returned.

## 11. Runtime Contract

Runtime completion reasons:

```text
session_ended
dialog_ended
waiting_for_user
running
```

Template expression pattern:

```text
{{ expression }}
```

Variable convention:

```text
$name
```

Compatibility requirement:

- CGA must keep Aidot runtime function names and meanings in Aidot-compatible mode.
- New CGA runtime functions must be optional and capability-gated.

## Implementation Test Direction

Before CGA implementation, create compatibility tests for:

1. CGA-produced web client -> Aidot `/webchat/bootstrap`
2. CGA-produced web client -> Aidot `/webchat/bots/{bot_slug}/rooms/{room_id}/messages`
3. CGA-produced installed messenger adapter -> Aidot `/am/{bot_id}/chat`
4. Existing Aidot webchat -> CGA-generated Bot Server lightweight webchat endpoint
5. Existing Aidot AM/channel client -> CGA-generated Bot Server channel endpoint

## Open Items

- Convert examples into formal OpenAPI schema after CGA scaffold is chosen.
- Capture real sample responses from a running Aidot server for snapshot tests.
- Define capability metadata for optional CGA-only features.
