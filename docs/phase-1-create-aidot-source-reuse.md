# Phase 1 Create Step: Aidot Source Reuse Review

Status: Proposal only. Not implemented.

## Purpose

This document identifies Aidot structures that can inform the CGA Create step.

The goal is not to copy Aidot source wholesale.
The goal is to reuse proven concepts, API contracts, data shapes, and runtime compatibility rules where they fit CGA.

## Reuse Rule

CGA is a separate project.
Aidot code should be copied only after a step-specific approval.

Default reuse style:

1. Reuse concept.
2. Reuse API contract where shared clients depend on it.
3. Reuse data semantics where runtime behavior must match.
4. Re-implement UI for CGA workflow-first experience.

## Confirmed Compatibility Targets

The Create step must preserve these Aidot-compatible targets:

- API structure used by shared chat clients
- webchat connection behavior
- simulator behavior
- runtime variables
- runtime functions
- channel message/session flow

## Aidot Files to Inspect Before Implementation

### Bot and Version Model/API

Candidate files:

- `D:\Project\Aidot\apps\api\app\models\studio.py`
- `D:\Project\Aidot\apps\api\app\schemas\bot.py`
- `D:\Project\Aidot\apps\api\app\api\routes\bots.py`
- `D:\Project\Aidot\apps\web\lib\studio-bots-api.ts`
- `D:\Project\Aidot\apps\web\components\bot-create-dialog.tsx`
- `D:\Project\Aidot\apps\web\components\bots-workspace.tsx`

Reuse assessment:

- Reuse bot/version concept.
- Reuse response wrapper style if appropriate.
- Do not expose Aidot bot creation UI directly in CGA Create step.
- Do not store CGA deployment planning metadata inside Aidot `version_json` by default.

### Workspace Shell

Candidate files:

- `D:\Project\Aidot\apps\web\components\studio-workspace-provider.tsx`
- `D:\Project\Aidot\apps\web\components\studio-app-shell.tsx`
- `D:\Project\Aidot\apps\web\components\studio-rail.tsx`
- `D:\Project\Aidot\apps\web\components\bot-workspace-header.tsx`

Reuse assessment:

- Reuse Workspace Shell concept.
- Reuse caching/summary idea where useful.
- Redesign navigation around CGA workflow steps instead of Aidot feature tabs.
- Do not expose function-first IA to beginner users.

### Client/Webchat/Channel Contract

Candidate files:

- `D:\Project\Aidot\apps\api\app\api\routes\webchat.py`
- `D:\Project\Aidot\apps\api\app\api\routes\am.py`
- `D:\Project\Aidot\apps\api\app\api\routes\channels.py`
- `D:\Project\Aidot\apps\api\app\models\channel.py`
- `D:\Project\Aidot\apps\web\app\admin\channels\page.tsx`

Reuse assessment:

- Treat client-facing request/response/session behavior as a compatibility contract.
- CGA-produced clients must connect to Aidot through this contract.
- Aidot clients must connect to CGA-generated Bot Servers through this contract.
- Do not create a CGA-only webchat protocol in Create step.

### Simulator and Runtime Behavior

Candidate files:

- `D:\Project\Aidot\apps\web\components\simulator-page.tsx`
- `D:\Project\Aidot\apps\api\app\services\runtime_variables.py`
- `D:\Project\Aidot\apps\api\app\services\runtime_session.py`
- `D:\Project\Aidot\apps\api\app\services\scenario_validation.py`

Reuse assessment:

- Reuse runtime variable/function meanings as contract.
- Reuse simulator behavior as test contract later.
- Create step itself does not call simulator.
- Later Test step should map more directly to Aidot simulator concepts.

### Section API and Version Document Concepts

Candidate files:

- `D:\Project\Aidot\apps\api\app\core\version_documents.py`
- `D:\Project\Aidot\apps\api\app\core\version_storage.py`
- `D:\Project\Aidot\apps\web\lib\version-document.ts`
- `D:\Project\Aidot\apps\web\lib\studio-bots-api.ts`

Reuse assessment:

- Section API concept should inform CGA editing steps.
- Create step should not require section APIs yet.
- CGA project metadata should remain separate until compiled into runtime artifacts.

## Create Step Reuse Decision

Recommended reuse level for Create step:

| Area | Reuse level | Reason |
| --- | --- | --- |
| Bot/version concept | Concept reuse | CGA draft maps later to bot/version artifacts. |
| Bot create UI | Do not copy | Aidot UI is function-first and Korean-first. |
| Workspace shell | Concept reuse | CGA needs workflow-first shell. |
| Webchat/client API | Contract reuse | Shared clients must work across Aidot and CGA. |
| Simulator/runtime | Contract reuse later | Create step does not simulate, but must not break future compatibility. |
| Section API | Defer | Used in later Configure/Advanced Builder steps. |
| `version_json` | Do not use for CGA metadata by default | Deployment planning metadata is not runtime authoring content. |

## Implementation Guardrails

Before code implementation, confirm:

- Does Create step affect shared client API? Expected: no.
- Does Create step require Aidot code change? Expected: no.
- Does Create step create a CGA-only client protocol? Must be no.
- Does Create step store only CGA draft metadata? Expected: yes.
- Does Create step preserve Aidot-compatible mode? Must be yes.

## Follow-up Reviews

Before implementing later steps, inspect these Aidot areas again:

- Input/Generate: LLM configuration, document processing, intent generation.
- Review/Configure: dialogs, entities, dictionary, flow, API/tool sections.
- Test: simulator and runtime session behavior.
- Build Client: webchat/channel contract and capability detection.
- Operate: admin dashboard, logs, channel status, runtime events.
