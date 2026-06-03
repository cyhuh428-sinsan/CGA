# Phase 2 Proposal: Input Step

Status: Proposal only. Not implemented.

## Purpose

The Input step collects source materials for bot generation.

It does not generate intents yet.
Generation happens in the Generate step.

## Product Boundary

CGA Studio is a bot creation and operations platform.
It is not a chatbot messenger.

The Input step collects content for a bot system draft.
It must not change Aidot-compatible client APIs, simulator behavior, runtime variables, or runtime functions.

## Workflow Position

Input is step 2 in the CGA workflow:

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

A beginner user should be able to provide bot source material without knowing Aidot terms such as intent, entity, dictionary, flow, or API.

The user should choose one or both input paths:

- Training utterances
- Documents/PDF

## Input Paths

### Path A: Training Utterances

Purpose:

- Collect example user phrases that will later be grouped into intents.

Input methods:

- Paste text
- Upload CSV/TXT
- Add rows manually
- XLSX import can be added later if approved or already easy in the chosen scaffold

Expected fields:

- utterance text
- optional group label
- optional expected intent name
- optional language
- optional note

LLM behavior:

- Connected LLM is optional.
- If Connected LLM exists, Generate step can call it directly.
- If no Connected LLM exists, Generate step can create a Manual LLM Handoff package.

Rules:

- Input step should validate file format and row count.
- Input step should not finalize intent names.
- Input step should not create synonyms, entities, scenarios, or answers.

### Path B: Documents/PDF

Purpose:

- Collect source documents that will later be converted into Q&A intent candidates.

Input methods:

- Upload PDF
- Upload DOCX/TXT/Markdown if supported later
- Attach document metadata

Expected metadata:

- document title
- language
- document type
- source note
- use for Q&A generation flag

LLM behavior:

- Connected LLM is required for PDF/Document Q&A intent generation.
- If Connected LLM is not configured, the user may upload/store documents but Q&A generation must remain blocked until LLM is connected.
- Manual LLM Handoff is not the default path for PDF-to-Q&A generation in MVP because long document extraction and schema validation require controlled processing.

Rules:

- Input step validates file type and size.
- Input step may extract basic metadata if safe.
- Input step should not generate Q&A intents.
- Input step should clearly mark `Ready for Generate` or `Blocked: Connected LLM required`.

## Proposed Screen Shape

Primary screen: Source Input

```text
+--------------------------------------------------------------------------------+
| CGA Studio                                                                     |
| Source Input                                                                   |
|                                                                                |
| [Step Rail]            [Input Source Cards]                    [Readiness]      |
|                                                                                |
|  1 Create              + Training Utterances                  Source Summary    |
|  2 Input               | Paste / Upload / Manual Rows         LLM Status        |
|  3 Generate            | Validation status                    Next Action       |
|  4 Review              + Documents/PDF                                          |
|  5 Configure           | Upload / Metadata / Use for Q&A                         |
|  ...                   | Validation status                                      |
|                                                                                |
|                         [Save Draft] [Continue to Generate]                    |
+--------------------------------------------------------------------------------+
```

## Beginner Mode

Beginner users see two plain choices:

1. Add example questions
2. Upload documents

They should not see these Aidot terms by default:

- Intent
- Entity
- Dictionary
- Scenario
- Flow graph
- API Tool
- RAG index

## Advanced Builder Entry

Advanced users may open advanced input tools later, but MVP Input should keep this minimal.

Candidate advanced tools:

- Import existing Aidot version package
- Import intent/utterance CSV with explicit intent labels
- Map document sections to future intent groups
- Add metadata tags

These are not MVP default UI unless approved separately.

## Data Output

Input step output should attach source batches to the bot system draft.

Suggested data groups:

```text
InputSourceBatch
- id
- draftId
- sourceType: training_utterances | document
- status: uploaded | validated | blocked | ready_for_generate
- language
- itemCount
- fileRefs
- validationIssues
- createdAt
- updatedAt
```

Training utterance item:

```text
TrainingUtteranceInput
- id
- text
- language
- optionalGroupLabel
- optionalExpectedIntentName
- note
```

Document input item:

```text
DocumentInput
- id
- fileRef
- title
- language
- documentType
- useForQaGeneration
- extractionStatus
- llmRequirementStatus
```

## API Proposal

Proposed management API namespace:

```text
/api/v1/cga/bot-systems/{draftId}/input
```

Candidate endpoints:

```text
GET    /api/v1/cga/bot-systems/{draftId}/input
POST   /api/v1/cga/bot-systems/{draftId}/input/utterances
POST   /api/v1/cga/bot-systems/{draftId}/input/documents
PATCH  /api/v1/cga/bot-systems/{draftId}/input/{sourceBatchId}
DELETE /api/v1/cga/bot-systems/{draftId}/input/{sourceBatchId}
POST   /api/v1/cga/bot-systems/{draftId}/input/validate
```

API impact:

- These are CGA management APIs only.
- They do not replace Aidot webchat/channel APIs.
- They do not change runtime behavior.

## LLM Readiness States

Suggested states:

```text
connected_llm_ready
manual_llm_handoff_available
connected_llm_required
blocked_by_missing_llm
```

Usage:

- Training utterances can proceed with `connected_llm_ready` or `manual_llm_handoff_available`.
- Documents/PDF Q&A generation requires `connected_llm_ready`.
- If missing, Documents/PDF path becomes `blocked_by_missing_llm` for generation but may remain saved as input.

## Aidot Capabilities Reused

Concepts reused:

- Bot/version source material concept
- Training utterances
- Document/RAG source concept
- File import validation concept
- Section API mindset for later editing

Not reused directly in Input MVP:

- Aidot function-first intent editor UI
- Entity editor
- Dictionary editor
- Flow designer
- Simulator
- Webchat/channel runtime API

## Compatibility Impact

Shared compatibility impact: No shared compatibility impact.

Input step creates CGA source metadata only.
It must not alter:

- Aidot webchat API
- Aidot AM/channel API
- Aidot simulator behavior
- runtime variable names or functions
- client message payload semantics

## Not Included In This Step

- Intent generation
- PDF-to-Q&A generation
- LLM call execution
- Manual LLM Handoff package generation
- Synonym/entity/scenario/answer editing
- Bot Server build
- Bot Client build
- Runtime simulation

## Approval Questions

1. Should Input allow document upload before a Connected LLM is configured?
2. Should Training Utterances support XLSX in MVP, or only CSV/TXT/manual rows?
3. Should `Import existing Aidot version package` be part of Input MVP or an Advanced Builder feature later?

## Recommended Working Defaults

- Allow document upload before Connected LLM, but mark generation as blocked until LLM is connected.
- Support CSV/TXT/manual rows in MVP; defer XLSX unless spreadsheet import is already easy in the chosen scaffold.
- Defer Aidot version package import to Advanced Builder after basic Input/Generate flow is stable.


