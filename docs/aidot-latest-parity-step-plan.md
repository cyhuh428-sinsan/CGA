# 최신 Aidot 100% 호환 단계별 작업 계획서

## 목적

- 최신 Aidot 변경분을 기준으로 CGA의 `봇 다운로드/업로드/WebChat/운영 조회` 호환성을 단계적으로 검증하고 보강한다.
- 한 번에 전체를 수정하지 않고, 각 단계마다 기준선 확정 -> 구현/보강 -> 검증 -> 기록 순서로 진행한다.
- 특히 최신 Aidot의 구조 변화인 `대화 진행 중에도 조회 가능한 대화 이력 저장 구조`를 호환 범위에 포함한다.

## 작업 원칙

- Aidot 참조 기준은 `D:\Project\cga\Aidot\apps`로 고정한다.
- CGA 작업 범위는 `D:\Project\cga` 안으로 제한한다.
- 한 단계가 끝나기 전에는 다음 단계의 구조 변경을 섞지 않는다.
- 각 단계 완료 시 `docs/cga-work-progress.md`에 결과와 검증 상태를 기록한다.
- `100% 호환` 판단은 추측으로 하지 않고, 실제 파일/API/화면 흐름 기준으로 확인한다.

## 현재 진행 상태 요약

- 1단계 `최신 Aidot 기준선 고정`: 완료
- 2단계 `호환 검증 시나리오 고정`: 완료
- 3단계 `대화 이력 저장 구조 호환`: 완료 기준에 근접했고, 현재 자동 검증 범위에서는 사실상 완료 상태로 관리 중
- 4단계 `운영 조회 API 호환`: `/api/v1/admin/conversations` 핵심 계약은 자동 검증됨
- 5단계 `CGA Studio 운영 화면 연결`: 실제 API wiring은 자동 검증됨, 브라우저 기준 상세 상호작용은 추가 확인 진행 중
- 6단계 `최신 Aidot WebChat 실증`: 완료
- 7단계 `최종 회귀 검증`: 완료

## 현재 남은 핵심 차이

- 이번 계획서의 in-scope 기준에서는 남은 핵심 차이를 모두 닫았다.
- 최신 Aidot full WebChat UI의 실제 연결/대화/종료/운영 이력 흐름까지 실브라우저 smoke로 확인했다.
- 다만 `모든 Aidot 상위 버전` 또는 `외부 채널 전체`까지 일반화해 100% 완료라고 말하는 것은 여전히 범위 밖 판단이다.

## 단계별 계획

### 1단계. 최신 Aidot 기준선 고정

- 현재 상태:
  - 완료
- 반영 근거:
  - 참조 기준을 `D:\Project\cga\Aidot\apps`로 고정
  - `Aidot 1.1 / contract v1.0` 기준을 별도 문서/검증 범위로 고정

- 목표:
  - 이번 호환 작업에서 비교할 Aidot 기준 파일과 계약을 확정한다.
- 확인 범위:
  - `Aidot/apps/api`
  - `Aidot/apps/web`
  - `Aidot/apps/webchat`
- 확인 항목:
  - 봇 다운로드/업로드 관련 계약
  - WebChat 연결/대화 흐름 계약
  - 운영 화면의 대화 이력 조회 API 계약
  - `conversationHistory` 저장 구조
- 완료 기준:
  - “무엇을 맞추면 100% 호환으로 볼 것인지”를 문서 기준으로 고정한다.

### 2단계. 호환 검증 시나리오 고정

- 현재 상태:
  - 완료
- 반영 근거:
  - asset transfer
  - WebChat connect/room/message/session end
  - admin conversations
  - Studio 대화 이력 조회 wiring
  - simple webchat wiring
  - legacy AM/session core flow
  - 까지 검증 스크립트로 분해 완료

- 목표:
  - 실제 검증 순서를 작은 단위 시나리오로 쪼갠다.
- 검증 시나리오:
  - Aidot에서 봇 다운로드
  - CGA에 업로드
  - CGA에서 재다운로드
  - 최신 Aidot WebChat이 CGA에 접속
  - 대화 진행 중 이력 누적
  - 운영 화면에서 대화 이력 조회
- 완료 기준:
  - 단계별로 “성공/실패”를 바로 판단할 수 있는 체크리스트가 준비된다.

### 3단계. 대화 이력 저장 구조 호환

- 현재 상태:
  - 완료 기준에 근접, 자동 검증 기준으로는 사실상 완료
- 반영 근거:
  - room/session 메타 저장
  - transcript/messages/user utterance 누적
  - `sessionEnded`, `completionReason`, room status 반영
  - rich sample의 `display_text`, `options`, `sourceTalkNodeId` 운영 조회 반영

- 목표:
  - 최신 Aidot의 핵심 구조 변화인 `conversationHistory` 저장 방식을 CGA에 맞춘다.
- 구현 대상:
  - room/session 단위 메타 저장 구조
  - 사용자 발화 누적
  - transcript 누적
  - message count / user message count
  - queue 상태/결과 반영
  - 종료 상태와 종료 사유 반영
- 주의:
  - 기존 WebChat 흐름을 깨지 않도록 저장 구조를 추가/호환 방식으로 넣는다.
- 완료 기준:
  - 대화 도중에도 조회 가능한 수준으로 이력 메타가 지속 저장된다.

### 4단계. 운영 조회 API 호환

- 현재 상태:
  - 거의 완료
- 반영 근거:
  - `/api/v1/admin/conversations` 목록/상세 의미 자동 검증
  - WebChat + Simulator 병합 조회 자동 검증
  - `data_json` 내부 conversation/runtime/messages 의미 자동 검증

- 목표:
  - 최신 Aidot 운영 화면이 기대하는 대화 이력 조회 계약을 CGA에 맞춘다.
- 우선 대상:
  - `/api/v1/admin/conversations`
- 포함 항목:
  - 목록 조회 필드
  - `data_json` 내부 session/runtime/conversation 메타
  - simulator 이력과 channel 이력의 병합 기준
- 완료 기준:
  - Aidot 운영 화면이 기대하는 최소 필드와 구조가 CGA 응답에 존재한다.

### 5단계. CGA Studio 운영 화면 연결

- 현재 상태:
  - 대부분 완료
- 반영 근거:
  - 실제 `/api/v1/admin/conversations` 기반 wiring 적용
  - 채널/date filter/초기화/row mapping 자동 검증
  - system-admin subview deep-link까지 보강
- 남은 확인:
  - 브라우저 기준 상세 렌더/상세 보기 흐름

- 목표:
  - CGA Studio의 `대화 이력 조회` 화면을 샘플 데이터 기반이 아니라 실제 운영 조회 API 기반으로 전환한다.
- 포함 항목:
  - 채널 필터
  - 전체 채널에서 simulator/webchat 동시 조회
  - 대화 상세 보기
  - transcript/session 메타 표시
- 완료 기준:
  - Studio 화면에서 실제 저장 이력을 조회할 수 있다.

### 6단계. 최신 Aidot WebChat 실증

- 현재 상태:
  - 완료
- 이미 확인된 범위:
  - CGA backend의 `connect -> bots -> rooms/detail -> message` 흐름
  - `sourceTalkNodeId`, rich sample, `sessionEnded`, 재진입 흐름
  - 대화 종료 전에도 admin conversations에서 `open` room / transcript / messages 조회 가능
  - simple CGA WebChat 화면 기준 기본 상호작용
- 실증 결과:
  - 최신 Aidot `apps/webchat` full 화면이 CGA에 붙은 상태에서
  - 실제 연결/대화/종료/이력 조회까지 통과
- 보강된 실행 경로:
  - `scripts/proxy-aidot-webchat-to-cga.cjs`
  - `npm run studio:aidot-webchat-proxy`
  - 기준으로 Aidot full WebChat 기본 서버(`http://localhost:8320`)를 CGA target으로 브리지 가능
  - 수동 smoke 절차는 `docs/aidot-full-webchat-manual-smoke.md`에 고정
  - 수동 smoke 결과 기록은 `docs/aidot-full-webchat-smoke-result-template.md`에 고정

- 목표:
  - 최신 Aidot WebChat이 CGA에 접속해 실제 대화를 진행하고, 이력이 누적/조회되는지 확인한다.
- 실증 항목:
  - 연결 성공
  - 메시지 송수신
  - 세션 유지
  - 대화 중 저장
  - 대화 종료 후 이력 조회
- 완료 기준:
  - “Aidot WebChat -> CGA 접속 -> 대화 -> 운영 이력 조회”가 끊기지 않는다.

### 7단계. 봇 다운로드/업로드 최종 회귀 검증

- 현재 상태:
  - 완료
- 반영 근거:
  - `bot`, `version`, `dialog`, `api`, `dictionary`, `blocklist`는 fixture 기반 자동 검증 중
- 최종 산출물:
  - `docs/aidot-full-webchat-smoke-result-template.md` 기준 결과 기록 1건
  - `docs/aidot-1.1-final-parity-verdict.md` 판정 업데이트

- 목표:
  - 기존에 맞춰 둔 봇/버전/대화/개체/사전/API/룰/블록리스트 자산 호환이 이번 작업으로 깨지지 않았는지 확인한다.
- 검증 대상:
  - bot
  - version
  - dialog
  - entity
  - dictionary
  - rule
  - blocklist
  - api
- 완료 기준:
  - 기존 asset round-trip 검증과 최신 conversation/history 검증이 동시에 통과하고,
  - full WebChat 수동 smoke 결과가 최종 판정 문서에 기록된다.

## 단계 진행 순서

1. 기준선 고정
2. 검증 시나리오 고정
3. 저장 구조 호환
4. 운영 조회 API 호환
5. Studio 화면 연결
6. Aidot WebChat 실증
7. 전체 회귀 검증

## 의심되는 부분

- 최신 Aidot의 `conversationHistory` 실제 필드가 CGA 내부 저장 구조와 1:1로 바로 맞지 않을 수 있다.
- simulator 이력과 channel 이력을 합치는 기준이 CGA 기존 구조와 다를 수 있다.
- Studio 화면은 최근 UI 정리는 되었지만, 실제 운영 API 연결 시 상세 필드 부족이 드러날 수 있다.
- Aidot WebChat은 연결만 되는 것으로 끝나지 않고, 대화 도중 저장/종료 후 조회까지 확인해야 진짜 호환이라고 볼 수 있다.

## 이번 계획서의 완료 정의

- 이 문서는 “한 번에 전체 수정” 대신 “작게 쪼개서 끝까지 검증하는 순서”를 고정하기 위한 기준 문서다.
- 현재 계획서 기준 남은 핵심 단계는 모두 완료됐다.
- 수동 smoke 결과 기록서는 `docs/aidot-full-webchat-smoke-result-template.md`에 실제 결과까지 반영됐다.
