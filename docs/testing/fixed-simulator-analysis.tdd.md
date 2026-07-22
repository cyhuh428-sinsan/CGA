# 봇 테스트 분석 패널 고정 및 봇 평가 요약 제거 TDD 기록

> 이 문서는 `4646be7` 배포 당시의 검증 기록이다. 이후 `90f9c97`에서 전용 봇 테스트 화면은 분석 패널 상시 표시를 유지하고, 둥근 버튼으로 여는 팝업 시뮬레이터는 채팅 우선·분석 패널 토글 방식으로 변경됐다.

## 사용자 요구

- 봇 테스트에서 분석 데이터 패널을 항상 표시한다.
- 봇 평가에서 상단 요약 통계를 표시하지 않는다.

## RED

- 커밋: `21ae9a6 test: require fixed simulator analysis and compact evaluation`
- 명령: `python -m pytest tests/test_bot_configure_ui_contract.py -q`
- 결과: 신규 테스트 2개 실패, 기존 테스트 3개 통과.

## GREEN

- 커밋: `4646be7 feat: keep simulator analysis open and compact evaluation`
- 같은 테스트 결과: `5 passed`.
- Web 운영 빌드와 TypeScript 검사 통과.

## 보장 범위

| 보장 내용 | 검증 | 결과 |
|---|---|---|
| 시뮬레이터 분석 패널을 항상 렌더링 | UI 계약 테스트, 운영 브라우저 | PASS |
| 분석 패널 열기·닫기 버튼을 렌더링하지 않음 | UI 계약 테스트, 운영 브라우저 | PASS |
| 봇 평가 상단 요약 통계를 렌더링하지 않음 | UI 계약 테스트, 운영 브라우저 | PASS |
| 웹 프로덕션 번들 생성 | `npm run build` | PASS |

## 운영 검증

- Daon Studio를 `4646be7`로 배포했다.
- Studio와 API가 healthy이고 Studio ready 응답의 DB 상태가 정상이다.
- 운영 브라우저에서 분석 패널 1개, 고정 레이아웃 1개, 열기·닫기 버튼 0개를 확인했다.
- 봇 평가에서 공용 작업 헤더 1개와 요약 통계 0개를 확인했다.

## 알려진 범위

- 이번 변경은 렌더링 계약 변경이므로 별도 수치형 커버리지 리포트는 생성하지 않았다.
- 시뮬레이터 대화 실행 로직과 평가 본문 기능은 변경하지 않았다.
