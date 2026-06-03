# Phase 0 Decision Log

## 2026-06-03

Confirmed decisions:

- Product name: CGA Studio
- Open core name: CGA Orchestrator
- Project folder: cga
- CGA creates bot systems.
- Final output is Bot Server + Bot Client.
- Bot Client options are Web, Installed Messenger, Locale Messenger.
- KakaoTalk is Korean locale reference only.
- CGA Studio is English-first and multi-language-first.
- CGA Studio reconfigures Aidot capabilities rather than inventing every feature from scratch.
- Screens and features require Shin-san approval step by step.
- Bot configuration in CGA Studio uses LLM only.
- Training utterance configuration supports Connected LLM and Manual LLM Handoff.
- PDF/Document Q&A intent generation requires Connected LLM.
- After intent generation, each intent must be completed with synonyms, entities, scenario, and answer editing/refinement.
- Evaluation, retraining, and analysis are close to Aidot concepts but may be redesigned for CGA workflow-first UI.
- API structure must remain Aidot-compatible where webchat/simulator shared use is expected.
- Runtime variables, runtime functions, simulator behavior, and webchat connection behavior are shared compatibility targets.
- If a shared structure change is required, Aidot and CGA must either change together, or CGA must add an extension/adapter while preserving the Aidot contract.
- CGA is a bot creation and operations platform, not a chatbot messenger.
- `Bot Client` means Aidot-compatible client deployment target/package/adapter configuration, not a new CGA-only messenger.
- The same Aidot-compatible clients should connect to Aidot and CGA-generated Bot Servers through the same API structure.
- CGA-produced clients must be able to connect to Aidot Bot Servers when they use the Aidot-compatible client contract.
- Client compatibility is bidirectional: Aidot clients -> CGA Bot Server, and CGA-produced clients -> Aidot Bot Server.
- CGA-only optional client features must use capability detection or safe fallback when connected to Aidot.
- CGA must keep Aidot structure, functions, system, and API contracts identical by default.
- CGA is not a new system that merely references Aidot.
- CGA changes screen composition, workflow-first navigation, labels, language, and beginner/advanced exposure.
- Separate CGA API namespaces or data models are not default implementation direction.
- New feature development is prohibited by default.
- If a new feature is unavoidable, the request must explicitly state `새로운 기능 개발 요청` and wait for Shin-san approval before implementation.
