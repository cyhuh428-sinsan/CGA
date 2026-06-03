# Approval Workflow

CGA Studio development must proceed by approval gates.

## Core Rule

No screen or feature implementation starts without Shin-san approval.

## Why

CGA Studio is a reconfiguration of Aidot capabilities, not a blind new build.
Aidot is function-first and Korean-first.
CGA Studio must be workflow-first and multi-language-first.

## Gate Sequence

1. Define the workflow step.
2. List Aidot capabilities reused in that step.
3. Propose the CGA screen shape.
4. Define user level exposure: Easy, Guided, Advanced, Operations.
5. Define inputs and outputs.
6. Define data/API impact.
7. Verify Aidot API/webchat/simulator compatibility.
8. If an API or runtime contract change is required, classify it as additive extension, Aidot+CGA joint change, or adapter-layer change.
9. Ask Shin-san for approval.
10. Implement only the approved scope.
11. Verify and document result.

## Prohibited Without Approval

- Adding new screens
- Adding new feature behavior
- Copying Aidot source wholesale
- Changing product IA
- Changing output package structure
- Changing orchestrator workflow contract
- Changing shared API structure used by Aidot webchat or simulator
- Renaming shared runtime variables or changing their meaning
- Changing shared runtime function contracts
- Making shared chat clients incompatible with Aidot-compatible Bot Server APIs
- Changing CGA scope into a chatbot messenger product instead of a bot creation and operations platform

## Default Approval Unit

One workflow step equals one approval unit.

Example:

- Create
- Input
- Generate
- Review
- Configure
- Build Server
- Build Client
- Test
- Package
- Deploy
- Operate
- Improve

## Required Compatibility Review

Before each implementation approval, the proposal must state whether the step affects any of these compatibility targets:

- API structure
- runtime variables
- runtime functions
- simulator
- webchat
- whether CGA-produced clients remain able to connect to Aidot

If there is no impact, write `No shared compatibility impact`.
If there is impact, the proposal must choose one approved pattern:

1. Add optional CGA-only extension while preserving Aidot behavior.
2. Change Aidot and CGA together under one updated contract.
3. Keep the external Aidot contract and add an internal CGA adapter.


