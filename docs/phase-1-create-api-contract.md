# Phase 1 Create Step: API Contract Proposal

Status: Proposal only. Not implemented.

## Purpose

This document proposes CGA Studio API endpoints for the Create step.

These endpoints manage CGA project draft metadata only.
They must not change Aidot shared client-facing APIs.

## API Namespace

Proposed namespace:

```text
/api/v1/cga/bot-systems
```

Reason:

- CGA project creation is separate from Aidot runtime/webchat APIs.
- The namespace avoids accidental changes to existing Aidot bot, webchat, simulator, or channel contracts.

## Endpoints

### Create Bot System Draft

```http
POST /api/v1/cga/bot-systems
```

Request:

```json
{
  "name": "Customer Support Bot",
  "description": "First draft for a support bot system.",
  "primaryUseCase": "customer_support",
  "defaultLanguage": "en",
  "supportedLocales": ["en"],
  "localePolicy": "single_language",
  "clientTargets": ["web"],
  "orchestratorMode": "decide_later",
  "deploymentIntent": "decide_later"
}
```

Response:

```json
{
  "data": {
    "id": "draft_01HZX000000000000000000000",
    "workspaceId": "workspace_default",
    "name": "Customer Support Bot",
    "description": "First draft for a support bot system.",
    "primaryUseCase": "customer_support",
    "defaultLanguage": "en",
    "supportedLocales": ["en"],
    "localePolicy": "single_language",
    "clientTargets": ["web"],
    "orchestratorMode": "decide_later",
    "deploymentIntent": "decide_later",
    "compatibilityMode": "aidot-compatible",
    "status": "created",
    "createdAt": "2026-06-03T00:00:00.000Z",
    "updatedAt": "2026-06-03T00:00:00.000Z"
  }
}
```

### Update Create Step Draft

```http
PATCH /api/v1/cga/bot-systems/{draftId}/create
```

Purpose:

- Update only Create step metadata.
- Do not modify generated intents, entities, scenarios, answers, or runtime content.

### Get Bot System Draft

```http
GET /api/v1/cga/bot-systems/{draftId}
```

Purpose:

- Load current draft and workflow status.

### List Bot System Drafts

```http
GET /api/v1/cga/bot-systems
```

Purpose:

- Show bot system projects/drafts in CGA Studio.

## Validation Errors

Suggested error shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Bot system name is required.",
    "fields": {
      "name": "required"
    }
  }
}
```

Validation codes:

- `validation_error`
- `duplicate_name`
- `invalid_locale`
- `invalid_client_target`
- `invalid_orchestrator_mode`
- `invalid_deployment_intent`

## Compatibility Response

Every Create response should include:

```json
{
  "compatibilityMode": "aidot-compatible"
}
```

This is project metadata.
It does not alter Aidot client-facing API behavior.

## Capability Detection

Create step does not need runtime capability detection yet.

However, the API should leave room for later capability metadata:

```json
{
  "capabilities": {
    "aidotClientCompatible": true,
    "cgaOptionalExtensions": []
  }
}
```

This field should be optional if added later.

## Shared API Impact Review

Expected result:

```text
No shared compatibility impact.
```

Reason:

- The proposed endpoints are CGA management APIs.
- They do not replace Aidot webchat APIs.
- They do not change simulator APIs.
- They do not change channel runtime APIs.
- They do not change runtime variable or function behavior.

## Prohibited Implementation Choices

Do not implement Create step by changing these shared Aidot endpoints:

- webchat endpoints
- simulator endpoints
- channel runtime endpoints
- runtime variable evaluation
- runtime function execution

If a shared gap is found, use one of the approved patterns:

1. Aidot and CGA joint contract change.
2. Optional CGA extension while preserving Aidot behavior.
3. CGA adapter layer while preserving Aidot-compatible external behavior.

## Open Questions

1. Should CGA management APIs use `/api/v1/cga/...` or a separate service base path?
2. Should draft list include archived/deleted drafts in MVP?
3. Should compatibility capabilities be returned from Create step immediately or deferred until Build Client?
