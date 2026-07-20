# Workspace Diagnostics Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 봇 작업공간 오른쪽 열에 실제 평가 스냅샷 기반 진단 패널 3개를 표시하고 현재 선택 봇을 여는 전역 시뮬레이터 버튼을 유지한다.

**Architecture:** 기존 `fetchStudioWorkspaceContext` 응답의 선택 버전 문서에서 평가 행을 방어적으로 정규화하고 컴포넌트 내부 파생 상태로 진단 목록을 계산한다. 새 API는 추가하지 않으며, 시뮬레이터 실행기에 선택적 봇 UUID/버전 속성을 추가해 `/studio/workspace`처럼 동적 URL 매개변수가 없는 화면에서도 현재 봇을 연다.

**Tech Stack:** Next.js, React, TypeScript, CSS, pytest 기반 소스 계약 테스트

## Global Constraints

- 브라우저 API 요청은 기존 same-origin 경로를 유지한다.
- 별도 API와 새 의존성을 추가하지 않는다.
- 봇 선택, 최근 작업, 작업 항목, 저장, 상세 화면 이동 동작은 변경하지 않는다.
- 진단 영역은 세로로 같은 높이의 3개 패널이다.
- 시뮬레이터 버튼은 화면 오른쪽 아래의 전역 고정 버튼이다.
- 화면 기준은 1920×1080, 기본 폰트는 12px이다.

---

### Task 1: 작업공간 진단 UI 계약 테스트

**Files:**
- Create: `apps/api/tests/test_bot_operations_workspace_ui_contract.py`
- Test: `apps/api/tests/test_bot_operations_workspace_ui_contract.py`

**Interfaces:**
- Consumes: `BotOperationsWorkspacePage`, `SimulatorFloatingLauncher`
- Produces: 진단 제목, 평가 기준, 현재 봇 전달, 정적 미리보기 제거를 고정하는 회귀 계약

- [ ] **Step 1: 실패하는 계약 테스트 작성**

```python
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]


def _read(relative_path: str) -> str:
    return (ROOT_DIR / relative_path).read_text(encoding="utf-8")


def test_workspace_renders_three_evaluation_diagnostics() -> None:
    workspace = _read("apps/web/components/bot-operations-workspace-page.tsx")

    assert "오분류 문장" in workspace
    assert "낮은 Score 문장" in workspace
    assert "유사 의도 충돌" in workspace
    assert "training_rows" in workspace
    assert "row.score < 70" in workspace
    assert "!row.correct" in workspace
    assert "시뮬레이터 미리보기" not in workspace


def test_workspace_simulator_launcher_receives_selected_bot_context() -> None:
    workspace = _read("apps/web/components/bot-operations-workspace-page.tsx")
    simulator = _read("apps/web/components/simulator-page.tsx")

    assert "<SimulatorFloatingLauncher" in workspace
    assert "botIdOverride={selectedBot.id}" in workspace
    assert "versionIdOverride={versionName}" in workspace
    assert "botIdOverride?: string;" in simulator
    assert "versionIdOverride?: string;" in simulator
    assert "<SimulatorPage" in simulator
    assert "botIdOverride={botIdOverride}" in simulator
    assert "versionIdOverride={versionIdOverride}" in simulator
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m pytest apps/api/tests/test_bot_operations_workspace_ui_contract.py -q`

Expected: 새 진단 문구와 실행기 속성이 아직 없어 FAIL.

- [ ] **Step 3: 테스트 파일 커밋은 구현과 함께 수행**

Task 2의 최소 구현이 통과한 뒤 관련 코드와 함께 한 커밋으로 묶는다.

---

### Task 2: 평가 스냅샷 진단 패널과 시뮬레이터 컨텍스트 구현

**Files:**
- Modify: `apps/web/components/bot-operations-workspace-page.tsx`
- Modify: `apps/web/components/simulator-page.tsx`
- Modify: `apps/web/app/globals.css`
- Test: `apps/api/tests/test_bot_operations_workspace_ui_contract.py`

**Interfaces:**
- Consumes: `selectedVersion.version_json.system_config.nlu_evaluation.snapshot.training_rows`
- Produces: `WorkspaceEvaluationRow[]`, `WorkspaceCollision[]`, `SimulatorFloatingLauncher({ startDialogId, botIdOverride, versionIdOverride })`

- [ ] **Step 1: 평가 행 정규화와 진단 파생값 구현**

`bot-operations-workspace-page.tsx`에 다음 화면 전용 타입과 순수 함수를 추가한다.

```tsx
type WorkspaceEvaluationRow = {
  id: string;
  utterance: string;
  expectedName: string;
  predictedName: string;
  score: number;
  correct: boolean;
};

function readWorkspaceEvaluationRows(version: StudioBotVersionApiItem | null): WorkspaceEvaluationRow[] {
  const versionJson = asRecord(version?.version_json);
  const systemConfig = asRecord(versionJson.system_config);
  const evaluation = asRecord(systemConfig.nlu_evaluation);
  const snapshot = asRecord(evaluation.snapshot);
  const rows = Array.isArray(snapshot.training_rows) ? snapshot.training_rows : [];

  return rows.flatMap((value, index) => {
    const row = asRecord(value);
    if (typeof row.utterance !== "string" || typeof row.score !== "number" || typeof row.correct !== "boolean") return [];
    return [{
      id: typeof row.id === "string" ? row.id : String(index + 1),
      utterance: row.utterance,
      expectedName: readText(row, ["expectedName", "expected_name"]),
      predictedName: readText(row, ["predictedName", "predicted_name"]),
      score: row.score,
      correct: row.correct,
    }];
  });
}
```

`useMemo`로 다음 값을 계산한다.

```tsx
const evaluationRows = useMemo(() => readWorkspaceEvaluationRows(selectedVersion), [selectedVersion]);
const misclassifiedRows = useMemo(() => evaluationRows.filter((row) => !row.correct).slice(0, 10), [evaluationRows]);
const lowScoreRows = useMemo(() => evaluationRows.filter((row) => row.score < 70).slice(0, 10), [evaluationRows]);
const collisions = useMemo(() => buildWorkspaceCollisions(evaluationRows), [evaluationRows]);
```

- [ ] **Step 2: 정적 미리보기를 세 진단 패널로 교체**

오른쪽 aside를 다음 구조로 교체한다.

```tsx
<aside className="cga-workspace-diagnostics" aria-label="평가 진단">
  <WorkspaceMisclassifiedPanel rows={misclassifiedRows} />
  <WorkspaceLowScorePanel rows={lowScoreRows} />
  <WorkspaceCollisionPanel rows={collisions} />
</aside>
{selectedBot && selectedVersion ? (
  <SimulatorFloatingLauncher botIdOverride={selectedBot.id} versionIdOverride={versionName} />
) : null}
```

각 패널은 제목과 기존 평가 화면과 동일한 열 구성을 사용하고 데이터가 없으면 설계서의 빈 상태 문구를 표시한다.

- [ ] **Step 3: 실행기에 선택적 봇/버전 속성 연결**

`simulator-page.tsx`의 실행기 인터페이스를 확장한다.

```tsx
type SimulatorFloatingLauncherProps = {
  startDialogId?: string;
  botIdOverride?: string;
  versionIdOverride?: string;
};

export function SimulatorFloatingLauncher({
  startDialogId = "",
  botIdOverride = "",
  versionIdOverride = "",
}: SimulatorFloatingLauncherProps) {
  // 기존 open 상태와 버튼은 유지
  return open ? (
    <SimulatorPage
      embedded
      startDialogId={startDialogId}
      botIdOverride={botIdOverride}
      versionIdOverride={versionIdOverride}
      onClose={() => setOpen(false)}
    />
  ) : null;
}
```

- [ ] **Step 4: 세로 3등분 CSS 구현 및 정적 미리보기 CSS 제거**

`globals.css`에서 `.cga-workspace-simulator-*` 규칙을 제거하고 다음 범위의 스타일을 추가한다.

```css
.cga-workspace-diagnostics {
  min-height: 0;
  display: grid;
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.cga-workspace-diagnostic-panel {
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  overflow: hidden;
}

.cga-workspace-diagnostic-body {
  min-height: 0;
  overflow: auto;
}
```

기존 `.cga-operation-panel`의 경계·배경 스타일을 재사용하고, 표 열은 각 진단 내용에 맞게 CSS 변수로 지정한다.

- [ ] **Step 5: 계약 테스트 통과 확인**

Run: `C:\Users\cyhuh\anaconda3\python.exe -m pytest apps/api/tests/test_bot_operations_workspace_ui_contract.py apps/api/tests/test_bot_configure_ui_contract.py -q`

Expected: 전체 PASS.

- [ ] **Step 6: 타입 검사와 프로덕션 빌드 확인**

Run: `npm run build --prefix apps/web`

Expected: Next.js production build 성공, TypeScript 오류 없음.

- [ ] **Step 7: 구현 커밋**

```bash
git add apps/api/tests/test_bot_operations_workspace_ui_contract.py apps/web/components/bot-operations-workspace-page.tsx apps/web/components/simulator-page.tsx apps/web/app/globals.css docs/superpowers/specs/2026-07-21-workspace-diagnostics-panel-design.md
git commit -m "feat: add workspace evaluation diagnostics"
```

---

### Task 3: 실제 브라우저 동작 검증

**Files:**
- Verify: `apps/web/components/bot-operations-workspace-page.tsx`
- Verify: `apps/web/components/simulator-page.tsx`
- Verify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: 로컬 운영 유사 웹 서버와 인증된 `/studio/workspace`
- Produces: 1920×1080 화면, 시뮬레이터 클릭, Network 요청 URL 검증 결과

- [ ] **Step 1: 로컬 웹 서버 실행 상태 확인**

Run: `Get-NetTCPConnection -LocalPort 3320 -State Listen`

Expected: LISTENING 프로세스 확인. 없으면 `npm run dev --prefix apps/web`을 숨김 창으로 실행한다.

- [ ] **Step 2: 인증된 브라우저에서 작업공간 확인**

Open: `http://localhost:3320/studio/workspace`

Expected: 오른쪽에 같은 높이의 `오분류 문장`, `낮은 Score 문장`, `유사 의도 충돌` 패널이 보이고 정적 `시뮬레이터 미리보기`는 보이지 않는다.

- [ ] **Step 3: 시뮬레이터 버튼 클릭 확인**

오른쪽 아래 얼굴 버튼을 클릭한다.

Expected: 현재 선택된 봇 UUID와 버전으로 시뮬레이터 팝업이 열리고 닫기 동작이 정상이다.

- [ ] **Step 4: Network 확인**

Expected: 새 요청은 same-origin `/api/...` 경로이며 브라우저에서 localhost API 포트, Docker 내부 호스트명, 내부 API 절대주소 직접 호출이 없다.

- [ ] **Step 5: 최종 diff 확인**

Run: `git diff --check HEAD^..HEAD && git status --short`

Expected: 공백 오류 없음. 의도한 파일 외 변경 없음.
