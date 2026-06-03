# CGA i18n and Error Message Policy

작성 기준: CGA Studio는 영어 기본 UI와 다국어 지원을 전제로 한다. 특히 메뉴보다 에러 메시지, 상태 메시지, 알림 문구를 초기부터 i18n 구조로 분리해야 한다.

## 1. 핵심 원칙

1. 모든 사용자 노출 문구는 코드에 직접 하드코딩하지 않는다.
2. 메뉴, 버튼, 라벨보다 에러 메시지와 운영 알림을 먼저 i18n 키로 분리한다.
3. 기본 언어는 English다.
4. 1차 지원 언어는 English, Korean, Chinese Simplified, Japanese, Vietnamese, German, French다.
5. 카카오톡 채널은 Korean locale에서만 기본 활성화한다.
6. 다른 지역 메신저는 public core에서 직접 구현하지 않고, 카카오톡 구조를 참고해 각 지역에서 확장할 수 있게 한다.
7. API 에러 응답은 번역된 문장만 반환하지 않는다. 반드시 안정적인 `error_code`를 포함한다.
8. 화면은 `error_code`를 기준으로 현재 locale의 메시지를 표시한다.
9. 번역 누락 시 English 메시지로 fallback한다.

## 2. 지원 Locale

| Locale | 언어 | 우선순위 | 비고 |
| --- | --- | --- | --- |
| en | English | 기본 | 기본 fallback |
| ko | Korean | 1차 | Kakao KR 채널 활성 |
| zh-CN | Chinese Simplified | 1차 | 중국어 간체 |
| ja | Japanese | 1차 | 일본어 |
| vi | Vietnamese | 1차 | 베트남어 |
| de | German | 1차 | 독일어 |
| fr | French | 1차 | 프랑스어 |

## 3. 메시지 구분

| 구분 | 예시 | 처리 원칙 |
| --- | --- | --- |
| UI Label | Save, Deploy, Configure Bot | 일반 i18n 키 |
| Validation Message | Bot name is required | 폼 검증 전용 키 |
| API Error | LLM connection failed | error_code 기반 표시 |
| Runtime Error | Simulator timeout | error_code 기반 표시 |
| Operation Alert | Channel failed 3 times | 알람 코드 기반 표시 |
| Commercial State | Commercial Module Required | entitlement 상태 키 |

## 3.1 CGA 에러와 봇 에러

에러 메시지는 반드시 두 종류로 분리한다.

| 구분 | 대상 | 언어 기준 | 예시 |
| --- | --- | --- | --- |
| CGA Error | CGA Studio 사용자, 관리자, 운영자 | 사용자 언어 `user.locale` | 로그인 실패, 권한 없음, 저장 실패, 그룹 가입신청 실패, API 설정 오류 |
| Bot Error | 최종 봇 사용자 | 봇 언어 `bot.defaultLocale` | 답변 없음, 외부 API 조회 실패, 봇 fallback 답변 |

원칙:

- CGA 에러는 사용자의 언어로 표시한다.
- 봇 에러는 봇의 언어로 표시한다.
- 사용자의 언어와 봇의 언어는 서로 다르다.
- 같은 그룹에서 여러 언어 사용자가 공동 작업하더라도 CGA 에러는 각 사용자 언어로 표시한다.
- 봇 런타임에서 최종 고객에게 보이는 에러는 봇 언어 기준으로 표시한다.
- 에러 코드는 `CGA_*`와 `BOT_*` prefix로 분리한다.

## 4. Error Code 규칙

에러 코드는 언어와 무관한 안정적인 식별자다.

권장 형식:

```text
CGA_<DOMAIN>_<DETAIL>
BOT_<DOMAIN>_<DETAIL>
```

예시:

```text
CGA_BOT_NAME_REQUIRED
CGA_LLM_NOT_CONNECTED
CGA_LLM_REQUIRED_FOR_PDF
CGA_HANDOFF_RESULT_INVALID
CGA_CHANNEL_CONNECTION_FAILED
CGA_COMMERCIAL_MODULE_REQUIRED
```

## 5. API 응답 원칙

API는 아래 구조를 반환한다.

```json
{
  "error_code": "CGA_LLM_NOT_CONNECTED",
  "message_key": "errors.llm.notConnected",
  "fallback_message": "No LLM connection is configured.",
  "details": {}
}
```

화면은 `message_key` 또는 `error_code`로 현재 locale의 메시지를 찾는다.

## 6. 번역 Fallback

1. 현재 locale 메시지 조회
2. 없으면 English 메시지 조회
3. English도 없으면 `fallback_message` 표시
4. 그래도 없으면 `error_code` 표시

## 7. Public Core와 Commercial Module 관계

Public Core는 i18n 키와 기본 번역 구조를 포함한다.

Commercial Module은 자체 메시지를 추가할 수 있지만, Public Core의 메시지 해석 규칙을 따라야 한다.

Commercial Module 메시지 키는 아래 prefix를 사용한다.

```text
advancedBuilder.*
operationsMonitor.*
entitlement.*
```

## 8. 구현 전 반드시 지킬 사항

- 화면을 먼저 만들더라도 문구는 i18n 키로 작성한다.
- 에러 메시지는 영어 문장을 코드에 직접 쓰지 않는다.
- 서버/클라이언트 모두 동일한 error_code 목록을 참조한다.
- 신규 에러가 생기면 모든 1차 지원 locale에 번역 키를 추가한다.
- 번역이 확정되지 않은 언어는 임시 번역이라 표시하고 English fallback을 보장한다.
