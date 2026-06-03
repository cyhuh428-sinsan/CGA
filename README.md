# CGA Studio

CGA Studio is a bot system generator and builder.

It creates deployable bot systems, not just chatbot settings.

Primary outputs:

- Bot Server
- Bot Client
- Runtime Template
- Deployment Manifest
- Orchestrator connection or built-in orchestrator configuration

## Product Names

- Product: CGA Studio
- Open Core: CGA Orchestrator
- Project folder: cga

## Current Rule

CGA Studio is not a from-scratch feature invention project.
It reorganizes Aidot 1.0 capabilities into a workflow-first, multi-language bot system generator.

Screens and features must be approved step by step before implementation.

## Aidot Compatibility Contract

CGA Studio must preserve Aidot-compatible runtime and API contracts because chat clients are shared with Aidot.

The following structures are compatibility targets:

- API structure
- runtime variables
- runtime functions
- simulator behavior
- webchat connection behavior

The API contract is especially important because the same webchat client must be able to connect to both Aidot and CGA-generated bot systems.

If a structure change is required, it must follow one of these paths:

1. Change Aidot and CGA together under the same compatible contract.
2. Keep the Aidot contract unchanged and add CGA-specific extensions without breaking existing clients.

## Client Boundary

CGA Studio is a platform for creating and operating bot systems.
It is not a chatbot messenger product.

When this project says `Bot Client`, it means an Aidot-compatible client deployment target, package, or adapter configuration.
The actual chat clients must follow the same client contract as Aidot so shared webchat, installed messenger, and locale messenger clients can connect to Aidot and CGA-generated Bot Servers through the same API structure.

## Bidirectional Client Compatibility

Any client produced, packaged, or configured by CGA must be able to connect to Aidot when it uses the Aidot-compatible client contract.

This means compatibility works in both directions:

- Existing Aidot clients can connect to CGA-generated Bot Servers.
- CGA-produced clients can connect to Aidot Bot Servers.

CGA-specific optional features must degrade gracefully when connected to Aidot if Aidot does not support those optional extensions.
