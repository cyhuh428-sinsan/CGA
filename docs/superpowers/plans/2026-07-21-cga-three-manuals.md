# CGA Three Manuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 실제 CGA 화면과 기능을 기준으로 사용자 설명서, 초보자용 Getting Started, ML·Semantic·LLM NLU 활용 가이드의 Markdown 초안을 작성한다.

**Architecture:** 세 문서는 `docs/manual/` 아래에 독립 디렉터리로 둔다. 사용자 설명서는 전체 기능과 운영 절차를 담당하고, Getting Started는 첫 테스트까지의 짧은 성공 경로를 담당하며, NLU 가이드는 세 엔진의 설정·데이터·학습·검증·품질 개선을 담당한다. 공통 용어와 엔진 비교표는 각 문서의 중복을 최소화하면서 동일한 명칭을 유지한다.

**Tech Stack:** Markdown, 기존 CGA Next.js 화면·문서·캡처 자료, 링크 검증용 `rg` 및 PowerShell.

## Global Constraints

- 본문에는 CGA에서 실제 확인된 기능만 확정적으로 작성한다.
- Aidot, Getting Started, NLU 활용 가이드는 참고자료이며 CGA 기능의 근거로 단독 사용하지 않는다.
- ML·Semantic·LLM의 설명은 현재 CGA의 화면·API·실행 가능 범위를 확인한 뒤 확정한다.
- Getting Started는 `목적 → 조작 → 예상 결과` 형식을 사용한다.
- 기존 `docs/manual/` 자료와 다른 작업자의 변경사항을 삭제·이동·일괄 정리하지 않는다.
- Markdown 원본을 먼저 작성하고 Word/PDF 변환은 초안 검토 후 진행한다.

## File Map

- Create: `docs/manual/cga-user-manual/README.md` — 전체 사용자·운영자 설명서의 진입점과 목차
- Create: `docs/manual/cga-getting-started/README.md` — 최초 사용자를 위한 첫 테스트 안내
- Create: `docs/manual/cga-nlu-guide/README.md` — ML·Semantic·LLM 전문 활용 가이드
- Create: `docs/manual/cga-nlu-guide/engine-comparison.md` — 세 엔진 공통 비교표와 선택 기준
- Create: `docs/manual/cga-manual-verification-matrix.md` — 메뉴·엔진·문서 수록 상태 검증표

### Task 1: Create the verification matrix

**Files:**
- Create: `docs/manual/cga-manual-verification-matrix.md`
- Inspect: `apps/web/components/admin-console-layout.tsx`, `apps/web/components/bot-create-dialog.tsx`, `apps/web/components/bot-settings-page.tsx`, `apps/web/components/analysis-page.tsx`, `apps/web/lib/nlu-options.ts`, `apps/web/lib/answer-options.ts`

**Interfaces:**
- Consumes: current menu labels, engine options, answer options, and analysis labels from the listed CGA files.
- Produces: a review table with columns `문서`, `기능/단계`, `근거 파일 또는 화면`, `확인 수준`, `수록 여부`, `주의사항`.

- [ ] **Step 1: Extract current menu and engine labels**

Run:

```powershell
rg -n --glob '!**/.next/**' --glob '!**/node_modules/**' 'label:|title:|ML|Semantic|LLM|학습|분석|평가' apps/web/components apps/web/lib
```

Expected: current labels and source locations are available for the matrix.

- [ ] **Step 2: Write the matrix**

Record only source-confirmed items as `부분 확인` until a real browser interaction confirms the visible screen and action result. Keep unconfirmed items as `미수록`.

- [ ] **Step 3: Review the matrix**

Run:

```powershell
rg -n 'TODO|TBD|미정|추후 결정' docs/manual/cga-manual-verification-matrix.md
```

Expected: no placeholder or unresolved status text remains.

### Task 2: Write the user manual

**Files:**
- Create: `docs/manual/cga-user-manual/README.md`

**Interfaces:**
- Consumes: `docs/manual/cga-manual-verification-matrix.md` and current CGA menu labels.
- Produces: a standalone user-facing manual with links to Getting Started and NLU guide.

- [ ] **Step 1: Write the document front matter and audience**

Include purpose, target users, document conventions, and the rule that only confirmed CGA functions are described as available.

- [ ] **Step 2: Add the common start section**

Cover login, common layout, navigation, search/filter patterns, save/apply behavior, loading, empty, and error states only where confirmed by CGA screens.

- [ ] **Step 3: Add user and operator workflow sections**

Use the approved order: general user flow first, then bot/version, conversation design, intent/entity/dictionary, testing/analysis/evaluation, channel/bot station, and administration.

- [ ] **Step 4: Add a fixed menu-entry template**

For every included menu use: `목적`, `접근 경로`, `화면 구성`, `사용 절차`, `저장·적용 결과`, `주의사항`, `관련 문서`.

- [ ] **Step 5: Validate links and unsupported claims**

Run:

```powershell
rg -n 'TODO|TBD|미정|추후 결정|localhost|127\.0\.0\.1|http://' docs/manual/cga-user-manual/README.md
```

Expected: no placeholders or browser API-address instructions are present; internal documentation links resolve to files created by this plan or existing reference files.

### Task 3: Write Getting Started

**Files:**
- Create: `docs/manual/cga-getting-started/README.md`
- Reference: `docs/manual/Getting Started`, `docs/manual/aidot-user-manual`

**Interfaces:**
- Consumes: verification matrix, current CGA create/settings/test screens, and reference Getting Started visual style.
- Produces: a first-time path from login to first test result.

- [ ] **Step 1: Write the learner promise and prerequisites**

State the expected outcome, required access, sample data requirements, and the fact that advanced NLU operation is documented separately.

- [ ] **Step 2: Write the common path**

Use one action per step and the fixed pattern `목적 → 조작 → 예상 결과`. Cover login, create bot, basic information, engine selection, minimum data, run learning/indexing, test, and result confirmation.

- [ ] **Step 3: Add the three engine branches**

For ML, Semantic, and LLM independently describe minimum input, execution action, expected success state, and link to the NLU guide. Do not assert an engine branch as executable until the matrix marks it confirmed.

- [ ] **Step 4: Add recovery cards**

For each step include a concise `문제가 생겼다면` block with the visible symptom, the next safe action, and the related detailed manual section.

- [ ] **Step 5: Validate beginner readability**

Check every step for a visible target, an expected result, and a next action. Remove unexplained abbreviations and move deep explanations to the NLU guide.

### Task 4: Write the NLU guide and engine comparison

**Files:**
- Create: `docs/manual/cga-nlu-guide/README.md`
- Create: `docs/manual/cga-nlu-guide/engine-comparison.md`

**Interfaces:**
- Consumes: verification matrix, `apps/web/lib/nlu-options.ts`, `apps/web/lib/answer-options.ts`, analysis UI, and the NLU reference guide.
- Produces: an operator and AI/NLU specialist guide with common concepts, engine-specific procedures, and quality improvement guidance.

- [ ] **Step 1: Write common NLU concepts**

Explain intent, training sentence, entity, dictionary, threshold/cut-off, similarity, answer engine, evaluation, and analysis in plain Korean before engine-specific detail.

- [ ] **Step 2: Write the engine comparison**

Use the approved comparison fields: core method, required data, setup, execution, validation signal, quality risks, and appropriate use case. Mark any capability not confirmed in CGA as `확인 필요` in the internal matrix and omit it from user-facing availability claims.

- [ ] **Step 3: Write ML operations**

Cover intent and training sentence design, entity/dictionary considerations, learning, test, analysis, imbalance, overlapping intents, and corrective iteration where CGA confirms each action.

- [ ] **Step 4: Write Semantic operations**

Cover embedding/vector setup, intent indexing or retrieval, similarity/threshold interpretation, test, index refresh requirements, and external dependency cautions where CGA confirms each action.

- [ ] **Step 5: Write LLM operations**

Cover provider/model selection, instruction or prompt settings, intent/answer interaction, test, response consistency, latency/cost considerations, and safe fallback guidance where CGA confirms each action.

- [ ] **Step 6: Write quality improvement and troubleshooting**

Organize troubleshooting by symptom → likely cause → evidence to inspect → safe correction → retest. Do not recommend database or CLI operations to end users.

- [ ] **Step 7: Review technical claims against the matrix**

Run:

```powershell
rg -n 'TODO|TBD|미정|추후 결정' docs/manual/cga-nlu-guide
```

Expected: no placeholders remain, and every engine-specific claim can be traced to a confirmed source or is explicitly marked for later verification outside the user-facing text.

### Task 5: Cross-document review and handoff

**Files:**
- Modify: `docs/manual/cga-user-manual/README.md`
- Modify: `docs/manual/cga-getting-started/README.md`
- Modify: `docs/manual/cga-nlu-guide/README.md`
- Modify: `docs/manual/cga-nlu-guide/engine-comparison.md`
- Modify: `docs/manual/cga-manual-verification-matrix.md`

**Interfaces:**
- Consumes: all three completed drafts and the verification matrix.
- Produces: a consistent Markdown document set ready for user review and later Word/PDF conversion.

- [ ] **Step 1: Check terminology consistency**

Run:

```powershell
rg -n 'ML|Semantic|LLM|시멘틱|엔진|봇|버전|학습|테스트' docs/manual/cga-*
```

Expected: the same CGA labels are used consistently; any intentional Korean/English alias is defined once.

- [ ] **Step 2: Check internal links**

Resolve every relative Markdown link manually with `Get-Item -LiteralPath` and remove links to files that do not exist.

- [ ] **Step 3: Check scope and unsupported claims**

Compare each section with the verification matrix. Remove claims that are only supported by Aidot reference material or source code without actual CGA confirmation.

- [ ] **Step 4: Record review result**

Update the matrix with final statuses and list remaining browser or runtime verification gaps separately from the completed drafts.

- [ ] **Step 5: Commit the Markdown draft set**

```powershell
git add docs/manual/cga-user-manual docs/manual/cga-getting-started docs/manual/cga-nlu-guide docs/manual/cga-manual-verification-matrix.md
git commit -m "docs: add CGA user and NLU manuals"
```
