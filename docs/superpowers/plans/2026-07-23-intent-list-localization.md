# Intent/Module Management Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize the intent/module management screen into CGA Studio's seven supported UI languages without changing CSV, API, UUID, training, deletion, or conversation-design behavior.

**Architecture:** Add one typed `IntentListCatalog` keyed by `SupportedLanguage` and consume it reactively through `useI18n()` in the existing page. Keep CSV parsing aliases and download headers as immutable data-contract constants in `intent-list-page.tsx`; only visible copy and client-generated explanatory messages move to the catalog.

**Tech Stack:** Next.js 16, React, TypeScript, Python pytest source-contract tests, existing CGA `LanguageProvider`.

## Global Constraints

- Supported UI languages are exactly `ko`, `en`, `zh-CN`, `ja`, `vi`, `fr`, and `de`.
- User-authored bot, intent, module, utterance, display-name, and tag values are never translated.
- Browser requests continue to use same-origin `/api/v1` paths; no absolute, localhost, or Docker-internal browser URL is introduced.
- Existing CSV column order, Korean/English import aliases, and download format remain unchanged.
- API request/response structures, UUIDs, save/delete/reference-check/training/conversation-design behavior remain unchanged.
- API-provided diagnostic messages remain verbatim; only fixed client copy is localized.
- Each task follows RED → GREEN → full Next.js build → commit.

---

### Task 1: Localize List, Summary, Search, and Table Copy

**Files:**
- Create: `apps/web/lib/i18n/intent-list.ts`
- Modify: `apps/web/components/intent-list-page.tsx`
- Modify: `apps/api/tests/test_multilingual_support_contract.py`

**Interfaces:**
- Consumes: `useI18n(): { language: SupportedLanguage }`, `SHELL_NAVIGATION[language]`.
- Produces: `IntentListCatalog`, `INTENT_LIST_CATALOGS`, and `formatIntentListText(template, values)`.

- [ ] **Step 1: Write the failing contract test**

Add:

```python
def test_intent_list_uses_seven_language_catalog_without_changing_csv_contract() -> None:
    page_source = (ROOT_DIR / "apps/web/components/intent-list-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/intent-list.ts").read_text(encoding="utf-8")

    assert "useI18n" in page_source
    assert "INTENT_LIST_CATALOGS[uiLanguage]" in page_source
    assert "formatIntentListText(" in page_source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, IntentListCatalog>" in catalog_source
    assert '[\"의도명\", \"표시명\", \"의도 Key\", \"학습문장\", \"태그\"]' in page_source
    assert '[\"의도명\", \"Intent Name\", \"intentName\", \"name\"]' in page_source
```

- [ ] **Step 2: Run the focused test and verify RED**

Run from `apps/api`:

```powershell
& 'C:\Users\cyhuh\anaconda3\python.exe' -m pytest tests/test_multilingual_support_contract.py::test_intent_list_uses_seven_language_catalog_without_changing_csv_contract -q
```

Expected: FAIL because `apps/web/lib/i18n/intent-list.ts` does not exist.

- [ ] **Step 3: Add the typed catalog**

Create `apps/web/lib/i18n/intent-list.ts` with this public shape:

```ts
import type { SupportedLanguage } from "@/lib/language";

export type IntentListCatalog = {
  intent: string;
  configure: string;
  entity: string;
  dictionary: string;
  evaluation: string;
  retraining: string;
  analysis: string;
  searchPlaceholder: string;
  filteringBy: string;
  all: string;
  category: string;
  validation: string;
  tag: string;
  module: string;
  success: string;
  failure: string;
  none: string;
  allValidation: string;
  allTags: string;
  addIntentModule: string;
  fileMenu: string;
  uploadFile: string;
  downloadFile: string;
  totalCount: string;
  pageSize: string;
  delete: string;
  selectedCount: string;
  selectAll: string;
  scenarioError: string;
  intentModuleName: string;
  displayName: string;
  utterances: string;
  conversationCards: string;
  otherOptions: string;
  modifiedAt: string;
  modifiedBy: string;
  selectRow: string;
  rowMenu: string;
  noSearchResults: string;
  loading: string;
  empty: string;
  pageLoading: string;
};

export function formatIntentListText(
  template: string,
  values: Record<string, string | number>,
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export const INTENT_LIST_CATALOGS = {
  ko: INTENT_LIST_KO,
  en: INTENT_LIST_EN,
  "zh-CN": INTENT_LIST_ZH_CN,
  ja: INTENT_LIST_JA,
  vi: INTENT_LIST_VI,
  fr: INTENT_LIST_FR,
  de: INTENT_LIST_DE,
} satisfies Record<SupportedLanguage, IntentListCatalog>;
```

Define each `INTENT_LIST_<LANGUAGE>` constant immediately above the export with every declared field. Use the current Korean UI literal as the exact `ko` value and the following terminology consistently in the other six constants:

| Key | en | zh-CN | ja | vi | fr | de |
|---|---|---|---|---|---|---|
| `intent` | Intent | 意图 | 意図 | Ý định | Intention | Intent |
| `configure` | Configuration | 配置 | 構成 | Cấu hình | Configuration | Konfiguration |
| `entity` | Entity | 实体 | エンティティ | Thực thể | Entité | Entität |
| `dictionary` | Dictionary | 词典 | 辞書 | Từ điển | Dictionnaire | Wörterbuch |
| `evaluation` | Evaluation | 评估 | 評価 | Đánh giá | Évaluation | Bewertung |
| `retraining` | Retraining | 重新训练 | 再学習 | Huấn luyện lại | Réentraînement | Nachtraining |
| `analysis` | Analysis | 分析 | 分析 | Phân tích | Analyse | Analyse |
| `category` | Category | 分类 | 区分 | Phân loại | Catégorie | Kategorie |
| `validation` | Validation | 验证 | 検証 | Xác thực | Validation | Validierung |
| `tag` | Tag | 标签 | タグ | Thẻ | Tag | Tag |
| `module` | Module | 模块 | モジュール | Mô-đun | Module | Modul |
| `success` | Success | 成功 | 成功 | Thành công | Succès | Erfolg |
| `failure` | Failure | 失败 | 失敗 | Thất bại | Échec | Fehler |
| `none` | None | 无 | なし | Không có | Aucun | Keine |
| `delete` | Delete | 删除 | 削除 | Xóa | Supprimer | Löschen |
| `displayName` | Display Name | 显示名称 | 表示名 | Tên hiển thị | Nom affiché | Anzeigename |
| `utterances` | Training Sentences | 训练语句 | 学習文 | Câu huấn luyện | Phrases d'entraînement | Trainingssätze |
| `conversationCards` | Conversation Cards | 对话卡片 | 対話カード | Thẻ hội thoại | Cartes de dialogue | Dialogkarten |
| `otherOptions` | Other Options | 其他选项 | その他のオプション | Tùy chọn khác | Autres options | Weitere Optionen |
| `modifiedAt` | Last Modified | 最后修改 | 最終更新 | Sửa lần cuối | Dernière modification | Zuletzt geändert |
| `modifiedBy` | Modified By | 修改人 | 更新者 | Người sửa | Modifié par | Geändert von |

For sentence fields such as `searchPlaceholder`, `filteringBy`, empty states, count templates, and aria labels, write complete grammatical sentences in each language and preserve the declared `{count}` and `{name}` tokens exactly.

- [ ] **Step 4: Connect list and search rendering**

In `IntentListPage`, add:

```ts
const { language: uiLanguage } = useI18n();
const copy = INTENT_LIST_CATALOGS[uiLanguage];
```

Change `buildSummaryCards` to accept `copy: IntentListCatalog`, then use `copy.intent`, `copy.configure`, `copy.entity`, `copy.dictionary`, `copy.evaluation`, `copy.retraining`, and `copy.analysis`.

Replace visible list/search/filter/table strings with catalog fields. Format counts and accessibility labels with:

```ts
formatIntentListText(copy.totalCount, { count: visibleDialogs.length })
formatIntentListText(copy.pageSize, { count: pageSize })
formatIntentListText(copy.selectedCount, { count: selectedIds.length })
formatIntentListText(copy.selectRow, { name: dialog.name })
formatIntentListText(copy.rowMenu, { name: dialog.name })
```

Keep the following CSV contract literals unchanged:

```ts
["의도명", "intentname", "학습문장", "utterance"]
["의도명", "Intent Name", "intentName", "name"]
["표시명", "Display Name", "displayName"]
["의도 Key", "Intent Key", "dialogKey"]
["학습문장", "Utterance", "utterance"]
["태그", "Tags", "tags"]
["의도명", "표시명", "의도 Key", "학습문장", "태그"]
```

- [ ] **Step 5: Run the focused contract and verify GREEN**

Run:

```powershell
& 'C:\Users\cyhuh\anaconda3\python.exe' -m pytest tests/test_multilingual_support_contract.py -q
```

Expected: all multilingual support contracts PASS.

- [ ] **Step 6: Run the production web build**

Run from `apps/web`:

```powershell
npm run build
```

Expected: exit code `0`, TypeScript passes, and all 46 routes are generated. Restore only the generated `apps/web/next-env.d.ts` change afterward.

- [ ] **Step 7: Commit Task 1**

```powershell
git add apps/api/tests/test_multilingual_support_contract.py apps/web/components/intent-list-page.tsx apps/web/lib/i18n/intent-list.ts
git commit -m "feat: localize intent list and search"
```

---

### Task 2: Localize Selection, Reference Blocking, and Delete Confirmation

**Files:**
- Modify: `apps/web/lib/i18n/intent-list.ts`
- Modify: `apps/web/components/intent-list-page.tsx`
- Modify: `apps/api/tests/test_multilingual_support_contract.py`

**Interfaces:**
- Consumes: `IntentListCatalog`, `formatIntentListText`.
- Produces: localized deletion and reference-blocking copy while preserving `findDialogUsageReferences` and `persistVersionDocument`.

- [ ] **Step 1: Write the failing deletion-boundary test**

Add:

```python
def test_intent_list_localizes_delete_copy_and_preserves_reference_checks() -> None:
    page_source = (ROOT_DIR / "apps/web/components/intent-list-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/intent-list.ts").read_text(encoding="utf-8")

    assert "copy.deleteDialogTitle" in page_source
    assert "copy.deleteDialogQuestion" in page_source
    assert "copy.deleteReferenced" in page_source
    assert "findDialogUsageReferences" in page_source
    assert "persistVersionDocument" in page_source
    assert "deleteDialogTitle: string" in catalog_source
    assert "deleteReferenced: string" in catalog_source
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
& 'C:\Users\cyhuh\anaconda3\python.exe' -m pytest tests/test_multilingual_support_contract.py::test_intent_list_localizes_delete_copy_and_preserves_reference_checks -q
```

Expected: FAIL because deletion catalog fields are absent.

- [ ] **Step 3: Extend the catalog**

Add these required fields to `IntentListCatalog` and all seven objects:

```ts
deleteDialogAria: string;
deleteDialogTitle: string;
deleteDialogQuestion: string;
cancel: string;
confirm: string;
close: string;
deleteReferenced: string; // required tokens: {name}, {type}, {usages}
deleteLoadError: string;
deleteSuccess: string;
```

- [ ] **Step 4: Replace fixed deletion copy only**

Use:

```ts
formatIntentListText(copy.deleteReferenced, {
  name: dialog.name,
  type: getDialogTypeLabel(dialog.dialogType),
  usages: usages.join(", "),
})
```

Do not change the call order:

1. Refresh version information.
2. Call `findDialogUsageReferences`.
3. Block referenced dialogs.
4. Call `persistVersionDocument` only for deletable dialogs.

Replace dialog title, question, close aria label, cancel, confirm, load-error fallback, and success message with catalog values.

- [ ] **Step 5: Run contracts and build**

Run:

```powershell
& 'C:\Users\cyhuh\anaconda3\python.exe' -m pytest tests/test_multilingual_support_contract.py -q
```

Then:

```powershell
npm run build
```

Expected: tests PASS and build exits `0`.

- [ ] **Step 6: Commit Task 2**

```powershell
git add apps/api/tests/test_multilingual_support_contract.py apps/web/components/intent-list-page.tsx apps/web/lib/i18n/intent-list.ts
git commit -m "feat: localize intent deletion workflow"
```

---

### Task 3: Localize CSV Upload Guidance and Result Copy

**Files:**
- Modify: `apps/web/lib/i18n/intent-list.ts`
- Modify: `apps/web/components/intent-list-page.tsx`
- Modify: `apps/api/tests/test_multilingual_support_contract.py`

**Interfaces:**
- Consumes: `IntentListCatalog`, existing `parseCsvText`, `buildIntentDownloadCsv`, `AssetUploadDialog`, `UploadResultDialog`.
- Produces: localized upload UI while preserving import aliases and output CSV headers.

- [ ] **Step 1: Write the failing CSV-boundary test**

Add:

```python
def test_intent_csv_ui_is_localized_without_translating_csv_headers() -> None:
    page_source = (ROOT_DIR / "apps/web/components/intent-list-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/intent-list.ts").read_text(encoding="utf-8")

    assert "copy.uploadTitle" in page_source
    assert "copy.uploadResultTitle" in page_source
    assert "copy.addedIntents" in page_source
    assert 'const rows = [[\"의도명\", \"표시명\", \"의도 Key\", \"학습문장\", \"태그\"]];' in page_source
    assert '[\"의도명\", \"Intent Name\", \"intentName\", \"name\"]' in page_source
    assert "uploadTitle: string" in catalog_source
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
& 'C:\Users\cyhuh\anaconda3\python.exe' -m pytest tests/test_multilingual_support_contract.py::test_intent_csv_ui_is_localized_without_translating_csv_headers -q
```

Expected: FAIL because upload catalog fields are absent.

- [ ] **Step 3: Extend the catalog**

Add these fields to every language object:

```ts
uploadTitle: string;
uploadDescription: string;
uploadEncodingHelp: string;
uploadHeaderHelp: string;
uploadRepeatedNameHelp: string;
uploadNoIntents: string;
uploadLoadError: string;
uploadComplete: string;
uploadResultTitle: string;
uploadResultNote: string;
addedIntents: string;
updatedIntents: string;
addedUtterances: string;
duplicateUtterances: string;
duplicateIntentKeys: string;
excludedRows: string;
```

- [ ] **Step 4: Replace upload UI and result copy**

Replace only visible `AssetUploadDialog`, `UploadResultDialog`, fallback error, and result-section labels with catalog values.

Preserve these operations unchanged:

```ts
parseCsvText(text)
buildIntentDownloadCsv(dialogs)
fetchStudioBotVersionReferences(...)
updateStudioBotVersionDialogs(...)
persistVersionDocument(...)
```

Preserve the template and download headers in their current Korean compatibility format.

- [ ] **Step 5: Run contracts and build**

Run:

```powershell
& 'C:\Users\cyhuh\anaconda3\python.exe' -m pytest tests/test_multilingual_support_contract.py -q
```

Then:

```powershell
npm run build
```

Expected: tests PASS and build exits `0`.

- [ ] **Step 6: Commit Task 3**

```powershell
git add apps/api/tests/test_multilingual_support_contract.py apps/web/components/intent-list-page.tsx apps/web/lib/i18n/intent-list.ts
git commit -m "feat: localize intent CSV workflow"
```

---

### Task 4: Localize Scenario-Error Guidance and Run Full Regression

**Files:**
- Modify: `apps/web/lib/i18n/intent-list.ts`
- Modify: `apps/web/components/intent-list-page.tsx`
- Modify: `apps/api/tests/test_multilingual_support_contract.py`

**Interfaces:**
- Consumes: `IntentListCatalog`, `formatIntentListText`, existing scenario issue maps and training-disable flow.
- Produces: localized fixed error guidance without changing issue IDs, counts, placement, or training blocking.

- [ ] **Step 1: Write the failing scenario-error boundary test**

Add:

```python
def test_intent_scenario_errors_localize_guidance_without_changing_training_blocking() -> None:
    page_source = (ROOT_DIR / "apps/web/components/intent-list-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/intent-list.ts").read_text(encoding="utf-8")

    assert "copy.scenarioIssueFallback" in page_source
    assert "copy.trainingBlockedByScenarioErrors" in page_source
    assert "scenarioErrorCount" in page_source
    assert "trainingDisabledReason" in page_source
    assert "scenarioIssueFallback: string" in catalog_source
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
& 'C:\Users\cyhuh\anaconda3\python.exe' -m pytest tests/test_multilingual_support_contract.py::test_intent_scenario_errors_localize_guidance_without_changing_training_blocking -q
```

Expected: FAIL because scenario-error catalog fields are absent.

- [ ] **Step 3: Extend the catalog**

Add these fields to all seven language objects:

```ts
scenarioIssueFallback: string;
optionTransitionLock: string;
optionReturnBlock: string;
optionFeedback: string;
otherOptionsAria: string;
optionEnabled: string;
optionDisabled: string;
scenarioErrorAria: string;
scenarioErrorLabel: string;
saveBlocked: string;
trainingRunBlocked: string;
trainingBlockedByScenarioErrors: string; // {count}
fixMarkedRows: string;
fixUnplacedErrors: string;
unplacedErrors: string; // {messages}
utteranceRequiredForDesign: string;
reloadTrainingError: string;
savePriorityBotError: string;
saveIntentError: string;
```

- [ ] **Step 4: Localize fixed guidance while preserving behavior**

Pass `copy` into helper functions that create client-only fallback text. Use `formatIntentListText` for counts and unplaced messages.

Keep these state/data operations unchanged:

```ts
issueMap.set(...)
trainingDisabledReason
resolveScenarioIssueDialogId(...)
getScenarioIssueKey(...)
refreshStudioBotSelectedVersion(...)
```

If the API supplies `item.message`, continue displaying it verbatim. Use `copy.scenarioIssueFallback` only when no message exists.

- [ ] **Step 5: Run complete multilingual and NLU regression**

Run from `apps/api`:

```powershell
& 'C:\Users\cyhuh\anaconda3\python.exe' -m pytest tests/test_multilingual_support_contract.py tests/test_multilingual_nlu_contract.py -q
```

Expected: all tests PASS; only the existing Starlette deprecation warning is allowed.

- [ ] **Step 6: Run complete web build and diff checks**

Run from `apps/web`:

```powershell
npm run build
```

Then from repository root:

```powershell
git restore apps/web/next-env.d.ts
git diff --check
git status --short
```

Expected: build exits `0`; no whitespace errors; only intended Task 4 files are modified.

- [ ] **Step 7: Commit Task 4**

```powershell
git add apps/api/tests/test_multilingual_support_contract.py apps/web/components/intent-list-page.tsx apps/web/lib/i18n/intent-list.ts
git commit -m "feat: localize intent validation guidance"
```

---

### Task 5: Browser-Level Language Switching Verification

**Files:**
- Modify only if a verified defect is reproduced: files already listed in Tasks 1-4.

**Interfaces:**
- Consumes: built Next.js app, existing authentication/session, existing bot/version data.
- Produces: evidence that UI language changes reactively and browser requests remain same-origin.

- [ ] **Step 1: Start the existing local/WSL test environment**

Use the repository's documented run command without changing `.env` values. Do not create, delete, train, or overwrite operating data solely for this verification.

- [ ] **Step 2: Verify list language switching**

Open one existing bot's intent/module list. Switch through `ko`, `en`, `zh-CN`, `ja`, `vi`, `fr`, and `de`.

Expected:

- Summary, search, filters, table headers, buttons, and dialogs update without navigation.
- User-authored intent/module/utterance/tag data remains unchanged.
- Bot language remains independent from UI language.

- [ ] **Step 3: Verify CSV compatibility without mutation**

Open the upload dialog and inspect guidance in each UI language. Use a local fixture in parsing tests; do not upload into the operating bot during read-only browser verification.

Expected: localized guidance does not alter the documented Korean/English-compatible CSV data contract.

- [ ] **Step 4: Verify browser network boundary**

Inspect browser Network while reloading and filtering.

Expected: requests use same-origin `/api/v1/...`; no `localhost`, `127.0.0.1`, Docker service name, container port, or server-only environment value is exposed.

- [ ] **Step 5: Record verified and unverified evidence**

Report separately:

- automated contract result,
- Next.js build result,
- logged-in browser UI result,
- same-origin Network result,
- any check skipped because authentication or runtime was unavailable.

Do not describe skipped browser checks as passes.
