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
