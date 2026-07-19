# CGA Studio

이 저장소는 Aidot 호환 소스를 중심으로 정리한 CGA Studio입니다.

## 구성

- apps/web: Next.js 기반 CGA Studio 화면
- apps/api: FastAPI 기반 Aidot 호환 API
- apps/vector-worker: 벡터 검색 워커
- packages/shared: 공용 타입과 유틸리티
- compat-samples: Aidot 업로드·다운로드 왕복 검증 샘플
- scripts/start-local.ps1: 기존 API와 로컬 웹 연결 스크립트

## 로컬 실행

기본 실행 구조는 다음과 같습니다.

- 기존 Aidot API: http://127.0.0.1:8320
- CGA Studio 웹: http://127.0.0.1:5173
- 기존 CGA 4173 프로세스는 사용하지 않습니다.

웹 의존성이 없다면 먼저 설치합니다.

    Set-Location .\apps\web
    npm install
    Set-Location ..\..

기존 API가 실행 중인 상태에서 CGA Studio를 시작합니다.

    pwsh -ExecutionPolicy Bypass -File .\scripts\start-local.ps1

브라우저에서 http://localhost:5173/login 으로 접속합니다.

## 운영 원칙

- 기존 CGA 데이터베이스와 8320 API는 별도 운영 상태를 유지합니다.
- 화면별 세부 수정 전 메뉴 연결과 Aidot 호환 경로를 우선 유지합니다.
- 봇, 버전, 의도, 개체, 사전 등 Aidot 패키지의 업로드·다운로드 호환성은 기능 검증 단계에서 항목별로 확인합니다.
