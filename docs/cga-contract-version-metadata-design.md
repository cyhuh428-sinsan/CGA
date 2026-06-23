# CGA contract_version 메타데이터 설계안

## 목적

- `Aidot 1.1 / contract v1.0` 기준을 CGA 구현에 실제 반영하기 위한 메타데이터 위치를 정의한다.
- 이후 `conversationHistory`, `/api/v1/admin/conversations`, import/export 정책이 같은 버전 기준을 공유하도록 한다.
- 아직 구현 전 단계이므로, 이 문서는 코드 변경 전에 기준을 고정하기 위한 설계안이다.

## 설계 전제

- 공식 기준선은 `Aidot 1.1 = contract v1.0`
- CGA 현재 지원 버전은 `v1.0`
- 향후 Aidot `1.2` 이상 봇이 들어와도, CGA 보장 기능이 유지되면 수용 가능
- 단, 미지원 상위 기능은 제거 또는 무시하고, 핵심 의미 손실 시 차단

## 설계 목표

1. export 파일이 자기 계약 버전을 말할 수 있어야 한다.
2. import 요청이 어떤 계약 기준으로 들어오는지 알 수 있어야 한다.
3. WebChat/session/runtime도 어떤 계약 기준인지 추적 가능해야 한다.
4. 운영 조회 응답도 어떤 계약 기준으로 저장/노출되는지 설명 가능해야 한다.

## 기본 값

- `current_supported_contract_version = "v1.0"`
- `supported_contract_versions = ["v1.0"]`
- 상위 버전 import 기본 정책:
  - `warning + prune_or_ignore`
  - 핵심 의미 손실 시 `blocked`

## 메타데이터 위치 제안

### 1. Bot export JSON

현재 구조:

- `manifest`
- `package`

추가 제안:

```json
{
  "manifest": {
    "package_format_version": 1,
    "scope": "bot",
    "contract_version": "v1.0",
    "supported_contract_versions": ["v1.0"]
  }
}
```

설명:

- `manifest.contract_version`:
  - 이 파일이 어떤 계약 의미로 export됐는지 표시
- `manifest.supported_contract_versions`:
  - 생성 측이 인식하는 지원 계약 범위

### 2. Version document export JSON

현재 구조:

- `asset_format_version`
- `dialogs`
- `dialog_flow_graphs`
- `entities`
- `dictionary`
- `apis`
- `system_config`

추가 제안:

```json
{
  "asset_format_version": 1,
  "contract_version": "v1.0",
  "supported_contract_versions": ["v1.0"]
}
```

설명:

- Version document는 현재 top-level 구조를 유지하면서 `contract_version`만 additive하게 추가
- 기존 `Aidot 1.1` 의미는 바꾸지 않고 메타만 보강

### 3. Asset import 요청 메타

현재 구조:

- scope/path/file format 중심

추가 제안:

- request metadata에 `target_contract_version`
- import 결과에 `resolved_contract_version`
- 상위 기능 제거 시 `pruned_features`

예시:

```json
{
  "request": {
    "target_contract_version": "v1.0"
  },
  "result": {
    "resolved_contract_version": "v1.0",
    "pruned_features": ["kakao_channel", "rich_card_v2"]
  }
}
```

### 4. WebChat room/session 메타

현재 구조:

- room
- messages
- runtime

추가 제안:

- room 생성 시:
  - `contract_version`
  - `supported_contract_versions`
- runtime 응답 시:
  - `resolved_contract_version`

예시:

```json
{
  "room": {
    "id": "room-1",
    "channel_type": "webchat",
    "contract_version": "v1.0"
  },
  "runtime": {
    "resolved_contract_version": "v1.0"
  }
}
```

### 5. conversationHistory 저장 메타

추가 제안:

- room/session 저장 구조에 아래 필드 포함
  - `contractVersion`
  - `sourceProductVersion`
  - `prunedFeatures`
  - `compatibilityStatus`

예시:

```json
{
  "conversationHistory": {
    "contractVersion": "v1.0",
    "sourceProductVersion": "aidot-1.1",
    "compatibilityStatus": "compatible",
    "prunedFeatures": []
  }
}
```

`compatibilityStatus` 후보:

- `compatible`
- `compatible_with_pruning`
- `blocked`

### 6. Admin conversations API 응답 메타

추가 제안:

- 목록 응답 최상위 또는 각 row의 `data_json`에 아래 정보 포함
  - `contract_version`
  - `compatibility_status`
  - `pruned_features`

이유:

- 운영자는 “왜 어떤 기능이 안 보이는지”를 조회 단계에서 바로 알아야 한다.

## 상위 버전 봇 import 판정 규칙

### 기본 흐름

1. 파일의 `contract_version` 확인
2. CGA 지원 버전인지 확인
3. 상위 기능 존재 여부 분석
4. 미지원 기능 제거/무시 가능 여부 판단
5. 핵심 의미 유지 여부 판단
6. 결과 상태 결정

### 결과 상태

- `accepted`
  - 완전 수용
- `accepted_with_pruning`
  - 일부 상위 기능 제거/무시 후 수용
- `rejected`
  - 핵심 의미 손실로 차단

### 핵심 의미 손실 예시

다음 경우는 차단 후보다.

1. 대화 흐름 핵심 노드가 상위 기능에 의존
2. Version document의 필수 의미가 상위 구조 제거로 깨짐
3. WebChat 기본 대화 의미가 복원되지 않음
4. 운영 조회에서 세션 의미를 복원할 수 없음

## 필드 추가 원칙

- 기존 Aidot 1.1 의미 필드는 수정하지 않는다.
- `contract_version` 관련 필드는 additive하게만 추가한다.
- 기존 parser가 무시해도 안전한 위치에 넣는다.

## 단계별 구현 순서

### 1단계

- `manifest.contract_version`
- `manifest.supported_contract_versions`
- version document top-level `contract_version`

### 2단계

- import 요청/응답에 `target_contract_version`, `resolved_contract_version`
- `pruned_features`

### 3단계

- WebChat room/runtime 메타
- `conversationHistory.contractVersion`

### 4단계

- Admin conversations API 응답 메타
- 운영 화면에서 pruning/compatibility 표시

## 현재 코드 기준 즉시 반영 후보

우선 반영이 쉬운 지점:

1. `packages/contracts/src/aidot-package-contract.js`
2. `apps/studio/app.js`의 bot/version export builder
3. `scripts/serve-studio.js`의 asset export/import 응답
4. `scripts/check-asset-transfer-api.mjs`의 계약 버전 검증

## 결론

- `contract_version`은 문서 개념이 아니라 실제 export/import/runtime/history/admin 응답에 박혀 있어야 한다.
- 첫 구현은 가장 영향이 적은 `manifest`와 `version document`부터 시작하는 것이 안전하다.
- 이후 import 결과, WebChat session, conversation history, admin 조회로 확장하는 순서가 가장 안정적이다.
