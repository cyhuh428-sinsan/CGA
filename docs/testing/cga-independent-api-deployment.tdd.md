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

- 직접 관련 테스트: 최종 `23 passed in 2.53s`
- Web 운영 빌드: Next.js 컴파일, TypeScript, 정적 페이지 46개 생성 통과.
- Daon 서버 Docker Compose 파서: `docker compose -f - config --quiet` 통과.
- 전체 API 테스트: 485 통과, 4 건너뜀, 기존 범위 5 실패.
- 격리 Web 이미지에서 공유 패키지 누락을 재현하고 Dockerfile 회귀 테스트를 추가했다.
- URL 인코딩된 DB 비밀번호와 Alembic 보간 충돌을 재현하고 `%` 이스케이프 회귀 테스트를 추가했다.

## 기존 실패 분리

- LLM 런타임 응답 테스트 2건
- 기존 라우트 경로 회귀 테스트 3건
- 이번 배포 변경 파일과 직접 겹치지 않으며 별도 수정 대상으로 남긴다.

## Daon 배포 검증

- 배포 전 `cga` DB 압축 백업과 gzip 무결성 확인 완료.
- Alembic `20260715_0026` 적용, 기존 `cga_state_store` 13건 보존 확인.
- `cga-api`와 `cga-studio` 컨테이너 healthy 확인.
- 외부 HTTP `api-cga.sinsan.kr`에서 CGA API 응답과 비인증 요청 401 확인.
- 실제 브라우저 로그인 요청이 same-origin `/api/v1/auth/login`을 거쳐 API에 전달되는 것 확인.
- 기존 `master/master`는 401이므로 로그인 이후 화면 검증은 운영 관리자 자격증명 확인 후 남아 있다.
- `api-cga.sinsan.kr`의 Let's Encrypt/Force SSL 적용은 남아 있다.

## CGA 라이선스 추가 검증

- RED: CGA 공개키 설정, `cga-license` 형식, `CGA` 제품 검증이 없어 신규 테스트 3건 실패.
- GREEN: CGA 서명 검증과 기존 라이선스 정책 테스트 `17 passed`.
- 생성 라이선스를 실제 공개키로 로컬 재검증했다.
- Daon API의 정식 관리자 적용 경로로 업로드하고 활성 상태를 확인했다.
- 적용값: 사용자 120, 봇 30, API 50, 만료일 2026-12-31.
