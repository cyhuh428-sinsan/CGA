# Aidot Full WebChat 수동 Smoke 결과 기록서

## 목적

- 이 문서는 `docs/aidot-full-webchat-manual-smoke.md` 절차를 실제로 수행한 뒤,
  - 무엇을 어떤 환경에서 확인했는지
  - 어느 단계가 통과/실패했는지
  - 실패 시 어떤 증상이 있었는지
  - 를 같은 형식으로 남기기 위한 결과 기록서다.
- `Aidot 1.1 / contract v1.0` 최종 판정에서는 이 기록서를 근거 문서로 사용한다.

## 실행 정보

- 실행 일시:
  - `2026-06-23 06:18~06:19 KST`
- 실행자:
  - `어울`
- CGA 작업 경로:
  - `D:\Project\cga`
- Aidot 참조 경로:
  - `D:\Project\cga\Aidot\apps`
- 접속 주소:
  - `http://localhost:3330`
- CGA backend 주소:
  - `http://127.0.0.1:4182`
- 프록시 주소:
  - `http://127.0.0.1:8320`

## 사전 점검

- `npm run studio:validate`:
  - 결과:
    - 통과
- `npm run studio:aidot-full-webchat-preflight-check`:
  - 결과:
    - 통과
- `npm run studio:aidot-full-webchat-smoke`:
  - 결과:
    - 실행 경로 확보 상태 유지
    - 이번 검증은 현재 실행 중인 `4182 / 8320 / 3330` 기준 실브라우저 smoke로 수행

## 단계별 결과

### 1. 연결 테스트

- 결과:
  - `통과`
- 확인 내용:
  - `http://localhost:3330` 접속 후 Aidot backend 연결 상태 정상 확인
  - 연결 기준 서버는 `http://localhost:8320`
- 비고:
  - reload 직후 연결 테스트 패널이 보였고, 연결 확인 후 채팅방 생성 가능 상태로 전환됨

### 2. 채팅방 생성

- 결과:
  - `통과`
- 확인 내용:
  - `채팅방 생성` -> `SupportBot Draft` 선택 후 실제 room 생성 확인
  - 초기 메시지 `SupportBot Draft에 연결되었습니다.` 표시 확인
- 비고:
  - 이번 smoke room id:
    - `a6c2cc10-3b19-4218-ad06-cae41431ff79`

### 3. 일반 질의 전송

- 입력:
  - `I need to reset my password`
- 결과:
  - `통과`
- 확인 내용:
  - bot 응답:
    - `Open Account Settings and choose Reset Password.`
  - full WebChat 화면과 `/api/v1/admin/conversations` 양쪽에서 동일 응답 확인
- 비고:
  - 진행 중 room 상태는 `open`

### 4. RichForm 응답 확인

- 입력:
  - `__CGA_RICH_OPTIONS__`
- 결과:
  - `통과`
- 확인 내용:
  - 화면에 아래 선택지가 실제 버튼으로 렌더됨
    - `예금`
    - `대출`
    - `상담원 연결`
  - `예금` 클릭 후 사용자 발화와 bot 후속 응답이 이어짐
  - room detail API에서 `sourceTalkNodeId = sample-rich-options-node` 유지 확인
- 비고:
  - 실증 중 실제 장애 1건 확인:
    - `/api/am/...` fallback 직전 프록시 CORS 누락으로 `Failed to fetch`
  - 조치:
    - `scripts/proxy-aidot-webchat-to-cga.cjs`에 universal `OPTIONS/CORS` 보강 후 재검증 통과

### 5. 진행 중 운영 이력 조회

- 결과:
  - `통과`
- 확인 내용:
  - `room_status = open`
  - `session_ended = false`
  - transcript/messages 조회 여부
- 비고:
  - `/api/v1/admin/conversations`에서 아래 내용 확인
    - `session_user_utterances`
      - `I need to reset my password`
      - `__CGA_RICH_OPTIONS__`
      - `예금`
    - RichForm options
      - `예금`, `대출`, `상담원 연결`
    - `sourceTalkNodeId`
      - `sample-rich-options-node`

### 6. 세션 종료

- 결과:
  - `통과`
- 확인 내용:
  - 좌측 채팅방 목록의 `채팅방 삭제` 버튼으로 종료 수행
  - full WebChat 화면이 `채팅방이 없습니다.` 상태로 복귀
- 비고:
  - 종료 시각 기준 room `updatedAt`
    - `2026-06-22T21:19:03.233Z`

### 7. 종료 후 운영 이력 조회

- 결과:
  - `통과`
- 확인 내용:
  - `room_status = closed`
  - transcript/messages/runtime summary 유지 여부
- 비고:
  - `/api/v1/channels/webchat/rooms/a6c2cc10-3b19-4218-ad06-cae41431ff79`
    - `status = closed`
  - `/api/v1/admin/conversations`
    - `result = closed`
    - `session_ended = true`
    - `session_end_reason = deleted`
    - transcript/messages/runtime summary 유지 확인

## 최종 판정

- 최종 결과:
  - `통과`
- 판단 이유:
  - Aidot full WebChat 기준으로
    - 연결
    - 채팅방 생성
    - 일반 질의
    - RichForm 표시/선택
    - 진행 중 운영 이력 조회
    - 종료
    - 종료 후 운영 이력 유지
    - 까지 실제 브라우저에서 끊기지 않고 확인했다.
- 잔여 이슈:
  - `MODULE_TYPELESS_PACKAGE_JSON` 경고는 남아 있으나 이번 smoke 실패 원인은 아니었다.
  - 계약 범위 밖 외부 채널 전체 parity는 본 문서 범위에 포함하지 않는다.
- 후속 조치:
  - `docs/aidot-1.1-final-parity-verdict.md`를 완료 판정으로 갱신
  - `docs/cga-work-progress.md`에 이번 smoke 결과와 프록시 CORS 보강을 기록

## 첨부 권장

- 브라우저 캡처 2장 이상
  - 진행 중 대화 화면
  - 종료 후 운영 이력 화면
- 필요 시 API 응답 캡처
  - `/api/v1/admin/conversations`
