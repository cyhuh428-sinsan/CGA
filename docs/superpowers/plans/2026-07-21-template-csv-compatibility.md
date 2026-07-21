# Template CSV Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aidot 템플릿 CSV의 `SM_CHAT/WEBCHAT + carousel` 행을 정상 반영하고, 개별 행 오류가 나머지 업로드와 목록 새로고침을 막지 않도록 한다.

**Architecture:** 기존 관리자 템플릿 API와 순차 업로드 구조를 유지한다. 서버 유효성 검사의 KAKAO 전용 렌더러 집합만 실제 채널 데이터와 맞추고, 웹 업로더는 행별 요청 오류를 수집한 뒤 전체 처리 결과를 표시하고 목록을 다시 조회한다.

**Tech Stack:** FastAPI, pytest, Next.js, React, TypeScript, 소스 계약 테스트

## Global Constraints

- 기존 템플릿 데이터와 DB 스키마를 변경하지 않는다.
- `SM_CHAT`과 `WEBCHAT`에서 `carousel`을 허용한다.
- `simple-text`, `quick-reply`, `basic-card`, `list-card`의 KAKAO 전용 제한은 유지한다.
- 기존 CSV 열 구조와 등록/수정 판정은 유지한다.
- 업로드 실패 행의 위치와 원인을 화면에 표시한다.
- 관련 없는 관리자 기능과 API 경로는 변경하지 않는다.

---

### Task 1: 채널별 Carousel 검증 정상화

**Files:**
- Modify: `apps/api/tests/test_admin_operations_dashboard.py:356-375`
- Modify: `apps/api/app/api/routes/admin.py:885-901`

**Interfaces:**
- Consumes: `_template_renderer_issues(channel_code: str, renderer_type: str) -> list[str]`
- Produces: `SM_CHAT/WEBCHAT + carousel`에 빈 이슈 목록을 반환하는 검증 규칙

- [ ] **Step 1: 실패하는 API 단위 테스트 작성**

기존 비-KAKAO 테스트에 실제 허용 사례를 추가한다.

```python
assert admin._template_renderer_issues(channel_code="SM_CHAT", renderer_type="carousel") == []
assert admin._template_renderer_issues(channel_code="WEBCHAT", renderer_type="carousel") == []
```

- [ ] **Step 2: 테스트가 현재 규칙에서 실패하는지 확인**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m pytest apps/api/tests/test_admin_operations_dashboard.py -k template_renderer_issues -q`

Expected: 두 `carousel` 허용 단언이 현재 KAKAO 전용 오류를 반환하여 FAIL.

- [ ] **Step 3: 최소 서버 수정**

KAKAO 전용으로 차단할 렌더러에서 `carousel`을 제외한다.

```python
if normalized_renderer_type in {"simple-text", "quick-reply", "basic-card", "list-card"}:
    return ["카카오 전용 템플릿은 KAKAO 채널에서만 사용할 수 있습니다."]
```

- [ ] **Step 4: 대상 API 테스트 통과 확인**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m pytest apps/api/tests/test_admin_operations_dashboard.py -k template_renderer_issues -q`

Expected: 관련 테스트 전체 PASS.

---

### Task 2: CSV 행별 실패 처리와 결과 새로고침

**Files:**
- Create: `apps/api/tests/test_admin_template_upload_ui_contract.py`
- Modify: `apps/web/app/admin/templates/page.tsx:357-408`

**Interfaces:**
- Consumes: 기존 `parseCsv`, `createTemplate`, `updateTemplate`, `reload`
- Produces: 행별 실패 수집, 성공/제외/실패 요약, 처리 후 목록 재조회

- [ ] **Step 1: 실패하는 Web 소스 계약 테스트 작성**

```python
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]


def test_template_csv_upload_continues_after_row_failure_and_reloads() -> None:
    source = (ROOT_DIR / "apps/web/app/admin/templates/page.tsx").read_text(encoding="utf-8")

    assert "const failedRows: string[] = [];" in source
    assert "for (const [rowIndex, row] of dataRows.entries())" in source
    assert "failedRows.push" in source
    assert "건 실패" in source
    assert source.index("await reload();", source.index("async function handleUpload")) < source.index(
        "setNoticeMessage(summary)", source.index("async function handleUpload")
    )
```

- [ ] **Step 2: 계약 테스트가 실패하는지 확인**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m pytest apps/api/tests/test_admin_template_upload_ui_contract.py -q`

Expected: 행별 실패 수집 구조가 없어 FAIL.

- [ ] **Step 3: 업로드 루프를 행별 오류 처리로 변경**

`handleUpload`에서 필수값 제외와 저장 요청을 유지하되 저장 요청만 내부 `try/catch`로 감싼다.

```tsx
const failedRows: string[] = [];

for (const [rowIndex, row] of dataRows.entries()) {
  const [channel, name, rendererType, itemTypes, statusLabel, , , description] = row;
  // 기존 필수값 검사와 payload 생성 유지
  try {
    // 기존 updateTemplate/createTemplate 분기 유지
    savedCount += 1;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "알 수 없는 오류";
    failedRows.push(`${rowIndex + 2}행 ${channel}/${name}: ${reason}`);
  }
}

await reload();
const summary = `${savedCount}건 반영, ${skippedCount}건 제외, ${failedRows.length}건 실패되었습니다.`
  + (failedRows[0] ? ` ${failedRows[0]}` : "");
setNoticeMessage(summary);
```

헤더가 없는 파일의 행 번호는 `rowIndex + 1`, 헤더가 있으면 `rowIndex + 2`가 되도록 `hasHeader` 값을 사용한다.

- [ ] **Step 4: Web 계약 테스트 통과 확인**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m pytest apps/api/tests/test_admin_template_upload_ui_contract.py -q`

Expected: PASS.

- [ ] **Step 5: API 관련 회귀 테스트 확인**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m pytest apps/api/tests/test_admin_operations_dashboard.py apps/api/tests/test_admin_template_upload_ui_contract.py -q`

Expected: 전체 PASS.

- [ ] **Step 6: Web 프로덕션 빌드 확인**

Run: `npm run build --prefix apps/web`

Expected: Next.js 프로덕션 빌드 성공, TypeScript 오류 없음.

- [ ] **Step 7: 구현 커밋**

```bash
git add apps/api/app/api/routes/admin.py apps/api/tests/test_admin_operations_dashboard.py apps/api/tests/test_admin_template_upload_ui_contract.py apps/web/app/admin/templates/page.tsx
git commit -m "fix: import Aidot template CSV rows"
```

---

### Task 3: 최종 검증

**Files:**
- Verify: `apps/api/app/api/routes/admin.py`
- Verify: `apps/web/app/admin/templates/page.tsx`

**Interfaces:**
- Consumes: 수정된 API 검증과 Web 업로드 처리
- Produces: 원본 CSV 호환성 및 관련 없는 변경 부재에 대한 검증 결과

- [ ] **Step 1: 원본 CSV의 차단 대상 재검사**

Run: PowerShell `Import-Csv`로 `SM_CHAT/WEBCHAT + carousel` 두 행을 확인한다.

Expected: 두 행 모두 새 서버 규칙에서 허용 대상이다.

- [ ] **Step 2: 최종 diff와 작업 트리 확인**

Run: `git diff --check HEAD^..HEAD` 및 `git status --short`

Expected: 공백 오류가 없고 계획된 파일만 변경·커밋되어 있다.
