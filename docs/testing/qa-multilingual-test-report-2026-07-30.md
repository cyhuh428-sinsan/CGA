# CGA Studio QA 테스트 보고서 — 다국어 지원 라운드

- 작성일: 2026-07-30
- 작성자: QA 테스트 담당 (Claude Code)
- 대상 브랜치/커밋: `main` (`1b28a6d docs: expand multilingual manuals and getting started`, 2026-07-26)
- 테스트 사이트: **https://cga.sinsan.kr**
- 이전 라운드 대비: `main`이 214커밋 진행됨. 핵심 신규 기능은 **7개 언어 다국어(L10N) 지원**
- 원칙: 소스 코드 미수정. 검증 스크립트는 저장소 외부(스크래치패드)에서만 실행함
- 관계 문서: [qa-regression-report-2026-07-22.md](qa-regression-report-2026-07-22.md), [qa-live-test-report-2026-07-22.md](qa-live-test-report-2026-07-22.md)

---

## 0. 2026-07-31 검토 및 조치 결과

7월 30일 QA 결과는 원본 실행 기록으로 유지하고, 후속 수정과 재검증 결과를 아래에 구분해 기록한다.

| 항목 | 조치 결과 |
|---|---|
| 분석 도움말 5키 × 6언어 미번역 | `fix/multilingual-analysis-tooltips`에서 30개 문자열 번역 (`ba7b6ef`) |
| 카탈로그 감시 테스트 | 결함 수정 전 `1 failed, 3 passed` RED → 수정 후 `4 passed` GREEN |
| 감시 도구 누락 | Node 또는 TypeScript가 없으면 조용히 skip하지 않고 명시적으로 실패하도록 보강 |
| 공식 전체 회귀 | `686 passed, 4 skipped, 0 failed` |
| 웹 운영 빌드 | 46개 라우트 생성, TypeScript 포함 PASS |
| 로그인 언어 선택기 접근성 | 별도 `fix/login-language-accessibility` 브랜치에서 지역화된 접근성 이름 추가 (`a866dd7`), 관련 테스트 `117 passed`, 웹 빌드 PASS |

**현재 판정: 조건부 합격.** 코드와 자동화 검증은 GREEN이다. 다만 인증이 필요한 분석·봇 테스트·Admin 화면의 라이브 다국어 확인과 전용 테스트 DB를 사용하는 통합 테스트 4건은 아직 실행하지 않았으므로, 운영 반영 전 해당 근거를 추가해야 한다.

---

## 1. 요약 (Executive Summary)

| 구분 | 결과 |
|---|---|
| 백엔드 회귀 테스트 (공식 `-Scope Full`) | **682 passed, 4 skipped, 0 failed** |
| 프론트엔드 TypeScript 검사 | **PASS (exit 0)** |
| 프론트엔드 프로덕션 빌드 | **PASS (전 라우트 생성 완료)** |
| 다국어 카탈로그 독립 검증 (14,580개 문자열) | **결함 1건 확정** (미번역 30개 문자열) |
| 백엔드 기본 메시지 카탈로그 (14키 × 7언어) | **이슈 0건** |
| 라이브 사이트 다국어 전환 (비로그인 범위) | **PASS** |
| 이전 라운드 지적 3건 (5.1 / 5.2 / 5.3) | **전부 조치 확인** |

**당시 판정: 배포 가능.** 이후 검토에서 인증 화면 라이브 검증과 DB 통합 테스트가 남아 있음을 반영해 현재 판정은 0장의 **조건부 합격**으로 정정했다.

---

## 2. 테스트 환경

- 공식 회귀 스크립트 `scripts/run-regression-tests.ps1`를 그대로 사용 (가이드: [REGRESSION_TEST_GUIDE.md](REGRESSION_TEST_GUIDE.md))
- Python: Anaconda 3.13.9 (스크립트가 자동 선택하는 경로, 필요한 의존성 전부 설치되어 있음)
- Node.js v24.18.0 / npm 11.12.1
- 이전 라운드에서 지적했던 "시스템 Python 3.14 + SQLAlchemy 비호환" 문제는, 공식 스크립트가 Anaconda 3.13을 우선 사용하도록 되어 있어 재현되지 않았다.

> 참고: 이전 보고서 8.2절 항목 4(CI Python 버전 고정)는 스크립트 차원에서 사실상 해소되었다. 다만 스크립트는 Anaconda가 없으면 시스템 `python`으로 폴백하므로, 시스템 Python이 3.14인 환경에서는 여전히 깨질 수 있다. CI에 명시적 버전 고정은 계속 권고한다.

---

## 3. 테스트 시나리오 및 결과

### 3.1 자동화 회귀 테스트

| ID | 시나리오 | 방법 | 결과 |
|---|---|---|---|
| REG-01 | 백엔드 전체 회귀 | `.\scripts\run-regression-tests.ps1 -Scope Full` | **PASS** — 682 passed, 4 skipped, 0 failed, 66초 |
| REG-02 | DB 통합 테스트 스킵 사유 확인 | `-rs` 출력 확인 | **정상** — 4건 모두 `AIDOT_TEST_DATABASE_URL` 미설정 사유. 결함 아님 |
| REG-03 | 프론트엔드 타입 검사 | `npx tsc --noEmit` | **PASS** — exit 0, 오류 0건 |
| REG-04 | 프론트엔드 운영 빌드 | `npm run build` | **PASS** — 컴파일·TypeScript·정적 페이지 생성 완료 |

이전 라운드(2026-07-22) 대비 백엔드 테스트가 **529건 → 682건(+153건)** 으로 증가했고, 그때 실패했던 5건은 전부 해소되어 실패 0건이다.

### 3.2 다국어(L10N) 기능 — 신규 기능 집중 검증

지원 언어 7종: `ko`, `en`, `zh-CN`, `ja`, `vi`, `fr`, `de` ([apps/web/lib/language.ts](../../apps/web/lib/language.ts))

**설계 구조 파악 결과 (검증 방법 설계의 근거)**

카탈로그는 두 가지 패턴을 혼용한다. 이를 구분하지 않으면 오탐이 대량 발생하므로 먼저 확인했다.

1. **명시적 키 패턴** — `{ settings: "설정" }` 형태. `satisfies Record<SupportedLanguage, XCatalog>`로 선언되어 **키 누락은 TypeScript가 컴파일 시점에 차단**한다.
2. **한국어 원문 키 패턴** — `{ labels: { "조회모드 입장": "Enter view mode" } }` 형태. 한국어 원문을 키로 번역문을 조회하며, `ko.labels`는 의도적으로 비어 있다(한국어는 원문 통과).

따라서 TypeScript가 잡지 못하는 아래 3가지를 독립 검증 대상으로 삼았다.

| 검사 항목 | 이유 |
|---|---|
| 미번역 잔존 (비-ko 값에 한글 잔존) | 키는 있고 값만 한국어 복사본이면 컴파일러가 통과시킨다 |
| 빈 값 | 동일 |
| 치환 토큰 불일치 (`{name}` 등) | ko에는 있고 다른 언어엔 없으면 런타임에 값이 사라진다 |
| 영어 폴백 (`locale()` 패턴 전용) | 자국어로 덮어쓰지 않은 키는 영어로 표시된다 |

**검증 규모**: 카탈로그 파일 59개, 카탈로그 59개, ko 기준 문자열 2,430개 → **비-ko 6개 언어 대조 14,580개 문자열**

| ID | 시나리오 | 결과 |
|---|---|---|
| L10N-01 | 카탈로그 키 집합 일치 (7언어) | **PASS** — `satisfies`로 컴파일 시점 보장, 타입 검사 통과 확인 |
| L10N-02 | 미번역 잔존 검출 | **FAIL — 결함 1건 (5.1절)** — 42건 검출 중 12건은 정당한 예외, **30건이 실제 결함** |
| L10N-03 | 빈 값 검출 | **PASS** — 8건 검출되었으나 전부 의도된 설계 (아래 오탐 판정 참조) |
| L10N-04 | 치환 토큰 불일치 | **PASS** — 0건 |
| L10N-05 | `studio-pages` 영어 폴백률 | **PASS** — 365개 라벨 기준 zh-CN 0%, ja 0%, vi 0.3%, fr 1.1%, de 2.2%이며 검출된 소수는 전부 정당한 동족어 |
| L10N-06 | 백엔드 기본 메시지 카탈로그 | **PASS** — 14키 × 7언어, 미번역·누락·빈값 **0건** |
| L10N-07 | 컴포넌트 하드코딩 한국어 잔존 (전체 스윕) | **PASS** — 아래 커버리지 공백 분석 참조 |

**오탐으로 판정하고 제외한 항목** (검증 과정에서 확인한 근거를 함께 남긴다)

| 검출 내용 | 판정 | 근거 |
|---|---|---|
| `countUnit` 빈 값 8건 (en/vi/fr/de) | **정상** | ko `"개"`, zh-CN `"个"`, ja `"件"`은 있고 영어·베트남어·프랑스어·독일어는 수량 단위를 쓰지 않는다. `{count}{countUnit}` 렌더링이므로 `7개` → `7`이 올바른 결과 |
| 키 집합 EXTRA 다수 (ai-options, evaluation, flow-designer, version-management) | **정상** | 위 "한국어 원문 키 패턴". `ko.labels`가 비어 있는 것이 설계 |
| `entity-list`/`intent-list`의 `uploadHeaderHelp` 6건 | **정상** | 문장은 번역됨(`"Use the header ..."`). 백틱 안 한국어는 **실제 CSV 파일이 요구하는 한국어 컬럼명**이므로 유지가 맞다 |
| `evaluation-page.tsx`의 `<code>문장,정답 의도</code>` 3건 | **정상** | CSV 형식 예시 리터럴. 주변 라벨은 `tEvaluation()` 경유 확인 |
| `studio-pages.ts` 로드 실패 1건 | **검증 하네스 한계** | 제 1차 스크립트가 `require`를 스텁 처리해 발생. 별도 로더로 재검증하여 정상 확인 (L10N-05) |

**팀 자체 테스트의 커버리지 공백 분석**

`test_multilingual_support_contract.py::test_remaining_settings_and_hub_pages_have_no_direct_korean_ui_literals`는 컴포넌트 **14개만** 대상으로 한다. 동일한 검출 로직을 `apps/web/components/*.tsx` **전체**에 적용해 공백을 확인했다.

- 지정된 14개 파일 위반: **0건** (테스트가 정상 작동 중)
- 지정되지 않은 파일 위반: **1개 파일 3건** → `evaluation-page.tsx`의 CSV 예시로, 위 표대로 정당한 예외

즉 이 테스트의 대상 목록이 좁다는 구조적 공백은 있으나, **현재 시점에 그 공백으로 새는 실제 결함은 없다.** 다만 향후 신규 컴포넌트가 추가될 때 자동으로 감시되지 않으므로 8장에서 개선을 권고한다.

### 3.3 라이브 사이트 검증 (https://cga.sinsan.kr)

| ID | 시나리오 | 결과 |
|---|---|---|
| LIVE-01 | Studio `/health/ready` | **PASS** — `{"status":"ok","database":"ok"}` (200) |
| LIVE-02 | API `api-cga.sinsan.kr/health/ready` | **PASS** — `{"status":"ok","database":"ok"}` (200) |
| LIVE-03 | 로그인 화면 언어 선택기에 7개 언어 노출 | **PASS** — 한국어/English/简体中文/日本語/Tiếng Việt/Français/Deutsch 전부 확인 |
| LIVE-04 | 언어 전환 즉시 반영 (ko → en) | **PASS** — `로그인/아이디 저장/회원가입` → `Sign in/Remember ID/Sign up` |
| LIVE-05 | 언어 전환 즉시 반영 (en → ja) | **PASS** — `ログイン/IDを保存/新規登録` |
| LIVE-06 | 언어 설정이 페이지 이동 후 유지 | **PASS** — 일본어 상태로 `/signup` 이동 시 유지 |
| LIVE-07 | 회원가입 화면 전체 번역 | **PASS** — `アカウント作成/ログインID/パスワード/名前/コメント/サーバー/グループ/言語` 전부 번역. `기본그룹`·`Support Bot Group`은 DB 데이터이므로 원문 유지가 정상 |

**미완료**: 인증이 필요한 화면(분석/시뮬레이터/Admin 등)의 라이브 다국어 검증은 세션 만료로 이번 라운드에서 수행하지 못했다(7장 참조).

### 3.4 이전 라운드 지적 사항 조치 확인

| 이전 항목 | 조치 상태 | 확인 근거 |
|---|---|---|
| **5.1** 시뮬레이터 의도 분류 실패 (`include_document` 누락) | **조치 완료** | `fetchStudioWorkspaceContext`가 `include_document`를 항상 명시적으로 전송하도록 수정(`470b33a`). 라이브 재현 확인 기록([qa-regression-test-baseline.tdd.md](qa-regression-test-baseline.tdd.md)): `가입안했어요` → `무동의 계약` 정상 분류 |
| **QA 기준선 5건 실패** | **조치 완료** | `5905d44`에서 LLM 픽스처 2건·라우트 경로 3건 정렬. 이번 라운드 실패 0건으로 재확인 |
| **DB 통합 테스트 픽스처** | **코드 조치 확인 / 실제 통합 실행 미검증** | Alembic URL 마스킹·상대경로·로깅 격리 픽스처 결함 3건 수정(`bd9f6a4`, `6a0caf9`). 이번 라운드는 `AIDOT_TEST_DATABASE_URL` 미설정으로 4건 모두 skip |
| **5.2** 만료 편집 잠금 자동 정리 부재 | **조치 완료** | API 기동 직후 + 60초 주기 백그라운드 정리 작업 도입. `test_edit_lock_cleanup.py` 추가([edit-lock-cleanup-verification-2026-07-22.md](edit-lock-cleanup-verification-2026-07-22.md)) |
| **5.3** Vector Worker `worker_unreachable` | **조치 완료** | `cga-vector-worker` 전용 서비스·네트워크·볼륨 분리 배포, CPU 전용 이미지로 전환. 대시보드 상태 함수가 `worker_unreachable` 미반환 확인([cga-vector-worker-deployment.tdd.md](cga-vector-worker-deployment.tdd.md)) |
| **회귀 테스트 자산화** | **채택됨** | 제가 작성한 `test_workspace_context_shared_callers_regression.py`가 공식 `-Scope Quick` 스위트의 핵심 대상으로 채택되었고, 실행 가이드와 스크립트가 신설되었다 |

이전 보고서에서 지적한 항목이 **전부 조치되었음을 확인했다.**

---

## 4. 이번 라운드에서 실행하지 않은 항목

운영 데이터를 변경하는 시나리오는 이전 라운드에서 확정된 방침대로 실행하지 않았다.

- `AIDOT-06` Aidot 봇 패키지 업로드/다운로드 왕복
- `HUB-07` 봇 삭제 플로우
- 실제 재학습(학습하기) 실행
- 회원가입 폼 제출

---

## 5. 발견된 결함

### 5.1 [조치됨 · 중간] 분석 화면 도움말 툴팁 5종이 6개 언어 전부에서 한국어로 표시됨

- **위치**: [apps/web/lib/i18n/analysis.ts](../../apps/web/lib/i18n/analysis.ts) → `ANALYSIS_CATALOGS`
- **영향 화면**: 운영 > `AN 분석` (`/studio/bots/{botId}/versions/{versionId}/analysis`)
- **영향 언어**: `en`, `zh-CN`, `ja`, `vi`, `fr`, `de` — **한국어를 제외한 전 언어**
- **영향 문자열**: 5개 키 × 6개 언어 = **30개 문자열**

대상 키:

| 키 | 노출 위치 |
|---|---|
| `cumulativeHelp` | [analysis-page.tsx:1117](../../apps/web/components/analysis-page.tsx) |
| `periodHelp` | [analysis-page.tsx:1130](../../apps/web/components/analysis-page.tsx) |
| `periodTrendHelp` | [analysis-page.tsx:1169](../../apps/web/components/analysis-page.tsx) |
| `topInquiriesHelp` | [analysis-page.tsx:1236](../../apps/web/components/analysis-page.tsx) |
| `selectedDateHistoryHelp` | [analysis-page.tsx:1252](../../apps/web/components/analysis-page.tsx) |

- **증상**: 6개 비한국어 카탈로그의 해당 값이 `ko` 값과 **문자열 단위로 완전히 동일**하다. 즉 번역되지 않은 한국어 원문이 그대로 들어가 있다.

  예 (`en`):
  ```
  ko: "자주 묻는 의도/모듈을 집계해 문의량과 응답률을 보여줍니다."
  en: "자주 묻는 의도/모듈을 집계해 문의량과 응답률을 보여줍니다."
  ```

- **사용자 영향 확인**: 5개 키 전부 `<AnalysisInfoTip text={copy.X} />` 형태로 렌더링되어 **실제 화면의 도움말 툴팁으로 노출된다.** 죽은 코드가 아니다.
- **왜 기존 검사에 걸리지 않았는가**:
  1. `satisfies Record<SupportedLanguage, AnalysisCatalog>`는 **키 존재만** 검사하므로 값이 한국어 복사본이어도 통과한다.
  2. 팀의 하드코딩 한국어 검사(`test_multilingual_support_contract.py`)는 **컴포넌트 `.tsx` 파일**만 대상으로 하며, **카탈로그(`lib/i18n/*.ts`) 내부의 미번역 값은 검사 범위에 없다.**
- **재현 방법**: 언어를 한국어 외로 전환한 뒤 분석 화면의 5개 도움말 아이콘에 마우스를 올리면 한국어 설명이 표시된다.
- **판정**: 기능 장애는 아니며 데이터 손실·오류도 없다. 다만 다국어 지원을 공식 기능으로 제공하는 상황에서 **비한국어 사용자에게 읽을 수 없는 도움말이 노출**되므로 번역 보완이 필요하다.
- **권고**: `analysis.ts`의 6개 비한국어 카탈로그에서 위 5개 키를 번역하고, 재발 방지를 위해 8장의 회귀 테스트를 추가할 것.
- **2026-07-31 조치**: `fix/multilingual-analysis-tooltips`에서 30개 문자열을 번역하고 감시 테스트를 GREEN으로 전환했다(`ba7b6ef`). 공식 `-Scope All` 결과는 `686 passed, 4 skipped, 0 failed`, 웹 운영 빌드 PASS다.

### 5.2 [조치됨 · 경미] 로그인 언어 선택기에 접근성 이름이 없음

- **위치**: 로그인 화면의 언어 선택 `<select>`. 회원가입 화면은 이미 `<label>`로 연결되어 있어 영향 대상이 아니다.
- **증상**: 로그인 화면의 `<select>`에 연결된 `<label>` 또는 `aria-label`이 없어 접근성 이름이 첫 옵션 텍스트인 `"한국어"`로 계산된다.
- **판정**: 시각적 표시와 전환 기능은 정상이지만, 로그인 화면에 한정된 접근성 결함이다.
- **2026-07-31 조치**: `fix/login-language-accessibility`에서 `aria-label={t("common.language")}`을 추가했다(`a866dd7`). RED `1 failed, 116 passed` → GREEN `117 passed`, 웹 운영 빌드 PASS를 확인했다.

---

## 6. 검증에 사용한 도구

저장소를 수정하지 않기 위해 검증 스크립트는 전부 스크래치패드에서 실행했다. 재사용이 필요하면 8장 권고대로 저장소 내 테스트로 정식화할 것을 제안한다.

| 스크립트 | 목적 |
|---|---|
| `check-l10n.js` | 59개 카탈로그를 TypeScript 트랜스파일 후 로드해 미번역·빈값·키불일치·토큰불일치 검출 (14,580개 문자열 대조) |
| `check-fallback.js` | `@/` 별칭까지 해석하는 로더로 `studio-pages` 계열의 영어 폴백률 측정 |

---

## 7. 미완료 항목 및 사유

| 항목 | 사유 |
|---|---|
| 인증 필요 화면의 라이브 다국어 검증 (분석/시뮬레이터/Admin) | 브라우저 세션 만료. 5.1 결함은 코드 수준에서 확정했으므로 판정에는 영향 없음. 로그인 후 재개 가능 |
| 수정된 분석 도움말의 라이브 육안 확인 | 분석 화면 진입에 로그인 필요. 6개 비한국어 × 5개 도움말을 확인해야 함 |
| 파괴적 시나리오 3건 | 4장 방침에 따라 보류 |

---

## 8. 권고사항 (우선순위 순)

1. ~~**[결함 수정]** `analysis.ts`의 5개 도움말 키를 6개 언어로 번역~~ → **0장과 5.1절에서 조치 및 GREEN 확인**
2. ~~**[회귀 방지 — 중요]** 카탈로그 **값**의 미번역을 감시하는 테스트 추가~~ → **전용 감시 테스트 추가 및 GREEN 확인**
   - 구현 결과: 비한국어 값이 한국어 원문 복사본으로 남으면 실패하며, Node 또는 TypeScript가 없을 때도 명시적으로 실패
3. ~~**[커버리지 확대]** `components/*.tsx` 전체 스윕 + 예외 화이트리스트 방식 추가~~ → **전용 감시 테스트에 반영**
4. **[환경]** CI에 Python 버전을 명시적으로 고정할 것. 공식 스크립트는 Anaconda 부재 시 시스템 `python`으로 폴백하므로, Python 3.14 환경에서는 SQLAlchemy 비호환으로 전체 수집이 실패한다.
5. **[후속 검증]** 로그인 세션 확보 후 인증 화면의 라이브 다국어 검증과 수정된 5.1 도움말 육안 확인을 수행할 것 (7장).
6. **[기존 유지]** 파괴적 시나리오 3건은 전용 테스트 환경과 승인 확보 후 별도 라운드로 진행.

---

## 부록. 재현 명령

```powershell
# 공식 회귀 테스트 (백엔드 전체 + 웹 빌드)
.\scripts\run-regression-tests.ps1 -Scope All

# 빠른 회귀 (공용 워크스페이스 컨텍스트 계약 20건)
.\scripts\run-regression-tests.ps1 -Scope Quick

# 운영 헬스체크
curl.exe -fsS https://cga.sinsan.kr/health/ready
curl.exe -fsS https://api-cga.sinsan.kr/health/ready
```

## 부록. 결과 보고 형식 (가이드 9장 준수)

```text
실행일시: 2026-07-30 09:46 ~ 10:20
브랜치: main
커밋: 1b28a6d docs: expand multilingual manuals and getting started
실행 범위: Full + Web + 다국어 독립 검증 + 라이브(비로그인)
테스트 결과: 682 passed, 4 skipped, 0 failed
Web 빌드: PASS
최초 오류: 없음 (자동화 테스트 기준)
추가 발견: analysis.ts 도움말 5키 × 6언어 미번역 (자동화 테스트 범위 외)
판정: 배포 가능 (번역 보완 권고)
```
