# CGA 작업 진행 기록

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
