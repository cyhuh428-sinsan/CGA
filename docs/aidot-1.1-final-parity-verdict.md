# Aidot 1.1 / contract v1.0 최종 호환 판정서

## 목적

- 이 문서는 2026-06-23 기준으로 CGA가 `Aidot 1.1 / contract v1.0` 범위에서 어디까지 호환을 확보했는지 최종 판정 형태로 정리한다.
- 핵심은 “100% 호환 완료”를 섣불리 선언하는 것이 아니라,
  - 자동 검증으로 닫힌 범위
  - 수동 smoke로 남은 범위
  - 현재 안전하게 말할 수 있는 운영 판정
  - 을 분리해 명확히 적는 것이다.

## 기준선

- Aidot 기준 소스:
  - `D:\Project\cga\Aidot\apps`
- 제품 기준:
  - `Aidot 1.1` 동결 구조와 의미
- 계약 기준:
  - `contract v1.0 = Aidot 1.1`

## 최종 판정 요약

- 판정:
  - `Aidot 1.1 / contract v1.0 호환 확보`
- 의미:
  - package import/export
  - WebChat channel / fallback / history 의미
  - Studio conversation-history wiring
  - Aidot full WebChat 실제 클릭 UX smoke
  - 까지 확인되어 in-scope 범위의 호환이 확보됐다.
- 범위 밖으로 남는 것:
  - 일부 광범위한 외부 채널/전체 AM parity
  - contract v1.0 밖의 상위 기능

## 자동 검증으로 닫힌 범위

### 1. package import/export 호환

- `bot`
- `version`
- `dialog`
- `api`
- `dictionary`
- `blocklist`
- 상위 버전 pruning / blocked / unknown field 보존

근거:

- `npm run studio:asset-api-check`
- `npm run studio:asset-transfer-check`
- `npm run studio:config-check`

### 2. WebChat backend 호환

- `connect`
- `bots`
- `rooms`
- `room detail`
- `messages`
- legacy path fallback
- 동일 `client_room_id` 재사용
- rich sample / `options` / `sourceTalkNodeId`
- session end / reopen

근거:

- `npm run studio:webchat-channel-check`
- `npm run studio:webchat-message-shape-check`
- `npm run studio:webchat-message-bridge-check`
- `npm run studio:webchat-session-ended-check`
- `npm run studio:webchat-ui-check`

### 3. 최신 Aidot WebChat fallback 의미 호환

- `AM 우선 -> channel fallback`
- room create / chat / end / delete / reopen
- 진행 중 대화도 운영 이력에서 `open` 상태로 조회
- 종료 후 closed 상태 전환

근거:

- `npm run studio:aidot-webchat-latest-flow-check`
- `npm run studio:admin-conversations-check`

### 4. 운영 이력 조회 의미 호환

- `/api/v1/admin/conversations`
- WebChat + Simulator 병합 조회
- `messages`
- `transcript`
- `runtime_events`
- `runtime_summary`
- `session_user_utterances`
- rich form `display_text`
- `options`
- `sourceTalkNodeId`

근거:

- `npm run studio:admin-conversations-check`

### 5. Studio 운영 화면 연결

- `/api/v1/admin/conversations` 기반 wiring
- 채널/date filter
- row mapping
- system-admin subview deep-link
- 로그인 후 `conversation-history` 딥링크 복원

근거:

- `npm run studio:conversation-history-ui-check`
- `npm run studio:access-subview-hash-check`
- 실브라우저 로그인 후 `#access-management?subview=conversation-history` 유지 확인

## 수동 smoke로 확인 완료된 범위

### 1. Aidot full WebChat 실제 UX

- 연결 테스트 버튼
- 채팅방 생성 버튼
- 실제 입력/전송
- rich form 클릭 응답
- room 삭제/종료 버튼 체감 흐름

상태:

- 실행 경로 확보 완료
- 실제 브라우저 smoke 통과

근거 문서:

- `docs/aidot-full-webchat-manual-smoke.md`
- `docs/aidot-full-webchat-smoke-result-template.md`

실행 경로:

- `npm run studio:aidot-full-webchat-preflight-check`
- `npm run studio:aidot-full-webchat-smoke`

### 2. 넓은 범위의 상위 기능

- Kakao / Teams 등 외부 채널 전체
- Aidot AM/session 전체 parity의 모든 변형 케이스

상태:

- `contract v1.0` 기준에서는 범위 밖 또는 부분 검증

## 지금 안전하게 말할 수 있는 결론

- 다음 표현은 안전하다.
  - `CGA는 Aidot 1.1 / contract v1.0 기준에서 package import/export, WebChat backend, 운영 이력 조회 의미 호환을 자동 검증으로 확보했다.`
  - `최신 Aidot WebChat의 AM 우선 fallback과 진행 중 대화 이력 조회 구조까지 CGA 자동 검증 범위에 포함했다.`
  - `Aidot full WebChat 실제 클릭 smoke도 통과해 contract v1.0 in-scope 범위의 호환이 닫혔다.`

- 다음 표현은 아직 이르다.
  - `모든 Aidot 상위 버전과 무조건 100% 호환 완료`
  - `모든 외부 채널/AM 전체 흐름까지 완전 동일`

## 현재 권장 운영 판정

- 운영 판정:
  - `배포 가능`
- 근거:
  - full WebChat 수동 smoke 통과
  - 결과를 `docs/aidot-full-webchat-smoke-result-template.md` 형식으로 기록
  - 결과를 `docs/cga-work-progress.md`에 기록

## 최종 체크리스트

- 자동 검증:
  - `npm run studio:validate`
- full WebChat 기동 점검:
  - `npm run studio:aidot-full-webchat-preflight-check`
- full WebChat 수동 smoke:
  - `npm run studio:aidot-full-webchat-smoke`
  - 이후 `docs/aidot-full-webchat-manual-smoke.md` 절차 수행
  - 수행 결과는 `docs/aidot-full-webchat-smoke-result-template.md`에 기록

## 결론

- 현재 CGA는 `Aidot 1.1 / contract v1.0` 기준에서
  - 구조/의미/API 중심 호환
  - full WebChat 실제 사용자 흐름
  - 까지 확인을 마쳤다.
- 따라서 이번 작업의 in-scope 기준에서는
  - `호환 확보`
  - 로 닫는다.
