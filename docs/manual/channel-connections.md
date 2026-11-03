# 외부 채널 연결 운영 가이드

[한국어](channel-connections.md) · [English](channel-connections.en.md) · [简体中文](channel-connections.zh-CN.md) · [日本語](channel-connections.ja.md) · [Tiếng Việt](channel-connections.vi.md) · [Français](channel-connections.fr.md) · [Deutsch](channel-connections.de.md)

## 1. 범위와 검증 경계

Teams, Slack, Discord, Telegram, Google Chat, LINE의 새 연결 패널을 설명합니다. 기존 Webchat·카카오톡·Teams 경로와 봇 제작 기능을 교체하지 않습니다. 이 가이드는 소스와 합성 테스트를 대조한 개발 후보 안내입니다. 실제 플랫폼 설정 화면, 실계정·Secret 등록, 외부 송수신, 운영 준비와 사용자 인수는 **미검증**입니다. 아래 플랫폼 준비는 승인받은 설정자가 공식 문서와 현재 콘솔을 확인할 사항이지 실행 완료 기록이 아닙니다.

## 2. 실행 전 준비

- 시스템 담당자가 정확한 후보 commit/image, 백업·복구 계획과 승인 범위를 확인합니다. 일반 사용자가 DB나 CLI를 직접 조작하지 않습니다.
- `CHANNEL_CONNECTION_WORKER_ENABLED=false`가 기본입니다. 저장·설정 검사는 외부 통신을 하지 않습니다. 실제 연결은 별도 승인 후 담당자가 worker를 활성화할 때만 시도합니다.
- `CHANNEL_CONNECTION_ENCRYPTION_KEY`는 Base64로 표현한 **32바이트** 키여야 합니다. `CHANNEL_CONNECTION_KEY_VERSION` 기본은 `v1`입니다. 값은 화면 캡처·Git·로그에 남기지 않습니다. 키 없음·손상·AAD 불일치는 외부 연결 없이 실패합니다.
- API의 packet bridge에는 **Node 22**와 공유 변환 자산이 필요합니다. `CHANNEL_CONNECTION_NODE_BINARY`가 실행 가능한 binary를 가리켜야 합니다. 로컬 다른 Node 버전의 테스트를 Node 22 image 증거로 대신하지 않습니다.
- 담당자가 기존 head `20260720_0027` 뒤의 additive migration `20261103_0028` → `20261103_0029` → `20261103_0030`을 승인된 대상에서 검증합니다. 새 연결·lease·방 매핑·delivery 테이블만 추가하며 기존 데이터를 이관하지 않습니다. 운영 DB 적용은 별도 승인입니다.
- 조직·그룹·답변 봇·부모 채널이 활성 상태이고 봇의 실제 실행 버전이 준비되어야 합니다. 조직 관리자 권한과 해당 플랫폼 앱 관리 권한을 확인합니다.

## 3. 화면에서 등록·연결·해제

1. 관리자 계정으로 `Admin > 채널 관리`를 엽니다. 기존 채널 등록에서 필요한 채널 종류를 선택하고 활성 상태를 확인합니다. 여섯 종류의 행에서 `연결 대상`을 엽니다.
2. `연결 대상 추가`에서 연결 이름, 답변 봇, `설치·워크스페이스 ID`, `외부 봇 계정 ID`, `대상 방·채널 ID`를 입력합니다. 아래 ID 표를 따르고 화면 이름·초대 링크를 ID 대신 넣지 않습니다.
3. 해당 종류에 표시되는 인증 필드만 입력하고 `설정 저장`합니다. 최초 등록에는 인증정보가 필요합니다. 수정 시 공란은 기존 값을 유지하고 비어 있지 않은 필드만 병합합니다. `등록됨`, 별표·마스킹 문자를 실제 Secret처럼 붙여 넣지 않습니다. 저장된 Secret은 다시 표시되지 않습니다.
4. `설정 검사` 후 마지막 검사 시각과 오류를 확인합니다. 이는 형식·필수 필드·활성 상태 검사이며 외부 신원이나 권한을 확인하지 않습니다. `설정 검사 통과 · 실제 접속 미확인`은 연결 성공이 아닙니다.
5. 실제 통신 승인과 서버 준비 후 `연결`을 누릅니다. 요청 직후 `연결 중`이며 worker의 신원·대상·독점 scope 검증을 거쳐야 합니다. Teams·Google Chat·LINE은 첫 인증된 대상 이벤트가 필요합니다. 승인된 시험 질문을 한 번 보내고 새로 목록을 열어 상태·실제 봇 답변을 대조합니다. 최초 질문도 보존·처리 대상입니다.
6. `연결 해제` 후 `미연결`을 확인해야 수정·삭제할 수 있습니다. 오류 상태라도 연결 요청이 남으면 먼저 해제합니다. 삭제는 설정을 soft-delete하며 대화 기록을 보존합니다. 연결 행이 남은 부모 채널은 provider 변경·삭제가 제한됩니다.

## 4. ID와 인증 필드

| 종류 | installation_id | account_id | target_id | 필수 인증 필드 / 선택 필드 |
|---|---|---|---|---|
| Teams (`ms_teams`) | tenant UUID | 앱 client UUID | Teams channel ID, 없으면 conversation ID | `tenant_id`, `client_id`, `client_secret` |
| Slack (`slack`) | workspace/team ID | bot **user** ID | 접근 가능한 conversation ID | `bot_token`, `app_token` / `signing_secret` 선택 |
| Discord (`discord`) | guild ID 또는 1:1의 `DM` | bot user ID | channel/thread/DM ID | `bot_token` |
| Telegram (`telegram`) | bot numeric user ID | 같은 bot numeric user ID | private/group/supergroup chat ID | `bot_token` |
| Google Chat (`google_chat`) | 숫자 **Project Number** | `users/{bot-id}` | `spaces/{space-id}` | `service_account_json` / 일치하는 `project_id` 선택 |
| LINE (`line`) | bot user ID `U`+32자리 소문자 hex | 같은 bot user ID | user `U…` / group `C…` / room `R…` | `access_token`, `channel_secret` |

외부 ID도 민감한 운영정보입니다. 공개 문서·오류·로그·PR에 실제 ID를 복사하지 않습니다. `{bot-id}`, `{space-id}`는 설명용 자리표시자이며 그대로 저장하지 않습니다. 허용되지 않은 인증 필드는 거부됩니다.

## 5. Teams 준비와 확인

앱·봇 등록과 대상 Teams 설치 권한을 가진 설정자가 Bot Connector에 맞는 tenant/client/secret, Teams channel 활성화와 앱 설치를 확인합니다. credential의 tenant/client는 ID 표와 같아야 합니다. 승인된 HTTPS endpoint의 경로는 `/api/v1/channel-connections/ms-teams/events`입니다(예: `https://example.com/api/v1/channel-connections/ms-teams/events`, 실제 주소 아님).

OAuth token 발급만으로 `연결됨`이 되지 않습니다. Microsoft JWT의 서명·issuer·audience·tenant/app, 인증된 service URL과 대상 activity가 일치해야 합니다. 연결 후 봇을 호출하는 최초 인증 activity를 보내고 질문 보존·CGA 답변 1회·같은 대화 회신을 확인합니다. 인증 실패·잘못된 tenant/target은 실행 없이 거부되어야 합니다. 실패하면 먼저 해제하고 ID/앱 설치/endpoint를 담당자와 확인한 뒤 새 질문으로 재검증합니다. [공식 Teams 문서](https://learn.microsoft.com/en-us/microsoftteams/platform/).

## 6. Slack 준비와 확인

설정자는 같은 앱·workspace의 bot token과 **별도 app-level token**을 준비합니다. app token에는 `connections:write`, 앱에는 Socket Mode와 필요한 이벤트·interaction 설정이 필요합니다. bot에는 사용 범위의 `chat:write`, `bots:read`, conversation 조회 권한(`channels:read`, `groups:read`, `im:read` 등 해당 종류), mention/message 구독 권한을 공식 문서로 확인합니다. scope 변경·재설치는 별도 권한 경계입니다. 봇을 대상 방에 초대하고 비보관 상태를 확인합니다.

공개 callback URL 대신 outbound Socket Mode를 사용합니다. app ID, bot ID와 bot user ID는 다르며 account에는 bot user ID를 씁니다. `signing_secret`은 허용되지만 현재 Socket Mode의 필수값·공개 HTTP 서명 검증 기능이 아닙니다. 연결 후 DM 또는 봇 mention 질문, 같은 thread의 답변, 동일 이벤트의 중복 답변 없음과 선택 동작을 확인합니다. `SLACK_IDENTITY_VERIFICATION_FAILED`/`missing_scope`/`not_in_channel`이면 해제 후 앱·권한·멤버십을 확인합니다. 앱 scope의 다른 수신기와 동시에 소유하지 않습니다. [공식 Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/).

## 7. Discord 준비와 확인

앱 관리자가 bot을 대상 guild에 설치하고 View Channel·Send Messages(스레드는 Send Messages in Threads), 카드 사용 시 Embed Links 등 필요한 권한과 overwrite를 확인합니다. 비공개 thread에는 bot 참여가 필요하며 보관·잠금 thread는 거부됩니다. 1:1은 실제 DM channel ID와 installation `DM`을 씁니다. group DM은 대상이 아닙니다.

공개 callback 없이 Gateway를 사용하며 현재 Identify intents는 `4609` (`GUILDS`, `GUILD_MESSAGES`, `DIRECT_MESSAGES`)입니다. `MESSAGE_CONTENT`를 요청하지 않으므로 모든 일반 메시지 내용을 수신한다고 보장하지 않습니다. mention/DM·카드 선택을 실제 앱 설정과 함께 검증하고 권한을 임의 확대하지 않습니다. guild/channel/account 불일치·접근권한 실패·Gateway 재연결 시 오류와 중복 회신 없음을 확인합니다. 앱 scope는 독점입니다. 안전한 수정은 해제 후 진행합니다. [공식 Gateway/intents](https://github.com/discord/discord-api-docs/blob/main/developers/events/gateway.mdx).

## 8. Telegram 준비와 확인

설정자는 기존 봇의 Bot API token, bot numeric ID와 대상 chat ID를 확인합니다. account/installation에는 username이 아닌 같은 numeric bot ID를 씁니다. private에서는 사용자가 먼저 봇 대화를 시작하고 group/supergroup에서는 봇 참여·메시지 전송 권한·필요한 사진 권한을 확인합니다. broadcast channel은 지원 대상이 아닙니다. privacy 설정에 따른 mention/명령·reply 수신 범위를 실제로 확인합니다.

`getUpdates` long polling이므로 공개 callback은 쓰지 않습니다. 다른 poller와 동시에 실행하지 않습니다. 기존 webhook이 있으면 `TELEGRAM_WEBHOOK_EXISTS`로 막히며 **자동 삭제하지 않습니다**. 기존 서비스 영향과 전환 승인을 먼저 확인합니다. 연결 후 private 또는 봇을 향한 그룹 질문·선택·답변과 offset 복구·중복 방지를 확인합니다. 해제는 polling을 멈추는 것이며 webhook 전환이나 backlog 삭제를 자동 수행하지 않습니다. [공식 Bot API](https://core.telegram.org/bots/api#getupdates).

## 9. Google Chat 준비와 확인

설정자는 **Google Workspace add-on이 아닌 HTTP Chat app**, 인증 audience **Project Number JWT** 모드를 확인합니다. URL-audience ID token/add-on 형식은 현재 구현 대상이 아닙니다. callback 경로는 `/api/v1/channel-connections/google-chat/events`입니다. 숫자 Project Number, 문자열 project ID, bot `users/{bot-id}`, 대상 `spaces/{space-id}`를 혼용하지 않습니다.

같은 프로젝트의 RSA service-account JSON(type, project_id, client_email, private_key_id, private_key, 고정 Google token_uri)을 준비합니다. 선택 `project_id`는 JSON 값과 같아야 합니다. Chat API와 프로젝트 조회를 준비하고 `chat.bot`, `cloudplatformprojects.readonly` OAuth scope 및 프로젝트 metadata 조회 권한을 설정자가 확인합니다. 앱을 대상 space에 추가합니다. 서비스계정 이메일이나 project ID를 account에 넣지 않습니다.

프로젝트 활성/번호와 space 검증 이후에도 첫 Google 서명 대상 이벤트가 있어야 활성화됩니다. 서명·issuer·정확한 숫자 audience와 bot/space 일치가 필요하며 회신 sender도 검증합니다. DM 또는 space mention 질문·thread 답변·카드 선택의 실제 선택값·중복 방지를 확인합니다. `GOOGLE_CHAT_PROJECT_VERIFICATION_FAILED`, `GOOGLE_CHAT_TARGET_VERIFICATION_FAILED`, `GOOGLE_CHAT_SENDER_VERIFICATION_FAILED`는 무시하지 말고 해제 후 설정을 조사합니다. 프로젝트 scope 독점과 기존 앱 영향도 확인합니다. [공식 요청 검증](https://developers.google.com/workspace/chat/verify-requests-from-chat).

## 10. LINE 준비와 확인

설정자는 Messaging API channel/Official Account의 access token과 channel secret, 봇 정보의 **bot user U-ID**를 확인합니다. installation과 account는 모두 그 U-ID이며 Console의 별도 **숫자 channel ID가 아닙니다**. target은 사용자 U-ID·그룹 C-ID·room R-ID 중 하나이며 해당 봇의 친구·그룹 참여와 메시지 권한을 준비합니다. group 수신 허용과 기존 자동응답에 따른 이중 회신 가능성도 설정자가 확인합니다.

callback은 `/api/v1/channel-connections/line/events`입니다. 프록시가 원문 body를 바꾸면 안 됩니다. `X-Line-Signature` HMAC을 **JSON 파싱 전 원문 바이트**로 검증합니다. 봇 API 신원 확인만으로 완료되지 않으며 첫 유효 서명 대상 이벤트가 필요합니다. 텍스트·postback 선택·동일 이벤트 재전달의 1회 처리와 잘못된 서명의 실행 거부를 확인합니다.

reply token은 단일 사용이며 구현은 수신 후 **55초 미만**, 재전달은 원 이벤트 후 **20분 미만**의 보수적 창을 적용합니다. 공식 허용 창을 지연 보장으로 해석하지 않습니다. 만료·불명 송신을 push나 새 token으로 자동 재시도하지 않습니다. channel secret 재발급은 기존 서명을 무효화하므로 별도 승인과 영향 확인 없이 하지 않습니다. [공식 서명 검증](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/) · [공식 reply 규칙](https://developers.line.biz/en/reference/messaging-api/#send-reply-message).

## 11. 상태·오류 대응

| 표시·code | 의미와 조치 |
|---|---|
| `disconnected` / `connecting` / `connected` / `disconnecting` / `error` | 관측 상태입니다. 연결 요청 수락이나 검사 통과와 구분합니다. connected도 전체 왕복·인수 완료를 뜻하지 않습니다. |
| `CONNECTION_KEY_UNAVAILABLE`, `CONNECTION_CREDENTIALS_UNAVAILABLE` | 키·version·암호문 복구를 담당자에게 요청합니다. 값 출력·임의 교체 금지. |
| `INVALID_CREDENTIALS`, `CONNECTION_CREDENTIALS_REQUIRED`, `INVALID_CONNECTION` | 필수값·필드명·ID 구분을 재확인합니다. 저장만 통과해도 provider 검증은 실패할 수 있습니다. |
| `CONNECTION_TARGET_DUPLICATE`, `CONNECTION_ACTIVE` | 기존 대상 중복 확인 또는 먼저 연결 해제. 연결 행을 무턱대고 삭제하지 않습니다. |
| `CONNECTION_WORKER_UNAVAILABLE`, `CHANNEL_PACKET_RUNTIME_UNAVAILABLE` | 담당자가 worker·Node bridge 준비를 확인합니다. 우회 실행하지 않습니다. |
| `LEASE_EXPIRED`, scope/identity 오류 | 목록을 다시 열고 담당자에게 code·시각·민감값 없는 증거를 전달합니다. lease/fence를 DB에서 수동 수정하지 않습니다. |
| 인증 401/403, body 초과 413, 형식 422, receiver disabled 503 | 인증/서명·원문·크기·서버 준비를 확인합니다. 수신 HTTP 200만으로 봇 회신을 판정하지 않습니다. |

화면에는 안전한 code 또는 일반 오류만 보일 수 있습니다. 외부 API 원문을 복사해 공개하지 않습니다. 자동 상태 갱신을 가정하지 말고 패널을 다시 엽니다.

## 12. 안전한 중단·복구와 한계

문제가 있으면 연결 해제로 새 작업을 중단하고 담당자는 필요 시 worker를 `false`로 되돌립니다. 이미 시작된 원격 HTTP 송신을 취소·회수한다고 보장하지 않습니다. `unknown` delivery는 성공 여부 불명이므로 자동 재실행·재송신·원장 삭제 금지입니다. 설정 패널에는 unknown 재처리 도구가 없습니다. 담당자가 공급자 기록과 내부 원장을 민감정보 없이 대조하고 별도 결정을 받아야 합니다. 해제·재연결로 기존 unknown을 재시도하지 않습니다.

코드는 검증된 PR/commit 정상 revert로 복구하되 먼저 worker를 비활성화합니다. 새 테이블이 모두 비어 있을 때만 migration downgrade가 허용됩니다. 연결·runtime 데이터가 있으면 거부가 정상이며 삭제·강제 downgrade하지 않고 승인된 백업/보존 계획을 따릅니다. 설정 삭제도 대화·delivery의 완전 삭제가 아닙니다.

암호화 master key/version의 자동 교체·재암호화 도구는 없습니다. 기존 암호문은 조직/연결/version AAD와 원래 키에 묶입니다. 환경 키만 바꾸면 복호화가 실패합니다. provider credential 교체는 승인 후 해제·수정·검사·재연결 순서로 하며 변경 후 최초 신원 이벤트가 다시 필요할 수 있습니다. 메모리 credential/token cache의 즉시 소거·수명 정리와 cursor/receipt 장기 증가·보존 정책은 아직 개선 경계입니다. 삭제·해제만으로 모든 cache/receipt가 제거된다고 보장하지 않습니다. 긴급 폐기는 담당자의 프로세스/공급자 폐기 계획과 별도 승인이 필요합니다.

## 13. 검증 후보 체크리스트

| Provider | 개발 증거 | 실제 플랫폼 |
|---|---|---|
| Teams | 구현·합성 JWT/native/packet 검증 | 미검증 |
| Slack | 구현·합성 Socket Mode/native 검증 | 미검증 |
| Discord | 구현·합성 Gateway/native 검증 | 미검증 |
| Telegram | 구현·합성 polling/native 검증 | 미검증 |
| Google Chat | 구현·합성 JWT/native/선택 검증 | 미검증 |
| LINE | 구현·합성 HMAC/native/reply-token 검증 | 미검증 |

이 표는 Tasks 1–11의 개발 증거 구분이며 현재 후보의 전체 API/Web·DB migration·Node22 image 검증, skip 내역과 exact SHA는 해당 후보의 별도 검증 기록으로 확인합니다. 실플랫폼 PASS가 아닙니다.

- 승인된 시험자가 각 provider의 등록→검사→연결→실수신→CGA 봇 실행→회신→선택→해제/재연결을 실제 화면에서 수행해야 합니다.
- 인증 실패·다른 target/조직·중복/재전달·재시작·timeout/unknown에서 중복 실행·송신이 없는지 확인합니다. 기록에는 commit/image, 시각, 합격/미검증, rollback만 남기고 실제 ID·Secret은 제외합니다.
- 실제 Secret 생성·등록·권한 변경·외부 호출/비용·운영 DB 적용·Oracle/운영 배포는 각각 필요한 별도 승인을 받은 뒤 수행합니다. paid LLM을 사용하는 답변 봇도 호출 모델·횟수·예산·중단 조건 승인이 필요합니다. 이 문서는 실행 승인이 아닙니다.

## 14. 소스 대조 위치

[관리 화면](../../apps/web/components/channel-connections-panel.tsx), [필드·호출](../../apps/web/lib/channel-connections-api.ts), [관리 API](../../apps/api/app/api/routes/channel_connections.py), [인증·암호화](../../apps/api/app/services/channel_connections.py), [수신 경로](../../apps/api/app/api/routes/channel_connection_events.py), [supervisor](../../apps/api/app/services/channel_connection_supervisor.py), [런타임](../../apps/api/app/services/channel_connection_runtime.py), [Teams](../../apps/api/app/services/channel_connection_teams.py), [Slack](../../apps/api/app/services/channel_connection_slack.py), [Discord](../../apps/api/app/services/channel_connection_discord.py), [Telegram](../../apps/api/app/services/channel_connection_telegram.py), [Google Chat](../../apps/api/app/services/channel_connection_google_chat.py), [Google 인증](../../apps/api/app/services/channel_connection_google_chat_auth.py), [LINE](../../apps/api/app/services/channel_connection_line.py), [migration](../../apps/api/alembic/versions/20261103_0028_channel_connections.py), [설정](../../apps/api/app/core/config.py).
