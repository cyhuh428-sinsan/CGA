# CGA Studio

CGA Studio is a bot system generator and builder.

It creates deployable bot systems, not just chatbot settings.

Primary outputs:

- Bot Server
- Bot Client
- Runtime Template
- Deployment Manifest
- Orchestrator connection or built-in orchestrator configuration

## Product Names

- Product: CGA Studio
- Open Core: CGA Orchestrator
- Project folder: cga

## Current Rule

CGA Studio is not a from-scratch feature invention project.
It reorganizes Aidot 1.0 capabilities into a workflow-first, multi-language bot system generator.

Screens and features must be approved step by step before implementation.

## Aidot Compatibility Contract

CGA Studio must preserve Aidot-compatible runtime and API contracts because chat clients are shared with Aidot.

The following structures are compatibility targets:

- API structure
- runtime variables
- runtime functions
- simulator behavior
- webchat connection behavior

The API contract is especially important because the same webchat client must be able to connect to both Aidot and CGA-generated bot systems.

If a structure change is required, it must follow one of these paths:

1. Change Aidot and CGA together under the same compatible contract.
2. Keep the Aidot contract unchanged and add CGA-specific extensions without breaking existing clients.

## Client Boundary

CGA Studio is a platform for creating and operating bot systems.
It is not a chatbot messenger product.

When this project says `Bot Client`, it means an Aidot-compatible client deployment target, package, or adapter configuration.
The actual chat clients must follow the same client contract as Aidot so shared webchat, installed messenger, and locale messenger clients can connect to Aidot and CGA-generated Bot Servers through the same API structure.

## Bidirectional Client Compatibility

Any client produced, packaged, or configured by CGA must be able to connect to Aidot when it uses the Aidot-compatible client contract.

This means compatibility works in both directions:

- Existing Aidot clients can connect to CGA-generated Bot Servers.
- CGA-produced clients can connect to Aidot Bot Servers.

CGA-specific optional features must degrade gracefully when connected to Aidot if Aidot does not support those optional extensions.

## Aidot Structure Parity

CGA must keep Aidot's structure, functions, system, and API contracts identical by default.

CGA changes screen composition and workflow-first user experience, not the underlying Aidot-compatible system contract.

See `docs/aidot-structure-parity.md`.


## 개발 / 실행 원칙

CGA 개발 프로세스는 Windows 로컬 Node 프로세스로 띄우지 않는다.

기본 개발 실행 방식은 Docker 컨테이너로 CGA 프로세스를 띄우는 방식이다.

배포와 공유는 Git 기준으로 한다.

## CGA Studio 실행

```bash
cd ~/deploy/cga
docker-compose -p cga up --build studio
```

실행 URL:

```text
http://127.0.0.1:4173/
```

중지:

```bash
cd ~/deploy/cga
docker-compose -p cga down
```

참고:

- `npm run studio`는 컨테이너 내부에서 실행되는 Studio 서버 명령이다.
- 개발자는 원칙적으로 호스트에서 `npm run studio`를 직접 실행하지 않는다.
- 로컬 PC, WSL, 오라클 클라우드 서버 모두 동일하게 컨테이너 프로세스로 실행한다.

## 인증 실행 모드

개발 기본 실행은 기존 테스트와 화면 확인 편의를 위해 `X-CGA-User-Id` 헤더 fallback을 허용한다.

```bash
cd ~/deploy/cga
docker-compose -p cga up --build studio
```

운영형 실행에서는 헤더 fallback을 끄고 로그인 세션 토큰 또는 `cga_session` 쿠키만 사용한다.

```bash
cd ~/deploy/cga
docker-compose -p cga -f docker-compose.yml -f docker-compose.prod.yml up --build -d studio
```

운영형 실행 기준:

- `CGA_AUTH_HEADER_FALLBACK=disabled`
- `CGA_STORAGE_DRIVER=postgres`
- `/api/cga/auth/login` 또는 `/api/cga/auth/signup`으로 발급된 세션만 사용자로 인정
- 세션 없이 `/api/cga/auth/me` 또는 관리 API를 호출하면 `CGA_AUTH_REQUIRED` 반환

## 오라클 클라우드 운영 배포 기준

현재 운영 기준은 Aidot와 같은 서버에 올리는 방식이다.

- 도메인: `cga.sinsan.kr`
- 서비스 포트: `4173`
- 공용 DB 컨테이너: `shared-db`
- DB 이름: `cga`
- DB 계정: `postgres`
- Docker 외부 네트워크:
  - `proxy-network`
  - `common_default`

서버용 환경값은 저장소의 `.env.example`가 아니라 별도 `.env`로 관리한다.

서버 배포 절차와 예시 환경 파일은 아래 문서를 따른다.

- [docs/cga-oracle-cloud-deploy.md](D:/Project/cga/docs/cga-oracle-cloud-deploy.md)
- [.env.server.example](D:/Project/cga/.env.server.example)

## CGA Studio 검증

화면 구성, i18n 에러 키, Public Core 계약 파일을 확인한다.

```bash
cd ~/deploy/cga
npm run studio:validate
```

검증 항목:

- `layout.js` 화면 ID와 `index.html` section ID 일치
- 필수 workflow 6단계 존재
- locale별 에러 메시지 키 존재
- Public Core contract 파일 존재

## 화면 구성 변경

화면 순서와 표시 여부는 아래 파일에서 변경한다.

```text
apps/studio/data/layout.js
```

화면 단계 데이터는 아래 파일에서 관리한다.

```text
apps/studio/data/workflow.js
```

사용자 노출 에러 메시지는 코드에 직접 쓰지 않고 아래 locale 리소스에서 관리한다.

```text
packages/i18n/locales
```
