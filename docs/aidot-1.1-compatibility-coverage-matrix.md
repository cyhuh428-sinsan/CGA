# Aidot 1.1 호환 검증 범위 매트릭스

## 목적

- 이 문서는 2026-06-22 기준으로 CGA가 `Aidot 1.1 / contract v1.0` 범위에서 어디까지 자동 검증되고 있는지 정리한다.
- 기준선은 `Aidot 1.1 동결 구조와 의미`이며, CGA는 이 기준선에 대해 `하위호환 import`, `보존 가능한 메타 유지`, `미지원 상위 기능 제거/차단` 정책으로 맞춘다.
- 호환 판정은 설명 문장이 아니라 실제 검증 스크립트 통과 여부를 우선 기준으로 본다.

## 상태 구분

- `자동 검증됨`: `npm run studio:validate` 또는 개별 검증 스크립트에서 직접 확인됨
- `부분 검증`: 핵심 shape는 자동 검증되지만, 전체 사용자 경험 또는 모든 변형 케이스가 다 확인된 것은 아님
- `수동 확인 필요`: 설계/코드 기준은 있으나 현재 자동 검증이 없거나 부족함

## 범위 표

| 영역 | 세부 범위 | 상태 | 근거 |
| --- | --- | --- | --- |
| Contract 기준 | `contract v1.0 = Aidot 1.1` 메타, import/export 응답 메타 | 자동 검증됨 | `studio:asset-transfer-check`, `studio:config-check` |
| Version package | `version` import/export round-trip | 자동 검증됨 | `scripts/fixtures/aidot-version-uploaded.json`, `studio:asset-api-check` |
| Version 상위 버전 처리 | pruning, blocked, unknown field 보존 | 자동 검증됨 | `scripts/fixtures/aidot-version-higher-v1_1.json`, `studio:asset-api-check` |
| Bot package | `bot` import/export round-trip | 자동 검증됨 | `scripts/fixtures/aidot-bot-uploaded.json`, `studio:asset-api-check` |
| Dialog package | `dialog` import/export round-trip | 자동 검증됨 | `scripts/fixtures/aidot-dialog-password-reset.json`, `studio:asset-api-check` |
| API package | 기본 API, `apis` only, alias field import/export | 자동 검증됨 | `scripts/fixtures/aidot-api-*.json`, `studio:asset-api-check` |
| TXT 자산 | `dictionary`, `blocklist` import/export | 자동 검증됨 | `scripts/fixtures/aidot-dictionary-uploaded.txt`, `aidot-blocklist-uploaded.txt`, `studio:asset-api-check` |
| Asset transfer history | import/export/blocked 시도 기록 | 자동 검증됨 | `studio:asset-api-check` |
| WebChat 채널 API | `connect`, `bots`, `rooms`, `room detail`, `message`, legacy path | 자동 검증됨 | `studio:webchat-channel-check` |
| WebChat room 재사용 | 동일 `client_room_id` 재요청 시 open room 재사용 | 자동 검증됨 | `studio:webchat-channel-check` |
| WebChat rich sample 응답 | `form`, `options`, `sourceTalkNodeId` 포함 응답 | 자동 검증됨 | `studio:webchat-channel-check` |
| Simple WebChat normalize | payload summary, options, sourceTalkNodeId 정규화 | 자동 검증됨 | `studio:webchat-message-shape-check` |
| Server -> Simple WebChat bridge | 실제 서버 rich sample 응답을 simple helper가 읽는지 | 자동 검증됨 | `studio:webchat-message-bridge-check` |
| Simple WebChat 종료 흐름 | `runtime.sessionEnded`, room closed, 재진입 시 신규 room 생성 | 자동 검증됨 | `studio:webchat-session-ended-check` |
| Admin conversations 목록 | WebChat + Simulator 병합 조회 | 자동 검증됨 | `studio:admin-conversations-check` |
| Admin conversations 상세 의미 | `messages`, `transcript`, `runtime_events`, `runtime_summary` | 자동 검증됨 | `studio:admin-conversations-check` |
| Rich sample 운영 조회 반영 | `form/options/sourceTalkNodeId/display_text` 저장 | 자동 검증됨 | `studio:admin-conversations-check` |
| Conversation history readable text | RichForm 선택 응답의 readable `display_text` / `user_utterances` | 자동 검증됨 | `studio:webchat-channel-check`, `studio:admin-conversations-check` |
| Version asset metadata | 확장 메타 snapshot/save/restore normalize | 자동 검증됨 | `studio:version-asset-metadata-check` |
| Studio 대화 이력 조회 UI wiring | `/api/v1/admin/conversations`, 채널/date filter, row mapping | 자동 검증됨 | `studio:conversation-history-ui-check` |
| Studio system-admin subview deep-link | `#access-management?subview=...` hash restore/navigation | 자동 검증됨 | `studio:access-subview-hash-check` |
| Studio 대화 이력 조회 브라우저 렌더 | 실제 브라우저 상호작용/시각 배치 | 부분 검증 | wiring/API는 자동 검증됨, 전체 브라우저 렌더 검증은 별도 없음 |
| CGA Simple WebChat UI wiring | connect/bots/rooms/detail fallback, message priority, `sourceTalkNodeId`, session end reopen flow | 자동 검증됨 | `studio:webchat-ui-check` |
| Latest Aidot WebChat fallback flow | `AM 우선 -> channel fallback`, room create/chat/end/delete/reopen, admin reflection | 자동 검증됨 | `studio:aidot-webchat-latest-flow-check` |
| 진행 중 대화 이력 조회 | 대화 종료 전에도 admin conversations에서 `open` room / transcript / messages 조회 | 자동 검증됨 | `studio:aidot-webchat-latest-flow-check`, `studio:admin-conversations-check` |
| CGA Simple WebChat 브라우저 렌더 | 실제 브라우저 상호작용/시각 배치 | 부분 검증 | wiring/message flow는 자동 검증됨, 전체 브라우저 렌더 검증은 별도 없음 |
| Aidot full Web UI parity | Aidot 운영 웹 화면과 1:1 픽셀/동작 parity | 수동 확인 필요 | 현재 CGA는 운영 가능 범위 위주로 맞추는 중 |
| Legacy AM/session core flow | legacy bootstrap participants, implicit room create, room detail/list, session end, admin reflection | 자동 검증됨 | `studio:am-session-api-check` |
| AM/session API 전체 parity | Aidot AM API의 전체 세션 흐름 | 부분 검증 | legacy core flow는 자동 검증됨, full parity 자동 검증은 아직 없음 |
| 외부 채널 | Kakao, Teams 등 상위 채널 기능 전체 | 수동 확인 필요 | `v1.0` 기준에서는 pruning/차단 정책 중심 |

## 현재 fixture 기준 자산

- `scripts/fixtures/aidot-version-uploaded.json`
- `scripts/fixtures/aidot-version-higher-v1_1.json`
- `scripts/fixtures/aidot-bot-uploaded.json`
- `scripts/fixtures/aidot-dialog-password-reset.json`
- `scripts/fixtures/aidot-api-uploaded.json`
- `scripts/fixtures/aidot-api-only-custom.json`
- `scripts/fixtures/aidot-api-alias-custom.json`
- `scripts/fixtures/aidot-dictionary-uploaded.txt`
- `scripts/fixtures/aidot-blocklist-uploaded.txt`

## 현재 판단

- CGA는 `Aidot 1.1 / contract v1.0` 기준에서 핵심 package transfer, WebChat 채널 API, 대화 이력 조회 의미 축까지는 자동 검증 기반이 만들어진 상태다.
- 아직 `수동 확인 필요`로 남은 것은 full UI parity, AM 전체 세션 흐름, 상위 외부 채널 전체 동작처럼 범위가 넓거나 제품 경험 수준의 항목들이다.
- 따라서 현재 운영 판단은 다음처럼 두는 것이 안전하다.
  - package import/export 호환: 자동 검증 기준으로 관리
  - webchat/channel/history 의미 호환: 자동 검증 기준으로 관리
  - full UI/운영 경험 parity: 별도 수동 점검 항목으로 관리
