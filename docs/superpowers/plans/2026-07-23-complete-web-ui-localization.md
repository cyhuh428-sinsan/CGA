# CGA Complete Web UI Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize every user-facing fixed string in `apps/web` into Korean, English, Simplified Chinese, Japanese, Vietnamese, French, and German without translating business data or changing application behavior.

**Architecture:** Keep `LanguageProvider` as the single UI-language source and add domain-focused catalogs rather than one global dictionary. Shared Admin components receive localized copy through a small Admin catalog hook, while API, simulator, and Studio domains use their own typed catalogs. A static contract test audits user-facing Korean literals and requires an explicit data/contract allowlist for literals that must remain Korean.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Python 3.12 contract tests, pytest.

## Global Constraints

- Supported UI languages are exactly `ko`, `en`, `zh-CN`, `ja`, `vi`, `fr`, and `de`.
- Browser API calls remain same-origin `/api/v1`; no browser absolute URL, localhost, Docker hostname, or internal port may be introduced.
- Bot names, API names, intent names, user names, CSV contract headers, persisted examples, and API error details are business data and must not be automatically translated.
- Conversation flow, intent classification, training, Queue, save, delete, and UUID behavior must remain unchanged.
- Existing Korean behavior is the fallback and must remain available.
- Use 12px body/form, 10px small help, 9px auxiliary, 14px sidebar, and 16px title sizing; do not redesign layouts.
- Each task follows RED → GREEN → targeted test → production build when UI code changes → commit.

---

### Task 1: Localize Admin Navigation and Admin Shell

**Files:**
- Create: `apps/web/lib/i18n/admin-navigation.ts`
- Modify: `apps/web/components/admin-console-layout.tsx`
- Modify: `apps/web/components/studio-rail.tsx`
- Test: `apps/api/tests/test_multilingual_support_contract.py`

**Interfaces:**
- Consumes: `useI18n(): { language: SupportedLanguage }` from `apps/web/components/language-provider.tsx`.
- Produces: `ADMIN_NAVIGATION_CATALOGS: Record<SupportedLanguage, AdminNavigationCatalog>`.
- Produces: `buildAdminNavigationGroups(copy: AdminNavigationCatalog): AdminNavigationGroup[]`.

- [ ] **Step 1: Write the failing Admin navigation contract**

Append:

```python
def test_admin_navigation_and_shell_use_complete_seven_language_catalog() -> None:
    layout_source = (ROOT_DIR / "apps/web/components/admin-console-layout.tsx").read_text(encoding="utf-8")
    rail_source = (ROOT_DIR / "apps/web/components/studio-rail.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-navigation.ts").read_text(encoding="utf-8")

    for source in (layout_source, rail_source):
        assert "ADMIN_NAVIGATION_CATALOGS[language]" in source
        assert "buildAdminNavigationGroups(" in source
    for language in SUPPORTED_LANGUAGES:
        assert f'  "{language}":' in catalog_source or f"  {language}:" in catalog_source
    assert "satisfies Record<SupportedLanguage, AdminNavigationCatalog>" in catalog_source
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
cd apps/api
python -m pytest tests/test_multilingual_support_contract.py::test_admin_navigation_and_shell_use_complete_seven_language_catalog -q
```

Expected: FAIL because `apps/web/lib/i18n/admin-navigation.ts` does not exist.

- [ ] **Step 3: Add the typed Admin navigation catalog**

Define the complete interface:

```ts
export type AdminNavigationCatalog = {
  systemAdministration: string;
  userManagementGroup: string;
  userManagement: string;
  loginHistory: string;
  groupManagement: string;
  statusGroup: string;
  auditLogs: string;
  botStatus: string;
  trainingHistory: string;
  conversationHistory: string;
  apiCallHistory: string;
  queueHistory: string;
  intentFeedback: string;
  conversationGroup: string;
  commonVariables: string;
  defaultMessages: string;
  integrationGroup: string;
  channels: string;
  botstationStatus: string;
  otherGroup: string;
  templates: string;
  license: string;
  licenseNotApplied: string;
  licenseChecking: string;
  licenseCheckFailed: string;
  expired: string;
  verifying: string;
};
```

Export a seven-language `ADMIN_NAVIGATION_CATALOGS` and build groups from stable group keys rather than comparing translated titles:

```ts
export type AdminNavigationGroup = {
  key: "users" | "status" | "conversation" | "integration" | "other";
  title: string;
  items: Array<{ href: string; label: string }>;
};

export function buildAdminNavigationGroups(copy: AdminNavigationCatalog): AdminNavigationGroup[] {
  return [
    {
      key: "users",
      title: copy.userManagementGroup,
      items: [
        { href: "/admin/users", label: copy.userManagement },
        { href: "/admin/login-history", label: copy.loginHistory },
        { href: "/admin/groups", label: copy.groupManagement },
      ],
    },
    {
      key: "status",
      title: copy.statusGroup,
      items: [
        { href: "/admin/audit-logs", label: copy.auditLogs },
        { href: "/admin/bot-status", label: copy.botStatus },
        { href: "/admin/training-history", label: copy.trainingHistory },
        { href: "/admin/conversations", label: copy.conversationHistory },
        { href: "/admin/api-call-history", label: copy.apiCallHistory },
        { href: "/admin/queue-history", label: copy.queueHistory },
        { href: "/admin/intent-feedback", label: copy.intentFeedback },
      ],
    },
    {
      key: "conversation",
      title: copy.conversationGroup,
      items: [
        { href: "/admin/common-variables", label: copy.commonVariables },
        { href: "/admin/default-messages", label: copy.defaultMessages },
      ],
    },
    {
      key: "integration",
      title: copy.integrationGroup,
      items: [
        { href: "/admin/channels", label: copy.channels },
        { href: "/admin/botstation-status", label: copy.botstationStatus },
      ],
    },
    {
      key: "other",
      title: copy.otherGroup,
      items: [
        { href: "/admin/templates", label: copy.templates },
        { href: "/admin/license", label: copy.license },
      ],
    },
  ];
}
```

- [ ] **Step 4: Replace duplicated hard-coded group arrays**

In both components:

```ts
const { language } = useI18n();
const adminCopy = ADMIN_NAVIGATION_CATALOGS[language];
const adminGroups = useMemo(() => buildAdminNavigationGroups(adminCopy), [adminCopy]);
```

Change operations-role filtering from translated title comparison to stable key:

```ts
const operationsHrefs = [
  "/admin/operations-dashboard",
  ...(adminGroups.find((group) => group.key === "status")?.items.map((item) => item.href) ?? []),
];
```

Use catalog values for shell title, license states, and loading text. Do not change route authorization.

- [ ] **Step 5: Run targeted contract and production build**

Run:

```powershell
cd apps/api
python -m pytest tests/test_multilingual_support_contract.py -q
cd ../web
npm run build
```

Expected: all multilingual contracts PASS; Next.js generates all routes with exit code `0`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/tests/test_multilingual_support_contract.py apps/web/lib/i18n/admin-navigation.ts apps/web/components/admin-console-layout.tsx apps/web/components/studio-rail.tsx
git commit -m "feat: localize admin navigation shell"
```

---

### Task 2: Localize Shared Admin Table Controls

**Files:**
- Create: `apps/web/lib/i18n/admin-common.ts`
- Modify: `apps/web/components/admin-table-page.tsx`
- Modify: `apps/web/components/admin-interactive-table-page.tsx`
- Modify: `apps/web/components/admin-history-table-page.tsx`
- Modify: `apps/web/components/admin-botstation-status-page.tsx`
- Test: `apps/api/tests/test_multilingual_support_contract.py`

**Interfaces:**
- Consumes: `useI18n()` and `formatIntentListText`-style token replacement.
- Produces: `ADMIN_COMMON_CATALOGS: Record<SupportedLanguage, AdminCommonCatalog>`.
- Produces copy for filters, pagination, loading, errors, empty state, date range, reset, search, download, and count text.

- [ ] **Step 1: Write the failing shared Admin component contract**

```python
def test_shared_admin_components_use_complete_localized_controls() -> None:
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-common.ts").read_text(encoding="utf-8")
    component_paths = (
        "apps/web/components/admin-table-page.tsx",
        "apps/web/components/admin-interactive-table-page.tsx",
        "apps/web/components/admin-history-table-page.tsx",
        "apps/web/components/admin-botstation-status-page.tsx",
    )
    for path in component_paths:
        source = (ROOT_DIR / path).read_text(encoding="utf-8")
        assert "ADMIN_COMMON_CATALOGS[language]" in source
    assert "satisfies Record<SupportedLanguage, AdminCommonCatalog>" in catalog_source
```

- [ ] **Step 2: Verify RED**

Run the single pytest test. Expected: FAIL because `admin-common.ts` is absent.

- [ ] **Step 3: Add common copy and token formatter**

The interface must include:

```ts
export type AdminCommonCatalog = {
  filter: string;
  search: string;
  reset: string;
  confirm: string;
  loading: string;
  loginRequired: string;
  loadFailed: string;
  noData: string;
  allGroups: string;
  allBots: string;
  allChannels: string;
  fromDate: string;
  toDate: string;
  previousPage: string;
  nextPage: string;
  totalCount: string;
  pageSize: string;
  download: string;
};
```

Add `formatAdminText(template, values)` using `/\{(\w+)\}/g`.

- [ ] **Step 4: Replace shared component fixed copy**

Each client component reads:

```ts
const { language } = useI18n();
const copy = ADMIN_COMMON_CATALOGS[language];
```

Replace default props such as `"10개씩 보기"`, `"실제 조회 데이터가 없습니다."`,
`"로그인이 필요합니다."`, filter labels, pagination aria labels, reset/search buttons,
and loading text. Preserve caller-provided titles, columns, templates, row data, and fetch functions.

- [ ] **Step 5: Verify and commit**

Run the complete multilingual contract test and `npm run build`, then:

```bash
git add apps/api/tests/test_multilingual_support_contract.py apps/web/lib/i18n/admin-common.ts apps/web/components/admin-table-page.tsx apps/web/components/admin-interactive-table-page.tsx apps/web/components/admin-history-table-page.tsx apps/web/components/admin-botstation-status-page.tsx
git commit -m "feat: localize shared admin controls"
```

---

### Task 3: Localize Every Admin Route

**Files:**
- Create: `apps/web/lib/i18n/admin-pages.ts`
- Modify:
  - `apps/web/app/admin/api-call-history/page.tsx`
  - `apps/web/app/admin/audit-logs/page.tsx`
  - `apps/web/app/admin/bot-status/page.tsx`
  - `apps/web/app/admin/channels/page.tsx`
  - `apps/web/app/admin/common-variables/page.tsx`
  - `apps/web/app/admin/conversations/page.tsx`
  - `apps/web/app/admin/groups/page.tsx`
  - `apps/web/app/admin/groups/new/page.tsx`
  - `apps/web/app/admin/groups/[groupId]/page.tsx`
  - `apps/web/app/admin/intent-feedback/page.tsx`
  - `apps/web/app/admin/license/page.tsx`
  - `apps/web/app/admin/login-history/page.tsx`
  - `apps/web/app/admin/operations-dashboard/page.tsx`
  - `apps/web/app/admin/queue-history/page.tsx`
  - `apps/web/app/admin/roles/page.tsx`
  - `apps/web/app/admin/settings/page.tsx`
  - `apps/web/app/admin/templates/page.tsx`
  - `apps/web/app/admin/training-history/page.tsx`
  - `apps/web/app/admin/users/page.tsx`
  - `apps/web/app/admin/users/[entryId]/page.tsx`
  - `apps/web/components/admin-botstation-status-page.tsx`
- Test: `apps/api/tests/test_multilingual_support_contract.py`

**Interfaces:**
- Consumes: `ADMIN_COMMON_CATALOGS`, `useI18n`.
- Produces: `ADMIN_PAGE_CATALOGS: Record<SupportedLanguage, AdminPageCatalog>`.
- `AdminPageCatalog` is grouped by stable route key, for example `apiCallHistory`, `users`, and `templates`, so columns and labels remain co-located.

- [ ] **Step 1: Add a failing route coverage contract**

```python
ADMIN_ROUTE_FILES = (
    "api-call-history/page.tsx",
    "audit-logs/page.tsx",
    "bot-status/page.tsx",
    "channels/page.tsx",
    "common-variables/page.tsx",
    "conversations/page.tsx",
    "groups/page.tsx",
    "groups/new/page.tsx",
    "groups/[groupId]/page.tsx",
    "intent-feedback/page.tsx",
    "license/page.tsx",
    "login-history/page.tsx",
    "operations-dashboard/page.tsx",
    "queue-history/page.tsx",
    "roles/page.tsx",
    "settings/page.tsx",
    "templates/page.tsx",
    "training-history/page.tsx",
    "users/page.tsx",
    "users/[entryId]/page.tsx",
)

def test_every_admin_route_uses_admin_page_catalog() -> None:
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/admin-pages.ts").read_text(encoding="utf-8")
    for relative_path in ADMIN_ROUTE_FILES:
        source = (ROOT_DIR / "apps/web/app/admin" / relative_path).read_text(encoding="utf-8")
        assert "ADMIN_PAGE_CATALOGS[language]" in source
    assert "satisfies Record<SupportedLanguage, AdminPageCatalog>" in catalog_source
```

- [ ] **Step 2: Verify RED**

Run the single test. Expected: FAIL because the catalog is absent and routes do not consume it.

- [ ] **Step 3: Build the Admin page catalog**

Create route-keyed copy:

```ts
export type AdminPageCopy = {
  title: string;
  searchPlaceholder: string;
  columns: string[];
  empty: string;
  loadFailed: string;
  saveFailed: string;
  saved: string;
};

export type AdminPageCatalog = {
  apiCallHistory: AdminPageCopy;
  auditLogs: AdminPageCopy;
  botStatus: AdminPageCopy;
  channels: AdminPageCopy;
  commonVariables: AdminPageCopy;
  conversations: AdminPageCopy;
  groups: AdminPageCopy;
  groupCreate: AdminPageCopy;
  groupDetail: AdminPageCopy;
  intentFeedback: AdminPageCopy;
  license: AdminPageCopy;
  loginHistory: AdminPageCopy;
  operationsDashboard: AdminPageCopy;
  queueHistory: AdminPageCopy;
  templates: AdminPageCopy;
  trainingHistory: AdminPageCopy;
  users: AdminPageCopy;
  userDetail: AdminPageCopy;
};
```

Add route-specific fields only where needed, such as upload, approve, reject, test connection,
status values, dashboard cards, and modal labels. Do not translate data returned by the API.

- [ ] **Step 4: Replace each route's user-facing fixed copy**

At the top of each client page:

```ts
const { language } = useI18n();
const copy = ADMIN_PAGE_CATALOGS[language].apiCallHistory; // Use the matching route key.
```

Replace titles, placeholders, columns, form labels, modal titles, button labels, empty/loading text,
and client-side fallback errors. Keep request paths, query parameters, data-grid templates, sort keys,
row values, and action handlers unchanged.

- [ ] **Step 5: Verify all Admin route coverage**

Run:

```powershell
cd apps/api
python -m pytest tests/test_multilingual_support_contract.py -q
cd ../web
npm run build
```

Expected: tests PASS and all Next.js Admin routes compile.

- [ ] **Step 6: Commit**

```bash
git add apps/api/tests/test_multilingual_support_contract.py apps/web/lib/i18n/admin-pages.ts apps/web/app/admin
git commit -m "feat: localize admin pages"
```

---

### Task 4: Localize API Management Screens

**Files:**
- Create: `apps/web/lib/i18n/api-management.ts`
- Modify: `apps/web/components/api-store-list-page.tsx`
- Modify: `apps/web/components/api-store-detail-page.tsx`
- Modify: `apps/web/components/group-api-list-page.tsx`
- Modify: `apps/web/components/group-api-detail-page.tsx`
- Modify: `apps/web/components/flow-designer-page.tsx`
- Test: `apps/api/tests/test_multilingual_support_contract.py`

**Interfaces:**
- Produces: `API_MANAGEMENT_CATALOGS: Record<SupportedLanguage, ApiManagementCatalog>`.
- Preserves API names, Base URLs, methods, schema field names, request/response examples, and saved descriptions as business data.

- [ ] **Step 1: Write and run a failing contract**

```python
def test_api_management_screens_use_complete_catalog_without_translating_api_data() -> None:
    paths = (
        "apps/web/components/api-store-list-page.tsx",
        "apps/web/components/api-store-detail-page.tsx",
        "apps/web/components/group-api-list-page.tsx",
        "apps/web/components/group-api-detail-page.tsx",
        "apps/web/components/flow-designer-page.tsx",
    )
    for path in paths:
        source = (ROOT_DIR / path).read_text(encoding="utf-8")
        assert "API_MANAGEMENT_CATALOGS[language]" in source
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/api-management.ts").read_text(encoding="utf-8")
    assert "satisfies Record<SupportedLanguage, ApiManagementCatalog>" in catalog_source
    list_source = (ROOT_DIR / paths[0]).read_text(encoding="utf-8")
    assert "destinationBaseUrl" in list_source
```

Expected RED: missing catalog.

- [ ] **Step 2: Create catalog and replace fixed copy**

Cover list title, search placeholder, count, page size, delete, add API, table columns, detail form labels,
method/request/response controls, validation copy, modal copy, and client fallback errors.

Use:

```ts
const { language } = useI18n();
const copy = API_MANAGEMENT_CATALOGS[language];
```

Do not alter `apiRequest`, API payload construction, URL validation, method values, or persisted API data.

- [ ] **Step 3: Verify and commit**

Run the multilingual contracts and Next build. Commit:

```bash
git add apps/api/tests/test_multilingual_support_contract.py apps/web/lib/i18n/api-management.ts apps/web/components/api-store-list-page.tsx apps/web/components/api-store-detail-page.tsx apps/web/components/group-api-list-page.tsx apps/web/components/group-api-detail-page.tsx apps/web/components/flow-designer-page.tsx
git commit -m "feat: localize API management screens"
```

---

### Task 5: Localize Bot Test

**Files:**
- Create: `apps/web/lib/i18n/simulator.ts`
- Modify: `apps/web/components/simulator-page.tsx`
- Modify: `apps/web/components/simulator-rich-form-assets.ts`
- Test: `apps/api/tests/test_simulator_workspace_context_ui_contract.py`
- Test: `apps/api/tests/test_multilingual_support_contract.py`

**Interfaces:**
- Produces: `SIMULATOR_CATALOGS: Record<SupportedLanguage, SimulatorCatalog>`.
- Preserves actual bot messages, user utterances, variable names, trace values, template payloads, and saved card labels.

- [ ] **Step 1: Add failing simulator localization tests**

```python
def test_bot_test_uses_seven_language_catalog_and_preserves_trace_data() -> None:
    page_source = (ROOT_DIR / "apps/web/components/simulator-page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/simulator.ts").read_text(encoding="utf-8")

    assert "SIMULATOR_CATALOGS[language]" in page_source
    assert "copy.botTestBreadcrumb" in page_source
    assert "copy.botTestTitle" in page_source
    assert "analysisData" in page_source
    assert "satisfies Record<SupportedLanguage, SimulatorCatalog>" in catalog_source
```

Run and expect RED because the simulator catalog is missing.

- [ ] **Step 2: Add simulator catalog and localize UI-only copy**

The catalog includes breadcrumb, title, Simulator subtitle, greeting fallback, placeholder, send, reset,
clear, undo, download, show/hide analysis, Runtime/Variables/Trace labels, current runtime state,
recognition stage, score labels, empty analysis, and client error messages.

Replace:

```tsx
<p className="crumb">{copy.botTestBreadcrumb}</p>
<h1>{copy.botTestTitle}</h1>
```

Do not translate runtime results or bot output text.

- [ ] **Step 3: Verify and commit**

Run simulator contracts, complete multilingual contracts, and build. Commit:

```bash
git add apps/api/tests/test_simulator_workspace_context_ui_contract.py apps/api/tests/test_multilingual_support_contract.py apps/web/lib/i18n/simulator.ts apps/web/components/simulator-page.tsx apps/web/components/simulator-rich-form-assets.ts
git commit -m "feat: localize bot test screen"
```

---

### Task 6: Localize Audited Studio User-Facing Copy

**Files:**
- Create: `apps/web/lib/i18n/studio-pages.ts`
- Modify: each `.tsx` file under `apps/web/app/studio` and `apps/web/components` reported by `test_audited_web_ui_has_no_unapproved_korean_fixed_copy`, excluding files already localized in Tasks 1–5 and explicitly annotated business/contract data.
- Test: `apps/api/tests/test_web_user_facing_korean_contract.py`

**Interfaces:**
- Produces: `STUDIO_PAGE_CATALOGS: Record<SupportedLanguage, StudioPageCatalog>`.
- Produces an explicit audit allowlist for Korean business/contract literals.

- [ ] **Step 1: Capture the fixed-copy audit list**

Run:

```powershell
rg -n '"[^"]*[가-힣][^"]*"|`[^`]*[가-힣][^`]*`' apps/web/app apps/web/components --glob '*.tsx' --glob '!apps/web/.next/**'
```

Classify each hit as:

- UI fixed copy: must move to a catalog.
- Business/example data: keep and annotate the same line with `// i18n-allow-data`.
- Stable CSV/import contract: keep and annotate with `// i18n-allow-contract`.
- Server error passthrough: keep the server value; local fallback moves to a catalog.

Save the exact audited paths in `AUDITED_WEB_UI_FILES` inside the new Python contract test.

- [ ] **Step 2: Write the failing Korean-literal audit test**

```python
import re

KOREAN_QUOTED_LITERAL = re.compile(r'["`][^"`\n]*[가-힣][^"`\n]*["`]')

def test_audited_web_ui_has_no_unapproved_korean_fixed_copy() -> None:
    violations: list[str] = []
    for relative_path in AUDITED_WEB_UI_FILES:
        source = (ROOT_DIR / relative_path).read_text(encoding="utf-8")
        for line_number, line in enumerate(source.splitlines(), start=1):
            if "i18n-allow-data" in line or "i18n-allow-contract" in line:
                continue
            if KOREAN_QUOTED_LITERAL.search(line):
                violations.append(f"{relative_path}:{line_number}:{line.strip()}")
    assert violations == []
```

Run and expect RED with an exact `path:line:literal` list for every fixed-copy violation.

- [ ] **Step 3: Add domain keys and replace every violation**

Create route/domain sections in `StudioPageCatalog` for bot versions, configuration, flows, entities,
dictionary, evaluation, retraining, analysis, conversations, hubs, workspace, account, license, and
tenant switch.

Each consuming client component uses:

```ts
const { language } = useI18n();
const versionsCopy = STUDIO_PAGE_CATALOGS[language].botVersions;
const flowCopy = STUDIO_PAGE_CATALOGS[language].flowDesigner;
const entityCopy = STUDIO_PAGE_CATALOGS[language].entities;
const dictionaryCopy = STUDIO_PAGE_CATALOGS[language].dictionary;
const evaluationCopy = STUDIO_PAGE_CATALOGS[language].evaluation;
const retrainingCopy = STUDIO_PAGE_CATALOGS[language].retraining;
const analysisCopy = STUDIO_PAGE_CATALOGS[language].analysis;
const hubCopy = STUDIO_PAGE_CATALOGS[language].hubs;
```

Each component declares only the one matching domain variable from the example. Server components that cannot
call hooks render a localized client child through the existing client boundary. Do not convert a server
component to a client component solely to translate a static label.

- [ ] **Step 4: Run audit, contracts, and build**

```powershell
cd apps/api
python -m pytest tests/test_web_user_facing_korean_contract.py tests/test_multilingual_support_contract.py -q
cd ../web
npm run build
```

Expected: no unapproved Korean fixed-copy violations; build exits `0`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/tests/test_web_user_facing_korean_contract.py apps/web/lib/i18n/studio-pages.ts apps/web/app/studio apps/web/components
git commit -m "feat: localize audited Studio screens"
```

---

### Task 7: Full Web Regression and Browser Verification

**Files:**
- Modify only if verification finds a failing localized string: the owning domain catalog/component and its test.

**Interfaces:**
- Consumes all catalogs from Tasks 1–6.
- Produces browser evidence and a clean feature branch.

- [ ] **Step 1: Run complete multilingual and UI contract suites**

```powershell
cd apps/api
python -m pytest tests/test_multilingual_support_contract.py tests/test_multilingual_nlu_contract.py tests/test_simulator_workspace_context_ui_contract.py tests/test_web_user_facing_korean_contract.py -q
```

Expected: all tests PASS. The existing Starlette `python_multipart` deprecation warning may remain; no new warning is allowed.

- [ ] **Step 2: Run production build**

```powershell
cd apps/web
npm run build
```

Expected: TypeScript succeeds and every Next.js route is generated.

- [ ] **Step 3: Verify language switching in a logged-in browser**

At 1920×1080, switch through all seven languages and verify:

- Admin sub-menu group titles and entries.
- Admin users, logs, channels, templates, license, and default messages.
- API list/detail.
- Bot Test breadcrumb, title, controls, and analysis panel.
- One representative bot configuration, flow, entity, dictionary, evaluation, retraining, and analysis screen.

Do not create, modify, or delete operating data during this verification.

- [ ] **Step 4: Verify same-origin Network**

Confirm browser requests use `/api/v1`, `/assets`, or `/files` on the CGA origin. Confirm no browser request
contains `localhost`, `127.0.0.1`, `cga-api`, Docker hostnames, or port `8000`.

- [ ] **Step 5: Check diff and commit verification-only corrections**

```bash
git diff --check
git status --short
```

If verification required corrections, commit only those owning files and tests:

```bash
git commit -m "fix: complete web localization coverage"
```
