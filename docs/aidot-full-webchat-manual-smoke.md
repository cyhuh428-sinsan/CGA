# Aidot Full WebChat 수동 Smoke 체크리스트

## 목적

- 최신 Aidot `apps/webchat` full UI를 CGA backend에 실제로 붙여
  - 연결
  - 채팅방 생성
  - 메시지 송수신
  - 세션 종료
  - 운영 이력 조회
  - 까지를 사람이 짧게 확인할 수 있도록 절차를 고정한다.
- 자동 검증으로 커버되지 않는 `full UI 경험` 범위를 동일한 방식으로 반복 점검하기 위한 문서다.
- 결과 기록은 `docs/aidot-full-webchat-smoke-result-template.md`를 사용한다.

## 기준 경로

- Aidot full WebChat: `D:\Project\cga\Aidot\apps\webchat`
- CGA Studio/backend: `D:\Project\cga`

## 준비

### 빠른 시작

- 한 번에 실행:
  - `npm run studio:aidot-full-webchat-smoke`
- 실행 전 preflight 확인:
  - `npm run studio:aidot-full-webchat-preflight-check`
- 이 스크립트는 아래 3개를 같이 띄운다:
  - CGA Studio/backend `4182`
  - Aidot full WebChat 프록시 `8320`
  - Aidot full WebChat dev server `3330`

1. CGA Studio/backend 실행
   - `npm run studio`
   - 필요 시 별도 포트 사용 예:
   - `set PORT=4182&&node scripts/serve-studio.js`
2. Aidot 기본 서버(`http://localhost:8320`)를 CGA로 연결하는 프록시 실행
   - `npm run studio:aidot-webchat-proxy`
   - 기본 target은 `http://127.0.0.1:4182`
   - 다른 target이 필요하면:
   - `set CGA_TARGET_ORIGIN=http://127.0.0.1:4182&&npm run studio:aidot-webchat-proxy`
3. Aidot full WebChat 실행
   - `cd D:\Project\cga\Aidot\apps\webchat`
   - `npm run dev`
4. 브라우저 열기
   - `http://localhost:3330`
   - dev 환경에서는 `127.0.0.1`보다 `localhost`를 우선 사용
   - 이유: Next dev가 `127.0.0.1` 접근에서 HMR/dev resource cross-origin 경고를 남길 수 있음

## 확인 순서

### 1. 연결 테스트

- 화면에서 `연결 테스트` 클릭
- 기대 결과:
  - 연결 실패 문구가 사라진다
  - 봇 선택 또는 채팅방 생성이 가능해진다
  - server 주소는 `http://localhost:8320` 그대로여도 된다
  - 실제 요청은 프록시를 통해 CGA로 전달된다

### 2. 채팅방 생성

- `채팅방 생성` 클릭
- 기대 결과:
  - `supportbot-draft` 기준 채팅방이 생성된다
  - 첫 bot 안내 메시지가 보인다
  - room 상태는 open이다

### 3. 일반 질의 전송

- 예시 발화:
  - `I need to reset my password`
- 기대 결과:
  - bot 응답이 `Open Account Settings and choose Reset Password.` 로 표시된다
  - session은 계속 유지된다

### 4. RichForm 응답 확인

- 예시 발화:
  - `__CGA_RICH_OPTIONS__`
- 기대 결과:
  - 버튼형 rich form이 표시된다
  - 선택지:
  - `예금`
  - `대출`
  - `상담원 연결`
  - 내부적으로 `sourceTalkNodeId = sample-rich-options-node` 가 유지된다

### 5. 진행 중 운영 이력 조회

- CGA Studio 또는 API에서 확인:
  - `http://127.0.0.1:4182/#access-management?subview=conversation-history`
  - 또는 `/api/v1/admin/conversations`
- 기대 결과:
  - 아직 종료 전이어도 해당 room이 조회된다
  - `room_status = open`
  - `session_ended = false`
  - transcript/messages가 누적된 상태로 보인다

### 6. 세션 종료

- WebChat에서 종료 동작 수행
  - 또는 room 삭제/종료 버튼 사용
- 기대 결과:
  - room 상태가 closed로 바뀐다
  - 새 채팅방 생성이 다시 가능해진다

### 7. 종료 후 운영 이력 조회

- 다시 `대화 이력 조회` 화면 또는 `/api/v1/admin/conversations` 확인
- 기대 결과:
  - 같은 room이 closed 상태로 남아 있다
  - transcript/messages/runtime summary가 유지된다
  - 종료 전 대화 내용이 그대로 조회된다

## 현재 자동 검증과 연결되는 항목

- backend/channel fallback:
  - `npm run studio:aidot-webchat-latest-flow-check`
- admin conversations 의미:
  - `npm run studio:admin-conversations-check`
- Studio 대화 이력 조회 wiring:
  - `npm run studio:conversation-history-ui-check`
- Studio deep-link:
  - `npm run studio:access-subview-hash-check`

## 현재 남아 있는 수동 확인 범위

- full WebChat 화면에서의 실제 UX
- full WebChat에서 버튼/폼 상호작용이 체감상 자연스러운지
- full WebChat 종료 버튼과 CGA room 상태 전환이 실제 사용자 흐름에서 매끄러운지

## 판정 기준

- 위 1~7 단계가 끊기지 않으면
  - `Aidot full WebChat -> CGA 연결 -> 대화 -> 진행 중 이력 조회 -> 종료 후 이력 조회`
  - 수동 smoke 기준 통과로 본다.
- 수행 후에는 반드시
  - `docs/aidot-full-webchat-smoke-result-template.md`
  - 에 결과를 남기고,
  - 요약 결론을 `docs/cga-work-progress.md`
  - 와 `docs/aidot-1.1-final-parity-verdict.md`
  - 에 반영한다.
