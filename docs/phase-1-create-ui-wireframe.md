# Phase 1 Create Step: UI Wireframe

Status: Proposal only. Not implemented.

## Purpose

This document defines the proposed Create step UI for CGA Studio.

The Create step should let a user start a bot system draft with minimal required input.
It must not expose Aidot internal authoring concepts to beginner users.

## Product Boundary

CGA Studio is a bot creation and operations platform.
It is not a chatbot messenger.

Client selections in this screen mean Aidot-compatible client deployment targets or adapter configuration.
They do not mean CGA is creating a separate CGA-only messenger protocol.

## Screen Name

New Bot System

## Primary Layout

```text
+--------------------------------------------------------------------------------+
| CGA Studio                                                                     |
| New Bot System                                                                 |
|                                                                                |
| [Step Rail]                 [Main Form]                         [Summary]       |
|                                                                                |
|  1 Create                  Basic Information                  Draft Summary     |
|  2 Input                   Language and Locale                 Compatibility    |
|  3 Generate                Client Targets                      Next Step        |
|  4 Review                  Orchestrator Mode                                    |
|  5 Configure               Deployment Intent                                    |
|  6 Build Server                                                                |
|  7 Build Client                                                                |
|  8 Test                                                                        |
|  9 Package                                                                     |
| 10 Deploy                                                                      |
| 11 Operate                                                                     |
| 12 Improve                                                                     |
|                                                                                |
|                         [Cancel] [Save Draft] [Create and Continue]            |
+--------------------------------------------------------------------------------+
```

## Navigation

The left step rail shows the full CGA workflow, but only `Create` is active.
Future steps are visible as a progress guide, not clickable implementation targets unless a draft exists.

Rules:

- `Create` is active.
- `Input` is enabled only after draft creation.
- Later steps are disabled until prerequisites exist.
- Step labels use English by default.
- Locale packs may translate labels later.

## Main Form Sections

### 1. Basic Information

Fields:

- Bot system name
- Short description
- Workspace or owner
- Primary use case

Suggested controls:

- Text input for bot system name
- Textarea for short description
- Select or search input for workspace/owner
- Select for primary use case

Validation:

- Bot system name is required.
- Bot system name must be unique inside the workspace.
- Description is optional.
- Primary use case is generator context only.

Beginner exposure:

- Do not mention intent, entity, dictionary, flow, API, or RAG.

### 2. Language and Locale

Fields:

- Default language
- Additional supported languages
- Locale policy

Suggested controls:

- Select for default language
- Multi-select for additional supported languages
- Radio group for locale policy

Default values:

- Default language: English
- Additional supported languages: none
- Locale policy: Single default language unless user opts into multi-language

Rules:

- Korean can be selected as a locale.
- KakaoTalk is shown only when Korean locale is selected and Locale Messenger is selected.
- Locale Messenger adapter availability is locale-dependent.

### 3. Client Targets

Options:

- Web
- Installed Messenger
- Locale Messenger

Suggested controls:

- Checkbox group
- Each option has a small compatibility note

Rules:

- User can select one or more targets.
- At least one target is recommended, but `Decide later` can be allowed for draft-only creation.
- All selected targets must use the Aidot-compatible client contract by default.
- CGA-produced clients must connect to Aidot Bot Servers.
- Existing Aidot clients must connect to CGA-generated Bot Servers in Aidot-compatible mode.

### 4. Orchestrator Mode

Options:

- Built-in Orchestrator Container
- Existing Orchestrator Connection
- Decide Later

Suggested controls:

- Segmented control or radio cards

Rules:

- Built-in means CGA will later include an orchestrator container in generated deployment planning.
- Existing means the next setup must capture endpoint and auth reference.
- Decide Later creates a draft without deployment binding.

### 5. Deployment Intent

Options:

- Same host as Bot Server
- Separate Bot Server host
- Managed or external orchestrator
- Decide later

Suggested controls:

- Radio group

Rules:

- This does not generate deployment artifacts yet.
- This stores planning metadata used by Package and Deploy steps later.

## Right Summary Panel

The summary panel should show:

- Bot system name
- Default language
- Selected client targets
- Orchestrator mode
- Compatibility mode
- Next enabled step

Compatibility mode should show:

```text
Aidot-compatible client/API contract
```

## Empty and Error States

Required states:

- Name missing
- Duplicate name
- Invalid locale/client combination
- Existing orchestrator selected but not configured yet
- Draft save failure

Behavior:

- Validation messages should be local to the field.
- A top summary may show the number of unresolved issues.
- Do not expose internal stack traces.

## Primary Actions

### Save Draft

Creates or updates the draft and stays on the Create step.

### Create and Continue

Creates the draft and moves to the Input step.

### Cancel

Returns to the bot system list or project dashboard.

## Advanced Entry

No Advanced Builder is required in the Create step MVP.

If needed later, an advanced section may expose:

- Internal project key
- Compatibility mode override
- Template preset
- Metadata tags

These must remain optional and hidden from beginner users.

## Compatibility Impact

Shared compatibility impact: No shared client API change expected.

The screen creates CGA project metadata only.
It must not alter Aidot webchat, simulator, runtime variable, runtime function, or channel API behavior.

## Approval Questions

1. Should `Decide later` be allowed for client targets, or must the user select at least one target?
2. Should primary use case be a free text field, a preset list, or both?
3. Should the Create step include template presets in MVP, or defer them to the Input step?
