# CGA 오라클 클라우드 배포 가이드

## 1. 목적

이 문서는 CGA Studio를 Aidot와 같은 오라클 클라우드 서버에 운영형으로 배포하는 기준 문서입니다.

운영 기준:

- 도메인: `cga.sinsan.kr`
- 서버 경로: `~/deploy/cga`
- Docker 서비스: `studio`
- 컨테이너 이름: `cga-studio`
- 내부 포트: `4173`
- DB 컨테이너: `shared-db`
- DB 이름: `cga`
- DB 계정: `postgres`
- 외부 네트워크:
  - `proxy-network`
  - `common_default`

## 2. 전제 조건

아래 항목이 서버에 이미 있어야 합니다.

1. Docker
2. `docker compose`
3. Nginx Proxy Manager
4. 공용 Postgres 컨테이너 `shared-db`
5. Docker 네트워크
   - `proxy-network`
   - `common_default`

확인 명령:

```bash
docker ps
docker network ls
docker exec -it shared-db psql -U postgres -lqt
```

`cga` 데이터베이스가 보이면 DB는 준비된 상태입니다.

## 3. 소스 배치

```bash
cd ~/deploy
git clone <CGA_REPOSITORY_URL> cga
cd ~/deploy/cga
git checkout codex/wsl-container-dev
```

이미 clone된 경우:

```bash
cd ~/deploy/cga
git pull --ff-only
```

## 4. 서버용 `.env` 만들기

```bash
cd ~/deploy/cga
cp .env.server.example .env
```

그 다음 `.env`를 열어서 아래처럼 운영값을 넣습니다.

```env
PORT=4173
CGA_AUTH_HEADER_FALLBACK=disabled
CGA_STORAGE_DRIVER=postgres
CGA_DB_HOST=shared-db
CGA_DB_PORT=5432
CGA_DB_NAME=cga
CGA_DB_USER=postgres
CGA_DB_PASSWORD=서버에서만_직접_입력
```

주의:

- `CGA_DB_PASSWORD`는 저장소에 커밋하지 않습니다.
- 신산님이 정한 실제 비밀번호는 서버의 `.env`에만 직접 입력합니다.

## 5. Compose 설정 확인

운영형 배포는 기본 compose와 운영 override를 같이 씁니다.

```bash
cd ~/deploy/cga
docker compose -p cga -f docker-compose.yml -f docker-compose.prod.yml config
```

확인 포인트:

1. 서비스명이 `studio`인지
2. `CGA_STORAGE_DRIVER=postgres`가 들어가는지
3. `CGA_AUTH_HEADER_FALLBACK=disabled`가 들어가는지
4. 네트워크에 `proxy-network`, `common_default`가 잡히는지

## 6. CGA 기동

```bash
cd ~/deploy/cga
docker compose -p cga -f docker-compose.yml -f docker-compose.prod.yml up -d --build studio
```

상태 확인:

```bash
docker ps
docker logs --tail 200 cga-studio
```

정상 기준:

1. `cga-studio`가 `Up` 상태
2. 포트 `4173`이 열림
3. DB 연결 오류가 없어야 함

## 7. Nginx Proxy Manager 연결

Nginx Proxy Manager에서 `cga.sinsan.kr`를 아래처럼 연결합니다.

- Scheme: `http`
- Forward Hostname / IP: `cga-studio`
- Forward Port: `4173`

중요:

- 현재 운영 구조에서는 Nginx Proxy Manager와 `cga-studio`가 같은 `proxy-network`에 붙어 있습니다.
- 따라서 `127.0.0.1`이나 서버 공인 IP보다 `cga-studio` 컨테이너 이름으로 연결하는 것이 기준입니다.

SSL이 있다면 `cga.sinsan.kr`에 인증서를 연결합니다.

## 8. 접속 확인

브라우저에서 아래를 확인합니다.

1. `https://cga.sinsan.kr`
2. 로그인 화면 또는 메인 화면이 열리는지
3. 로그인 후 `/api/cga/auth/me`가 정상 응답하는지
4. 봇 작업공간, 봇 관리, 관리자 화면 진입이 되는지

## 9. DB 저장 확인

현재 CGA는 Postgres 1단계 저장 구조를 사용합니다.

- 테이블명: `cga_state_store`
- 저장 방식: 컬렉션별 JSONB

확인 예시:

```bash
docker exec -it shared-db psql -U postgres -d cga -c "select collection_key, updated_at from cga_state_store order by collection_key;"
```

정상 기준:

- `workspace_bots`
- `studio_state_registry`
- `composition_registry`
- `detail_asset_registry`
- `operations_state_registry`
- `collaboration_state_registry`
- `admin_resources`
- `auth_credentials`
- `auth_sessions`

같은 key들이 생성되거나 갱신되어야 합니다.

## 10. 재배포 절차

코드가 갱신되면 아래 순서로 재배포합니다.

```bash
cd ~/deploy/cga
git pull --ff-only
docker compose -p cga -f docker-compose.yml -f docker-compose.prod.yml up -d --build studio
```

필요 시 재기동:

```bash
cd ~/deploy/cga
docker compose -p cga -f docker-compose.yml -f docker-compose.prod.yml restart studio
```

## 11. 장애 확인 순서

문제가 생기면 아래 순서로 확인합니다.

1. `docker ps`에서 `cga-studio`가 살아 있는지
2. `docker logs --tail 200 cga-studio`에 DB 연결 오류가 있는지
3. `.env`에 `CGA_DB_HOST`, `CGA_DB_NAME`, `CGA_DB_USER`, `CGA_DB_PASSWORD`가 맞는지
4. `shared-db`가 살아 있는지
5. `common_default` 네트워크에 `cga-studio`, `shared-db`가 같이 붙어 있는지
6. Nginx Proxy Manager가 `4173`으로 포워딩하는지

## 12. 현재 단계 한계

현재 DB 저장은 1단계입니다.

- 장점:
  - 기존 JSON 구조를 최대한 유지
  - 기존 기능 영향 최소화
  - 파일 기반 데이터에서 DB로 1회 이관 가능
- 남은 작업:
  - 봇
  - 버전
  - 운영 이력
  - 대화 이력
  - 관리자 리소스

를 도메인 테이블로 정규화하는 2단계 구조화가 남아 있습니다.
