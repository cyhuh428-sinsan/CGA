# Phase 1 Proposal: Create Step

Status: Proposal only. Not implemented.

## Purpose

The Create step starts a new bot system project in CGA Studio.

It should collect only the minimum information needed to create a bot project draft and prepare the next workflow steps.

CGA Studio is a bot creation and operations platform, not a chatbot messenger.
Therefore, client selections in this step mean Aidot-compatible client deployment targets, not CGA-only messenger products.

## Approval Rule

This document is an approval proposal.
No screen, API, database, or source implementation should start until Shin-san approves this step.

## Workflow Position

Create is step 1 in the CGA workflow:

1. Create
2. Input
3. Generate
4. Review
5. Configure
6. Build Server
7. Build Client
8. Test
9. Package
10. Deploy
11. Operate
12. Improve

## User Goal

A user should be able to create a bot system draft without understanding Aidot internal terms such as intent, entity, dictionary, flow, or API.

Advanced settings can be opened later inside Guided or Advanced Builder flows.

## Proposed Screen Shape

Primary screen: New Bot System

Main areas:

- Basic information
- Language and locale
- Client targets
- Orchestrator mode
- Deployment intent
- Compatibility summary

The screen should feel like a production setup step, not a marketing landing page.

## Basic Information

Fields:

- Bot system name
- Short description
- Workspace or project owner
- Primary use case

Rules:

- Name is required.
- Description is optional.
- Primary use case is used only as generator context, not as a fixed runtime behavior.

## Language and Locale

Fields:

- Default language
- Additional supported languages
- Locale policy

Defaults:

- English-first UI and project terminology
- Multi-language capable configuration
- Korean can be selected as a locale

Rules:

- KakaoTalk is available only as Korean locale reference adapter.
- Other locale messenger adapters are not created automatically in MVP.

## Client Targets

Options:

- Web
- Installed Messenger
- Locale Messenger

Rules:

- User can select one or multiple targets.
- Selected targets are Aidot-compatible client deployment targets.
- CGA-produced clients must be able to connect to Aidot Bot Servers through the shared client API contract.
- Existing Aidot clients must be able to connect to CGA-generated Bot Servers when Aidot-compatible mode is enabled.

## Orchestrator Mode

Options:

- Built-in Orchestrator Container
- Existing Orchestrator Connection
- Decide Later

Rules:

- Built-in means CGA will include an orchestrator container in the generated deployment plan.
- Existing means CGA will store connection settings for an existing orchestrator.
- Decide Later creates the project draft without final deployment binding.

## Deployment Intent

Options:

- Same host as Bot Server
- Separate Bot Server host
- Managed or external orchestrator
- Decide later

Rules:

- This is an intent, not the final deployment manifest.
- Final deployment details are completed in Package and Deploy steps.

## Aidot Capabilities Reused

Concepts reused from Aidot:

- Bot project
- Bot version
- Bot settings
- Workspace Shell concept
- Runtime variables and functions
- Simulator concept
- Webchat/client API contract

Concepts not exposed to beginners in this step:

- Intent
- Entity
- Dictionary
- Flow
- API/Tool
- RAG details

## Data Output

Create step output should be a bot system draft.

Draft fields:

- project id
- bot system name
- description
- default language
- supported locales
- selected client targets
- orchestrator mode
- deployment intent
- compatibility mode: Aidot-compatible
- draft status: Created

## API and Compatibility Impact

Shared compatibility impact: No shared client API change expected.

Required contract:

- Do not change Aidot webchat API structure.
- Do not change simulator payload semantics.
- Do not rename runtime variables or runtime functions.
- Do not create a CGA-only client protocol for this step.

If later implementation requires new fields, they must be optional CGA extensions or internal CGA project metadata.

## Existing Aidot Impact

Expected Aidot impact: none.

This step should not require Aidot code changes unless a shared contract gap is found.
If a shared contract gap is found, it must be handled through one of these paths:

1. Aidot and CGA change together under one shared contract.
2. CGA adds an optional extension while preserving Aidot behavior.
3. CGA uses an internal adapter while keeping Aidot-compatible external behavior.

## Not Included In This Step

- Intent generation
- PDF analysis
- Manual LLM Handoff
- Scenario authoring
- Answer writing
- Bot Server build
- Bot Client build
- Deployment manifest generation
- Runtime test
- Operations dashboard

## Approval Request

Approve this Create step scope before implementation.

After approval, the next work should be:

1. Create step UI wireframe.
2. Create step data schema.
3. Create step API contract proposal.
4. Source reuse review from Aidot.
