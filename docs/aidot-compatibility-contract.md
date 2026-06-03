# Aidot Compatibility Contract

## Purpose

CGA Studio is a workflow-first bot system generator, but it must preserve key Aidot contracts where shared clients or runtime behavior are expected.

This contract exists so Aidot and CGA can share webchat, simulator, runtime concepts, and API-compatible Bot Server behavior.

## Client Boundary

CGA Studio is a bot creation and operations platform, not a chatbot messenger.

The chat clients are shared Aidot-compatible clients.
CGA-generated Bot Servers must expose the same client-facing API contract when they are expected to support those clients.

`Bot Client` means a deployment target, package, adapter, or connection configuration that follows the Aidot-compatible client contract.

## Compatibility Targets

The following structures are treated as shared contracts:

- API structure
- runtime variables
- runtime functions
- simulator behavior
- webchat connection behavior

## Bidirectional Compatibility

Client compatibility must work in both directions:

1. Existing Aidot clients can connect to CGA-generated Bot Servers.
2. CGA-produced clients can connect to Aidot Bot Servers.

If CGA adds optional client features, those features must use capability detection or safe fallback when connected to Aidot.

## API Rule

The API structure must stay compatible with Aidot when a CGA-generated Bot Server is expected to work with shared webchat or simulator clients.

API compatibility includes:

- endpoint role
- request fields
- response fields
- error shape
- session/message flow
- auth and deployment assumptions where shared

## Change Policy

A shared structure change is allowed only through one of these paths:

1. Aidot and CGA change together under one updated shared contract.
2. Aidot stays unchanged and CGA adds an optional extension.
3. CGA keeps the external Aidot-compatible contract and translates internally through an adapter.

## Prohibited Defaults

The following are not allowed as default implementation choices:

- Rename shared API fields because CGA screens are different.
- Change runtime variable names without a compatibility alias.
- Change simulator payload meaning while keeping the same endpoint.
- Make webchat or messenger clients CGA-only when the generated Bot Server claims Aidot-compatible mode.
- Copy Aidot source wholesale without checking whether the workflow step actually needs it.

## Implementation Review Requirement

Every approved workflow step must explicitly state one of these results:

- No shared compatibility impact.
- Additive CGA extension only.
- Requires Aidot+CGA joint contract change.
- Requires CGA adapter layer while preserving Aidot-compatible API.


