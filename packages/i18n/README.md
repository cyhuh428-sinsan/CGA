# CGA i18n Package

CGA는 첫 구현 단계부터 사용자 노출 문구, 특히 에러 메시지와 운영 알림을 i18n key로 관리한다.

## 핵심 원칙

- 기본 locale은 `en`이다.
- API와 런타임은 안정적인 `error_code`와 `message_key`를 반환한다.
- UI는 현재 locale 리소스로 메시지를 표시한다.
- 번역 누락 시 `en -> fallback_message -> error_code` 순서로 fallback한다.
- Commercial Module도 같은 메시지 해석 규칙을 사용한다.

## 파일

- `error-catalog.json`: 안정적인 에러 코드와 message key 목록
- `locales/*.json`: locale별 메시지 리소스
- `src/resolve-message.js`: 클라이언트/서버 공용 메시지 해석 유틸
