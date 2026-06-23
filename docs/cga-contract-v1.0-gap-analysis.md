# CGA contract v1.0 갭 분석서

## 목적

- `Aidot 1.1 / contract v1.0` 합의 초안을 기준으로 현재 CGA가 어디까지 맞았는지 분석한다.
- 막연한 “거의 됐다”가 아니라 `Required / Optional / Out of Scope` 기준으로 갭을 분리한다.
- 이후 구현은 이 문서의 `우선순위` 순서대로 진행한다.

## 기준 문서

- Aidot 측 합의 초안:
  - `D:\Project\Aidot\docs\design\aidot-cga-contract-v1.0-proposal.md`
- CGA 정책 문서:
  - `docs/aidot-cga-version-compatibility-policy.md`
- CGA 단계 계획서:
  - `docs/aidot-latest-parity-step-plan.md`

## 이번 분석의 판단 기준

- `완료`:
  - 코드/검증 스크립트가 이미 존재하고 `contract v1.0` Required 범위를 충족한다고 볼 수 있는 상태
- `부분 충족`:
  - 구조는 들어가 있으나 실제 `Aidot 1.1 의미 계약` 기준으로는 아직 검증이나 연결이 부족한 상태
- `미충족`:
  - 핵심 엔드포인트, 저장 구조, 실제 조회/검증 흐름이 비어 있어 `v1.0 호환`으로 볼 수 없는 상태

## 전체 판단 요약

- 현재 CGA는 `봇 업로드/다운로드`와 `버전 문서 round-trip` 축은 상당 부분 올라와 있다.
- `WebChat 기본 송수신`도 이미 구현과 자동 점검 스크립트가 있다.
- 하지만 `운영 조회`와 `conversation history 의미 계약`은 아직 핵심 Required 범위를 충족하지 못했다.
- 특히 아래 3개는 현재 `contract v1.0 미충족`으로 봐야 한다.
  - `contract_version` 명시/협상
  - `/api/v1/admin/conversations`
  - `conversationHistory` 저장/복원 의미 계약

## 범위별 상태표

| 영역 | contract v1.0 항목 | 현재 상태 | 판단 | 우선순위 |
|---|---|---|---|---|
| Bot Package | 봇 export/import 기본 구조 | 구현 및 점검 스크립트 존재 | 부분 충족 | 중 |
| Bot Package | 필수 필드/기본 해석 규칙 | 다수 자산 왕복 보강 완료 | 부분 충족 | 중 |
| Bot Package | 미지원 상위 기능 처리 | 정책 원칙만 있고 코드 부재 | 미충족 | 상 |
| Version Document | Aidot 1.1형 문서 구조 | 구현 존재 | 부분 충족 | 중 |
| Version Document | round-trip 의미 보존 | 내부 검증 있음, 실샘플 기준은 미완 | 부분 충족 | 중 |
| WebChat | 세션 생성/송수신 | 구현 및 검증 스크립트 존재 | 부분 충족 | 중 |
| WebChat | 세션 의미/종료/이력 연결 | 운영 이력까지 연결 안 됨 | 미충족 | 상 |
| Admin Conversations | 세션 단위 목록/API | 엔드포인트 부재 | 미충족 | 최상 |
| Conversation History | transcript/발화/상태 저장 의미 | 샘플 UI 수준 | 미충족 | 최상 |
| Contract Metadata | `contract_version`/지원 버전 노출 | 문서만 있고 코드 부재 | 미충족 | 최상 |

## 상세 분석

### 1. Bot Package

### 현재 상태

- CGA는 봇 패키지 export/import와 주요 자산 왕복 코드를 이미 가지고 있다.
- 관련 근거:
  - `apps/studio/app.js`
  - `scripts/check-asset-transfer-api.mjs`
  - `packages/contracts/src/aidot-package-contract.js`
- 현재 검증 스크립트:
  - `studio:asset-api-check`

### 확인된 강점

- bot/dialog/version/entity/dictionary/rule/blocklist/api 왕복 점검 축이 이미 있다.
- Aidot형 버전 문서와 보조 자산 키도 상당 부분 반영되어 있다.

### 남은 갭

- `contract_version = v1.0` 메타가 실제 export/import 계약에 명시되지 않았다.
- 미지원 상위 기능을 `경고 + 제거 또는 무시 후 처리`하고, 핵심 의미 손실 시 차단하는 공통 정책이 코드 레벨에서 고정되지 않았다.
- 현재 검증은 CGA 내부 샘플 중심이라, `Aidot 1.1 실 export 파일` 기준 최종 판정이 남아 있다.

### 추가 원칙

- 상위 제품 버전의 봇이라도 CGA 보장 기능이 유지되면 수용 대상이다.
- 따라서 향후 import 구현은 `제품 버전 차단`이 아니라 아래 순서여야 한다.

1. CGA 지원 기능 추출
2. 미지원 확장 기능 제거/무시
3. 핵심 의미 유지 여부 판정
4. 유지되면 경고 후 수용, 아니면 차단

### 판단

- `부분 충족`

## 2. Version Document

### 현재 상태

- `apps/studio/app.js`의 `buildAidotVersionDocument()`와 `applyCgaVersionPackage()`가 Aidot형 문서 구조를 처리한다.
- `dialogs`, `dialog_flow_graphs`, `entities`, `dictionary`, `apis`, `system_config` 등 주요 섹션이 코드에 들어가 있다.

### 확인된 강점

- Aidot형 버전 문서 구조를 export/import 모두 인식한다.
- 기존 CGA 전용 포맷만이 아니라 Aidot형 문서 구조를 같이 다룬다.

### 남은 갭

- 여전히 `contract_version`이 문서 자체에 들어가지 않는다.
- `Aidot 1.1 기준 의미 보존`이 실제 외부 문서 샘플로 판정된 것은 아니다.
- round-trip 성공이 “필드 존재” 수준인지 “운영 의미 동일” 수준인지 더 분리해서 검증해야 한다.

### 판단

- `부분 충족`

## 3. WebChat

### 현재 상태

- WebChat 핵심 API는 존재한다.
- 관련 근거:
  - `scripts/serve-studio.js`
  - `scripts/check-webchat-channel-api.mjs`
- 확인된 API:
  - `/api/v1/webchat/bootstrap`
  - `/api/v1/channels/webchat/rooms`
  - `/api/v1/channels/webchat/rooms/{roomId}/messages`

### 확인된 강점

- 세션 생성과 메시지 송수신의 기본 흐름은 이미 점검 스크립트가 있다.
- `studio:webchat-channel-check`가 현재 검증 세트에 들어가 있다.

### 남은 갭

- `contract v1.0`이 요구하는 세션 의미 계약은 아직 부족하다.
- 현재는 “연결/송수신 성공”에 가깝고, 아래는 아직 약하다.
  - 세션 시작 시각 의미
  - 종료 여부와 세션 종료 의미
  - 대화 이력과의 연결
  - 운영 조회에서 같은 세션으로 복원되는지
- `contract_version` 협상 정보도 WebChat 흐름에 없다.

### 판단

- `부분 충족`

## 4. Admin Conversations

### 현재 상태

- 현재 CGA에는 최신 Aidot 운영 화면이 기대하는 `/api/v1/admin/conversations` 계약이 없다.
- `scripts/serve-studio.js` 기준으로 해당 엔드포인트 구현 흔적이 없다.
- Studio 화면도 실제 API 연동이 아니라 샘플 데이터 기반이다.

### 근거

- `apps/studio/app.js`의 `renderConversationHistorySurface()`는 실제 운영 API를 조회하지 않는다.
- `getConversationHistoryRows()`는 `currentOperationsState.test/operate` 기반의 샘플성 행을 조합한다.

### 남은 갭

- 세션 단위 목록 API 부재
- Aidot형 `data_json` 메타 부재
- simulator 이력과 channel 이력 병합 기준 부재
- 상세 팝업/세션 복원 흐름 부재

### 판단

- `미충족`

## 5. Conversation History

### 현재 상태

- 현재 CGA는 최신 Aidot의 핵심 구조 변화인 `conversationHistory` 누적 저장 구조를 아직 완전히 구현하지 못했다.
- 이 판단은 기존 계획서와 현재 UI/서버 코드를 같이 봤을 때 유지된다.

### 근거

- `docs/aidot-latest-parity-step-plan.md`에 이미 핵심 차이로 기록돼 있다.
- `apps/studio/app.js`의 대화 이력 화면은 실제 transcript/session 누적을 읽는 구조가 아니다.
- `/api/v1/admin/conversations`가 없으므로, 세션 transcript 복원도 실제 계약 기준으로는 연결되지 않았다.

### contract v1.0 기준에서 비어 있는 최소 의미

- 한 행 = 한 세션
- 세션 첫 시각 기준의 발화일시
- 실제 사용자 발화 누적
- 실제 봇 응답 누적
- 시작 모듈 의미
- 종료 여부 / 마지막 상태 구분
- 상세에서 세션 시작부터 종료까지 복원 가능

### 판단

- `미충족`

## 6. contract_version 메타데이터

### 현재 상태

- 현재 CGA 코드에서는 `contract_version`이나 `supported_contract_versions`가 실 구현에 거의 보이지 않는다.
- 이번 검색 기준으로 관련 표현은 정책 문서에만 있고, export/import/API/WebChat 구현에는 없다.

### 의미

- 지금 상태는 “Aidot 1.1 기준으로 맞추자”는 운영 원칙은 생겼지만,
- 실제 데이터나 API가 자기 계약 버전을 말해주지 못하는 상태다.

### 남은 갭

- bot export JSON에 `contract_version`
- version document에 `contract_version`
- 업로드 메타에 `target_contract_version`
- WebChat/session 메타에 계약 버전
- 운영 조회 응답 메타에 지원 계약 버전

### 판단

- `미충족`

## 우선순위 정리

### 최상 우선

1. `contract_version` 메타데이터 설계/반영
2. `/api/v1/admin/conversations` 구현
3. `conversationHistory` 저장 의미 계약 구현

### 상 우선

1. WebChat 세션 의미를 운영 이력과 연결
2. Studio `대화 이력 조회`를 실제 운영 API 기반으로 전환

### 중 우선

1. bot/version export-import에 `v1.0` 명시 추가
2. 미지원 상위 기능 `경고 + 제거 또는 무시 후 처리`, 핵심 의미 손실 시 차단
3. Aidot 1.1 실샘플 기준 round-trip 검증 보강

## 다음 설계 대상으로 넘길 항목

- `contract_version` 메타데이터 설계
- 상위 버전 봇 import 시 기능 유지/제거/차단 판정 규칙
- `핵심 의미 손실` 판정 기준표

## 구현 순서 제안

1. `contract v1.0` 메타데이터 위치 먼저 확정
2. room/session 저장 구조에 `conversationHistory` 추가
3. message/queue 상태가 저장 구조를 갱신하도록 연결
4. `/api/v1/admin/conversations`를 세션 단위로 구현
5. Studio `대화 이력 조회`를 실제 API로 전환
6. WebChat -> 저장 -> 운영 조회까지 한 흐름으로 검증
7. 마지막에 bot/version round-trip과 같이 회귀 검증

## 결론

- 현재 CGA는 `Bot Package`, `Version Document`, `WebChat 기본 송수신`은 기반이 있다.
- 하지만 `contract v1.0 완료`라고 말하려면 아직 이르다.
- 실제로 `v1.0 미충족` 판정이 필요한 핵심은 아래 3개다.

1. `contract_version` 협상 메타
2. `conversationHistory` 저장 의미 계약
3. `/api/v1/admin/conversations` 운영 조회 계약

- 따라서 다음 실제 구현은 위 3개를 중심으로 진행해야 한다.
