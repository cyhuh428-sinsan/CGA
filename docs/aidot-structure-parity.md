# Aidot Structure Parity Rule

Status: binding rule.

## Core Decision

CGA must keep Aidot's structure, functions, system, and API contracts identical by default.

CGA is not a newly designed system that merely references Aidot.
CGA is an Aidot-based reconfiguration where the main change is screen composition and workflow-first user experience.

## What Must Stay Identical

The following must remain the same as Aidot unless Shin-san explicitly approves a joint change:

- repository/application structure direction
- API structure
- request and response shape
- data model meaning
- bot/version/version document structure
- runtime variables
- runtime functions
- simulator behavior
- webchat behavior
- AM/channel behavior
- operations/admin behavior where reused
- build/deploy/runtime assumptions where reused

## What CGA May Change

CGA may change the user-facing composition of Aidot features:

- screen order
- workflow-first navigation
- beginner/guided/advanced exposure
- English-first and multi-language labels
- product name and branding
- grouping of existing Aidot functions into creation steps
- visibility of advanced Aidot functions for beginner users

## What CGA Must Not Do By Default

CGA must not do these by default:

- create a separate `/api/v1/cga/...` management API when Aidot API structure can be used
- create separate CGA-only data models such as `BotSystemDraft`
- create a CGA-only client protocol
- re-implement Aidot from scratch
- copy only the idea while changing the system structure
- introduce backend/background feature work before screen composition is approved

## Implementation Baseline

When implementation starts, use Aidot as the baseline implementation structure.

Working interpretation:

1. Start from Aidot's app/API/runtime structure.
2. Keep API and runtime contracts identical.
3. Reorganize screens around CGA's bot creation workflow.
4. Hide advanced Aidot functions from beginner users, but keep the functions available.
5. Add CGA-specific labels or workflow state only as UI metadata unless approved otherwise.

## Approval Gate

Before any code implementation, the proposal must answer:

- Which Aidot screen/component/API is the base?
- What screen composition changes?
- What remains unchanged?
- Does this alter API/data/runtime/client behavior? Expected answer: no.
- If a change is unavoidable, will Aidot and CGA change together?

## Immediate Correction

Earlier proposal language that suggested separate CGA management APIs, separate draft schemas, or newly invented system structure is superseded by this rule.

## New Feature Development Ban

New feature development is prohibited by default.

CGA work should reorganize Aidot's existing structure and functions into a more usable workflow-first screen composition.

If a new feature appears necessary, the request to Shin-san must explicitly say:

```text
새로운 기능 개발 요청
```

The request must include:

- why the existing Aidot function cannot cover it
- affected Aidot/CGA structure
- API/data/runtime/client impact
- whether Aidot must change together
- what happens if the feature is not added

No implementation may start until Shin-san approves it.
