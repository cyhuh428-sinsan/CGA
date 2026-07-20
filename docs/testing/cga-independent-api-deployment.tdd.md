# CGA 독립 API 배포 TDD 기록

## 범위

- CGA API를 Aidot과 분리해 `cga-api:8000`으로 실행한다.
- CGA Studio는 `cga-studio:4173`으로 실행하고 브라우저는 same-origin `/api/v1`만 호출한다.
- API는 기존 `cga` 데이터베이스를 사용하며 재시작 시 초기 데이터를 덮어쓰지 않는다.
- 운영 기본 비밀값 사용을 차단한다.

## RED

- `test_cga_deployment_contract.py`: 독립 Compose, CGA 내부 API 환경변수, 포트 및 문서가 없어 5건 실패.
- `test_db_bootstrap.py`: 안전한 부트스트랩 모듈이 없어 수집 실패.
- `test_config_security.py`: 운영 환경에서 취약한 기본값이 허용되어 실패.

## GREEN

- 직접 관련 테스트: `21 passed in 2.58s`
- Web 운영 빌드: Next.js 컴파일, TypeScript, 정적 페이지 46개 생성 통과.
- Daon 서버 Docker Compose 파서: `docker compose -f - config --quiet` 통과.
- 전체 API 테스트: 485 통과, 4 건너뜀, 기존 범위 5 실패.

## 기존 실패 분리

- LLM 런타임 응답 테스트 2건
- 기존 라우트 경로 회귀 테스트 3건
- 이번 배포 변경 파일과 직접 겹치지 않으며 별도 수정 대상으로 남긴다.

## 미완료 검증

- Daon 서버 DB 백업 및 Alembic 적용
- 운영 유사 Docker 기동과 컨테이너 헬스체크
- NPM `api-cga.sinsan.kr -> cga-api:8000` SSL 적용
- 실제 브라우저 Network에서 same-origin 요청 확인
