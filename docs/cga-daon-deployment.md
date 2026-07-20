# CGA Daon 배포 기준

## 1. 서비스와 포트

| 용도 | 주소 또는 컨테이너 | 포트 | 공개 방식 |
| --- | --- | ---: | --- |
| 운영 화면 | `cga-studio` | 4173 | NPM `cga.sinsan.kr` |
| 운영 API | `cga-api` | 8000 | NPM `api-cga.sinsan.kr` |
| 로컬 개발 화면 | `localhost` | 5173 | 로컬에서만 사용 |

운영 NPM 설정:

- `cga.sinsan.kr` -> `http://cga-studio:4173`
- `api-cga.sinsan.kr` -> `http://cga-api:8000`
- 두 호스트 모두 Let's Encrypt 인증서를 사용하고 HTTPS를 강제한다.
- `cga-api`의 8000 포트는 Docker 호스트에 직접 bind하지 않는다. NPM은 `proxy-network`를 통해 접근한다.

## 2. 호출 경계

- 브라우저 화면은 `/api/v1`, `/assets`, `/files` 등 `cga.sinsan.kr`의 same-origin 경로만 호출한다.
- `cga-studio`의 BFF는 `CGA_INTERNAL_API_BASE_URL=http://cga-api:8000`으로 내부 API를 호출한다.
- 외부 시스템의 의도·모듈·AM API 호출은 `https://api-cga.sinsan.kr`을 사용한다.
- 기존 Aidot 도메인, 컨테이너, 데이터베이스는 CGA 호출 경로에 사용하지 않는다.

## 3. 필수 비밀 환경변수

서버의 추적되지 않는 `.env`에 다음 키를 설정한다. 실제 값은 문서, 로그, Git에 기록하지 않는다.

- `CGA_DATABASE_URL`
- `CGA_JWT_SECRET`
- `CGA_INITIAL_ADMIN_PASSWORD`

`CGA_DATABASE_URL`은 `shared-db`의 기존 `cga` 데이터베이스를 가리켜야 한다. `aidot` 데이터베이스를 지정하지 않는다.

## 4. DB 변경 원칙

1. 배포 직전에 `cga` 데이터베이스를 백업한다.
2. 기존 `cga_state_store`의 존재와 행 수를 기록한다.
3. `cga-api` 시작 스크립트가 Alembic 마이그레이션을 실행한다.
4. 기초 조직과 역할이 없을 때만 초기 seed를 실행한다.
5. 마이그레이션 후 `cga_state_store`가 보존됐는지 확인한다.
6. API readiness와 신규 테이블 목록을 확인한 후 NPM을 공개한다.

## 5. 배포 및 확인 순서

1. 로컬 브랜치의 빌드·테스트·diff를 확인한다.
2. commit 후 GitHub에 push한다.
3. Daon 서버에서 해당 브랜치를 Git 기준으로 반영한다.
4. 필수 환경변수가 존재하는지만 확인한다. 값은 출력하지 않는다.
5. Compose 구성을 검증하고 이미지를 빌드한다.
6. `cga-api` readiness가 정상인 것을 확인한다.
7. `cga-studio` readiness가 정상인 것을 확인한다.
8. NPM에서 `cga.sinsan.kr`과 `api-cga.sinsan.kr`을 연결한다.
9. 브라우저 Network에서 localhost·내부 컨테이너 주소가 노출되지 않는지 확인한다.
10. 외부 API 인증 성공·실패, 의도·모듈 호출, 요청 로그를 검증한다.

## 6. 완료 조건

- `cga-studio`와 `cga-api`가 각각 healthy 상태다.
- `cga.sinsan.kr`의 브라우저 요청은 same-origin이다.
- `api-cga.sinsan.kr`은 HTTPS로만 접근된다.
- 인증 없는 보호 API 호출은 거부된다.
- 기존 `cga_state_store`와 신규 CGA API 테이블이 함께 유지된다.
- 기존 Aidot 서비스에 변경이나 장애가 발생하지 않는다.
