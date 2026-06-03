# CGA Access and API Answer Policy

## 1. 그룹 / 사용자 / 로그인 / 권한

CGA의 모든 관리 기준은 시스템 전체가 아니라 그룹이다.

봇, API 답변, 사용자 권한, 운영 접근, 화면 접근은 그룹을 기준으로 관리한다. 사용자는 하나 이상의 그룹에 속하고, 같은 그룹에 속한 사용자는 그 그룹이 관리하는 봇에 접근할 수 있다.

역할 후보:

- Owner
- Admin
- Builder
- Reviewer
- Operator
- Viewer

권한 범위:

- bot.create
- bot.configure
- bot.review
- bot.deploy
- user.manage
- apiAnswer.manage
- bot.operate
- bot.analyze
- bot.view

## 1.1 그룹별 관리 원칙

- 봇은 개인이 아니라 그룹이 관리한다.
- API도 개인이 아니라 그룹이 관리한다.
- 동일한 그룹에 속한 사용자는 그 그룹의 봇과 API 자산에 접근할 수 있다.
- 그룹별 사용자 권한을 설정한다.
- 실제 접근 가능 화면과 기능은 그룹 멤버십, 그룹 내 사용자 역할, 그룹별 scope로 결정한다.
- 개인별 권한은 기본 관리 기준이 아니며, 예외적으로 추가 허용 또는 차단할 때만 사용한다.
- 기본 권한 판단 기준은 `group_id + bot_id + scopes`이다.
- 사용자별 예외는 `user_id + bot_id + allow_scopes / deny_scopes`로 처리한다.
- 모든 신규 사용자는 가입 시 자기 그룹으로 먼저 가입된다.
- 사용자는 다른 그룹에 가입신청을 할 수 있다.
- 그룹의 사용자가 모두 없어지면 해당 그룹은 삭제한다.
- 그룹은 언제든지 이동하거나 새로 만들 수 있지만, 그룹 생성은 관리자 권한을 가진 사용자만 가능하다.
- 각 그룹에는 그룹 관리자 1명이 있어야 하며, 그룹 관리자는 해당 그룹 안에서 모든 권한을 가진다.
- 시스템 전체에는 삭제 불가능한 기본 사용자 `admin`을 둔다.
- `admin` 사용자는 관리자 권한 요청과 그룹 생성 권한 요청을 승인한다.
- 언어 설정은 사용자별로 관리한다.
- 같은 그룹 안에서도 사용자마다 CGA Studio UI 언어가 다를 수 있다.
- 다양한 언어 사용자가 하나의 그룹에서 같은 봇을 공동 작업할 수 있어야 한다.
- 에러 메시지와 운영 알림은 기본적으로 `user.locale` 기준으로 표시한다.
- 봇의 기본 언어와 사용자의 UI 언어는 별도 설정이다.

## 1.2 서버형 SaaS 설치 원칙

CGA는 개별 PC에 설치해 쓰는 단독 도구가 아니라, 서버에 설치해 서비스하는 SaaS 구조를 기본으로 한다.

원칙:

- 사용자는 CGA Studio가 설치된 서버에 브라우저로 접속한다.
- 오픈소스 사용자는 각자 서버에 CGA를 설치할 수 있지만, 설치 후 동작 방식은 SaaS 구조다.
- 하나의 서버 인스턴스 안에서 여러 그룹을 관리할 수 있어야 한다.
- 그룹별로 봇, API, 사용자 권한, 운영 접근을 분리한다.
- 서버 운영자는 인프라를 관리하지만, 실제 봇/API/사용자 권한의 업무 기준은 그룹이다.
- 로컬 개발 서버는 개발 편의를 위한 실행 방식일 뿐, 제품 기본 사용 방식은 서버 접속형이다.
- 폐쇄망에서도 동일하게 SaaS 구조로 설치해 사용한다.
- 개인 사용자는 WSL 또는 Docker 컨테이너로 CGA 서버를 띄우고 브라우저로 접속해 사용할 수 있다.
- 배포 위치가 클라우드, 사내 서버, 폐쇄망 서버, 개인 PC의 WSL 컨테이너 중 어디든 제품 구조는 서버형 SaaS로 동일하다.

## 1.2.1 개발 실행 원칙

개발 중에도 CGA 프로세스는 Windows 로컬 Node 프로세스로 직접 띄우지 않는다.

원칙:

- 개발 실행은 WSL 안에서 Docker 컨테이너로 수행한다.
- Windows 로컬은 편집, Git 작업, 브라우저 확인에 사용한다.
- CGA Studio 서버 프로세스는 컨테이너 안에서 실행한다.
- 검증도 가능하면 컨테이너 또는 WSL 기준으로 실행한다.
- 배포와 공유는 Git commit/push 기준으로 한다.

기준 명령:

```bash
cd ~/deploy/cga
docker-compose up --build cga-studio
```

중지:

```bash
cd ~/deploy/cga
docker-compose down
```

## 1.3 가입 / 로그인 / 그룹 승인 API 계약 초안

이 계약은 CGA 사용자/그룹 관리를 위한 신규 CGA API 기준이다. Aidot 봇 API와 webchat 호환 API는 변경하지 않는다.

기준 route:

- `POST /api/cga/auth/signup`
- `POST /api/cga/auth/login`
- `GET /api/cga/auth/me`
- `GET /api/cga/groups`
- `POST /api/cga/groups/join-requests`
- `POST /api/cga/groups/join-requests/{request_id}/approve`
- `POST /api/cga/admin/permission-requests`
- `POST /api/cga/admin/permission-requests/{request_id}/approve`

상태 전이:

1. 가입하면 사용자와 자기 그룹, 자기 그룹의 `group_admin` 멤버십이 함께 생성된다.
2. 로그인하면 사용자 언어, 활성 그룹 멤버십, 그룹별 역할을 함께 불러온다.
3. 다른 그룹 가입신청이 승인되면 해당 그룹 멤버십이 생성된다.
4. 관리자 권한 요청은 기본 시스템 관리자 `admin` 승인 후 반영된다.
5. 그룹에서 마지막 활성 사용자가 제거되면 해당 그룹은 삭제된다.

주의:

- 이 API는 CGA Studio 운영/권한용 API다.
- Aidot의 봇 런타임 API, webchat 접속 API, 기존 챗봇 클라이언트 호환 구조는 변경하지 않는다.
- Secret, password 원문, API key 원문은 Public Core 계약이나 화면 상태에 저장하지 않는다.

예시:

```text
Support Bot Group
- SupportBot Draft 관리
- Builder: 봇 생성/구성/API 답변 관리
- Reviewer: 검수/조회
- Viewer: 조회

Operations Group
- SupportBot Draft 운영 접근
- Operator: 배포/운영/분석/조회
```

## 2. API 답변 정의

API 답변은 고정답변 텍스트가 아니라 외부 시스템에 존재하는 값을 호출해 답변하는 방식이다.

예시:

- 주문 상태 조회
- 배송 상태 조회
- 계정 상태 조회
- 포인트/잔액 조회
- 예약 정보 조회

## 3. API 답변 구성 항목

- Group
- Bot
- API answer name
- Endpoint URL
- Method
- Auth type
- Request mapping
- Response mapping
- Answer text path
- Timeout
- Fallback answer

## 3.1 API 그룹 관리 원칙

API 답변은 그룹이 관리하는 봇 자산이다.

- API 답변은 `group_id`와 `bot_id`에 연결한다.
- API endpoint, request mapping, response mapping은 그룹 봇 설정으로 관리한다.
- 같은 그룹의 `apiAnswer.manage` 권한이 있는 사용자는 API 답변을 등록/수정할 수 있다.
- 같은 그룹의 `bot.view` 권한이 있는 사용자는 API 답변 설정과 상태를 조회할 수 있다.
- Secret/API key 원문은 public config에 저장하지 않고, 그룹 권한으로 접근 가능한 `secret_ref`만 연결한다.
- 운영자는 API 답변을 수정하지 않더라도 운영 화면에서 호출 상태와 장애 상태를 볼 수 있어야 한다.

## 4. 보안 원칙

- Secret/API key는 public config에 저장하지 않는다.
- Public Core에는 계약과 화면만 둔다.
- 실제 secret 저장/암호화/권한 통제는 그룹 권한 기준으로 운영 환경 또는 상용 Entitlement/Secret 관리와 연결한다.


## 5. 동적 데이터 답변

기업 매출, 순이익, 주문 상태, 배송 상태처럼 계속 변경되는 값은 고정 텍스트 답변으로 저장하지 않는다.

처리 방식:

1. 의도는 고정한다.
2. 답변 소스 유형을 `external_api`로 설정한다.
3. 외부 시스템 endpoint, method, 인증 방식, 요청 매핑을 정의한다.
4. 응답에서 어떤 값을 답변 텍스트로 사용할지 response mapping을 정의한다.
5. 사용자가 질문하면 런타임에서 API를 호출한다.
6. 최신 API 응답을 기반으로 답변을 생성한다.
7. API 실패 시 fallback answer를 사용한다.

예시:

```text
사용자 질문: 이 기업의 최신 순이익은 얼마인가요?
의도: company_net_income_lookup
API: GET /financials/{company_id}/net-income
응답 매핑: data.value, data.unit, data.as_of
봇 답변: 최신 외부 API 응답 기준 순이익은 ... 입니다.
```

주의:

- API key나 secret은 public config에 저장하지 않는다.
- 최신성이 중요한 값은 cache 정책을 별도로 지정한다.
- 재무 데이터처럼 기준일이 중요한 값은 `as_of` 또는 기준일을 함께 표시한다.
