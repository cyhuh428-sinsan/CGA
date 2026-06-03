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

기본 개발 실행 방식은 WSL 안에서 Docker 컨테이너로 CGA 프로세스를 띄우는 방식이다.

배포와 공유는 Git 기준으로 한다.

## CGA Studio 실행

Windows PowerShell이 아니라 WSL 터미널에서 실행한다.

```bash
cd ~/deploy/cga
docker-compose up --build cga-studio
```

실행 URL:

```text
http://localhost:4173
```

중지:

```bash
cd ~/deploy/cga
docker-compose down
```

참고:

- `npm run studio`는 컨테이너 내부에서 실행되는 Studio 서버 명령이다.
- 개발자는 원칙적으로 Windows 로컬에서 `npm run studio`를 직접 실행하지 않는다.
- 로컬 PC, 폐쇄망, 개인 WSL 환경 모두 동일하게 컨테이너 프로세스로 실행한다.

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
