# CGA Studio 다국어 런타임 문구 회귀 검증

## 범위

- 대상 브랜치: `fix/remaining-multilingual-literals`
- 대상 영역: Studio 대화형 안내, 오류, 확인 문구, 접근성 문구
- 지원 언어: 한국어, 영어, 중국어(간체), 일본어, 베트남어, 프랑스어, 독일어
- 비대상: NLU/ML/Semantic 학습 로직, API 처리 로직, 데이터베이스 스키마

## TDD 증거

1. RED
   - 런타임 문구 카탈로그 계약 테스트 추가 후 6개 언어에서 246개 키 누락을 확인했다.
   - 직접 한글 안내 문구가 번역 계층을 우회하는 구성요소를 탐지했다.
2. GREEN
   - `test_multilingual_support_contract.py`: 113 passed
   - 전체 API 테스트: 679 passed, 4 skipped, 10 warnings
   - Next.js 프로덕션 빌드: 타입 검사 통과, 정적 페이지 46개 생성

## 번역 무결성 검사

- 언어별 런타임 문구 수: 327개
- 번역값 내 한글 잔존: 0건
- `{intent}`, `{score}`, `{card}` 등 자리표시자 손실/변경: 0건
- 중국어 발음 표기 대신 간체 본문을 선택하도록 수집 결과를 교정했다.
- 핵심 용어 표본: 저장, 삭제, 사용자 입력, 의도 미분류, 봇 허브, 학습 완료, 설정 저장

## 실행 명령

```powershell
Set-Location apps\api
& 'C:\Users\cyhuh\anaconda3\python.exe' -m pytest tests/test_multilingual_support_contract.py -q
& 'C:\Users\cyhuh\anaconda3\python.exe' -m pytest -q

Set-Location ..\web
npm run build
```

## 판정

- UI 런타임 문구 변경이 API 동작과 학습 엔진 계약을 변경하지 않는 것을 전체 API 회귀 테스트로 확인했다.
- 실제 운영 반영 후 언어별 로그인 세션에서 주요 Studio 화면과 브라우저 Network의 same-origin 요청을 추가 확인한다.
