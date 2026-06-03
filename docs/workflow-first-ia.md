# Workflow-First IA

CGA Studio screens are organized by bot system creation order, not by Aidot feature menu.

## Workflow

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

## Principle

Aidot capabilities appear as tools inside workflow steps.
They are not exposed as the primary navigation for beginner users.

## Beginner Users

Beginner users should rarely see Aidot-style feature names such as:

- Intent
- Entity
- Dictionary
- Flow
- API

## Advanced Users

Advanced users can open Advanced Builder inside each workflow step.
Advanced Builder exposes Aidot-derived capabilities when needed.

## Compatibility Layer

Workflow-first IA changes the user journey, not the shared client contract.

Even when CGA Studio exposes bot creation by steps, the generated Bot Server must keep Aidot-compatible API behavior because chat clients are shared with Aidot.

This applies especially to:

- Webchat connection APIs
- Simulator APIs
- runtime variable evaluation
- runtime function invocation
- bot response payloads

Advanced Builder may expose Aidot-derived structures directly, but it must not redefine those structures casually.

## Client Placement

CGA Studio may include Build Client and Deploy steps, but these steps do not mean CGA becomes a new messenger.

Those steps prepare Aidot-compatible client deployment targets, adapter settings, and connection configuration so the same client family can connect to Aidot and CGA-generated Bot Servers.

## Build Client Compatibility

The Build Client step may package or configure webchat, installed messenger, or locale messenger targets.

Those targets must remain Aidot-compatible by default.
CGA-produced clients must also be able to connect to Aidot Bot Servers through the same shared client API contract.

If a generated client includes CGA-only optional features, those features must be gated by capability detection and must not break Aidot connection.
