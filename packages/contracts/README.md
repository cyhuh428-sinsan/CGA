# CGA Contracts

CGA Public Core와 Commercial Module이 공유하는 공개 계약을 정의한다.

## 목적

- Aidot 호환 API와 런타임 계약을 유지한다.
- 화면과 서버가 동일한 에러 코드 규칙을 사용한다.
- Commercial Module 구현체는 공개하지 않더라도, 연결 인터페이스는 Public Core에서 알 수 있게 한다.
- Public Core는 Commercial Module 없이도 실행 가능해야 한다.

## 포함 계약

- `error-contract.js`: API/런타임 에러 응답 계약
- `module-contract.js`: 상용 모듈 연결 상태와 기능 가용성 계약
- `workflow-contract.js`: CGA 6단계 화면과 Aidot 내부 기능 매핑 계약

## 금지

- Commercial Module 내부 구현체를 이 패키지에 넣지 않는다.
- Aidot API 형태를 임의로 변경하지 않는다.
- UI 문구를 에러 응답 안에 하드코딩하지 않는다.
