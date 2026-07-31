# 다국어 QA 후속 수정 TDD 근거

- 기준 보고서: [qa-multilingual-test-report-2026-07-30.md](qa-multilingual-test-report-2026-07-30.md)
- 기준 커밋: `main` `1b28a6d`
- 제품 수정 브랜치: `fix/multilingual-analysis-tooltips`
- 접근성 수정 브랜치: `fix/login-language-accessibility`

## 사용자 관점 보장

1. 한국어 외 언어를 사용하는 운영자는 분석 화면의 5개 도움말을 선택한 언어로 읽을 수 있다.
2. 신규 카탈로그에 한국어 원문 복사본이 남으면 전체 회귀 테스트가 실패한다.
3. 감시 테스트 실행에 필요한 Node 또는 TypeScript가 없으면 검사가 조용히 생략되지 않는다.
4. 스크린리더 사용자는 로그인 화면의 언어 선택기를 현재 UI 언어의 이름으로 식별할 수 있다.

## RED → GREEN 근거

| 대상 | RED | 수정 | GREEN |
|---|---|---|---|
| 분석 도움말 번역 | `1 failed, 3 passed`: `analysis.ts` 5키 × 6언어, 30개 문자열 검출 | 각 비한국어 카탈로그에 5개 도움말 번역 추가 | 전용 테스트 `4 passed` |
| 로그인 언어 선택기 | `1 failed, 116 passed`: 지역화된 접근성 이름 없음 | `aria-label={t("common.language")}` 추가 | 관련 테스트 `117 passed` |

## 실행한 검증

| 명령 | 결과 | 보장 범위 |
|---|---|---|
| `python -m pytest apps/api/tests/test_locale_catalog_translation_completeness.py -q` | `4 passed` | 카탈로그 로드, 지원 언어 일치, 한국어 원문 복사 방지, 컴포넌트 전체 스윕 |
| `scripts/run-regression-tests.ps1 -Scope All` | `686 passed, 4 skipped, 0 failed` | 백엔드 전체 회귀 및 웹 운영 빌드 |
| `python -m pytest tests/test_multilingual_support_contract.py -q` | `117 passed` | 로그인 언어 접근성 계약 포함 다국어 계약 |
| `npm run build` | 46개 라우트 생성, PASS | 로그인 접근성 수정 브랜치의 TypeScript 및 Next.js 운영 빌드 |

## 변경 영향 범위

- `apps/web/lib/i18n/analysis.ts`: 도움말 표시 문자열만 변경
- `apps/api/tests/test_locale_catalog_translation_completeness.py`: 번역 감시 테스트와 실행 전제 강화
- `apps/web/app/login/page.tsx`: 언어 선택기에 접근성 이름 1개 추가
- API, 데이터베이스, NLU/ML/시멘틱/LLM 엔진, 분류 순서 및 운영 데이터 변경 없음

## 남은 검증

- 인증 상태에서 분석 화면 5개 도움말 × 6개 비한국어의 실제 표시 확인
- 인증 상태에서 봇 테스트와 Admin 화면의 다국어 스모크 테스트
- `AIDOT_TEST_DATABASE_URL`이 설정된 전용 테스트 DB에서 건너뛴 통합 테스트 4건 실행

현재 결과는 코드와 자동화 기준 GREEN이며, 위 라이브 및 DB 검증 전까지 운영 판정은 조건부 합격이다.
