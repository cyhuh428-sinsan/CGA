# CGA API

현재 이 폴더는 FastAPI 기반 CGA 백엔드이며 Aidot 자산 호환 기능을 제공합니다.

## 실행 예시

가상환경 생성 후:

```powershell
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload --port 8320
```

## 현재 구현 범위

- 조직/사용자/역할/권한 기본 모델
- 기본 `master` 사용자 보호
- 역할 3종
  - `큐레이터`
  - `시스템관리자`
  - `IT관리자`
- Alembic 초기 마이그레이션
- 개발용 관리자 계정 시드
- 봇/버전 JSON 문서 저장
- 관리자 공통 변수/채널/템플릿/기본 메시지 관리
- 라이선스 업로드/상태 조회 및 생성 제한 정책
- 외부 채널 Webchat/Kakao/Teams 운영버전 실행 API
- 채널 Queue 이벤트 저장 및 워커 처리
- 시나리오 검증, 런타임 변수 치환, Function/Condition/Jump/End 실행
- 운영 대시보드, Queue/대화/API 호출/시스템 로그 조회
- 인증 API
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/signup-options`
  - `POST /api/v1/auth/signup`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/me`
  - `POST /api/v1/auth/change-password`
- 관리자 API
  - `GET /api/v1/admin/users`
  - `GET /api/v1/admin/users/{user_id}`
  - `PATCH /api/v1/admin/users/{user_id}/status`
  - `PATCH /api/v1/admin/users/{user_id}/role`
  - `DELETE /api/v1/admin/users/{user_id}`
  - `GET /api/v1/admin/signup-requests/{signup_request_id}`
  - `POST /api/v1/admin/signup-requests/{signup_request_id}/approve`
  - `POST /api/v1/admin/signup-requests/{signup_request_id}/reject`
  - `GET /api/v1/admin/login-history`
  - `GET /api/v1/admin/groups`
  - `POST /api/v1/admin/groups`
  - `GET/POST/PATCH/DELETE /api/v1/admin/channels`
  - `GET/POST/PATCH/DELETE /api/v1/admin/templates`
  - `GET/POST/PATCH/DELETE /api/v1/admin/common-variables`
  - `GET/PATCH/POST /api/v1/admin/default-messages`
  - `GET /api/v1/admin/license`
  - `POST /api/v1/admin/license/apply`
  - `GET /api/v1/admin/operations-dashboard`
  - `GET /api/v1/admin/queue-history`
  - `POST /api/v1/admin/queue/process`
  - `GET /api/v1/admin/conversations`
  - `GET /api/v1/admin/api-call-history`
  - `GET /api/v1/admin/system-logs`
- 채널 API
  - `POST /api/v1/channels/{channel_type}/connect`
  - `GET /api/v1/channels/{channel_type}/bots`
  - `POST /api/v1/channels/{channel_type}/rooms`
  - `GET /api/v1/channels/{channel_type}/rooms`
  - `POST /api/v1/channels/{channel_type}/rooms/{room_id}/messages`
  - `POST /api/v1/channels/{channel_type}/queues/process`

현재 Alembic 마이그레이션은 `20260507_0016_channel_queue_events`까지 단일 체인으로 이어집니다.
로컬 또는 운영 DB 반영은 반드시 `apps/api`에서 `alembic upgrade head`로 수행합니다.

## 참고

- 인증 방식은 현재 1차 구현 편의를 위해 JWT 기반으로 고정했습니다.
- 로그아웃은 토큰 블랙리스트 없이 클라이언트 세션 종료 방식으로 처리합니다.
- 회원가입은 `기본 테넌트` 기준으로 저장되며, 관리자 승인 후 로그인 가능합니다.
- `master` 사용자는 삭제할 수 없습니다.
- 위 두 항목은 이후 정책에 따라 변경될 수 있는 구현 가정입니다.
