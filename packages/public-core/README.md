# CGA Public Core

Public Core는 Commercial Module 없이도 CGA Studio 기본 흐름이 동작하도록 하는 공유 로직을 담는다.

## 현재 포함 파일

- `src/studio-state.js`: CGA Studio 화면 상태 모델과 readiness 파생 함수

## 원칙

- Aidot API와 런타임을 변경하지 않는다.
- Commercial Module 구현체에 의존하지 않는다.
- 화면은 이 상태 모델을 기준으로 준비 상태, 차단 상태, 채널 상태를 표시한다.
- 에러는 `packages/contracts`와 `packages/i18n`의 error code/message key 규칙을 따른다.
