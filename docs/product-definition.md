# Product Definition

## Definition

Chatbot Generator Agent is a system that generates bot systems.

CGA Studio is the user-facing builder.
CGA Orchestrator is the open core where the core generation workflow is implemented.

## Product Direction

CGA Studio reconfigures Aidot capabilities into a workflow-first builder.

Aidot:

- Korean-first
- Function-first screens
- Bot authoring and operations console

CGA Studio:

- English-first by default
- Multi-language capable
- Workflow-first screens
- Bot system generation and packaging

## Output

The final output is a bot system package. CGA does not become the chatbot messenger itself:

- Bot Server
- Aidot-compatible Bot Client target/package/adapter configuration
- Runtime Template
- Deployment Manifest
- Orchestrator configuration

## Platform Boundary

CGA Studio is a bot creation and operations platform.
It is not a chatbot messenger.

Therefore, client behavior should remain Aidot-compatible by default.
CGA may package or configure client targets, but it should not create a separate CGA-only messenger protocol unless Shin-san explicitly approves that as a new product scope.

## Shared Runtime and API Contract

CGA Studio may redesign screens and production workflow, but it must not redesign the shared client/runtime contract inherited from Aidot.

Compatibility targets:

- API paths, request shape, response shape, and error shape used by shared clients
- runtime variable names and meanings
- runtime function contracts
- simulator request and response behavior
- webchat connection and message exchange behavior

Reason:

- The same Aidot-compatible chat clients must be able to connect to Aidot and CGA-generated Bot Servers through the same API structure.
- A generated Bot Server should be usable by existing Aidot-compatible clients when it claims Aidot-compatible mode.

Allowed change patterns:

1. Additive extension: add optional fields, endpoints, or capabilities without changing existing behavior.
2. Joint contract change: change Aidot and CGA together and keep webchat/simulator compatible.
3. Adapter layer: keep Aidot-compatible API externally and translate internally inside CGA.

Not allowed without explicit approval:

- Renaming shared API fields
- Changing required runtime variables
- Changing simulator response semantics
- Making webchat require a CGA-only protocol when Aidot-compatible mode is expected

## Bidirectional Client Compatibility

If CGA Studio produces, packages, or configures a bot client, that client must remain Aidot-compatible by default.

Required compatibility:

- Aidot clients -> CGA-generated Bot Server
- CGA-produced clients -> Aidot Bot Server

CGA-specific extensions are allowed only as optional features.
When connected to Aidot, unsupported CGA-specific features must fall back safely or be hidden by capability detection.

## Bot Client Options

Current client deployment targets:

- Web
- Installed Messenger
- Locale Messenger

Locale Messenger uses KakaoTalk only as the Korean locale reference adapter.
Other language communities can port their own messenger adapters.



