# CGA Runtime Default Message Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store seven-language default messages and resolve each runtime message by JSON language, `Accept-Language`, bot language, Korean DB message, and Korean code fallback in that exact order.

**Architecture:** Add one shared language-normalization module, make default message definitions language-aware, and keep the existing `(organization_id, message_key, language)` database uniqueness contract. Channel entry points resolve a supported language once per request and pass a fallback chain into the existing runtime message map; no intent, flow, training, or Queue algorithm changes.

**Tech Stack:** FastAPI, Pydantic 2, SQLAlchemy 2, PostgreSQL upsert, Next.js/React Admin UI, pytest.

## Global Constraints

- Supported languages are exactly `ko`, `en`, `zh-CN`, `ja`, `vi`, `fr`, and `de`.
- Runtime selection order is JSON `language` → `Accept-Language` → bot language → Korean.
- Message lookup order is resolved request language → bot language → Korean DB message → Korean code fallback.
- Unsupported and blank language values are ignored rather than failing an existing request.
- Existing Korean records and all user-edited message values must be preserved.
- Seed/upsert may insert missing language rows but must never overwrite `message_text`, `status`, or user edits on conflict.
- Existing channel payloads without `language` remain valid.
- Existing conversation flow, classification, training, Queue, persistence, UUID, and channel authentication behavior remain unchanged.
- Browser API requests remain same-origin.
- Each task follows RED → GREEN → targeted regression → commit.

---

### Task 1: Add Shared Language Normalization

**Files:**
- Create: `apps/api/app/core/language.py`
- Create: `apps/api/tests/test_language_resolution.py`

**Interfaces:**
- Produces: `SUPPORTED_LANGUAGE_CODES: tuple[str, ...]`.
- Produces: `normalize_supported_language(value: object) -> str | None`.
- Produces: `language_candidates(request_language: object, accept_language: object, bot_language: object) -> tuple[str, ...]`.

- [ ] **Step 1: Write failing normalization tests**

```python
from app.core.language import language_candidates, normalize_supported_language


def test_normalizes_supported_region_codes() -> None:
    assert normalize_supported_language("en-US") == "en"
    assert normalize_supported_language("ja-JP") == "ja"
    assert normalize_supported_language("zh-CN") == "zh-CN"
    assert normalize_supported_language("ko-KR") == "ko"


def test_accept_language_uses_quality_order_and_ignores_unsupported_values() -> None:
    assert language_candidates(None, "es;q=1, fr-FR;q=0.9, en;q=0.8", "de") == ("fr", "de", "ko")


def test_json_language_precedes_header_and_bot_without_duplicates() -> None:
    assert language_candidates("en-US", "fr-FR", "en") == ("en", "ko")
```

- [ ] **Step 2: Verify RED**

```powershell
cd apps/api
python -m pytest tests/test_language_resolution.py -q
```

Expected: collection FAIL because `app.core.language` does not exist.

- [ ] **Step 3: Implement minimal normalization**

```python
SUPPORTED_LANGUAGE_CODES = ("ko", "en", "zh-CN", "ja", "vi", "fr", "de")

_LANGUAGE_ALIASES = {
    "ko": "ko",
    "en": "en",
    "zh": "zh-CN",
    "zh-cn": "zh-CN",
    "ja": "ja",
    "vi": "vi",
    "fr": "fr",
    "de": "de",
}


def normalize_supported_language(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().replace("_", "-").lower()
    if not normalized:
        return None
    if normalized in _LANGUAGE_ALIASES:
        return _LANGUAGE_ALIASES[normalized]
    return _LANGUAGE_ALIASES.get(normalized.split("-", 1)[0])
```

Parse comma-separated `Accept-Language` values by descending `q` with original order as the tie-break.
Build unique candidates from request, header, bot, and `"ko"`.

- [ ] **Step 4: Verify and commit**

```powershell
python -m pytest tests/test_language_resolution.py -q
```

```bash
git add apps/api/app/core/language.py apps/api/tests/test_language_resolution.py
git commit -m "feat: add runtime language resolution"
```

---

### Task 2: Define Seven-Language Default Messages

**Files:**
- Create: `apps/api/app/services/default_message_catalog.py`
- Modify: `apps/api/app/services/default_messages.py`
- Create: `apps/api/tests/test_default_message_localization.py`

**Interfaces:**
- Produces: `DefaultMessageDefinition(TypedDict)` with `message_name`, `message_text`, and `description`.
- Produces: `DEFAULT_MESSAGE_CATALOGS: dict[str, dict[str, DefaultMessageDefinition]]`, keyed by language then message key.
- Produces: `default_message_text(language: str, message_key: str) -> str`.
- Updates: `get_default_message_text(..., languages: tuple[str, ...] = ("ko",), fallback: str | None = None) -> str`.
- Preserves: `DEFAULT_MESSAGE_FALLBACKS` as the Korean code-safety dictionary alias.

- [ ] **Step 1: Write failing catalog and fallback tests**

```python
from app.services.default_message_catalog import DEFAULT_MESSAGE_CATALOGS
from app.services.default_messages import get_default_message_text


def test_every_default_message_key_exists_in_all_supported_languages() -> None:
    korean_keys = set(DEFAULT_MESSAGE_CATALOGS["ko"])
    assert korean_keys
    assert set(DEFAULT_MESSAGE_CATALOGS) == {"ko", "en", "zh-CN", "ja", "vi", "fr", "de"}
    for messages in DEFAULT_MESSAGE_CATALOGS.values():
        assert set(messages) == korean_keys


def test_message_lookup_follows_language_chain(db_session, organization, default_message_factory) -> None:
    default_message_factory(language="fr", key="system_error", text="Erreur personnalisée")
    default_message_factory(language="ko", key="system_error", text="한국어 사용자 메시지")

    assert get_default_message_text(
        db_session,
        organization.id,
        "system_error",
        languages=("de", "fr", "ko"),
    ) == "Erreur personnalisée"
```

Use the repository's existing DB fixture names; if the generic factories are absent, define local SQLAlchemy fixtures in this test file using `AdminDefaultMessage`.

- [ ] **Step 2: Verify RED**

Expected: missing catalog and unsupported `languages` parameter.

- [ ] **Step 3: Add complete seven-language catalogs**

Define:

```python
class DefaultMessageDefinition(TypedDict):
    message_name: str
    message_text: str
    description: str
```

Move the 14 Korean safety messages from `default_messages.py` into the `message_text` field of
`DEFAULT_MESSAGE_CATALOGS["ko"]`. Add message names, descriptions, and human-reviewed message text for all
14 keys in all six additional languages. Export:

```python
DEFAULT_MESSAGE_FALLBACKS = {
    key: definition["message_text"]
    for key, definition in DEFAULT_MESSAGE_CATALOGS["ko"].items()
}
```

- [ ] **Step 4: Implement ordered DB lookup**

```python
def get_default_message_text(
    db: Session,
    organization_id: UUID,
    message_key: str,
    *,
    languages: tuple[str, ...] = ("ko",),
    fallback: str | None = None,
) -> str:
    fallback_text = fallback if fallback is not None else DEFAULT_MESSAGE_FALLBACKS.get(message_key, "")
    for language in dict.fromkeys((*languages, "ko")):
        message = db.scalar(
            select(AdminDefaultMessage).where(
                AdminDefaultMessage.organization_id == organization_id,
                AdminDefaultMessage.message_key == message_key,
                AdminDefaultMessage.language == language,
                AdminDefaultMessage.status == "active",
                AdminDefaultMessage.deleted_at.is_(None),
            )
        )
        if message is not None and message.message_text.strip():
            return message.message_text.strip()
    return fallback_text
```

Keep a compatibility keyword `language: str | None = None` only if existing call sites require it; normalize it into the first candidate without changing caller behavior.

- [ ] **Step 5: Verify and commit**

```powershell
python -m pytest tests/test_default_message_localization.py -q
```

```bash
git add apps/api/app/services/default_message_catalog.py apps/api/app/services/default_messages.py apps/api/tests/test_default_message_localization.py
git commit -m "feat: add seven-language default message catalog"
```

---

### Task 3: Ensure Missing Language Rows Without Overwriting User Values

**Files:**
- Modify: `apps/api/app/api/routes/admin.py`
- Test: `apps/api/tests/test_default_message_localization.py`

**Interfaces:**
- Consumes: `DEFAULT_MESSAGE_CATALOGS`.
- Updates: `_default_message_definition(message_key: str, language: str = "ko")`.
- Updates: `_ensure_default_messages(db: Session, organization: Organization)`.

- [ ] **Step 1: Write failing preservation tests**

```python
def test_ensure_default_messages_creates_every_language_without_overwriting_existing_text(
    db_session, organization, default_message_factory
) -> None:
    existing = default_message_factory(
        language="en",
        key="system_error",
        text="Operator edited English message",
        status="inactive",
    )

    _ensure_default_messages(db_session, organization)
    db_session.flush()
    db_session.refresh(existing)

    rows = db_session.scalars(
        select(AdminDefaultMessage).where(
            AdminDefaultMessage.organization_id == organization.id,
            AdminDefaultMessage.message_key == "system_error",
        )
    ).all()
    assert {row.language for row in rows} == {"ko", "en", "zh-CN", "ja", "vi", "fr", "de"}
    assert existing.message_text == "Operator edited English message"
    assert existing.status == "inactive"
```

- [ ] **Step 2: Verify RED**

Expected: only Korean is ensured.

- [ ] **Step 3: Change upsert to insert-only user values**

Loop over every language and definition. On conflict update only protected metadata fields:

```python
.on_conflict_do_update(
    index_elements=["organization_id", "message_key", "language"],
    set_={
        "message_name": localized_definition["message_name"],
        "category": item["category"],
        "description": localized_definition["description"],
        "deleted_at": None,
        "updated_at": datetime.now(timezone.utc),
    },
)
```

Do not include `message_text`, `status`, `scope`, or `updated_by` in `set_`.
Make `_build_default_message_json` and restore use the row's language-specific system default.

- [ ] **Step 4: Verify and commit**

Run localization tests and the relevant Admin API tests. Commit:

```bash
git add apps/api/app/api/routes/admin.py apps/api/tests/test_default_message_localization.py
git commit -m "feat: ensure localized default messages safely"
```

---

### Task 4: Add Admin Language Filtering and Localized Message Editing

**Files:**
- Modify: `apps/api/app/api/routes/admin.py`
- Modify: `apps/web/lib/admin-api.ts`
- Create: `apps/web/lib/i18n/default-messages.ts`
- Modify: `apps/web/app/admin/default-messages/page.tsx`
- Test: `apps/api/tests/test_default_message_localization.py`
- Test: `apps/api/tests/test_multilingual_support_contract.py`

**Interfaces:**
- Adds Admin query parameter: `language: str | None`.
- Adds web filter field: `AdminDefaultMessageFilter.language?: SupportedLanguage`.
- Produces: `DEFAULT_MESSAGES_CATALOGS: Record<SupportedLanguage, DefaultMessagesCatalog>`.

- [ ] **Step 1: Write failing API and UI contracts**

```python
def test_admin_default_messages_accepts_language_filter() -> None:
    source = (ROOT_DIR / "apps/api/app/api/routes/admin.py").read_text(encoding="utf-8")
    assert 'language: str | None = Query(default=None)' in source
    assert "AdminDefaultMessage.language == language" in source


def test_default_message_admin_screen_uses_language_filter_and_seven_language_catalog() -> None:
    page_source = (ROOT_DIR / "apps/web/app/admin/default-messages/page.tsx").read_text(encoding="utf-8")
    catalog_source = (ROOT_DIR / "apps/web/lib/i18n/default-messages.ts").read_text(encoding="utf-8")
    assert "SUPPORTED_LANGUAGES" in page_source
    assert "language: appliedLanguage" in page_source
    assert "DEFAULT_MESSAGES_CATALOGS[uiLanguage]" in page_source
    assert "satisfies Record<SupportedLanguage, DefaultMessagesCatalog>" in catalog_source
```

- [ ] **Step 2: Verify RED**

Expected: no language filter and missing catalog.

- [ ] **Step 3: Add API language filter**

Normalize with `normalize_supported_language`. If a non-empty unsupported value is supplied, return HTTP 422.
Apply SQL filtering before serialization:

```python
if language:
    normalized_language = normalize_supported_language(language)
    if normalized_language is None:
        raise HTTPException(status_code=422, detail="Unsupported language.")
    messages = [message for message in messages if message.language == normalized_language]
```

- [ ] **Step 4: Add UI language filter and localized controls**

Use `SUPPORTED_LANGUAGES` for the filter dropdown and language labels. Keep the edit form language read-only.
Pass the selected language to all list/reload requests:

```ts
fetchDefaultMessages(token, {
  category: appliedCategory || undefined,
  status: appliedStatus || undefined,
  language: appliedLanguage,
});
```

Localize title, search, columns, category/status/scope labels, upload/download, modal, save/restore,
errors, count text, and CSV filename. Keep stable CSV header aliases for backward compatibility.

- [ ] **Step 5: Verify and commit**

Run both test files and Next build. Commit:

```bash
git add apps/api/app/api/routes/admin.py apps/web/lib/admin-api.ts apps/web/lib/i18n/default-messages.ts apps/web/app/admin/default-messages/page.tsx apps/api/tests/test_default_message_localization.py apps/api/tests/test_multilingual_support_contract.py
git commit -m "feat: manage default messages by language"
```

---

### Task 5: Resolve Request Language at Channel Entry Points

**Files:**
- Modify: `apps/api/app/api/routes/channels.py`
- Modify: `apps/web/lib/studio-bots-api.ts`
- Test: `apps/api/tests/test_language_resolution.py`
- Test: `apps/api/tests/test_channel_runtime_flow.py`
- Test: `apps/api/tests/test_multilingual_support_contract.py`

**Interfaces:**
- Adds optional `language: str | None` to `ChannelRoomCreateRequest` and `ChannelMessageRequest`.
- Adds helper: `_message_language_candidates(payload_language, accept_language, bot) -> tuple[str, ...]`.
- Updates: `_load_default_messages(db, organization_id, languages)`.

- [ ] **Step 1: Write failing request-priority tests**

```python
def test_channel_message_language_priority_uses_json_then_header_then_bot() -> None:
    bot = SimpleNamespace(data_json={"language": "de"})
    assert _message_language_candidates("fr-FR", "en-US", bot) == ("fr", "de", "ko")
    assert _message_language_candidates(None, "en-US", bot) == ("en", "de", "ko")
    assert _message_language_candidates(None, None, bot) == ("de", "ko")


def test_channel_payloads_remain_backward_compatible() -> None:
    assert ChannelRoomCreateRequest(bot_id="bot-id").language is None
    assert ChannelMessageRequest(message="hello").language is None
```

- [ ] **Step 2: Verify RED**

Expected: payload models have no language field and helper is absent.

- [ ] **Step 3: Add language fields and request header access**

Add:

```python
language: str | None = Field(default=None, max_length=35)
```

Use `request.headers.get("accept-language")` in room creation and message handling. Resolve language after
the bot is loaded. Do not reject unsupported values; `language_candidates` ignores them.

- [ ] **Step 4: Pass language candidates through every default-message load**

Change:

```python
def _load_default_messages(
    db: Session,
    organization_id: Any,
    languages: tuple[str, ...],
) -> dict[str, str]:
    return {
        key: get_default_message_text(
            db,
            organization_id,
            key,
            languages=languages,
            fallback=fallback,
        )
        for key, fallback in DEFAULT_MESSAGE_FALLBACKS.items()
    }
```

At room creation, initial message serialization, message execution, fallback intent handling, Kakao webhook,
and simulator entry points, derive the same candidate order. Persist the resolved language in room
`metadata_json["language"]` so subsequent requests without an explicit language keep the request/session choice;
if absent, fall back to the active bot language.

- [ ] **Step 5: Add `language` to Studio Bot Test requests**

When the simulator sends room creation or message requests, include the current bot language, not the UI language:

```ts
language: bot.language,
```

Keep the API path relative and do not add public environment variables.

- [ ] **Step 6: Verify and commit**

```powershell
cd apps/api
python -m pytest tests/test_language_resolution.py tests/test_default_message_localization.py tests/test_channel_runtime_flow.py tests/test_multilingual_support_contract.py -q
```

Commit:

```bash
git add apps/api/app/api/routes/channels.py apps/web/lib/studio-bots-api.ts apps/api/tests/test_language_resolution.py apps/api/tests/test_channel_runtime_flow.py apps/api/tests/test_multilingual_support_contract.py
git commit -m "feat: resolve channel message language"
```

---

### Task 6: Verify Fallback End to End

**Files:**
- Modify: `apps/api/tests/test_default_message_localization.py`
- Modify only on failure: owning runtime or Admin files from Tasks 1–5.

**Interfaces:**
- Verifies the complete approved fallback chain.

- [ ] **Step 1: Add end-to-end fallback matrix**

```python
@pytest.mark.parametrize(
    ("request_language", "accept_language", "bot_language", "available", "expected"),
    [
        ("fr", "en", "de", {"fr": "FR", "de": "DE", "ko": "KO"}, "FR"),
        (None, "en-US", "de", {"en": "EN", "de": "DE", "ko": "KO"}, "EN"),
        ("es", None, "de", {"de": "DE", "ko": "KO"}, "DE"),
        ("fr", None, "de", {"ko": "KO"}, "KO"),
        ("fr", None, "de", {}, DEFAULT_MESSAGE_CATALOGS["ko"]["system_error"]["message_text"]),
    ],
)
def test_runtime_default_message_fallback_matrix(
    db_session, organization, default_message_factory,
    request_language, accept_language, bot_language, available, expected
) -> None:
    for language, text in available.items():
        default_message_factory(language=language, key="system_error", text=text)
    candidates = language_candidates(request_language, accept_language, bot_language)
    assert get_default_message_text(
        db_session,
        organization.id,
        "system_error",
        languages=candidates,
    ) == expected
```

- [ ] **Step 2: Run API regression suites**

```powershell
cd apps/api
python -m pytest tests/test_language_resolution.py tests/test_default_message_localization.py tests/test_channel_runtime_flow.py tests/test_channel_conversation_history_storage.py tests/test_admin_operations_dashboard.py tests/test_multilingual_support_contract.py tests/test_multilingual_nlu_contract.py -q
```

Expected: all tests PASS; no existing channel flow assertion changes.

- [ ] **Step 3: Run web production build**

```powershell
cd apps/web
npm run build
```

Expected: exit code `0`.

- [ ] **Step 4: Verify operating behavior without changing production data**

In a test organization or local DB:

- Confirm 14 message keys × 7 languages exist.
- Edit one English message and rerun ensure/seed; confirm the edit remains.
- Request French explicitly and confirm French output.
- Omit JSON language with English `Accept-Language`; confirm English output.
- Omit both; confirm bot-language output.
- Disable that language row; confirm bot language, Korean DB, then code fallback order.

- [ ] **Step 5: Check same-origin and diff**

```bash
git diff --check
git status --short
```

Confirm the browser Network contains only CGA same-origin API paths and no internal API hostname.
Commit any test-driven correction only with its owning test:

```bash
git commit -m "fix: complete runtime message fallback"
```
