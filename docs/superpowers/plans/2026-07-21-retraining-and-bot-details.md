# 재학습 대화 이력 및 봇 상세 엔진 정보 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 재학습 이력 조회의 422 오류를 제거하고 선택 작업 버전의 AI 설정 네 항목을 봇 상세 화면에 표시한다.

**Architecture:** 대화 이력은 기존 same-origin API 함수를 100건 단위로 반복 호출하는 전용 집계 함수로 감싼다. 봇 상세 정보는 버전 설정을 우선하고 봇 설정을 대체값으로 사용하는 순수 판독 함수를 공유 모듈에 둔다.

**Tech Stack:** Next.js, React, TypeScript, FastAPI 계약 테스트(pytest)

## Global Constraints

- API의 `page_size <= 100` 기준을 변경하지 않는다.
- 브라우저 요청은 기존 same-origin 상대 경로를 유지한다.
- 기존 화면 페이지 크기, 필터, 정렬, 저장 동작을 변경하지 않는다.
- 관련 없는 파일을 수정하지 않는다.

---

### Task 1: 재학습 대화 이력 전체 페이지 조회

**Files:**
- Modify: `apps/web/lib/admin-api.ts`
- Modify: `apps/web/components/retraining-page.tsx`
- Test: `apps/api/tests/test_retraining_history_ui_contract.py`

**Interfaces:**
- Consumes: `fetchConversationHistory(token, filters)`와 `AdminHistoryResponse<AdminConversationHistoryItem>`
- Produces: `fetchAllConversationHistory(token, filters)`가 전체 항목을 합친 동일 응답 형식을 반환

- [ ] **Step 1: 500 고정 요청을 금지하고 전체 조회 함수 사용을 요구하는 실패 테스트 작성**
- [ ] **Step 2: `pytest apps/api/tests/test_retraining_history_ui_contract.py -q`를 실행하여 기존 코드에서 실패 확인**
- [ ] **Step 3: `pageSize: 100`, `page: 1..N`으로 순차 조회하고 `items`를 합치는 최소 함수 구현**
- [ ] **Step 4: 초기 조회와 동기화 조회를 새 함수로 교체**
- [ ] **Step 5: 회귀 테스트를 다시 실행하여 통과 확인**

### Task 2: 봇 상세 AI 설정 표시

**Files:**
- Modify: `apps/web/components/bot-operation-shared.ts`
- Modify: `apps/web/components/bot-management-page.tsx`
- Test: `apps/api/tests/test_bot_operations_workspace_ui_contract.py`

**Interfaces:**
- Consumes: `StudioBotVersionApiItem.system_config.ai_config`, `StudioBotApiItem.data_json`
- Produces: 선택 버전 우선의 `readOperationAiDetails(bot, version)` 결과 `{ nluType, nluModel, answerMode, llmModel }`

- [ ] **Step 1: 네 항목과 버전 우선 판독 함수를 요구하는 실패 테스트 작성**
- [ ] **Step 2: 대상 pytest를 실행하여 기존 코드에서 실패 확인**
- [ ] **Step 3: 버전 우선·봇 대체값 규칙을 적용한 판독 함수 구현**
- [ ] **Step 4: `봇 상세 정보 및 호환 운영` 정의 목록에 네 항목 표시**
- [ ] **Step 5: 대상 pytest를 다시 실행하여 통과 확인**

### Task 3: 통합 검증 및 커밋

**Files:**
- Verify: `apps/web`
- Verify: 수정된 테스트 파일

**Interfaces:**
- Consumes: Task 1과 Task 2 결과
- Produces: 빌드 및 회귀 테스트 증거

- [ ] **Step 1: 관련 pytest 전체 실행**
- [ ] **Step 2: `npm run build`를 실행하여 Next.js 빌드 확인**
- [ ] **Step 3: `git diff --check`와 수정 파일 목록 확인**
- [ ] **Step 4: 구현 변경을 의미 단위로 커밋**
