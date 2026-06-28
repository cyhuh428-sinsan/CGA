# CGA 작업 진행 기록

## 2026-06-28

### Aidot 재배치 원칙 확정 및 봇 설정 가짜 데이터 제거 시작

- 신산님 기준을 작업 원칙으로 확정했다.
- `봇관리`, `봇 작업공간`, `팀 대시보드` 3개 화면만 CGA에서 신규로 설계한다.
- 그 외 화면은 CGA식 재해석을 중단하고, Aidot 화면/로직을 그대로 가져와 재배치하는 방향으로 고정한다.
- `apps/studio/app.js`의 `02 봇 설정` 서브 메뉴를 Aidot 기준으로 다시 정렬했다.
  - `메시지 설정`
  - `메신저 편의 기능`
  - `추천 의도`
  - `제외/무시 목록 설정`
  - `룰 설정`
  - `스몰토크`
  - `봇스테이션`
- 봇 설정 화면에서 실제 데이터가 없는 상태인데도 진짜처럼 보이던 샘플 데이터를 제거하기 시작했다.
  - `currentRuleAssets`
  - `currentBlocklistAssets`
  - `currentFloatingButtonAssets`
  - `currentSmallTalkAssets`
  를 기본 빈 배열로 변경했다.
- `renderConfigureAidotScreen()`도 요약형/샘플형 화면에서 Aidot형 목록/편집 흐름으로 바꾸는 중이다.
  - 메시지 설정: 항목별 사용 여부, 메시지/모듈 연결 선택 구조로 조정
  - 메신저 편의 기능: 플로팅 버튼 목록 + 편집 입력 영역 구조로 조정
  - 추천 의도: 별도 화면으로 분리
  - 제외/무시, 룰, 스몰토크, 봇스테이션: 샘플 행 제거 및 빈 상태 기준으로 변경
- `apps/studio/styles.css`에 Aidot 설정 화면용 입력/텍스트영역/메시지 항목/블록 간격 스타일을 추가해, CGA 기본 폼 스타일이 그대로 섞이던 문제를 줄이기 시작했다.

### 현재 주의사항

- 아직 `02 봇 설정` 전체가 Aidot 100% 복제 상태는 아니다.
- 현재 단계는
  - CGA식 임의 화면 제거
  - 가짜 데이터 제거
  - Aidot 메뉴/배치/편집 흐름 정렬
  순으로 진행 중이다.
- 다음 작업은 Aidot 각 설정 화면의 본문 구조와 조작 흐름을 더 직접적으로 복사하는 것이다.

## 2026-06-18

### Studio 검증 오류 정리 (동적 i18n)

- `npm run studio:validate` 마지막 단계에서 반복적으로 `studio:dynamic-i18n-check`가 `"Studio must reapply locale after dynamic content render"` 조건으로 실패하는 문제가 있었음.
- 원인: `cga:content-rendered` 이벤트 리스너가 래퍼 화살표 함수로 등록되어 있어 검증 스크립트의 문자열 매칭 조건(`document.addEventListener("cga:content-rendered", syncStudioLocaleToCurrentUser)`)과 정확히 일치하지 않았음.
- 조치:
  - `apps/studio/app.js`의 `syncStudioLocaleToCurrentUser()`에 `scheduleActiveScreenVisibility()` 호출을 보강해 동적 렌더 후 화면 표시 동기화를 유지.
  - `document.addEventListener("cga:content-rendered", () => { ... })`를 `document.addEventListener("cga:content-rendered", syncStudioLocaleToCurrentUser)`로 변경.
- 검증 결과:
  - `npm run studio:validate` 전체 통과.
  - 주요 스크립트: `studio:config-check`, `studio:i18n-*`, `studio:dynamic-i18n-check` 모두 통과.

## 2026-06-19

### 테스트/평가/재학습/분석 화면의 비작동 UI 1차 제거

- `apps/studio/app.js`의 `renderTestAidotScreen()`에서 시뮬레이터 헤더 메뉴, 카드 템플릿 버튼, 툴 버튼을 제거해 실제 동작과 무관한 조작 요소를 정리.
- `renderEvaluateAidotScreen()`에서 작동 바인딩이 없는 `평가정보/다운로드`, `토글`, `행렬 제어` 관련 버튼을 제거.
- `renderOperateAidotScreen()`에서 조회 필터 하단의 `초기화`, `확인`, `재학습`/`의도 생성`/`보류`/`삭제` 계열의 비작동 액션을 제거.
- `renderAnalysisAidotScreen()`에서 월 이동/차트 이동/페이지 버튼을 제거해 현재 데이터 표시는 유지하고 조작 오탐성을 낮춤.
- 스타일/스크립트 유효성은 유지하고, 화면 렌더는 기존 데이터 표시 중심 흐름으로 정리.
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `npm run studio:validate` 통과

## 2026-06-12

### 그룹 관리와 공통 조회 페이징 보완

- 그룹 관리 화면에 Aidot형 상단 우측 버튼으로 `+ 그룹 생성`을 추가했다.
- 그룹 관리 화면에서 다운로드 버튼은 기본 동작에서 제외한다.
- 그룹 생성은 목록 화면 안에서 직접 수정하지 않고, 그룹 상세/수정 팝업을 열어 `그룹 아이디`, `그룹 이름`, `사용 여부`를 확인한 뒤 저장하는 흐름으로 정리했다.
- System Administration의 공통 조회 테이블에 페이지 크기 `10, 25, 50, 100`을 적용했다.
- 공통 조회 테이블은 선택한 페이지 크기만큼만 행을 보여주도록 수정했다. 예: `10개씩 보기` 선택 시 10건만 표시한다.
- 공통 조회 테이블의 하단 페이지 이동 UI는 Aidot 기준인 `◀ ‹ 1 › ▶` 형태를 유지한다.
- 사용자 목록의 `신청일시`는 가입 요청/멤버십/사용자 생성일이 없을 때 실제 로그인 이력의 최초 `login_at`을 보조 기준으로 표시한다.
- 로그인 이력과 사용자 신청일시 보조 기준은 CGA의 실제 `access-state`/admin resource 데이터만 사용하며, 가짜 행은 추가하지 않는다.
- 브라우저 캐시 방지를 위해 Studio 정적 리소스 버전을 `20260612-3`으로 올렸다.

### Aidot형 조회 화면 기본 인터페이스 정렬

- CGA Studio의 사용자 관리/그룹 관리 조회 화면을 Aidot 조회 화면 기준으로 정렬했다.
- 모든 조회 화면의 페이지 크기 기준은 `10, 25, 50, 100`으로 통일한다.
- 조회 조건 영역의 버튼은 우측 상단에 모으고, `초기화`와 `조회`를 같은 행에 배치한다.
- 목록 영역은 `전체 n건`과 페이지 크기 선택을 표 위에 두고, 표 하단에는 Aidot형 중앙 페이지 이동 UI(`◀ ‹ 1 › ▶`)를 사용한다.
- 조회 결과가 없을 때 별도의 “데이터 없음” 문구는 표시하지 않고 빈 표 영역을 유지한다.
- 사용자 상세/그룹 상세 팝업은 1920×1080 기준에서 과도하게 넓지 않도록 폭을 줄이고, 표형 admin 리소스 팝업은 넓은 화면을 유지한다.

검증:

- `node --check apps/studio/app.js` 통과
- `npm run studio:validate` 통과
- `http://127.0.0.1:4173/` 응답 `200`, 약 `0.005초`
- `styles.css?v=20260612-2`, `app.js?v=20260612-2` 반영 확인

## 2026-06-11

### 실제 로그인 이력 전환 및 조회 성능 검증

- CGA Studio의 로그인 이력 화면에서 임시/가짜 데이터(`전체 1건`, `127.0.0.1`, `로그인 시간 -`)를 제거했다.
- `scripts/serve-studio.js`에서 로그인 성공 시 실제 세션 토큰, 사용자, 그룹, 역할, IP, 로그인 시각을 `access-state.json`의 `loginHistory`에 저장하도록 연결했다.
- 로그아웃 시 해당 세션의 `logout_at`을 기록하고 세션 토큰을 제거하도록 연결했다.
- `/api/cga/groups` 응답에 `login_history`를 포함해 화면이 서버 저장 데이터를 그대로 렌더링하도록 했다.
- `packages/public-core/src/access-state.js`의 상태 정규화에 `loginHistory`를 포함해 서버 저장/로드 과정에서 이력이 사라지지 않게 했다.
- 로그인 이력 조회 화면은 실제 `login_history` 행만 표시하며, 데이터가 없을 때 별도의 “데이터 없음” 문구를 표시하지 않는다.
- 모든 조회 화면 기본 원칙에 맞춰 Aidot형 하단 중앙 페이지 이동 UI(`◀ ‹ 1 › ▶`)를 공통 스타일로 추가했다.
- `apps/studio/app.js`의 `adminSurfaceSamples` 하드코딩 샘플 행을 제거했다.
- 실제 API가 아직 연결되지 않은 System Administration 하위 화면은 가짜 행을 보여주지 않고 Aidot형 검색/표/페이저 골격만 렌더링하도록 바꿨다.

검증:

- `npm run studio:auth-api-check`
  - 실제 로그인 → `/api/cga/groups` 조회 → 로그아웃 → 저장 파일 확인 통과
  - 로그인 이력 포함 그룹 조회 시간: 1.4ms
- `npm run studio:validate`
  - 전체 CGA Studio 검증 통과
  - 로그인 이력 포함 그룹 조회 시간: 1.5ms
- 현재 실행 중인 `http://127.0.0.1:4173` 서버 재시작 후 실제 로그인/로그아웃 확인
  - 로그인 이력 포함 그룹 조회 시간: 6ms
  - `login_at`, `logout_at` 저장 확인

다음 작업:

- System Administration 하위 화면은 CGA식 임시 화면을 제거하고 Aidot Admin 화면 구조/문구/표/검색/버튼 배치를 원본 기준으로 복사한다.
- Aidot에 없는 `그룹 역할 관리`만 CGA 추가 화면으로 분리하되, 사용자 관리/그룹 관리/로그인 이력은 Aidot 기준을 유지한다.

## 2026-06-03

### 현재 작업 목적
- CGA Studio를 Aidot 신규 개발이 아니라 Aidot Workflow Shell로 정리한다.
- Aidot의 구조, API, 런타임, webchat 호환성은 변경하지 않는다.
- 작업은 `D:\Project\cga`에서만 진행한다.

### 진행한 작업
- `docs/CGA_Studio_설계서_완성본.md`를 `CGA 설계서.docx` 기준으로 보완했다.
- 단계 구조를 `Create -> Setup -> Configure -> Review -> Edit -> Train -> Test -> Improve -> Deploy`로 정리했다.
- `apps/studio/index.html` 정적 화면을 생성했다.
- `apps/studio/styles.css` 정적 화면 스타일을 생성했다.

### 현재 화면 방향
- 상단: 현재 봇, 버전, 언어, Aidot API 유지 상태, Save/Test/Deploy 버튼
- 왼쪽: 봇 제작 단계
- 중앙: Configure/Review/Edit 중심 작업 화면
- 오른쪽: 확정 원칙과 승인 필요 항목

### 확정 원칙
- Aidot 수정 금지
- CGA 폴더에서만 작업
- 새 기능 개발 금지
- Aidot API/webchat/런타임 호환 유지
- 각 화면은 신산님 승인 후 구현

### 다음 작업 후보
- 정적 화면을 브라우저에서 열어 시각 검토한다.
- 신산님 승인 후 Create 화면 또는 Configure 화면 중 하나를 세부 설계한다.


### 2026-06-03 추가 보완
- `CGA_Studio_화면설계서_v2.0.docx`를 참고해 설계서를 보완했다.
- 사용자 노출 단계를 6단계로 단순화하고, 내부 세부 단계 9단계와 매핑했다.
- 글로벌 레이아웃 규칙(TopBar / Step Rail / Main Workspace / Status Panel)을 추가했다.
- LLM 연결 상태 표시 규칙을 추가했다.
- 수동 LLM Handoff 파일 규격과 주의사항을 추가했다.
- 운영 화면 항목과 알람 조건을 추가했다.
- 동적 의도 확장 승인, 자동 신규 의도 생성, 승인 대기 큐, 자동 재학습 연결은 새 기능 가능성이 있어 승인 필요 항목으로 분리했다.


### 2026-06-03 화면 반영
- `apps/studio/index.html`을 설계서 v2.0 기준에 맞춰 갱신했다.
- 왼쪽 Step Rail을 사용자 노출 6단계로 단순화했다.
- 중앙에 6단계와 Aidot 내부 세부 단계 매핑 패널을 추가했다.
- Configure Bot 화면에 학습문장 경로와 PDF 경로의 LLM 연결 조건을 명확히 표시했다.
- 승인 필요 항목에 수동 LLM Handoff와 동적 의도 확장 범위를 추가했다.

- `apps/studio/styles.css`에 6단계 ↔ Aidot 내부 단계 매핑 패널 스타일을 추가했다.


### 2026-06-03 6단계 화면 전체 구현 초안
- 신산님 지시에 따라 단계마다 Aidot 기능을 다시 테스트하지 않는 방향으로 작업 기준을 조정했다.
- `apps/studio/index.html`에 6단계 전체 화면 초안을 한 화면 안에 구성했다.
- 01 Create Bot, 02 Configure Bot, 03 Detail Settings, 04 Build, 05 Test, 06 Operate 화면을 모두 추가했다.
- 각 화면에 연결되는 Aidot 기존 기능 매핑을 표시했다.
- 수동 LLM Handoff, PDF Q&A 생성, 동적 의도 확장처럼 새 기능 가능성이 있는 항목은 승인 필요 상태로 표시했다.
- `apps/studio/styles.css`를 6단계 전체 화면에 맞게 재작성했다.


### 2026-06-03 오픈 코어 전략 반영
- 신산님 결정에 따라 상용 가치가 큰 기능을 별도 모듈로 분리하는 방향을 확정했다.
- 설계서에 `오픈 코어 및 상용 모듈 분리 전략` 섹션을 추가했다.
- Public Core와 Commercial Modules의 범위를 구분했다.
- Commercial Module 후보를 Advanced Builder, Operations Monitor, License / Entitlement 3종으로 정리했다.
- Studio 화면에 Open Core Strategy 섹션을 추가했다.
- 공개 버전에서 상용 모듈은 `Commercial Module Required` 상태로 표시하는 원칙을 반영했다.


### 2026-06-03 모듈 경계 구체화
- Public Core와 Commercial Module 경계를 별도 문서로 작성했다.
- `docs/cga-open-core-module-boundary.md`를 추가했다.
- 화면별 공개 기능과 상용 모듈 후보를 구분했다.
- Studio 화면에 `Module Boundary Matrix` 섹션을 추가했다.
- Public Core는 Commercial Module 없이도 실행되어야 한다는 원칙을 명시했다.


### 2026-06-04 다국어와 에러 메시지 기반 반영
- 신산님 지시에 따라 메뉴보다 에러 메시지/상태 메시지/운영 알림의 i18n 기반을 먼저 분리했다.
- `docs/cga-i18n-error-message-policy.md`를 추가했다.
- `packages/i18n/error-catalog.json`을 추가했다.
- 1차 locale 리소스 `en`, `ko`, `zh-CN`, `ja`, `vi`, `de`, `fr`를 추가했다.
- Studio 화면에 `Localization and Error Messages` 섹션을 추가했다.
- API 에러는 번역 문장이 아니라 안정적인 `error_code`와 `message_key`를 기준으로 처리한다는 원칙을 문서화했다.


### 2026-06-04 화면 i18n 동작 반영
- `packages/i18n/src/resolve-message.js`를 추가해 실제 앱에서 사용할 메시지 해석 유틸의 기준을 만들었다.
- `packages/i18n/README.md`를 추가했다.
- `apps/studio/i18n.js`를 추가해 정적 화면에서도 locale 선택과 에러 메시지 전환이 동작하도록 했다.
- TopBar에 locale selector를 추가했다.
- i18n 섹션과 에러 샘플 4개를 `data-i18n`, `data-error-key` 기반으로 전환했다.


### 2026-06-04 Studio 실행 구조 전환
- 정적 마크업 일부를 데이터 기반 렌더링으로 전환했다.
- `apps/studio/data/workflow.js`에 6단계 워크플로우와 모듈 경계 데이터를 분리했다.
- `apps/studio/app.js`를 추가해 워크플로우 레일, 모듈 경계표, 에러 샘플을 데이터 기반으로 렌더링한다.
- `scripts/serve-studio.js`를 추가해 추가 의존성 없이 CGA Studio를 로컬 서버로 실행할 수 있게 했다.
- `package.json`에 `npm run studio`, `npm run studio:check` 스크립트를 추가했다.


### 2026-06-04 로컬 서버 실행 확인
- `npm run studio:check` 문법 검사를 통과했다.
- `apps/studio/app.js`와 `apps/studio/i18n.js` 문법 검사를 통과했다.
- `scripts/serve-studio.js` 기반으로 CGA Studio 로컬 서버를 실행했다.
- 실행 URL은 `http://localhost:4173`이다.
- 서버 응답 상태 `200`을 확인했다.
- 현재 실행 PID는 `35856`이다.


### 2026-06-04 Public Core 계약 추가
- `packages/contracts` 패키지를 추가했다.
- 에러 응답 계약, 상용 모듈 상태 계약, 워크플로우 매핑 계약을 코드로 분리했다.
- Studio 화면에 `Public Core Contracts` 섹션을 추가했다.
- 모듈 경계 문서에 Public Contracts 섹션을 추가했다.


### 2026-06-04 화면 구성 변경 가능 구조 반영
- 신산님 지시에 따라 화면 구성을 언제든지 바꿀 수 있는 구조로 보완했다.
- `apps/studio/data/layout.js`를 추가했다.
- 각 화면 section에 `data-screen-id`를 부여했다.
- `apps/studio/app.js`가 `layout.js` 기준으로 화면 순서, 노출 여부, 그룹 정보를 적용하도록 변경했다.
- `docs/cga-screen-composition-policy.md`를 추가했다.


### 2026-06-04 Studio 설정 검증 추가
- `scripts/check-studio-config.js`를 추가했다.
- `npm run studio:config-check` 스크립트를 추가했다.
- `npm run studio:validate` 스크립트를 추가했다.
- README에 CGA Studio 실행/검증/화면 구성 변경 방법을 추가했다.


### 2026-06-04 Studio 검증 통과
- `package.json`의 `studio:config-check`, `studio:validate` 스크립트 위치 오류를 수정했다.
- locale 파일에 화면 i18n 키 누락분을 추가했다.
- `npm run studio:validate`를 실행해 전체 검증이 통과했다.
- 검증 통과 항목: layout id와 screen section 일치, 필수 workflow 6단계 존재, English locale key 존재, 모든 locale의 error catalog key 존재, contract files 존재.


### 2026-06-04 Public Core 상태 모델 추가
- `packages/public-core` 패키지를 추가했다.
- `src/studio-state.js`에 CGA Studio 화면 상태 모델을 정의했다.
- LLM 연결 상태, 단계 상태, 채널 상태 enum을 추가했다.
- readiness 파생 함수와 PDF Q&A 생성 가능 여부, Kakao KR 채널 사용 가능 여부 함수를 추가했다.
- `npm run studio:state-check` 검증 스크립트를 추가했다.
- `npm run studio:validate`에 state check를 포함했다.


### 2026-06-04 Public Core 상태 모델 검증 통과
- `package.json` scripts 구조를 정상화했다.
- `npm run studio:validate`에 `studio:state-check`가 포함되도록 수정했다.
- `npm run studio:validate` 전체 검증이 통과했다.
- `http://localhost:4173` 응답 상태 `200`을 다시 확인했다.


### 2026-06-04 Studio 상태 모델 화면 연결
- 로컬 서버를 CGA 루트 기준으로 서빙하도록 변경해 `packages`를 브라우저에서 import할 수 있게 했다.
- `apps/studio/data/sample-state.js`를 추가했다.
- `apps/studio/app.js`에서 Public Core 상태 모델의 `deriveReadiness`, `canGeneratePdfQa`, `canUseKakaoChannel`을 사용하도록 연결했다.
- `Studio State and Readiness` 화면 섹션을 추가했다.
- 화면 상태와 readiness issue가 하드코딩이 아니라 Public Core 상태 모델에서 파생되도록 했다.


### 2026-06-04 상태 모델 화면 연결 검증 통과
- 서버 루트를 CGA 프로젝트 루트로 전환했다.
- `/` 요청이 `/apps/studio/index.html`로 연결되도록 수정했다.
- `/packages/public-core/src/studio-state.js`가 브라우저에서 import 가능한 경로로 서빙되는 것을 확인했다.
- 서버를 PID `30512`로 재시작했다.
- `http://localhost:4173` 응답 상태 `200`을 확인했다.
- `npm run studio:validate` 전체 검증이 통과했다.


### 2026-06-04 Commercial Module 레지스트리 기본값 추가
- `packages/public-core/src/module-registry.js`를 추가했다.
- Public Core에서 상용 모듈이 설치되지 않은 기본 상태를 표현할 수 있게 했다.
- Studio 화면에 `Commercial Module Availability` 섹션을 추가했다.
- 상용 기능 후보가 기본적으로 `Commercial Module Required`로 표시되도록 연결했다.
- `npm run studio:module-check`를 추가하고 `studio:validate`에 포함했다.


### 2026-06-04 Create Bot 구조 결정 반영
- 신산님 지시에 따라 전체 봇 구조에 영향을 주는 선택을 Create Bot 단계로 이동했다.
- Create Bot 화면에 LLM 사용 여부, 구성 입력 방식, 오케스트레이터 모드, Bot Server 위치 선택을 추가했다.
- `packages/public-core/src/studio-state.js`에 structural choices 모델을 추가했다.
- `apps/studio/data/sample-state.js`와 `workflow.js`에 Create Bot 구조 결정 항목을 반영했다.
- 설계서 6.1에 Create 단계 구조 결정 원칙을 추가했다.


### 2026-06-04 Aidot 학습 이후 변경 불가 항목 반영
- 신산님 기준에 따라 Aidot에서 학습 이후 변경 불가하거나 구조가 깨지는 항목은 모두 Create Bot에서 설정하도록 원칙을 강화했다.
- `TRAINING_LOCKED_CREATE_FIELDS`와 `RUNTIME_ADJUSTABLE_FIELDS`를 Public Core 상태 모델에 추가했다.
- Create Bot 화면에 `Locked after training` 표시를 추가했다.
- 설계서에 `Aidot 학습 이후 변경 불가 항목` 섹션을 추가했다.
- layout.js에서 누락된 `commercial-availability` section을 복구하고 화면 order를 정리했다.


### 2026-06-04 Create Bot 구조 입력 상태 연결
- Create Bot의 구조 결정 입력에 `data-structural-field`를 추가했다.
- `apps/studio/app.js`에 현재 Studio 상태를 두고 입력 변경 시 상태 모델이 갱신되도록 연결했다.
- LLM 사용 여부, 구성 입력 방식, 기본 언어 변경에 따라 PDF Q&A 가능 여부, Kakao KR 상태, readiness issue가 다시 계산되도록 했다.
- Create Bot 오른쪽 Structure Summary를 하드코딩에서 상태 기반 렌더링으로 변경했다.


### 2026-06-04 잠금 항목/실행 옵션 화면 분리
- `Locked Structure vs Runtime Options` 화면 섹션을 추가했다.
- Public Core 상태 모델의 `TRAINING_LOCKED_CREATE_FIELDS`, `RUNTIME_ADJUSTABLE_FIELDS`를 화면에 연결했다.
- Create Bot에서 잠기는 구조 항목과 이후 단계에서 조정 가능한 실행 옵션을 분리 표시했다.
- 설계서에 화면 정책을 추가했다.


### 2026-06-04 주요 화면 한국어 전환 범위 확대
- 사용자가 한국어 선택 시 대부분의 상단/좌측/hero/Create Bot/Approval 문구가 한국어로 보이도록 `data-i18n` 키를 확대했다.
- workflow navigation 동적 렌더링에도 i18n 키를 연결했다.
- locale 리소스와 `apps/studio/i18n.js` 내장 리소스를 재생성했다.


### 2026-06-04 i18n 누락 검사 기반 추가
- 화면 문구가 영어 하드코딩으로 쌓이지 않도록 `scripts/check-i18n-coverage.js`를 추가했다.
- `npm run studio:i18n-check` 스크립트를 추가했다.
- `npm run studio:validate`에 i18n coverage guard를 포함했다.


### 2026-06-04 전체 화면 i18n 키 확대
- Configure, Detail, Build, Test, Operate, Lock Policy, State, Commercial, Module Boundary, Contracts, Open Core 영역의 주요 HTML 문구를 i18n 키로 전환했다.
- 한국어 리소스에 해당 키를 추가했다.
- placeholder 번역 처리를 `i18n.js`에 추가했다.


### 2026-06-04 사용자/로그인/API 답변 영역 추가
- 신산님 지적에 따라 사용자, 로그인, 권한 관리 영역을 Public Core 화면에 추가했다.
- API 답변을 `고정 텍스트가 아니라 외부 시스템 응답을 호출해 답변하는 방식`으로 정의했다.
- `packages/contracts/src/access-contract.js`를 추가했다.
- `packages/contracts/src/api-answer-contract.js`를 추가했다.
- Studio 화면에 `Users, Login, and Access`, `External API Answer Source` 섹션을 추가했다.
- `docs/cga-access-and-api-answer-policy.md`를 추가했다.


### 2026-06-04 동적 데이터 API 답변 반영
- 신산님 예시(기업 매출, 순이익처럼 계속 바뀌는 값)를 API 답변의 핵심 사례로 반영했다.
- API 답변은 의도와 매핑은 저장하지만, 답변 시점에 외부 API를 호출해 최신 값을 보여주는 방식으로 정의했다.
- `API_DATA_FRESHNESS`, `createDynamicMetricApiAnswerDraft`를 API answer contract에 추가했다.
- Studio 화면에 동적 데이터 답변 예시를 추가했다.
- 정책 문서에 동적 데이터 답변 처리 방식을 추가했다.


### 2026-06-04 Aidot 기능 화면 전체 보존 원칙 반영
- 신산님 지시에 따라 CGA는 Aidot 기능 화면을 빼거나 제외하지 않고 재구성하는 프로젝트라는 원칙을 명확히 반영했다.
- 화면의 `hidden`, `optional`, `not used` 등 오해 가능한 표현을 보완했다.
- Studio 화면에 `Aidot Feature Coverage` 섹션을 추가했다.
- 설계서에 `Aidot 기능 화면 전체 보존 원칙`을 추가했다.
- 화면 구성 정책 문서에 Aidot 기능 화면 보존 원칙을 추가했다.


### 2026-06-04 공동 작업 플랫폼 기준 반영
- 신산님 지시에 따라 CGA를 1인 제작기가 아니라 여러 명이 함께 작업하는 플랫폼으로 재정의했다.
- `packages/contracts/src/collaboration-contract.js`를 추가했다.
- `packages/public-core/src/collaboration-state.js`를 추가했다.
- Studio 화면에 `Collaboration Platform` 섹션을 추가했다.
- `docs/cga-collaboration-platform-policy.md`를 추가했다.
- 설계서에 공동 작업 플랫폼 원칙을 추가했다.


### 2026-06-04 1인 빠른 제작 + 선택적 공동 작업 기준 반영
- 신산님 기준에 따라 CGA의 1차 목표를 `한 사람이 1~2일 안에 봇 하나를 만드는 것`으로 명확히 했다.
- 공동 작업은 기본 화면을 무겁게 만드는 것이 아니라, 여러 명이 하나의 봇을 제작할 수 있게 하는 확장 구조로 정리했다.
- Collaboration 화면과 설계서, 협업 정책 문서를 이 기준으로 수정했다.


### 2026-06-04 빠른 1인 제작 목표를 계약/상태 모델에 고정
- `packages/contracts/src/collaboration-contract.js`에 `BUILD_MODE`와 `DEFAULT_BUILD_TARGET`을 추가했다.
- 기본 제작 모드는 `fast_solo`로 두고, 목표 제작 기간은 1~2일로 명시했다.
- `packages/public-core/src/collaboration-state.js`의 협업 요약에 제작 모드, 목표 기간, 협업 가능 여부를 포함했다.
- 협업 기능은 기본 제작 흐름을 방해하지 않는 선택적 확장이라는 기준을 정책 문서에 추가했다.
- Studio 설정 검증에서 사용자/로그인, API 답변, 공동 작업 계약 파일도 존재 여부를 확인하도록 보강했다.


### 2026-06-04 그룹 기준 관리 원칙 반영
- 신산님 지시에 따라 CGA의 모든 관리 기준을 `시스템 전체`가 아니라 `그룹`으로 확정했다.
- 봇, API 답변, 사용자 권한, 운영 접근, 화면 접근은 그룹 기준으로 관리한다.
- 동일 그룹 사용자는 그룹이 관리하는 봇에 접근할 수 있어야 한다.
- 그룹별 사용자 권한을 설정하고, 그룹 내 사용자 역할과 scope로 화면/기능 접근을 결정한다.
- API 답변도 개인 자산이 아니라 `group_id + bot_id`로 연결되는 그룹 관리 자산으로 변경했다.
- `packages/contracts/src/api-answer-contract.js`에 `group_id`, `bot_id`, `managed_by: group`, `secret_ref`, `allowed_group_scopes` 기준을 추가했다.
- `docs/cga-access-and-api-answer-policy.md`에 그룹별 봇/API 관리 원칙을 명시했다.


### 2026-06-04 서버형 SaaS 설치 원칙 반영
- CGA는 개별 PC 설치형 도구가 아니라 서버에 설치해 서비스하는 SaaS 구조를 기본으로 확정했다.
- 오픈소스 사용자가 각자 서버에 설치하더라도, 사용자는 브라우저로 서버에 접속해 사용하는 방식이다.
- 하나의 서버 인스턴스 안에서 여러 그룹을 관리할 수 있어야 한다.
- 서버 운영자는 인프라를 관리하지만, 봇/API/사용자 권한의 업무 기준은 그룹으로 유지한다.
- 설계서와 접근/API 정책 문서에 이 기준을 반영했다.


### 2026-06-04 폐쇄망/개인 WSL 컨테이너 설치 기준 반영
- 폐쇄망에서도 CGA는 SaaS 구조로 설치해 사용하는 것으로 확정했다.
- 개인 사용자는 WSL 또는 Docker 컨테이너로 CGA 서버를 띄우고 브라우저로 접속해 사용할 수 있다는 기준을 반영했다.
- 클라우드, 사내 서버, 폐쇄망 서버, 개인 PC WSL 컨테이너는 배포 위치만 다르고 제품 구조는 서버형 SaaS로 동일하게 본다.


### 2026-06-04 가입신청/기본 권한 관리 기준 반영
- 가입신청, 로그인, 기본 권한 관리 기능을 CGA 우선 구현 대상으로 정리했다.
- 모든 신규 사용자는 가입 시 자기 그룹으로 먼저 가입되는 구조로 확정했다.
- 사용자는 다른 그룹에 가입신청을 할 수 있고, 승인되면 해당 그룹의 권한으로 봇/API/화면에 접근한다.
- 그룹에 사용자가 없어지면 해당 그룹은 삭제하는 구조로 정리했다.
- 그룹 생성은 관리자 권한을 가진 사용자만 가능하게 했다.
- 시스템 전체 기본 관리자 사용자는 `admin`이며 삭제할 수 없는 사용자로 정의했다.
- 관리자 권한 요청은 `admin` 사용자가 승인한다.
- 각 그룹에는 그룹 관리자 1명이 있고, 그 사용자는 해당 그룹 안에서 모든 권한을 가진다.
- `packages/contracts/src/access-contract.js`와 `packages/public-core/src/access-state.js`에 관련 계약과 샘플 상태를 추가했다.
- Studio Access 화면에 가입/그룹 정책과 관리자 승인 정책 패널을 추가했다.


### 2026-06-04 사용자별 언어 설정 기준 반영
- 신산님 확인에 따라 언어 설정은 사용자별로 관리하는 것으로 확정했다.
- 같은 그룹 안에서도 사용자마다 CGA Studio UI 언어가 다를 수 있다.
- 에러 메시지와 운영 알림은 기본적으로 `user.locale` 기준으로 표시한다.
- 봇 기본 언어와 사용자 UI 언어는 별도 설정으로 분리했다.
- `createUser` 계약에 `locale`을 추가하고, Access 화면의 정책 요약에 현재 사용자 언어와 에러 메시지 언어 기준을 표시하도록 했다.


### 2026-06-04 다국어 사용자 공동 작업 기준 반영
- 다양한 언어 사용자가 하나의 그룹에서 같은 봇을 공동 작업하는 구조로 확정했다.
- 그룹/봇/의도/답변/API 설정은 공통 작업 대상이고, 화면/에러/알림은 각 사용자 `user.locale` 기준으로 표시한다.
- 같은 그룹 안에서 한국어 사용자와 일본어 사용자 등이 서로 다른 UI 언어로 같은 봇을 편집할 수 있어야 한다.
- `docs/cga-collaboration-platform-policy.md`에 다국어 공동 작업 원칙을 추가했다.


### 2026-06-04 CGA 에러와 봇 에러 분리
- 신산님 기준에 따라 에러 메시지를 `CGA 에러`와 `봇 에러`로 분리했다.
- CGA 에러는 사용자의 언어 `user.locale` 기준으로 표시한다.
- 봇 에러는 봇의 언어 `bot.defaultLocale` 기준으로 표시한다.
- 에러 코드 prefix를 `CGA_*`와 `BOT_*`로 분리했다.
- `packages/contracts/src/error-contract.js`, `packages/i18n/error-catalog.json`, `packages/i18n/src/resolve-message.js`에 이 기준을 반영했다.


### 2026-06-04 가입/그룹 권한 상태 전이 기준 추가
- 가입 시 사용자와 자기 그룹, 그룹 관리자 멤버십을 함께 생성하는 `createSignupDraft` 계약을 추가했다.
- 그룹 가입신청, 가입 승인, 멤버십 제거, 빈 그룹 자동 삭제 상태 전이 함수를 Public Core에 추가했다.
- 관리자 권한 요청 상태를 추가하고, Access 화면 정책 요약에 대기 중인 관리자 요청 수를 표시하도록 했다.
- 아직 실제 서버 API 구현은 아니며, 서버형 SaaS API를 만들 때 사용할 Public Core 기준 로직이다.


### 2026-06-04 가입/로그인/그룹 승인 화면 흐름 보강
- 신산님 지시에 따라 기본 권한 관리 기능을 화면에서 먼저 이해할 수 있도록 Access 화면을 보강했다.
- `Users, Login, and Access` 화면 안에 `Signup / Login Flow`, `Group Users`, `Group Join Requests`, `Admin Permission Requests` 패널을 추가했다.
- 가입 흐름은 `가입 -> 자기 그룹 생성 -> 로그인 -> 다른 그룹 가입신청 -> 승인 후 그룹 작업` 순서로 표시한다.
- 그룹 사용자 패널은 그룹별 사용자, 역할, 사용자 UI 언어를 함께 보여준다.
- 그룹 가입신청 패널은 어떤 사용자가 어떤 그룹에 어떤 역할로 가입을 요청했는지 표시한다.
- 관리자 권한 요청 패널은 시스템 admin 승인이 필요한 요청을 표시한다.
- 이 단계는 실제 서버 인증/API 구현이 아니라 CGA Public Core 기준 화면/상태 설계이며, Aidot 수정은 없다.


### 2026-06-04 가입/로그인/그룹 관리 API 계약 초안 추가
- `packages/contracts/src/auth-api-contract.js`를 추가했다.
- CGA 전용 가입, 로그인, 현재 사용자 조회, 그룹 조회, 그룹 가입신청, 관리자 권한 요청 route 기준을 정의했다.
- 가입 요청, 로그인 요청, 그룹 가입신청 payload, 관리자 권한 요청 payload, 로그인 세션 응답 형태를 계약 함수로 분리했다.
- `npm run studio:validate`에 auth contract 문법 검사를 포함하도록 `studio:auth-check`를 추가했다.
- `docs/cga-access-and-api-answer-policy.md`에 CGA 사용자/그룹 API 초안과 상태 전이를 문서화했다.
- 이 API 계약은 CGA Studio 운영/권한 전용이며, Aidot 봇 런타임 API와 webchat 호환 API는 변경하지 않는다.


### 2026-06-04 Public Core Contracts 화면에 Auth API 계약 표시
- `Public Core Contracts` 화면에 `CGA Auth / Group API` 카드를 추가했다.
- 가입, 로그인, 그룹 가입신청, 관리자 승인 API가 CGA 관리 API라는 점을 화면에 표시했다.
- Aidot 런타임 API와 webchat API는 변경하지 않는다는 기준을 같은 카드에 명시했다.
- 영어/한국어 i18n 리소스를 추가했고, 나머지 locale에는 누락 방지용 영어 fallback을 반영했다.


### 2026-06-04 WSL 컨테이너 개발 실행 기준 반영
- 신산님 지시에 따라 CGA 개발 프로세스는 Windows 로컬 Node 프로세스가 아니라 WSL 안의 Docker 컨테이너로 띄우는 방식으로 변경했다.
- `Dockerfile`, `docker-compose.yml`, `.dockerignore`를 추가했다.
- WSL 소스 기준 경로는 `~/deploy/cga`로 정했다.
- WSL에는 Compose v2 명령인 `docker compose`가 아니라 `docker-compose`를 사용한다.
- `docker-compose up --build cga-studio`로 CGA Studio 서버를 컨테이너에서 실행하도록 기준을 정했다.
- `package.json`에 `studio:container`, `studio:container:down` 스크립트를 추가했다.
- `.gitignore`를 추가해 `node_modules`가 Git에 포함되지 않도록 했다.
- README와 접근/API 정책 문서에 WSL 컨테이너 개발 실행 원칙을 문서화했다.
- 배포와 공유는 Git commit/push 기준으로 진행한다는 원칙을 명시했다.
- `npm run studio`는 컨테이너 내부 서버 명령으로 유지하되, Windows 로컬에서 직접 실행하는 기본 방식으로 쓰지 않도록 정리했다.


### 2026-06-04 WSL `~/deploy/cga` Git 배포 및 컨테이너 실행 확인
- Windows 작업본을 `codex/wsl-container-dev` 브랜치에 커밋했다.
- 커밋: `744101e feat: add cga studio container workflow`
- 원격 저장소 `origin/codex/wsl-container-dev`로 push했다.
- WSL의 `/home/daon/deploy/cga`에 해당 브랜치를 Git clone했다.
- WSL에서 `docker-compose config`가 정상 통과했다.
- WSL에서 `docker-compose up --build -d cga-studio`로 컨테이너를 실행했다.
- 컨테이너 이름은 `cga-cga-studio-1`이고, `0.0.0.0:4173->4173/tcp`로 노출된다.
- Windows 브라우저 기준 `http://localhost:4173` 응답 상태 `200`을 확인했다.
- 컨테이너 내부에서 `npm run studio:validate`를 실행했고 전체 검증이 통과했다.


### 2026-06-04 권한 운영 현황 패널 추가
- `Users, Login, and Access` 화면에 `Access Operations Snapshot` 패널을 추가했다.
- 운영자가 DB나 명령줄을 열지 않고도 활성 사용자 수, 활성 그룹 수, 활성 멤버십 수, 승인 대기 수, admin 보호 상태, 사용자 언어 수를 확인할 수 있게 했다.
- `packages/public-core/src/access-state.js`에 `summarizeAccessOperations`를 추가했다.
- Studio 화면은 이 Public Core 요약 함수에서 나온 값으로 운영 지표를 렌더링한다.
- 영어/한국어 i18n 리소스를 추가했고, 다른 locale은 누락 방지용 영어 fallback으로 보강했다.
- 이 작업은 CGA 화면/상태 모델 보강이며 Aidot 수정은 없다.


### 2026-06-04 Aidot 기준 화면 폰트 정책 반영
- 신산님 지시에 따라 CGA Studio 화면 기준 해상도를 `1920x1080` 운영 화면으로 잡았다.
- 폰트는 Aidot 운영 화면 톤에 맞춰 큰 마케팅형 타이포그래피를 사용하지 않는다.
- 브랜드명 `CGA Studio`는 예외적으로 `24px`로 설정했다.
- 왼쪽 섹션 제목 `봇 제작 워크플로우`는 `14px`로 설정했다.
- 왼쪽 단계 번호 `01~06`은 `14px`로 설정했다.
- 화면 제목, 왼쪽 단계 메뉴 제목, 일반 본문은 `12px` 기준으로 설정했다.
- 보조 설명은 `10px`, 메타/배지/eyebrow는 `9px` 기준으로 설정했다.
- `apps/studio/styles.css`에 `--font-title`, `--font-body`, `--font-nav`, `--font-support`, `--font-meta` 변수를 추가했다.
- `scripts/check-studio-style.js`를 추가해 허용된 예외 외에 `font-size`가 12px를 초과하지 않도록 검증한다.
- `npm run studio:validate`에 `studio:style-check`를 포함했다.
- 오른쪽 `확정 / 승인 필요` 패널은 개발 중 임시 확인용이며, 최종 CGA Studio 운영 화면에서는 제거 대상으로 본다.


### 2026-06-04 폰트 기준 재확정 및 Admin/API 우선 구현 진행
- 신산님 화면 확인 기준으로 CGA Studio 폰트 기준을 다시 확정했다.
- 브랜드명 `CGA Studio`는 `24px`로 유지한다.
- 화면 최상위 제목과 왼쪽 단계 번호 `01~06`은 `14px`로 사용한다.
- 메뉴 제목, 항목 제목, 카드 제목은 `12px`로 사용한다.
- 일반 본문은 `10px`로 사용한다.
- 보조 설명 문구는 `9px`로 사용한다.
- `apps/studio/styles.css`의 폰트 변수를 `--font-brand`, `--font-top`, `--font-title`, `--font-body`, `--font-desc` 기준으로 정리했다.
- `scripts/check-studio-style.js`를 최신 폰트 기준 검사로 갱신했다.
- 신산님 지시에 따라 다음 화면 작업보다 `로그인, 사용자/그룹 관리, 그룹별 API 관리`를 먼저 진행한다.
- `Users, Login, and Access` 화면에 Login Session, Signup, Group Management, Approval Queue 작업대를 추가했다.
- `External API Answer Source` 화면에 Group API Registry 작업대를 추가했다.
- `Implementation direction`과 오른쪽 `Approval Checklist`는 최종 운영 화면에서 제거될 개발 확인용 영역이므로, 실제 작업 화면과 구분되도록 임시 영역 색상을 다르게 표시했다.
- 이 단계는 CGA Public Core 화면/상태 모델 작업이며, Aidot 코드는 수정하지 않았다.


### 2026-06-04 관리 메뉴 노출 보강
- `Users, Login, and Access`와 `External API Answer Source` 화면이 추가되었지만 왼쪽 메뉴에는 봇 제작 6단계만 보여 관리 기능을 찾기 어려운 상태였다.
- 왼쪽 상단에 `Management` 메뉴 그룹을 추가했다.
- 관리 메뉴에는 `User / Group Admin`, `Group API Registry`, `Aidot Coverage` 바로가기를 배치했다.
- 이 메뉴는 새 백엔드 기능이 아니라 이미 있는 CGA 화면으로 이동하는 UI 재배치다.
- 폰트 기준은 기존 확정 기준을 유지했다: 메뉴 제목 12, 설명 9.
- 영어/한국어 i18n 키를 추가하고, 다른 locale에는 영어 fallback을 반영했다.


### 2026-06-04 권한별 메뉴 접근 표시 추가
- 현재 로그인 사용자의 그룹 멤버십과 role scope를 기준으로 왼쪽 메뉴 접근 가능 여부를 표시하도록 했다.
- 메뉴는 숨기지 않고 `Allowed` 또는 `Blocked · scope` 상태를 표시한다.
- 차단된 메뉴는 클릭해도 이동하지 않도록 기본 접근 가드를 추가했다.
- 상단 context bar에 현재 사용자, 사용자 언어, 현재 role을 표시했다.
- 이 단계는 CGA Studio 화면 권한 표시이며, 실제 서버 인증 미들웨어 구현은 다음 단계 후보로 남긴다.


### 2026-06-04 Bot Workspace 진입 화면 추가
- 서버형 SaaS 구조에서는 로그인 후 바로 `Create Bot`으로 들어가기보다, 먼저 사용자가 속한 그룹과 그룹의 봇 목록을 보는 진입 화면이 필요하다고 정리했다.
- `Bot Workspace` 화면을 추가했다.
- 화면 흐름은 `사용자 세션 -> 그룹 작업공간 -> 그룹 봇 목록 -> 봇 열기 또는 봇 생성 -> Create Bot` 순서다.
- 봇 제작 6단계는 그대로 유지하고, 그 앞의 플랫폼 진입 화면으로 `Bot Workspace`를 배치했다.
- 선택한 그룹에 따라 보이는 봇 목록이 달라지고, 현재 봇/현재 그룹을 상태 패널에 표시한다.
- 이 단계는 실제 DB/API 구현이 아니라 CGA Public Core 화면 흐름 설계다.
- Aidot 코드는 수정하지 않았다.


### 2026-06-04 Team Dashboard 작업 화면 추가
- CGA는 한 사람이 빠르게 봇을 만들 수 있어야 하지만, 여러 명이 같은 봇을 공동 작업할 수 있어야 한다.
- `Team Dashboard` 화면을 추가했다.
- 현재 로그인 사용자 기준의 `My Tasks`, 검수 대기 `Review Queue`, 차단 항목 `Blocked Items`를 표시한다.
- 협업 상태는 새 구조가 아니라 기존 `packages/public-core/src/collaboration-state.js`와 `packages/contracts/src/collaboration-contract.js`를 사용한다.
- 왼쪽 Management 메뉴에 `Team Dashboard` 바로가기를 추가했다.
- 메뉴 접근 권한은 `bot.view` 기준으로 표시한다.
- 이 단계는 실제 서버 작업 배정 API 구현이 아니라 CGA Studio 화면/상태 설계다.
- Aidot 코드는 수정하지 않았다.


### 2026-06-04 Bot Production과 System Administration 메뉴 분리
- 신산님 지적에 따라 Aidot admin 계열 기능은 봇 생성 흐름과 직접 관련된 기능이 아니라 시스템 운영 기능으로 분리해야 한다고 정리했다.
- 왼쪽 메뉴의 기존 `Management` 단일 묶음을 `Bot Production`, `System Administration`, `Reference`로 분리했다.
- `Bot Production`에는 `Bot Workspace`, `Team Dashboard`, `Group API Registry`를 배치했다.
- `System Administration`에는 `User / Group Admin`을 배치했다.
- `Reference`에는 `Aidot Coverage`와 최종 UI에서 제거될 `Temporary Notes`를 배치했다.
- System Administration 메뉴는 색상을 다르게 적용해 봇 제작 흐름과 시각적으로 구분했다.
- 이 단계는 화면 정보구조 정리이며, 새 Aidot 기능 개발이나 Aidot 수정은 없다.


### 2026-06-04 Team Dashboard 편집 잠금/검수 동작 연결
- 기존 협업 계약의 `createEditLock`, `REVIEW_DECISION`, `WORK_ITEM_STATUS`를 사용해 Team Dashboard 화면 동작을 연결했다.
- `My Tasks` 항목에서 현재 사용자에게 배정된 작업은 `Lock`/`Unlock`으로 편집 잠금 상태를 전환할 수 있다.
- `Review Queue` 항목은 `Approve` 또는 `Request changes`로 상태를 변경할 수 있다.
- `Blocked Items` 항목은 `Move to todo`로 다시 처리 대기 상태로 돌릴 수 있다.
- `packages/public-core/src/collaboration-state.js`에 상태 전이 함수 `lockWorkItem`, `releaseWorkItemLock`, `submitReviewDecision`을 추가했다.
- 이 단계는 실제 서버 저장/동시성 제어 구현이 아니라 CGA Studio 화면 상태 모델이다.
- Aidot 코드는 수정하지 않았다.


### 2026-06-04 메인 화면 표시 순서 재정렬
- 신산님 지적에 따라 Aidot admin 계열 기능이 봇 생성 흐름 안에 섞이지 않도록 실제 메인 화면 표시 순서도 재정렬했다.
- `apps/studio/data/layout.js` 기준으로 화면 순서를 `Bot Workspace -> Team Dashboard -> Create/Configure/Detail/API/Build/Test/Operate -> System Administration -> Reference/Business -> Temporary`로 변경했다.
- `Users, Login, and Access`는 `System Administration` 영역으로 이동했다.
- `Collaboration Platform`, `Locked Structure`, `State Readiness`, `i18n`, `Aidot Coverage`, `Public Contracts`는 제작 흐름 뒤의 Reference 영역으로 이동했다.
- `Module Boundary`, `Commercial Availability`, `Open Core`는 Business 영역으로 이동했다.
- 개발 중 안내용 `Implementation Direction` 성격의 `hero` 화면은 최종 운영 화면이 아니므로 `temporary` 그룹으로 두고 맨 뒤에 배치했다.
- 왼쪽 메뉴 분리와 실제 화면 스크롤 순서가 같은 기준을 따르도록 정리했다.
- 이 작업은 CGA 화면 구성 순서 변경이며 Aidot 코드는 수정하지 않았다.


### 2026-06-04 그룹 가입 승인과 시스템 admin 승인 분리
- 신산님이 정한 그룹 기준 운영 원칙에 맞춰 승인 주체를 분리했다.
- 그룹 가입신청은 대상 그룹의 `group_admin` 또는 시스템 `admin`만 승인할 수 있게 Public Core 상태 전이 함수를 보강했다.
- 관리자 권한 요청은 시스템 `admin`만 승인할 수 있게 Public Core 상태 전이 함수를 보강했다.
- 그룹 생성은 `groupCreationRequiresSystemAdmin` 정책이 켜져 있으면 시스템 `admin`만 수행할 수 있게 했다.
- `Users, Login, and Access` 화면의 승인 대기열은 현재 로그인 사용자의 권한에 따라 Approve 버튼을 활성/비활성으로 표시한다.
- 권한이 없는 승인 항목은 `requires group admin` 또는 `requires system admin`으로 표시한다.
- 정책 문서 `docs/cga-access-and-api-answer-policy.md`에 그룹 가입 승인자와 관리자 권한 승인자를 명확히 분리해 기록했다.
- 이 작업은 CGA 권한 상태 모델과 화면 동작 보강이며 Aidot 코드는 수정하지 않았다.


### 2026-06-05 Group API Registry 그룹/봇 연결 보강
- `External API Answer Source`의 Group API Registry를 현재 로그인 사용자의 활성 그룹 기준으로 동작하게 정리했다.
- API 그룹 선택 목록은 현재 사용자가 속한 그룹만 표시한다.
- API 봇 선택 목록은 선택한 그룹에 속한 봇만 표시한다.
- API 목록은 선택한 `group_id + bot_id` 기준으로 필터링해 보여준다.
- API 등록 시 `packages/contracts/src/api-answer-contract.js`의 `createGroupManagedApiAnswerDraft`를 사용해 `group_id`, `bot_id`, `managed_by: group`, `allowed_group_scopes` 기준을 유지한다.
- 현재 사용자에게 `apiAnswer.manage` 권한이 없거나 선택된 봇이 없으면 API 추가 버튼을 비활성화한다.
- Bot Workspace에서 그룹이나 봇을 바꾸면 Group API Registry의 선택 그룹/봇도 함께 맞춰진다.
- 이 작업은 CGA Studio 화면 상태 연결 보강이며 Aidot 코드는 수정하지 않았다.


### 2026-06-05 상단 현재 작업 컨텍스트 동적 연결
- 상단 context bar의 고정 문구 `Bot: SupportBot Draft`, `Version: v0.1`을 실제 상태 기반 표시로 변경했다.
- 상단에는 현재 사용자, 현재 그룹, 현재 봇, 현재 버전이 표시된다.
- Bot Workspace에서 그룹이나 봇을 선택하면 상단 그룹/봇/버전 표시가 함께 갱신된다.
- Create Bot의 Version Name 입력을 `bot.version` 상태에 연결했다.
- Create Bot에서 봇 이름이나 버전을 수정하면 상단 context bar도 같은 상태를 기준으로 갱신된다.
- 이 작업은 CGA Studio 화면 상태 표시 보강이며 Aidot 코드는 수정하지 않았다.


### 2026-06-05 Bot Workspace action 권한 제어 보강
- Bot Workspace의 `Create Bot` 버튼을 선택한 그룹/봇 기준의 `bot.create` 권한에 연결했다.
- 현재 사용자가 선택한 그룹에서 `bot.create` 권한이 없으면 `Create Bot` 버튼은 비활성화된다.
- 클릭 이벤트에도 같은 권한 가드를 넣어 버튼 상태와 실제 상태 전이가 어긋나지 않게 했다.
- Public Core에 `getEffectiveGroupScopes`를 추가해 전체 사용자 권한이 아니라 선택 그룹 기준 권한을 계산하도록 했다.
- Group API Registry의 API 추가 권한도 선택한 `group_id + bot_id` 기준의 `apiAnswer.manage` 권한으로 계산하도록 변경했다.
- 검증 스크립트에 그룹별 scope 회귀 검사를 추가했다. pending 가입이나 operator 역할이 `bot.create` 권한을 받지 않는지 확인한다.
- 이 작업은 CGA 권한 상태 모델과 화면 action 제어 보강이며 Aidot 코드는 수정하지 않았다.


### 2026-06-06 사용자별 CGA Studio 언어 동기화
- 신산님 원칙에 따라 사용자의 UI 언어와 봇의 기본 언어를 분리했다.
- CGA Studio 화면/에러 메시지는 현재 로그인 사용자 `user.locale` 기준으로 표시한다.
- 봇의 기본 언어 `bot.defaultLocale`은 봇 학습/운영 언어 기준으로 유지하며, 사용자 UI 언어를 바꿔도 봇 언어는 변경하지 않는다.
- `apps/studio/i18n.js`에 `window.cgaStudioI18n.setLocale()` 공개 연결을 추가했다.
- `apps/studio/app.js`에 `syncStudioLocaleToCurrentUser()`를 추가해 로그인 사용자 변경, 가입 직후 로그인 상태 변경, 관리자/권한 화면 재렌더 시 현재 사용자 언어를 Studio locale selector와 동기화한다.
- `scripts/check-studio-config.js`에 사용자 locale 동기화 연결이 빠지지 않았는지 확인하는 회귀검사를 추가했다.
- 이 작업은 CGA Studio 화면 언어 동작 보강이며 Aidot 코드는 수정하지 않았다.


### 2026-06-06 Aidot 호환 봇 패키지와 자산 이동 원칙 반영
- 신산님 추가 요구에 따라 봇은 버전 단위로 관리하고, 봇 복사뿐 아니라 다운로드/업로드가 가능해야 한다는 원칙을 반영했다.
- `Bot Workspace`에 `Bot Version / Package` 영역을 추가했다.
- 현재 봇의 버전, Aidot/CGA 호환성, 봇 복사, 봇 다운로드, 봇 업로드, 버전 다운로드, 버전 업로드 버튼 위치를 표시했다.
- `Detail Settings`에 `Reusable Bot Assets` 영역을 추가했다.
- 의도/답변, 동의어, 개체, 사전, 시나리오, API 매핑을 Aidot 호환 패키지로 다운로드/업로드할 수 있어야 한다고 화면에 표시했다.
- CGA에서 다운로드한 봇 패키지는 Aidot에 업로드 가능해야 하고, Aidot에서 다운로드한 봇 패키지도 CGA에 업로드 가능해야 한다는 상호 호환 원칙을 정책 문서에 추가했다.
- 다만 현재 Aidot가 다국어를 지원하지 않으므로 Aidot 호환 패키지는 선택한 단일 봇 언어 기준으로 처리하고, CGA 다국어 패키지는 CGA 전용 경로 또는 Aidot 호환성 수정이 필요한 후보로 구분했다.
- 기본 방향은 Aidot를 수정하지 않고 CGA가 Aidot 기존 형식에 맞추는 것이다. Aidot 수정은 정말 다른 방법이 없을 때만 사유와 영향 범위를 제시한 뒤 진행한다.
- 이 작업은 CGA Studio 화면/정책 보강이며 Aidot 코드는 수정하지 않았다.


### 2026-06-06 Aidot import/export 포맷 계약 추가
- Aidot 저장소는 수정하지 않고, `D:\Project\Aidot\docs\asset-import-export-format.md`와 관련 화면/라이브러리만 참조했다.
- 확인한 Aidot 기준은 봇 전체/봇 버전/대화/API는 JSON, 개체/동의어 사전/Blocklist/의도 발화문/Rule은 TXT이다.
- Aidot 기준에서 JSON 업로드는 교체, TXT 업로드는 병합으로 정리되어 있다.
- `packages/contracts/src/aidot-package-contract.js`를 추가해 CGA가 따라야 할 Aidot 호환 패키지 scope, 파일 형식, 업로드 모드, 봇 JSON 최상위 키, 대화 JSON 최상위 키, `dialogType` 규칙을 코드 계약으로 고정했다.
- `scripts/check-studio-config.js`에 Aidot 호환 패키지 계약 검증을 추가했다.
- `Bot Workspace`와 `Detail Settings` 화면에 JSON/TXT 및 교체/병합 기준을 표시했다.
- 정책 문서에 Aidot 호환 import/export 포맷 매트릭스를 추가했다.
- 이 작업은 CGA 계약/화면/정책 보강이며 Aidot 코드는 수정하지 않았다.


### 2026-06-06 Bot Package 다운로드/업로드 동작 연결
- `Bot Workspace`의 `Download Bot`, `Upload Bot`, `Download Version`, `Upload Version` 버튼을 실제 브라우저 동작에 연결했다.
- `Download Bot`은 Aidot 호환 최상위 키를 가진 JSON 패키지를 생성한다.
- 생성되는 봇 패키지는 `AIDOTAssistantVersion`, `messageDigest`, `botVo`, `licenseVo`, `botSystemConfigVoList`, `dialogList`, `dialogFlowGraphList`, `entityTypeList`, `faqDialogList`, `floatingButtonVoList`, `ruleVoList`, `smallTalkVoList`, `dictionaryVoList`, `blacklistList`를 포함한다.
- `Upload Bot`은 JSON 파일을 읽어 `botVo` 기준으로 현재 그룹에 새 봇을 추가하고, 현재 작업 봇으로 선택한다.
- `Download Version`은 CGA 버전 패키지를 생성하고, `Upload Version`은 해당 패키지를 현재 봇의 Studio 상태에 반영한다.
- 현재 단계는 CGA Studio 브라우저 상태 기반 동작이며, 서버 저장/API 연결은 다음 단계에서 Aidot 호환 계약 기준으로 연결한다.
- Aidot 코드는 수정하지 않았다.


### 2026-06-06 Dictionary / Entity TXT 다운로드·업로드 동작 연결
- `Detail Settings`의 `Dictionary`와 `Entities` 카드에 실제 TXT 다운로드/업로드 동작을 연결했다.
- `Dictionary` 다운로드는 Aidot 호환 `대표어,유의어1,유의어2,...` TXT 형식으로 생성한다.
- `Dictionary` 업로드는 `대표어,유의어...` 형식과 legacy `단어,동의어` 형식을 읽고 기존 사전에 병합한다.
- `Entity` 다운로드는 Aidot 호환 `개체명,개체값,유형(S/P),상세` TXT 형식으로 생성한다.
- `Entity` 업로드는 같은 TXT 형식을 읽고 기존 개체 목록에 병합한다.
- 다운로드 파일명은 `Dictionary_봇명_YYYYMMDD.txt`, `Entity_봇명_YYYYMMDD.txt` 형태를 사용한다.
- 현재 단계는 CGA Studio 브라우저 상태 기반 동작이며, 서버 저장/API 연결은 다음 단계에서 진행한다.
- Aidot 코드는 수정하지 않았다.


### 2026-06-07 나머지 Aidot 호환 자산 다운로드·업로드 동작 연결
- `Detail Settings`의 기존 Reusable Bot Assets 카드 중 미연결 상태였던 `Intent / Answer`, `Synonyms`, `Scenario`, `API Mapping`, `Rule` 버튼에 실제 동작을 연결했다.
- `Synonyms` 카드는 Aidot 기준으로 의도 발화문 TXT 이동에 해당하므로 `발화문,구분값` 형식의 header 없는 TXT로 다운로드·업로드한다.
- `Rule` 다운로드는 Aidot 호환 `룰 이름,룰 설명,룰 표현식,연결 의도/모듈,사용여부(Y/N)` TXT 형식으로 생성한다.
- `Rule` 업로드는 같은 TXT 형식을 읽고 기존 Rule 목록에 병합한다.
- `Intent / Answer`와 `Scenario`는 Aidot 대화 JSON 최상위 키인 `flowGraph`, `licenseInfo`, `AIDOTAssistantVersion`, `dialogType`, `messageDigest`를 가진 JSON으로 다운로드·업로드한다.
- `Intent / Answer`는 `dialogType: 1`, `Scenario`는 `dialogType: 0` 기준으로 생성한다.
- `API Mapping`은 현재 선택된 `group_id + bot_id`의 API Registry 항목을 JSON으로 다운로드하고, 업로드 시 같은 그룹/봇 범위의 API 목록을 교체한다.
- 현재 단계는 CGA Studio 브라우저 상태 기반 동작이며, 실제 서버 저장/API 연결은 다음 단계에서 진행한다.
- `node --check apps\studio\app.js`와 `npm run studio:validate`를 통과했다.
- Aidot 코드는 수정하지 않았다.


### 2026-06-07 자산 이동 API 계약 추가
- 브라우저 상태 기반으로 연결한 봇/자산 다운로드·업로드 기능을 서버형 SaaS 구조에서 받을 수 있도록 Public Core API 계약을 추가했다.
- 새 파일은 `packages/contracts/src/asset-transfer-api-contract.js`이다.
- API 네임스페이스는 기존 Aidot 런타임/webchat/API를 건드리지 않기 위해 `/api/cga/groups/{groupId}/bots/{botId}/...` 기준으로 고정했다.
- Route 기준은 `EXPORT`, `IMPORT`, `MANIFEST`, `HISTORY` 네 가지다.
- 모든 자산 이동은 `group_id + bot_id + scope` 기준이며, scope는 `aidot-package-contract.js`의 Aidot 호환 scope를 그대로 사용한다.
- Bot/API/Dialog/TXT 자산별 파일 포맷과 upload mode는 기존 `aidot-package-contract.js`에서 가져오므로, 화면과 서버 계약이 서로 다른 포맷을 쓰지 않도록 했다.
- Export/Import 권한은 group scope 기준으로 분리했다. 예: API 자산은 `apiAnswer.manage`, 일반 봇 자산 import는 `bot.update` 또는 bot 생성은 `bot.create` 기준이다.
- `package.json`에 `studio:asset-transfer-check`를 추가하고 `studio:validate`에 포함했다.
- `scripts/check-studio-config.js`에서 모든 Aidot 호환 scope에 자산 이동 권한 요구사항과 `/api/cga` route가 있는지 검사하도록 했다.
- 이 단계는 실제 API 서버 구현이 아니라 서버 구현 전 계약 고정 단계다.
- Aidot 코드는 수정하지 않았다.


### 2026-06-07 Studio 서버 자산 이동 API 최소 구현
- `scripts/serve-studio.js`에 `/api/cga/groups/{groupId}/bots/{botId}/assets/{scope}/manifest`, `export`, `import`, `asset-transfers` endpoint를 추가했다.
- 기존 Aidot 런타임/webchat/API endpoint는 수정하지 않고, CGA 전용 `/api/cga` namespace 안에서만 처리한다.
- `manifest`는 `asset-transfer-api-contract.js`와 `aidot-package-contract.js` 기준으로 현재 scope의 파일 형식, upload mode, 권한 요구사항을 반환한다.
- `export`는 Aidot 호환 샘플 JSON/TXT 패키지를 내려준다. TXT 자산은 Aidot 기준 header/row 형식을 유지한다.
- `import`는 요청 본문을 받고 `accepted` 상태와 manifest를 반환하며, 현재 단계에서는 DB 저장 대신 서버 메모리의 transfer history에 기록한다.
- `asset-transfers`는 같은 `group_id + bot_id` 범위에서 export/import 기록을 반환한다.
- 권한 요구사항에서 존재하지 않는 `bot.update` 참조를 발견해 실제 access contract에 존재하는 `bot.configure`로 수정했다.
- `scripts/check-asset-transfer-api.mjs`를 추가해 임시 Studio 서버를 띄우고 manifest/export/import/history endpoint를 자동 검증한다.
- `package.json`에 `studio:asset-api-check`를 추가하고 `studio:validate`에 포함했다.
- `node --check scripts\serve-studio.js`, `node --check packages\contracts\src\asset-transfer-api-contract.js`, `npm run studio:validate`, 실제 curl endpoint 확인을 통과했다.
- 이 단계는 영구 저장소 연결 전 최소 서버 API 구현이며, 다음 단계에서 서버 저장소/화면 fetch 연결로 이어간다.
- Aidot 코드는 수정하지 않았다.


### 2026-06-07 자산 이동 기록 파일 저장소 추가
- `scripts/serve-studio.js`의 자산 이동 기록을 서버 메모리 배열에서 파일 기반 저장으로 전환했다.
- 기본 저장 위치는 CGA 루트의 `.cga-data/asset-transfer-history.json`이며, 운영/테스트에서는 `CGA_DATA_DIR` 환경 변수로 위치를 바꿀 수 있다.
- `.cga-data/`는 런타임 데이터이므로 `.gitignore`에 추가했다.
- `export`와 `import`가 발생하면 `recordAssetTransfer()`를 통해 파일에 즉시 기록한다.
- `asset-transfers` 조회는 파일에서 로드된 transfer history를 기준으로 응답한다.
- `scripts/check-asset-transfer-api.mjs`는 임시 `CGA_DATA_DIR`을 사용해 테스트하고, manifest/export/import/history뿐 아니라 `asset-transfer-history.json` 파일 생성과 기록 개수까지 검증한다.
- 이 단계는 정식 DB 전 단계의 재시작 대비 저장소이며, 다음 단계에서 실제 group/bot asset body 저장 또는 DB adapter로 확장한다.
- Aidot 코드는 수정하지 않았다.


### 2026-06-07 자산 본문 파일 저장 및 재export 연결
- `scripts/serve-studio.js`에 업로드된 자산 본문 저장소를 추가했다.
- 저장 위치는 `.cga-data/assets/{groupId}/{botId}/{scope}.{fileFormat}`이며, URL 값은 `sanitizePathSegment()`로 정규화해 경로 주입을 막는다.
- `import` 요청이 들어오면 요청 본문을 자산 파일로 저장하고, transfer history에 `asset_path`를 기록한다.
- `export` 요청은 저장된 자산 본문이 있으면 샘플 데이터 대신 저장본을 내려준다.
- 저장본이 없을 때만 기존 Aidot 호환 샘플 JSON/TXT를 반환한다.
- export history에는 `source: stored` 또는 `source: sample`을 기록해 운영자가 어떤 데이터가 내려갔는지 확인할 수 있게 했다.
- `scripts/check-asset-transfer-api.mjs`는 import 후 재export를 호출해 업로드한 본문이 다시 내려오는지 확인한다.
- 이 단계는 정식 DB 전 단계의 파일 저장소이며, 다음 단계에서 Studio 화면 버튼을 서버 API 호출로 전환하거나 DB adapter를 추가한다.
- Aidot 코드는 수정하지 않았다.


### 2026-06-07 Studio 자산 버튼 서버 API 연결
- `Detail Settings`의 Reusable Bot Assets 다운로드/업로드 버튼을 `/api/cga/groups/{groupId}/bots/{botId}/assets/{scope}/...` 서버 API에 연결했다.
- 다운로드는 먼저 서버 `export` endpoint를 호출하고, 서버 응답이 실패할 때만 기존 브라우저 로컬 Blob 생성 방식으로 fallback한다.
- 업로드는 기존 브라우저 상태 병합/적용을 유지하면서, 같은 파일 본문을 서버 `import` endpoint로 전송한다.
- 서버 저장 성공 시 transfer status에 `server saved`를 표시하고, 실패 시 `local only`로 표시해 운영자가 상태를 구분할 수 있게 했다.
- `requestTextUpload()`와 `requestJsonUpload()`은 원본 파일명을 handler에 함께 전달하도록 바꿨고, 서버에는 `X-CGA-File-Name`으로 전달한다.
- `intentDialog`, `scenario`, `apiMapping`, `intentUtterance`, `entity`, `dictionary`, `rule`을 Aidot 호환 scope로 매핑했다.
- `scripts/check-studio-config.js`에 Studio 화면이 `downloadAssetFromServer`, `uploadAssetToServer`, `/api/cga/groups/` 연결을 유지하는지 검사하는 회귀 체크를 추가했다.
- 기존 Bot Workspace의 Bot/Version 패키지 버튼은 아직 브라우저 로컬 패키지 방식이며, 다음 단계에서 서버 API 연결 대상으로 남아 있다.
- Aidot 코드는 수정하지 않았다.


### 2026-06-07 Bot Workspace 패키지 버튼 서버 API 연결
- `Bot Workspace`의 `Download Bot`, `Upload Bot`, `Download Version`, `Upload Version` 버튼을 서버 자산 이동 API에 연결했다.
- Bot 패키지는 Aidot 호환 scope `bot`, Version 패키지는 scope `version`으로 매핑한다.
- 다운로드는 서버 `export`를 우선 호출하고 실패하면 기존 브라우저 로컬 패키지 생성으로 fallback한다.
- 업로드는 기존 화면 상태 반영을 유지하면서 서버 `import` endpoint에 같은 JSON 본문을 저장한다.
- 서버 저장 성공 시 transfer status에 `server saved`, 실패 시 `local only`를 표시한다.
- 서버 export wrapper 형태인 `{ manifest, package }`도 다시 업로드할 수 있도록 Bot/Version apply 함수가 `package` 내부 본문을 읽을 수 있게 했다.
- `scripts/serve-studio.js`의 version 샘플 JSON을 CGA 버전 패키지 형태에 맞췄다.
- `scripts/check-studio-config.js`에 `botPackage -> bot`, `versionPackage -> version` scope 매핑 회귀 체크를 추가했다.
- Aidot 코드는 수정하지 않았다.


### 2026-06-07 Bot Workspace Transfer History 화면 추가
- 운영자가 파일이나 CLI를 직접 보지 않아도 서버 자산 이동 기록을 확인할 수 있도록 `Bot Workspace`의 `Bot Version / Package` 카드에 `Server Transfer History` 패널을 추가했다.
- `refreshTransferHistory()`가 `/api/cga/groups/{groupId}/bots/{botId}/asset-transfers`를 호출해 현재 그룹/봇의 최근 기록을 조회한다.
- 최근 5개 기록을 `scope · direction`, `source 또는 asset_path`, `created_at` 형태로 표시한다.
- 서버 history 조회 실패 시 `History unavailable` 상태를 화면에 표시한다.
- 패널 스타일은 기존 Aidot 기준 폰트 정책을 유지해 제목 12px, 기록 본문 10px, 설명 9px 기준으로 구성했다.
- `scripts/check-studio-config.js`에 `refreshTransferHistory`와 `data-transfer-history`가 유지되는지 검사하는 회귀 체크를 추가했다.
- 이 단계는 서버 저장소를 화면에서 확인하는 운영 UI이며, Aidot 코드는 수정하지 않았다.


### 2026-06-07 Bot/Version 자산 이동 API 자동 검증 확대
- 기존 자산 이동 API 검증은 `dictionary` TXT 중심이었으나, Bot Workspace의 `Download Bot`, `Upload Bot`, `Download Version`, `Upload Version`이 서버 API에 연결되었으므로 자동 검증 범위를 확대했다.
- `scripts/check-asset-transfer-api.mjs`가 임시 Studio 서버와 임시 `CGA_DATA_DIR`을 띄운 뒤 `dictionary`, `bot`, `version` scope를 모두 실제 HTTP로 검증한다.
- `bot` scope는 manifest의 파일 형식이 JSON인지, import 권한 기준이 `bot.create`인지, export가 Aidot 호환 `botVo` 패키지를 반환하는지 확인한다.
- `bot` import 후에는 업로드한 JSON 본문이 `.cga-data/assets/{groupId}/{botId}/bot.json`에 저장되고, 재export 시 저장본이 다시 내려오는지 확인한다.
- `version` scope는 manifest의 파일 형식이 JSON인지, import 권한 기준이 `bot.configure`인지, export가 CGA version package 구조를 반환하는지 확인한다.
- `version` import 후에는 업로드한 JSON 본문이 `.cga-data/assets/{groupId}/{botId}/version.json`에 저장되고, 재export 시 저장본이 다시 내려오는지 확인한다.
- transfer history는 dictionary/bot/version의 export/import/re-export 기록이 모두 남는지 확인하도록 최소 9건 이상을 검증한다.
- 이 검증은 서버형 SaaS 구조에서 Bot/Version 패키지 호환 다운로드·업로드가 깨지지 않도록 막는 회귀 체크이며, Aidot 코드는 수정하지 않았다.


## 2026-06-08

### Bot Workspace 전송 이력 다국어 문구 보강
- `Bot Workspace`의 `Server Transfer History` 패널에 남아 있던 하드코딩 문구를 i18n 키로 전환했다.
- 전환한 문구는 이력 제목, 로딩 상태, 빈 이력 상태, 조회 실패 상태이다.
- 영문/한국어 locale 리소스와 브라우저 내장 `apps/studio/i18n.js` 리소스에 같은 키를 추가했다.
- 다른 locale은 해당 키가 없으면 기존 i18n fallback 규칙에 따라 영어로 표시된다.
- `scripts/check-studio-config.js`에 transfer history i18n 키가 Studio 앱과 i18n 리소스에 모두 존재하는지 확인하는 회귀 체크를 추가했다.
- 이 작업은 화면 문구와 검증 보강이며, Aidot 코드는 수정하지 않았다.


### CGA 인증/그룹 관리 서버 API 최소 구현
- 계약과 화면 상태 모델로만 존재하던 CGA 사용자/그룹 관리 기능을 `scripts/serve-studio.js`의 CGA 전용 API로 연결했다.
- 추가한 endpoint는 `/api/cga/auth/signup`, `/api/cga/auth/login`, `/api/cga/auth/me`, `/api/cga/groups`, `/api/cga/groups/join-requests`, `/api/cga/groups/join-requests/{request_id}/approve`, `/api/cga/admin/permission-requests`, `/api/cga/admin/permission-requests/{request_id}/approve`이다.
- 기존 Aidot 런타임/API/webchat endpoint는 수정하지 않고, CGA 관리 API는 모두 `/api/cga` namespace 안에만 추가했다.
- 서버 상태 저장은 현재 자산 저장소와 같은 `.cga-data/access-state.json` 파일 기반으로 구현했다. 정식 DB 전 단계의 재시작 대비 저장소이다.
- API 구현은 `packages/public-core/src/access-state.js`의 상태 전이 함수와 `packages/contracts/src/access-contract.js`, `auth-api-contract.js`를 재사용한다.
- 그룹 생성은 시스템 `admin`만 가능하고, 그룹 가입 승인은 대상 그룹 관리자 또는 시스템 admin, 관리자 권한 승인은 시스템 admin만 가능하도록 기존 Public Core 규칙을 따른다.
- `scripts/check-auth-api.mjs`를 추가해 실제 임시 Studio 서버를 띄우고 signup/login/me/groups/join approval/admin approval/persistence 흐름을 HTTP로 검증한다.
- `package.json`의 `studio:validate`에 `studio:auth-api-check`를 추가했다.
- `scripts/check-studio-config.js`에 CGA 인증/그룹 API route와 `access-state.json` 저장소 존재 여부를 확인하는 회귀 체크를 추가했다.
- Aidot 코드는 수정하지 않았다.


### Access Management 화면 서버 API 연결
- `Users, Login, and Access` 화면의 로그인, 가입, 그룹 생성, 그룹 가입신청, 그룹 가입 승인, 관리자 권한 승인 버튼을 서버 API 우선 방식으로 연결했다.
- 화면은 `/api/cga/auth/login`, `/api/cga/auth/signup`, `/api/cga/groups`, `/api/cga/groups/join-requests`, `/api/cga/groups/join-requests/{request_id}/approve`, `/api/cga/admin/permission-requests/{request_id}/approve`를 호출한다.
- 작업 성공 후에는 `/api/cga/groups`를 다시 호출해 서버의 `.cga-data/access-state.json` 기준 상태를 화면에 반영한다.
- 서버 API 호출이 실패하는 경우에는 기존 브라우저 로컬 상태 전이를 fallback으로 사용한다. 이 fallback은 화면 시안 검토 중 서버가 꺼졌을 때만 사용하는 임시 안전장치이다.
- 최초 화면 로딩 시에도 `refreshAccessStateFromServer()`를 호출해 서버에 저장된 사용자/그룹 상태를 화면에 동기화한다.
- `scripts/check-studio-config.js`에 Access 화면이 CGA auth/group API route를 실제로 참조하는지 확인하는 회귀 체크를 추가했다.
- 이 작업은 CGA 화면과 CGA 관리 API 연결이며, Aidot 코드는 수정하지 않았다.


### Group API Registry 서버 저장소/API 연결
- `External API Answer Source`의 `Group API Registry`를 브라우저 메모리 배열에서 CGA 서버 API 우선 방식으로 연결했다.
- 추가한 endpoint는 `/api/cga/groups/{groupId}/bots/{botId}/api-answers`이다.
- `GET`은 선택한 `group_id + bot_id`의 API 답변 목록을 반환하고, `POST`는 `apiAnswer.manage` 권한이 있는 사용자만 그룹 관리 API 답변을 등록할 수 있다.
- 서버 저장소는 `.cga-data/api-answer-registry.json` 파일이다. 정식 DB 전 단계의 재시작 대비 저장소로 사용한다.
- API 답변 등록은 `packages/contracts/src/api-answer-contract.js`의 `createGroupManagedApiAnswerDraft()`를 사용해 `group_id`, `bot_id`, `managed_by: group`, `allowed_group_scopes` 기준을 유지한다.
- 화면은 `refreshApiRegistryFromServer()`로 서버 목록을 읽고, `saveApiAnswerToServer()`로 신규 API 답변을 저장한다.
- `scripts/check-api-answer-api.mjs`를 추가해 권한 없는 사용자 차단, 권한 있는 사용자 등록, response mapping, 파일 저장을 실제 HTTP로 검증한다.
- `package.json`의 `studio:validate`에 `studio:api-answer-check`를 추가했다.
- `scripts/check-studio-config.js`에 Group API Registry 화면/서버 route와 `api-answer-registry.json` 저장소 존재 여부를 확인하는 회귀 체크를 추가했다.
- Aidot 코드는 수정하지 않았다.


### Bot Workspace 그룹별 봇 목록/생성 서버 API 연결
- `Bot Workspace`의 그룹별 봇 목록과 `Create Bot` 버튼을 브라우저 메모리 배열에서 CGA 서버 API 우선 방식으로 연결했다.
- 추가한 endpoint는 `/api/cga/groups/{groupId}/bots`이다.
- `GET`은 선택한 그룹의 봇 목록을 반환하고, `POST`는 `bot.create` 권한이 있는 사용자만 그룹 봇을 생성할 수 있다.
- 서버 저장소는 `.cga-data/workspace-bots.json` 파일이다. 정식 DB 전 단계의 재시작 대비 저장소로 사용한다.
- 화면은 `refreshWorkspaceBotsFromServer()`로 서버 봇 목록을 읽고, `createWorkspaceBotOnServer()`로 신규 봇을 저장한다.
- 그룹 변경 시 선택 그룹의 서버 봇 목록을 다시 읽고, 첫 번째 봇을 현재 작업 봇으로 동기화한다.
- 최초 화면 로딩 시 access state를 서버에서 읽은 뒤 Bot Workspace 봇 목록도 서버에서 동기화한다.
- `scripts/check-workspace-bots-api.mjs`를 추가해 그룹 봇 목록 조회, 권한 없는 생성 차단, 권한 있는 생성, 파일 저장을 실제 HTTP로 검증한다.
- `package.json`의 `studio:validate`에 `studio:workspace-bots-check`를 추가했다.
- `scripts/check-studio-config.js`에 Bot Workspace 화면/서버 route와 `workspace-bots.json` 저장소 존재 여부를 확인하는 회귀 체크를 추가했다.
- Aidot 코드는 수정하지 않았다.


### Create Bot 구조 설정 서버 저장/API 연결
- `Create Bot`에서 입력하는 봇명, 설명, 기본 언어, 버전, LLM 사용 여부, 입력 방식, PDF 허용, 오케스트레이터 모드, Bot Server 위치를 현재 봇의 Studio 상태로 서버에 저장하도록 연결했다.
- 추가한 endpoint는 `/api/cga/groups/{groupId}/bots/{botId}/studio-state`이다.
- `GET`은 선택한 `group_id + bot_id`의 저장된 Studio 상태를 반환하고, 저장본이 없으면 현재 workspace bot 메타데이터 기준 기본 상태를 반환한다.
- `PUT`은 `bot.configure` 권한이 있는 사용자만 저장할 수 있다.
- 서버 저장소는 `.cga-data/studio-state-registry.json` 파일이다. 정식 DB 전 단계의 재시작 대비 저장소로 사용한다.
- Studio 상태 저장 시 `workspace-bots.json`의 봇명, 버전, 언어도 함께 갱신해 Bot Workspace 목록과 Create Bot 입력값이 어긋나지 않게 했다.
- 화면은 `refreshStudioStateFromServer()`로 선택 봇의 구조 설정을 읽고, `saveStudioStateToServer()`로 Create Bot 변경 내용을 저장한다.
- 그룹 변경, 봇 열기, 최초 화면 로딩 시 서버에 저장된 Studio 상태를 다시 읽어 화면 입력값과 요약 패널에 반영한다.
- `scripts/check-studio-state-api.mjs`를 추가해 기본 상태 조회, 권한 없는 저장 차단, 권한 있는 저장, 파일 저장, workspace bot 메타데이터 갱신을 실제 HTTP로 검증한다.
- `package.json`의 `studio:validate`에 `studio:studio-state-check`를 추가했다.
- `scripts/check-studio-config.js`에 Create Bot 상태 API route와 `studio-state-registry.json` 저장소 존재 여부를 확인하는 회귀 체크를 추가했다.
- Aidot 코드는 수정하지 않았다.


### Configure Bot 학습문장/PDF 구성 입력 서버 저장/API 연결
- `Configure Bot`의 학습문장 입력, 요청 의도 수, 수동 LLM Handoff 파일 내보내기, LLM 결과 가져오기, PDF 선택/저장을 실제 화면 동작으로 연결했다.
- 추가한 endpoint는 `/api/cga/groups/{groupId}/bots/{botId}/composition`이다.
- `GET`은 선택한 `group_id + bot_id`의 구성 입력 상태를 반환하고, 저장본이 없으면 기본 학습문장/의도 후보 샘플을 반환한다.
- `PUT`은 `bot.configure` 권한이 있는 사용자만 저장할 수 있다.
- 서버 저장소는 `.cga-data/composition-registry.json` 파일이다. 정식 DB 전 단계의 재시작 대비 저장소로 사용한다.
- 학습문장 경로는 LLM이 연결되지 않아도 수동 Handoff JSON을 다운로드하고, 외부 LLM 결과 JSON을 다시 업로드해 의도 후보를 구성할 수 있게 했다.
- PDF 경로는 현재 단계에서 PDF 파일명, 크기, MIME type, data URL을 구성 입력 상태로 저장한다. 실제 PDF Q&A 생성은 기존 설계대로 LLM 연결 조건이 충족될 때 활성화된다.
- 화면은 `refreshCompositionFromServer()`로 선택 봇의 구성 입력을 읽고, `saveCompositionToServer()`로 변경 내용을 저장한다.
- 그룹 변경, 봇 열기, 최초 화면 로딩 시 서버에 저장된 composition을 다시 읽어 학습문장 입력값과 Intent Review Preview에 반영한다.
- `scripts/check-composition-api.mjs`를 추가해 기본 상태 조회, 권한 없는 저장 차단, 권한 있는 저장, PDF 메타데이터 저장, 파일 저장을 실제 HTTP로 검증한다.
- `package.json`의 `studio:validate`에 `studio:composition-check`를 추가했다.
- `scripts/check-studio-config.js`에 Configure Bot composition API route와 `composition-registry.json` 저장소 존재 여부를 확인하는 회귀 체크를 추가했다.
- Aidot 코드는 수정하지 않았다.


### Studio 다국어 반응 보강
- 신산님 확인 결과, 영어/한국어 이외 언어를 선택해도 JS 동적 렌더링 영역과 일부 select option이 거의 영어로 남는 문제가 있었다.
- 원인은 정적 `data-i18n` 리소스 일부가 영어 fallback 값으로 남아 있고, `Bot Workspace`, Top Context, 권한 라벨, Create Summary처럼 JS가 그리는 영역은 별도 번역 해석을 사용하지 않았기 때문이다.
- `apps/studio/index.html`의 Create Bot 주요 select option에 `data-i18n` 키를 추가했다.
- `apps/studio/app.js`에 동적 메시지 오버레이를 추가해 상단 배지, 좌측 권한 라벨, Bot Workspace 요약, Create Summary 값, 패키지 포맷 표시가 선택 언어에 반응하도록 했다.
- 언어 선택 시 기존 사용자 locale로 되돌아가는 현상을 줄이기 위해 현재 language selector 값을 우선 사용하도록 `getCurrentLocale()`와 `syncStudioLocaleToCurrentUser()`를 보완했다.
- 1차 보강 언어는 영어, 한국어, 독일어, 일본어, 중국어 간체이다. 베트남어/프랑스어는 다음 보강 단위에서 같은 방식으로 화면별 누락 키를 확장한다.
- `packages/i18n/locales/en.json`에 새 option i18n key를 추가해 i18n coverage guard가 새 정적 키를 감시하게 했다.
- `node --check apps/studio/app.js`, `node scripts/check-i18n-coverage.js`, `npm run studio:validate`를 통과했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-08 Studio locale 리소스 전체 키 동기화
- 신산님 지적대로 영어/한국어 외 언어가 부분적으로만 반응하던 문제를 더 좁혀 확인했다.
- 원인은 `packages/i18n/locales/en.json`에는 새 키가 추가됐지만 `de`, `fr`, `ja`, `ko`, `vi`, `zh-CN` locale 파일에는 일부 키가 누락되어 있었고, `apps/studio/i18n.js` 내장 리소스도 JSON 리소스와 동기화 검증이 없었기 때문이다.
- 영어 기준 locale 키를 모든 1차 지원 언어 파일에 맞췄다.
- 보강한 핵심 영역은 Create Bot select option, CGA/Bot 에러 그룹 라벨, Bot/Version Package 및 Server Transfer History 문구이다.
- `apps/studio/i18n.js`를 `packages/i18n/locales/*.json` 기준으로 재생성해 브라우저에서 사용하는 내장 리소스도 같은 키를 갖게 했다.
- `scripts/check-studio-config.js`에 모든 locale 파일이 영어 기준 키를 빠짐없이 갖는지 확인하는 검증을 추가했다.
- `scripts/check-studio-config.js`에 `apps/studio/i18n.js` 내장 리소스가 locale JSON 파일과 동기화되어 있는지 확인하는 검증을 추가했다.
- `node --check scripts/check-studio-config.js`, `node --check apps/studio/i18n.js`, `node scripts/check-studio-config.js`, `node scripts/check-i18n-coverage.js`를 통과했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-08 Studio 주요 화면 다국어 문구 보강
- locale 키 동기화 이후에도 일부 언어 파일에 영어 fallback 값이 많이 남아 있음을 확인했다.
- 한 번에 전체 전문 번역을 완료하기보다, 현재 화면에서 즉시 보이는 상단/좌측 메뉴, Workflow, Production/System Admin/Reference 메뉴, Create Bot 주요 제목/필드/선택지, 요약, 승인 라벨, CGA/Bot 에러 메시지, Bot/Version Package 영역을 우선 보강했다.
- 독일어, 일본어, 중국어 간체, 베트남어, 프랑스어에 주요 화면 문구 번역을 추가했다.
- JS가 동적으로 렌더링하는 Allowed/Blocked, 그룹/봇/버전 배지, 서버 저장 상태, workspace 빈 상태, JSON/TXT 병합 라벨에 베트남어/프랑스어 메시지를 추가하고, 독일어/일본어/중국어 간체의 서버 저장 상태 문구도 보강했다.
- `apps/studio/i18n.js`는 locale JSON 기준으로 다시 동기화했다.
- 아직 전체 설명문/설계문 수준의 전문 번역은 남아 있으며, 다음 단계에서 화면별로 계속 축소해야 한다.
- `node --check apps/studio/app.js`, `node --check apps/studio/i18n.js`, `node scripts/check-studio-config.js`를 통과했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-08 핵심 화면 i18n fallback 방지 검증 추가
- 다국어 리소스에 키가 있어도 값이 영어와 같으면 사용자는 언어 변경이 반응하지 않는 것으로 느낄 수 있으므로, 핵심 화면 키에 대한 추가 검증을 만들었다.
- `scripts/check-i18n-critical.js`를 추가해 독일어, 프랑스어, 일본어, 베트남어, 중국어 간체에서 주요 화면/운영 라벨이 영어 fallback 값으로 남지 않도록 검사한다.
- 핵심 검증 대상은 상단 버튼, 워크플로우, Bot Workspace, Team Dashboard, Configure, Detail, Build, Test, Operate, Access/Admin, Group API Registry, Collaboration의 제목/버튼/필드 라벨이다.
- 독일어, 일본어, 중국어 간체, 베트남어, 프랑스어의 핵심 운영 화면 라벨을 추가로 보강했다.
- `apps/studio/i18n.js`는 locale JSON 기준으로 다시 동기화했다.
- `package.json`에 `studio:i18n-critical-check`를 추가하고 `studio:validate`에 포함했다.
- `node scripts/check-i18n-critical.js`, `node scripts/check-studio-config.js`, `node scripts/check-i18n-coverage.js`를 통과했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-08 상태 패널 i18n fallback 축소
- 핵심 라벨 검증 이후에도 승인 체크리스트, 잠금 정책, Studio 상태, 상용 모듈, 모듈 경계, Public Core 계약, Open Core 영역의 상태 패널 문구가 영어 fallback으로 남아 있었다.
- 독일어, 프랑스어, 일본어, 중국어 간체, 베트남어에 해당 상태 패널 문구를 추가했다.
- `scripts/check-i18n-critical.js`의 검증 범위를 `approval`, `workingRule`, `lock`, `state`, `commercial`, `module`, `contracts`, `openCore` prefix 전체로 확장했다.
- `openCore.public`, `openCore.advanced`, `openCore.operations`처럼 영어 제품명처럼 보이던 라벨도 각 언어에서 반응이 보이도록 현지화된 표시명으로 바꿨다.
- `apps/studio/i18n.js`는 locale JSON 기준으로 다시 동기화했다.
- 남은 영어 동일 문구 수는 주요 비영어 locale 기준 약 150개 전후로 줄었다. 남은 항목은 주로 긴 설명문, 기능명, 일부 설계/coverage 문구이다.
- `node scripts/check-i18n-critical.js`, `node scripts/check-i18n-coverage.js`, `node scripts/check-studio-config.js`를 통과했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-08 운영 설명문 i18n fallback 축소
- 남은 영어 fallback 중 사용자/그룹 권한, Admin, Group API Registry, Aidot Feature Coverage, Collaboration 설명문을 우선 보강했다.
- 독일어, 프랑스어, 일본어, 중국어 간체, 베트남어에 운영 설명문과 상태 라벨을 추가했다.
- `scripts/check-i18n-critical.js`의 prefix 검증 범위를 `access`, `admin`, `apiAnswer`, `coverage`, `collab`까지 확장했다.
- `Secrets`, `Dynamic data answer example`, API 예시, Build/Test처럼 영어 제품성 단어로 남아 있던 일부 critical 라벨도 현지화 표시로 바꿨다.
- `apps/studio/i18n.js`는 locale JSON 기준으로 다시 동기화했다.
- 남은 영어 동일 문구 수는 주요 비영어 locale 기준 약 65~70개 수준으로 줄었다. 남은 항목은 주로 hero/contract/create/configure/detail/build/test/operate의 긴 설명문과 일부 기능명이다.
- `node scripts/check-i18n-critical.js`, `node scripts/check-i18n-coverage.js`, `node scripts/check-studio-config.js`를 통과했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-08 비영어 locale 영어 fallback 0개 달성
- 남아 있던 hero, contract, create, workspace, team, configure, review, detail, build, test, operate 영역의 제작 흐름 설명문을 독일어, 프랑스어, 일본어, 중국어 간체, 베트남어에 추가했다.
- 마지막까지 영어와 동일하게 남아 있던 `LLM`, `PDF Q&A`, `Bot Server`, `Web OK`, `Endpoint URL` 같은 약어/제품성 라벨도 각 언어에서 반응이 보이도록 현지화 표시명으로 조정했다.
- `apps/studio/i18n.js`는 locale JSON 기준으로 다시 동기화했다.
- 영어 locale과 값이 완전히 동일한 키는 주요 비영어 locale 기준 0개가 되었다.
- `node scripts/check-i18n-critical.js`, `node scripts/check-studio-config.js`, `node scripts/check-i18n-coverage.js`를 통과했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-09 전체 비영어 fallback 회귀 방지 검증 추가
- 2026-06-08 기준으로 주요 비영어 locale의 영어 동일 문구를 0개까지 줄였으므로, 이 상태가 깨지지 않도록 전체 회귀 검증을 추가했다.
- `scripts/check-i18n-no-fallback.js`를 추가해 독일어, 프랑스어, 일본어, 베트남어, 중국어 간체 locale이 영어 locale과 동일한 값을 갖지 않도록 검사한다.
- `scripts/check-studio-dynamic-i18n.js`를 추가해 JS 동적 렌더링 메시지(`dynamicMessages`)가 `en`, `ko`, `de`, `fr`, `ja`, `vi`, `zh-CN` 전체를 지원하는지 검사한다.
- 동적 검증은 `Allowed/Blocked`, Workspace 빈 상태, 상단 그룹/봇/버전 prefix, summary 상태, transfer 표시 등 JS 렌더링 영역의 필수 키를 확인한다.
- `package.json`의 `studio:validate`에 `studio:i18n-no-fallback-check`, `studio:dynamic-i18n-check`를 추가했다.
- `node scripts/check-i18n-no-fallback.js`, `node scripts/check-studio-dynamic-i18n.js`를 통과했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-09 Detail Settings 자산 서버 저장/API 연결
- 다국어 회귀 방지 이후 다음 잔여 작업으로 `Detail Settings`의 실제 편집 자산 상태를 서버 재시작 대비 저장소에 연결했다.
- 기존에는 `Detail Settings`의 Reusable Bot Assets 다운로드/업로드 버튼이 `/api/cga/groups/{groupId}/bots/{botId}/assets/{scope}/...` 자산 전송 API에는 연결되어 있었지만, 화면이 들고 있는 구조화 상태(`intent_utterances`, `entities`, `dictionary`, `rules`, `scenarios`)를 별도 서버 상태로 읽고 저장하는 API는 없었다.
- `scripts/serve-studio.js`에 `/api/cga/groups/{groupId}/bots/{botId}/detail-assets` API를 추가했다.
  - `GET`: 선택한 `group_id + bot_id`의 Detail 자산 상태를 반환한다.
  - `PUT`: `bot.configure` 권한이 있는 사용자만 Detail 자산 상태를 저장한다.
  - 저장 파일은 `.cga-data/detail-asset-registry.json`이다.
- 서버 기본값은 현재 Studio 화면에서 사용하던 샘플 자산과 동일하게 유지했다.
  - 학습문장/의도: `password_reset`, `account_update`, `billing_question`
  - 개체: `email`, `channel`
  - 사전: `password`, `plan`
  - Rule: `Business hours`, `Billing priority`
  - Scenario: `password_reset`, `account_update`
- `apps/studio/app.js`에 `refreshDetailAssetsFromServer`, `saveDetailAssetsToServer`, `applyDetailAssetsFromServer`를 추가했다.
- 앱 부팅, 그룹 변경, 봇 열기, 새 봇 생성 시 Detail 자산을 서버와 동기화하도록 연결했다.
- Dictionary, Intent Utterance, Entity, Rule, Dialog/Scenario 업로드 후 서버 자산 전송이 성공하면 구조화된 Detail 자산 상태도 같이 저장하도록 연결했다.
- Bot/Version 패키지 업로드 후에도 현재 Studio 상태와 Detail 자산 상태를 저장하도록 보강했다.
- `scripts/check-detail-assets-api.mjs`를 추가해 다음을 검증한다.
  - 기본 Detail 자산 읽기
  - `bot.configure` 권한이 없는 `u-operator`의 저장 차단
  - `u-builder`의 Detail 자산 저장
  - `.cga-data/detail-asset-registry.json` 파일 영구 저장
- `package.json`의 `studio:validate`에 `studio:detail-assets-check`를 추가했다.
- `scripts/check-studio-config.js`가 Detail API route, 앱 refresh/save 함수, 서버 저장 파일, 서버 handler 존재를 감시하도록 보강했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-09 Build/Test/Operate 운영 상태 서버 저장/API 연결
- `Detail Settings` 자산 저장 연결 이후, 남아 있던 제작 흐름 화면 중 `Build`, `Test`, `Operate`가 정적 표시 중심으로 남아 있는 것을 확인했다.
- Aidot의 실제 학습 엔진, 시뮬레이터, 배포 런타임을 새로 구현하지 않고, CGA 화면에서 필요한 운영 상태를 서버에 저장/조회하는 최소 연결을 추가했다.
- `scripts/serve-studio.js`에 `/api/cga/groups/{groupId}/bots/{botId}/operations-state` API를 추가했다.
  - `GET`: 선택한 `group_id + bot_id`의 Build/Test/Operate 상태를 반환한다.
  - `PUT`: 운영 상태 전체 저장용이며 `bot.operate` 권한이 필요하다.
  - `POST /run-build`: Build 실행 상태를 갱신하며 `bot.configure` 권한이 필요하다.
  - `POST /run-test`: Simulator preview 상태를 갱신하며 `bot.review` 권한이 필요하다.
  - `POST /deploy`: 배포 상태를 갱신하며 `bot.deploy` 권한이 필요하다.
  - `POST /refresh-operate`: 운영 지표 refresh용이며 `bot.operate` 권한이 필요하다.
  - 저장 파일은 `.cga-data/operations-state-registry.json`이다.
- `apps/studio/index.html`의 기존 Build/Test/Operate 화면에 새 문구를 만들지 않고 `data-*` 연결점만 추가했다.
  - `Run Build` 버튼은 `/operations-state/run-build`로 연결한다.
  - Test 입력창은 Enter 입력 시 `/operations-state/run-test`로 연결한다.
  - 상단 `Deploy` 버튼은 `/operations-state/deploy`로 연결한다.
  - Build readiness 카드, Simulator 분석 카드, Operate 상태 카드는 서버 상태로 렌더링한다.
- `apps/studio/app.js`에 `currentOperationsState`, `refreshOperationsStateFromServer`, `runOperationsAction`, `renderOperationsPanels`, `bindOperationsActions`를 추가했다.
- 앱 부팅, 그룹 변경, 봇 열기 시 operations state를 서버와 동기화하도록 연결했다.
- 동적 수치 단위(`intents`, `pending`)도 다국어 동적 메시지로 분리했다.
- `scripts/check-studio-dynamic-i18n.js`가 새 동적 단위 키를 감시하도록 보강했다.
- `scripts/check-operations-state-api.mjs`를 추가해 다음을 검증한다.
  - 기본 operations state 읽기
  - 권한 없는 사용자 build 실행 차단
  - builder의 build 실행
  - reviewer의 simulator preview 실행
  - builder의 deploy 차단
  - admin의 deploy 실행
  - `.cga-data/operations-state-registry.json` 파일 영구 저장
- `package.json`의 `studio:validate`에 `studio:operations-state-check`를 추가했다.
- `scripts/check-studio-config.js`가 operations API route, 앱 refresh/action 함수, 서버 저장 파일, 서버 handler 존재를 감시하도록 보강했다.
- `npm run studio:validate`를 통과했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-09 Team Dashboard 협업 상태 서버 저장/API 연결
- `Build/Test/Operate` 운영 상태 연결 이후, `Team Dashboard`의 잠금/검수/차단 해제 동작이 브라우저 메모리 상태로만 유지되는 것을 확인했다.
- 기존 `packages/public-core/src/collaboration-state.js`의 `createSampleCollaborationState`, `lockWorkItem`, `releaseWorkItemLock`, `submitReviewDecision`를 그대로 재사용했다.
- `scripts/serve-studio.js`에 `/api/cga/groups/{groupId}/bots/{botId}/collaboration-state` API를 추가했다.
  - `GET`: 선택한 `group_id + bot_id`의 Team Dashboard 협업 상태를 반환한다.
  - `POST /work-items/{workItemId}/lock`: 작업 항목 편집 잠금을 생성하며 `bot.configure` 권한이 필요하다.
  - `POST /work-items/{workItemId}/unlock`: 작업 항목 편집 잠금을 해제하며 `bot.configure` 권한이 필요하다.
  - `POST /work-items/{workItemId}/approve`: 검수 항목을 승인하며 `bot.review` 권한이 필요하다.
  - `POST /work-items/{workItemId}/request-changes`: 검수 항목을 수정 요청 상태로 돌리며 `bot.review` 권한이 필요하다.
  - 저장 파일은 `.cga-data/collaboration-state-registry.json`이다.
- `apps/studio/app.js`에 `refreshCollaborationStateFromServer`, `runCollaborationAction`, `applyCollaborationStateFromServer`를 추가했다.
- Team Dashboard의 `Lock`, `Unlock`, `Approve`, `Request changes`, `Move to todo` 버튼은 서버 API를 우선 호출하고, 서버 호출 실패 시 기존 로컬 전이를 fallback으로 사용한다.
- 앱 부팅, 그룹 변경, 봇 열기 시 collaboration state를 서버와 동기화하도록 연결했다.
- `rerenderAdminAndAccess`에서 Team Dashboard뿐 아니라 Collaboration Summary도 함께 다시 렌더링하도록 보강했다.
- `scripts/check-collaboration-state-api.mjs`를 추가해 다음을 검증한다.
  - 기본 collaboration state 읽기
  - 권한 없는 사용자 lock 차단
  - builder의 lock/unlock 실행
  - reviewer의 approve 실행
  - `.cga-data/collaboration-state-registry.json` 파일 영구 저장
- `package.json`의 `studio:validate`에 `studio:collaboration-state-check`를 추가했다.
- `scripts/check-studio-config.js`가 collaboration API route, 앱 refresh/action 함수, 서버 저장 파일, 서버 handler 존재를 감시하도록 보강했다.
- `npm run studio:validate`를 통과했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-09 Studio 입력 placeholder 다국어 검증 보강
- 신산님이 지적한 다국어 반응 문제의 연장선에서, Signup, Group Management, Group API Registry 입력칸의 placeholder가 locale 검증 대상에서 빠져 있음을 확인했다.
- `apps/studio/index.html`에는 이미 `data-i18n-placeholder` 연결점이 붙어 있었으나, locale JSON과 `scripts/check-studio-config.js` 검증이 이를 충분히 감시하지 못했다.
- `packages/i18n/locales/en.json`, `ko.json`, `de.json`, `fr.json`, `ja.json`, `vi.json`, `zh-CN.json`에 다음 placeholder 키를 추가했다.
  - `placeholder.signupId`, `placeholder.signupName`, `placeholder.signupGroup`
  - `placeholder.groupId`, `placeholder.groupName`
  - `placeholder.apiName`, `placeholder.apiEndpoint`, `placeholder.apiResponsePath`
- `apps/studio/i18n.js`를 locale JSON 기준으로 다시 동기화했다.
- `scripts/check-studio-config.js`가 `data-i18n-placeholder` 키도 필수 locale key로 검사하도록 보강했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-09 Access/Admin 동적 문구 다국어 보강
- Signup/Group/API placeholder 보강 이후, `apps/studio/app.js`가 동적으로 렌더링하는 Access/Admin 화면 문구 중 일부가 locale JSON 검증 대상이 아니라 영어로 직접 남아 있음을 확인했다.
- 대상 문구는 승인 대기열의 `group join`, `group admin approval`, `requires group admin`, `admin permission`, `system admin approval`, `requires system admin`, `No pending approval`, `Queue is empty`, 정책 상태의 `Yes/No`, `Enabled/Disabled`, `System admin required/Open`, API Registry 빈 상태 문구 등이다.
- 새 서버 API나 기능을 만들지 않고, 기존 `dynamicMessages` 구조에 7개 지원 locale(en, ko, de, fr, ja, vi, zh-CN)의 동적 문구 키를 추가했다.
- `renderAccessPanels()`와 `renderApiRegistry()`가 하드코딩 문자열 대신 `t()` 번역 해석 함수를 사용하도록 변경했다.
- `scripts/check-studio-dynamic-i18n.js`에 새 동적 문구 키를 필수 검사 대상으로 추가해, 다음 작업에서 특정 locale 누락이 발생하면 검증이 실패하도록 했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-09 Team/State 동적 문구 다국어 보강
- Access/Admin 동적 문구 보강 이후, Team Dashboard와 Studio State/Readiness 패널의 일부 상태 문구가 JS 템플릿에서 영어로 직접 출력되는 것을 확인했다.
- 대상 문구는 `Available/Disabled`, `No assigned task`, `No review waiting`, `No blocked item`, `Current user`, `Lock/Unlock/Request changes/Move to todo`, State 패널의 `Bot/Locale/Intents/Documents/Readiness`, `Not named`, `Ready/Blocked`, PDF/Kakao 상태, `No blocking issue` 등이다.
- 새 기능이나 서버 API를 추가하지 않고, 기존 `dynamicMessages`와 `t()` 번역 해석 흐름에만 연결했다.
- `renderCollaborationSummary()`, `renderTeamDashboard()`, `renderStateSummary()`, `renderReadinessIssues()`의 하드코딩 표시 문구를 다국어 동적 메시지로 교체했다.
- `scripts/check-studio-dynamic-i18n.js`에 Team/State 관련 새 동적 키를 필수 검사 대상으로 추가했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-09 Configure/Boundary 동적 문구 다국어 보강
- Team/State 동적 문구 보강 이후, Configure Bot의 Intent Review Preview 빈 상태와 Module Boundary Matrix 헤더가 JS 템플릿에서 영어로 직접 출력되는 것을 확인했다.
- 대상 문구는 `No intent candidate`, `0 utterances`, `Manual handoff or PDF Q&A result required`, `Screen`, `Public Core`, `Commercial Candidate`이다.
- 기존 Configure composition 상태와 Boundary Matrix 데이터 구조는 변경하지 않고, 표시 문구만 `dynamicMessages`와 `t()` 번역 해석 흐름으로 연결했다.
- Intent 후보 상태값 `answer_required`, `ready`도 기존 locale 키 `review.answerRequired`, `review.ready`를 통해 표시되도록 보강했다.
- `scripts/check-studio-dynamic-i18n.js`에 Configure/Boundary 관련 새 동적 키를 필수 검사 대상으로 추가했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-09 전체 locale 전환 기반 보강
- 신산님이 영어/한국어 외 언어가 아직 제대로 동작하지 않는다고 지적했다.
- 기존 리소스에는 7개 locale(en, ko, zh-CN, ja, vi, de, fr)이 들어 있었지만, 화면 실행 기준에서는 언어 전환 기반이 충분히 고정되어 있지 않았다.
- `apps/studio/index.html`에서 `i18n.js`를 `app.js`보다 먼저 로드하도록 순서를 바꿨다. 동적 렌더링 전에 i18n API가 준비되도록 하기 위한 조치다.
- Signup 사용자 언어 선택에 누락되어 있던 `zh-CN` 옵션을 추가했다.
- `apps/studio/i18n.js`의 현재 locale 판단을 localStorage보다 화면의 `data-locale-select` 값을 우선하도록 변경했다. 사용자가 선택한 언어가 동적 렌더링 이후에도 유지되게 하기 위한 조치다.
- `scripts/check-studio-config.js`에 top language selector와 signup locale selector가 7개 지원 locale을 모두 포함하는지, `i18n.js`가 `app.js`보다 먼저 로드되는지, i18n 런타임이 visible selector를 우선하는지 검사하는 회귀 검증을 추가했다.
- Aidot 코드는 수정하지 않았다.

### 2026-06-09 로그인 1차 구현
- 신산님이 `로그인 기능부터 만들어야 하지 않아?`라고 지적했다.
- 확인 결과 CGA에는 `/api/cga/auth/signup`, `/api/cga/auth/login`, `/api/cga/auth/me` 경로와 Access/Admin 화면은 있었지만, 실제 로그인은 `user_id`만으로 현재 사용자를 전환하는 시안 수준이었다.
- 이번 작업에서는 CGA 내부에서만 비밀번호 기반 가입/로그인 1차 기능을 구현했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `scripts/serve-studio.js`
  - `.cga-data/auth-credentials.json` 인증 저장 파일을 추가했다.
  - 가입 시 사용자가 입력한 비밀번호를 raw text로 저장하지 않고 `pbkdf2-sha256` 해시로 저장하도록 했다.
  - 기존 샘플 사용자(`admin`, `u-builder` 등)는 개발 초기 로그인 확인을 위해 사용자 ID와 같은 값을 초기 비밀번호로 seed 한다.
  - `/api/cga/auth/signup`은 `user_id`, `name`, `password`가 모두 있어야 성공한다.
  - `/api/cga/auth/login`은 `user_id + password`를 검증하고, 실패 시 `401 CGA_LOGIN_FAILED`를 반환한다.
- `apps/studio/index.html`
  - Login Session 화면에 `user-id`, `password` 입력칸을 추가했다.
  - Signup 화면에 `password` 입력칸을 추가했다.
- `apps/studio/app.js`
  - 로그인 드롭다운은 계정 선택 보조로 유지하고, 선택 시 user-id 입력칸에 반영되도록 했다.
  - 로그인 요청은 `{ user_id, password }`를 서버로 보낸다.
  - 서버가 `400/401/409`처럼 명시적 오류를 반환하면 로컬 fallback 전환을 하지 않도록 수정했다. 이 부분이 중요하다. 기존 fallback을 그대로 두면 잘못된 비밀번호도 로컬 상태 전환으로 로그인처럼 보일 수 있었다.
  - 네트워크 또는 서버 미기동 같은 비응답 상황에서는 기존 화면 시안 동작을 위해 로컬 fallback을 유지한다. 추후 토큰/쿠키 세션 도입 시 이 fallback은 운영 모드에서 제거해야 한다.
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - `placeholder.loginId`, `placeholder.password`를 7개 locale(en, ko, zh-CN, ja, vi, de, fr)에 추가했다.
  - Studio 번들 i18n 리소스를 locale JSON 기준으로 다시 동기화했다.
- `scripts/check-auth-api.mjs`
  - 가입 시 비밀번호 입력을 포함하도록 변경했다.
  - 정상 비밀번호 로그인 성공을 확인한다.
  - 잘못된 비밀번호 로그인은 `401`로 차단되는지 확인한다.
  - `.cga-data/auth-credentials.json`에 raw password가 저장되지 않고 hash가 저장되는지 확인한다.
- `scripts/check-studio-config.js`
  - 로그인 ID 입력, 로그인 비밀번호 입력, 가입 비밀번호 입력 존재를 검사한다.
  - 서버에 `auth-credentials.json`, `hashPassword`, `verifyPassword`가 있는지 검사한다.

#### 검증 결과
- `node --check scripts/serve-studio.js` 통과
- `node --check apps/studio/app.js` 통과
- `node --check scripts/check-auth-api.mjs` 통과
- `node --check scripts/check-studio-config.js` 통과
- `node scripts/check-auth-api.mjs` 통과
- `node scripts/check-studio-config.js` 통과
- `npm run studio:validate` 통과
- 기존 경고 `MODULE_TYPELESS_PACKAGE_JSON`는 계속 표시되지만 실패가 아니다.

#### 다음 작업
- 로그인 1차는 완료됐지만 아직 운영형 세션은 아니다.
- 다음 단계는 `토큰 또는 쿠키 기반 세션`, `로그아웃`, `현재 사용자 me 상태와 화면 권한의 일관성`, `운영 모드에서 로컬 fallback 제거 또는 dev-only 처리`를 순서대로 진행하는 것이 좋다.

### 2026-06-09 로그인 2차: 세션 토큰/쿠키와 로그아웃 구현
- 로그인 1차 이후 운영형 로그인에 가까워지도록 CGA 내부 인증 세션을 추가했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `packages/contracts/src/auth-api-contract.js`
  - `/api/cga/auth/logout` route를 계약에 추가했다.
  - `LOGOUT_CLEAR_SESSION` action을 추가했다.
  - 인증 응답에 `session_token`, `expires_at`, `auth_scheme` 필드를 포함하도록 확장했다.
- `scripts/serve-studio.js`
  - `.cga-data/auth-sessions.json` 세션 저장 파일을 추가했다.
  - 로그인/가입 성공 시 7일 TTL의 세션 토큰을 생성한다.
  - 응답에는 `session_token`을 포함하고, 브라우저용 `cga_session` HttpOnly 쿠키도 설정한다.
  - 요청 사용자 판정은 `Authorization: Bearer`, `X-CGA-Session-Token`, `cga_session` 쿠키를 먼저 확인하고, 없으면 기존 `X-CGA-User-Id` 헤더로 fallback 한다.
  - `/api/cga/auth/logout`은 현재 세션 토큰을 `.cga-data/auth-sessions.json`에서 제거하고 쿠키를 만료시킨다.
- `apps/studio/index.html`
  - Login Session 영역에 `Logout` 버튼을 추가했다.
- `apps/studio/app.js`
  - 로그인/가입 성공 시 `session_token`을 `localStorage`에 저장한다.
  - 이후 CGA 관리 API 호출에 `X-CGA-Session-Token`을 함께 보낸다.
  - 로그아웃 시 `/api/cga/auth/logout`을 호출하고, 로컬 세션 토큰을 제거한 뒤 기본 `admin` 상태로 돌아간다.
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - `admin.logoutButton`을 7개 locale(en, ko, zh-CN, ja, vi, de, fr)에 추가했다.
- `scripts/check-auth-api.mjs`
  - 로그인 응답에 `session_token`이 있는지 확인한다.
  - `Set-Cookie: cga_session=...`이 내려오는지 확인한다.
  - `X-CGA-Session-Token`만으로 `/api/cga/auth/me`가 로그인 사용자를 찾는지 확인한다.
  - 로그아웃 후 세션 토큰이 `.cga-data/auth-sessions.json`에서 제거되는지 확인한다.
- `scripts/check-studio-config.js`
  - 로그아웃 버튼, logout route, 세션 토큰 저장/전송, 세션 저장 파일과 세션 생성/삭제 helper 존재를 검증한다.

#### 검증 결과
- `node --check scripts/serve-studio.js` 통과
- `node --check apps/studio/app.js` 통과
- `node --check scripts/check-auth-api.mjs` 통과
- `node --check packages/contracts/src/auth-api-contract.js` 통과
- `node scripts/check-auth-api.mjs` 통과
- `node scripts/check-studio-config.js` 통과
- `npm run studio:validate` 통과
- 기존 경고 `MODULE_TYPELESS_PACKAGE_JSON`는 계속 표시되지만 실패가 아니다.

#### 다음 작업
- 지금은 기존 개발 편의를 위해 `X-CGA-User-Id` fallback을 유지한다.
- 운영 모드에서는 이 fallback을 제거하거나 dev-only로 제한해야 한다.
- 다음 인증 단계는 `로그인 실패 메시지 화면 표시`, `세션 만료 시 자동 로그아웃`, `권한 없는 화면 접근 시 사용자 언어 기반 오류 표시`가 적절하다.

### 2026-06-09 로그인 3차: 오류 메시지, 세션 만료, dev-only fallback 분리
- 로그인 2차 이후 남아 있던 운영 품질 항목을 보완했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/index.html`
  - Login Session 영역에 `data-auth-message` 메시지 표시 영역을 추가했다.
- `apps/studio/styles.css`
  - 인증 오류/상태 메시지가 기존 10px 설명 기준 안에서 보이도록 `auth-message` 스타일을 추가했다.
- `apps/studio/app.js`
  - `getCgaErrorMessage`, `setAuthMessage`, `clearAuthMessage`를 추가했다.
  - 로그인 실패 시 서버의 `message_key`를 사용자 현재 언어로 해석해 화면에 표시한다.
  - 가입 실패도 동일하게 화면 메시지로 표시한다.
  - 로그아웃 완료 메시지를 표시한다.
  - API 응답이 `CGA_SESSION_EXPIRED`이면 로컬 세션 토큰을 제거하고 세션 만료 메시지를 표시한다.
- `scripts/serve-studio.js`
  - 요청에 세션 토큰이 포함되어 있는데 해당 세션이 없거나 만료된 경우 `401 CGA_SESSION_EXPIRED`를 반환한다.
  - 만료/잘못된 세션 토큰이 있을 때 `X-CGA-User-Id` fallback으로 우회되지 않도록 했다.
  - `CGA_AUTH_HEADER_FALLBACK=disabled` 환경값을 추가해 운영 모드에서 헤더 기반 사용자 전환을 끌 수 있는 기준을 만들었다.
  - 기본값은 개발 편의를 위해 기존 동작과 호환되도록 fallback enabled 상태다.
- `packages/i18n/error-catalog.json`
  - 인증 관련 에러 코드를 안정 카탈로그에 추가했다.
  - `CGA_LOGIN_FAILED`, `CGA_SIGNUP_REQUIRED_FIELD_MISSING`, `CGA_USER_ALREADY_EXISTS`, `CGA_GROUP_CREATE_FORBIDDEN`, `CGA_GROUP_JOIN_APPROVAL_FORBIDDEN`, `CGA_ADMIN_APPROVAL_FORBIDDEN`, `CGA_SESSION_EXPIRED`
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - 인증 오류/상태 메시지를 7개 locale(en, ko, zh-CN, ja, vi, de, fr)에 추가했다.
  - Studio 번들 i18n 리소스를 locale JSON 기준으로 다시 동기화했다.
- `scripts/check-auth-api.mjs`
  - 잘못된 세션 토큰이 `X-CGA-User-Id: admin`과 함께 와도 `/api/cga/auth/me`가 401을 반환하는지 확인한다.
- `scripts/check-studio-config.js`
  - 인증 메시지 영역, 세션 만료 처리, `CGA_AUTH_HEADER_FALLBACK`, `CGA_SESSION_EXPIRED` 존재를 검증한다.

#### 검증 결과
- `node --check scripts/serve-studio.js` 통과
- `node --check apps/studio/app.js` 통과
- `node scripts/check-auth-api.mjs` 통과
- `node scripts/check-studio-config.js` 통과
- `npm run studio:validate` 통과
- 기존 경고 `MODULE_TYPELESS_PACKAGE_JSON`는 계속 표시되지만 실패가 아니다.

#### 다음 작업
- 다음 단계는 권한 없는 화면/작업 접근 시 같은 메시지 영역 또는 화면별 상태 영역에 사용자 언어 오류를 표시하는 것이다.
- 이후 `CGA_AUTH_HEADER_FALLBACK=disabled` 기준을 docker-compose 운영 profile에 연결하면 운영/개발 모드 분리가 더 명확해진다.

### 2026-06-09 권한 오류 사용자 언어 표시 1차
- 로그인/세션 오류 표시 이후, 권한 없는 작업과 화면 액션도 사용자 언어로 안내되도록 보강했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/index.html`
  - Workspace 상단에 `data-global-message` 공통 작업 메시지 영역을 추가했다.
- `apps/studio/styles.css`
  - 공통 메시지 영역 스타일을 추가했다.
  - 신산님 기준의 화면 폰트 체계 안에서 제목은 12px, 본문은 9px 설명 크기를 사용한다.
- `apps/studio/app.js`
  - `currentGlobalMessage`, `setGlobalMessage`, `clearGlobalMessage`, `renderGlobalMessage`, `showApiErrorMessage`를 추가했다.
  - 서버가 401/403/409 등 명확한 오류를 반환하면 `message_key`를 현재 사용자 언어로 해석해 Workspace 상단에 표시한다.
  - `runAccessServerAction`은 서버가 명확히 거부한 경우 더 이상 로컬 fallback을 실행하지 않는다.
  - `runOperationsAction`, `runCollaborationAction`도 서버 권한 거부 시 공통 메시지를 표시한다.
  - Team Dashboard 협업 액션은 서버 권한 거부와 네트워크 실패를 구분한다.
    - 서버 권한 거부: 메시지 표시, 로컬 fallback 없음
    - 네트워크 실패: 기존 시안 동작 유지를 위해 로컬 fallback 허용
  - Bot Workspace의 봇 생성, Group API Registry의 API 답변 등록도 서버 권한 거부 시 로컬 fallback하지 않고 메시지를 표시한다.
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - 공통 작업 오류 메시지 `message.actionFailedTitle`, `message.actionForbiddenTitle`, `message.actionFailedBody`를 7개 locale에 추가했다.
  - 주요 권한 오류 message key를 7개 locale에 추가했다.
    - `errors.bot.createForbidden`
    - `errors.bot.configureForbidden`
    - `errors.bot.operateForbidden`
    - `errors.bot.viewForbidden`
    - `errors.operations.actionForbidden`
    - `errors.collaboration.actionForbidden`
    - `errors.apiAnswer.manageForbidden`
- `packages/i18n/error-catalog.json`
  - 위 권한 오류 코드를 안정 에러 카탈로그에 추가했다.
- `scripts/check-studio-config.js`
  - 공통 메시지 영역, `showApiErrorMessage`, 권한 오류 메시지 키, 협업 fallback 구분 로직을 검증한다.

#### 검증 결과
- `node --check apps/studio/app.js` 통과
- `node scripts/check-studio-config.js` 통과
- `node scripts/check-auth-api.mjs` 통과
- `node scripts/check-i18n-no-fallback.js` 통과
- `npm run studio:validate` 통과
- 기존 경고 `MODULE_TYPELESS_PACKAGE_JSON`는 계속 표시되지만 실패가 아니다.

#### 다음 작업
- 다음 단계는 운영/개발 모드 분리를 더 명확히 하기 위해 `CGA_AUTH_HEADER_FALLBACK=disabled`를 docker-compose 운영 profile 또는 환경 예시에 연결하는 것이다.
- 그 다음은 권한 오류뿐 아니라 API 필드 누락/중복/업로드 실패 같은 일반 작업 오류도 같은 메시지 체계로 확장하면 된다.

### 2026-06-09 인증 개발/운영 모드 분리
- 권한 오류 표시 이후, 운영 모드에서 헤더 기반 사용자 전환이 열려 있지 않도록 실행 설정을 분리했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `docker-compose.yml`
  - `CGA_AUTH_HEADER_FALLBACK` 환경값을 노출했다.
  - 기본값은 개발 편의를 위해 `enabled`다.
- `docker-compose.prod.yml`
  - 운영형 override 파일을 추가했다.
  - `CGA_AUTH_HEADER_FALLBACK: "disabled"`를 강제한다.
- `.env.example`
  - `PORT=4173`
  - `CGA_AUTH_HEADER_FALLBACK=enabled`
  - 개발 기본값을 명시했다.
- `scripts/serve-studio.js`
  - `CGA_AUTH_HEADER_FALLBACK=disabled`이고 세션이 없는 요청은 `401 CGA_AUTH_REQUIRED`를 반환한다.
  - 로그인/가입/로그아웃 endpoint는 세션 없이 접근 가능하게 유지했다.
- `packages/i18n/error-catalog.json`
  - `CGA_AUTH_REQUIRED`를 인증 오류 카탈로그에 추가했다.
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - `errors.auth.required`를 7개 locale(en, ko, zh-CN, ja, vi, de, fr)에 추가했다.
- `scripts/check-auth-api.mjs`
  - 개발 기본 모드 검증 후 서버를 재시작해 `CGA_AUTH_HEADER_FALLBACK=disabled` 상태를 검증한다.
  - strict mode에서 헤더만 있는 `/api/cga/auth/me`는 401이어야 한다.
  - strict mode에서도 로그인 후 세션 토큰으로 `/api/cga/auth/me`는 성공해야 한다.
- `scripts/check-studio-config.js`
  - `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example`에 인증 fallback 설정이 있는지 검증한다.
- `README.md`
  - 개발 실행과 운영형 실행 명령을 분리해 문서화했다.
  - 운영형 실행 명령은 `docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build cga-studio`다.

#### 검증 결과
- `node --check scripts/serve-studio.js` 통과
- `node --check scripts/check-auth-api.mjs` 통과
- `node scripts/check-auth-api.mjs` 통과
- `node scripts/check-studio-config.js` 통과
- `npm run studio:validate` 통과
- WSL의 `docker-compose -f docker-compose.yml -f docker-compose.prod.yml config`는 커밋/push 전에는 새 파일이 WSL deploy 폴더에 없어서 실패했다. 커밋 후 WSL pull 뒤 재검증해야 한다.

#### 다음 작업
- 커밋/push 후 WSL deploy 폴더에 pull 받고 운영 compose config를 다시 확인한다.
- 이후 일반 작업 오류(API 필드 누락, 중복, 업로드 실패)를 같은 메시지 체계로 확장한다.

### 2026-06-09 일반 작업 오류 다국어 표시 보강
- 인증/권한 오류 표시 이후, API 필드 누락/중복/지원하지 않는 자산/잘못된 액션/서버 요청 실패 같은 일반 작업 오류도 같은 i18n 오류 체계로 묶었다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `packages/i18n/error-catalog.json`
  - 서버가 이미 반환하던 `message_key` 중 카탈로그에 없던 일반 오류를 추가했다.
  - 추가한 오류:
    - `CGA_BOT_ALREADY_EXISTS` → `errors.bot.exists`
    - `CGA_METHOD_NOT_ALLOWED` → `errors.http.methodNotAllowed`
    - `CGA_OPERATIONS_ACTION_NOT_FOUND` → `errors.operations.actionNotFound`
    - `CGA_COLLABORATION_ACTION_NOT_FOUND` → `errors.collaboration.actionNotFound`
    - `CGA_API_ANSWER_REQUIRED_FIELD_MISSING` → `errors.apiAnswer.requiredField`
    - `CGA_ASSET_SCOPE_NOT_FOUND` → `errors.asset.scopeNotFound`
    - `CGA_API_REQUEST_FAILED` → `errors.api.requestFailed`
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - 위 오류 메시지를 7개 locale(en, ko, zh-CN, ja, vi, de, fr)에 추가했다.
  - Studio 번들 i18n 리소스를 locale JSON 기준으로 다시 동기화했다.
- `apps/studio/app.js`
  - 자산 다운로드/업로드 API가 실패할 때 조용히 무시하지 않고 서버의 `message_key`를 공통 메시지 영역에 표시하도록 했다.
  - 자산 다운로드/업로드 요청에도 CGA 세션 헤더를 함께 보내도록 보강했다.
- `scripts/check-api-answer-api.mjs`
  - API 답변 필수 필드 누락 시 `400 CGA_API_ANSWER_REQUIRED_FIELD_MISSING`와 `errors.apiAnswer.requiredField`가 반환되는지 검증한다.
- `scripts/check-asset-transfer-api.mjs`
  - 지원하지 않는 자산 scope 요청 시 `404 CGA_ASSET_SCOPE_NOT_FOUND`와 `errors.asset.scopeNotFound`가 반환되는지 검증한다.
- `scripts/check-studio-config.js`
  - 일반 작업 오류 키가 error catalog에 누락되면 실패하도록 검증을 추가했다.

#### 다음 작업
- 검증 통과 후 커밋/push하고 WSL 컨테이너에 pull 반영한다.
- 이후 사용자/그룹 관리 화면을 실제 운영 UI에 가깝게 정리한다.

### 2026-06-09 사용자/그룹 관리 운영 UI 1차 정리
- 일반 작업 오류 다국어 표시 이후, System Administration의 User / Group Admin 화면을 실제 운영자가 읽기 쉬운 구조로 보강했다.
- 새 서버 API나 Aidot 변경 없이, 기존 Access 상태와 Auth/Group API 응답을 화면에 더 명확히 표시하는 작업만 진행했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/app.js`
  - 현재 세션 카드에 사용자 상태, 그룹/역할/권한 scope 요약 배지를 추가했다.
  - 그룹 사용자 목록을 그룹 단위 카드로 정리하고, 그룹별 사용자 수와 사용자별 역할/언어를 칩 형태로 표시한다.
  - 가입 요청/관리자 권한 요청 목록에 상태 배지를 표시한다.
  - 그룹별 Bot/API 권한 scope를 읽기 쉬운 작은 배지 목록으로 표시한다.
- `apps/studio/styles.css`
  - 세션 헤더, access badge, status badge, scope list, group user member chip 스타일을 추가했다.
  - 신산님이 정한 폰트 기준을 유지하기 위해 새 보조 정보는 `--font-desc` 중심으로 표시한다.
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - 새로 노출되는 Access/Admin 운영 문구를 7개 locale(en, ko, zh-CN, ja, vi, de, fr)에 추가했다.
  - `access.roleSummary`, `access.groupCount`, `access.scopeCount`, `access.userCount`, `admin.reviewer`, `status.*` 키를 추가했다.
- `scripts/check-studio-config.js`
  - Access 운영 배지/상태 배지/멤버십 표시 helper가 누락되면 실패하도록 검증을 추가했다.

#### 다음 작업
- 검증 통과 후 커밋/push하고 WSL 컨테이너에 반영한다.
- 이후 User / Group Admin 화면에서 실제 가입/로그인/그룹 생성/가입 요청/승인 흐름을 브라우저에서 확인한다.

### 2026-06-09 Auth Flow 동적 문구 다국어 보강
- User / Group Admin 화면의 `Signup / Login Flow` 영역이 Public Core 상태 모델의 영어 label/detail을 그대로 표시하는 문제를 확인했다.
- 상태 모델은 내부 흐름 식별자 유지 목적으로 그대로 두고, Studio 화면에서 `step.id` 기준으로 사용자 언어 메시지를 해석하도록 변경했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/app.js`
  - `getAuthFlowLabel()`, `getAuthFlowDetail()`을 추가했다.
  - `summarizeAuthWorkflow()`가 반환하는 영어 label/detail을 직접 표시하지 않고 `authFlow.*` i18n key로 표시한다.
  - 대기 중인 그룹 가입 요청 수는 `{count}` 치환 방식으로 사용자 언어 문장에 반영한다.
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - `authFlow.signup/login/join-request/approval/work` label/detail 문구를 7개 locale(en, ko, zh-CN, ja, vi, de, fr)에 추가했다.
  - Studio 번들 i18n 리소스를 locale JSON 기준으로 다시 동기화했다.
- `scripts/check-studio-config.js`
  - Auth Flow label/detail helper와 필수 locale key가 없으면 실패하도록 검증을 추가했다.

#### 다음 작업
- 검증 통과 후 커밋/push하고 WSL 컨테이너에 반영한다.
- 이후 Access/Admin 화면의 실제 버튼 흐름을 브라우저 또는 별도 UI 검증 스크립트로 확인한다.

### 2026-06-09 Bot 자산 전송 상태 메시지 다국어 보강
- Bot Version / Package와 Reusable Bot Assets 영역에서 다운로드/업로드 후 표시되는 상태 메시지가 영어 문자열로 남아 있음을 확인했다.
- 기능/API 구조는 변경하지 않고, 상태 메시지 생성만 사용자 언어 기반으로 변경했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/app.js`
  - `formatMessage()`, `getTransferAssetLabel()`, `getTransferSyncLabel()`, `formatTransferDownloaded()`, `formatTransferUploaded()`, `appendTransferSyncStatus()` helper를 추가했다.
  - 사전, 의도 학습문장, 개체, 규칙, 의도 대화, 시나리오, API 매핑, 봇 패키지, 버전 패키지 다운로드/업로드 상태 메시지를 i18n key 기반으로 변경했다.
  - 서버 자산 API에서 받은 파일명, 로컬 다운로드 파일명, 업로드 row/item 수, 서버 저장/로컬 전용 상태를 `{file}`, `{count}`, `{sync}` 치환으로 표시한다.
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - `transfer.asset.*`, `transfer.status.*` 키를 7개 locale(en, ko, zh-CN, ja, vi, de, fr)에 추가했다.
  - Studio 번들 i18n 리소스를 locale JSON 기준으로 다시 동기화했다.
- `scripts/check-studio-config.js`
  - 전송 상태 helper와 필수 locale key가 없으면 실패하도록 검증을 추가했다.

#### 다음 작업
- 검증 통과 후 커밋/push하고 WSL 컨테이너에 반영한다.
- 이후 남아 있는 동적 영어 문구 후보를 계속 축소한다.

### 2026-06-09 API Registry 권한 상태 다국어 보강
- Group API Registry의 소유자 메타 영역에 `scope: apiAnswer.manage`, `blocked: apiAnswer.manage` 같은 영어 권한 상태 문자열이 직접 표시되는 것을 확인했다.
- 서버 API나 권한 구조는 변경하지 않고, 화면 표시 문구만 사용자 언어 기반으로 변경했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/app.js`
  - API Registry 메타의 권한 상태를 `apiAnswer.manageAllowed`, `apiAnswer.manageBlocked` i18n key로 표시하도록 변경했다.
  - bot이 없을 때 표시하는 값도 기존 `none` 문자열 대신 `common.none`을 사용하도록 했다.
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - API Registry 권한 상태 문구를 7개 locale(en, ko, zh-CN, ja, vi, de, fr)에 추가했다.
- `scripts/check-studio-config.js`
  - API Registry 권한 상태 key가 누락되면 실패하도록 검증을 추가했다.

#### 다음 작업
- 검증 통과 후 커밋/push하고 WSL 컨테이너에 반영한다.
- 이후 작업 화면에 남은 fallback 영어 문자열을 계속 줄인다.

### 2026-06-09 Bot Workspace 생성 권한 상태 다국어 보강
- Bot Workspace의 현재 그룹 카드에서 생성 가능 상태가 `bot.create` scope 코드로 직접 표시되는 것을 확인했다.
- 권한 구조와 scope 값은 그대로 유지하고, 화면 표시 문구만 사용자 언어 기반으로 변경했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/app.js`
  - 현재 그룹 카드의 생성 권한 상태를 `workspace.createAllowed`, `workspace.createBlocked` i18n key로 표시하도록 변경했다.
  - `dynamicMessages`에도 7개 locale(en, ko, zh-CN, ja, vi, de, fr) 문구를 추가해 화면 언어 전환 시 즉시 반영되도록 했다.
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - Bot Workspace 생성 권한 상태 문구를 7개 locale에 추가했다.
  - Studio 번들 i18n 리소스를 locale JSON 기준으로 다시 동기화했다.
- `scripts/check-studio-config.js`, `scripts/check-studio-dynamic-i18n.js`
  - Bot Workspace 생성 권한 상태 key가 누락되면 실패하도록 검증을 추가했다.

#### 다음 작업
- 검증 통과 후 커밋/push하고 WSL 컨테이너에 반영한다.
- 이후 남아 있는 화면 동적 문구 중 사용자에게 직접 보이는 권한/scope/상태 표시를 계속 축소한다.

### 2026-06-09 Access/Admin fallback 문구 다국어 보강
- User / Group Admin과 상단 context bar에서 사용자명 또는 그룹명이 비어 있을 때 `User`, `Group`, `Authentication` 같은 기본 영어 문구가 직접 표시될 수 있음을 확인했다.
- 인증/권한 구조와 서버 API는 변경하지 않고, fallback 표시 문구만 사용자 언어 기반으로 변경했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/app.js`
  - 상단 사용자 배지, 현재 세션 카드, Group Bot/API Access, Current User Screen Access의 `User`/`Group` fallback을 `common.user`, `common.group`으로 변경했다.
  - 인증 메시지 기본 제목 `Authentication`을 `admin.authentication`으로 변경했다.
  - `dynamicMessages`에 7개 locale(en, ko, zh-CN, ja, vi, de, fr) fallback 문구를 추가했다.
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - `common.user`, `common.group`, `admin.authentication` 키를 7개 locale에 추가했다.
  - Studio 번들 i18n 리소스를 locale JSON 기준으로 다시 동기화했다.
- `scripts/check-studio-config.js`, `scripts/check-studio-dynamic-i18n.js`
  - Access/Admin fallback key가 누락되면 실패하도록 검증을 추가했다.

#### 다음 작업
- 검증 통과 후 커밋/push하고 WSL 컨테이너에 반영한다.
- 이후 남은 동적 fallback 후보 중 실제 화면 노출 가능성이 높은 항목부터 계속 정리한다.

### 2026-06-09 화면 전환 조회/저장 지연 방지 구조 1차 반영
- 신산님 지시로 Aidot에서 화면 전환 시 조회/저장 지연을 줄이기 위해 변경했던 구조를 CGA에 반복하지 않도록 확인했다.
- Aidot의 `apps/web/components/studio-workspace-provider.tsx`는 캐시된 작업공간 context를 먼저 화면에 적용하고, 서버 조회는 뒤에서 갱신한다.
- Aidot의 `apps/web/components/version-management-page.tsx`도 `getCachedStudioWorkspaceContext()`를 먼저 적용한 뒤 서버 context를 다시 조회한다.
- CGA는 현재 SPA 초안 구조라 같은 캐시 계층을 바로 복사하지 않고, 우선 API 구조 변경 없이 순차 조회 병목과 반복 조회를 줄이는 1차 구조를 반영했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/app.js`
  - `refreshWorkspaceDataFromServer()`를 추가해 Studio State, Configure Composition, Detail Assets, Operations State, Collaboration State를 `Promise.allSettled()`로 병렬 조회한다.
  - 초기 진입과 그룹 변경, 봇 열기에서 기존 순차 조회를 병렬 묶음 조회로 변경했다.
  - `workspaceDataRefreshSerial`을 추가해 빠른 화면 전환 중 오래된 조회 결과가 뒤늦게 화면을 덮어쓰는 위험을 줄였다.
  - 각 화면 데이터 refresh 함수가 요청 당시의 `groupId/botId`와 현재 선택이 같은 경우에만 응답을 적용하도록 보강했다.
  - `renderApiRegistry()`가 반복 렌더링될 때마다 API Registry 조회를 다시 걸지 않도록 `apiRegistryRefreshPromise`, `API_REGISTRY_CACHE_TTL_MS`, `apiRegistryLoadedAtByKey`를 추가했다.
  - API 답변 저장 후에는 해당 그룹/봇 Registry 캐시를 무효화해 다음 조회에서 최신 값을 받도록 했다.
- `scripts/check-studio-config.js`
  - 작업공간 조회가 순차 API 대기 구조로 되돌아가지 않도록 `refreshWorkspaceDataFromServer`, `Promise.allSettled`, `workspaceDataRefreshSerial` 존재를 검증한다.
  - API Registry 반복 조회 억제 구조가 빠지면 실패하도록 검증을 추가했다.

#### 다음 작업
- 검증 통과 후 커밋/push하고 WSL 컨테이너에 반영한다.
- 다음 단계에서는 Aidot의 `getCachedStudioWorkspaceContext()` 패턴처럼 CGA에도 작업공간 snapshot/cache 계층을 둘지 설계로 확정한다.
- 저장은 현재 `scheduleStudioStateSave()`, `scheduleCompositionSave()`의 debounce가 있으나, Detail Assets/패키지 업로드 저장은 액션 단위 저장이므로 추후 화면별 저장 정책을 분리 검토한다.

### 2026-06-09 작업공간 snapshot/cache 계층 1차 반영
- Aidot의 `getCachedStudioWorkspaceContext()` 패턴을 CGA SPA 초안 구조에 맞춰 1차로 반영했다.
- 목표는 화면 전환 시 서버 응답을 기다리느라 빈 화면 또는 오래 걸리는 화면이 보이지 않도록, 마지막 정상 작업공간 상태를 먼저 적용하고 서버 응답으로 갱신하는 것이다.
- API 경로, 서버 저장 포맷, Aidot 호환 계약은 변경하지 않았다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/app.js`
  - `WORKSPACE_SNAPSHOT_STORAGE_PREFIX`, `WORKSPACE_SNAPSHOT_VERSION`, `WORKSPACE_SNAPSHOT_TTL_MS`를 추가했다.
  - 현재 사용자/그룹/봇 기준의 snapshot key를 사용해 작업공간별 cache가 섞이지 않도록 했다.
  - snapshot에는 현재 그룹의 봇 목록, Studio State, Composition, Detail Assets, Operations State, Collaboration State를 저장한다.
  - 서버 refresh 성공 후와 주요 저장 함수(`saveStudioStateToServer`, `saveCompositionToServer`, `saveDetailAssetsToServer`) 이후 snapshot을 갱신한다.
  - 초기 진입, 그룹 변경, 봇 열기에서 가능한 경우 cached snapshot을 먼저 적용하고 이후 서버 데이터로 갱신한다.
  - snapshot TTL은 60초로 제한해 너무 오래된 상태가 계속 보이는 위험을 줄였다.
- `scripts/check-studio-config.js`
  - `WORKSPACE_SNAPSHOT_TTL_MS`, `applyCachedWorkspaceSnapshot`, `saveWorkspaceSnapshot`이 누락되면 실패하도록 검증을 추가했다.

#### 다음 작업
- 검증 통과 후 커밋/push하고 WSL 컨테이너에 반영한다.
- 다음 단계에서는 서버에 여러 화면 상태를 한 번에 내려주는 workspace context API가 필요한지 검토한다. 이 경우 새 API가 되므로 신산님 승인 후 진행해야 한다.
- 현재는 기존 API를 유지한 상태에서 클라이언트 체감 속도 개선만 적용했다.

### 2026-06-10 저장 요청 직렬화 구조 1차 반영
- 화면 전환/입력 중 저장 요청이 겹치면 같은 자산에 대한 PUT 요청이 동시에 나가고, 늦게 끝난 이전 저장이 최신 상태를 덮을 위험이 있다.
- 새 API나 서버 구조 변경 없이, CGA Studio 클라이언트에서 같은 저장 대상별로 요청을 직렬화하도록 1차 보강했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/app.js`
  - `saveQueues`와 `runQueuedSave()`를 추가했다.
  - 같은 queue key의 저장이 이미 실행 중이면 새 요청은 pending으로 표시하고, 현재 저장이 끝난 뒤 최신 메모리 상태 기준으로 한 번 더 저장한다.
  - `saveCompositionToServer()`는 `persistCompositionToServer()`를 감싸는 queued wrapper로 변경했다.
  - `saveDetailAssetsToServer()`는 `persistDetailAssetsToServer()`를 감싸는 queued wrapper로 변경했다.
  - `saveStudioStateToServer()`는 `persistStudioStateToServer()`를 감싸는 queued wrapper로 변경했다.
  - 저장 요청 시점의 `groupId`, `botId`, payload를 캡처해서, 저장 실행 중 화면 전환이 발생해도 다른 봇/그룹으로 잘못 저장되지 않도록 보강했다.
  - 같은 queue key에 새 저장 요청이 들어오면 큐가 최신 저장 action을 기억하고, 실행 중인 저장이 끝난 뒤 최신 payload를 한 번 더 저장한다.
  - 기존 API URL, payload, 저장 함수 호출부는 유지했다.
- `scripts/check-studio-config.js`
  - `runQueuedSave`, `persistStudioStateToServer`, `persistCompositionToServer`, `persistDetailAssetsToServer`가 누락되면 실패하도록 검증을 추가했다.

#### 다음 작업
- 검증 통과 후 커밋/push하고 WSL 컨테이너에 반영한다.
- 이후 저장 실패/대기 상태를 화면에 어떻게 표시할지 검토한다. UI 표시 방식 변경은 화면 영향이 있으므로 신산님 확인 후 진행한다.

### 2026-06-10 운영/협업 액션 stale 응답 차단
- 화면 전환 중 Build/Test/Operate 또는 Team Dashboard 액션 응답이 늦게 도착하면, 이미 다른 그룹/봇 화면으로 이동한 뒤에도 이전 응답이 현재 화면 상태를 덮어쓸 위험을 확인했다.
- 새 기능 추가가 아니라 기존 CGA Studio 화면 액션의 안전성 보강이다.
- 기존 API 경로, 서버 저장 포맷, Aidot 호환 계약은 변경하지 않았다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/app.js`
  - `runOperationsAction()`이 호출 시점의 `groupId`, `botId`를 먼저 캡처하도록 변경했다.
  - Operations 액션 응답을 적용하기 전에 현재 선택된 그룹/봇이 요청 시점과 같은지 확인한다.
  - `runCollaborationAction()`도 같은 방식으로 호출 시점의 `groupId`, `botId`를 캡처하고, 응답 적용 전 현재 화면과 비교한다.
  - 응답이 현재 화면과 일치할 때만 `applyOperationsStateFromServer()`, `applyCollaborationStateFromServer()`를 실행하고 workspace snapshot을 갱신한다.
  - 화면 전환 후 도착한 stale 응답은 화면에 적용하지 않는다.
- `scripts/check-studio-config.js`
  - Operations 액션이 `getOperationsStateUrl(groupId, botId, action)` 형태로 요청 시점 group/bot을 사용하지 않으면 실패하도록 검증을 추가했다.
  - Collaboration 액션이 `getCollaborationStateUrl(groupId, botId, workItemId, action)` 형태로 요청 시점 group/bot을 사용하지 않으면 실패하도록 검증을 추가했다.

#### 다음 작업
- 검증 통과 후 커밋/push하고 WSL 컨테이너에 반영한다.
- 다음 단계에서는 서버 API 호출 실패/저장 대기 상태를 화면에 표시하는 방식이 필요한지 검토한다. UI 표시 방식 변경은 화면 영향이 있으므로 신산님 확인 후 진행한다.

### 2026-06-10 JSON 상태 파일 원자적 저장 보강
- PC 강제 재부팅 또는 컨테이너 재시작이 JSON 상태 파일 저장 중 발생하면 파일 일부만 기록되어 상태 파일이 깨질 위험이 있다.
- CGA Studio 서버의 API 경로, 응답 포맷, 화면 동작은 변경하지 않고 저장 방식만 안전하게 보강했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `scripts/serve-studio.js`
  - `writeJsonFile()`이 대상 JSON 파일에 직접 쓰지 않고, 먼저 `파일명.<pid>.tmp` 임시 파일에 전체 JSON을 기록한다.
  - 임시 파일 기록이 끝난 뒤 `fs.renameSync()`로 대상 파일을 교체한다.
  - 저장 중 프로세스가 중단되어도 기존 정상 파일이 남을 가능성을 높이고, 불완전한 쓰기가 대상 파일에 직접 남는 위험을 줄였다.
- `scripts/check-studio-config.js`
  - JSON 저장이 임시 파일 기록 후 rename 교체 방식인지 검증하도록 guard를 추가했다.

#### 다음 작업
- 검증 통과 후 커밋/push하고 WSL 컨테이너에 반영한다.
- 이후 컨테이너 운영 기준에서 data volume 백업/복구 정책을 문서화할지 검토한다.

### 2026-06-10 Aidot식 의도관리/시뮬레이터 재배치 1차 반영
- 신산님 지시로 봇과 의도가 생성된 이후의 의도 관리/수정 기능은 새로 설계하지 않고 Aidot의 기존 기능 흐름을 그대로 가져오는 기준으로 확정했다.
- CGA는 기능을 새로 만드는 것이 아니라, Aidot의 의도/학습문장/대화카드/개체/사전/시나리오/API/시뮬레이터 기능을 봇 제작 순서에 맞게 재배치한다.
- 이번 변경은 Detail Settings 화면을 Aidot식 목록 중심 의도 관리 화면으로 바꾸는 1차 화면 재배치다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/index.html`
  - 기존 카드형 Detail Settings 영역을 Aidot식 의도 관리 구조로 재배치했다.
  - 의도 검색/필터/추가 영역, 의도 요약, 의도 목록 테이블, 선택 의도 편집 영역, 고급 상태 패널을 추가했다.
- `apps/studio/app.js`
  - `renderAidotIntentManager()`를 추가했다.
  - 기존 Detail Assets의 `intent_utterances`, `scenarios`, `dictionary`, `entities`, `rules`, API registry 데이터를 사용해 의도 목록과 요약을 렌더링한다.
  - 선택한 의도의 표시명과 대표 학습문장을 화면에서 수정할 수 있고, 변경 시 기존 Detail Assets 저장 API로 저장한다.
  - Test 화면은 기존 `operations-state/run-test` 기반 simulator 결과 표시를 유지한다.
- `apps/studio/styles.css`
  - Aidot식 의도 목록 테이블과 요약 카드 스타일을 추가했다.
  - 기존 폰트 기준 24/14/12/10/9px는 유지했다.
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - 새 Detail 화면 문구를 7개 locale(en, ko, zh-CN, ja, vi, de, fr)에 추가하고 Studio 번들 i18n과 동기화했다.
- `scripts/check-studio-config.js`
  - Detail Settings가 Aidot식 의도관리 테이블과 선택 의도 학습문장 편집을 제공하지 않으면 실패하도록 검증을 추가했다.

#### 다음 작업
- 로그인/그룹/역할 설정을 상단과 Access 화면에 더 직접 노출한다.
- Detail 화면의 의도 추가/삭제, 대화카드 편집, 기타옵션(T/R/F) 표시를 Aidot 화면 기준으로 계속 보강한다.
- 시뮬레이터는 현재 Test 화면에 연결되어 있으므로, 다음 단계에서 Aidot의 simulator 결과 항목을 더 촘촘히 맞춘다.

### 2026-06-10 상단 로그인과 그룹별 역할 관리 1차 반영
- 신산님 지시로 로그인/그룹/사용자별 역할 설정을 더 빨리 화면에 노출하도록 우선순위를 올렸다.
- 기존 가입/로그인/그룹 가입/승인 API는 유지하고, 그룹 관리자가 사용자 역할을 직접 변경하는 CGA 관리 API를 추가했다.
- Aidot 런타임 API, webchat 계약, Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/index.html`, `apps/studio/styles.css`
  - 상단 context bar에 빠른 로그인 사용자 선택, 비밀번호 입력, Login/Logout 버튼을 노출했다.
  - Access 화면에 Group Role Management 테이블을 추가했다.
- `packages/public-core/src/access-state.js`
  - `canManageGroupMembership()`, `updateGroupMembershipRole()`를 추가했다.
  - 시스템 admin 또는 해당 그룹의 group_admin/owner만 역할을 변경할 수 있다.
  - 마지막 그룹 관리자 강등을 막아 그룹에 관리자가 사라지는 위험을 줄였다.
- `scripts/serve-studio.js`
  - `PATCH /api/cga/groups/:groupId/members/:userId/role` 관리 API를 추가했다.
  - 권한이 없으면 `CGA_MEMBERSHIP_ROLE_UPDATE_FORBIDDEN`을 반환한다.
- `apps/studio/app.js`
  - 상단 빠른 로그인/로그아웃이 기존 auth API를 호출하도록 연결했다.
  - 그룹별 사용자 역할 테이블을 렌더링하고, 저장 시 새 membership role API를 호출한다.
  - 역할 변경 후 화면 접근 권한과 좌측 메뉴 허용/차단 상태가 즉시 다시 계산된다.
- `packages/i18n/error-catalog.json`, `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - 역할 변경 권한 오류와 역할 관리 화면 문구를 7개 locale에 추가했다.
- `scripts/check-auth-api.mjs`, `scripts/check-studio-config.js`
  - 일반 builder는 역할 변경이 차단되고 group_admin은 변경 가능한지 검증을 추가했다.
  - 상단 빠른 로그인과 역할 관리 화면/API route가 빠지면 실패하도록 guard를 추가했다.

#### 다음 작업
- Detail 화면의 의도 추가/삭제, 대화카드 편집, 기타옵션(T/R/F) 표시를 Aidot 화면 기준으로 계속 보강한다.
- Test 화면의 simulator 결과 항목을 Aidot 화면 기준으로 더 촘촘히 맞춘다.

### 2026-06-10 Aidot식 의도관리 목록 컨트롤 보강
- 신산님 지시대로 의도 생성 이후 관리/수정 화면은 Aidot 화면의 목록 중심 작업 방식에 더 가깝게 맞춘다.
- 이번 변경은 기능을 새로 설계하는 것이 아니라 CGA Detail Settings 안에서 Aidot식 의도 목록 조작을 노출하는 보강이다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/index.html`
  - Detail Settings의 Add Intent 버튼을 실제 화면 액션으로 연결할 수 있도록 `data-aidot-intent-add`를 명시했다.
- `apps/studio/app.js`
  - 의도 검색어 상태와 의도 필터 상태를 분리해서 관리한다.
  - 검색은 의도 ID, 표시명, 대표 학습문장을 기준으로 동작한다.
  - 필터는 현재 전체/의도 기준으로 동작하며, 이후 Aidot 모듈/의도 구분이 늘어도 같은 구조로 확장할 수 있게 했다.
  - Add Intent 실행 시 매번 최신 의도 목록을 다시 읽어 중복 ID가 생기지 않도록 했다.
  - 새 의도 추가 후 Detail Assets 저장 API를 호출하고, 상태 요약과 운영 패널을 다시 계산한다.
  - Aidot 화면의 기타옵션 표시 형태를 따라 목록에 T/R/F 마커를 노출했다.
- `apps/studio/styles.css`
  - T/R/F 옵션 마커와 빈 검색 결과 표시 스타일을 추가했다.
  - 작은 화면에서 의도 목록, 툴바, 그룹 역할 관리 행이 깨지지 않도록 반응형 grid 기준을 보강했다.
- `scripts/check-studio-config.js`
  - Add Intent 액션, 의도 검색/필터 상태, T/R/F 옵션 마커가 빠지면 검증 실패하도록 guard를 추가했다.

#### 다음 작업
- Detail 화면에서 선택 의도의 대화카드/답변 편집 저장 구조를 Aidot 기준으로 더 맞춘다.
- Test 화면의 simulator 결과 항목을 Aidot 화면 기준으로 보강한다.

### 2026-06-10 Aidot식 시뮬레이터 결과 화면 보강
- 신산님 지시대로 의도 관리 이후 Test 화면도 Aidot의 simulator 결과 확인 흐름에 더 가깝게 보이도록 보강했다.
- 기존 operations state API와 `run-test` 동작은 유지하고, 화면에 표시하는 결과 항목을 확장했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/index.html`
  - Test 화면에 Aidot 호환 시뮬레이터 결과 패널과 런타임 변수 패널을 추가했다.
- `apps/studio/app.js`
  - `renderSimulatorDetailPanels()`를 추가했다.
  - 기존 simulator 결과의 matched intent, method, similarity, latency에 더해 대화카드 수, 대표 학습문장, 답변 출처, 개체, 런타임 변수, API 답변 연결, 처리 로그를 렌더링한다.
  - Detail Assets의 의도/학습문장/개체/API registry 데이터를 그대로 사용해 Test 화면을 구성한다.
- `apps/studio/styles.css`
  - 시뮬레이터 결과/런타임 패널을 1920x1080 기준의 작은 폰트 체계 안에서 표시하도록 grid 스타일을 추가했다.
- `scripts/check-studio-config.js`, `scripts/check-studio-dynamic-i18n.js`
  - Test 화면의 Aidot식 simulator 상세 패널과 새 동적 다국어 키가 빠지면 검증 실패하도록 guard를 추가했다.

#### 다음 작업
- Detail 화면에서 선택 의도의 답변/대화카드 편집 저장 구조를 더 직접적으로 연결한다.
- 필요한 경우 Test 화면에 Aidot의 대화 단계별 로그와 변수 치환 결과를 추가로 붙인다.

### 2026-06-10 Detail 의도 답변/대화카드 저장 연결
- Detail Settings에서 보이는 답변 textarea가 단순 표시로 끝나지 않고, 선택 의도의 scenario asset에 저장되도록 연결했다.
- CGA는 Aidot의 의도/답변/대화카드 묶음을 유지해야 하므로, 의도 row 단위에 `answer`, `dialogCards`를 포함해 저장한다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/app.js`
  - 기본 scenario sample에 `answer`, `dialogCards`를 추가했다.
  - `getAidotIntentRows()`가 scenario의 답변과 대화카드 목록을 함께 반환한다.
  - 선택 의도 편집 영역에 Dialog cards textarea를 추가했다.
  - 의도 ID, 표시명, 답변, 대화카드, 대표 학습문장 변경 시 기존 Detail Assets 저장 API로 함께 저장한다.
  - Test 화면의 답변 출처도 선택 의도의 answer/dialogCards를 우선 표시한다.
- `scripts/serve-studio.js`
  - 서버 기본 Detail Assets scenario sample에도 `answer`, `dialogCards`를 포함했다.
- `scripts/check-detail-assets-api.mjs`
  - Detail Assets API가 scenario answer와 dialogCards를 보존하는지 검증한다.
- `scripts/check-studio-config.js`
  - 선택 의도의 대화카드 편집 필드가 빠지면 검증 실패하도록 guard를 추가했다.

#### 다음 작업
- Detail 화면에서 Synonym/Entity/Dictionary/Scenario/API Tools 탭이 실제 화면 전환처럼 보이도록 단계적으로 재배치한다.
- Test 화면에 대화 단계별 로그와 변수 치환 결과를 더 붙일지 검토한다.

### 2026-06-10 Detail Assets 탭 전환 1차 연결
- Detail Settings의 탭들이 장식으로만 보이지 않도록 실제 화면 전환 패널을 연결했다.
- 이번 변경은 Aidot 기능을 새로 만드는 것이 아니라, 이미 CGA가 보유한 Detail Assets 데이터를 Aidot식 탭 구분으로 재배치한 것이다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/index.html`
  - Intent & Answer, Synonyms, Entities, Dictionary, Scenario, API Tools 탭에 `data-detail-tab`을 부여했다.
  - Intent & Answer 영역과 기타 Detail Assets 탭 패널을 분리했다.
- `apps/studio/app.js`
  - `currentDetailTab` 상태와 `renderDetailTabs()`를 추가했다.
  - Intent & Answer 탭은 기존 Aidot식 의도 목록/편집 화면을 유지한다.
  - Synonyms, Entities, Dictionary, Scenario, API Tools 탭은 현재 Detail Assets와 Group API Registry 데이터를 목록 형태로 표시한다.
  - 화면 갱신 시 현재 탭 상태가 유지되도록 `renderAllStatePanels()`와 boot 흐름에 연결했다.
- `apps/studio/styles.css`
  - Detail Assets 탭 목록 패널과 행 스타일을 추가했다.
- `scripts/check-studio-config.js`
  - Detail 탭 패널과 렌더러가 빠지면 검증 실패하도록 guard를 추가했다.

#### 다음 작업
- Synonyms/Entities/Dictionary/Scenario/API Tools 각 탭에서 편집 가능한 항목을 단계적으로 연결한다.
- Test 화면의 대화 단계 로그와 변수 치환 표시를 추가한다.

### 2026-06-10 첫 접속 로그인 화면과 실제 제품 화면 기준 정리
- 신산님 지시로 `http://localhost:4173/` 첫 접속 화면을 작업공간이 아니라 로그인 화면으로 변경했다.
- 사용자 선택 드롭다운에서 사용자 언어(en/ko/ja/fr 등)를 함께 표시하던 부분을 제거했다. 사용자 언어와 화면 언어 선택은 별도 개념이므로 로그인 계정 선택에는 계정명과 ID만 표시한다.
- 우측 승인 체크리스트, 작업 규칙, 레퍼런스 내비게이션 등 실제 제품 사용 화면이 아닌 임시 요소는 화면에서 제거했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/index.html`
  - 첫 접속용 `login-entry` 화면을 추가했다.
  - 상단과 로그인 화면의 사용자 선택은 계정/ID 기준으로만 보이도록 정리했다.
  - Reference 내비게이션과 임시 안내 영역을 제거했다.
- `apps/studio/app.js`
  - `hasAuthSession()`, `applyAuthGate()`를 추가했다.
  - 세션 토큰이 없으면 작업공간/좌측 메뉴/상단 작업 버튼을 숨기고 로그인 화면만 보여준다.
  - 로그인 성공 후에만 작업공간 화면이 표시된다.
  - 로그인 버튼 클릭 시 사용자나 비밀번호가 없으면 조용히 무시하지 않고 오류 메시지를 표시한다.
- `apps/studio/styles.css`
  - 첫 접속 로그인 레이아웃과 비로그인 상태 화면 스타일을 추가했다.
- `apps/studio/data/layout.js`
  - 실제 운영 화면이 아닌 설명/참조 성격의 섹션은 숨김 처리했다.
- `scripts/check-studio-config.js`
  - 첫 접속 로그인 화면과 auth gate가 빠지면 검증 실패하도록 guard를 추가했다.

#### 다음 작업
- 첫 화면 로그인 후 그룹 선택 → 봇 작업공간 진입 흐름을 실제 제품 화면 기준으로 더 정리한다.
- 좌측 메뉴와 상단 바의 불필요한 설명 문구를 계속 제거한다.

### 2026-06-10 Aidot 100% 호환 기준 재확정 및 첫 화면 재정리
- 신산님 지시로 CGA의 기준을 다시 확정했다.
- CGA는 Aidot와 100% 호환되어야 하며 내부 기능, API 구조, 파일 구조, Table 구조, 봇 패키지 구조를 변경하지 않는다.
- CGA 작업 범위는 Aidot 화면/기능을 봇 작업 순서대로 재배치하는 화면 구조 변경이다.
- Aidot는 ML/Semantic/LLM 구성이 가능하지만, CGA 화면의 봇 구성 흐름은 LLM 방식만 노출한다.
- Aidot 코드는 수정하지 않았다.

#### 바로잡은 내용
- CGA 전용 저장소/Table 구조 정의 및 검증으로 보일 수 있는 신규 파일을 제거했다.
- `package.json`의 `studio:storage-schema-check` 검증 연결을 제거했다.
- `http://127.0.0.1:4173/` 첫 접속 화면이 작업공간이 아니라 로그인 화면으로 나오도록 정리했다.
- 첫 로그인 화면은 Aidot 로그인 화면 구조를 기준으로 중앙 카드, 아이디/비밀번호, 로그인, 아이디 저장, 언어 선택, 회원가입 진입으로 구성했다.
- 폰트 기준은 신산님이 지정한 24/14/12/10/9px 규칙을 유지했다.
- 다국어 번들(`apps/studio/i18n.js`)과 locale JSON 동기화를 맞췄다.

#### 확인 결과
- `node --check apps\studio\app.js` 통과.
- `node --check apps\studio\data\layout.js` 통과.
- `npm run studio:validate` 통과.
- Studio 서버 응답 확인: `http://127.0.0.1:4173/` HTTP 200.

#### 다음 작업
- 로그인 후 Aidot admin 기준의 사용자/그룹/권한 화면을 먼저 배치한다.
- 그 다음 봇 생성 → 봇 설정 → 봇 구성 → 봇 수정 → 봇 테스트 → 봇 운영 순서로 Aidot 기존 화면을 재배치한다.
- 새 API, 새 Table, 새 파일 구조가 필요해 보이는 경우 작업하지 않고 먼저 신산님에게 “새 구조 변경”으로 명시해 승인 요청한다.

### 2026-06-10 1920x1080 기준 3영역 화면 구조 반영
- 신산님 지시에 따라 CGA Studio 화면 기준을 Aidot와 동일한 1920x1080 기준으로 확정했다.
- 화면은 상단 상태바, 좌측 메뉴, 중앙 작업영역 3개 영역으로 구성한다.
- 좌측 메뉴는 실제 메뉴로 동작해야 하며, 클릭한 메뉴의 화면 하나만 중앙 작업영역에 표시한다.
- 여러 화면이 아래로 이어서 보이는 기존 방식은 실제 제품 화면 기준에 맞지 않으므로 제거했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/app.js`
  - `activeScreenId`를 추가해 현재 선택된 화면 하나만 표시하도록 변경했다.
  - 좌측 메뉴 클릭 시 기본 anchor scroll이 아니라 중앙 작업영역의 화면 전환으로 처리한다.
  - 선택된 메뉴에만 `active` 상태를 적용한다.
- `apps/studio/styles.css`
  - 전체 화면을 1920x1080 기준의 상단/좌측/중앙 3영역으로 고정했다.
  - 좌측 메뉴와 중앙 작업영역이 각각 내부 스크롤을 가지도록 변경했다.
  - 상단 상태바는 한 줄 안에 상태/언어/저장/미리보기/배포 영역이 들어가도록 압축했다.
- `scripts/check-studio-config.js`
  - 더 이상 필요 없는 상단 빠른 로그인 검증을 제거했다.

#### 확인 결과
- `npm run studio:validate` 통과.
- 현재 화면은 로그인 후 `사용자 / 그룹 관리` 단일 화면이 중앙 작업영역에 표시되는 상태다.

### 2026-06-10 실제 관리 화면 기준 재정리
- 신산님 지시로 본문에 보이던 정책 설명/가이드/예제성 패널을 실제 제품 화면 기준에서 제거했다.
- 설명이나 예제는 Aidot처럼 화면 제목 옆 `?` 도움말 아이콘을 눌렀을 때 모달로 확인하는 방식으로 정리했다.
- 좌측 메뉴는 `서버 메뉴`, `관리`, `조회`, `운영` 기준으로 구분한다.
- 사용자의 그룹 내 역할과 scope에 따라 접근할 수 없는 메뉴는 `허용/차단` 라벨로 표시하지 않고 메뉴에서 숨긴다.
- 사용자가 접근 중인 화면이 권한 변경으로 숨겨지면 첫 번째 허용 메뉴로 자동 이동한다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/index.html`
  - Access 화면에서 정책 설명 패널과 운영 흐름 설명 패널을 화면 본문에서 제거했다.
  - 사용자 조회, 그룹 조회, 역할 관리, 가입/관리자 승인 대기 영역을 실제 관리 화면 블록으로 재배치했다.
  - Access 화면 제목 옆에 도움말 `?` 버튼을 유지했다.
- `apps/studio/app.js`
  - 도움말 모달 열기/닫기 동작을 추가했다.
  - 좌측 메뉴 접근 제어를 `차단 표시`에서 `권한 없는 메뉴 숨김`으로 변경했다.
  - 그룹 조회 영역은 정책 설명 대신 현재 그룹 목록과 사용자 수/상태를 표시하도록 변경했다.
- `apps/studio/styles.css`
  - 서버 하위 메뉴, 관리 화면 조회/등록 블록, 도움말 모달 스타일을 추가했다.
  - 메뉴 카드의 `허용/차단` 표시 영역은 실제 제품 화면 기준에 맞지 않아 숨겼다.

#### 확인 결과
- `node --check apps\studio\app.js` 통과.
- `npm run studio:validate` 통과.
- Studio 서버 응답 확인: `http://127.0.0.1:4173/` HTTP 200.

#### 다음 작업
- 서버 메뉴의 하위 항목을 `사용자 관리`, `로그인 이력`, `그룹 관리`처럼 실제 하위 화면 단위로 더 분리한다.
- 사용자 조회/사용자 등록, 그룹 조회/그룹 등록 화면을 더 명확히 분리한다.
- 로그인 이력 화면은 Aidot admin 화면 기준으로 별도 조회 화면처럼 구성한다.

### 2026-06-10 로그인 입력 초기화 및 전환 실패 수정
- 신산님이 `로그인이 안되고 아이디/비밀번호가 초기화된다`고 지적한 문제를 우선 수정했다.
- 원인은 첫 접속 로그인 화면의 전용 로그인 스크립트가 로그인 성공 후 `window.location.reload()`를 실행하는 흐름이었다.
- 이 상태에서 로그인 후 앱 화면 전환이 즉시 완료되지 않으면 다시 로그인 카드가 보이고, 사용자가 입력한 아이디/비밀번호가 사라진 것처럼 보였다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/entry-auth.js`
  - 로그인 성공 후 페이지를 새로고침하지 않고, 세션 토큰을 저장한 뒤 즉시 인증된 화면으로 전환하도록 변경했다.
  - 성공 시 로그인 카드 숨김, 상단 상태바 표시, 좌측 메뉴 표시, `#access-management` 진입을 수행한다.
  - 로그인 성공 이벤트 `cga:entry-login-success`를 발생시켜 메인 앱이 세션 기반 사용자/그룹 상태를 다시 읽도록 했다.
  - 로그인 실패 시 아이디/비밀번호 입력값을 유지하고, 로그인 카드 안에 오류 메시지를 표시하도록 했다.
- `apps/studio/app.js`
  - `cga:entry-login-success` 이벤트를 받아 access state와 workspace data를 다시 읽고, 현재 화면과 메뉴를 다시 렌더링하도록 연결했다.
- `apps/studio/index.html`
  - 브라우저 캐시가 이전 로그인 스크립트를 잡지 않도록 `entry-auth.js` 버전을 `20260610-2`로 올렸다.

#### 확인 결과
- `node --check apps\studio\entry-auth.js` 통과.
- `node --check apps\studio\app.js` 통과.
- `npm run studio:validate` 통과.
- 실제 API 확인: `POST /api/cga/auth/login`에 `admin/admin` 요청 시 HTTP 200과 `session_token` 발급 확인.
- 로그인 화면 스크립트 동작 재현 테스트:
  - 성공 시 `cga-studio-session-token-v2` 저장 확인.
  - 성공 시 `.app-shell`의 `unauthenticated` 상태 제거 확인.
  - 성공 시 상단바/좌측 메뉴 표시 확인.
  - 성공 시 로그인 카드 숨김 확인.
  - 실패 시 아이디와 비밀번호 입력값 유지 확인.
  - 실패 시 `아이디 또는 비밀번호가 올바르지 않습니다.` 메시지 표시 확인.

#### 다음 작업
- 실제 브라우저 자동 연결은 현재 Codex 브라우저 런타임 연결 실패로 사용하지 못했다.
- 대신 서버 API와 화면 로그인 스크립트의 DOM 동작을 직접 재현해 검증했다.
- 다음 화면 수정부터도 수정 후 자체 검증을 먼저 수행한 뒤 신산님에게 보고한다.

### 2026-06-10 좌측 메뉴 카드형 복구 및 로그아웃 동작 수정
- 신산님 지시로 좌측 메뉴를 `서버 메뉴 / 관리 / 조회 / 운영` 텍스트 목록형에서 이전 카드형 메뉴 구조로 되돌렸다.
- 좌측 메뉴 기준은 `시스템 관리`, `봇 제작`, `봇 제작 워크플로우` 3개 그룹이다.
- 상단 로그아웃 버튼이 동작하지 않는 문제를 함께 수정했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/index.html`
  - 좌측 메뉴를 이전 카드형 그룹 구조로 복구했다.
  - `System Administration`, `Bot Production`, `Bot Build Workflow` 섹션과 카드형 nav를 사용한다.
  - 캐시 방지를 위해 `entry-auth.js` 버전을 `20260610-3`으로 올렸다.
- `apps/studio/data/workflow.js`
  - `User / Group Admin`은 시스템 관리 그룹에 배치했다.
  - `Bot Workspace`, `Team Dashboard`, `Group API Registry`는 봇 제작 그룹에 배치했다.
  - `Bot Creation`부터 `Bot Operation`까지 6단계는 봇 제작 워크플로우 카드로 표시한다.
- `apps/studio/entry-auth.js`
  - 상단 로그아웃 버튼을 전용 스크립트에서도 직접 처리하도록 연결했다.
  - 로그아웃 시 `/api/cga/auth/logout`을 호출하고, 로컬 세션 토큰을 제거한 뒤 로그인 화면으로 복귀한다.

#### 확인 결과
- `node --check apps\studio\entry-auth.js` 통과.
- `node --check apps\studio\app.js` 통과.
- `node --check apps\studio\data\workflow.js` 통과.
- `npm run studio:validate` 통과.
- 실제 API 확인:
  - `POST /api/cga/auth/login`은 HTTP 200과 `session_token` 발급 확인.
  - `POST /api/cga/auth/logout`은 HTTP 200과 `cga_session` 쿠키 삭제 확인.
- 화면 스크립트 동작 재현 테스트:
  - 로그인 성공 후 세션 토큰 저장, 상단/좌측 표시, 로그인 카드 숨김 확인.
  - 로그아웃 클릭 후 세션 토큰 제거, 상단/좌측 숨김, 로그인 카드 표시 확인.

### 2026-06-10 봇 제작 워크플로우와 봇 운영 메뉴 재정리
- 신산님이 확정한 기준에 맞춰 `봇 제작 워크플로우`와 `봇 운영`을 분리했다.
- `봇 제작 워크플로우`는 아래 6단계로 고정한다.
  - `봇 생성`
  - `봇 설정`
  - `봇 구성`
  - `봇 제작`
  - `봇 테스트`
  - `봇 평가`
- `봇 운영`은 제작 단계가 아니라 제작 이후 운영 영역으로 분리한다.
  - `재학습`
  - `분석`
- `봇 관리`는 워크플로우 단계가 아니라 별도 관리 기능으로 분리한다.
  - 업로드
  - 다운로드
  - 운영버전 설정
  - 복사
  - 삭제
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/data/workflow.js`
  - 제작 워크플로우의 6번째 단계를 `operate`에서 `evaluate`로 변경했다.
  - `build` 단계 명칭을 `Bot Edit`에서 `Bot Production` 기준으로 변경했다.
  - `operationLinks`를 추가해 `재학습`, `분석`을 별도 운영 메뉴로 렌더링하도록 했다.
  - `bot-management` 메뉴를 `Bot Production` 그룹에 추가했다.
- `apps/studio/index.html`
  - 좌측 메뉴에 `Bot Operation` 섹션을 추가했다.
  - `봇 관리` 화면을 별도 화면으로 추가하고, 기존 작업공간 안에 섞여 있던 버전/패키지 관리 영역을 이 화면으로 이동했다.
  - `봇 평가` 화면을 제작 워크플로우 6번째 화면으로 추가했다.
  - `재학습`, `분석` 화면을 운영 영역으로 분리했다.
- `apps/studio/data/layout.js`
  - `bot-management`, `evaluate`, `analysis` 화면을 레이아웃 정의에 추가했다.
  - `operate`는 `workflow` 그룹에서 `operation` 그룹으로 이동했다.
  - `api-answer-source`는 제작 워크플로우가 아니라 봇 제작/자산 영역으로 이동했다.
- `packages/contracts/src/workflow-contract.js`
  - 공개 워크플로우 정의의 6번째 단계를 `Evaluate`로 변경했다.
  - Aidot API나 Table 구조가 아니라 CGA 화면 단계 정의만 변경했다.
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - 새 메뉴와 화면 키를 7개 언어에 추가했다.
  - `봇 제작`, `봇 평가`, `봇 운영`, `재학습`, `분석`, `봇 관리` 관련 문구를 번들 i18n에 동기화했다.
- `scripts/check-studio-config.js`
  - 제작 워크플로우 필수 단계 검증 기준을 `create/configure/detail/build/test/evaluate`로 변경했다.

#### 확인 결과
- `node --check apps\studio\data\workflow.js` 통과.
- `node --check apps\studio\i18n.js` 통과.
- `node --check apps\studio\app.js` 통과.
- `node --check scripts\check-studio-config.js` 통과.
- `npm run studio:validate` 통과.
- `http://127.0.0.1:4173/` 서버 HTML 응답에서 아래 구조 확인.
  - `Bot Production`
  - `Bot Build Workflow`
  - `Bot Operation`
  - `System Administration`
  - `bot-management`
  - `evaluate`
  - `analysis`

#### 다음 작업
- 로그인 후 작업 중인 봇이 있을 때 Aidot 메인 화면처럼 현재 봇의 의도 목록/상태가 첫 화면으로 보이도록 정리한다.
- 작업 중인 봇이 없을 때는 `봇 작업공간` 또는 `봇 생성`으로 유도한다.
- `봇 관리` 화면의 버전 테이블을 Aidot의 버전 관리 화면 형태에 더 가깝게 정리한다.

### 2026-06-10 봇 생성 화면에 봇 관리 빠른 액션 추가
- 신산님 의견에 따라 `봇 생성` 화면에서도 버전/패키지 관련 주요 작업으로 바로 진입할 수 있게 했다.
- 단, 기능을 새로 중복 개발하지 않고 기존 `봇 관리`와 기존 업로드 흐름을 재사용한다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/index.html`
  - `봇 생성` 화면의 기본 언어/버전 입력 아래에 빠른 액션 버튼을 추가했다.
    - `버전 추가`
    - `봇 복사`
    - `버전 관리`
    - `버전 업로드`
- `apps/studio/app.js`
  - `버전 추가`는 현재 생성 화면의 버전 입력값을 다음 draft 버전명으로 갱신한다.
  - `봇 복사`와 `버전 관리`는 별도 `봇 관리` 화면으로 이동한다.
  - `버전 업로드`는 `봇 관리` 화면으로 이동한 뒤 기존 `data-upload-version-package` 업로드 핸들러를 호출한다.
  - 따라서 Aidot 호환 패키지 업로드 구조를 새로 만들지 않고 기존 경로를 재사용한다.
- `apps/studio/styles.css`
  - 빠른 액션 버튼을 기존 10px 본문 기준과 카드 밀도에 맞게 정리했다.
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - `create.versionAdd`, `create.versionManage` 키를 7개 언어에 추가하고 Studio 번들과 동기화했다.

#### 확인 결과
- `node --check apps\studio\app.js` 통과.
- `node --check apps\studio\i18n.js` 통과.
- `node --check apps\studio\entry-auth.js` 통과.
- `npm run studio:validate` 통과.

### 2026-06-10 가입 시 개인 그룹 자동 생성 제거 및 그룹/역할 관리 기준 정리
- 신산님 지시에 따라 신규 가입자가 `사용자명 Group` 같은 개인 그룹을 자동으로 받는 구조를 제거했다.
- 신규 가입자는 개인 그룹의 `group_admin`이 되는 것이 아니라, 기본 대상 그룹에 `viewer` 가입 신청으로 생성된다.
- 최종 그룹과 역할은 가입/권한 승인 단계에서 관리자 또는 그룹 관리자가 결정한다.
- 기존 CGA 개발 데이터에 이미 생성된 `g-사용자ID` 형태의 자동 개인 그룹은 로드 시 `deleted` 상태로 정리하고, 해당 사용자는 기본 그룹 `viewer` 가입 신청 상태로 전환한다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `packages/public-core/src/access-state.js`
  - `policy.signupCreatesOwnGroup` 기본값을 `false`로 변경했다.
  - `signupDefaultGroupId: "g-support"`, `signupDefaultRole: "viewer"`를 추가했다.
  - `applySignup()`이 더 이상 그룹과 멤버십을 생성하지 않고, 사용자 생성 + viewer 가입 신청만 생성하도록 변경했다.
  - `normalizeAccessState()`를 추가해 기존 개발 데이터의 자동 개인 그룹을 정리한다.
- `packages/contracts/src/access-contract.js`
  - `createSignupDraft()`가 개인 그룹/멤버십을 만들지 않고, 필요 시 가입 신청 draft만 만들도록 변경했다.
- `packages/contracts/src/auth-api-contract.js`
  - signup 요청 계약을 `group_name` 중심에서 `group_id`, `requested_role` 중심으로 변경했다.
- `scripts/serve-studio.js`
  - `/api/cga/auth/signup`이 `group_id`와 `requested_role`을 받아 viewer 가입 신청을 생성하도록 변경했다.
  - access state 로드 시 `normalizeAccessState()`를 적용해 기존 개인 그룹 생성 흔적을 정리한다.
- `apps/studio/index.html`
  - 관리 화면의 사용자 생성 폼을 제거했다.
  - 그룹 관리 블록은 그룹 생성 전용으로 정리했다.
  - 첫 접속 회원가입 화면의 그룹 선택 값은 실제 그룹 ID(`g-support`)를 사용하도록 수정했다.
- `apps/studio/app.js`
  - 가입 처리 fallback도 viewer 가입 신청 기준으로 변경했다.
  - 사용자 조회/그룹 조회를 카드 나열에서 대량 데이터에 대응 가능한 표 형태로 변경했다.
  - `그룹 역할 관리`는 `system_admin` 또는 `group_admin`에게만 보이도록 제한했다.
- `apps/studio/styles.css`
  - 대량 사용자/그룹 조회용 `management-table` 스타일을 추가했다.
- `packages/i18n/locales/*.json`, `apps/studio/i18n.js`
  - “개인 그룹 생성” 기준 문구를 “viewer 가입 신청 + 관리자 승인” 기준으로 수정했다.
- `scripts/check-auth-api.mjs`, `scripts/check-studio-config.js`
  - 가입 시 개인 그룹이 생성되면 검증 실패하도록 변경했다.
  - 가입 시 viewer 가입 신청이 생성되는지 검증한다.

#### 확인 결과
- `npm run studio:validate` 통과.
- 실제 4173 서버를 재시작했다.
- `http://127.0.0.1:4173/` HTTP 200 확인.
- `GET /api/cga/groups` 확인 결과:
  - `policy.signupCreatesOwnGroup`은 `false`.
  - 기존 `g-cyhuh / 허철영 Group`은 `deleted` 상태.
  - `cyhuh -> g-support / viewer` 가입 신청이 `pending` 상태로 생성됨.

#### 다음 작업
- `사용자 관리`, `로그인 이력`, `그룹 관리`를 실제 하위 화면으로 분리한다.
- 그룹 관리 화면에서 그룹 생성, 그룹 조회, 사용자 배정/역할 변경, 승인 대기열을 명확히 나눈다.
- 일반 역할(`builder/reviewer/operator/viewer`)은 자기 소속 그룹만 조회하고, 역할 변경 화면은 보이지 않도록 실제 화면에서 한 번 더 확인한다.

### 2026-06-10 Aidot식 사용자/그룹 관리 화면과 3단 좌측 메뉴 1차 반영
- 신산님 지시에 따라 관리 화면을 카드 설명형 시안에서 Aidot admin에 가까운 목록/상세/수정 구조로 바꿨다.
- 사용자 수가 늘어나는 상황을 고려해 로그인 세션의 사용자 전체 드롭다운 의존을 제거하고, 사용자 관리는 검색/필터/표 중심으로 정리했다.
- 좌측 메뉴는 2단 카드가 아니라 `대분류 -> 중분류 -> 실제 메뉴` 형태의 3단 구조를 기준으로 재정리했다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/index.html`
  - `사용자, 로그인, 권한` 화면에서 로그인 세션 카드를 화면 밖 hidden 영역으로 이동했다.
  - 사용자 관리는 검색/필터/목록/기본 정보/정보 수정 영역으로 재배치했다.
  - 그룹 관리는 검색/필터/목록/기본 정보/그룹 수정 영역으로 재배치했다.
  - 좌측 메뉴의 각 대분류를 `details/summary` 기반 접기/펼치기 구조로 변경했다.
  - 시스템 관리 아래에 Aidot admin식 하위 메뉴 영역을 추가했다.
- `apps/studio/data/workflow.js`
  - 시스템 관리 3단 메뉴 데이터(`사용자 관리`, `현황 조회`, `대화 관리`, `시스템 연계`, `기타 관리`)를 추가했다.
  - 아직 실제 화면이 분리되지 않은 항목은 `access-management`로 임시 매핑했다.
- `apps/studio/app.js`
  - 시스템 관리 하위 메뉴 렌더링을 추가했다.
  - 메뉴 권한/클릭 처리 대상에 시스템 관리 하위 메뉴를 포함했다.
  - 사용자 조회를 Aidot식 표 형태로 변경하고, 검색어/그룹/역할/계정상태 필터를 추가했다.
  - 가입 대기 사용자도 사용자 목록에 표시되도록 유지했다. 예: `cyhuh`가 `viewer` 가입 대기 상태로 보임.
  - 사용자 행 선택 시 아래 기본 정보/정보 수정 패널이 갱신되도록 했다.
  - 그룹 조회를 Aidot식 표 형태로 변경하고, 검색어/사용여부 필터를 추가했다.
  - 그룹 행 선택 시 아래 기본 정보/그룹 수정 패널이 갱신되도록 했다.
  - 승인 대기열은 단순 `승인` 버튼이 아니라, 승인 전에 그룹과 역할을 선택할 수 있도록 변경했다.
- `packages/public-core/src/access-state.js`
  - `approveGroupJoinRequest()`와 `approveAdminPermissionRequest()`가 승인 시 선택한 `groupId`, `requestedRole`을 반영할 수 있게 했다.
- `scripts/serve-studio.js`
  - 가입 승인/관리자 권한 승인 API가 선택된 `group_id`, `requested_role`을 받아 상태에 반영하도록 변경했다.
- `apps/studio/styles.css`
  - 좌측 메뉴 폭을 줄이고 카드 높이/상하 패딩을 낮췄다.
  - 시스템 관리 하위 메뉴를 Aidot admin 메뉴처럼 조밀한 텍스트 목록 형태로 스타일링했다.
  - 사용자/그룹 관리 표, 검색/필터 툴바, 상세/수정 2분할 영역 스타일을 추가했다.

#### 확인 결과
- `node --check apps\studio\app.js` 통과.
- `node --check scripts\serve-studio.js` 통과.
- `npm run studio:validate` 통과.

#### 남은 작업
- `사용자 관리`, `로그인 이력`, `그룹 관리`를 실제 개별 화면으로 분리한다.
- 시스템 관리 하위 메뉴 중 아직 실제 구현 화면이 없는 항목은 Aidot admin 기능을 기준으로 순차 연결한다.
- 그룹 수정 저장/삭제는 현재 화면만 배치했고, Aidot 호환 관리 API 연결 후 활성화한다.

### 2026-06-10 시스템 관리 3단 메뉴와 AD 사용자/그룹 관리 위치 조정
- 신산님 지시에 따라 `시스템 관리 -> 사용자 관리` 아래에 `AD 사용자/그룹 관리` 카드형 상위 항목을 배치했다.
- `사용자 관리` 하위 메뉴에 `그룹 역할 관리`를 추가했다.
- 오른쪽 화면은 하위 메뉴 선택에 따라 한 종류만 보이도록 바꿨다.
  - `사용자 관리`: Aidot식 사용자 목록, 검색/필터, 기본 정보, 사용자 정보 수정
  - `로그인 이력`: Aidot식 로그인 이력 표 영역
  - `그룹 관리`: Aidot식 그룹 목록, 검색/필터, 기본 정보, 그룹 수정
  - `그룹 역할 관리`: 그룹 역할 변경 테이블
- Aidot 코드는 수정하지 않았다.

#### 확인 결과
- `node --check apps\studio\app.js` 통과.
- `node --check apps\studio\data\workflow.js` 통과.
- `npm run studio:validate` 통과.

### 2026-06-10 Aidot 화면 기준 봇 제작 흐름 재정렬 및 Webchat 호환 API 추가
- 신산님이 다시 확정한 대전제를 기준으로 정리했다.
  - CGA는 Aidot와 봇 단위 100% 호환되어야 한다.
  - Aidot와 CGA는 상호 업로드/다운로드가 가능해야 한다.
  - Webchat은 수정 없이 Aidot와 CGA 양쪽에 접속할 수 있어야 한다.
  - CGA는 새 내부 구조를 만드는 것이 아니라 Aidot 기능/데이터/API 구조를 유지하고 화면 흐름만 봇 제작 순서로 재배치한다.
- Aidot 코드는 수정하지 않았다.

#### 구현 내용
- `apps/studio/index.html`
  - `01 봇 생성`
    - Aidot 봇 설정 중 봇 생성 이후 바꾸면 안 되는 구조 선택 항목을 배치했다.
    - 기본 언어, LLM 사용 여부, 입력 방식, PDF 허용, 오케스트레이터 모드, Bot Server 위치, 기본 채널을 생성 단계에 둔다.
  - `02 봇 설정`
    - Aidot의 봇 설정 화면 형태를 기준으로 다시 배치했다.
    - 봇 생성 이후 변경 가능한 기본 정보, 생성 정보, Vector DB 연결, 자동분류 가중치, 소개 영역을 둔다.
  - `03 봇 구성`
    - Aidot의 RAG 답변 문서 구성 화면 형태를 기준으로 다시 배치했다.
    - 좌측은 텍스트/PDF 입력과 RAG 문서 구성, 우측은 의도 후보 영역으로 둔다.
  - `04 봇 제작`
    - Aidot의 의도 메인 화면을 기준으로 다시 배치했다.
    - 의도/구성/개체/사전/평가/재학습/분석 카운트 탭, 검색, 의도 목록 표, 의도 추가 버튼을 둔다.
    - 의도 클릭 시 Aidot의 `대화 시작` 화면으로 이동하고, `대화 설계` 화면으로 이어지도록 흐름을 만들었다.
- `apps/studio/app.js`
  - `renderBuildAidotScreen()`을 추가해 `04 봇 제작` 화면을 Aidot 의도 화면 흐름으로 렌더링한다.
  - 의도 목록 -> 대화 시작 -> 대화 설계 전환을 지원한다.
  - 기존 CGA 화면 설명성 카드가 아니라 실제 제품 화면 기준으로 우측 본문을 한 화면씩 보여주도록 맞췄다.
- `apps/studio/styles.css`
  - Aidot식 봇 설정, RAG 구성, 의도 목록, 대화 시작, 대화 설계 화면 스타일을 추가했다.
  - 폰트 기준은 기존 합의 기준을 유지한다.
    - 제품명 24
    - 최상위 제목 14
    - 제목/메뉴 12
    - 본문 10
    - 설명 9
- `scripts/serve-studio.js`
  - Aidot Webchat이 호출하는 채널 API 경로를 CGA 서버에 추가했다.
  - 추가된 호환 경로:
    - `POST /api/v1/channels/webchat/connect`
    - `GET /api/v1/channels/webchat/bots`
    - `GET /api/v1/channels/webchat/rooms`
    - `POST /api/v1/channels/webchat/rooms`
    - `GET /api/v1/channels/webchat/rooms/{room_id}`
    - `DELETE /api/v1/channels/webchat/rooms/{room_id}`
    - `POST /api/v1/channels/webchat/rooms/{room_id}/messages`
    - `GET /api/v1/webchat/bootstrap`
    - `POST /api/v1/webchat/bots/{bot_slug}/rooms/{room_id}/messages`
  - 응답은 Aidot Webchat이 기대하는 `data` envelope와 `botMessage`, `botMessages`, `intent`, `runtime` 구조를 따른다.
  - 현재는 CGA의 bot/detail asset 데이터를 읽어 `password_reset` 같은 의도 답변을 반환한다.
  - Webchat 개발 서버 접속을 위해 `http://localhost:3330`, `http://127.0.0.1:3330` origin만 제한적으로 허용한다.
  - 전역 `Access-Control-Allow-Origin: *`는 적용하지 않았다.
- `scripts/check-webchat-channel-api.mjs`
  - Aidot Webchat 호환 검증 스크립트를 추가했다.
  - connect, room 생성, message 전송, legacy webchat message 경로까지 검증한다.
- `package.json`
  - `studio:webchat-channel-check`를 추가했다.
  - `studio:validate`에 Webchat 호환 검증을 포함했다.

#### 확인 결과
- `node --check scripts\serve-studio.js` 통과.
- `npm run studio:validate` 통과.
- `http://127.0.0.1:4173/` HTTP 200 확인.
- Aidot Webchat 호환 API 직접 검증:
  - `POST /api/v1/channels/webchat/connect` 성공.
  - `GET /api/v1/channels/webchat/bots` 성공.
  - `POST /api/v1/channels/webchat/rooms` 성공.
  - `POST /api/v1/channels/webchat/rooms/{room_id}/messages` 성공.
  - `GET /api/v1/webchat/bootstrap` 성공.
- `POST /api/v1/webchat/bots/supportbot-draft/rooms/{room_id}/messages` 성공.
- `OPTIONS /api/v1/channels/webchat/connect`에서 `Origin: http://localhost:3330` preflight 성공.
- 메시지 테스트 결과:
  - 입력: `I need to reset my password`
  - 매칭 의도: `password_reset`
  - 답변: `Open Account Settings and choose Reset Password.`

#### 남은 작업
- 실제 Aidot Webchat 앱을 CGA 서버 URL(`http://127.0.0.1:4173`)로 연결해 브라우저 화면에서 최종 확인한다.
  - 현재 API 레벨 검증은 통과했다.
  - Webchat 앱을 `localhost:3330` 또는 `127.0.0.1:3330`에서 띄우는 경우 필요한 preflight는 통과했다.
- `05 봇 테스트`는 Aidot 시뮬레이터 화면과 더 가깝게 정렬한다.
- `06 봇 평가`는 Aidot 평가 화면 기준으로 정렬한다.
- 봇 관리의 버전 관리/업로드/다운로드/운영버전 설정/복사/삭제를 Aidot 버전 관리 화면 기준으로 계속 정리한다.

### 2026-06-11 - System Administration 좌측 메뉴 정리

#### 작업 목적
- `System Administration` 아래에 남아 있던 `AD User / Group Admin` 카드형 상위 메뉴가 실제 Aidot Admin 하위 메뉴와 중복되어 제거했다.
- 좌측 메뉴는 Aidot Admin의 실제 하위 메뉴(`사용자 관리`, `로그인 이력`, `그룹 관리`, `그룹 역할 관리`, 현황 조회, 대화 관리, 시스템 연계, 기타 관리)만 보이도록 정리했다.

#### 변경 내용
- `apps/studio/data/workflow.js`
  - `managementLinks`를 비워 중복 AD 상위 카드 렌더링을 제거했다.
  - `systemAdminSections`의 `feature` 카드 정의를 제거하고 하위 메뉴 목록만 남겼다.
- `apps/studio/app.js`
  - `renderSystemAdminSubnav()`가 카드형 상위 항목을 만들지 않고 섹션 제목과 하위 메뉴만 렌더링하도록 수정했다.
  - 하위 메뉴 선택 시 오른쪽 화면 제목이 선택한 메뉴명으로 바뀌도록 보강했다.
  - 아직 Aidot Admin 상세 화면을 붙이지 않은 하위 메뉴는 사용자 관리 화면을 잘못 보여주지 않고 해당 메뉴 전용 준비 패널을 보여주도록 분리했다.
- `apps/studio/index.html`
  - System Administration 하위 메뉴별 오른쪽 패널 영역을 분리했다.
- `apps/studio/styles.css`
  - 미연결 하위 메뉴용 준비 패널 스타일을 추가했다.

#### 기준
- Aidot 소스는 수정하지 않았다.
- CGA 화면 구조만 정리했다.
- 이후 각 System Administration 하위 메뉴의 실제 오른쪽 내용은 Aidot Admin 화면 기준으로 순차 매핑한다.

#### 추가 수정
- 같은 `#access-management` 화면 안에서 하위 메뉴만 바뀌는 경우 오른쪽 패널이 다시 렌더링되지 않던 문제를 수정했다.
  - `applyScreenLayout()`에서 활성 화면이 `access-management`이면 `renderAccessPanels()`를 호출하도록 보강했다.
- 브라우저가 이전 `app.js`와 메뉴 데이터 모듈을 캐시해 수정이 반영되지 않는 문제를 막기 위해 Studio 모듈 URL 버전을 갱신했다.
  - `index.html`: `/apps/studio/app.js?v=20260611-1`
  - `app.js`: `workflow.js`, `layout.js` import에 `v=20260611-1` 적용
- `npm run studio:validate` 통과.

### 2026-06-11 - System Administration 하위 화면 실제 Admin 형태로 교체

#### 작업 목적
- `Aidot Admin의 ... 화면이 이 위치에 연결됩니다.`처럼 임시 안내 문구가 제품 화면에 남아 있던 문제를 제거했다.
- System Administration 하위 메뉴를 Aidot Admin 화면 패턴에 맞춰 목록/상세/수정 구조로 바로 표시하도록 변경했다.

#### 변경 내용
- `apps/studio/index.html`
  - 임시 placeholder 영역을 `data-admin-surface` 기반 실제 화면 컨테이너로 교체했다.
- `apps/studio/app.js`
  - `adminSurfaceSamples`와 `renderAdminSurface()`를 추가했다.
  - 운영 대시보드, 운영/시스템 로그, 봇 현황, 학습 이력, 대화 이력, API 호출 이력, Queue 이력, 의도별 피드백, 공통 변수, 기본 메시지, 채널 관리, 봇스테이션 연계, 템플릿 목록, 라이선스 조회 화면을 테이블/기본정보/수정 패널 구조로 렌더링한다.
  - 임시 문구 렌더링을 제거했다.
- `apps/studio/styles.css`
  - Aidot Admin형 테이블, 툴바, 상세/수정 패널 스타일을 추가했다.
  - 임시 placeholder 스타일을 제거했다.
- 캐시 무효화
  - `styles.css?v=20260611-2`
  - `app.js?v=20260611-2`
  - 내부 `workflow.js`, `layout.js` import도 `v=20260611-2`로 갱신했다.

#### 확인 결과
- `rg -n "연결됩니다|admin-placeholder|data-admin-placeholder|이 위치에" apps/studio` 결과 없음.
- `npm run studio:validate` 통과.
- `http://127.0.0.1:4173/`에서 새 CSS/JS 버전 응답 확인.
- Aidot 저장소는 수정하지 않았다.

### 2026-06-11 - 사용자/그룹 관리 화면 운영형 목록/팝업 구조 적용

#### 작업 목적
- 사용자와 그룹이 많아질 때 관리 화면이 한 화면에 모든 행을 계속 늘려 보여주는 문제를 해결한다.
- CGA 전체 화면 기준을 `상단 버튼/조회 조건`, `중앙 목록`, `상세/수정 팝업`, `기본 화면 스크롤 지양`으로 잡는다.

#### 변경 내용
- `apps/studio/index.html`
  - 사용자 관리 상단 툴바에 `상세/수정` 버튼을 추가했다.
  - 사용자 상세/수정 영역을 목록 아래 고정 패널에서 팝업 모달로 이동했다.
  - 그룹 관리 상단 툴바에도 `상세/수정` 버튼을 추가했다.
  - 그룹 상세/수정 영역도 목록 아래 고정 패널에서 팝업 모달로 이동했다.
- `apps/studio/app.js`
  - 사용자 목록에 페이지 크기(`20/50/100개씩 보기`)와 이전/다음 페이징을 추가했다.
  - 사용자 검색/필터 변경 시 1페이지로 돌아가도록 했다.
  - 사용자 행 클릭 또는 상단 `상세/수정` 버튼 클릭 시 사용자 상세 팝업이 열리도록 했다.
  - 팝업 바깥 클릭 또는 닫기 버튼으로 팝업을 닫도록 했다.
  - 그룹 목록도 페이지 크기(`20/50/100개씩 보기`)와 이전/다음 페이징을 사용하도록 맞췄다.
  - 그룹 검색/필터 변경 시 1페이지로 돌아가도록 했다.
  - 그룹 행 클릭 또는 상단 `상세/수정` 버튼 클릭 시 그룹 상세 팝업이 열리도록 했다.
- `apps/studio/styles.css`
  - 사용자/그룹 목록 고정 높이, sticky 헤더, 페이징 바, 상세 팝업 스타일을 추가했다.
- 캐시 무효화
  - `styles.css?v=20260611-3`
  - `app.js?v=20260611-3`
  - 내부 `workflow.js`, `layout.js` import도 `v=20260611-3`으로 갱신했다.

#### 기준
- Aidot 소스는 수정하지 않았다.
- 이 패턴은 사용자/그룹 관리에 먼저 적용했고, 이후 봇 관리/운영 화면에도 같은 원칙으로 확장한다.

## 2026-06-11 어울 작업 기록 - Aidot Admin 원본 기준 재정렬

### 사용자 지시 핵심
- Aidot는 수정 금지. CGA에서만 작업한다.
- CGA Studio의 System Administration은 CGA식 재해석이 아니라 Aidot Admin 화면을 원본 기준으로 옮긴다.
- 글자, 폰트, 화면 흐름도 Aidot 기준을 우선한다.
- 사용자/그룹/로그인 이력은 Aidot Admin의 목록 중심 UX를 따른다.
- 상세/수정은 목록 아래에 늘어놓지 않고 상세 화면 또는 팝업으로 처리한다.
- 1920x1080 기준, 스크롤을 최소화하고 버튼은 상단에 둔다.

### 이번 정리 내용
- `그룹 역할 관리` CGA 전용 메뉴 제거.
- `CGA식`, `이 위치에 연결됩니다` 같은 placeholder/설명성 문구 잔여 확인 및 제거.
- 사용자 관리 목록을 Aidot Admin 사용자 관리 컬럼 기준으로 정렬했다.
  - 체크박스, 사용자 계정, 사용자 이름, 그룹, 역할, 신청일시, 가입상태, 계정상태
- 사용자 목록 필터를 Aidot 기준으로 맞췄다.
  - 전체 그룹, 전체 역할, 전체 계정상태, 전체 가입상태, 조회
- 로그인 이력 화면을 Aidot Admin 로그인 이력 컬럼 기준으로 정렬했다.
  - 사용자 계정, 사용자 이름, 그룹, 역할, 접속한 IP, 로그인 시간, 로그아웃 시간
- 신청일시에 `jr-*` 같은 내부 request id가 보이지 않도록 `-` 처리했다.
- 사용자 계정상태는 내부값 대신 Aidot식 라벨로 표시한다.
  - 활성, 비활성, 잠김, 비밀번호 초기화
- 미구현 `반려` 버튼은 화면에서 제거했다. 서버/API 계약 없이 버튼만 보이면 안 되기 때문이다.
- 사용자 승인은 기존 approve 흐름만 유지한다.
- Aidot 원본 참조 위치를 확인했다.
  - `D:\Project\Aidot\apps\web\components\admin-console-layout.tsx`
  - `D:\Project\Aidot\apps\web\components\admin-interactive-table-page.tsx`
  - `D:\Project\Aidot\apps\web\app\admin\users\page.tsx`
  - `D:\Project\Aidot\apps\web\app\admin\groups\page.tsx`
  - `D:\Project\Aidot\apps\web\app\admin\login-history\page.tsx`

### 검증
- `node --check apps\studio\app.js` 통과.
- `npm run studio:validate` 최종 통과.
- `http://127.0.0.1:4173/` 응답 200 확인.
- Studio 번들 버전 `20260611-4` 제공 확인.
- `admin/admin` 로그인 API 응답 확인.
- Aidot 작업 트리에는 수정 목록 없음. 단, 홈 git ignore 접근 경고는 발생했으나 Aidot 파일 변경은 출력되지 않았다.

### 남은 작업
- `adminSurfaceSamples` 기반 임시 Admin 화면을 제거하고 Aidot Admin 원본 페이지 구조로 계속 대체해야 한다.
- 우선순위:
  1. 사용자 관리 상세/수정 팝업을 Aidot 상세 화면 기준으로 완성
  2. 그룹 관리 목록/상세/수정 Aidot 기준 완성
  3. 로그인 이력 Aidot 기준 완성
  4. 현황 조회/대화 관리/시스템 연계/기타 관리 하위 메뉴를 Aidot 원본 화면 기준으로 이식
- 반려 기능은 Aidot API에는 존재하지만 현재 CGA `serve-studio.js`에는 reject endpoint가 없다. 새 API를 만들지 말라는 지시가 있으므로, 승인/반려를 완성하려면 Aidot의 `/api/v1/admin/signup-requests/{id}/reject`와 호환되는 형태로 CGA API를 맞추는지 먼저 결정해야 한다.

## 2026-06-11 어울 작업 기록 - Aidot Admin 메뉴 복사 기준 재확정

### 사용자 지시 핵심
- "복사"는 CGA식 재해석이 아니라 Aidot Admin 메뉴명, 순서, 화면 흐름을 그대로 가져오는 의미다.
- Aidot에는 없는 `역할 관리`만 CGA 운영에 필요한 추가 메뉴로 둔다.
- System Administration 하위 메뉴는 Aidot Admin 원본 메뉴를 기준으로 유지한다.
- 큰 하단 버튼형 `조회`, `상세/수정`은 제거하고 Aidot처럼 조회 조건 우측의 `조회` 버튼만 둔다.
- 사용자 상세/수정은 목록 아래 고정 패널이 아니라 팝업으로 연다.
- `그룹 가입신청`, `관리자 권한 요청` 같은 설명/요청 블록은 사용자 관리 본문에 노출하지 않는다.

### 이번 반영 내용
- `apps/studio/data/workflow.js`
  - Aidot Admin 메뉴 순서를 다시 확인했다.
  - 사용자 관리: 사용자 관리, 로그인 이력, 그룹 관리 순서를 유지했다.
  - CGA 전용으로만 `역할 관리`를 사용자 관리 하위에 추가했다.
  - 현황 조회, 대화 관리, 시스템 연계, 기타 관리는 Aidot Admin 원본 메뉴명과 순서를 유지했다.
- `apps/studio/index.html`
  - 누락된 `Bot Creation` 화면 섹션을 복구했다.
  - `access-management` 본문을 하위 메뉴별 패널 구조로 정리했다.
  - 사용자 관리, 그룹 관리, 역할 관리, 로그인 이력, Aidot Admin 나머지 하위 메뉴가 각각 선택된 메뉴에서만 보이도록 정리했다.
  - `상세/수정` 큰 버튼과 잘못된 요청 블록 노출을 제거했다.
  - 사용자/그룹 상세는 팝업 모달로 유지했다.
- `apps/studio/app.js`
  - 기존 사용자/그룹/역할 데이터 렌더링을 유지하고, 선택한 System Administration 하위 메뉴 하나만 보이도록 연결했다.
- Aidot 저장소는 수정하지 않았다.

### 검증
- `node --check apps\\studio\\app.js` 통과.
- `node --check apps\\studio\\data\\workflow.js` 통과.
- `npm run studio:validate` 통과.
- `http://127.0.0.1:4173/` 서버 응답 `200 OK` 확인.

### 다음 작업 기준
- System Administration의 나머지 하위 화면은 placeholder 문구가 아니라 Aidot Admin 원본 화면 구조를 기준으로 계속 교체한다.
- 봇 제작 워크플로우는 `봇 생성 -> 봇 설정 -> 봇 구성 -> 봇 제작 -> 봇 테스트 -> 봇 평가` 순서로 유지한다.
- 봇 제작은 Aidot 의도 목록/대화 시작/대화 설계 화면을 기준으로 붙인다.
- 봇 구성은 Aidot RAG 문서 구성 화면을 기준으로 붙인다.
- Aidot와 CGA는 봇 패키지/API/Webchat 호환을 깨지 않도록 CGA 쪽에서 맞춘다.


## 2026-06-11 Admin 원본 복사/실데이터 전환

- Aidot 원본 Admin의 템플릿 목록, 공통 변수, 기본 메시지, 채널, 라이선스 조회 화면 구조를 CGA System Administration 하위 메뉴에 맞춰 복사하는 방향으로 정리했습니다.
- CGA 서버에 `admin-resources.json` 기반 실제 Admin 기초 데이터 저장소를 추가했습니다. 이 데이터는 화면 가짜 데이터가 아니라 서버 API가 읽고 쓰는 저장 데이터입니다.
- `/api/cga/admin/resources` API를 추가해 템플릿, 공통 변수, 기본 메시지, 채널, 라이선스, 로그인 이력을 한 번에 조회하도록 했습니다.
- `/api/cga/admin/templates` API에 목록 조회, 등록, 수정, 삭제를 추가했습니다.
- Studio Admin 렌더러는 빈 플레이스홀더 대신 서버 API의 실제 데이터를 사용하도록 변경했습니다.
- 템플릿 목록은 Aidot 원본의 검색 조건, 상단 버튼, 컬럼, 하단 페이지네이션 구조를 기준으로 렌더링합니다.
- 로그인 이력은 서버 로그인/로그아웃 API에서 기록한 실제 이력을 사용합니다.
- 검증 스크립트 `scripts/check-admin-resources-api.cjs`를 추가했습니다. 임시 서버에서 Admin 리소스 조회와 템플릿 등록/수정/삭제를 실행하며, 5초 초과 요청은 실패로 처리합니다.
- 검증 결과: 리소스 조회 15ms, 템플릿 목록 2ms, 템플릿 등록 66ms로 모두 5초 기준 안쪽입니다.
- Aidot 저장소는 수정하지 않았고, CGA 폴더에서만 작업했습니다.

## 2026-06-11 Admin 실제 데이터/복사 화면 정리

- System Administration 하위 화면에서 임시 설명/placeholder 문구를 제거하고 Aidot Admin 원본 화면 흐름 기준으로 정리했다.
- Admin 기초데이터는 서버 저장 데이터(.cga-data/admin-resources.json)를 사용한다. 가짜 데이터는 사용하지 않는다.
- 실제 실행 서버 http://127.0.0.1:4173 기준 데이터: 템플릿 10건, 공통변수 8건, 기본 메시지 8건, 채널 4건, 라이선스 3건, 로그인 이력 2건.
- 실제 실행 서버 응답 시간: templates 49ms, common-variables 3ms, default-messages 2ms, channels 2ms, resources 1ms, 템플릿 생성/수정/삭제 원복 1741ms.
- 검증: node --check apps/studio/app.js 통과, node --check scripts/serve-studio.js 통과, npm run studio:admin-resources-check 통과, npm run studio:auth-api-check 통과, npm run studio:validate 통과.
- 실행 서버 HTML 확인: app.js?v=20260611-8, styles.css?v=20260611-8 반영. 화면용 map/draft 임시 문구 제거 확인.
- Aidot 저장소는 수정하지 않았다.
- 다음 작업: Aidot Admin 각 화면의 상세/등록/수정 UX를 계속 원본 기준으로 맞추고, 모든 조회 화면은 실제 API 응답만 표시한다.

## 2026-06-11 13:45 - 1920x1080 화면 높이/스크롤 보정

### 작업 배경
- 신산님 지시: CGA Studio 기본 해상도는 1920x1080이며, 현재 화면은 상하 여백과 카드 높이가 커서 브라우저 세로 스크롤이 생김.
- 기준: Aidot를 수정하지 않고 CGA에서만 조정. 본문 조회 화면은 전체 페이지 스크롤을 지양하고, 필요한 경우 목록 영역 내부에서만 스크롤한다.

### 진행 내용
- `apps/studio/styles.css`에 1920x1080 기준 compact override를 추가했다.
  - 상단바 높이와 패딩 축소.
  - 좌측 메뉴 카드/서브메뉴 상하 간격 축소.
  - 본문 workspace/screen-card를 고정 높이 영역으로 정리.
  - Admin 조회 화면은 검색/툴바/목록/페이지네이션 구성을 유지하되 목록 영역만 내부 스크롤되도록 조정.
- `apps/studio/i18n.js`의 언어 초기화 흐름을 보정했다.
  - 화면 선택값 우선 규칙은 유지.
  - 초기 부팅 시 저장된 사용자 언어가 먼저 select에 반영되도록 `getStoredLocale()`을 분리.
  - 한국어로 로그인/저장된 경우 첫 화면이 영어로 돌아가는 문제를 보완.
- `apps/studio/index.html`의 CSS/앱 캐시 버전을 `20260611-10`으로 갱신했다.

### 검증 결과
- `npm run studio:validate` 통과.
- 인증/그룹 API 검증: 로그인 이력 포함 그룹 조회 1.3ms.
- Admin 리소스 검증:
  - resources 12ms
  - template create 24ms
  - common-variable create 75ms
  - default-message create 26ms
  - channel create 68ms
  - seed counts: templates 10, common_variables 8, default_messages 8, channels 4
- Webchat 호환 검증 통과: `OK Aidot-compatible webchat channel endpoints passed`.
- 실제 Chrome 1920x1080 검증:
  - `detail`: body/workspace vertical scroll 없음, lang=ko
  - `login-history`: body/workspace vertical scroll 없음, lang=ko
  - `templates`: body/workspace vertical scroll 없음, lang=ko
  - `license-status`: body/workspace vertical scroll 없음, lang=ko

### 주의 / 다음 작업
- 이번 작업은 CGA Studio 화면 밀도와 언어 유지 보정만 수행했다.
- Aidot 파일은 수정하지 않았다.
- 다음 작업자는 조회 화면을 추가/수정할 때 1920x1080에서 전체 페이지 스크롤이 생기지 않는지 실제 브라우저로 확인해야 한다.
- 실제 조회 API는 5초 기준을 반드시 넘기지 않아야 하며, 5초 이상이면 목록 페이징/필터/캐시를 먼저 검토한다.

## 2026-06-11 Admin 표 레이아웃/실데이터 표시 수정

### 작업 배경
- System Administration 하위의 `템플릿 목록`, `라이선스 조회` 등 Aidot Admin 복사 대상 화면에서 표가 화면 하단으로 밀리고 데이터 행이 보이지 않는 문제가 확인됨.
- 사용자는 가짜 데이터가 아니라 Aidot에 등록된 기초 데이터를 CGA에서도 실제 조회해야 하며, 수정 후 개발자가 먼저 테스트해야 한다고 지시함.

### 원인
- `renderAidotInteractiveTable()`은 제목, 검색행, 툴바, 표, 페이지네이션의 5개 영역을 렌더링한다.
- 하지만 compact Admin CSS의 `.admin-page`가 `grid-template-rows: auto auto minmax(0, 1fr) auto` 4행으로 정의되어 툴바와 표 영역 배치가 깨졌다.
- 그 결과 검색/툴바 이후 큰 빈 공간이 생기고 표가 화면 아래쪽으로 밀렸다.
- 추가로 사용자 목록 렌더링에서 `formatAidotSignupStatus`, `formatAidotAccountStatus` 함수가 누락되어 브라우저 page error가 발생할 수 있었다.

### 수정 내용
- `apps/studio/styles.css`
  - `.admin-page` compact grid를 5행 구조로 수정했다.
  - 변경: `auto auto auto minmax(0, 1fr) auto`
  - 목적: 검색행, 툴바, 표, 페이지네이션이 1920x1080 화면 안에서 순서대로 배치되도록 고정.
- `apps/studio/app.js`
  - `formatAidotSignupStatus()` 추가.
  - `formatAidotAccountStatus()` 추가.
  - 신청일시에 가입 요청 ID(`jr-*`)가 표시되지 않도록 실제 요청 일시 필드만 날짜 포맷에 사용.
- `apps/studio/index.html`
  - 브라우저 캐시 회피를 위해 `styles.css`와 `app.js` 버전을 `20260611-11`로 갱신.

### 실제 데이터 확인
- `/api/cga/admin/resources` 기준 실제 Admin 기초 데이터가 반환됨을 확인했다.
- 확인된 데이터 수:
  - 템플릿 목록: 10건
  - 공통 변수 관리하기: 8건
  - 기본 메시지 관리: 8건
  - 채널 관리: 4건
  - 라이선스 조회: 3건
  - 로그인 이력: 7건
  - 봇스테이션 연계 현황: 현재 0건

### 성능 확인
- `npm run studio:validate`의 Admin 리소스 API 측정 결과:
  - resources: 12ms
  - list: 2ms
  - `/api/cga/admin/templates`: 29ms
  - `/api/cga/admin/common-variables`: 77ms
  - `/api/cga/admin/default-messages`: 16ms
  - `/api/cga/admin/channels`: 64ms
- 5초 초과 조회 없음.

### 브라우저 검증
- Playwright + Chrome, viewport 1920x1080에서 직접 확인.
- 절차:
  1. `http://127.0.0.1:4173/` 접속
  2. `admin / admin` 로그인
  3. System Administration → `템플릿 목록` 클릭
- 결과:
  - 활성 hash: `#access-management`
  - 템플릿 실제 행: 10건
  - 첫 행: `1 Simulator 기본 메시지 1 text text 사용 2026. 05. 05. 02:55:35`
  - 전체 건수: `전체 10건`
  - 화면 전체 스크롤: 없음
  - workspace 스크롤: 없음
  - 화면 안에 보이는 행: 10건
  - 브라우저 page error: 없음

### 검증 명령
- `node --check apps/studio/app.js`
- `npm run studio:validate`
- Playwright 1920x1080 실제 로그인/메뉴/데이터 표시 확인

### Aidot 수정 여부
- Aidot 원본은 수정하지 않음.
- CGA 쪽 Studio 화면/캐시 버전만 수정함.

## 2026-06-11 Admin 기초데이터 Aidot 기준 보정

- 작업 범위: CGA만 수정. Aidot 저장소/소스는 수정하지 않음.
- 수정 목적: System Administration 하위의 기초데이터 화면이 CGA 임시/가짜 데이터가 아니라 Aidot 기준 데이터와 동일한 값으로 조회되도록 보정.
- 적용 내용:
  - 템플릿 목록 기본 seed를 Aidot 기준 20건으로 확장.
    - Simulator 10건: 기본 메시지, Html, Card, Table, Button, Link Button, Form(Rich), Carousel, DTMF, Form(A Card)
    - Webchat 10건: 기본메시지, Html, Card, Table, Button, Link Button, Form(Rich), Carousel, DTMF, Form(A Card)
  - 기본 메시지 관리 기본 seed를 Aidot 기준 14건으로 교체.
    - 오류 4건, 입력 3건, 의도 4건, 세션 3건
  - 라이선스 조회 기본 seed를 Aidot 기준 값으로 교체.
    - 사용자 120 / 사용중 4 / 잔여 116 / 만료일 2026-12-31
    - 봇 30 / 사용중 13 / 잔여 17 / 만료일 2026-12-31
    - API 50 / 사용중 5 / 잔여 45 / 만료일 2026-12-31
  - 기존 런타임 데이터 파일 `.cga-data/admin-resources.json`에도 동일 기준 적용.
  - 서버 응답에서 라이선스를 임의 계산값이 아니라 저장된 Admin 리소스 기준으로 우선 반환하도록 수정.
- 검증:
  - 4173 서버 재시작 후 `/api/cga/admin/resources` 조회 확인.
  - 조회 시간 34ms.
  - 응답 카운트: templates 20, default_messages 14, licenses 3.
  - `npm run studio:validate` 통과.
  - `studio:admin-resources-check` 기준 조회 시간: resources 13ms, templates 41ms, default-messages 67ms.
- 남은 확인:
  - Codex 번들 Playwright 의존성 문제로 화면 자동 캡처 검증은 실행하지 못함. API와 서버 검증은 완료.

### 추가 보정
- 기존 `.cga-data/admin-resources.json`가 남아 있는 환경에서 예전 CGA 임시 기본 메시지(`dm-no-desired`, `dm-runtime-flow`)가 다시 병합되지 않도록 normalize 로직을 보강함.
- 기본 메시지 신규 등록/수정 검증이 깨지지 않도록 임시 seed ID만 제거하고, 사용자 추가 항목은 유지하도록 조정함.
- 재검증: `npm run studio:validate` 통과, `/api/cga/admin/resources` 조회 27ms, templates 20 / default_messages 14 / licenses 3 확인.

## 2026-06-11 사용자/그룹 상세 팝업 복구 및 역할 관리 정리

- 작업 범위: CGA만 수정. Aidot 저장소/소스는 수정하지 않음.
- 수정 목적:
  - 사용자/그룹 목록에서 행을 선택하면 상세/수정 화면이 페이지 하단이나 별도 화면처럼 붙지 않고 팝업으로 열리도록 복구.
  - 별도 `역할 관리` 화면은 제거하고, 사용자 역할/그룹 변경은 사용자 상세 팝업과 가입 승인 흐름에서 처리하도록 정리.
  - 목록 조회 화면에서 데이터가 없을 때 임시 문구 행을 만들지 않고 빈 목록으로 유지.
- 적용 내용:
  - `apps/studio/styles.css`
    - `.detail-modal` 고정 오버레이 스타일 추가.
    - 사용자/그룹 상세 팝업 패널, 헤더, 본문 2단 레이아웃, 입력 영역 스타일 추가.
    - 삭제된 별도 역할 관리 화면 관련 CSS 제거.
  - `apps/studio/index.html`
    - 별도 `역할 관리` 패널 제거.
    - 브라우저 캐시 회피를 위해 `styles.css`와 `app.js` 버전을 `20260611-12`로 갱신.
  - `apps/studio/app.js`
    - 별도 역할 관리 렌더링/저장 바인딩 제거.
    - 사용자 목록에 임시 `No active user` 행을 만들던 처리 제거.
  - `apps/studio/data/workflow.js`
    - System Administration > 사용자 관리 하위 메뉴에서 `역할 관리` 제거.
- 검증:
  - `node --check apps/studio/app.js` 통과.
  - `npm run studio:validate` 통과.
  - `npm run studio:admin-resources-check` 단독 재실행 통과.
  - 관리자 기초 데이터 조회 결과: templates 20, common_variables 8, default_messages 14, channels 4.
  - 조회 시간: resources 14ms, list 1ms, templates 73ms, common-variables 22ms, default-messages 57ms, channels 17ms.
  - 별도 역할 관리 잔여 코드 검색 결과: `data-role-management`, `role-management`, `management-table--roles`, `data-role-save`, `subview: "roles"` 없음.

## 2026-06-12 목록 건수/페이지 크기 배치 Aidot 기준 보정

- 작업 범위: CGA만 수정. Aidot 저장소/소스는 수정하지 않음.
- 수정 목적:
  - 목록 화면의 `전체 n건`과 `n개씩 보기` 선택 상자가 양끝으로 벌어지지 않고 Aidot처럼 왼쪽에 붙어서 표시되도록 보정.
  - 사용자/그룹/로그인 이력 목록의 페이지 크기 기본값과 선택지를 Aidot 목록 UI에 맞게 정리.
- 적용 내용:
  - `apps/studio/styles.css`
    - `.management-list-meta` 정렬을 `space-between`에서 `flex-start`로 변경.
    - 건수/페이지 크기 간격과 select 폭을 Aidot형 목록 컨트롤에 맞게 축소.
  - `apps/studio/app.js`
    - 사용자 목록 기본 페이지 크기: 10건.
    - 그룹 목록 기본 페이지 크기: 10건.
    - 페이지 크기 선택지: 10 / 25 / 50 / 100.
  - `apps/studio/index.html`
    - 브라우저 캐시 회피를 위해 `styles.css`와 `app.js` 버전을 `20260612-1`로 갱신.
- 검증:
  - `node --check apps/studio/app.js` 통과.
  - `npm run studio:validate` 통과.
  - 4173 서버 응답 확인: HTTP 200, 0.003478초.
  - 현재 서버가 `app.js?v=20260612-1`, `styles.css?v=20260612-1`을 서빙하는 것 확인.
  - 현재 서버 CSS에서 `justify-content: flex-start`, `width: 126px` 반영 확인.

## 2026-06-12 그룹 관리 생성 버튼 및 다운로드 제거 확인

- 작업 범위: CGA만 수정. Aidot 저장소/소스는 수정하지 않음.
- 수정 목적:
  - 그룹 관리 화면에서 `+ 그룹 생성` 기능을 명확히 노출.
  - 그룹 관리 화면에서는 다운로드 버튼을 사용하지 않도록 정리.
  - 그룹 생성 시 필수값이 비어 있으면 조용히 실패하지 않고 오류를 표시.
- 적용 내용:
  - `apps/studio/index.html`
    - 그룹 관리 검색 영역 오른쪽에 `+ 그룹 생성` 버튼 유지.
    - 그룹 관리 영역에는 다운로드 버튼을 두지 않음.
    - 브라우저 캐시 회피를 위해 `styles.css`와 `app.js` 버전을 `20260612-4`로 갱신.
  - `apps/studio/app.js`
    - 그룹 생성 팝업에서 그룹 아이디 또는 그룹 이름이 비어 있으면 `그룹 아이디와 그룹 이름을 입력하세요.` 오류를 표시.
  - `scripts/serve-studio.js`
    - 그룹 생성 API에서 그룹 아이디/그룹 이름 누락 시 `400 CGA_GROUP_REQUIRED_FIELD_MISSING` 응답을 반환.
- 검증:
  - `node --check apps/studio/app.js` 통과.
  - `node --check scripts/serve-studio.js` 통과.
  - `npm run studio:validate` 통과.
  - 4173 서버 응답 확인: HTTP 200, 0.009245초.
  - 현재 서버가 `app.js?v=20260612-4`, `styles.css?v=20260612-4`를 서빙하는 것 확인.
  - 현재 서버 HTML에 `data-open-group-create` 버튼 노출 확인.
  - 그룹 관리 HTML 블록 확인: 그룹 생성 버튼 있음, 다운로드 버튼 없음.
  - `/api/cga/groups` 실제 데이터 조회 확인: 0.003902초.
  - 그룹 생성 필수값 누락 API 확인: HTTP 400, 1.720846초.
  - 서버 재시작 직후가 아닌 상태에서 재확인: 그룹 생성 필수값 누락 0.004335초, 그룹 조회 0.003863초.
  - 그룹 관리 툴바 배치 재보정:
    - 그룹 검색 입력, 상태, 초기화, 조회, `+ 그룹 생성`이 한 줄에 표시되도록 5칸 그리드로 수정.
    - `+ 그룹 생성` 버튼은 52px 공통 버튼 폭이 아니라 92px 전용 폭을 사용하도록 수정.
    - 브라우저 캐시 회피를 위해 Studio 정적 리소스 버전을 `20260612-5`로 갱신.
    - 4173 서버 응답 확인: HTTP 200, 0.003052초.
    - 현재 서버 CSS에서 5칸 그리드와 `data-open-group-create` 92px 폭 반영 확인.
    - `npm run studio:validate` 통과.
## 2026-06-12 역할별 권한 기준 확정 기록

- 작업 범위: 문서 기록. Aidot 저장소/소스는 수정하지 않음.
- 신산님 결정 사항:
  - `system_admin`: 모든 작업 가능. 소속 그룹은 `System Admin Group`이며, 이 그룹에는 `system_admin` 역할만 둔다.
  - `group_admin`: 자기 그룹 안에서는 모든 작업 가능, 다른 그룹은 조회 불가.
  - `builder`: 시스템 관리 제외 모든 기능 가능. 시스템 관리는 조회만 가능.
  - `operator`: 봇 운영 + 현황 조회 가능.
  - `reviewer`: 봇 제작 + 봇 제작 워크플로우 + 봇 운영 + 현황 조회 가능. 단, API 답변은 조회만 가능.
  - `viewer`: 현황 조회만 가능.
  - 봇 제작의 API 답변 생성/수정/삭제는 `builder` 이상만 가능하고, `reviewer`는 조회만 가능하다.
- 반영 문서:
  - `docs/CGA_Studio_설계서_완성본.md`
  - `docs/cga-access-and-api-answer-policy.md`
  - `docs/cga-work-progress.md`
- 기록 시각: 2026-06-12 19:12:13

## 2026-06-12 공통 변수 Aidot 기준 38건 반영
- 요청: Aidot 공통 변수 관리하기 화면 기준의 38건을 CGA에 등록.
- 기준: `D:\Project\Aidot\apps\web\components\flow-designer-page.tsx`의 `COMMON_FLOW_VARIABLES` 38건.
- 반영: `scripts/serve-studio.js` 기본 seed와 `.cga-data/admin-resources.json` 런타임 데이터의 `common_variables`를 동일한 38건으로 정렬.
- 검증 예정: 서버 문법 검사, admin resources API seed 검증, 실제 API 조회 건수/응답시간 확인.

### 공통 변수 38건 반영 검증 완료

- Aidot 기준: `apps/web/components/flow-designer-page.tsx`의 `COMMON_FLOW_VARIABLES` 38건.
- CGA 반영 위치:
  - `scripts/serve-studio.js` 기본 seed `common_variables` 38건.
  - `.cga-data/admin-resources.json` 실제 런타임 데이터 `common_variables` 38건.
  - `scripts/check-admin-resources-api.cjs` 검증 기준 38건으로 상향.
- 추가 수정:
  - `packages/public-core/src/access-state.js`에서 `SYSTEM_ADMIN_GROUP_ID` import 누락으로 `/api/cga/admin/resources`가 500을 반환하던 문제를 수정.
- 검증 결과:
  - `node --check scripts/serve-studio.js` 통과.
  - `node --check packages/public-core/src/access-state.js` 통과.
  - `node --check scripts/check-admin-resources-api.cjs` 통과.
  - `npm run studio:admin-resources-check` 통과.
  - 검증 스크립트 결과: templates 20건, common_variables 38건, default_messages 14건, channels 4건.
  - 4173 서버 재시작 후 실제 API 확인: `/api/cga/admin/resources` common_variables 38건.
  - 실제 4173 API 응답 시간: 첫 요청 1608ms, 재조회 30ms.
- Aidot 수정 여부: 없음. Aidot는 읽기 참조만 수행.

## 2026-06-12 - 봇 제작 > 봇 관리 실제 화면 전환
- 범위: CGA Studio `봇 제작 > 봇 관리` 화면만 수정. Aidot 소스는 수정하지 않음.
- 목적: 기존 작업공간 카드형 임시 UI를 제거하고 Aidot형 조회 화면 기준으로 봇 목록/선택/상세/버전관리/다운로드/업로드/복사/삭제 흐름을 시작.
- 반영 내용:
  - 봇 관리 화면을 조회형 기본 인터페이스로 교체: 검색, 상태 필터, 10/25/50/100 페이지 크기, 표, 하단 페이지 이동.
  - 선택한 봇 상세/수정은 팝업으로 분리.
  - 버전 관리는 Aidot 버전관리 팝업 형태로 분리.
  - 서버 API에 단일 봇 조회/수정/삭제를 추가하되 CGA 전용 화면 동작용이며 Aidot API/파일 구조는 수정하지 않음.
- 다음 확인: 실제 브라우저에서 봇 관리 목록, 상세 팝업, 버전관리 팝업, 임시 봇 생성/수정/삭제 API 검증.

### 검증 결과
- `node --check apps/studio/app.js`: 통과.
- `node --check scripts/serve-studio.js`: 통과.
- `npm run studio:workspace-bots-check`: 통과.
- `npm run studio:admin-resources-check`: 통과. common variables 38건, templates 20건, default messages 14건, channels 4건 확인.
- `npm run studio:style-check`: 통과. 폰트 기준 유지.
- 실제 봇 관리 API 테스트:
  - 임시 봇 생성: 성공.
  - 임시 봇 수정: 성공.
  - 임시 봇 삭제: 성공.
  - 삭제 후 목록 미노출: 성공.
  - 응답 시간: 생성 63ms, 수정 221ms, 삭제 45ms, 목록 40ms.
- 제한: 현재 작업 환경에는 Playwright가 없어 브라우저 자동 스크린샷 검증은 수행하지 못함. 서버는 `http://127.0.0.1:4173/`에서 정상 응답 200 확인.

## 2026-06-12 - 봇 제작/운영 화면 재배치 진행
- 작업 범위: CGA `apps/studio`만 수정. Aidot 소스는 수정하지 않음.
- 대상 메뉴: 봇 제작(BM/BOT/TM/API), 봇 제작 워크플로우(봇 생성/설정/구성/제작/테스트/평가), 봇 운영(재학습/분석).
- 원칙: Aidot 봇/버전/API/Webchat 호환 구조 유지. 화면은 Aidot 기능을 작업 순서대로 재배치.
- 반영: 봇 작업공간, 봇 제작 의도 목록, 대화 시작, 대화 설계, 테스트, 평가, 재학습, 분석 화면을 Aidot 조회형 화면 기준으로 정렬.
- 조회 기준: 1920x1080 기준, 10/25/50/100 페이지 크기, 하단 페이지 네비게이션, 빈 결과는 빈 테이블 유지.
- 권한 기준 기록: system_admin 전체 권한, group_admin 해당 그룹 전체 권한, builder 시스템 관리는 조회만/그 외 가능, operator 봇 운영+현황 조회, reviewer 봇 제작+워크플로우+운영+현황 조회, viewer 현황 조회만.

### 2026-06-12 검증 결과 - 봇 제작/운영 재배치
- `node --check apps/studio/app.js`: 통과.
- `node --check scripts/check-operations-state-api.mjs`: 통과.
- `npm run studio:style-check`: 통과. 24/14/12/10/9px 폰트 기준 유지.
- `npm run studio:workspace-bots-check`: 통과.
- `npm run studio:admin-resources-check`: 통과. common variables 38건, templates 20건, default messages 14건, channels 4건 확인.
- `npm run studio:operations-state-check`: 통과. 최신 권한 기준에 맞춰 builder 배포 가능 검증으로 수정.
- `http://127.0.0.1:4173/`: HTTP 200 확인.
- 서버 asset 확인: `app.js?v=20260612-6`, `styles.css?v=20260612-6` 응답 확인.
- 남은 확인: 실제 브라우저에서 좌측 메뉴별 화면 표시, 봇 제작 의도 클릭 시 대화 시작/대화 설계 전환 확인.


## 2026-06-12 화면 단일 표시 오류 수정

- 요청/문제: `#detail` 진입 시 선택한 화면 하나만 보여야 하는데 여러 `screen-card` 섹션이 동시에 표시되어 압축된 목록처럼 보임.
- 원인: `renderAllStatePanels()`와 워크플로우 렌더링 후 현재 선택 화면의 hidden/display 상태를 다시 강제하지 않아, 렌더링 순서에 따라 여러 `data-screen-id` 섹션이 동시에 노출될 수 있었음.
- 조치: `apps/studio/app.js`에 `enforceActiveScreenVisibility()`를 추가하고, `applyScreenLayout()` 마지막 및 `renderAllStatePanels()` 마지막에 적용하여 현재 active/hash 화면 1개만 표시되도록 고정함.
- 캐시: `apps/studio/index.html`의 `styles.css/app.js` 캐시 버전을 `20260612-7`로 갱신함.
- 검증: `node --check apps/studio/app.js` 통과, `http://127.0.0.1:4173/` HTTP 200 확인.
- 영향 범위: CGA Studio 화면 표시 제어만 변경. Aidot 소스 수정 없음.

## 2026-06-13 화면 선택 렌더링 오류 수정

### 문제
- `http://127.0.0.1:4173/#detail` 접속 시 로그인/화면 전환 후 여러 `[data-screen-id]` 화면이 한꺼번에 얇은 행처럼 겹쳐 보이는 문제가 발생했다.
- 사용자가 지적한 화면은 실제 제품 화면으로 볼 수 없는 상태였으며, 보고 전 기본 브라우저 검증이 부족했다.

### 원인
- 로그인/콘텐츠 재렌더 이후 현재 hash에 맞는 화면을 `.selected`로 다시 확정하는 처리가 충분히 강하지 않았다.
- CSS에서는 선택 화면만 보여야 하는데, 선택 상태가 비어 있으면 화면 표시 상태가 깨질 수 있었다.

### 조치
- `apps/studio/app.js`
  - 현재 hash, 기존 active screen, 기본 화면(`detail`), 실제 존재하는 첫 화면 순서로 활성 화면을 결정하도록 보강했다.
  - `cga:content-rendered` 이후 화면 선택을 즉시/지연 재적용하도록 보강했다.
- `apps/studio/index.html`
  - 캐시 버전을 `20260613-7`로 올렸다.
  - 앱 렌더 타이밍이 어긋나도 인증 상태와 hash 기준으로 한 화면만 표시하는 라우팅 가드를 추가했다.
- `apps/studio/styles.css`
  - `.workspace > [data-screen-id]`는 기본 숨김, `.selected`만 표시하도록 안전장치를 유지했다.

### 검증
- `node --check apps\studio\app.js`: 성공
- `curl http://127.0.0.1:4173/`: HTTP 200
- 브라우저 직접 검증
  - 비로그인 `#detail`: 로그인 화면만 표시, visible screen 0개
  - `u-builder` 로그인 후 `#detail`: visible screen `detail` 1개, active height 616px
  - 로그인 상태에서 `#create`: visible screen `create` 1개, active height 616px

### 금지사항 준수
- Aidot 소스는 수정하지 않았다.
- CGA(`D:\Project\cga`) 안에서만 작업했다.

## 2026-06-13 04:59:34 - 좌측 메뉴 미표시/미동작 오류 수정

### 상황
- 사용자 화면에서 좌측 메뉴 그룹(봇 제작, 봇 제작 워크플로우, 봇 운영, 시스템 관리)은 보이지만 하위 메뉴 카드가 렌더링되지 않았음.
- #detail 접근 시 우측 본문도 정상 선택되지 않고, 메뉴 클릭이 동작하지 않는 상태였음.

### 원인
- pps/studio/app.js 안에 동일 함수가 여러 번 선언되어 모듈 파싱이 중단됨.
- 확인된 중복 함수:
  - 
enderBuildAidotScreen
  - 
enderWorkspaceHome
- 브라우저 탭에는 이전 pp.js?v=20260613-8 캐시가 남아 있어, 서버 파일과 브라우저 적용 파일이 다르게 보였음.

### 조치
- CGA 전용 파일만 수정함. Aidot 저장소/소스는 수정하지 않음.
- pps/studio/app.js에서 중복된 구버전 
enderWorkspaceHome 선언 블록을 제거하고 최종 구현만 남김.
- 기존에 중복 제거한 
enderBuildAidotScreen 최종 구현만 유지됨.
- pps/studio/index.html의 Studio 스크립트 캐시 버전을 pp.js?v=20260613-9로 갱신함.

### 검증
- 
ode --check D:\Project\cga\apps\studio\app.js 통과.
- 중복 함수 선언 검사 결과: 
o duplicate function declarations.
- 브라우저에서 http://127.0.0.1:4173/?cache=20260613-9#detail 로드 확인.
- 적용 스크립트: /apps/studio/app.js?v=20260613-9.
- 좌측 메뉴 링크 수 확인:
  - 전체 메뉴 링크 29개
  - 봇 제작 워크플로우 6개
  - 봇 운영 2개
  - 시스템 관리 17개
- 메뉴 클릭 검증:
  - #create 클릭 시 create 화면 선택 및 표시 확인.
  - #detail 클릭 시 detail 화면 선택 및 표시 확인.

### 남은 주의사항
- 기존 브라우저 탭에 오래된 HTML/JS 캐시가 남아 있으면 v8을 계속 볼 수 있음. 서버 응답은 v9로 확인됨.
- 다음 작업자는 메뉴가 다시 비어 보이면 먼저 브라우저 캐시 적용 여부와 index.html의 pp.js 버전을 확인할 것.

## 2026-06-13 - 봇 제작 detail 화면 복구
- CGA 전용 작업만 수행. Aidot 소스는 수정하지 않음.
- #detail 화면이 전체 섹션 목록처럼 깨지던 문제를 수정하고, Aidot 의도 목록 기준의 봇 제작 화면으로 다시 렌더링하도록 연결.
- 봇 제작 목록은 실제 CGA/Aidot 호환 의도 데이터 소스를 사용하며, 표준 조회/페이지 크기/페이지네이션 구조를 유지.
- 권한 기준은 system_admin, group_admin, builder, operator, reviewer, viewer 기준으로 유지하며 이후 화면별 표시/수정 권한에 반영 예정.


## 2026-06-13 12:51:45 작업 진행 기록
- 작업 범위: CGA Studio만 수정. Aidot 소스는 수정하지 않음.
- 수정 내용: 로그인/인증 게이트가 좌측 메뉴 카드까지 숨기던 문제를 워크스페이스 화면만 숨기도록 제한.
- 수정 내용: 워크플로우 화면 재렌더링 후 현재 선택 화면을 다시 적용하도록 
enderWorkflowScreens()에 화면 가시성 재적용 추가.
- 목적: #detail 등에서 여러 화면이 얇게 겹쳐 보이고 좌측 메뉴가 열리지 않는 문제를 먼저 제거.
- 다음 확인: 1920x1080 기준으로 detail/evaluate/operate/analysis 화면이 각각 1개만 표시되는지 브라우저 검증.

## 2026-06-13 - Studio 접속 거부 및 화면 접힘 확인
- 작업 범위: CGA `apps/studio` 확인. Aidot 수정 없음.
- 사용자 보고 현상: `127.0.0.1:4173` 접속 거부 화면, `#detail` 등에서 화면 카드가 얇은 줄로 접힘.
- 확인 결과: `http://127.0.0.1:4173/`는 현재 HTTP 200 응답. `apps/studio/app.js`는 `node --check` 통과.
- 확인 결과: 실제 로드 CSS `/apps/studio/styles.css?v=20260613-7`에 `.workspace > .screen-card.selected`, `.workspace > .screen-card:not(.selected)`, `overflow: visible` 규칙 반영 확인.
- 원인 판단: 서버가 내려간 시점의 브라우저 탭은 접속 거부가 남을 수 있고, 화면 접힘은 후반 CSS의 `.screen-card` 표시/높이/overflow 규칙 충돌로 발생.
- 조치 방향: CGA 화면 표시 규칙은 선택된 화면만 `display:block`, 나머지는 숨김으로 유지. 화면 접힘 방지를 위해 selected 화면은 auto height/visible overflow 기준 유지.
- 다음 작업: 봇 관리부터 봇 생성, 봇 설정, 봇 구성, 봇 제작, 봇 테스트, 봇 평가, 재학습, 분석 순서로 Aidot 화면/데이터/API 호환 기준 재배치 계속.

## 2026-06-14 - 화면 전환 중복 표시 제어 버그 수정
- 작업 범위: CGA `apps/studio`만 수정. Aidot 소스는 수정하지 않음.
- 사용자 보고 현상: `#detail` 등 화면 전환 시 여러 화면 카드가 얇은 줄처럼 겹쳐 보이고, 메뉴가 정상적으로 열리지 않음.
- 원인: `applyScreenLayout()`과 `enforceActiveScreenVisibility()`가 각각 화면 표시/숨김을 따로 처리해 해시 변경, 권한 필터, 재렌더링 순서에 따라 선택 화면 상태가 충돌할 수 있었음.
- 조치: `applyScreenLayout()`은 화면 재배치만 담당하고, 실제 화면 표시/숨김은 `enforceActiveScreenVisibility()`로 단일화.
- 조치: `hidden` 상태의 화면 섹션은 `.selected` 클래스가 남아 있어도 CSS에서 강제로 숨기도록 안전 규칙 추가.
- 영향: CGA Studio 프런트엔드 화면 표시 제어만 변경. Aidot 호환 데이터/API 구조 변경 없음.
- 다음 확인: `node --check`, Studio 정적 점검, 로컬 서버 HTTP 응답, 주요 해시 화면 단일 표시 확인.

## 2026-06-14 화면 전환 깨짐 및 서버 상태 점검

### 현상
- `http://127.0.0.1:4173` 접속 시 간헐적으로 `ERR_CONNECTION_REFUSED`가 발생함.
- `#detail` 등 화면 이동 시 여러 화면 섹션이 동시에 얇은 줄처럼 표시되는 화면 깨짐이 발생함.

### 원인
- `ERR_CONNECTION_REFUSED`는 Studio dev server 프로세스가 죽었거나 4173 포트를 listen하지 않을 때 발생하는 서버 실행 상태 문제임.
- 화면 깨짐은 `apps/studio/styles.css` 안에 `.workspace > [data-screen-id]` 표시/숨김 규칙이 중복되어 있고, 화면 전환 시 JS의 표시 상태와 CSS 우선순위가 충돌해 선택되지 않은 화면까지 레이아웃에 남는 CSS/렌더링 버그였음.

### 조치
- `.workspace > [data-screen-id]` 표시 규칙을 단일 규칙으로 정리함.
- 선택된 화면만 `.selected:not([hidden])` 상태에서 표시되도록 정리함.
- Aidot 원본은 수정하지 않음. 작업은 CGA Studio(`D:\Project\cga`)에서만 수행함.

### 확인
- `node --check apps/studio/app.js` 통과.
- `curl http://127.0.0.1:4173/` 응답 `200`, 응답 시간 약 0.003초 확인.
- 인앱 브라우저에서 `http://127.0.0.1:4173/#detail` 실제 렌더링 확인: 화면 줄무늬 깨짐 없이 `봇 구성` 화면이 정상 표시됨.

### 다음 작업
- 봇 제작 영역(`봇 관리`, `봇 작업공간`, `팀 대시보드`, `그룹 API 레지스트리`)과 봇 제작 워크플로우(`봇 생성`~`봇 평가`), 봇 운영(`재학습`, `분석`)을 Aidot 화면 기준으로 계속 재배치한다.

## 2026-06-14 서버 연결 거부 재확인
- 증상: 브라우저에서 http://127.0.0.1:4173 접속 시 ERR_CONNECTION_REFUSED 발생.
- 확인 결과: 4173 포트에 LISTEN 프로세스가 없었음. 즉 화면 코드 렌더링 문제가 아니라 CGA Studio dev 서버 프로세스가 내려간 상태.
- 조치: D:\Project\cga 에서 node scripts\serve-studio.js 를 숨김 백그라운드 프로세스로 재기동.
- 검증: 127.0.0.1:4173 LISTEN pid=297992 확인, HTTP 200 확인, 재확인 응답 시간 0.018초.
- 추측: 이전에는 서버가 터미널/도구 세션에 묶여 있었거나 작업 중 프로세스가 종료되어 브라우저만 남은 상태로 보임. 반복 방지를 위해 서버 시작/상태 확인 절차를 작업 완료 전 필수 확인 항목으로 둔다.
- Aidot 수정 여부: 없음. CGA 서버 상태 확인 및 재기동만 수행.

## 2026-06-15 Aidot 참조 경로 고정 및 화면 초기화 버그 복구
- 작업 범위: `D:\Project\cga`만 수정. 원본 `D:\Project\Aidot` 및 참조 복사본 `D:\Project\cga\Aidot`은 수정하지 않음.
- 참조 기준: 앞으로 Aidot 화면/기능/데이터 구조 참조는 `D:\Project\cga\Aidot`을 사용하며 참조 전용으로 유지.
- Git 제외: 루트 `.gitignore`에 `/Aidot/` 규칙을 추가했고 `git check-ignore`로 `D:\Project\cga\Aidot` 제외를 확인함.

### 사용자 보고 현상
- `#access-management` 등 시스템 관리 화면이 실제 내용 없이 여러 개의 빈 골격 줄로 표시됨.
- 화면 전환 과정에서 일부 화면 전체가 중단될 수 있었음.

### 확인된 직접 원인
- 현재 `apps/studio/app.js`에서 화면 렌더 함수 다수가 누락된 상태인데 호출부는 남아 있었음.
- `applyScreenLayout()` 실행 중 `renderAccessPanels()`가 다시 `applyScreenLayout()`을 호출하는 재진입 경로가 있어 화면 초기화가 반복될 수 있었음.
- `renderBotManagement()`는 현재 파일과 Git 이력에 구현이 없지만 호출되고 있어 다른 정상 화면까지 중단시키는 호출-구현 불일치가 있었음.

### 조치
- Git 기준 파일에 존재하던 누락 렌더 함수들을 현재 파일에 복구함.
- `applyScreenLayout()`에 최소 범위 재진입 방지 가드를 추가함.
- 구현이 존재하지 않는 `renderBotManagement()` 호출은 구현 존재 시에만 실행하도록 제한해 다른 화면의 중단을 방지함.
- 데이터/API 계약, Aidot 호환 구조, 참조 Aidot 소스는 변경하지 않음.

### 검증
- `node --check apps/studio/app.js` 통과.
- `npm run studio:validate` 실제 API 조회 성능 확인: 그룹+로그인 이력 1.7ms, 템플릿 77ms, 공통 변수 27ms, 기본 메시지 153ms, 채널 19ms. 모두 5초 미만.
- 전체 검증 실패 원인은 이번 변경과 무관한 기존 전송 이력 다국어 키 2건(`transfer.historyTitle`, `transfer.historyLoadingTitle`)만 남음.
- Chrome headless 1920x1080 실제 로그인(`admin`) 후 직접 화면 전환 확인:
  - `#access-management`: 사용자 관리 실제 콘텐츠 표시, skeleton 0개.
  - `#detail`: 봇 제작 실제 콘텐츠 표시, skeleton 0개.
  - `#evaluate`: 평가 목록 및 Aidot 평가 상세 콘텐츠 표시, skeleton 0개.
  - `#operate`: 재학습 콘텐츠 표시, skeleton 0개.
  - `#analysis`: 분석 콘텐츠 표시, skeleton 0개.
- 위 화면 모두 문서 크기 1920x1080, 네트워크 실패 0건, 화면 중단 콘솔 오류 0건 확인.

### 남은 작업
- `renderBotManagement()` 실제 구현은 별도 작업으로 남아 있음. 구현 없는 호출이 다른 화면을 깨뜨리지 않도록 현재는 보호 처리됨.
- 기존 전송 이력 다국어 키 2건 보완 필요.
## 2026-06-17 에러 대비 및 화면 복사 작업 정리

### 작업 내용
- `API/평가/재학습/분석` 화면은 Aidot 화면의 내용은 유지하되, Aidot 내부의 메뉴 헤더(탭/상단 제목 등)는 복사하지 않도록 정리.
- `Aidot 참조 경로`는 `D:\Project\cga\Aidot` 기준으로 고정 사용하고, 원본 Aidot는 수정하지 않음.
- Docker 기준은 `service studio`, `container_name cga-studio`, `image cga-studio`, 포트 `4173`로 고정해 `docker-compose -p cga up --build studio` 및 `down` 기준 유지.
- Git 기준 브랜치/원격 운영은 `codex/wsl-container-dev` 기준으로 유지.
- 런타임 접속은 `http://127.0.0.1:4173/` 고정으로 통일.

### 에러 대응 기록
- 최근 사용자 피드백에서 “메뉴만 복사됨” 문제 발생: 봇 메뉴/탭 헤더를 콘텐츠 영역에서 분리하고 Aidot 본문 영역만 복사하도록 범위를 축소.
- 정적 캐시 버전 값을 최신 상태로 반영해 브라우저 노출 차이를 줄였고, 화면이 기존 캐시로 보이는 증상 대응.
- 동일 증상 반복 방지를 위해 렌더 우선순위/표시 대상 구간을 기능 화면 단위로 점검하면서, 임시/시안 문구 UI는 화면 구성에서 제거.
- Docker 컨테이너명/이미지명/서비스명 불일치 이슈로 인한 혼선은 최신 커밋(`8f10204`) 기준으로 정리 후 실행 절차 고정.

### 운영 확인 항목
- 서버 재기동 전 `docker-compose -p cga down`, 기동 후 `docker-compose -p cga up -d --build studio` 순서 준수.
- 접속 URL에서 `HTTP/1.1 200 OK` 응답 확인 후 화면 노출 비교.
- 에러 발생 시 화면 텍스트, 선택 메뉴, 본문 화면, 우측 상세 패널 상태를 동시에 확인해 메뉴복사(탭/헤더)와 본문복사(내용) 구분.

## 2026-06-17 Aidot 본문 복사 범위 재정리

### 작업 기준
- CGA는 Aidot 화면을 새로 설계하지 않고, Aidot 본문 내용을 CGA 워크플로우 단계에 맞게 재배치한다.
- Aidot의 상단 봇 헤더, 탭 메뉴, 상태 카운트 바는 CGA 본문에 복사하지 않는다.
- 단, 사용자 지시가 있는 항목은 예외적으로 남긴다. 현재 예외는 `학습하기` 버튼과 봇 구성 정의 문장이다.

### 반영 내용
- `봇 설정` 화면: 좌측을 봇 카드가 아니라 `서버 메뉴`로 정리하고, 우측에는 `AI 모델 설정` 본문만 남기도록 수정 시작.
- `봇 구성` 화면: Aidot 자동 구성 기준으로 `학습문장 입력` / `의도 후보` 화면이 보이도록 본문 교체. 하단 자산 전송 영역 제거.
- `봇 제작` 화면: Aidot 상단 봇 헤더/탭 카운트 바 제거. `학습하기` 버튼과 `Semantic - Vector Worker · Aidot Vector Worker 기본 모델 / 답변: Semantic Engine RAG 답변` 문장만 유지.
- `봇 테스트` 화면: 요약 카드형 테스트 화면 제거. Aidot 시뮬레이터 본문과 우측 `분석 데이터` 패널 구조로 교체.

### 주의사항
- Aidot 원본(`D:\\Project\\cga\\Aidot`)은 참조만 하고 수정하지 않음.
- 현재 수정은 `apps/studio/index.html`, `apps/studio/app.js`, `apps/studio/styles.css` 범위만 사용.
## 2026-06-17 화면 반영 이슈 처리(에러 대비)
- 검토 결과: `봇 테스트` 화면은 `renderTestAidotScreen()` 렌더러가 간단형(요약 박스)으로 계속 생성되어 있어서, 정적 마크업 변경만으로는 시각 변화가 체감되지 않음.
- 조치: `renderTestAidotScreen()`를 Aidot 시뮬레이터 본문 + 우측 분석 데이터 패널 구조로 전면 교체.
- 사용자 기준 반영: `봇 설정 = 서버 메뉴 + AI 모델 설정 본문`, `봇 구성 = Aidot 자동 구성`, `봇 제작 = 상단 탭/헤더 제거 + 학습하기 버튼 + 구성 정의 유지`, `봇 테스트 = Aidot 시뮬레이터 + 분석 패널`
- 확인 메시지: 화면이 같은 것처럼 보이던 원인은 기존 렌더러 우선권 때문이며, 배포/리로드 후 `#test` 진입 시점 반영이 필요.
## 2026-06-17 좌측 레일 그룹 접기/펼치기 반영
- `02 봇 설정`은 단일 카드 아래 정적 목록이 아니라 `서버 메뉴` 그룹으로 변경.
- `설정 / 기본 대화 / 연계`를 각각 `details/summary` 기반으로 접기/펼치기 가능하게 수정.
- `시스템 관리` 하위도 `사용자 관리 / 현황 조회 / 대화 관리 / 시스템 연계 / 기타 관리` 단위로 그룹 접기/펼치기 가능하게 수정.
- `봇 설정` 본문 안의 중복 서버 메뉴는 제거하고, 좌측 워크플로우 레일을 기준 메뉴로 사용.
## 2026-06-17 봇 구성 화면 기준 재수정
- 사용자 확인 결과 `03 봇 구성`은 이전에 임시로 맞춘 혼합형이 아니라 Aidot 자동 구성 화면이어야 함.
- `학습문장 입력 / 구성 엔진 / 구성 모델 / 목표 의도 수 / 자동 구성 / 분류 수 기준 / 의도 후보` 구조로 재정리.
- `ML 구성 테스트`, `ML 기준 의도 입력` 등 불필요한 하단 구성은 제거하고, `NLU 기준 / 가중치 설정`만 유지.
- 구성 엔진/모델 표기는 `Semantic - Vector Worker / Aidot Vector Worker 기본 모델` 기준으로 수정.

## 2026-06-17 봇 설정 좌측 메뉴 레이아웃 오작동 수정
- 사용자 확인 결과 `02 봇 설정` 하위의 서버 메뉴에서 불필요한 `서버 메뉴` 제목 박스가 노출되고 있었음.
- 같은 구간에서 하위 링크가 일반 워크플로우 카드 스타일을 다시 적용받아 세로로 좁고 긴 버튼처럼 깨지는 문제를 확인함.
- 조치: 좌측 하위 메뉴의 `서버 메뉴` 제목은 제거하고, `설정 / 기본 대화 / 연계` 그룹만 바로 보이도록 정리.
- 조치: `workflow-step-subnav` 하위 링크는 일반 `.workflow a` 카드 스타일을 덮어쓰지 않도록 전용 폭/표시 규칙으로 고정.
- 조치: `봇 설정` 본문 영역은 `aidot-settings-main--full`로 전체 폭을 사용하도록 보정해 한쪽으로 눌리는 현상을 완화.

## 2026-06-17 봇 구성 / 봇 제작 배포 동기화 주의 기록
- 사용자 확인 기준에서 `03 봇 구성`이 계속 `04 봇 제작` 본문처럼 보이는 현상이 있었음.
- 현재 로컬 소스 기준 구조는 `03(detail)=Aidot 자동 구성 화면`, `04(build)=Aidot 의도 목록/대화 설계 연결 화면`으로 분리되어 있음.
- 따라서 동일 증상 재발 시 우선 렌더 구조 문제보다도 `Git push -> WSL pull -> docker-compose -p cga up -d --build studio` 반영 누락 여부를 먼저 확인해야 함.

## 2026-06-17 서버 메뉴 그룹 제목 폰트 보정
- 사용자 확인 기준에서 `설정 / 기본 대화 / 연계` 그룹 제목 글자 크기가 워크플로우 카드 제목(`봇 평가` 등)보다 커 보였음.
- 조치: `02 봇 설정` 하위 `workflow-step-subnav` 내부 그룹 제목만 `var(--font-body)`로 낮춰, 상위 워크플로우 카드보다 작게 보이도록 조정.

## 2026-06-17 서버 메뉴 하위 위계 보정
- 사용자 확인 기준에서 `설정 / 기본 대화 / 연계`는 상위 `봇 설정`보다 더 작은 글자와 들여쓰기로 보여야 함.
- 조치: `workflow-step-subnav` 내부 그룹 제목 폰트를 `var(--font-desc)`로 더 낮추고, summary 자체에 좌측 여백을 줘 상위 카드보다 한 단계 아래 구조가 보이도록 수정.
- 조치: 각 하위 링크도 좌측 패딩을 늘려 그룹 제목 아래에 종속된 항목처럼 보이도록 보정.

## 2026-06-17 시스템 관리 하위 링크 들여쓰기 보정
- 사용자 확인 기준에서 시스템 관리 하위 링크(`사용자 관리 / 로그인 이력 / 그룹 관리` 등)도 그룹 제목 아래로 한 단계 들어가 보여야 함.
- 조치: 공통 `.subnav-group__links a` 좌측 패딩을 늘려 시스템 관리와 봇 설정 하위 링크 모두 들여쓰기되도록 통일.

## 2026-06-17 봇 설정 서브메뉴별 Aidot 본문 연결
- 사용자 확인 기준에서 `AI 모델 설정`만 아니라 `기본값 설정 / 메시지 설정 / 메신저 편의 기능 / 제외/무시 목록 설정 / 룰 설정 / 스몰토크 / 봇스테이션` 각각도 Aidot 기준 본문이 보여야 함.
- 조치: `#configure` 화면을 정적 한 장에서 `data-configure-aidot-screen` 렌더러 구조로 변경.
- 조치: `currentConfigureSubview`에 따라 Aidot 기준 본문을 각각 렌더링하도록 `renderConfigureAidotScreen()` 추가.
- 참고 기준: `Aidot/apps/web/components/bot-settings-shell.tsx`, `conversation-default-settings-page.tsx`, `conversation-message-settings-page.tsx`, `messenger-settings-page.tsx`, `blocklist-settings-page.tsx`, `rule-settings-page.tsx`, `smalltalk-settings-page.tsx`, `botstation-settings-page.tsx`, `Aidot/docs/settings-semantics-40-45.md`.

## 2026-06-17 20:00 봇 구성 화면 상세 본문 반영
- `detail` 섹션 렌더러를 기존 의도/모듈 표 기반 표출에서 Aidot 기준 자동 구성 본문으로 교체.
- 화면 타이틀을 `봇 구성`으로, 부제목을 `봇 구성은 학습문장을 기반으로 의도 후보를 생성합니다.`로 통일.
- 좌측 입력 영역(`학습문장 입력`, `구성 엔진/모델`, `목표 의도 수`, `자동 구성`)과 우측 `의도 후보` 패널을 연결해 `detail` 화면 고정 템플릿으로 반영.
- 후보 목록은 기존 미리보기 텍스트/갱신 로직을 유지하는 `data-config-preview` 바인딩으로 연결.
- 사용자 기준: 화면은 `apps/studio/app.js`의 `renderDetailAidotScreen` 단위 변경만 적용했고, 실행 경로(`D:\Project\cga`, Docker 기준 `studio`)는 기존 운영 규칙을 유지.

## 2026-06-17 20:20 봇 구성/봇 제작 화면 번호 및 렌더 경계 보정
- 사용자 확인 기준에서 좌측 `03 봇 구성`을 눌렀는데 본문 헤더가 `04 봇 제작`처럼 보여 단계 식별이 틀어지는 문제가 있었음.
- 조치: `renderDetailAidotScreen()`의 단계 코드를 `04`에서 `03`으로 수정.
- 조치: `renderBuildAidotScreen()`도 `build` 섹션 안에서 자체적으로 `04 봇 제작` 헤더를 렌더하도록 바꿔, `detail`과 `build` 화면이 섞여 보일 가능성을 줄임.
- 조치: `index.html`의 초기 정적 골격도 `03 봇 구성`, `04 봇 제작` 기준으로 맞춰 브라우저 초기 노출과 JS 렌더 후 상태가 다르지 않게 정리.

## 2026-06-17 21:05 Aidot 동일 화면 기준 재수정
- 사용자 지시에 따라 `봇 구성` 화면에서 임의 해석 문구와 혼합형 구성을 제거.
- 기준 소스는 `Aidot/apps/web/components/intent-configure-page.tsx`의 `RAG 답변 문서 구성` 블록으로 고정.
- 조치: `RAG 답변 문서 구성`, `텍스트/PDF`, `답변 텍스트`, `PDF 파일`, `문서 제목`, `RAG 문서 구성`, `분류 수 기준`, `NLU 기준 / 가중치 설정`, `의도 후보` 구조와 문구를 Aidot 기준으로 다시 맞춤.
- 조치: `봇 설정` 하위 메뉴는 클릭 시 `currentConfigureSubview`만 바뀌고 본문이 갱신되지 않던 문제를 함께 수정해, 좌측 메뉴 선택 즉시 Aidot 본문이 바뀌도록 보정.

## 2026-06-17 21:35 봇 제작 상위 3개 화면 디자인 기준 정리
- 사용자 질문 기준: `봇 관리 / 봇 작업공간 / 팀 대시보드`는 Aidot 개별 기능 화면 복사가 아니라 CGA의 봇 제작 운영 진입 화면으로 정리해야 함.
- `봇 관리`: Aidot와의 봇 단위 100% 호환을 전제로 `봇 다운로드 / 봇 업로드 / 버전 다운로드 / 버전 업로드 / 운영버전 / WebChat 접속 경로`를 한 화면에서 확인하는 구조로 설계.
- `봇 작업공간`: 그룹 기준으로 봇 목록을 보고 현재 작업 봇을 선택한 뒤 `봇 생성 / 봇 설정 / 봇 구성`으로 들어가는 작업 시작 화면으로 설계.
- `팀 대시보드`: 팀 단위 제작 작업, 검수 대기, 차단 항목, 상태별 건수를 확인하는 운영형 작업판으로 설계.
- 제한 재확인: Aidot 원본은 수정하지 않으며, 봇 패키지 다운로드/업로드 왕복과 WebChat 접속 호환은 이후 변경에서도 깨지면 안 되는 최상위 기준.
## 2026-06-17 화면 보완: 봇 관리/봇 작업공간/팀 대시보드 내용 정렬

### 작업 범위
- `renderWorkspaceHome()`에서 작업공간 역할 문구와 레이아웃을
  `그룹 선택/그룹 봇 목록/현재 작업 봇/최근 작업/봇 생성/작업 시작` 흐름으로 정리했습니다.
- `renderBotManagement()`를 `봇 목록 조회`, `봇 상세 정보`, `버전 목록`, `버전 추가/복사/삭제`, `운영 버전 설정`,
  `봇 다운로드/업로드`, `웹챗 접속 경로` 중심으로 재배치해 화면 콘텐츠 정합성을 맞췄습니다.
- `renderTeamDashboard()`를 운영형 관점으로 보완해
  `내 작업/검토 대기/승인 필요/잠금 상태/전체 작업` 요약, `내 작업/검토 대기/차단 항목` 목록, `그룹별/봇별 진행률`, `권한별 할 일` 카드 패널을 추가했습니다.
- 팀 대시보드 항목에 `담당자`, `잠금`, `최근수정` 정보를 노출해 작업 추적성이 올라가도록 정리했습니다.
- 기존 버튼/액션 바인딩(`data-*`)은 유지해 기능 흐름을 깨지 않게 했습니다.

### 확인 및 에러 대비
- `node --check apps\\studio\\app.js` 통과(문법 오류 없음).
- 변경 파일: `apps/studio/app.js`.
- 작업 로그 파일(`studio-server-20260614-122141.err.log`, `studio-server-20260614-122141.log`, `studio-server.log`)은 읽기 전용 모니터링용으로 로컬에만 유지하고 본 이력에는 제외 대상.

## 2026-06-17 화면 보완 작업 후속 정리

### 작업 범위
- `renderWorkspaceHome()`(봇 작업공간), `renderBotManagement()`(봇 관리), `renderTeamDashboard()`(팀 대시보드)의 화면 문구/배열/액션 동작을 사용자 요구 기준에 맞춰 재정렬.
- 스타일 점검 규칙(`studio:style-check`) 통과를 위해 일부 큰 폰트 수치를 `font-title`/`font-body` 계열로 정렬해 위계 깨짐 및 초과 사이즈 이슈 축소.
- `Test` 화면 렌더링이 `check-studio-config` 기준을 만족하도록 정적 마크업 마커 보강:
  - `data-test-aidot-result`, `data-test-runtime` 추가
  - `aidot-settings-screen` 마운트 문자열 반영

### 확인 결과
- `npm run studio:validate` 재실행 시 `studio:style-check`, `studio:config-check` 통과.
- 동일 실행에서 `studio:i18n-check`은 기존 정적 문자열 i18n 태깅 미보완 항목으로만 실패(새로 추가한 보완 범위와 직접 충돌 없음).

### 운영 메모
- 코드 변경 전용은 `D:\Project\cga/apps/studio/{app.js,index.html,styles.css}` 중심으로 제한.
- `D:\Project\cga\Aidot`은 참조 전용 상태 유지.

## 2026-06-18 화면 디자인 정리(봇 작업공간/봇 관리/팀 대시보드)

### 작업 범위
- `cga-command` 계열 클래스의 레이아웃 정렬만 추가 보강:
  - `workspace-command-grid--workspace` / `bot-management-grid--compact` / `team-command-grid--lists` / `team-command-grid--metrics`
  - `command-row--highlighted`, `command-row--bot-version`, `command-panel--wide-sticky`, `command-panel--status-block`
  - `workspace-recent-list`, `team-status-strip` 밀도 보정
- 작업 목록이 5개인 화면을 위해 `.command-summary`를 고정 4열에서 `repeat(auto-fit, minmax(160px, 1fr))`로 변경해 줄바꿈/밀집 이슈를 완화.
- 팀 대시보드 하단 상태 카드 그리드도 상태 패널 크기 일관성 보완.

### 확인
- `npm run studio:validate` 전체 재실행.
- 결과: `studio:style-check`, `studio:config-check`, API/동작 체크 모두 통과.

### 운영 메모
- 화면은 구조 변경 없이 기존 `render` 바인딩을 유지한 상태에서 CSS 정렬만 보완해 반영.

## 2026-06-18 봇 생성 화면 레이아웃 및 상단 액션 정리

### 작업 범위
- `봇 생성` 화면의 누락된 전용 스타일을 추가해 `create-layout` 2단 구조로 재정리.
- `lock-pill-row`, `form-grid.two`, `channel-choice-row`, `create-form-panel`, `status-panel.compact`를 제품형 작업 화면 밀도로 보정.
- 상단 전역 액션 중 `저장`은 실제 저장 동작(`saveStudioStateToServer` + `saveCompositionToServer` + `saveDetailAssetsToServer`)으로 연결.
- `미리보기`는 숨김 처리, `배포`는 `bot-management / test / evaluate / operate / analysis` 화면에서만 보이도록 화면 문맥 기준으로 제한.

### 확인
- `npm run studio:validate` 전체 통과.

### 사용자 지적 반영
- `봇 생성` 단계에서 불필요한 `미리보기/배포` 버튼이 보이던 문제를 정리.
- 저장 버튼이 눌려도 동작하지 않던 문제를 수정.

## 2026-06-18 기본 진입 화면 및 간단 사용자 설명서 정리

### 작업 범위
- 로그인 직후 기본 진입 화면을 `봇 작업공간`으로 고정하도록 `DEFAULT_ACTIVE_SCREEN_ID`를 `workspace-home`으로 변경.
- 로그인 성공/오프라인 로그인 fallback 시 URL hash도 `#workspace-home`으로 정리해 이전 화면 잔상 진입을 막음.
- 로그아웃 시 hash를 비워 재로그인 기준 화면을 초기화.
- `docs/cga-studio-quickstart-ko.md`에 실제 사용 순서 중심 간단 설명서 추가.

### 확인
- `npm run studio:validate` 재실행 예정 기준으로 수정.
## 2026-06-18 08:22 KST

- 로그인 후 기본 진입 화면이 `workspace-home`이 아니라 `detail`로 강제되는 원인 추가 확인.
- 원인: `apps/studio/entry-auth.js`의 `enterAuthenticatedShell()`가 로그인 성공 직후 `detail` 해시를 직접 기록하고 있었음.
- 조치:
  - `apps/studio/entry-auth.js` 로그인 직후 기본 화면을 `workspace-home`으로 수정.
  - `apps/studio/index.html`의 보조 화면 전환 스크립트 기본값도 `workspace-home`으로 정리.
  - 캐시 영향 최소화를 위해 `styles.css`, `entry-auth.js`, `app.js`, `workflow.js`, `layout.js`의 버전 쿼리 갱신.
- 디자인 보완:
  - `봇 생성` 화면을 2열 밀도형 배치로 조정.
  - 섹션 설명부를 가로 정렬로 줄이고 설명 textarea 높이를 축소.
  - 우측 요약 패널을 화면 높이에 맞춰 고정형으로 정리.
- 검증:
  - `npm run studio:validate` 통과.
  - 브라우저 직접 확인 결과 현재 `http://127.0.0.1:4173/`는 아직 이전 실행본 영향이 남아 있어, Git 반영 및 WSL 재배포 후 다시 확인 필요.

## 2026-06-18 08:31 KST

- 추가 원인 정리:
  - 로그인 버튼에 `apps/studio/entry-auth.js`와 `apps/studio/app.js`가 동시에 바인딩되어 인증/화면전환이 이중 실행되고 있었음.
- 조치:
  - 로그인 처리 주체를 `apps/studio/app.js` 한 곳으로 통일.
  - `apps/studio/entry-auth.js`에서는 로그인 바인딩을 제거하고, 로그인 화면 문구/로그아웃 보조 역할만 유지.
- 기대 효과:
  - 로그인 성공 후 기본 진입 화면 결정이 단일 경로로 정리되어 `workspace-home` 강제가 안정화되어야 함.

## 2026-06-18 08:39 KST

- 추가 확인 결과 로그인 버튼 미작동의 직접 원인 발견.
- 원인:
  - `apps/studio/app.js` 버전 추가 로직에서 배열 생성 구문 괄호가 하나 빠져 있었음.
  - 결과적으로 브라우저가 `app.js` 전체를 파싱하지 못했고, 로그인 버튼 바인딩/화면 렌더링이 모두 실행되지 않았음.
- 조치:
  - `apps/studio/app.js` 해당 구문 괄호 수정.

## 2026-06-18 08:46 KST

- 화면 정리 작업:
  - `봇 작업공간`에서 중복 `+ 봇 생성` 버튼 제거.
  - 좌측 목록 하단은 `선택 그룹 / 작업 가능 봇 수 / 작업 봇 열기`만 남기도록 단순화.
  - 우측 빠른 이동은 `봇 설정 / 봇 구성 / 봇 관리` 3개로 정리.
  - 빈 그룹 상태 문구를 작업 시작 안내형 문구로 수정.
  - 모바일/좁은 폭에서 하단 메타 영역이 세로로 정리되도록 반응형 보완.
  - 간단 사용 설명서도 현재 화면 기준으로 갱신.

## 2026-06-18 09:20 KST

- 최종 산출물 기준을 `사용자 가이드 문서`로 재설정.
- 작업 내용:
  - 시스템 관리자 로그인 시 전체 활성 그룹이 보이도록 `getActiveGroupsForCurrentUser()` 보정.
  - 현재 봇/현재 그룹이 엇갈릴 때 `Support Bot Group` 같은 실제 작업 그룹으로 자동 정렬하도록 `syncWorkspaceSelection()` 추가.
  - 상단 `배포` 버튼은 운영 화면에서만 보이도록 제한.
  - `팀 대시보드`에 `최근 수정 이력`, `병목 항목`, `담당자별 작업량` 섹션 추가.
  - `봇 생성`, `봇 작업공간`, `봇 관리`, `팀 대시보드`의 화면 높이를 1920x1080 기준 내부 스크롤형 작업 화면으로 보정.
  - 캐시 누락 방지를 위해 `index.html`, `app.js` 정적 자원 버전을 `20260618-9`로 상향.
- 검증:
  - `npm run studio:validate` 전체 통과.
  - WSL 배포본 `~/deploy/cga`에 `git pull --ff-only` 후 `docker-compose -p cga up -d --build studio` 재기동.
  - `curl -I http://127.0.0.1:4173/` 결과 `HTTP/1.1 200 OK`.
  - 브라우저 강제 새로고침 후 아래 동작 직접 확인:
    - 로그인 후 기본 화면 `봇 작업공간`
    - `Support Bot Group` 봇 목록 표시
    - `+ 봇 생성` 후 `봇 생성` 화면 진입
    - 상단 `저장` 버튼으로 서버 저장 메시지 확인
    - `봇 관리`에서 `버전 추가` 후 `v0.2` 생성
    - `팀 대시보드`에서 `승인` 후 `검토 대기 0건` 반영
- 문서:
  - `docs/cga-studio-user-guide-ko.md` 신규 작성
  - `docs/cga-studio-quickstart-ko.md`는 상세 가이드 링크용으로 축약 정리

## 2026-06-18 09:34 KST

- 신산님 추가 지시:
  - 에러 상황에 대비해 작업 진행 상황을 항상 별도 파일에 기록 유지.
- 기록 원칙 확정:
  - 진행 중 작업, 발견한 문제, 적용한 수정, 검증 결과를 모두 `docs/cga-work-progress.md`에 이어서 누적 기록.
  - 전체 완료 전까지는 최종 산출물 문서로 취급하지 않고 작업 로그만 지속 갱신.
- 현재 진행 중:
  - `봇 관리` 화면에 WebChat 실제 열기 동선과 패키지 전송 이력 표시를 보강 중.

## 2026-06-18 09:40 KST

- `봇 관리` 보강 작업:
  - WebChat 주소를 단순 텍스트가 아니라 클릭 가능한 링크로 변경.
  - `WebChat 열기` 버튼 추가.
  - `data-transfer-history` 영역을 `봇 관리` 화면에 추가해 최근 패키지 전송 5건을 바로 확인할 수 있도록 보강.
  - 전송 이력 아이템용 스타일(`transfer-history-item`)과 링크/이력 블록 스타일 추가.
- 검증:
  - `node --check apps/studio/app.js` 통과.
  - `npm run studio:validate` 전체 통과.
- 추가 확인:
  - 첫 배포 후 브라우저에 새 `WebChat 열기`/`전송 이력`이 안 보였음.
  - 원인: `index.html`의 정적 자원 쿼리 버전이 그대로여서 브라우저가 `app.js/styles.css` 이전 캐시를 계속 사용.
  - 조치: `styles.css`, `entry-auth.js`, `app.js`, `workflow.js`, `layout.js` 쿼리 버전을 `20260618-10`으로 상향.
  - 추가 원인:
    - `봇 다운로드` / `버전 다운로드` 이후 `renderWorkspaceHome()`만 호출되어 현재 `봇 관리` 화면의 상태 문구와 전송 이력이 즉시 갱신되지 않았음.
    - `WebChat 열기`는 `window.open()`만 사용해서 팝업 차단 시 반응이 없을 수 있었음.
  - 추가 조치:
    - 다운로드 후 `renderBotManagement()`도 함께 호출하도록 수정.
    - `window.open()` 실패 시 `window.location.assign()`으로 같은 탭 이동 fallback 추가.

## 2026-06-18 09:52 KST

- 추가 원인 확정:
  - `봇 관리`의 `WebChat 열기` 버튼은 노출되지만 실제 대상 URL `/webchat/{botSlug}`를 `scripts/serve-studio.js`가 서빙하지 않아 `HTTP 404`가 발생함.
  - 따라서 현재 문제는 버튼/스타일 문제가 아니라 브라우저용 WebChat 화면 라우트 부재임.
- 수정 방침:
  - 기존 Aidot 호환 WebChat API(`/api/v1/channels/webchat/*`, `/api/v1/webchat/*`)는 유지.
  - 그 API를 사용하는 브라우저 전용 WebChat 화면을 추가하고, `/webchat/{botSlug}` 경로를 서버에서 직접 연결.
  - 새 기능 추가가 아니라 기존 WebChat API를 실제 접속 가능한 화면으로 노출하는 정리 작업으로 제한.

## 2026-06-18 10:00 KST

- 적용 내용:
  - `scripts/serve-studio.js`에 `/webchat/{botSlug}` 요청을 `apps/webchat/index.html`로 연결하는 라우팅 추가.
  - `apps/webchat/index.html`, `apps/webchat/styles.css`, `apps/webchat/app.js` 신규 추가.
  - WebChat 화면은 기존 Aidot 호환 API를 사용해 다음 순서로 동작:
    - `/api/v1/webchat/bootstrap`로 봇 목록 확인
    - `/api/v1/channels/webchat/rooms`로 room 생성
    - `/api/v1/channels/webchat/rooms/{roomId}/messages`로 메시지 송수신
  - 서버 응답이 Aidot 형식(`{ data: ... }`)인 점을 반영해 WebChat 브라우저 JS가 `data` 래퍼를 풀어 처리하도록 수정.
- 검증:
  - `npm run studio:check` 통과
  - 임시 로컬 서버(`PORT=4273`)에서 `GET /webchat/supportbot-draft` 응답 `200` 확인
  - 같은 서버에서 room 생성 및 메시지 전송 후 응답 확인:
    - 의도: `password_reset`
    - 봇 답변: `Open Account Settings and choose Reset Password.`
  - `npm run studio:validate` 전체 통과

## 2026-06-18 10:03 KST

- Git / 배포:
  - 커밋: `de1f779 feat: add aidot-compatible webchat page`
  - 브랜치: `codex/wsl-container-dev`
  - 원격 push 완료 후 WSL 실행본 `~/deploy/cga`에서 `git pull --ff-only` 및 `docker-compose -p cga up -d --build studio` 재기동 완료.
- 배포 검증:
  - `http://127.0.0.1:4173/webchat/supportbot-draft` 응답 `200`
  - `http://127.0.0.1:4173/` 응답 `200`
  - 배포 서버에서 room 생성 및 메시지 전송 확인:
    - room 생성 성공
    - 의도: `password_reset`
    - 봇 답변: `Open Account Settings and choose Reset Password.`

## 2026-06-18 10:14 KST

- 후속 보정 시작:
  - `봇 관리` 화면에서 전송 이력이 존재해도 상단 상태 문구가 계속 `최근 패키지 전송 이력이 없습니다.`로 남는 문제를 재확인.
  - 원인 추정:
    - 전송 이력은 비동기로 로드되지만 상태 문구는 초기 렌더 문자열만 사용해, 로드 후에도 별도 갱신되지 않음.
  - 조치 예정:
    - 최근 전송 이력을 전역 상태로 유지하고, 상태 문구와 이력 박스가 같은 기준을 보도록 정리.
    - 함께 `봇 관리` 우측 패널 폭/링크 줄바꿈/버튼 정렬을 보정해 실제 사용 화면 밀도를 개선.

## 2026-06-18 10:18 KST

- `봇 관리` 후속 보정 적용:
  - 최근 전송 이력을 `currentTransferHistory`로 유지하고, 상태 문구가 이력 상태와 어긋나지 않도록 보강.
  - 우측 상세 패널 전용 레이아웃(`command-panel--bot-detail`) 추가.
  - `WebChat` 링크, 상태 문구, 전송 이력 블록, 우측 액션 버튼 높이/정렬 보정.
  - 버전 표의 작업 버튼 정렬을 우측 기준으로 맞춤.
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `npm run studio:validate` 전체 통과
  - Git push 후 WSL 배포본 재기동 완료
  - `http://127.0.0.1:4173/`, `http://127.0.0.1:4173/webchat/supportbot-draft` 응답 `200`
  - 브라우저에서 `WebChat` 화면 직접 메시지 왕복 확인:
    - 사용자 입력: `How do I reset my password?`
    - 매칭 의도: `password_reset`
    - 봇 답변: `Open Account Settings and choose Reset Password.`

## 2026-06-18 10:22 KST

- `팀 대시보드` 후속 점검:
  - 브라우저 기준으로 협업 항목 다수가 `미지정` 그룹/봇으로 보여 실제 작업 대상 감지가 약한 상태를 확인.
  - 조치 예정:
    - 협업 항목에 `group_id`, `bot_id`가 비어 있을 때 현재 작업 그룹/봇을 fallback으로 사용해 대시보드 가독성을 개선.

## 2026-06-18 10:31 KST

- 추가 점검:
  - 브라우저에서 상단 context badge와 팀 대시보드 액션 버튼 일부가 한국어 선택 상태에서도 영어(`Authentication`, `Approve`, `Lock`)로 남는 현상을 확인.
  - 원인 추정:
    - `getCurrentLocale()`가 topbar select 값을 우선 사용해 실제 i18n 런타임 locale과 어긋나는 경우가 있음.
  - 조치 예정:
    - locale 판정 우선순위를 i18n 런타임 기준으로 조정하고, locale 변경 시 상단 context/네비게이션/대시보드가 같은 기준으로 다시 렌더되도록 보정.

## 2026-06-18 10:38 KST

- locale 보정 확인:
  - 새 탭에서 `#team-dashboard` 기준 재확인 결과 상단 context badge와 대시보드 액션 버튼이 한국어(`인증`, `승인`, `수정 요청`, `할 일로 이동`)로 정상 출력됨.
- 추가 보완 예정:
  - 팀 대시보드 내부 상태 코드(`todo`, `in_progress`, `review`, `blocked`)와 역할명(`viewer` 등)은 아직 내부 코드 그대로 노출되는 구간이 있어 사용자용 라벨로 변환 예정.

## 2026-06-18 10:46 KST

- `봇 생성` 화면 원인 확인:
  - 1280대 브라우저 폭에서 `create-layout`, `create-form-panel`이 `@media (max-width: 1300px)` 규칙에 걸려 강제로 1열로 접히고 있었음.
  - 그 결과 우측 구조 요약 패널이 아래로 밀려 한 화면에서 보이지 않아 스크롤이 커지는 원인이 됨.
- 조치 예정:
  - `봇 생성`만큼은 1280 기준에서도 2열이 유지되도록 반응형 분기 폭을 더 낮게 조정.

## 2026-06-18 11:02 KST

- `봇 설정` / `봇 구성` 레이아웃 보정 시작:
  - `봇 설정`은 실제 본문만 있는 화면인데 `.aidot-settings-screen`이 grid 껍데기를 유지하고 있어 화면 폭을 어색하게 쓰는 상태였음.
  - `봇 구성`은 좌측 입력 작업 영역보다 우측 후보 영역이 더 크게 보이는 비율이라 Aidot 작업 흐름 기준으로 답답했음.
- 적용 내용:
  - `.aidot-settings-screen`을 전체 폭 단일 블록 레이아웃으로 정리.
  - `.aidot-settings-main`과 하위 grid(`aidot-field-grid`, `aidot-weight-grid`, `rag-form-grid`)가 화면 전체 폭을 사용하도록 보강.
  - `.aidot-rag-config`는 좌측 작업영역 우선 비율로 재조정.
  - `rag-target-row`, `rag-source-mode`, `rag-footer-row`는 줄바꿈 가능하게 보강.
  - `의도 후보` 박스 최소 높이를 늘려 우측 패널이 빈 박스처럼 보이지 않도록 조정.
  - 1180px / 820px 이하에서는 관련 grid가 순차적으로 1열 또는 2열로 접히도록 반응형 분기 추가.
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `npm run studio:validate` 전체 통과

## 2026-06-18 11:18 KST

- `봇 구성` 기능 보강:
  - 기존에는 `자동 구성 / RAG 문서 구성` 버튼이 화면에만 있고 실제 의도 후보를 만드는 동작이 연결되어 있지 않았음.
  - `선택 병합`, `현재 버전 덮어쓰기`, 후보별 `Review`도 후속 흐름 바인딩이 빠져 있었음.
- 적용 내용:
  - 학습문장 기반 키워드 분류 또는 PDF 제목/파일명 기준으로 의도 후보를 만들고 `intent_candidates`에 반영하는 로직 추가.
  - 후보 목록에 선택 체크박스를 추가하고 `선택 병합`이 선택 후보만 현재 버전에 반영하도록 보강.
  - `현재 버전 덮어쓰기`가 전체 후보를 현재 봇 의도 자산으로 반영하고 `봇 제작` 화면으로 이동하도록 연결.
  - 후보별 `Review` 버튼이 해당 의도를 선택한 채 `봇 제작 > 대화 시작` 화면으로 이어지도록 연결.
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `npm run studio:validate` 전체 통과

## 2026-06-18 11:27 KST

- `봇 테스트` 동작 보강:
  - `run-test` 실행 바인딩은 있었지만 테스트 화면 입력창에 `data-test-input`이 없어 엔터/전송 버튼 모두 실제 실행으로 이어지지 않는 상태였음.
- 적용 내용:
  - 시뮬레이터 입력창에 `data-test-input`, 전송 버튼에 `data-test-send` 연결.
  - 엔터 입력과 전송 버튼 클릭이 같은 `run-test` 실행 로직을 타도록 통합.
  - `분석 데이터 보기` 버튼은 우측 분석 패널 위치로 바로 이동하도록 보조 동작 추가.
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `npm run studio:validate` 전체 통과

## 2026-06-18 11:36 KST

- `봇 제작` 동작 보강:
  - 기존에는 `+ 의도/모듈 추가`, `학습문장 추가/삭제`, `저장하기`, `저장 후 대화설계`, `대화 설계 저장` 버튼이 화면 전환만 하거나 아무 저장 없이 끝나는 상태였음.
- 적용 내용:
  - `+ 의도/모듈 추가`가 실제 새 의도와 기본 학습문장을 생성하고 즉시 자산 저장하도록 연결.
  - `대화 시작` 화면에서 학습문장 선택/삭제, 학습문장 추가를 실제 자산 상태에 반영하도록 연결.
  - `저장하기`, `저장 후 대화설계`가 현재 의도 자산을 서버 저장하도록 보강.
  - `대화 설계` 화면의 카드 이름/기본 메시지 편집값이 시나리오 답변/대화카드 자산에 저장되도록 연결.
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `npm run studio:validate` 전체 통과

## 2026-06-18 11:44 KST

- `봇 관리` / `봇 작업공간` 후속 동기화 보강:
  - 다운로드/업로드/버전 추가/복사/삭제/운영설정 후 일부 화면은 갱신되지만, 다른 화면은 이전 상태가 남아 눌러도 변화가 없는 것처럼 보일 수 있었음.
- 적용 내용:
  - `refreshWorkspaceManagementSurfaces()` 헬퍼 추가.
  - `봇 관리`의 버전 추가, 버전 다운로드/업로드, 봇 삭제, 버전 복사/삭제/운영설정, 봇 다운로드/업로드 후
    `봇 작업공간`, `봇 관리`, 상단 컨텍스트, 상태 패널이 한 번에 다시 그려지도록 정리.
  - 전송 이력/상태 문구도 같은 시점에 즉시 화면 반영되도록 보강.
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `npm run studio:validate` 전체 통과

## 2026-06-18 11:58 KST

- 봇 선택 시 서버 상태 동기화 보강:
  - `봇 작업공간`이나 `봇 관리`에서 다른 봇을 선택해도 운영 상태, 협업 상태, API 레지스트리가 직전 봇 기준으로 남아 보일 수 있었음.
- 적용 내용:
  - `syncSelectedBotServerState()` 헬퍼 추가.
  - 봇 목록 선택, 최근 작업 봇 선택, 현재 작업 봇 열기, 봇 관리 카드 선택 시
    `operations-state`, `collaboration-state`, `api-registry`를 서버에서 다시 읽도록 연결.
  - 이후 `refreshWorkspaceManagementSurfaces({ rerenderAdmin: true })`로 관련 화면이 같은 봇 기준으로 같이 갱신되도록 정리.
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `npm run studio:validate` 전체 통과

- 2026-06-19: CGA docker-compose.yml에 services.studio.restart: unless-stopped 추가. 이유: WSL 재시작 시 컨테이너가 자동 복구되지 않던 원인(현재 no restart 정책)을 제거하기 위함. 이 변경은 실행/도커 정책만 변경하며, 웹 화면/기능 로직에는 영향 없음.

- 2026-06-19: 팀 대시보드 액션 동기화 개선. indTeamDashboardActions의 액션 처리 후 syncTeamDashboardAfterAction()를 호출해 
unCollaborationAction 실행/폴백 반영 뒤 
efreshCollaborationStateFromServer + 
enderTeamDashboard + 
enderCollaborationSummary + 
efreshWorkspaceManagementSurfaces()로 전역 상태를 갱신하도록 수정. 기존 즉시 렌더만 하던 방식에서 서버 기준 상태 반영으로 전환.


- 2026-06-19: 봇 제작 화면 비작동 버튼 정비. `renderBuildAidotScreen()`에서 동작 없는 버튼/아이콘/메뉴 항목을 정리하고, 실제 바인딩 버튼만 남김. (`+ 의도/모듈 추가`, `학습문장 추가`, `학습문장 삭제`, `저장하기`, `저장 후 대화설계`, `대화 설계 저장`). `node --check apps/studio/app.js` 통과.

## 2026-06-19 14:35 KST

- `renderConfigureAidotScreen()` 일부 정리:
  - 봇 설정/구성 화면에서 동작 없는 버튼(설정 라디오 조작, 모듈 목록 열기, 플로팅 버튼/추천 의도 추가, 블록리스트/룰/스몰토크/봇스테이션 저장/연결 버튼)을 제거해 화면 오작동 느낌을 줄임.
  - 동작이 남아 있는 버튼/입력은 유지하고, 레이아웃 정합성만 정리(들여쓰기 정리).
- 점검:
  - `node --check apps/studio/app.js` 통과
  - `npm run studio:validate` 통과

## 2026-06-19 (continued)

- [동작 비검증 버튼 추가 정리] `renderAidotInteractiveTable`, 로그인 이력, API 화면, 봇 설정의 잔여 비작동 버튼/메뉴 제거:
  - `renderAidotInteractiveTable`: 조회 기본 버튼/초기화/페이지 크기/다운로드/페이저를 제거해 동작 없는 상단/하단 UI를 제거.
  - `renderLicenseSurface`: 라이선스 업로드 버튼 제거(호출 액션이 없어 단독 클릭 불가 상태였음).
  - `renderAccessPanels` 로그인 이력: `초기화/조회`와 페이지 크기 선택 제거.
  - `renderApiRegistry`: API 필터 아이콘, 더보기 버튼, 삭제 버튼, 정적 페이지네이션 제거.
  - 봇 설정: `모듈대화 목록` 비동작 버튼 제거.
- 점검:
  - `node --check apps/studio/app.js` 통과
  - `npm run studio:validate` 통과

## 2026-06-21 01:05 KST

### 최신 Aidot 100% 호환 작업 분할 계획 수립

- 신산님 지시에 따라 최신 Aidot 호환 작업을 한 번에 진행하지 않고 단계별로 분할하는 계획을 먼저 고정했다.
- 기준 참조본은 `D:\Project\cga\Aidot\apps`로 유지한다.
- 현재 판단:
  - 기존 `봇 다운로드/업로드` 축은 상당 부분 보강되었지만,
  - 최신 Aidot의 가장 큰 구조 변화인 `conversationHistory` 저장 구조와
  - 운영 조회 API(`/api/v1/admin/conversations`) 및
  - 해당 데이터를 읽는 운영 화면/WebChat 실증까지 포함하면
  - 아직 `100% 호환 완료`라고 판단하면 안 된다.
- 이번에 `docs/aidot-latest-parity-step-plan.md`를 추가해 아래 순서로 고정했다.
  - 1단계: 최신 Aidot 기준선 고정
  - 2단계: 검증 시나리오 고정
  - 3단계: 대화 이력 저장 구조 호환
  - 4단계: 운영 조회 API 호환
  - 5단계: CGA Studio 운영 화면 연결
  - 6단계: 최신 Aidot WebChat 실증
  - 7단계: 전체 회귀 검증
- 다음 작업은 계획서 기준으로 `1단계. 최신 Aidot 기준선 고정`부터 진행한다.

## 2026-06-21 01:18 KST

### Aidot-CGA 버전 단위 호환 운영 정책 초안 작성

- 신산님 요청에 따라 Aidot 개발자와 직접 논의할 수 있는 버전 호환 정책 문서를 작성했다.
- 신규 문서:
  - `docs/aidot-cga-version-compatibility-policy.md`
- 문서 핵심:
  - 제품 버전과 호환 계약 버전을 분리한다.
  - 기존 계약 버전은 수정하지 않고 새 계약 버전으로 추가한다.
  - Aidot는 하위호환을 기본 원칙으로 유지한다.
  - CGA는 자신이 지원하는 계약 버전만 명시적으로 처리한다.
  - 업로드/다운로드/WebChat/Admin 조회에도 `contract_version` 기준이 들어가야 한다.
- 이번 문서는 구현 코드가 아니라 Aidot 개발자와 CGA 개발자가 변경 규칙을 먼저 합의하기 위한 운영 정책 초안이다.

## 2026-06-21 01:42 KST

### CGA contract v1.0 갭 분석 문서 작성

- Aidot 측 합의 초안 `Aidot 1.1 / contract v1.0` 기준으로 CGA 현재 상태를 갭 분석했다.
- 신규 문서:
  - `docs/cga-contract-v1.0-gap-analysis.md`
- 현재 판단을 아래처럼 정리했다.
  - `Bot Package`: 기반은 있으나 `contract_version`과 상위 기능 처리 정책이 아직 부족
  - `Version Document`: Aidot형 구조는 반영됐지만 의미 보존과 계약 버전 메타가 미완
  - `WebChat`: 세션 생성/송수신은 구현됐지만 운영 이력 의미 계약까지는 미도달
  - `Admin Conversations`: `/api/v1/admin/conversations` 부재로 미충족
  - `Conversation History`: 실제 세션 transcript/발화/상태 의미 저장이 미충족
  - `contract_version`: 정책 문서만 있고 실 구현은 미충족
- 최상 우선 구현 항목도 같이 고정했다.
  - `contract_version` 메타데이터 반영
  - `conversationHistory` 저장 의미 계약 구현
  - `/api/v1/admin/conversations` 구현

## 2026-06-21 02:02 KST

### 상위 버전 봇 처리 원칙 반영

- 신산님과 합의한 핵심 원칙을 문서 기준으로 고정했다.
- 핵심 원칙:
  - 어떤 Aidot 버전의 봇이 오더라도 CGA가 보장할 수 있는 기능은 온전히 유지한다.
  - CGA 미지원 상위 기능은 제거 또는 무시한다.
  - 제거/무시로 핵심 의미가 깨지면 업로드를 차단한다.
- 반영 문서:
  - `docs/aidot-cga-version-compatibility-policy.md`
  - `docs/cga-contract-v1.0-gap-analysis.md`
- 이 원칙에 따라 앞으로 상위 버전 봇 import는 `제품 버전 차단`이 아니라
  - `지원 기능 추출`
  - `미지원 기능 제거/무시`
  - `핵심 의미 유지 여부 판정`
  순서로 설계해야 한다고 정리했다.

## 2026-06-21 02:18 KST

### contract_version 메타데이터 설계안 작성

- 다음 실제 구현 전에 `contract_version` 메타데이터 위치를 먼저 설계 문서로 고정했다.
- 신규 문서:
  - `docs/cga-contract-version-metadata-design.md`
- 설계 핵심:
  - bot export `manifest.contract_version`
  - version document top-level `contract_version`
  - import 요청의 `target_contract_version`
  - import 결과의 `resolved_contract_version`
  - 상위 기능 제거 내역 `pruned_features`
  - WebChat room/runtime 메타
  - `conversationHistory.contractVersion`
  - admin conversations API 응답 메타
- 구현 순서도 같이 정리했다.
  - 1단계: manifest/version document
  - 2단계: import 요청/응답
  - 3단계: WebChat/session/history
  - 4단계: admin conversations API

## 2026-06-21 02:31 KST

### contract_version 1단계 반영

- 설계안 기준으로 가장 영향이 적은 1단계만 먼저 구현했다.
- 반영 범위:
  - `packages/contracts/src/aidot-package-contract.js`
    - `AIDOT_CONTRACT_VERSION = "v1.0"` 추가
    - `AIDOT_SUPPORTED_CONTRACT_VERSIONS = ["v1.0"]` 추가
    - `createAidotPackageManifest()` 결과에
      - `contract_version`
      - `supported_contract_versions`
      를 포함하도록 보강
  - `apps/studio/app.js`
    - `buildAidotVersionDocument()` top-level에
      - `contract_version`
      - `supported_contract_versions`
      추가
  - `scripts/serve-studio.js`
    - version 샘플 export payload에도 같은 계약 메타 추가
  - `scripts/check-asset-transfer-api.mjs`
    - manifest 응답의 `contract_version`
    - version export payload의 `contract_version`
    - `supported_contract_versions`
    검증 추가
- 이번 단계 원칙:
  - Aidot 1.1 의미 필드는 건드리지 않고, 계약 메타만 additive하게 추가
  - import 요청/응답, WebChat/session, conversationHistory, admin conversations API 메타는 다음 단계로 분리
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `node --check scripts/serve-studio.js` 통과
  - `node --check scripts/check-asset-transfer-api.mjs` 통과
  - `npm run studio:asset-api-check` 통과

## 2026-06-21 02:44 KST

### contract_version 2단계 반영

- 설계안 기준 2단계인 import 요청/응답 메타를 반영했다.
- 반영 범위:
  - `packages/contracts/src/asset-transfer-api-contract.js`
    - `ASSET_TRANSFER_PRUNING_STATUS` 추가
    - `createAssetImportRequest()`에 `target_contract_version` 추가
    - `createAssetTransferResponse()`에
      - `resolved_contract_version`
      - `supported_contract_versions`
      - `pruning_status`
      - `pruned_features`
      추가
  - `scripts/serve-studio.js`
    - import 요청 헤더 `X-CGA-Target-Contract-Version`을 읽도록 보강
    - import 응답에 `resolved_contract_version = v1.0`
    - `pruning_status = none`
    - `pruned_features = []`
    를 내려주도록 연결
  - `scripts/check-asset-transfer-api.mjs`
    - dictionary/blocklist/bot/api/version/dialog import 응답에
      - `target_contract_version`
      - `resolved_contract_version`
      - `pruning_status`
      - `pruned_features`
      검증 추가
- 이번 단계 원칙:
  - 아직 실제 pruning 로직은 넣지 않고, 이후 상위 버전 봇 처리 로직이 들어갈 메타 골격만 먼저 고정
  - 현재 기본값은 `v1.0 / none / []`
- 검증:
  - `node --check packages/contracts/src/asset-transfer-api-contract.js` 통과
  - `node --check scripts/serve-studio.js` 통과
  - `node --check scripts/check-asset-transfer-api.mjs` 통과
  - `npm run studio:asset-api-check` 통과

## 2026-06-22 00:08 KST

### WebChat/session 메타와 conversationHistory 최소 저장 뼈대 반영

- 설계안 3단계 중 WebChat room/runtime 메타와 `conversationHistory` 최소 저장 구조를 먼저 반영했다.
- 반영 범위:
  - `scripts/serve-studio.js`
    - `loadWebchatRooms()` / `saveWebchatRooms()`에서 room 정규화 추가
    - room에
      - `contract_version`
      - `supported_contract_versions`
      - `bot_version_id`
      - `conversationHistory`
      를 유지하도록 보강
    - `serializeWebchatRoom()` 응답에
      - `contractVersion`
      - `supportedContractVersions`
      추가
    - room 생성/메시지 송수신/삭제 시 `conversationHistory`를 같이 갱신하도록 보강
    - 현재 저장되는 최소 의미:
      - `session_id`, `room_id`, `client_room_id`
      - `participant_id`, `participant_name`
      - `channel_type`, `room_status`
      - `bot_id`, `bot_version_id`
      - `started_at`
      - `first_user_utterance`
      - `user_utterances`, `user_raw_utterances`
      - `transcript`
      - `user_message_count`, `message_count`
      - `last_message_at`, `last_user_message_at`
      - `latest_intent_name`
      - `dialog_ended`, `session_ended`
      - `completion_reason`, `ended_at`, `session_end_reason`
      - `contractVersion`, `sourceProductVersion`, `compatibilityStatus`, `prunedFeatures`
    - WebChat message 응답 `runtime`에 `resolvedContractVersion = v1.0` 추가
  - `scripts/check-webchat-channel-api.mjs`
    - room 응답의 `contractVersion`
    - `supportedContractVersions`
    - message/legacy message 응답의 `runtime.resolvedContractVersion`
    검증 추가
- 이번 단계 의미:
  - 아직 `/api/v1/admin/conversations`는 없지만, 이후 운영 조회 API가 읽어갈 수 있는 room/session 저장 뼈대가 먼저 생김
  - 현재는 WebChat 축만 반영했고, simulator 병합과 운영 조회 응답 구성은 다음 단계로 남음
- 검증:
  - `node --check scripts/serve-studio.js` 통과
  - `node --check scripts/check-webchat-channel-api.mjs` 통과
  - `npm run studio:webchat-channel-check` 통과

## 2026-06-22 00:24 KST

### `/api/v1/admin/conversations` 최소 구현

- `Aidot 1.1 / contract v1.0` 기준으로 운영 조회 최소 Required 범위인 `/api/v1/admin/conversations`를 구현했다.
- 반영 범위:
  - `scripts/serve-studio.js`
    - `/api/v1/admin/conversations` 경로 파서 추가
    - WebChat room 기준 세션 행 생성 로직 추가
    - simulator `operations-state.test.last_run_at` 기준 세션 행 생성 로직 추가
    - 응답 구조:
      - `items`
      - `total`
    - 각 row 최소 필드:
      - `id`
      - `group_name`
      - `channel_name`
      - `bot_name`
      - `version_no`
      - `user_key`
      - `intent_or_module_name`
      - `uttered_at`
      - `result`
      - `data_json`
    - `data_json`에는 아래를 포함하도록 구성
      - `contract_version`
      - `compatibility_status`
      - `pruned_features`
      - `session_*`
      - `runtime_summary`
      - `messages`
      - `conversation_history`
      - `transcript`
      - `latest_problem_event`
      - `problem_location`
  - `scripts/check-admin-conversations-api.mjs`
    - WebChat 세션 생성/메시지 송신
    - simulator `run-test`
    - `/api/v1/admin/conversations` 조회
    - WebChat/Simulator 두 행 모두 존재하는지 검증
    - `contract_version`, transcript, 사용자 발화, 필터 동작 검증
  - `package.json`
    - `studio:admin-conversations-check` 스크립트 추가
- 현재 범위:
  - WebChat + Simulator 병합까지는 반영
  - 고급 분석 필드나 상세 팝업용 추가 메타는 이후 확장 가능
- 검증:
  - `node --check scripts/serve-studio.js` 통과
  - `node --check scripts/check-admin-conversations-api.mjs` 통과
  - `npm run studio:admin-conversations-check` 통과

## 2026-06-22 00:31 KST

### Studio 대화 이력 조회 화면 실제 API 연결

- `apps/studio/app.js`의 `대화 이력 조회` 화면을 샘플 행 기반에서 실제 `/api/v1/admin/conversations` 조회 기반으로 전환했다.
- 반영 내용:
  - `currentConversationHistoryState` 상태 추가
  - 최초 진입 시 서버에서 대화 이력 조회
  - 서버 응답 `items`를 화면 row로 정규화
  - 기존 필터(`채널`, `시작일`, `종료일`)를 실제 서버 결과에 적용
  - 조회 중/오류 상태 표시 추가
- 이번 단계 의미:
  - 이제 Studio 대화 이력 조회는 고정 샘플이 아니라 실제 WebChat/Simulator 세션 데이터를 본다.
  - 상세 팝업 연결 전 단계까지는 실데이터 기반 운영 조회 흐름이 만들어졌다.
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `npm run studio:admin-conversations-check` 통과
  - `npm run studio:webchat-channel-check` 통과

## 2026-06-22 00:52 KST

### 상위 버전 봇 import pruning 1차 반영

- `어떤 Aidot 버전이 오더라도 CGA 보장 기능은 유지하고, 미지원 상위 기능은 제거/무시하며, 핵심 의미 손실 시 차단` 원칙에 따라 pruning 1차 로직을 넣었다.
- 반영 범위:
  - `scripts/serve-studio.js`
    - import 시 JSON payload의 `contract_version` 확인
    - `source contract > target contract(v1.0)`이면 pruning 경고를 남기도록 보강
    - 1차 pruning 대상:
      - `advanced_analytics`
      - `external_channels`
      - `kakao_channel`
      - `kakao_channel_config`
      - `channel_extensions`
      - `extended_rich_ui`
      - `rich_cards_v2`
      - `system_config.channels`의 미지원 상위 키
      - `system_config.channels.kakaoKr`의 비허용 활성값
    - import 응답 메타에
      - `pruning_status`
      - `pruned_features`
      - `warnings`
      반영
    - 저장되는 body도 sanitize된 결과로 저장되도록 보강
  - `apps/studio/app.js`
    - asset upload 시 import 응답 메타를 읽어
      - `contract v1.0`
      - 제거/무시된 기능 목록
      - 경고 건수
      를 상태 문구에 표시하도록 보강
    - 업로드 요청 헤더 `X-CGA-Target-Contract-Version = v1.0` 추가
  - `scripts/check-asset-transfer-api.mjs`
    - `contract_version = v1.1` + 상위 기능 포함 version import 케이스 추가
    - 기대 검증:
      - `pruning_status = pruned`
      - `pruned_features`에 상위 기능 포함
      - re-export 시 상위 기능 제거
      - `kakaoKr`는 `disabled`
      - 미지원 채널 키 제거
- 현재 범위:
  - 아직 핵심 의미 손실 판정에 따른 `blocked` 로직까지는 안 갔고, 1차는 `경고 + 제거/무시 후 accepted` 중심
  - 의미 손실 차단 기준표는 다음 단계에서 더 구체화 가능
- 검증:
  - `node --check scripts/serve-studio.js` 통과
  - `node --check apps/studio/app.js` 통과
  - `node --check scripts/check-asset-transfer-api.mjs` 통과
  - `npm run studio:asset-api-check` 통과

## 2026-06-22 01:09 KST

### 상위 버전 import blocked 판정 1차 반영

- `경고 + 제외 후 업로드` 기본 정책은 유지하되, `제외 후에도 contract v1.0 핵심 의미를 복원할 수 없는 경우만 차단`하도록 서버 판정을 보강했다.
- 반영 범위:
  - `scripts/serve-studio.js`
    - `version`, `bot`, `dialog` JSON import에 대해 v1.0 핵심 의미 존재 여부를 점검하는 판정 추가
    - 차단 기준은 매우 보수적으로 적용
      - `version`: 봇 메타/대화 자산/런타임 자산이 모두 사라진 경우만 blocked
      - `bot`: 봇 메타/대화 자산/런타임 자산이 모두 사라진 경우만 blocked
      - `dialog`: dialog 식별 정보와 flow graph가 모두 사라진 경우만 blocked
    - blocked일 때는 저장하지 않고 import 응답에
      - `status = blocked`
      - `pruning_status = blocked`
      - `errors`
      를 내려주도록 연결
    - asset transfer history에도 blocked 시도와 사유가 남도록 보강
  - `apps/studio/app.js`
    - 업로드 상태 문구에 `업로드 차단`, 차단 사유, 차단 전 제거 검토 기능 목록이 보이도록 보강
  - `scripts/check-asset-transfer-api.mjs`
    - 상위 버전 기능만 있고 v1.0 핵심 자산이 없는 version import 케이스를 추가
    - 기대 검증:
      - `status = blocked`
      - `pruning_status = blocked`
      - `errors` 존재
      - history에 blocked import 기록 존재
- 이번 단계 의미:
  - 이제 상위 버전 봇/버전 문서를 무조건 accepted 하지 않고,
  - `CGA가 실제로 v1.0 의미를 유지할 수 있는지`를 최소 범위에서 판정하기 시작했다.
  - 아직 기능별 blocked 기준표 전체를 다 채운 것은 아니고, 우선 `version/bot/dialog` 핵심 대화 의미 축만 1차 반영했다.

## 2026-06-22 01:26 KST

### WebChat conversation history 의미 호환 보강

- Aidot 최신 테스트/화면 코드를 기준으로 WebChat 대화 이력의 `사람이 읽을 수 있는 표시 의미(display_text)` 축을 다시 맞췄다.
- 확인한 Aidot 기준:
  - `webchatRichFormVersion` 형태의 사용자 응답은 원문 JSON이 아니라 `버튼 선택: ...`, `선택: ...`, `입력: ...` 형태로 `user_utterances`와 `transcript.display_text`에 저장한다.
  - 봇 RichForm 응답은 payload 기준으로 제목/본문/옵션을 요약한 문자열을 `display_text`로 남긴다.
  - 운영 조회 화면은 `conversation_history.transcript[*].display_text`, `payload_json`, `session_first_user_utterance`, `session_user_utterances`를 실제 표시 기준으로 사용한다.
- 반영 범위:
  - `scripts/serve-studio.js`
    - JSON-like 문자열 파싱, readable string 추출, WebChat 선택 응답 요약, RichForm payload 요약 헬퍼 추가
    - transcript row에
      - `message_type`
      - `payload_json`
      - `display_text`
      저장
    - 사용자 발화 누적은 raw JSON이 아니라 readable text 기준으로 `user_utterances`에 저장
    - `user_raw_utterances`는 기존처럼 원문 유지
    - 운영 조회 `data_json`에 `queue_event_id` 기본 메타 보강
  - `scripts/check-webchat-channel-api.mjs`
    - 일반 텍스트 대화 후 RichForm 선택형 JSON 메시지를 한 번 더 보내고,
    - `/api/v1/admin/conversations`에서
      - `session_user_utterances`에 `버튼 선택: BUTTON`
      - `conversation_history.transcript[*].display_text`
      가 저장됐는지 검증 추가
- 이번 단계 의미:
  - 이제 CGA의 WebChat 이력 저장은 단순 원문 저장이 아니라, Aidot 운영 화면이 기대하는 `읽을 수 있는 대화 의미`에 더 가깝게 맞춰졌다.

## 2026-06-22 01:39 KST

### Admin Conversations 상세 팝업 표시 키 정렬

- Aidot `admin/conversations` 화면 코드를 기준으로 상세 팝업이 직접 읽는 top-level 키를 다시 정렬했다.
- 확인한 갭:
  - `runtime_summary`가 객체로 들어가면 Aidot 화면에서 문자열로 처리될 때 `[object Object]`가 될 수 있었음.
  - `completion_reason`, `dialog_ended`, `session_ended`, `room_id`, `client_room_id`는 `conversation_history` 안에는 있었지만, Aidot 상세 팝업은 `data_json` top-level에서도 직접 읽고 있었음.
- 반영 범위:
  - `scripts/serve-studio.js`
    - WebChat row:
      - `runtime_summary`를 문자열 요약으로 저장
      - 기존 구조성 정보는 `runtime_diagnostics`로 분리
      - `session_ended`, `dialog_ended`, `completion_reason`, `room_id`, `client_room_id`, `runtime_events`를 top-level에 보강
    - Simulator row도 같은 방식으로 문자열 요약과 top-level 메타를 맞춤
  - `scripts/check-admin-conversations-api.mjs`
    - WebChat/Simulator row 각각에 대해
      - `runtime_summary`
      - `completion_reason`
      - `dialog_ended`
      - `session_ended`
      - `room_id`
      - `client_room_id`
      검증 추가
- 이번 단계 의미:
  - 이제 CGA의 `/api/v1/admin/conversations` 응답은 Aidot 운영 화면이 목록뿐 아니라 상세 팝업에서도 그대로 읽기 쉬운 형태에 더 가까워졌다.

## 2026-06-22 01:53 KST

### runtime_events 최소 의미 계약 보강

- Aidot 상세 팝업의 `변수 변경 추적` 섹션이 실제로 읽는 `runtime_events[*].data.updatedVariables / valuePreviews` 최소 shape를 CGA 응답에도 넣기 시작했다.
- 반영 범위:
  - `scripts/serve-studio.js`
    - `conversationHistory.runtime_events` 기본 배열 추가
    - WebChat 메시지 처리 시 synthetic runtime event 3종 추가
      - `channel.runtime.intent_matched`
      - `channel.runtime.talk_response_stored`
      - `channel.runtime.completed`
    - 각 event에
      - `data.updatedVariables`
      - `data.valuePreviews`
      - `queueEventId`
      를 포함
    - Simulator row도 같은 최소 이벤트 구조를 파생 생성
    - `/api/v1/admin/conversations` 응답의 `runtime_events`에 WebChat/Simulator 이벤트가 실제 포함되도록 연결
  - `scripts/check-admin-conversations-api.mjs`
    - WebChat/Simulator row 모두
      - `runtime_events` 존재
      - `updatedVariables`
      - `valuePreviews.$matchedIntent`
      를 검증 추가
- 이번 단계 의미:
  - 아직 Aidot 엔진의 전체 runtime trace를 모두 재현한 것은 아니지만,
  - 상세 팝업의 변수 변경 추적 섹션이 최소한 의미 있는 데이터로 열릴 수 있는 기반을 만들었다.

## 2026-06-22 02:04 KST

### Admin conversations `messages` 배열 snake_case 정규화

- Aidot `admin/conversations` 화면은 `conversation_history.transcript`를 우선 사용하지만, fallback `messages` 배열도 `participant_kind`, `participant_name`, `created_at`, `payload_json`, `display_text` 기준으로 읽는다.
- 확인한 갭:
  - CGA WebChat `messages`는 camelCase(`participantKind`, `createdAt`)가 섞여 있었음
  - Simulator `messages`도 transcript와 달리 `display_text`, `payload_json`이 비어 있었음
- 반영 범위:
  - `scripts/serve-studio.js`
    - `serializeAdminConversationMessage()` 헬퍼 추가
    - WebChat row의 `data_json.messages`를 Aidot형 snake_case 메시지 배열로 변환
    - Simulator row의 `data_json.messages`도 transcript 기반 snake_case 배열로 정규화
  - `scripts/check-admin-conversations-api.mjs`
    - WebChat/Simulator 각각에 대해
      - `messages[*].participant_kind`
      - `messages[*].display_text`
      검증 추가
- 이번 단계 의미:
  - 이제 `/api/v1/admin/conversations` 응답은 transcript뿐 아니라 fallback messages 배열까지 Aidot 화면이 기대하는 메시지 shape에 더 가깝게 맞춰졌다.

## 2026-06-22 02:16 KST

### CGA WebChat 클라이언트 연결 흐름 보강

- CGA `apps/webchat` 클라이언트는 기존에 단순 `bootstrap -> room 생성 -> 메시지 송신` 흐름만 가지고 있어, Aidot 최신 webchat의 `connect -> room list -> room detail -> 없으면 create` 흐름과 차이가 있었다.
- 반영 범위:
  - `apps/webchat/app.js`
    - backend message를 snake_case/camelCase 모두 읽는 `normalizeBackendMessage()` 추가
    - 초기 연결 시 `POST /api/v1/channels/webchat/connect` 호출
    - 이후 `GET /api/v1/channels/webchat/rooms?participant_id=...`로 기존 room 조회
    - 같은 봇의 open room이 있으면 `GET /api/v1/channels/webchat/rooms/{id}`로 복원
    - 없을 때만 새 room 생성
    - bot message 렌더도 `display_text` 우선으로 읽도록 보강
  - `scripts/check-webchat-channel-api.mjs`
    - room 생성 후
      - room list
      - room detail
      가 정상 응답하는지 검증 추가
- 이번 단계 의미:
  - 아직 Aidot 최신 webchat UI 전체를 복제한 것은 아니지만,
  - CGA 자체 WebChat 클라이언트도 Aidot가 기대하는 채널 연결/복원 흐름에 한 단계 더 가까워졌다.

## 2026-06-22 02:24 KST

### WebChat 응답 해석 우선순위 정리

- Aidot webchat은 room 생성/복원/메시지 응답에서 `messages`, `botMessages`, `initialMessages`, `botMessage`를 상황별로 다르게 내려줄 수 있다.
- CGA `apps/webchat` 클라이언트는 이 우선순위를 부분적으로만 처리하고 있었기 때문에, 응답 해석 규칙을 helper로 고정했다.
- 반영 범위:
  - `apps/webchat/app.js`
    - `resolveInitialMessages()` 추가
    - 초기 room 복원/생성 시
      - `messages`
      - `botMessages`
      - `initialMessages`
      - `botMessage`
      순서로 메시지를 해석
    - room detail이 `closed` 상태면 그 room을 재사용하지 않고 새 room 생성 흐름으로 진행
    - 메시지 전송 응답도 같은 helper로 해석하도록 정리
- 이번 단계 의미:
  - CGA WebChat 클라이언트는 이제 Aidot backend 응답 형태가 조금 달라도 더 안정적으로 같은 사용자 흐름을 유지할 수 있다.

## 2026-06-22 02:36 KST

### Studio version package 확장 메타 보존 보강

- 남아 있던 round-trip 리스크 중 하나는 `Studio 화면에서 version package를 업로드한 뒤 다시 다운로드할 때`, CGA가 직접 이해하지 않는 확장 메타를 잃어버릴 수 있다는 점이었다.
- 반영 범위:
  - `apps/studio/app.js`
    - `currentVersionDocumentExtraFields`
    - `currentVersionSystemConfigExtraFields`
    - `currentVersionLegacyExtraFields`
    상태 추가
    - version package import 시
      - top-level 미인식 키
      - `system_config` 내부 미인식 키
      - `version` 내부 미인식 키
      를 별도 보존
    - version package export 시 위 확장 메타를 다시 합쳐서 내보내도록 보강
- 이번 단계 의미:
  - CGA가 직접 쓰는 핵심 필드(`dialogs`, `system_config.bot`, `counts`, `llm`, `channels`)는 계속 정상 처리하고,
  - Aidot 쪽 확장 메타는 가능한 한 손실 없이 유지하는 방향으로 round-trip 안정성을 높였다.
- 검증:
  - `node --check apps/studio/app.js` 문법 검사로 1차 확인
  - 이 변경은 browser runtime 상태 보존 성격이라 별도 시나리오 검증은 다음 round-trip 점검 단계에서 이어서 확인 예정

## 2026-06-22 02:44 KST

### 확장 메타 snapshot/컨텍스트 전환 보강

- 앞 단계 보강만으로는 메모리 상태에서는 유지되지만, 새로고침/봇 전환 시 확장 메타가 사라지거나 다른 봇으로 섞일 수 있는 리스크가 있었다.
- 반영 범위:
  - `apps/studio/app.js`
    - workspace snapshot 저장 시 `version_asset_metadata` 추가
    - snapshot 복원 시
      - `document_extra_fields`
      - `system_config_extra_fields`
      - `legacy_version_extra_fields`
      복원
    - `applyCurrentBotToStudioState()`, `applyAidotBotPackage()`에서 봇 컨텍스트가 바뀔 때 확장 메타를 기본 초기화
- 이번 단계 의미:
  - 이제 version package 확장 메타는
    - import 후 메모리 상태
    - workspace snapshot 저장/복원
    - 봇 전환 시 오염 방지
    까지 한 세트로 묶여서 더 안전해졌다.

## 2026-06-22 03:02 KST

### version asset metadata 분리 검증 추가

- 직전 단계에서 `apps/studio/data/version-asset-metadata.js`로 분리한 helper가 실제로 round-trip 되는지 고정 검증이 없어서, 회귀 방지용 체크를 추가했다.
- 반영 범위:
  - `scripts/check-version-asset-metadata.mjs`
    - 빈 상태 기본값 검증
    - clone deep copy 검증
    - snapshot build/read round-trip 검증
    - 비정상 입력 배열/문자열/null 정규화 검증
  - `package.json`
    - `studio:version-asset-metadata-check` 스크립트 추가
    - `studio:validate`에 위 검증 포함
- 이번 단계 의미:
  - 이제 version package 확장 메타 보존 로직은 단순 문법 검사만이 아니라, snapshot 저장/복원과 deep copy 의미까지 자동 확인된다.

## 2026-06-22 03:18 KST

### WebChat room 재생성 시 `client_room_id` 재사용 호환 보강

- Aidot 최신 채널 API를 다시 대조한 결과, 같은 `client_room_id`로 `POST /api/v1/channels/webchat/rooms`가 다시 들어오면 기존 open room을 재사용하는 규칙이 있었고, CGA는 이 동작이 약해 중복 room이 생길 수 있는 갭이 있었다.
- 반영 범위:
  - `scripts/serve-studio.js`
    - room 생성 전에 같은 `client_room_id` 기존 room 탐색 추가
    - 기존 room이 같은 bot/version의 open room이면 새 room을 만들지 않고 기존 room 그대로 반환
    - 같은 `client_room_id`지만 bot/version이 달라진 경우 기존 room은 `closed` 처리 후 새 room 생성
  - `scripts/check-webchat-channel-api.mjs`
    - 같은 `client_room_id`로 room 생성 요청을 한 번 더 보내고, 동일 room id가 재사용되는지 검증 추가
- 이번 단계 의미:
  - CGA WebChat backend는 이제 Aidot webchat이 기대하는 `중복 생성 대신 세션 재사용` 흐름에 더 가깝게 맞춰졌다.

## 2026-06-22 03:27 KST

### 상위 버전 version import 후 unknown field round-trip 검증 보강

- 상위 버전 import에서 `제거 대상 기능은 빠지고, 미지원이 아닌 확장 필드는 다시 내려와야 한다`는 원칙을 검증으로 고정했다.
- 반영 범위:
  - `scripts/check-asset-transfer-api.mjs`
    - `contract_version = v1.1` version import 케이스에
      - top-level unknown field
      - `system_config` unknown field
      - legacy `version` unknown field
      를 추가
    - re-export 시 위 3종이 그대로 남는지 검증 추가
    - 동시에 기존 pruning 대상인
      - `advanced_analytics`
      - `system_config.channels.kakaoKr`
      - `system_config.channels.teams`
      는 계속 제거/비활성 처리되는지 유지 검증
- 이번 단계 의미:
  - 이제 CGA는 `상위 버전 봇을 무조건 축소 저장`하는 것이 아니라,
  - `v1.0 의미를 깨지 않는 확장 메타는 최대한 보존`한다는 규칙까지 자동 검증으로 묶였다.

## 2026-06-22 03:39 KST

### CGA WebChat 클라이언트의 Aidot형 연결/fallback 흐름 보강

- CGA `apps/webchat`는 이미 기본 송수신은 가능했지만, Aidot 최신 webchat에 비해 여전히 legacy bootstrap 의존이 남아 있었다.
- 반영 범위:
  - `apps/webchat/app.js`
    - 초기 연결 시 `connect` 응답의 `bots`를 우선 사용하도록 정리
    - `connect` 응답에 봇 목록이 없을 때만 `/api/v1/channels/webchat/bots`로 fallback
    - 마지막 fallback으로만 legacy `/api/v1/webchat/bootstrap` 사용
    - 기존 open room 복원 시 room detail 조회 실패가 나면 그대로 죽지 않고 새 room 생성 흐름으로 넘어가도록 보강
  - `apps/webchat/index.html`
    - `app.js` 캐시 버전 문자열 갱신
- 이번 단계 의미:
  - CGA 자체 WebChat 화면도 Aidot 최신 webchat이 사용하는 `connect -> bots -> rooms/detail` 축에 더 가까워졌고,
  - legacy bootstrap은 필수가 아니라 하위호환 fallback 역할로만 남게 됐다.

## 2026-06-22 03:47 KST

### 간단형 CGA WebChat의 `sessionEnded` 반영 보강

- 간단형 `apps/webchat` 화면은 기본 송수신은 가능했지만, Aidot 최신 webchat처럼 message 응답의 `runtime.sessionEnded`를 즉시 반영하지는 못하고 있었다.
- 반영 범위:
  - `apps/webchat/app.js`
    - `sendMessage()`에서 `runtime.sessionEnded === true`를 감지하면
      - 현재 `roomId`를 비우고
      - 상단 상태를 `세션 종료`로 갱신하고
      - `completionReason`이 있으면 런타임 노트에 함께 표시하고
      - 시스템 메시지로 새 채팅방 생성 안내를 남기도록 보강
- 이번 단계 의미:
  - 간단형 CGA WebChat도 이제 Aidot 최신 webchat처럼 `세션 종료 응답 -> 입력 중단 -> 새 세션 유도` 흐름에 더 가깝게 동작한다.

## 2026-06-22 03:58 KST

### 간단형 CGA WebChat의 richer payload 최소 수용성 보강

- 간단형 `apps/webchat`는 기존에 bot message를 거의 `text`만 표시하고 있어서, Aidot 계열 richer payload가 와도 대화 흐름을 이어받는 최소 장치가 필요했다.
- 반영 범위:
  - `apps/webchat/app.js`
    - message 정규화 시
      - `payload_json` / `payload`
      - `options`
      - `sourceTalkNodeId`
      를 같이 읽도록 보강
    - rich form / adaptive / table를 전부 그리지는 않더라도,
      - `display_text` 우선 표시
      - 텍스트가 부족하면 payload 요약 문구 표시
      - `options`가 있으면 후속 클릭 버튼으로 렌더
      - 버튼 클릭 시 `source_talk_node_id`를 함께 다시 송신
    - 전송 중 상태 플래그를 추가해 옵션 버튼 중복 클릭을 줄이도록 보강
  - `apps/webchat/styles.css`
    - payload note / option button 최소 스타일 추가
  - `apps/webchat/index.html`
    - css/js 캐시 버전 문자열 갱신
- 이번 단계 의미:
  - 간단형 CGA WebChat은 아직 Aidot full rich UI를 복제한 것은 아니지만,
  - richer bot message가 와도 최소한 `읽기`, `후속 선택`, `다음 요청 전달`이 끊기지 않는 방향으로 한 단계 더 안정화됐다.

## 2026-06-22 04:07 KST

### simple WebChat rich message 정규화 로직 분리 및 자동 검증 추가

- 방금 보강한 richer payload 수용 로직이 이후에도 깨지지 않도록, simple webchat의 message 정규화 부분을 순수 함수로 분리하고 자동 검증에 포함했다.
- 반영 범위:
  - `apps/webchat/message-shape.js`
    - `extractMessageOptions()`
    - `summarizePayload()`
    - `normalizeBackendMessage()`
    를 분리
  - `apps/webchat/app.js`
    - 위 helper import로 교체해 UI 본체와 message shape 판단 로직을 분리
  - `scripts/check-webchat-message-shape.mjs`
    - Aidot형 샘플 메시지 기준으로
      - payload options 추출
      - table summary
      - rich form summary
      - adaptive card summary
      - `sourceTalkNodeId` 보존
      - plain text fallback
      을 검증
  - `package.json`
    - `studio:webchat-message-shape-check` 추가
    - `studio:validate`에 포함
- 이번 단계 의미:
  - 이제 simple webchat의 richer message 수용성은 수동 확인이 아니라 자동 검증 경로로 들어갔다.

## 2026-06-22 04:18 KST

### server response -> simple webchat normalize 브리지 검증 추가

- rich message 정규화 helper만 따로 검증하는 것으로는 부족해서, 실제 CGA 서버 응답이 simple webchat helper까지 자연스럽게 이어지는지 확인하는 브리지 검증을 추가했다.
- 반영 범위:
  - `scripts/serve-studio.js`
    - 테스트용 예약 문구 `__CGA_RICH_OPTIONS__` 입력 시
      - `messageType = form`
      - `options`
      - `payload_json.richForm`
      - `payload_json.sourceTalkNodeId`
      를 가진 Aidot형 샘플 bot message를 반환하도록 보강
  - `scripts/check-webchat-channel-api.mjs`
    - 위 rich sample 응답의 `messageType`, `options`, `sourceTalkNodeId`를 직접 검증 추가
  - `scripts/check-webchat-message-bridge.mjs`
    - 실제 서버에 room 생성/메시지 전송 후
    - 응답 bot message를 `normalizeBackendMessage()`에 바로 넣어
    - simple webchat이 기대하는 정규화 결과가 나오는지 검증 추가
  - `package.json`
    - `studio:webchat-message-bridge-check` 추가
    - `studio:validate`에 포함
- 이번 단계 의미:
  - 이제 `server response -> client normalize` 축도 자동 검증으로 묶였다.

## 2026-06-22 04:27 KST

### rich sample의 운영 조회 표시 의미 검증 보강

- 다음 단계로, simple webchat용 rich sample이 운영 조회(`/api/v1/admin/conversations`) 축에서도 의미를 잃지 않는지 확인했다.
- 반영 범위:
  - `scripts/check-admin-conversations-api.mjs`
    - 기존 webchat 세션에 `__CGA_RICH_OPTIONS__` rich sample 메시지를 추가로 전송
    - 운영 조회 응답의
      - `data_json.messages`
      - `data_json.conversation_history.transcript`
      에서
        - `message_type = form`
        - `display_text`
        - `payload_json.options`
        - `payload_json.sourceTalkNodeId`
      를 직접 검증 추가
  - `scripts/serve-studio.js`
    - `summarizeRichformPayload()`가 `payload_json.options`를 함께 읽도록 보강
    - `conversationHistoryDisplayText()`가 rich payload의 제목/옵션 요약을 우선 반영하도록 보강
- 이번 단계 의미:
  - 이제 rich sample은
    - 채널 응답
    - simple webchat normalize
    - 운영 조회 messages/transcript
    까지 한 줄로 이어지는 검증 경로를 갖게 됐다.

## 2026-06-22 04:36 KST

### Aidot 1.1형 version round-trip fixture 파일 분리

- `version import/export` 검증이 코드 안의 인라인 JSON 조립에 너무 의존하고 있어서, 이후 Aidot 쪽 변경과 직접 대조하기 쉽도록 fixture 파일로 분리했다.
- 반영 범위:
  - `scripts/fixtures/aidot-version-uploaded.json`
    - Aidot 1.1형 기본 version round-trip 샘플 추가
  - `scripts/fixtures/aidot-version-higher-v1_1.json`
    - 상위 버전 pruning/unknown field 보존 검증용 샘플 추가
  - `scripts/check-asset-transfer-api.mjs`
    - 위 fixture JSON을 읽어서 import 검증에 사용하도록 변경
  - `scripts/check-api-answer-api.mjs`
    - 전체 validate 중 간헐적으로 보이던 포트 충돌/기동 플래키성을 줄이기 위해 테스트 포트 범위를 크게 확장
- 이번 단계 의미:
  - 이제 `version` 검증은 코드 안에서 임의로 조립한 payload가 아니라, 별도 fixture 문서를 기준으로 round-trip을 확인한다.

## 2026-06-22 04:44 KST

### bot/dialog package도 fixture 파일 기준으로 전환

- version만 fixture 파일 기준으로 두면 반쪽이라, `bot`과 `dialog` package도 같은 방식으로 분리했다.
- 반영 범위:
  - `scripts/fixtures/aidot-bot-uploaded.json`
    - bot package round-trip 검증용 Aidot형 샘플 추가
  - `scripts/fixtures/aidot-dialog-password-reset.json`
    - dialog package round-trip 검증용 Aidot형 샘플 추가
  - `scripts/check-asset-transfer-api.mjs`
    - bot/dialog import 검증도 fixture JSON을 읽도록 변경
- 이번 단계 의미:
  - 이제 `version`, `bot`, `dialog` 핵심 package 검증은 모두 fixture 문서 기준으로 동작한다.

## 2026-06-22 04:52 KST

### api package도 fixture 파일 기준으로 전환

- `api` import/export 검증도 인라인 JSON 의존을 줄이고 fixture 문서 기준으로 고정했다.
- 반영 범위:
  - `scripts/fixtures/aidot-api-uploaded.json`
    - 기본 API round-trip 샘플 추가
  - `scripts/fixtures/aidot-api-only-custom.json`
    - `apis` 배열만 있는 케이스 샘플 추가
  - `scripts/fixtures/aidot-api-alias-custom.json`
    - alias 필드명(`apiName`, `destinationBaseUrl`, `authType`, `jsonPath` 등) 검증용 샘플 추가
  - `scripts/check-asset-transfer-api.mjs`
    - 위 3종 fixture를 읽어 API import 검증에 사용하도록 변경
- 이번 단계 의미:
  - 이제 `version`, `bot`, `dialog`, `api` 핵심 package 검증이 모두 fixture 문서 기준으로 정리됐다.

## 2026-06-22 04:58 KST

### dictionary / blocklist 텍스트 자산도 fixture 파일 기준으로 전환

- 남아 있던 인라인 전송 포맷 중 `dictionary`, `blocklist` 텍스트 업로드 샘플도 fixture 파일로 분리했다.
- 반영 범위:
  - `scripts/fixtures/aidot-dictionary-uploaded.txt`
    - dictionary import 검증용 TXT 샘플 추가
  - `scripts/fixtures/aidot-blocklist-uploaded.txt`
    - blocklist import 검증용 TXT 샘플 추가
  - `scripts/check-asset-transfer-api.mjs`
    - text fixture loader 추가
    - dictionary/blocklist import 검증이 위 TXT fixture를 읽도록 변경
- 이번 단계 의미:
  - 이제 핵심 asset transfer 검증은 JSON package뿐 아니라 대표 TXT 자산까지 fixture 문서 기준으로 정리됐다.

## 2026-06-22 05:06 KST

### Aidot 1.1 호환 검증 범위 매트릭스 문서 추가

- 자동 검증 범위가 꽤 넓어져서, 현재 CGA가 Aidot 1.1과 어디까지 맞춰졌는지 운영 기준 문서로 한 번 고정했다.
- 반영 범위:
  - `docs/aidot-1.1-compatibility-coverage-matrix.md`
    - `자동 검증됨 / 부분 검증 / 수동 확인 필요` 상태 구분 추가
    - package transfer, WebChat API, simple webchat normalize, admin conversations, version asset metadata 범위를 표로 정리
    - 현재 fixture 자산 목록 정리
    - 현재 판단과 남은 수동 확인 범위 정리
- 이번 단계 의미:
  - 이제 “무엇이 이미 자동 검증되고 있고, 무엇이 아직 수동 확인 범위인지”를 문서로 바로 설명할 수 있게 됐다.

## 2026-06-22 05:18 KST

### WebChat session ended 흐름도 자동 검증 범위로 승격

- `runtime.sessionEnded`는 코드상 반영돼 있었지만, 전용 검증 시나리오가 없어서 매트릭스상 `부분 검증`으로 남아 있었다.
- 반영 범위:
  - `scripts/serve-studio.js`
    - `__CGA_SESSION_END__` 테스트 전용 입력 추가
    - 해당 입력 시 `sessionEnded=true`, `completionReason=session_ended`, room `closed`, `session_end_reason=user_requested_end`가 저장되도록 반영
  - `scripts/check-webchat-session-ended.mjs`
    - 종료 응답 메타
    - room detail의 `closed` 상태
    - admin conversations의 `session_ended`, `completion_reason`, `room_status`
    - 동일 `client_room_id` 재진입 시 새 room 생성
    - 까지 한 번에 확인하는 검증 스크립트 추가
  - `package.json`
    - `studio:webchat-session-ended-check` 추가
    - `studio:validate`에 포함
  - `docs/aidot-1.1-compatibility-coverage-matrix.md`
    - Simple WebChat 종료 흐름 상태를 `자동 검증됨`으로 상향
- 이번 단계 의미:
  - 이제 WebChat 종료 처리도 단순 코드 존재 수준이 아니라 실제 종료 응답, room 상태 전환, 운영 이력 반영, 재진입 동작까지 자동 검증 기준으로 관리할 수 있게 됐다.

## 2026-06-22 05:33 KST

### Studio 대화 이력 조회 UI wiring 검증 추가 및 날짜 필터 버그 수정

- `대화 이력 조회` 화면은 API 자체는 맞게 붙어 있었지만, 시작일/종료일 변경 시 화면이 다시 그려지지 않아 날짜 필터가 즉시 반영되지 않는 버그가 있었다.
- 반영 범위:
  - `apps/studio/app.js`
    - `data-history-start-date`, `data-history-end-date` change 이벤트에서 상태만 바꾸지 않고 `renderConversationHistorySurface(surface)`와 `bindAdminSurfaceControls(surface)`를 다시 호출하도록 수정
  - `scripts/check-conversation-history-ui.cjs`
    - 화면이 `/api/v1/admin/conversations`를 직접 사용하고 있는지
    - 채널/시작일/종료일/초기화 control이 존재하는지
    - 채널 옵션 병합/정규화
    - 날짜 범위 필터
    - row mapping
    - 을 자동 확인하는 UI wiring 검증 스크립트 추가
  - `package.json`
    - `studio:conversation-history-ui-check` 추가
    - `studio:validate`에 포함
  - `docs/aidot-1.1-compatibility-coverage-matrix.md`
    - `Studio 대화 이력 조회 UI`를
      - `UI wiring` 자동 검증
      - `브라우저 렌더` 부분 검증
      로 분리
- 이번 단계 의미:
  - 이제 대화 이력 조회는 API 의미 검증뿐 아니라, Studio 화면이 그 데이터를 실제로 어떤 필터와 표 구조로 소비하는지까지 자동 검증 기준으로 관리할 수 있게 됐다.

## 2026-06-22 05:45 KST

### Simple WebChat UI wiring 검증 추가 및 세션 종료 후 재진입 보강

- simple WebChat은 `sessionEnded`를 감지하고 안내 문구는 보여줬지만, 그 뒤 사용자가 새 메시지를 보내도 새 room을 다시 만들지 못해 실제 재진입 흐름이 끊기는 갭이 있었다.
- 반영 범위:
  - `apps/webchat/app.js`
    - submit 시 `roomId`가 비어 있으면 즉시 종료시키지 않고 `openOrCreateRoom()`을 다시 호출해 새 세션을 만든 뒤 메시지를 계속 보낼 수 있도록 보강
    - 재연결 중/실패 상태 문구도 함께 갱신
  - `scripts/check-webchat-ui.cjs`
    - WebChat 화면의 핵심 DOM binding 존재 여부
    - `connect -> bots fallback -> legacy bootstrap fallback`
    - `rooms -> room detail -> create` 흐름
    - `resolveInitialMessages()` 우선순위
    - `source_talk_node_id` 전달
    - `sessionEnded` 처리 및 새 room 재생성 submit 흐름
    - 을 자동 확인하는 UI wiring 검증 스크립트 추가
  - `package.json`
    - `studio:webchat-ui-check` 추가
    - `studio:validate`에 포함
  - `docs/aidot-1.1-compatibility-coverage-matrix.md`
    - simple WebChat을
      - `UI wiring` 자동 검증
      - `브라우저 렌더` 부분 검증
      으로 분리
- 이번 단계 의미:
  - 이제 simple WebChat도 단순 API 응답/normalize 확인을 넘어서, 실제 화면 코드가 Aidot 호환 연결 흐름과 세션 재진입 흐름을 어떻게 소비하는지까지 자동 검증 기준으로 관리할 수 있게 됐다.

## 2026-06-22 05:58 KST

### legacy AM/session core flow 자동 검증 추가

- 남아 있던 큰 공백 중 하나는 `AM/session API 전체 parity`였는데, 실제로는 legacy bootstrap과 legacy room message 경로가 어느 정도 구현돼 있으면서도 검증이 얕게만 걸려 있었다.
- 반영 범위:
  - `scripts/check-am-session-api.mjs`
    - legacy `/api/v1/webchat/bootstrap`의 bot/participant envelope
    - legacy room message 호출 시 implicit room 생성
    - 생성된 room의 modern room detail/list 조회
    - legacy `__CGA_SESSION_END__` 종료 처리
    - `/api/v1/admin/conversations` 운영 이력 반영
    - 까지 한 번에 확인하는 검증 스크립트 추가
  - `package.json`
    - `studio:am-session-api-check` 추가
    - `studio:validate`에 포함
  - `docs/aidot-1.1-compatibility-coverage-matrix.md`
    - `AM/session API 전체 parity`를
      - `Legacy AM/session core flow` 자동 검증
      - `전체 parity` 부분 검증
      으로 분리
- 이번 단계 의미:
  - 이제 CGA는 modern webchat 채널 API뿐 아니라, Aidot 하위호환 성격의 legacy AM/session core flow도 자동 검증 기준으로 관리할 수 있게 됐다.

## 2026-06-22 06:10 KST

### 브라우저 기준 rich sample runtime 의미 정리

- 실제 브라우저에서 simple WebChat을 확인하던 중, test용 rich sample 입력 `__CGA_RICH_OPTIONS__`는 form 버튼을 정상 렌더하지만 runtime note에는 기본 scenario intent인 `password_reset`가 표시되어 의미가 어긋나는 것을 확인했다.
- 반영 범위:
  - `scripts/serve-studio.js`
    - rich sample 응답일 때는 intent를 기본 scenario가 아니라 `sample_rich_options`로 명시하도록 조정
  - `scripts/check-webchat-channel-api.mjs`
    - rich sample 응답의 intent name이 `sample_rich_options`인지 검증 추가
- 이번 단계 의미:
  - test hook 기반 rich sample도 화면 표시와 runtime 의미가 서로 어긋나지 않게 정리됐다.

## 2026-06-22 06:24 KST

### 시스템 관리 서브뷰 deep-link 지원 추가

- 브라우저로 Studio를 실제 확인하던 중, `access-management` 화면 안의 서브뷰는 상태가 JS 메모리에만 있고 URL에는 남지 않아 직접 진입/재현/자동 검증이 불편했다.
- 반영 범위:
  - `apps/studio/app.js`
    - `parseHashRoute()`, `buildScreenHash()` 추가
    - 시스템 관리 서브메뉴 링크를 `#access-management?subview=conversation-history` 형태로 생성
    - 클릭 시 `currentSystemAdminSubview`를 같이 보존
    - `hashchange`와 화면 복원 시에도 `subview`를 다시 읽어 활성 서브뷰를 복원
  - `scripts/check-access-subview-hash.cjs`
    - 위 deep-link 계약이 소스에 유지되는지 확인하는 검증 스크립트 추가
  - `package.json`
    - `studio:access-subview-hash-check` 추가
    - `studio:validate`에 포함
  - `docs/aidot-1.1-compatibility-coverage-matrix.md`
    - system-admin subview deep-link를 자동 검증 항목으로 추가
- 이번 단계 의미:
  - 이제 시스템 관리 하위 화면은 브라우저 새로고침이나 직접 URL 진입 시에도 서브뷰 상태를 더 안정적으로 복원할 수 있고, 이후 브라우저 기반 검증도 한 단계 더 쉽게 붙일 수 있게 됐다.

## 2026-06-22 06:41 KST

### 최신 Aidot WebChat fallback 실증 검증 추가

- `docs/aidot-latest-parity-step-plan.md`를 현재 실제 진행 상태에 맞게 갱신했다.
  - 1~2단계 완료
  - 3~5단계 사실상 완료 또는 거의 완료
  - 남은 핵심을 `6단계 최신 Aidot WebChat 실증`과 `7단계 최종 회귀 판정`으로 재정리
- 최신 Aidot `apps/webchat/app/page.tsx`가 실제로 사용하는 `AM 우선 호출 -> channel fallback` 흐름을 그대로 흉내 내는 자동 검증을 추가했다.
- 반영 범위:
  - `scripts/check-aidot-webchat-latest-flow.mjs`
    - `connect`
    - room list
    - `AM /session/start` 실패 후 channel room create fallback
    - `AM /chat` 실패 후 channel message fallback
    - rich message / `sourceTalkNodeId`
    - `AM /session/end` 실패 후 channel `DELETE`
    - closed room detail
    - same `client_room_id` 재생성
    - admin conversations 반영
    - 까지 한 번에 검증
  - `package.json`
    - `studio:aidot-webchat-latest-flow-check` 추가
    - `studio:validate`에 포함
  - `docs/aidot-1.1-compatibility-coverage-matrix.md`
    - `Latest Aidot WebChat fallback flow` 자동 검증 항목 추가
- 이번 단계 의미:
  - 최신 Aidot full WebChat 앱을 이 작업공간에서 바로 실행하지 못하더라도,
  - 실제 최신 클라이언트가 밟는 핵심 fallback 경로를 CGA backend 기준으로 자동 검증하는 기반을 확보했다.
- 검증:
  - `node --check scripts/check-aidot-webchat-latest-flow.mjs` 통과
  - `npm run studio:aidot-webchat-latest-flow-check` 통과
  - `npm run studio:validate` 전체 통과
  - 참고: `MODULE_TYPELESS_PACKAGE_JSON` 경고는 계속 보이지만 현재 실패 원인은 아니며, 이번 단계에서는 동작 변경 없이 유지

## 2026-06-22 23:02 KST

### Studio 서브뷰 해시 직접 진입 회귀 원인 축소 및 보강

- 브라우저 기준으로 `#access-management?subview=conversation-history` 직접 진입을 다시 확인하는 과정에서,
  - `apps/studio/app.js` 내부 deep-link 로직만으로는 부족했고
  - `apps/studio/index.html` 하단 인라인 fallback 스크립트가 hash 전체 문자열을 그대로 비교하면서
  - `workspace-home`로 다시 덮어쓰는 회귀 지점을 확인했다.
- 반영 범위:
  - `apps/studio/app.js`
    - 명시적 hash route가 있을 때 post-login landing이 이를 덮어쓰지 않도록 보강
    - 세션 복원 후 `applyScreenLayout()`를 다시 호출하도록 보강
    - explicit hash screen이 selectable하면 현재 active screen보다 우선해 다시 해석하도록 보강
  - `apps/studio/index.html`
    - `parseHashScreenId()` 추가
    - 인라인 fallback 스크립트가 `#screen?subview=...` 형식에서 `screen`만 비교하도록 수정
    - 정적 자원 캐시 버전을 `20260622-2`로 상향
  - `scripts/check-access-subview-hash.cjs`
    - `app.js`뿐 아니라 `index.html` 인라인 hash parser까지 검증하도록 보강
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `npm run studio:access-subview-hash-check` 통과
  - `npm run studio:validate` 전체 통과
- 추가 확인:
  - 기존 `4173` 포트 서버는 현재 워크트리의 최신 정적 파일을 서빙하지 않는 별도 오래된 프로세스로 확인되어,
    브라우저 수동 점검은 `4181` 신규 서버 기준으로 다시 진행했다.
  - `4181` 신규 서버 응답에서 `app.js?v=20260622-2`와 `parseHashScreenId()` 반영은 확인했다.
- 이번 단계 의미:
  - system-admin deep-link는 이제 `app.js` 내부 route 처리뿐 아니라,
  - `index.html` fallback visibility script까지 포함해 같은 계약을 따르도록 정리됐다.

## 2026-06-22 23:36 KST

### Studio 대화 이력 조회 진입 시 초기화 중단 버그 수정

- 최신 브라우저 기준 점검을 계속 진행하던 중,
  - 로그인 화면 자체는 보이지만
  - `data-entry-login-submit`, `data-entry-locale` 바인딩이 붙지 않고
  - system-admin 대화 이력 조회 화면 초기화도 중간에서 멈추는 현상을 확인했다.
- 원인:
  - `apps/studio/app.js`의 `renderConversationHistorySurface()`에서
  - 채널 선택 박스를 그릴 때 `selectedChannel` 지역 변수를 선언하지 않은 채 참조하고 있었고,
  - 이 예외가 `renderAccessPanels()` 단계에서 발생하면서
  - 이후 `bindAdminWorkbench()`까지 내려가지 못했다.
- 반영 범위:
  - `apps/studio/app.js`
    - `renderConversationHistorySurface()` 안에 `const selectedChannel = String(currentConversationHistoryFilters.channel || "all");` 복구
  - `apps/studio/index.html`
    - 브라우저 캐시 영향을 피하기 위해 `app.js` 정적 자원 버전을 `20260622-6`으로 상향
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `npm run studio:access-subview-hash-check` 통과
  - `npm run studio:validate` 전체 통과
  - 브라우저 스모크 확인:
    - `http://127.0.0.1:4182/?b=20260622-6#access-management?subview=conversation-history`
    - `data-entry-login-submit`, `data-entry-locale` 바인딩 복구 확인
    - 대화 이력 조회 채널 필터 기본값 `all` 확인
    - system-admin 서브메뉴 링크 렌더링 복구 확인
- 추가 확인:
  - 기존 `4173` 서버는 여전히 오래된 정적 자원을 물고 있어 최신 수동 점검 기준에서 제외
  - 최신 수동 확인은 `4182` 신규 서버 기준으로 계속 진행
- 이번 단계 의미:
  - 이제 system-admin 대화 이력 조회 화면 진입이 런타임 예외로 끊기지 않고,
  - 로그인 이후 화면 복원과 실제 conversation-history 운영 조회 브라우저 실증을 다시 이어갈 수 있는 상태가 됐다.

## 2026-06-22 23:49 KST

### 로그인 이후 conversation-history deep-link 실브라우저 확인

- 신규 서버 `4182` 기준으로 실제 브라우저 로그인 흐름을 다시 점검했다.
- 확인 URL:
  - `http://127.0.0.1:4182/?b=20260622-6#access-management?subview=conversation-history`
- 실브라우저 확인 결과:
  - 로그인 전:
    - `data-entry-login-submit`, `data-entry-locale` 바인딩 정상
  - 로그인 후:
    - hash가 `#access-management?subview=conversation-history` 그대로 유지
    - 활성 화면이 `access-management`로 복원
    - system-admin 활성 서브뷰가 `conversation-history`로 유지
    - 화면 헤더가 `대화 이력 조회`로 표시
    - channel filter 기본값 `all` 유지
    - conversation-history 패널이 즉시 표시
- 반영 범위:
  - `scripts/check-access-subview-hash.cjs`
    - 단순 hash parser 존재 여부만 보지 않고,
    - 로그인 성공 시 explicit hash route를 덮어쓰지 않는 계약까지 소스 검증하도록 강화
    - `hasExplicitHashRoute()`
    - `postAuthDefaultScreenPending = !hasExplicitHashRoute();`
    - explicit hash route가 있을 때 `activeScreenId`를 hash 기준으로 복원하는 코드
    - default landing이 explicit hash route를 건드리지 않는 분기
    - 까지 확인하도록 보강
- 검증:
  - `npm run studio:access-subview-hash-check` 통과
  - `npm run studio:validate` 전체 통과
- 이번 단계 의미:
  - 이제 system-admin 서브뷰 deep-link는
    - URL 해석
    - 로그인 전 초기 렌더
    - 로그인 후 화면 복원
    - 대화 이력 조회 패널 노출
    - 까지 한 흐름으로 확인됐다.

## 2026-06-23 00:06 KST

### 진행 중 대화 이력 조회 자동 검증 편입

- 최신 Aidot 1.1의 큰 구조 변화인
  - `대화 진행 중에도 대화 이력 조회 가능`
  - 요구를 CGA 자동 검증에도 직접 반영했다.
- 반영 범위:
  - `scripts/check-aidot-webchat-latest-flow.mjs`
    - 최신 Aidot fallback create/chat 흐름 이후
    - 세션 종료 전에 `/api/v1/admin/conversations`를 다시 조회해
    - 해당 room이 `open` 상태로 보이는지
    - transcript/messages가 이미 누적되어 조회되는지
    - `session_ended === false` 상태가 유지되는지
    - 검증하도록 보강
  - `scripts/check-admin-conversations-api.mjs`
    - 오래된 기대값 `password_reset` 고정 대신
    - 최신 queue 기준 `latest_intent_name = sample_rich_options`를 확인하도록 수정
    - 동시에 첫 사용자 발화와 초기 `password_reset` 응답이 transcript/messages 안에 보존되는지도 함께 검증
  - `package.json`
    - 빠져 있던 `studio:admin-conversations-check`를 `studio:validate` 체인에 편입
  - `docs/aidot-1.1-compatibility-coverage-matrix.md`
    - `진행 중 대화 이력 조회` 자동 검증 항목 추가
  - `docs/aidot-latest-parity-step-plan.md`
    - 6단계 진행 상태를 `대화 진행 중 이력 조회까지 자동 검증됨`으로 갱신
- 안정화 보강:
  - `scripts/check-aidot-webchat-latest-flow.mjs`
  - `scripts/check-admin-conversations-api.mjs`
    - 임시 포트 범위를 넓히고 서버 기동 대기 시간을 15초로 늘려
    - 전체 `studio:validate` 체인에서 간헐 기동 실패가 나지 않도록 보강
- 검증:
  - `npm run studio:aidot-webchat-latest-flow-check` 통과
  - `npm run studio:admin-conversations-check` 통과
  - `npm run studio:validate` 전체 통과
- 이번 단계 의미:
  - 이제 CGA는 최신 Aidot 기준으로
    - WebChat 대화 생성
    - 대화 진행 중 운영 이력 조회
    - 세션 종료 후 이력 상태 전환
    - 까지를 자동 검증 범위 안에 넣은 상태다.

## 2026-06-23 00:19 KST

### Aidot full WebChat 실증용 브리지 및 수동 smoke 절차 고정

- 최신 Aidot `apps/webchat` full UI는 기본 서버를 `http://localhost:8320`으로 가정하고 시작한다.
- Aidot 참조본 자체는 수정하지 않고,
  - CGA backend를 이 기본 주소로 브리지하는 얇은 프록시를 작업공간에 추가했다.
- 반영 범위:
  - `scripts/proxy-aidot-webchat-to-cga.cjs`
    - `http://127.0.0.1:8320` 수신
    - 기본 target `http://127.0.0.1:4182`
    - request/response를 그대로 CGA backend로 전달
  - `package.json`
    - `npm run studio:aidot-webchat-proxy` 추가
  - `docs/aidot-full-webchat-manual-smoke.md`
    - full WebChat 기준 수동 smoke 절차 문서 추가
    - 연결 테스트
    - 채팅방 생성
    - 일반 질의
    - rich form
    - 진행 중 운영 이력 조회
    - 세션 종료
    - 종료 후 운영 이력 조회
    - 순서로 고정
  - `docs/aidot-latest-parity-step-plan.md`
    - 6단계에 프록시 실행 경로와 수동 smoke 문서 연결 반영
- 확인:
  - `Aidot\\node_modules\\next` 존재 확인
  - `Aidot\\apps\\webchat` dev 서버 기동 가능 확인
  - 프록시 기준 `http://127.0.0.1:8320/api/v1/channels/webchat/connect` -> 200 응답 확인
- 검증:
  - `node --check scripts/proxy-aidot-webchat-to-cga.cjs` 통과
  - `npm run studio:validate` 전체 통과
- 제한/판단:
  - 현재 Codex 내장 브라우저 환경에서는 Next dev full UI hydration 상호작용까지 안정적으로 자동 재현되지는 않았다.
  - 따라서 full WebChat 영역은
    - backend/API 의미 호환은 자동 검증으로 관리하고
    - full UI 경험은 이번에 고정한 브리지 + 수동 smoke 절차로 관리하는 것이 현재 가장 안전하다.
- 이번 단계 의미:
  - 남아 있던 `최신 Aidot full WebChat 실증`은 이제
    - 실행 경로 없음
    - 상태가 아니라
    - 반복 가능한 실행 경로와 점검 절차가 확보된 상태다.

## 2026-06-23 00:27 KST

### Aidot full WebChat 원클릭 smoke 실행 경로 추가

- full WebChat 수동 smoke는 준비 절차가 여러 단계라 반복 진입 비용이 있었다.
- 이 비용을 줄이기 위해 아래 3개를 한 번에 띄우는 launcher를 추가했다.
  - CGA Studio/backend
  - Aidot `8320 -> CGA` 프록시
  - Aidot full WebChat dev server
- 반영 범위:
  - `scripts/start-aidot-full-webchat-smoke.cjs`
    - `4182 / 8320 / 3330` 기본 포트 기준으로 3개 프로세스를 동시에 시작
    - stdout/stderr prefix를 붙여 어떤 프로세스 로그인지 구분 가능
    - `Ctrl+C` 종료 시 자식 프로세스 정리
  - `package.json`
    - `npm run studio:aidot-full-webchat-smoke` 추가
  - `docs/aidot-full-webchat-manual-smoke.md`
    - `빠른 시작` 섹션 추가
- 검증:
  - `node --check scripts/start-aidot-full-webchat-smoke.cjs` 통과
  - `npm run studio:validate` 전체 통과
- 이번 단계 의미:
  - 이제 full WebChat 남은 수동 범위는
    - 실행 준비
    - 가 아니라
    - 실제 화면에서 눌러보는 마지막 UX 확인
    - 으로 축소됐다.

## 2026-06-23 00:41 KST

### Aidot full WebChat smoke preflight 자동 검증 추가

- full WebChat 수동 smoke에 들어가기 전에
  - CGA backend
  - Aidot 프록시
  - Aidot full WebChat
  - 이 실제로 함께 올라오는지 자동으로 확인하는 preflight를 추가했다.
- 반영 범위:
  - `scripts/check-aidot-full-webchat-preflight.cjs`
    - 랜덤 포트로 CGA Studio 기동
    - 랜덤 포트로 Aidot 프록시 기동
    - Aidot full WebChat은
      - 이미 `3330`에서 떠 있으면 재사용
      - 없으면 새 dev server를 기동
    - CGA root 응답
    - full WebChat HTML 응답
    - CGA `/api/v1/channels/webchat/connect` 연결 성공
    - 을 한 번에 확인
  - `package.json`
    - `npm run studio:aidot-full-webchat-preflight-check` 추가
  - `docs/aidot-full-webchat-manual-smoke.md`
    - preflight 실행 절차 추가
- 조정 사항:
  - 초기 구현에서 Aidot `apps/webchat` dev server 중복 기동 감지로 실패하는 케이스가 있었고,
    이미 `3330`에서 떠 있는 서버를 재사용하도록 보강
  - 프록시 readiness는 HTTP probe 강제 대신
    프로세스 생존 확인 + CGA webchat connect 성공 확인으로 안정화
- 검증:
  - `node --check scripts/check-aidot-full-webchat-preflight.cjs` 통과
  - `npm run studio:aidot-full-webchat-preflight-check` 통과
  - `npm run studio:validate` 전체 통과
- 이번 단계 의미:
  - 이제 full WebChat 영역도
    - 실행 환경이 올라오는지
    - 를 자동으로 먼저 점검한 뒤
    - 실제 남은 수동 검증은 마지막 사용자 클릭/UX 체험
    - 으로 더 좁혀졌다.

## 2026-06-23 00:52 KST

### Aidot 1.1 최종 호환 판정 문서 초안 고정

- 현재까지의 자동 검증 범위와 남은 수동 범위를 한 장으로 정리한 최종 판정 문서 초안을 추가했다.
- 반영 범위:
  - `docs/aidot-1.1-final-parity-verdict.md`
    - 기준선: `Aidot 1.1 / contract v1.0`
    - 현재 판정: `조건부 호환 확보`
    - 자동 검증으로 닫힌 범위
    - 수동 smoke로 남은 범위
    - 지금 안전하게 말할 수 있는 표현 / 아직 이른 표현
    - 권장 운영 판정
    - 최종 체크리스트
    - 를 정리
  - `docs/aidot-latest-parity-step-plan.md`
    - 7단계 상태를 `최종 판정 문서 초안 작성 완료, 마지막 full WebChat smoke 기록만 남음`으로 갱신
- 검증:
  - `npm run studio:validate` 전체 통과
- 이번 단계 의미:
  - 이제 현재 상태는
    - “뭘 더 해야 하는지 모호한 상태”
    - 가 아니라
    - “자동 검증 완료 + 마지막 full UI smoke 결과 반영만 남은 상태”
    - 로 정리됐다.

## 2026-06-23 01:00 KST

### Aidot full WebChat 수동 smoke 접속 주소 가이드 보강

- Aidot full WebChat dev 서버 로그에서
  - `127.0.0.1` 접근 시 Next dev resource cross-origin 경고가 남는 것을 확인했다.
- 제품 코드 변경 없이 수동 smoke 성공률을 높이기 위해,
  - full WebChat 접속 기본 주소를 `http://localhost:3330`으로 안내하도록 문서를 보강했다.
- 반영 범위:
  - `docs/aidot-full-webchat-manual-smoke.md`
    - 브라우저 열기 주소를 `http://localhost:3330`으로 수정
    - dev 환경에서는 `127.0.0.1`보다 `localhost` 우선 사용 안내 추가
- 이번 단계 의미:
  - 남은 마지막 수동 smoke도
    - 환경 경고를 피한 더 안정적인 진입 경로
    - 기준으로 수행할 수 있게 됐다.

## 2026-06-23 01:13 KST

### Aidot full WebChat 최종 수동 검증 결과 기록 체계 고정

- 자동 검증은 거의 닫혔지만,
  - 마지막 full WebChat 수동 smoke 결과를 사람마다 다른 형식으로 남기면
  - 최종 판정 근거가 흔들릴 수 있어 결과 기록 템플릿을 추가했다.
- 반영 범위:
  - `docs/aidot-full-webchat-smoke-result-template.md`
    - 실행 정보
    - 사전 점검 결과
    - 1~7 단계 pass/fail
    - 최종 판정
    - 첨부 권장 항목
    - 을 같은 형식으로 남기도록 추가
  - `docs/aidot-full-webchat-manual-smoke.md`
    - smoke 수행 후 위 템플릿에 결과를 남기고
    - `cga-work-progress` / 최종 판정서까지 반영하도록 연결
  - `docs/aidot-latest-parity-step-plan.md`
    - 6~7단계의 공식 산출물로 smoke 결과 기록서를 명시
  - `docs/aidot-1.1-final-parity-verdict.md`
    - 조건부 배포 가능의 마지막 근거로
    - smoke 결과 기록서 반영을 명시
- 이번 단계 의미:
  - 이제 남은 작업은
    - “수동으로 한 번 눌러본다”
    - 수준이 아니라
    - 같은 기준으로 실행하고
    - 같은 형식으로 기록하고
    - 그 기록을 최종 판정 근거로 연결하는 단계
    - 로 고정됐다.

## 2026-06-23 01:18 KST

### 최종 수동 smoke 직전 기준선 재검증 통과

- 수동 smoke로 넘어가기 전에
  - 자동 검증 전체
  - full WebChat preflight
  - 가 아직 깨지지 않았는지 다시 확인했다.
- 실행 결과:
  - `npm run studio:aidot-full-webchat-preflight-check` 통과
    - `studio=http://127.0.0.1:46969`
    - `proxy=http://127.0.0.1:47913`
    - `webchat=http://127.0.0.1:3330`
  - `npm run studio:validate` 전체 통과
- 확인 의미:
  - 현재 CGA 기준선은
    - asset round-trip
    - WebChat channel / fallback / session
    - admin conversations
    - Studio conversation-history wiring
    - 까지 다시 한 번 정상 상태임을 확인했다.
- 잔여 이슈:
  - `MODULE_TYPELESS_PACKAGE_JSON` 경고는 계속 보이지만
  - 현재 validate 실패 원인은 아니며
  - 이번 호환 판정 범위에서는 비차단 경고로 유지한다.
- 이번 단계 의미:
  - 이제 남은 것은
    - 환경 준비나 자동 검증 보강이 아니라
    - `docs/aidot-full-webchat-manual-smoke.md`
    - 기준의 마지막 실제 사용자 수동 smoke 실행과
    - `docs/aidot-full-webchat-smoke-result-template.md`
    - 결과 기록 반영
    - 뿐이다.

## 2026-06-23 06:19 KST

### Aidot full WebChat 최종 실브라우저 smoke 통과 및 프록시 CORS 보강

- 실제 `http://localhost:3330` 기준 full WebChat 화면에서
  - 연결
  - 채팅방 생성
  - 일반 질의
  - RichForm 표시/선택
  - 진행 중 운영 이력 조회
  - 채팅방 종료
  - 종료 후 운영 이력 유지
  - 까지를 끝까지 확인했다.
- 실증 중 실제 장애 1건 확인:
  - Aidot full WebChat은 room create 전에 `/api/am/...` 경로를 먼저 시도하고,
    실패 시 channel fallback으로 내려오는데
  - 프록시가 이 AM 경로의 `OPTIONS/CORS`를 보장하지 않아
    브라우저에서 `Failed to fetch`로 끊기는 문제가 있었다.
- 조치:
  - `scripts/proxy-aidot-webchat-to-cga.cjs`
    - universal `OPTIONS` 204 응답 추가
    - 모든 응답에 `Access-Control-Allow-Origin/Methods/Headers` 주입
    - 으로 full WebChat fallback 직전 CORS를 보강
  - `scripts/check-aidot-full-webchat-preflight.cjs`
    - proxy 기준
    - `/api/am/supportbot-draft/session/start`
    - `OPTIONS 204 + CORS`
    - `POST 404 + CORS`
    - 까지 확인하도록 보강
- 실브라우저 확인 결과:
  - room id:
    - `a6c2cc10-3b19-4218-ad06-cae41431ff79`
  - 일반 질의:
    - `I need to reset my password`
    - bot 응답:
    - `Open Account Settings and choose Reset Password.`
  - RichForm:
    - `예금`
    - `대출`
    - `상담원 연결`
    - 버튼 렌더 확인
    - `예금` 클릭 후 후속 응답 확인
  - 진행 중 운영 이력:
    - `room_status = open`
    - `session_ended = false`
    - `sourceTalkNodeId = sample-rich-options-node`
    - 유지 확인
  - 종료 후:
    - room detail `status = closed`
    - admin conversations `result = closed`
    - `session_ended = true`
    - `session_end_reason = deleted`
    - transcript/messages/runtime summary 유지 확인
- 문서 반영:
  - `docs/aidot-full-webchat-smoke-result-template.md`
    - 실제 결과로 채움
  - `docs/aidot-1.1-final-parity-verdict.md`
    - `조건부 호환 확보` -> `Aidot 1.1 / contract v1.0 호환 확보`
    - 로 상향
  - `docs/aidot-latest-parity-step-plan.md`
    - 6~7단계 완료로 갱신
- 이번 단계 의미:
  - 이제 이번 작업의 in-scope 기준에서는
    - 최신 Aidot full WebChat 실증
    - 운영 이력 의미 호환
    - 최종 판정 기록
    - 까지 모두 닫힌 상태다.
  - 최종 반영 후
    - `npm run studio:aidot-full-webchat-preflight-check`
    - `npm run studio:validate`
    - 도 다시 통과했다.

## 2026-06-23 06:32 KST

### 봇 생성 화면 필수 입력 규칙 및 저장 활성 조건 보강

- 신산님 확인 기준으로 `봇 생성` 화면에는 두 가지 UX 문제가 있었다.
  - `+ 봇 생성` 직후 draft 봇 이름이 `New Bot n` 형태로 자동 주입돼 사용자가 입력하지 않은 값이 확정된 것처럼 보이는 문제
  - `봇 이름` 같은 필수 항목 표시가 없고, 상단 `저장` 버튼도 필수값과 무관하게 항상 활성화되어 있는 문제
- 반영 범위:
  - `apps/studio/app.js`
    - `+ 봇 생성` 시 draft 봇 이름 기본값을 빈 문자열로 변경
    - `getCreateRequiredFieldIssues()`, `syncCreateValidationState()` 추가
    - `봇 생성` 화면에서는 `봇 이름`, `버전 이름` 미입력 시 상단 `저장` 버튼 비활성화
  - `apps/studio/index.html`
    - `봇 이름`, `버전 이름` 라벨에 필수 `*` 표시 추가
    - `data-create-required-notice` 경고 문구 추가
  - `apps/studio/styles.css`
    - 필수 표시 스타일
    - 미입력 필드 강조 스타일
    - create validation notice spacing
    - 추가
- 현재 동작:
  - `+ 봇 생성` 후 봇 이름은 자동으로 채워지지 않음
  - `봇 이름`과 `버전 이름`에 필수 표시가 보임
  - `봇 생성` 화면에서 필수 입력값이 비어 있으면 `저장` 버튼이 비활성화됨
  - 값 입력 후에는 다시 저장 가능 상태로 전환됨
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `npm run studio:validate` 전체 통과
- 이번 단계 의미:
  - 이제 `봇 생성` 화면은
    - 사용자가 아직 입력하지 않은 이름을 임의로 확정하지 않고
    - 어떤 값이 필수인지 화면에서 바로 보이며
    - 저장 가능 여부도 입력 규칙과 일치하는 상태가 됐다.

## 2026-06-23 07:18 KST

### 봇 업로드 반영 구조 수정

- 신산님 확인으로 `봇 업로드` 후 화면에 변화가 거의 없고, 선택 봇도 그대로 남는 문제가 드러났다.
- 원인:
  - 클라이언트 `applyAidotBotPackage()`가 Aidot 패키지의 `botVo`를 읽어 현재 선택한 CGA 봇을 갱신하는 대신, 내부적으로 다른 봇 컨텍스트처럼 처리하고 있었다.
  - 테스트 서버 `scripts/serve-studio.js`의 `bot` scope import도 전송 파일과 이력만 저장하고, 실제 `workspace-bots` / `studio-state` 메타데이터는 갱신하지 않았다.
- 수정:
  - `apps/studio/app.js`
    - 봇 업로드는 이제 `현재 선택한 CGA 봇 슬롯`에 Aidot 패키지를 반영한다.
    - 업로드 후 `selectedBotManagementId`, `currentWorkspaceBotId`, top context, bot management가 같은 봇을 바라보도록 정렬했다.
    - 업로드 승인 후 서버 봇 목록과 선택 봇 상태를 다시 동기화하도록 보강했다.
  - `scripts/serve-studio.js`
    - `bot` package import 승인 시 현재 `groupId/botId`의 workspace bot 메타데이터를 업데이트한다.
    - 같은 시점에 `studio-state`의 `bot.name / description / version / defaultLocale`도 함께 갱신한다.
  - `scripts/check-asset-transfer-api.mjs`
    - bot import 후 `/bots/{botId}`와 `/studio-state`가 실제로 갱신됐는지 회귀 체크를 추가했다.
- 현재 의미:
  - CGA에서는
    - 먼저 봇 생성
    - 그 다음 Aidot 봇 패키지 업로드
    - 업로드된 내용이 현재 봇에 반영
  - 되는 흐름으로 맞췄다.

## 2026-06-23 07:28 KST

### 봇 업로드 화면 실증 및 4173 구동 인스턴스 상태 확인

- 신산님 질문:
  - `봇 업로드를 했는데 아무 변화가 없는데, 봇 업로드 테스트 했어?`
- 실제 확인:
  - Codex in-app browser로 `http://127.0.0.1:4173/#bot-management`를 열어 상태를 점검했다.
  - 여기서는 `bot import` 이력은 남지만, `supportbot-draft`의 봇 이름이 `SupportBot Draft` 그대로 유지됐다.
  - 이어서 직접 API로 `aidot-bot-uploaded.json` fixture를 업로드해도 `GET /api/cga/groups/g-support/bots/supportbot-draft`가 여전히 예전 메타데이터를 반환했다.
- 해석:
  - 이 결과는 현재 신산님이 보고 있는 `4173` 서버가 수정 전 코드로 떠 있다는 뜻이다.
  - 즉, 화면 반응이 없는 근본 이유는 “실행 중 인스턴스 stale”이다.
- 재실증:
  - 수정된 코드로 별도 포트 `4273`에서 새 스튜디오 인스턴스를 실행했다.
  - `http://127.0.0.1:4273/#bot-management` 로그인 후 같은 `aidot-bot-uploaded.json` 업로드 경로를 검증했다.
  - 결과:
    - top context `Bot: Uploaded Bot`
    - `선택 봇: Uploaded Bot`
    - `봇 상세 정보`의 `봇 이름: Uploaded Bot`
    - 최근 전송 이력에 `bot import`
    - 로 반영되는 것을 화면에서 확인했다.
- 현재 결론:
  - 코드 수정본 기준으로는 `봇 업로드 후 아무 변화 없음` 버그가 재현되지 않았다.
  - 신산님이 사용하는 `4173` 서버는 재시작이 필요하다.

## 2026-06-23 08:11 KST

### 관리자 영역 우선 수정 설계 계획서 작성

- 신산님 요청 기준:
  - Brity/Aidot의 운영형 개념을 기준으로
  - `사용자관리`, `대화관리`, `시스템연계`, `기타관리`
  - 중 `기타 관리 > 템플릿 목록`부터 실제 동작 복구를 시작하는 계획서를 먼저 작성
- 반영 문서:
  - `docs/cga-admin-priority-fix-plan.md`
- 이번 계획서의 핵심 고정 원칙:
  - Aidot API는 새로 설계하지 않고 원형을 그대로 유지
  - CGA는 화면/메뉴/UX만 재구성
  - 관리자 영역 우선 복구
  - 첫 착수 화면은 `템플릿 목록`
- 단계 구조:
  - Phase 1 `템플릿 목록 기준선 고정`
  - Phase 2 `관리자 공통 화면 패턴 확정`
  - Phase 3 `사용자 관리 복구`
  - Phase 4 `대화 관리 복구`
  - Phase 5 `시스템 연계 복구`
  - Phase 6 `관리자 영역 통합 검증`
- 이번 단계 의미:
  - 이제 CGA 수정은
    - 챗봇 제작 화면을 계속 덧대는 방식이 아니라
    - Aidot 운영형 관리자 기능을 먼저 실제 동작 수준으로 복구하는 방향
  - 으로 고정됐다.

## 2026-06-23 09:12 KST

### 공통 변수 관리하기를 Aidot 기준 구조로 정렬

- 신산님 지시 기준:
  - `공통 변수 관리하기`는 CGA 범용 관리자 화면이 아니라 Aidot 기준 구조/문구/동작으로 맞춰야 함
  - 시스템 변수는 시스템이 나중에 값을 넣는 변수이며, 사용자가 수정/삭제하면 안 됨
  - 예: `_bot_id` 같은 값은 봇 컨텍스트에 따라 런타임에 바뀌어야 함
- 반영 범위:
  - `apps/studio/app.js`
    - 공통 변수 화면을 Aidot형 검색/구분 필터/초기화/조회/`+ 공통 변수 추가`/더보기 업로드/다운로드/삭제/페이지 크기 구조로 교체
    - 사용자 변수만 선택/삭제 가능하도록 보강
    - 공통 변수 상세/추가 팝업을 범용 2단 레이아웃 대신 단일 Aidot형 입력 팝업으로 전환
    - 시스템 변수는 읽기 전용으로 열리며 저장 버튼이 나오지 않도록 처리
  - `apps/studio/index.html`
    - 공통 변수 전용 팝업 설명 문구를 동적으로 바꿀 수 있도록 subtitle target 추가
  - `apps/studio/styles.css`
    - Aidot 공통 변수 화면용 search row / more menu / 파일 업로드 숨김 / 선택 개수 / 단일 팝업 레이아웃 스타일 추가
  - `scripts/serve-studio.js`
    - 공통 변수 seed 데이터를 `category`가 아니라 Aidot 의미와 맞는 `kind: system|user` 구조로 정리
    - 기존 저장 데이터도 `kind`, `updater_name`, `data_json`을 갖도록 정규화
    - `GET /api/cga/admin/common-variables`에 `kind` 필터 지원 추가
    - 시스템 변수는 생성 충돌/수정/삭제가 차단되도록 보강
    - 공통 변수 생성 시 같은 이름의 사용자 변수는 중복 생성 대신 갱신되도록 보강
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `node --check scripts/serve-studio.js` 통과
- 이번 단계 의미:
  - 공통 변수 화면은 이제
    - CGA가 임의로 만든 범용 등록 화면
    - 이 아니라
    - Aidot의 공통 변수 관리 구조와 시스템/사용자 변수 규칙
    - 을 기준으로 동작하는 상태로 정렬됐다.

## 2026-06-23 10:04 KST

### 기본 메시지 관리를 Aidot 기준 구조와 다국어 레지스트리로 정렬

- 신산님 요청 기준:
  - `기본 메시지 관리`도 Aidot 기준으로 맞춰야 함
  - 메시지는 언어별로 등록/관리해야 함
  - Aidot에서 등록한 기본 메시지 외에 CGA 시스템이 사용하는 메시지도 모두 여기 등록해서 사용해야 함
- 반영 범위:
  - `apps/studio/app.js`
    - 기본 메시지 화면을 Aidot형 검색/구분 필터/사용여부 필터/초기화/조회 구조로 교체
    - 기본 메시지는 새로 생성/삭제하지 않고 기존 항목만 수정/기본값 복원하는 Aidot형 상세 팝업으로 전환
  - `apps/studio/styles.css`
    - 기본 메시지 검색행과 Aidot형 단일 컬럼 상세 팝업 스타일 추가
  - `scripts/serve-studio.js`
    - 기본 메시지 seed를 언어별(`ko`, `en`, `zh-CN`, `ja`, `vi`, `de`, `fr`) 레지스트리 구조로 재정의
    - Aidot 계열 기본 메시지와 함께 CGA 시스템 런타임 메시지(`bot_connected`, `session_end_processing`)도 동일 레지스트리에 등록
    - WebChat 연결 안내, 세션 종료 안내, 기본 fallback 응답이 하드코딩 문자열이 아니라 기본 메시지 레지스트리를 통해 내려가도록 변경
    - 기본 메시지는 생성/삭제 대신 수정/복원만 허용하도록 API 동작 정렬
  - `scripts/check-admin-resources-api.cjs`
    - 기본 메시지 검증을 기존 CRUD 방식에서 Aidot형 `수정 -> 복원` 검증으로 교체
- 검증:
  - `node --check apps/studio/app.js` 통과
  - `node --check scripts/serve-studio.js` 통과
  - `npm run studio:validate` 예정
- 이번 단계 의미:
  - 이제 기본 메시지는
    - 화면에 보이는 텍스트를 임시 하드코딩하는 구조
    - 가 아니라
    - Aidot 기준 메시지 목록 + 언어별 관리 + 시스템 런타임 공용 사용
    - 구조로 정렬되는 단계에 들어갔다.

## 2026-06-23 13:02 KST

### 기본 메시지 관리에 페이지 처리, 언어 조회조건, 다운로드를 추가

- 신산님 추가 요청 기준:
  - 기본 해상도는 `1920 x 1080`
  - 모든 화면에는 페이지 처리가 있어야 함
  - 기본 메시지 관리에는 `다운로드`가 있어야 함
  - 조회조건에 `언어`를 추가해야 함
  - 메시지는 각 언어 항목에 해당 언어 메시지로 등록/표출되어야 함
- 반영 범위:
  - `apps/studio/app.js`
    - 기본 메시지 관리에 `언어` 조회 필터 추가
    - `25개씩 보기` 기준의 페이지 크기 선택과 하단 페이지 이동 처리 추가
    - 현재 조회 조건에 맞는 기본 메시지 CSV 다운로드 추가
  - `apps/studio/styles.css`
    - 기본 메시지 검색행을 언어 필터까지 포함하도록 재배치
    - 1920 기준에서도 툴바와 페이지 이동이 자연스럽게 보이도록 wrap 스타일 보강
  - `scripts/serve-studio.js`
    - 기본 메시지 API에 `language` 필터 추가
    - 기본 메시지 seed 값을 언어별 메시지 텍스트로 확장
    - 기존 저장 데이터가 기본값을 그대로 쓰는 경우에는 해당 언어 기본 문구로 자동 정렬되도록 보정
    - 기본값 복원도 언어별 기본 메시지로 복원되도록 수정
- 이번 단계 의미:
  - 기본 메시지 관리는 이제
    - 언어 구분 없이 한 화면에 모여 있는 목록
    - 이 아니라
    - 언어 조건으로 조회하고, 페이지로 관리하고, 그 결과를 내려받을 수 있는 Aidot형 운영 화면
    - 으로 한 단계 더 정렬됐다.

## 2026-06-23 13:46 KST

### 채널 관리, 봇스테이션 연계 현황, 템플릿 목록을 Aidot 기준 화면으로 정렬

- 신산님 추가 요청 기준:
  - `채널 관리`
  - `봇스테이션 연계 현황`
  - `템플릿 목록`
  - 도 Aidot 기준의 운영형 화면으로 맞춰야 함
- 반영 범위:
  - `apps/studio/app.js`
    - 템플릿 목록을 Aidot형 검색/채널 필터/사용여부 필터/초기화/조회/등록/페이지/다운로드 구조로 전환
    - 채널 관리를 Aidot형 검색/사용여부 필터/초기화/조회/채널 생성/페이지/다운로드/관리 열 구조로 전환
    - 봇스테이션 연계 현황을 Aidot형 다중 조회조건(봇 이름, 수정자, 그룹, 채널, 상태, 시작일, 종료일) + 페이지 + 다운로드 화면으로 추가
  - `apps/studio/styles.css`
    - Aidot의 `admin-channels`, `admin-template-list`, `admin-botstation` 계열 스타일을 맞춰서 검색행과 그리드 밀도를 조정
  - `scripts/serve-studio.js`
    - 봇스테이션 연계 현황 seed 데이터를 추가
    - 기존 저장 데이터가 비어 있어도 기본 봇스테이션 목록이 보이도록 정규화 보강
- 이번 단계 의미:
  - 이제 관리자 영역의 `기타 관리`와 `시스템 연계` 주요 목록들은
    - 범용 CGA 테이블
    - 이 아니라
    - Aidot 운영형 목록 화면 패턴
    - 으로 같은 축을 가지기 시작했다.

## 2026-06-23 14:08 KST

### 템플릿 등록, 채널 등록 팝업도 Aidot형 입력 폼으로 교체

- 신산님 확인 결과:
  - 목록 화면은 바뀌었지만
  - `템플릿 등록`, `채널 등록`
  - 팝업은 여전히 예전 CGA 범용 상세/수정 모달이 남아 있었음
- 반영 범위:
  - `apps/studio/app.js`
    - 템플릿 팝업을 Aidot형 `템플릿 등록 / 템플릿 정보 수정` 입력 폼으로 교체
    - 채널 팝업을 Aidot형 `채널 생성 / 채널 정보 수정` 입력 폼으로 교체
    - 기존 2단 상세/수정 구조 대신 단일 입력 폼과 Aidot형 footer 버튼(`삭제/취소/확인`) 구조로 정렬
  - `apps/studio/styles.css`
    - 템플릿/채널 팝업도 단일 폼 레이아웃으로 보이도록 전용 modal class 추가
- 이번 단계 의미:
  - 이제 템플릿/채널은
    - 목록만 Aidot이고 팝업은 CGA 예전 모달인 상태
    - 가 아니라
    - 목록과 등록/수정 팝업까지 같이 Aidot형 입력 흐름
    - 으로 정렬됐다.

## 2026-06-23 14:18 KST

### 템플릿 등록, 채널 생성 팝업의 외곽 컨테이너도 Aidot형 다이얼로그 크기로 재정렬

- 신산님 추가 확인:
  - 입력 폼 구조는 바뀌었지만
  - 팝업 바깥 컨테이너는 여전히 예전 대형 상세 패널 폭을 사용하고 있었음
- 반영 범위:
  - `apps/studio/app.js`
    - 템플릿/채널 팝업에 Aidot형 settings-form modal class를 분리 적용
    - 닫기 버튼 표시를 `닫기` 텍스트가 아니라 `×` 형태로 변경
  - `apps/studio/styles.css`
    - 템플릿/채널 팝업의 panel 폭, header, close button, body padding, 단일 입력폼 폭을 Aidot 다이얼로그 기준으로 조정
- 이번 단계 의미:
  - 이제 템플릿/채널 팝업은
    - 안쪽 폼만 Aidot형
    - 이 아니라
    - 바깥 다이얼로그 컨테이너까지 Aidot형 크기와 헤더를 따르는 상태
    - 로 정렬됐다.

## 2026-06-23 14:31 KST

### 단일 입력형 관리자 팝업의 하단 액션 버튼을 표준 기준으로 우측 정렬 통일

- 신산님 요청:
  - 공통변수 추가, 템플릿 등록 같은 단일 입력형 팝업의 `취소 / 확인` 버튼이 앞쪽에 붙어 보이는 문제를 표준 기준으로 정리
- 반영 범위:
  - `apps/studio/styles.css`
    - `entity-editor-dialog__footer`를 공용 action row로 정의
    - 단일 입력형 관리자 모달(`common-variables`, `default-messages`, `templates`, `channels`)에서는 하단 버튼을 우측 하단으로 정렬하도록 통일
- 이번 단계 의미:
  - 이제 관리자 단일 입력 팝업은 버튼 위치가 들쭉날쭉하지 않고
  - 확인/저장 액션이 우측 하단에 모여 보이는 표준형 배치로 정렬됐다.

## 2026-06-23 20:59 KST

### 템플릿/채널 등록 팝업 폭 축소 및 내부 스크롤 범위 조정

- 신산님 추가 확인:
  - `채널 생성`, `템플릿 등록` 팝업은
  - 입력 폼이 좌우로 너무 넓고
  - 긴 화면에서 스크롤이 팝업 내부가 아니라 바깥 레이어처럼 느껴지는 문제가 있었음
- 반영 범위:
  - `apps/studio/styles.css`
    - `detail-modal--settings-form` 패널 폭을 한 단계 더 축소
    - 본문을 header/body 구조의 grid로 고정
    - 세로 스크롤은 모달 본문 내부에서만 동작하도록 조정
    - 실제 입력 폼 컨테이너 폭도 함께 줄여 좌우 여백 체감을 완화
- 이번 단계 의미:
  - 템플릿/채널 팝업은
  - 화면을 과하게 채우는 넓은 입력폼에서 벗어나
  - 더 좁고 집중된 등록 다이얼로그 형태로 정렬됐다.

## 2026-06-23 21:08 KST

### 템플릿/채널 팝업의 세로 길이와 마지막 필드-버튼 영역 간격 보정

- 신산님 추가 확인:
  - 팝업의 세로 길이가 여전히 길게 느껴지고
  - `사용 여부` 필드가 footer 바로 위에 붙어 보여 레이아웃이 어색했음
- 반영 범위:
  - `apps/studio/styles.css`
    - `settings-form` 계열 textarea 기본 높이를 축소
    - `인증 정보 JSON`, `상세 설명` 높이를 각각 더 짧게 조정
    - 마지막 필드와 하단 버튼 영역 사이에 구분선/상단 여백 추가
- 이번 단계 의미:
  - 채널/템플릿 팝업은
  - 세로로 과하게 늘어진 입력폼 느낌을 줄이고
  - 마지막 `사용 여부` 필드와 버튼 영역이 분리된 표준형 입력 다이얼로그에 더 가깝게 정렬됐다.

## 2026-06-23 21:17 KST

### 템플릿/채널 팝업의 필드 간격과 textarea 높이를 추가 압축

- 신산님 추가 확인:
  - 팝업의 상하 폭이 여전히 커 보였고
  - textarea만 일부 줄인 수준으로는 체감이 부족했음
- 반영 범위:
  - `apps/studio/styles.css`
    - `settings-form` 전용 편집 영역 padding 축소
    - 필드 그룹 gap, label 간격, label 하단 여백 축소
    - input/select 높이를 한 단계 더 낮춤
    - `인증 정보 JSON`, `상세 설명` textarea 높이를 다시 축소
    - footer 상단 여백도 함께 압축
- 이번 단계 의미:
  - 템플릿/채널 팝업은
  - 단순히 폭만 줄인 상태가 아니라
  - 세로 밀도까지 더 촘촘한 등록 다이얼로그 형태로 정리됐다.

## 2026-06-23 21:34 KST

### Brity 매뉴얼 구성 방식을 기준으로 CGA 첫 사용자용 봇 생성 매뉴얼 초안 재작성

- 신산님 지적:
  - Aidot 매뉴얼은 기준 문서로 삼기에 설명 밀도와 완성도가 부족하므로
  - CGA 매뉴얼도 Aidot식이 아니라 Brity 사용자 매뉴얼의 구성과 설명 방식을 기준으로 다시 써야 함
- 확인한 기준:
  - `C:\Users\cyhuh\Downloads\Brity Assistant 사용자 매뉴얼 (v2.2.0 ~ v2.2.2)_\[원본]Brity Assistant 사용자 매뉴얼_v2.2.0_PaaS.docx`
  - Brity 매뉴얼의 `서문 -> 사용 대상 -> 매뉴얼 구성 -> 개요 -> 시작하기 -> 챗봇 생성 및 관리하기` 흐름과
    기능 설명 후 절차를 번호로 안내하는 서술 방식을 확인
- 반영 범위:
  - `docs/manual/cga-user-manual/01_CGA_처음부터_봇_생성까지.md`
    - 기존 Aidot식 테스트 가이드 분위기의 초안을 폐기
    - Brity식 장 구조와 설명 톤으로 문서 전면 재작성
    - 처음 사용자 기준으로 로그인, 그룹 확인, `+ 봇 생성`, 필수 입력, 저장, 생성 확인까지 따라갈 수 있게 정리
- 이번 단계 의미:
  - CGA 사용자 매뉴얼의 첫 문서는
  - 단순 체크리스트가 아니라
  - Brity 계열 사용자 문서처럼 목적, 대상, 절차, 결과 확인이 있는 정식 사용자 매뉴얼 형식으로 출발하게 됐다.

## 2026-06-23 21:46 KST

### Brity식 장 구성으로 `02_CGA_봇_설정.md` 초안 작성

- 이어서 정리한 범위:
  - `봇 생성` 다음 단계인 `봇 설정`
- 작성 기준:
  - Brity 매뉴얼처럼
    - 화면의 목적 설명
    - 하위 메뉴 역할 구분
    - 처음 사용자의 권장 확인 절차
    - 무엇을 수정해도 되고 무엇을 보류해야 하는지
    순서로 서술
- 반영 파일:
  - `docs/manual/cga-user-manual/02_CGA_봇_설정.md`
- 이번 단계 의미:
  - CGA 매뉴얼은
  - `봇 생성`만 설명하는 단일 문서가 아니라
  - Brity식 장 구조를 따라 `봇 설정` 단계까지 순차 문서화가 시작됐다.

## 2026-06-23 22:05 KST

### Brity식 흐름으로 핵심 사용자 매뉴얼 묶음 완성

- 이번에 이어서 작성한 문서:
  - `docs/manual/cga-user-manual/03_CGA_봇_구성.md`
  - `docs/manual/cga-user-manual/04_CGA_봇_제작.md`
  - `docs/manual/cga-user-manual/05_CGA_봇_테스트.md`
  - `docs/manual/cga-user-manual/06_CGA_봇_관리와_버전.md`
  - `docs/manual/cga-user-manual/README.md`
- 작성 원칙:
  - Brity 원본 매뉴얼처럼
    - 단계의 목적
    - 사용 대상
    - 문서 범위
    - 절차형 안내
    - 문제 해결
    - 다음 단계 연결
    구조를 유지
  - 현재 CGA Studio에 실제 존재하는 워크플로우와 버튼만 설명
  - 처음 사용자에게는 무엇을 수정하고 무엇을 보류해야 하는지 분명히 서술
- 이번 단계 의미:
  - CGA 사용자 매뉴얼은
  - `봇 생성 -> 봇 설정 -> 봇 구성 -> 봇 제작 -> 봇 테스트 -> 봇 관리/버전`
    흐름까지 한 세트의 기본 사용자 문서 묶음으로 정리됐다.

## 2026-06-23 22:18 KST

### Brity식 사용자 매뉴얼 범위를 운영/관리/WebChat까지 확장

- 추가 작성 문서:
  - `docs/manual/cga-user-manual/07_CGA_봇_평가.md`
  - `docs/manual/cga-user-manual/08_CGA_재학습.md`
  - `docs/manual/cga-user-manual/09_CGA_분석.md`
  - `docs/manual/cga-user-manual/10_CGA_관리자_기능.md`
  - `docs/manual/cga-user-manual/11_CGA_WebChat_사용.md`
  - `docs/manual/cga-user-manual/README.md` 갱신
- 정리한 범위:
  - 제작 이후의 평가, 운영 개선, 관리자 기능, 실제 WebChat 사용 흐름
- 이번 단계 의미:
  - CGA 사용자 매뉴얼은
  - 초기 제작 단계만이 아니라
  - 운영/관리/WebChat까지 포함한 1차 전체 세트로 확장됐다.

## 2026-06-23 22:31 KST

### CGA 사용자 매뉴얼 부록 세트 추가

- 추가 작성 문서:
  - `docs/manual/cga-user-manual/12_CGA_FAQ.md`
  - `docs/manual/cga-user-manual/13_CGA_용어집.md`
  - `docs/manual/cga-user-manual/14_CGA_운영자_체크리스트.md`
  - `docs/manual/cga-user-manual/15_CGA_예제_시나리오.md`
  - `docs/manual/cga-user-manual/README.md` 갱신
- 반영 내용:
  - 처음 사용자 질문에 대응할 수 있도록 FAQ 추가
  - 그룹/버전/운영 버전/WebChat 등 핵심 용어를 빠르게 찾을 수 있도록 용어집 추가
  - 운영 전 점검용 체크리스트 추가
  - 실제 따라가기 예제 시나리오 추가
- 이번 단계 의미:
  - CGA 사용자 매뉴얼은
  - 본문 장들만 있는 상태를 넘어서
  - FAQ, 용어집, 체크리스트, 예제 시나리오를 갖춘 1차 완성본 형태로 정리됐다.

## 2026-06-23 23:10 KST

### 버전 개념 정정: 작업 버전과 운영 버전 분리

- 신산님 지적 기준으로 `버전 하나가 실제 작업/반출입 대상`이고, `WebChat은 운영 버전만 연결`된다는 개념을 다시 정리했다.
- 코드 반영:
  - `apps/studio/app.js`
  - `봇 관리` 화면에 `작업 버전`과 `운영 버전`을 분리 표기
  - 버전 목록에 `작업 열기` 추가
  - `버전 추가`, `버전 복사` 시 운영 버전을 자동 변경하지 않도록 수정
  - 패키지 버튼 의미를 `대상 단위`가 아니라 `패키지 형식(Aidot/CGA)` 차이로 드러나게 수정
  - 작업 스냅샷을 `봇 + 버전` 기준으로 저장하도록 보강
- 문서 반영:
  - `docs/manual/cga-user-manual/06_CGA_봇_관리와_버전.md`
  - `docs/manual/cga-user-manual/11_CGA_WebChat_사용.md`
  - `docs/manual/cga-user-manual/12_CGA_FAQ.md`
  - `docs/manual/cga-user-manual/13_CGA_용어집.md`
- 이번 단계 의미:
  - 이제 CGA는 최소한 화면과 매뉴얼 수준에서
  - `작업 버전`, `운영 버전`, `패키지 형식`, `WebChat 연결 대상`
  - 이 네 가지를 서로 다른 개념으로 구분해서 테스트할 수 있는 상태로 정리됐다.

## 2026-06-26 13:35 KST

### Postgres 저장소 1단계 전환

- 서버 운영 기준을 `shared-db` / `cga` 데이터베이스 / `postgres` 계정으로 확정했다.
- 코드 반영:
  - `scripts/serve-studio.js`
  - `CGA_STORAGE_DRIVER=postgres`일 때 `psql` 기반 Postgres key-value 저장소를 우선 사용하도록 추가
  - 대상 컬렉션:
    - access/auth/session
    - workspace bots
    - studio/composition/detail assets
    - operations/collaboration
    - webchat rooms
    - admin resources
    - asset transfer history
  - DB에 값이 없으면 기존 `.cga-data/*.json`를 1회 읽어 DB로 이관한 뒤 계속 DB를 사용하도록 구성
  - DB 저장 시 파일 미러도 함께 유지해 긴급 롤백과 운영 확인을 쉽게 했다.
- 배포 반영:
  - `Dockerfile`
    - `postgresql-client` 추가
  - `docker-compose.yml`
    - `.env` 로드
    - DB 환경변수 추가
    - `proxy-network`, `common_default` 외부 네트워크 연결
  - `docker-compose.prod.yml`
    - 서비스명을 `studio`로 정정
    - 운영형 DB 저장 모드 고정
  - `.env.example`
    - Postgres 환경변수 추가
- 이번 단계 의미:
  - CGA는 더 이상 파일 저장 전용 구조가 아니라
  - 동일 서버의 Postgres를 사용하는 운영형 저장 구조로 진입할 수 있게 됐다.
  - 다만 현재 스키마는 정규화 테이블이 아니라 `cga_state_store` 단일 저장소 기반 1단계 구조이며,
  - 이후 봇/버전/이력/운영 데이터를 도메인 테이블로 분리하는 2단계 정규화가 남아 있다.

## 2026-06-26 14:40 KST

### 오라클 클라우드 운영 배포 기준 문서화

- 서버 운영 기준을 실제 배포 절차 문서로 정리했다.
- 반영 파일:
  - `README.md`
  - `.env.server.example`
  - `docs/cga-oracle-cloud-deploy.md`
- 반영 내용:
  - `cga.sinsan.kr` 기준 운영 배포 흐름 정리
  - `shared-db` / `cga` / `postgres` 사용 기준 명시
  - 운영용 `.env`는 저장소 예시와 서버 실값을 분리하도록 정리
  - `docker-compose.yml` + `docker-compose.prod.yml` 결합 실행 순서 정리
  - Nginx Proxy Manager 포워딩 기준과 DB 확인 쿼리 추가
- 이번 단계 의미:
  - 이제 신산님이 서버에서
  - `.env` 작성
  - compose 검증
  - 컨테이너 기동
  - 프록시 연결
  - DB 반영 확인
  - 재배포
  - 장애 점검
  - 까지 한 문서로 따라갈 수 있는 상태가 됐다.

## 2026-06-27 15:20 KST

### 운영 배포 실측 결과 기준 메뉴얼 보정

- 실제 서버 배포와 접속 점검 결과를 기준으로 문서 표현을 수정했다.
- 반영 파일:
  - `README.md`
  - `docs/cga-oracle-cloud-deploy.md`
  - `docs/cga-studio-user-guide-ko.md`
  - `docs/manual/cga-user-manual/01_CGA_처음부터_봇_생성까지.md`
- 반영 내용:
  - `docker-compose` 표기를 서버 실환경에 맞게 `docker compose`로 수정
  - Nginx Proxy Manager의 `Forward Hostname / IP` 기준을 `cga-studio`로 명시
  - 운영 접속 주소를 `https://cga.sinsan.kr` 기준으로 수정
  - 빠른 가이드의 오래된 기준일/커밋/미검증 항목 표현 정리
  - `+ 봇 생성`과 좌측 `01 봇 생성` 메뉴의 차이를 처음 사용자 관점에서 설명
- 이번 단계 의미:
  - 이제 신산님이 메뉴얼대로 따라가다가
  - compose 명령 차이
  - 프록시 대상 혼동
  - 봇 생성 진입 방식 혼동
  - 같은 실제 운영 기준 오류로 다시 막힐 가능성을 줄였다.

## 2026-06-27 15:55 KST

### 작업공간 입력/목록 레이아웃 긴급 보정

- 작업공간 홈과 봇 생성 화면에서 실제 사용 중 막히는 UI 오류를 우선 수정했다.
- 반영 파일:
  - `apps/studio/app.js`
  - `apps/studio/index.html`
  - `apps/studio/styles.css`
- 반영 내용:
  - `그룹 선택` 셀렉트 박스 높이와 내부 패딩을 보정해서 텍스트 잘림 현상을 줄였다.
  - 작업공간 `그룹 봇 목록` 표에서 남는 높이 때문에 각 행이 비정상적으로 커지던 문제를 `command-table` 정렬 방식으로 보정했다.
  - `01 봇 생성` 화면에서 `봇 이름`, `버전 이름` 입력 시 전체 화면이 다시 렌더링되며 입력이 끊기던 문제를 수정했다.
  - 스타일 캐시가 남지 않도록 `styles.css` 버전 쿼리를 갱신했다.
- 이번 단계 의미:
  - 이제 신산님이 실제 운영 화면에서
  - 봇 목록을 읽기 어려울 정도로 큰 행 높이
  - 그룹 선택 입력 잘림
  - 봇 이름 입력 중 포커스 끊김
  - 같은 기본 UI 막힘 없이 다음 점검을 진행할 수 있는 상태로 맞추는 단계다.

## 2026-06-28 01:40 KST

### 새 봇 draft 진입 시 기존 봇 설정 오염 차단

- `+ 봇 생성` 동선과 봇 전환 시 상태 오염 문제를 우선 수정했다.
- 반영 파일:
  - `apps/studio/app.js`
  - `scripts/serve-studio.js`
- 반영 내용:
  - 작업공간에서 `+ 봇 생성`을 누르면 기존 선택 봇을 그대로 들고 가는 대신
    새 draft 봇 레코드를 만든 뒤 `01 봇 생성`으로 진입하도록 수정했다.
  - 새 draft 생성 직후에는 studio state / composition / detail assets / operations 상태를 빈값 기준으로 초기화해서
    이전 봇의 설정값, 메시지, 룰, 스몰토크가 새 봇에 따라붙지 않도록 차단했다.
  - 봇 선택 전환 시에는 운영/협업 상태만 새로 읽던 구조를 바꿔
    studio state / composition / detail assets / operations / collaboration / API registry 전체를 다시 읽도록 보강했다.
  - 서버 기본값에서 빈 봇 이름을 강제로 `New Bot`으로 채우던 처리도 제거해서
    새 draft의 `봇 이름` 입력란이 실제로 빈 상태로 열리도록 수정했다.
- 검증:
  - `node --check apps/studio/app.js`
  - `node --check scripts/serve-studio.js`
  - `git diff --check`
  - `npm run studio:check`
  - 로컬 스튜디오 서버 재시작 후
    `봇 작업공간 > + 봇 생성 > 01 봇 생성` 브라우저 검증으로
    `봇 이름` 입력란이 빈 상태로 열리는 것을 확인했다.
- 이번 단계 의미:
  - 이제 신산님이 새 봇을 만들 때
  - 이전 봇 이름/설정값이 섞여 보이는 문제
  - 새 봇인데 과거 룰/메시지/자산이 같이 저장되는 문제
  - 봇 전환 후 설정 화면이 다른 봇 데이터를 보여주는 문제
  - 를 줄이고 실제 Aidot식 draft 생성 흐름에 더 가깝게 점검할 수 있는 상태가 됐다.

## 2026-06-28 02:23 KST

### `02 봇 설정` Aidot 하위 화면 스타일 복원 진행

- `02 봇 설정` 내부의 Aidot 하위 화면들을 CGA 공용 카드 스타일이 아니라
  Aidot 스타일 클래스 기준으로 다시 맞추는 작업을 진행했다.
- 반영 파일:
  - `apps/studio/app.js`
  - `apps/studio/styles.css`
- 반영 내용:
  - `메시지 설정`, `메신저 편의 기능`, `추천 의도`, `제외/무시 목록 설정`,
    `룰 설정`, `스몰토크`, `봇스테이션` 화면이
    Aidot에서 쓰는 아코디언/리스트/상세카드/테이블 구조에 가깝게 보이도록
    누락된 스타일 클래스를 추가했다.
  - `settings-toolbar`, `settings-master-detail`, `settings-list-card`,
    `settings-message-item`, `settings-accordion`, `botstation-settings`
    계열 스타일을 복원해 하위 화면 간 외형 일관성을 맞췄다.
  - `연계` 구역 서브메뉴에 `스몰토크`가 중복 노출되던 버그를 수정해
    `봇스테이션`만 보이도록 정리했다.
- 검증:
  - `node --check apps/studio/app.js`
  - `git diff --check`
  - `npm run studio:check`
  - `http://127.0.0.1:4173/#configure` 브라우저 재확인으로
    `02 봇 설정` 메인 화면이 깨지지 않고 렌더링되는 것을 확인했다.
- 남은 점검:
  - Aidot 실제 컴포넌트 기준으로 각 하위 화면의 입력/선택/저장 로직을
    화면 구조뿐 아니라 데이터 흐름까지 더 세밀하게 맞추는 작업이 이어서 필요하다.

## 2026-06-28 02:45 KST

### `AI 모델 설정` / `기본값 설정` 실제 기본값 연결 및 캐시 갱신

- `02 봇 설정`의 상단 두 화면이
  빈칸/임시 텍스트 위주로 보이던 문제를 줄이기 위해
  Aidot 기본 규칙 기준의 실제 기본값과 현재 상태값을 연결했다.
- 반영 파일:
  - `apps/studio/app.js`
  - `apps/studio/index.html`
- 반영 내용:
  - `AI 모델 설정`에서
    - 언어
    - NLU 방식
    - NLU 모델
    - 답변 방식
    이 `미설정`만 보이던 상태를 정리하고,
    현재 CGA 구조 선택값 기준으로 `ML / DeepLearning Lite / 정해진 답변` 등
    Aidot 기본 조합이 보이도록 맞췄다.
  - `기본값 설정`에서
    - 의도파악 Cut-off Score
    - 유사의도 Score
    - QA 설정
    - 세션/대화 제어
    - Validation / Oversampling / 버튼 선택 옵션
    을 Aidot 기본 설정값 기준으로 채워
    실제 점검 가능한 화면으로 바꿨다.
  - 브라우저가 이전 `app.js`, `styles.css`를 캐시해
    수정 화면이 안 보이던 문제를 막기 위해
    `apps/studio/index.html`의 정적 리소스 버전 쿼리를 갱신했다.
- 검증:
  - `node --check apps/studio/app.js`
  - `git diff --check`
  - `npm run studio:check`
  - `http://127.0.0.1:4173` `200`
  - 브라우저에서
    - `AI 모델 설정` 화면에 `ML / DeepLearning Lite / 정해진 답변` 반영 확인
    - `기본값 설정` 화면에 `0.75 / 0.85 / 3 / 120` 등 기본값 반영 확인
    - `02 봇 설정` 서브메뉴 중복 `스몰토크` 제거 확인

## 2026-06-28 03:10 KST

### `메시지 설정` 임시 반복 화면 제거 및 Aidot 섹션 구조 복원

- `02 봇 설정 > 메시지 설정`이
  제목 배열만 반복 렌더링하는 임시 화면이라
  빈 textarea, `0/100` 카운터, 가짜 예시 중심으로 보이던 문제를 정리했다.
- 반영 파일:
  - `apps/studio/app.js`
- 반영 내용:
  - Aidot 기준의 메시지 섹션 구조로 재구성:
    - `기본 메시지(4)`
    - `유사의도/되묻기(2)`
    - `대화 종료(4)`
    - `의도 전환/복귀(3)`
    - `대기업무 메시지`
    - `피드백 수집`
  - 각 섹션에
    Aidot 기본 메시지값을 실제 문자열로 연결해
    빈칸/가짜 placeholder 대신
    현재 검토 가능한 기본값이 보이도록 맞췄다.
  - `의도 전환`, `대기업무`, `피드백 수집`도
    Aidot 화면 구조에 맞춰
    단순 반복 카드가 아니라 의미 단위 폼으로 분리했다.
- 검증:
  - `node --check apps/studio/app.js`
  - `git diff --check -- apps/studio/app.js`
  - `npm run studio:check`
  - `http://127.0.0.1:4173/?cache=20260628-1#configure` `200`

## 2026-06-28 03:30 KST

### `메신저 편의 기능` / `추천 의도` / `제외/무시 목록` / `룰 설정` / `스몰토크` 화면 구조 2차 정리

- `02 봇 설정`의 나머지 하위 화면들에도
  Aidot와 어긋나는 상시 우측 입력폼/가짜 편집 패널이 남아 있어
  목록 중심 구조로 다시 정리했다.
- 반영 파일:
  - `apps/studio/app.js`
- 반영 내용:
  - `메신저 편의 기능`
    - 목록 행의 버튼명 클릭 구조와 사용 토글 표기를 Aidot형에 가깝게 정리
    - 상시 노출되던 가짜 우측 편집 카드 제거
  - `추천 의도`
    - Aidot처럼 목록 선택 상태가 보이도록 기본 선택 스타일 정리
  - `제외/무시 목록`
    - 우측 상시 입력폼 대신
      테스트 문장 / 매칭 결과 중심 카드로 전환
    - 목록명은 Aidot처럼 링크 버튼 형태로 정리
  - `룰 설정`
    - 상시 입력폼 대신
      리스트 + 정규식 테스트 영역 중심 구조로 정리
  - `스몰토크`
    - 상시 상세 입력폼 제거
    - 목록/사용 상태 중심으로 정리
- 검증:
  - `node --check apps/studio/app.js`
  - `git diff --check -- apps/studio/app.js`
  - `npm run studio:check`

## 2026-06-28 03:55 KST

### `메신저 편의 기능` / `룰 설정` / `스몰토크` / `봇스테이션` 상세 레이어 구조 복원

- Aidot 대비 아직 부족했던
  상세 팝업/상세 레이어 구조를
  CGA 쪽 `02 봇 설정`에도 다시 붙였다.
- 반영 파일:
  - `apps/studio/app.js`
  - `apps/studio/styles.css`
- 반영 내용:
  - `메신저 편의 기능`
    - Aidot의 `플로팅 버튼` 상세 다이얼로그 구조를
      인라인 레이어 형태로 복원
  - `룰 설정`
    - `룰 상세 정보` 다이얼로그 구조를 복원하고
      `룰 이름 / 설명 / 표현식 / 정규식 테스트 / 연결 대상 / 사용 여부` 필드를 정리
  - `스몰토크`
    - Aidot의 대형 상세 다이얼로그 구조를 복원
    - `스몰토크 이름`, `우선순위`, `사용자 메시지`, `봇 메시지` 패널 구성을 반영
  - `봇스테이션`
    - 채널 목록 하단에
      Aidot `채널 연결 정보` 상세 레이어 구조를 복원
  - 스타일
    - `settings-dialog`
    - `settings-dialog--wide`
    - `settings-dialog--smalltalk`
    - `settings-message-panel`
    - `botstation-dialog`
    등 Aidot 상세 레이어에 필요한 스타일을 추가
- 검증:
  - `node --check apps/studio/app.js`
  - `git diff --check -- apps/studio/app.js apps/studio/styles.css`
  - `npm run studio:check`

## 2026-06-28 04:18 KST

### `02 봇 설정` 상세 레이어 가짜값 제거 및 현재 데이터 기준 정렬

- Aidot 형태를 따라가던 상세 레이어 안에
  임시 예시 문장, 임의 선택 강조, 섞여 보이는 샘플 값이 남아 있어서
  실제 데이터 기준으로 다시 정리했다.
- 반영 파일:
  - `apps/studio/app.js`
- 반영 내용:
  - `메신저 편의 기능`
    - 플로팅 버튼의 `actionType / actionValue / enabled / sortOrder`를 정규화
    - 선택 강조가 전체 활성 항목에 잘못 붙던 문제를
      첫 선택 항목 기준으로 정리
  - `제외/무시 목록 설정`
    - 하드코딩된 테스트 문장(`광고 링크...`) 제거
    - 결과 영역을 실제 테스트 대기 문구 기준으로 변경
  - `룰 설정`
    - 하드코딩된 테스트 결과 문구를 제거
    - 선택된 룰만 강조되도록 정리
  - `스몰토크`
    - `userMessages / botMessages` 배열이 있으면 그대로 표출
    - 단일 `trigger / response`만 있던 예전 표시를 실제 메시지 목록 기준으로 변경
  - `봇스테이션`
    - 채널 목록 `설정정보`를 코드값 대신 연결 상태 문구로 정리
    - 상세 팝업의 빈 필드는 빈 값 그대로 유지하고
      가짜 예시값을 추가하지 않도록 정리
- 검증:
  - `node --check apps/studio/app.js`
  - `git diff --check -- apps/studio/app.js`
  - `npm run studio:check`

## 2026-06-28 04:34 KST

### `AI 모델 설정` / `기본값 설정` 하드코딩 값 제거

- `02 봇 설정`의 상단 두 화면이
  실제 저장값이 아니라 임의 기본 수치로 보이던 문제를 정리했다.
- 반영 파일:
  - `apps/studio/app.js`
- 반영 내용:
  - `AI 모델 설정`
    - `ai_config`, `conversation_defaults`, `configuration_scoring` 계열 추가 필드가 있으면 그 값을 우선 사용
    - 값이 없으면 임의 숫자를 넣지 않고 `미설정` 기준으로 표출
    - Vector DB, 자동분류 가중치 영역도
      모드와 저장값 기준으로만 표시하도록 정리
  - `기본값 설정`
    - Cut-off, QA, 타임아웃, 모듈 연결, Validation, Oversampling, 버튼 선택 옵션에 남아 있던
      임의 숫자/선택값 제거
    - boolean / option 필드는 `미설정` 상태를 명시적으로 표출하도록 정리
- 검증:
  - `node --check apps/studio/app.js`
  - `git diff --check -- apps/studio/app.js`
  - `npm run studio:check`

## 2026-06-28 04:43 KST

### `메시지 설정` 예시 문구 축소 및 기본 메시지 자원 연계

- `메시지 설정` 화면에 남아 있던
  임의 예시 문구를 줄이고,
  관리자 `기본 메시지 관리` 자원과 연결 가능한 항목은 우선 그 값을 읽도록 정리했다.
- 반영 파일:
  - `apps/studio/app.js`
- 반영 내용:
  - 봇 언어 기준으로 `default_messages` 자원을 조회하는 헬퍼 추가
  - 아래 항목은 자원값이 있으면 그 값을 사용하고,
    없으면 빈값으로 표출
    - `의도 미분류 메시지`
    - `버튼 오류 메시지`
    - `다중 의도 선택 안내`
    - `원하는 의도 없음 메시지`
    - `시스템 오류 메시지`
    - `타임아웃 메시지`
    - `세션 종료 메시지`
    - `진행 중 대화 안내`
    - `대화 흐름 실행 한도 초과 메시지`
  - 따라서 이제 `메시지 설정` 화면에서
    어울이 임의로 만든 문장이 기본값처럼 보이지 않도록 정리
- 검증:
  - `node --check apps/studio/app.js`
  - `git diff --check -- apps/studio/app.js`
  - `npm run studio:check`

## 2026-06-28 04:55 KST

### `AI 모델 설정` 상단 구조를 Aidot 카드 레이아웃 기준으로 재배치

- `02 봇 설정 > AI 모델 설정`이
  값은 어느 정도 정리됐지만
  화면 구조는 아직 Aidot 원형과 차이가 커서,
  Aidot가 사용하는 카드형 레이아웃 클래스를 CGA에 직접 반영했다.
- 반영 파일:
  - `apps/studio/app.js`
  - `apps/studio/styles.css`
- 반영 내용:
  - `AI 모델 설정`
    - `생성 정보`를 `bot-settings-card` 기반 카드 영역으로 재배치
    - `언어 / NLU 방식 / NLU 모델 / 답변 방식 / 버전 수`를 Aidot형 카드 묶음으로 정리
    - `선택 조합` 요약 박스를 Aidot 스타일에 맞춘 compact 박스로 정리
    - Vector DB / 자동분류 가중치 영역도 Aidot `bot-settings-vector` 카드 묶음 구조로 재배치
    - 소개 입력란 역시 Aidot `bot-settings-intro` 형식으로 정리
  - 스타일
    - `bot-settings-grid`
    - `bot-settings-card`
    - `bot-settings-vector`
    - `bot-ai-combinations`
    - `bot-settings-intro`
    계열 스타일을 Aidot 기준으로 추가
- 검증:
  - `node --check apps/studio/app.js`
  - `git diff --check -- apps/studio/app.js apps/studio/styles.css`
  - `npm run studio:check`
