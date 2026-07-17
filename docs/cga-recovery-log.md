# CGA 복구 작업현황

## 2026-07-17 — 복구 기준 및 현재 장애 기록

- 복구 기준 사용자: `cyhuh` (허철영, `group_admin`). `admin`을 기준 사용자로 사용하지 않는다.
- 복구 기준 선택 상태: `g-support` / Support Bot Group / Aidot 봇 (`175c6113-ac68-4ca8-9e1b-70391581944e`) / 작업 버전 `v1`.
- DB 확인 결과: Support Bot Group에는 CGA Bot, 테스트 봇 20260701, Aidot 봇이 존재한다. Ops Assistant만 보인 현상은 `g-ops`가 선택된 상태였으며, 봇 삭제 증거는 확인되지 않았다.
- 확인된 화면 장애: `#entity-management`, `#dictionary-management` 본문 섹션은 HTML에 있으나, 이를 채우는 `apps/studio/asset-management.js`가 `apps/studio/app.js`에서 import·초기화되지 않아 빈 화면으로 표시됐다.
- 1차 복구 조치: 자산 관리 모듈을 앱 렌더링 순서에 다시 연결하고, 개체·사전 화면에서는 공통 저장 버튼을 숨김 처리했다. 이 조치는 DB 저장 로직이나 봇/그룹 데이터에 쓰지 않는다.
- 검증: `node --check apps/studio/app.js` 통과. 브라우저 자동 클릭 채널은 사용할 수 없어, 실제 화면 클릭 검증은 보류다.
- 재발 방지 기록 항목: 이후 각 작업에서 사용자·그룹·봇·버전·서버 PID·캐시 버전·수정 파일·검증 결과·실패 원인·복구 기준을 이 파일에 추가한다.

- 화면 캐시 버전: `20260717-25`. 로컬 서버는 최신 `app.js`, `asset-management.js`, `styles.css`를 HTTP 200으로 제공함.
