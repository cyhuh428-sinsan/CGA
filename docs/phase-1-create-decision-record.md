# Phase 1 Create Step: Decision Record

Status: Working decision record. Not implemented.

## Purpose

This document closes the open Create step questions with conservative working defaults.

These defaults can be changed by Shin-san before implementation.

## Decision 1: Client Target Selection

Question:

- Should `Decide later` be allowed for client targets, or must the user select at least one target?

Working decision:

- Allow `Decide later` for draft creation.
- Recommend at least one client target when the user chooses `Create and Continue`.
- Require at least one client target before Build Client, Package, or Deploy.

Reason:

- Create should be lightweight and should not block early drafting.
- Final bot system output still requires concrete client target decisions.
- Client targets are Aidot-compatible deployment targets, not CGA-only messenger products.

## Decision 2: Primary Use Case Input

Question:

- Should primary use case be a free text field, a preset list, or both?

Working decision:

- Use both preset list and optional free text.

Preset examples:

- Customer Support
- Internal Helpdesk
- FAQ
- Sales Assistant
- Reservation/Booking
- Document Q&A
- Other

Reason:

- Presets help beginner users.
- Free text gives advanced users or unusual projects enough context.
- Primary use case is generator context only and must not become fixed runtime behavior.

## Decision 3: Template Presets

Question:

- Should the Create step include template presets in MVP, or defer them to the Input step?

Working decision:

- Defer template presets to the Input step.

Reason:

- Create should only create the bot system draft.
- Template selection can affect input requirements, generation strategy, and initial content.
- Keeping templates in Input avoids making Create too heavy.

## Create Step Implementation Gate

Before implementation, confirm these working decisions:

1. `Decide later` is allowed for draft-only client target selection.
2. Primary use case uses preset plus optional free text.
3. Template presets are deferred to Input.

## Compatibility Impact

Shared compatibility impact: No shared compatibility impact.

These decisions affect CGA project metadata and UI only.
They do not change Aidot webchat, simulator, channel, runtime variable, or runtime function contracts.
