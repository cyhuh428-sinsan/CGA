# CGA Studio QA 테스트 시나리오 및 실행 보고서

- 작성일: 2026-07-22
- 작성자: QA 테스트 담당 (Claude Code)
- 대상 브랜치/커밋: `main` (`63b012c fix: disable bot hub creation option`)
- 원칙: 소스 코드 수정 없이 진행. 테스트 중 자동 생성/변경된 파일(`apps/web/next-env.d.ts`)은 원상 복구함.

---

## 1. 테스트 개요

### 1.1 대상 시스템

CGA Studio는 기존 CGA 화면과 Aidot 챗봇 대화설계·운영 기능을 결합한 시스템이다.

- `apps/web`: Next.js 16 기반 화면 (Bot Hub, Bot 작업공간, 의도/개체/사전, 재학습, 시뮬레이터, 평가, Admin 등)
- `apps/api`: FastAPI 기반 API, PostgreSQL 사용, Aidot 패키지 업로드/다운로드 호환 계층 포함
- `apps/vector-worker`: 벡터 검색 워커 (본 라운드에서는 범위 밖)

### 1.2 테스트 목적

1. `main` 브랜치 기준으로 CGA의 핵심 기능 영역에 대한 블랙박스 테스트 시나리오를 설계한다.
2. 실행 가능한 범위에서 실제 테스트를 수행하고, 실행 불가능한 항목은 사유를 명시한다.
3. 실행 중 발견된 이슈를 근본 원인까지 분석하여 보고한다.

### 1.3 테스트 방법 3단계

| 단계 | 방법 | 실행 여부 |
|---|---|---|
| 1 | 백엔드 자동화 회귀 테스트 실행 (`pytest`, 전체 스위트) | ✅ 실행 완료 |
| 2 | 프론트엔드 정적 검증 (TypeScript 타입 검사, Next.js 프로덕션 빌드) | ✅ 실행 완료 |
| 3 | 실제 브라우저를 통한 E2E 기능 테스트 (로그인 → 봇 생성 → 의도/개체 → 재학습 → 시뮬레이터 등) | ❌ 미실행 (2장 참조) |

---

## 2. 테스트 환경 및 제약사항

### 2.1 사용 가능했던 환경

- OS: Windows 11 (PowerShell / Git Bash)
- Node.js v24.18.0 / npm 11.12.1 (apps/web 의존성 기존 설치 상태 재사용)
- Python 3.10.11 신규 가상환경(`.venv-test`, 저장소 외부 임시 성격, 커밋 대상 아님)에 `apps/api/requirements.txt` + `pytest` 설치 후 사용
  - 참고: 시스템 기본 `python`은 3.14였는데, 현재 SQLAlchemy 2.0.38과 Python 3.14의 `typing.Union` 처리 방식이 맞지 않아(`TypeError: descriptor '__getitem__' requires a 'typing.Union' object but received a 'tuple'`) 모델 매핑 단계에서 즉시 깨졌다. Python 3.10 가상환경으로 전환해 해결했다. **운영/CI 파이프라인이 Python 3.14 계열로 이동할 경우 SQLAlchemy 버전 호환성을 먼저 확인해야 한다.**

### 2.2 실행 불가능했던 항목과 사유

- **PostgreSQL, Redis, Docker가 로컬 환경에 설치되어 있지 않음.** (`docker`, `psql`, `redis-server` 모두 PATH에 없고, Windows 서비스 목록에도 없음)
- `apps/api`는 SQLite 등 대체 드라이버 없이 `postgresql+psycopg://...`만 지원하므로(`app/core/config.py`) 실제 서버 기동이 불가능했다.
- 이로 인해:
  - 로그인 → 봇 생성 → 의도/개체/사전 편집 → 재학습 → 시뮬레이터 대화 등 **실제 브라우저 클릭 기반 E2E 테스트는 이번 라운드에서 수행하지 못했다.**
  - DB 통합 테스트 4건(`tests/integration/test_bot_persistence_regression.py`, `tests/integration/test_db_fixture_regression.py`)은 `AIDOT_TEST_DATABASE_URL` 미설정으로 스킵되었다(의도된 스킵 동작이며 결함 아님).
- 이 제약은 **인프라 부재**이며 `main` 코드의 결함이 아니다. 3장의 시나리오 매트릭스에는 이 제약으로 실행하지 못한 항목을 `BLOCKED`로 표기했다.

---

## 3. 기능 영역별 테스트 시나리오 매트릭스

표기 범례
- **PASS(자동화)**: 실제 실행한 pytest 회귀/계약 테스트로 확인됨 (파일·함수명 명시)
- **PASS(정적)**: 코드/라우트/컴포넌트 존재를 정적으로 확인함 (브라우저 실행 아님)
- **BLOCKED**: 2장의 인프라 제약으로 이번 라운드에 실행하지 못함
- **FAIL**: 결함 발견 (6장에 상세 분석)

### 3.1 인증 / 계정

| ID | 시나리오 | 절차 | 예상 결과 | 결과 | 근거 |
|---|---|---|---|---|---|
| AUTH-01 | 정상 로그인 | `/login`에서 아이디/비밀번호 입력 후 로그인 | JWT 발급, 세션 진입 | BLOCKED | 서버 미기동 |
| AUTH-02 | 잘못된 자격증명 로그인 | 잘못된 비밀번호 입력 | 401, 명확한 에러 메시지 | BLOCKED | 서버 미기동 |
| AUTH-03 | 로그인 필수값 검증 | 아이디/비밀번호 중 하나 누락 | 요청 자체가 검증 오류 | PASS(자동화) | `test_regression_core_behavior.py::test_regression_login_requires_both_credentials` |
| AUTH-04 | 레거시 CGA 인증 호환 | 기존 CGA 계정 체계로 로그인 | 기존 계정 로그인 성공 | PASS(자동화) | `test_cga_legacy_auth.py` (수집·실행 정상, Python 3.10 환경) |
| AUTH-05 | 회원가입/비밀번호 변경 | `/signup`, `/me/password` 플로우 | 정상 처리 및 정책 검증 | BLOCKED / 부분 PASS(정적) | 라우트 존재(`app/signup`, `app/me/password`) 확인, 실행은 서버 미기동으로 불가 |
| AUTH-06 | 인증 라우트 엔드포인트 계약 | `/auth/login,/auth/logout,/auth/me,/auth/signup,/auth/change-password` 존재 | 라우트 유지 | **FAIL(테스트 결함, 기능 정상)** | 6.2절 참조 |
| AUTH-07 | JWT 토큰 발급/검증 | 토큰 생성 후 디코딩, 만료·서명 오류 케이스 | 정상 동작 | PASS(자동화) | `test_security.py` (5건) |

### 3.2 라이선스

| ID | 시나리오 | 절차 | 예상 결과 | 결과 | 근거 |
|---|---|---|---|---|---|
| LIC-01 | 라이선스 포맷/서명 검증 | CGA 라이선스 키 포맷 검사 | 유효/무효 판별 정확 | PASS(자동화) | `test_cga_license_format.py` |
| LIC-02 | 라이선스 정책(API 등록 수 카운트 등) | 등록 API 수, 경고 임계치 계산 | 정책값과 일치 | PASS(자동화) | `test_license_policy.py`, `test_license_policy_extended.py` |
| LIC-03 | 라이선스 만료/경고 팝업 | `/license/alert`, `/license/popup` 진입 | 만료 임박 시 경고 노출 | PASS(정적) / BLOCKED(실행) | 라우트 존재 확인, 실제 화면 노출은 서버 필요 |

### 3.3 봇 관리 (Bot Hub / 운영)

| ID | 시나리오 | 절차 | 예상 결과 | 결과 | 근거 |
|---|---|---|---|---|---|
| HUB-01 | 봇 생성 다이얼로그에서 "Hub" 종류 선택 차단 | `bot-create-dialog`에서 Hub 라디오 옵션 확인 | Hub 옵션은 비활성화(disabled)이며 선택 로직 없음 | PASS(자동화) | `test_bot_create_ui_contract.py::test_bot_hub_cannot_be_selected_from_bot_create_page` — 커밋 `63b012c` 회귀 확인됨 |
| HUB-02 | 봇 목록 조회/검색/필터 | `BM 봇 관리` 목록 API 호출 | 목록/검색 정상 | PASS(자동화) | `test_bot_list_api.py` |
| HUB-03 | 봇 작업공간 - 선택 버전 AI 요약(NLU 방식/모델, 답변 방식) 노출 | 봇 선택 시 카드에 NLU/LLM 정보 표시 | 상세 정보 표기 | PASS(자동화) | `test_bot_operations_workspace_ui_contract.py::test_bot_management_shows_selected_version_ai_details` — 커밋 `18f0da4` 회귀 확인됨 |
| HUB-04 | 시뮬레이터 실행 시 선택된 봇 컨텍스트 전달 | 작업공간에서 시뮬레이터 실행 | `botIdOverride`/`versionIdOverride` 전달 | PASS(자동화) | `test_bot_operations_workspace_ui_contract.py::test_workspace_simulator_launcher_receives_selected_bot_context` |
| HUB-05 | 재학습 이력 페이지네이션 (100건 단위) | 재학습 페이지에서 대화이력 전체 조회 | `pageSize=100`으로 안전하게 페이징, 500 강제 조회 금지 | PASS(자동화) | `test_retraining_history_ui_contract.py::test_retraining_fetches_conversation_history_with_api_safe_pagination` — 커밋 `18f0da4` 회귀 확인됨 |
| HUB-06 | 봇 UUID 정체성 유지 (복제/버전 분기 시) | 봇/버전 복제 시 UUID 계약 유지 | ID 불변성 보장 | PASS(자동화) | `test_bot_uuid_identity_contract.py` |
| HUB-07 | 봇 실제 삭제(hard delete) 플로우 | Bot Hub 삭제 화면(`bot-hub-delete.tsx`)에서 삭제 실행 | 확인 절차 후 삭제 | BLOCKED | 서버 미기동. **주의: 파괴적 동작이므로 실 운영 DB 대상 테스트 금지, 별도 테스트 DB 필요** |
| HUB-08 | 편집 잠금(Edit Lock) 획득/해제/충돌 | 동시 편집 시 잠금 획득 → 하트비트 → 해제/강제해제 | 동시 편집 충돌 방지 | PASS(자동화, 라우트 계약) / BLOCKED(동시성 시나리오 실행) | 라우트 계약은 `/edit-locks/acquire,heartbeat,release,force-release,status` 실제 존재 확인(6.2절), 다중 사용자 동시 편집 실행 테스트는 서버 필요 |

### 3.4 봇 생성 / 봇 설정 (8개 화면)

| ID | 시나리오 | 절차 | 예상 결과 | 결과 | 근거 |
|---|---|---|---|---|---|
| BOTCFG-01 | 봇 생성 화면 스크롤 정상 동작 | 봇 생성 폼이 길어질 때 상하 스크롤 | 스크롤 정상 (커밋 `6ea0e54` 반영분) | PASS(정적) | 코드 존재 확인. 실제 브라우저 스크롤 체감은 미실행 |
| BOTCFG-02 | 봇 구성(Configure) UI 계약 | AI 모델/기본값 등 설정값 저장 폼 필드 계약 | 계약된 필드 유지 | PASS(자동화) | `test_bot_configure_ui_contract.py` |
| BOTCFG-03 | 메시지 설정 / 메신저 편의 기능 / 제외·무시 목록 / 룰 설정 / 스몰토크 / 봇스테이션 8개 화면 진입 | 각 설정 서브 페이지 진입 및 저장 | 정상 진입·저장 | PASS(정적, 라우트) / BLOCKED(실제 저장 동작) | `apps/web/app/studio/bots/[botId]/settings/*` 8개 라우트 전부 존재 확인 (blocklist, botstation, conversation-defaults, messages, messenger, messenger/floating-buttons, messenger/recommended-intents, rules, smalltalk) |
| BOTCFG-04 | 스몰토크 메타데이터 계약 | 스몰토크 데이터 구조 저장/조회 | 메타데이터 스키마 유지 | PASS(자동화) | `test_bot_smalltalk_metadata.py` |
| BOTCFG-05 | 봇 스키마 유효성 | 봇 생성/수정 요청 스키마 검증 | 잘못된 값 거부 | PASS(자동화) | `test_bot_schema.py` |

### 3.5 의도 / 개체 / 사전 (Intents · Entities · Dictionary)

| ID | 시나리오 | 절차 | 예상 결과 | 결과 | 근거 |
|---|---|---|---|---|---|
| NLU-01 | 의도 생성/목록/편집 화면 진입 | `intents`, `intents/[intentId]` 라우트 | 정상 진입 | PASS(정적) / BLOCKED(실행) | 라우트·컴포넌트(`intent-list-page.tsx`, `intent-editor-dialog.tsx`, `intent-configure-page.tsx`, `intent-start-page.tsx`) 존재 확인 |
| NLU-02 | 개체(Entity) 생성/편집 | `entities`, `entities/[entityId]` | 정상 진입/저장 | PASS(정적) / BLOCKED(실행) | 컴포넌트 존재(`entity-list-page.tsx`, `entity-editor-dialog.tsx`, `entity-name-dialog.tsx`) |
| NLU-03 | 사전(Dictionary) 편집 | `dictionary` 라우트, 동의어 편집 | 정상 저장 | PASS(정적) / BLOCKED(실행) | 컴포넌트(`dictionary-list-page.tsx`, `dictionary-editor-dialog.tsx`) 존재 |
| NLU-04 | NLU 엔진 동작 (ML/의미 기반 분류) | 발화 → 의도 분류 결과 | 올바른 의도 반환 | PASS(자동화) | `test_nlu_engine.py` |
| NLU-05 | 시나리오(대화 흐름) 유효성 검증 | 플로우 그래프 저장 시 유효성 체크 | 잘못된 흐름 저장 차단 | PASS(자동화) | `test_scenario_validation.py`, `test_scenario_validation_extended.py` |
| NLU-06 | 대화 흐름 디자이너(Flow) 화면 | `flows`, `flows/[intentId]` | 그래프 편집 정상 | PASS(정적) / BLOCKED(실행) | `flow-designer-page.tsx` 존재 확인 |

### 3.6 NLU 학습 / 재학습

| ID | 시나리오 | 절차 | 예상 결과 | 결과 | 근거 |
|---|---|---|---|---|---|
| RT-01 | 학습 작업 큐 등록/상태 조회 | 재학습 요청 → job 상태 폴링 | 큐 정상 동작 | PASS(자동화) | `test_nlu_training_queue.py` |
| RT-02 | 재학습 이력 화면 진입 및 엔진 표시 | `retraining` 라우트에서 이력·엔진 정보 확인 | 정상 표시 | PASS(자동화, 3.3 HUB-05 중복 근거) + PASS(정적, 라우트) | `retraining-page.tsx` |
| RT-03 | 캐시 헬퍼 동작 (학습 결과 캐시) | 캐시 적재/무효화 | 정상 동작 | PASS(자동화) | `test_cache_helper.py` |
| RT-04 | 벡터 검색(임베딩 기반 검색) | 질의 → 유사 문서 검색 | 정상 반환 | PASS(자동화) | `test_vector_search.py` |
| RT-05 | 실시간 재학습 트리거 및 실제 모델 반영 | 재학습 실행 후 시뮬레이터에서 반영 확인 | 학습 결과 즉시 반영 | BLOCKED | 실 서버/모델 자원 필요 |

### 3.7 RAG / LLM 답변 생성

| ID | 시나리오 | 절차 | 예상 결과 | 결과 | 근거 |
|---|---|---|---|---|---|
| LLM-01 | LLM 의도 분류 | LLM 기반 NLU 분류 요청 | 정상 분류 | PASS(자동화) | `test_llm_intent.py` |
| LLM-02 | LLM 단독 답변 생성(`answer_mode=llm`) | Provider/Model 설정 후 질의 → 답변 생성 | 답변 텍스트가 런타임 변수에 저장 | **FAIL(테스트 결함, 실제 동작은 안전하게 실패 처리)** | 6.1절 참조 — `test_channel_runtime_flow.py` 2건 |
| LLM-03 | LLM RAG 제약 답변 생성 | 검색 결과 기반 제약 답변 | 정상 생성 | PASS(자동화) | `test_channel_runtime_flow.py`의 관련 통과 테스트 다수 (`-k llm` 중 위 2건 제외 전부 통과) |
| LLM-04 | 채널 런타임 전체 흐름 (Kakao 등) | 메시지 수신 → 의도 매칭 → 응답 생성 | 정상 흐름 | PASS(자동화) | `test_channel_runtime_flow.py` (98건 중 96건 통과) |
| LLM-05 | 문서 임베딩(PDF 등) 후 RAG 검색 | PDF 업로드 → 임베딩 → 검색 | 정상 검색 | PASS(정적, 라우트 계약) / BLOCKED(실제 업로드 실행) | 라우트 `/bots/{bot_id}/versions/{version_id}/answers/rag/embed-pdf` 존재 확인 |

### 3.8 시뮬레이터 / 평가

| ID | 시나리오 | 절차 | 예상 결과 | 결과 | 근거 |
|---|---|---|---|---|---|
| SIM-01 | 시뮬레이터에서 발화 입력 후 응답 확인 | `simulator` 화면에서 대화 | 정상 응답 | BLOCKED | 서버 미기동 |
| SIM-02 | 평가(Evaluation) 지표 산출 | 테스트셋 기반 정확도 등 산출 | 지표 정상 계산 | PASS(정적, 라우트) / BLOCKED(실행) | `evaluation-page.tsx` 존재 확인 |
| SIM-03 | 운영 대시보드 진단/평가 확장 기능 | `operations-dashboard-page.tsx` 진단 지표 | 정상 표시 | PASS(정적) | 최근 커밋 `08118aa feat: add workspace evaluation diagnostics` 반영 코드 확인 |

### 3.9 API 스토어 / Admin

| ID | 시나리오 | 절차 | 예상 결과 | 결과 | 근거 |
|---|---|---|---|---|---|
| API-01 | API/그룹 API 등록/목록/상세 | `studio/apis`, `studio/apis/[apiId]` | 정상 등록·조회 | PASS(정적, 라우트) / BLOCKED(실행) | `api-store-list-page.tsx`, `api-store-detail-page.tsx`, `group-api-list-page.tsx`, `group-api-detail-page.tsx` 존재 확인 |
| ADM-01 | Admin 채널 연결 관리 | `/admin/channels` | 채널 연동 상태 표시 | PASS(자동화) | `test_admin_channel_connection.py` |
| ADM-02 | Admin 공통변수 관리 | `/admin/common-variables` | 변수 CRUD | PASS(자동화) | `test_admin_common_variables.py` |
| ADM-03 | Admin 대화 이력 조회 | `/admin/conversations` | 이력 검색/필터 | PASS(자동화) | `test_admin_conversation_history.py`, `test_channel_conversation_history_storage.py` |
| ADM-04 | Admin 운영 대시보드 내비게이션 | `/admin/operations-dashboard` | 위젯/링크 정상 | PASS(자동화) | `test_admin_operations_dashboard.py`, `test_operations_dashboard_navigation_ui_contract.py` |
| ADM-05 | Admin 템플릿 업로드(CSV 등) | `/admin/templates`에서 템플릿 업로드 | Aidot 템플릿 CSV 정상 임포트 | PASS(자동화) | `test_admin_template_upload_ui_contract.py` — 커밋 `fdedbb0`, `6e0c357` 회귀 반영 |
| ADM-06 | Admin 사용자/역할/그룹 관리 | `/admin/users`, `/admin/roles`, `/admin/groups` | CRUD 및 권한 분리 | PASS(정적, 라우트) / BLOCKED(실행) | 라우트 전부 존재, 접근제어 실제 클릭 테스트는 서버 필요 |
| ADM-07 | 라이선스 관리 화면 | `/admin/license` | 라이선스 조회/등록 | PASS(정적, 라우트) + PASS(자동화, LIC-01/02) |  |
| ADM-08 | 감사 로그 / 로그인 이력 / 큐 이력 / 학습 이력 | `/admin/audit-logs`, `/admin/login-history`, `/admin/queue-history`, `/admin/training-history` | 이력 목록 정상 | PASS(정적, 라우트) / BLOCKED(실행) |  |
| ADM-09 | API 호출 이력 및 요청 로깅 | `/admin/api-call-history` | 호출 로그 기록 | PASS(자동화) | `test_api_request_logging.py` |
| ADM-10 | 인텐트 피드백(오답 신고) | `/admin/intent-feedback` | 피드백 등록/조회 | PASS(정적, 라우트) / BLOCKED(실행) |  |
| ADM-11 | 봇스테이션 상태 | `/admin/botstation-status` | 상태 표시 | PASS(정적, 라우트) |  |

### 3.10 Aidot 패키지 호환성 (업로드/다운로드 왕복)

| ID | 시나리오 | 절차 | 예상 결과 | 결과 | 근거 |
|---|---|---|---|---|---|
| AIDOT-01 | Aidot 패키지 여부 판별 | 임의 JSON에서 Aidot 봇 패키지 여부 판별 | 정확히 판별 | PASS(자동화) | `test_aidot_package_compatibility.py::test_detects_and_maps_aidot_package` |
| AIDOT-02 | 무변경 왕복 무손실 | Aidot 패키지 → 내부 문서 → 재수출 | 원본과 100% 동일 | PASS(자동화) | `test_aidot_package_compatibility.py::test_unchanged_package_round_trip_is_lossless` |
| AIDOT-03 | 일부 수정 시 미지 필드(future field) 보존 | 사전 항목 1건 수정 후 재수출 | 알 수 없는 필드도 보존, 수정분만 반영 | PASS(자동화) | `test_aidot_package_compatibility.py::test_modified_known_asset_preserves_unknown_fields` |
| AIDOT-04 | 비-Aidot JSON 업로드 거부 | 형식이 다른 JSON 업로드 | 명확한 거부(ValueError) | PASS(자동화) | `test_aidot_package_compatibility.py::test_rejects_non_aidot_json` |
| AIDOT-05 | 패키지 요약 통계 | 다이얼로그/개체/사전 개수 집계 | 원본 개수와 일치 | PASS(자동화) | `test_aidot_package_compatibility.py::test_summary_uses_source_asset_counts` |
| AIDOT-06 | 실제 Aidot 산출물 샘플 파일 임포트 | `compat-samples/*.json,*.txt` 실 파일로 업로드 | 정상 임포트·화면 반영 | BLOCKED | 실제 API 서버 필요, 이번 라운드 미실행. **다음 라운드 우선 권고 항목** |
| AIDOT-07 | Brity AM 호환 | 삼성 Brity AM 산출물 호환 처리 | 정상 변환 | PASS(자동화) | `test_brity_am_compat.py` |
| AIDOT-08 | AM API 계약 | AM 연동 API 스키마 | 계약 유지 | PASS(자동화) | `test_am_api.py` |

### 3.11 배포 / 보안 / 설정

| ID | 시나리오 | 절차 | 예상 결과 | 결과 | 근거 |
|---|---|---|---|---|---|
| SEC-01 | 운영 환경 기본값(취약 비밀값) 차단 | `APP_ENV=production` + 기본 `postgres:postgres` 등 사용 시도 | 부팅 거부 | PASS(자동화) | `test_config_security.py::test_production_rejects_development_credentials` |
| SEC-02 | 명시적 보안 자격증명 사용 시 정상 부팅 | 운영값 명시 설정 | 정상 부팅 | PASS(자동화) | `test_config_security.py::test_production_accepts_explicit_secure_credentials` |
| SEC-03 | DB 부트스트랩 안전성(초기 시드 중복 실행 방지 등) | 최초 기동 vs 재기동 | 중복 시드/관리자 계정 재생성 방지 | PASS(자동화) | `test_db_bootstrap.py` |
| SEC-04 | CGA 독립 배포 계약 (same-origin 프록시, 시크릿 미노출 등) | Dockerfile/Compose 정적 검사 | 브라우저가 내부 API 직접 호출 금지, 시크릿 미포함 | PASS(자동화) | `test_cga_deployment_contract.py` 7건 전부 |
| SEC-05 | 라이선스 정책/보안 확장 | 만료·초과 사용 등 경계값 | 정책대로 차단/경고 | PASS(자동화) | `test_license_policy_extended.py` |
| SEC-06 | 일반 보안(비밀번호 해시 등) | 비밀번호 해시/검증 | 안전한 해시 알고리즘 사용 | PASS(자동화) | `test_security.py` |
| SEC-07 | API 접근 통합 회귀 | 인증되지 않은 접근 차단 | 401/403 정확히 반환 | PASS(자동화) | `test_api_access_integration_regression.py` |
| SEC-08 | API 계약/메서드 계약 회귀 | 라우트 존재·HTTP 메서드 유지 | 계약 유지 | PASS(자동화) | `test_api_contract_regression.py`, `test_api_method_contract_regression.py` |

### 3.12 런타임 변수 / 세션

| ID | 시나리오 | 절차 | 예상 결과 | 결과 | 근거 |
|---|---|---|---|---|---|
| RUN-01 | 런타임 세션 생성/조회/만료 | 세션 수명 주기 | 정상 관리 | PASS(자동화) | `test_runtime_session.py`, `test_runtime_session_extended.py` |
| RUN-02 | 런타임 변수(치환/스코프) | `$변수` 치환 로직 | 정확한 치환 | PASS(자동화) | `test_runtime_variables.py`, `test_runtime_variables_extended.py` |
| RUN-03 | 버전 문서 정규화/저장 | 구버전 문서 → 신규 스키마 정규화 | 손실 없는 정규화 | PASS(자동화) | `test_version_documents.py`, `test_version_storage.py` |
| RUN-04 | 버전 관리 다이얼로그 API | 버전 비교/전환 API | 정상 동작 | PASS(자동화) | `test_version_dialog_api.py` |

---

## 4. 자동화 테스트 실행 결과 (실제 실행 로그 기반)

### 4.1 백엔드 (`apps/api`, pytest)

```
명령: python -m pytest -q  (Python 3.10.11, 격리된 venv, apps/api/requirements.txt 그대로 설치)
결과: 5 failed, 508 passed, 4 skipped, 12 warnings — 93~104초 내 완료
```

- 총 수집 테스트: 517개
- 통과: 508 (98.3%)
- 스킵: 4 — `AIDOT_TEST_DATABASE_URL` 미설정으로 인한 DB 통합 테스트 스킵 (의도된 동작, 결함 아님)
- 실패: 5 — 전부 근본 원인 분석 완료, 아래 6장 참조. **실제 사용자 동작에 영향을 주는 결함은 없음으로 판단.**

### 4.2 프론트엔드 (`apps/web`)

```
명령 1: npx tsc --noEmit -p tsconfig.json
결과 1: 오류 없음 (0 errors)

명령 2: npm run build  (next build --webpack)
결과 2: 성공 — 74개 라우트 전부 컴파일/생성 성공 (정적 46 + 동적 28)
```

프론트엔드 소스는 타입 오류 없이 컴파일되고, Next.js 프로덕션 빌드가 전 라우트에서 성공했다. 이는 코드 레벨의 구조적 결함(타입 불일치, import 누락, 빌드 타임 오류)이 없음을 의미하며, 실제 화면 동작(클릭/입력/API 연동)까지 보증하지는 않는다.

> 참고: 빌드 과정에서 Next.js가 `apps/web/next-env.d.ts`를 자동 재생성했다(내부 경로 표기만 변경). 소스 미수정 원칙에 따라 `git checkout`으로 원상복구했다.

---

## 5. "UI 계약(UI Contract)" 테스트의 성격에 대한 안내

`test_*_ui_contract.py` 계열 테스트(예: `test_bot_create_ui_contract.py`, `test_retraining_history_ui_contract.py`)는 **실제 브라우저에서 컴포넌트를 렌더링하는 테스트가 아니라, `.tsx`/`.ts` 소스 파일의 텍스트 내용을 읽어 특정 패턴(속성명, 변수명, 문자열)이 존재/부재하는지 확인하는 정적 텍스트 검증**이다.

- 장점: 최근 수정(예: Hub 생성 옵션 비활성화, 재학습 페이지네이션)이 실수로 되돌려지는 것을 빠르게 감지한다.
- 한계: 실제 브라우저에서 클릭했을 때 disabled 속성이 CSS/JS로 올바르게 동작하는지, 페이지네이션이 실제 대량 데이터에서 성능 문제 없이 동작하는지는 검증하지 못한다.

따라서 3장 매트릭스에서 이 계열 테스트로 뒷받침된 항목은 `PASS(자동화)`로 표기했지만, **실제 화면 동작 확인(E2E)은 여전히 필요**하다는 점을 명확히 한다.

---

## 6. 발견된 이슈 상세 (실패 테스트 5건 근본 원인 분석)

### 6.1 [이슈 A] LLM 단독 답변 생성 테스트 2건 실패 — **테스트 픽스처 결함으로 판단 (제품 결함 아님)**

- 대상: `tests/test_channel_runtime_flow.py::test_llm_answer_uses_llm_generated_answer_text`, `::test_llm_answer_keeps_llm_answer_even_when_same_as_query`
- 증상: `runtime_state["variables"]["$_llm_answer_text"]`가 기대한 답변 문자열이 아니라 빈 문자열(`''`)로 남음. 로그에 `LLM 답변 생성에 실패했습니다.` 경고 출력.
- 원인 추적:
  1. `_prepare_answer_rag_variables` → `_generate_llm_answer` → `resolve_llm_provider_config(provider, model, ...)` 호출 (`apps/api/app/services/llm_client.py:71`).
  2. `provider`/`model`은 `ai_config.get("llm_provider")`, `ai_config.get("llm_model")`에서 가져온다(`apps/api/app/api/routes/channels.py:779` `_version_ai_config`).
  3. 테스트의 `_FakeBot({"nlu_type": "llm", "nlu_model": "llm_engine_default", "answer_mode": "llm"})`는 `nlu_model`만 채우고 **`llm_provider`/`llm_model` 키를 전혀 채우지 않는다.**
  4. 따라서 `resolve_llm_provider_config("", "")`가 `LlmClientError("LLM Provider가 설정되지 않았습니다.")`를 즉시 발생시키고, 이 예외는 상위에서 `except (LlmClientError, ...)`로 잡혀 경고 로그만 남기고 조용히 반환한다. **테스트가 검증하려는 목표 코드(모킹한 `LlmChatClient.chat`)는 한 번도 호출되지 않는다.**
- 판정: 제품 코드(`_prepare_answer_rag_variables`, `resolve_llm_provider_config`)는 설정 누락 시 예외를 던지고 안전하게 무응답 처리하는 **의도된 방어적 동작**을 정확히 수행하고 있다. 문제는 **테스트 픽스처가 시나리오상 필요한 `llm_provider`/`llm_model` 값을 채우지 않은 것**이다.
- 권고(소스 미수정 원칙상 이번 라운드에서는 적용하지 않음): 테스트의 `_FakeBot` data_json에 `"llm_provider": "..."`, `"llm_model": "llm_engine_default"`를 추가하면 테스트 의도대로 통과할 것으로 예상됨. 별도 수정 작업으로 분리 권고.
- 참고: 이 실패는 인코딩 문제로 오인하기 쉽다. 시스템 기본 콘솔 인코딩(cp949) 상태로 pytest를 실행하면 한글이 `����`로 깨져 표시되어 "인코딩 버그"처럼 보이지만, `PYTHONUTF8=1`로 재실행해도 동일하게 실패함을 확인했다. 즉 **콘솔 표시 문제와 실제 로직 실패는 별개**이며, 실제 실패 원인은 위 3~4번 항목이다.

### 6.2 [이슈 B] 라우트 계약 회귀 테스트 3건 실패 — **테스트가 오래되어 실제 구조 변경을 반영하지 못함 (기능 회귀 아님, 실 서비스 영향 없음 확인)**

- 대상: `tests/test_regression_core_behavior.py::test_regression_auth_routes_keep_manual_entry_points`, `::test_regression_bot_routes_keep_core_management_entry_points`, `::test_regression_edit_lock_routes_keep_save_conflict_contract`
- 증상: `router.routes`의 `path`가 `/login`이 아니라 `/auth/login`처럼 프리픽스가 이미 포함된 형태로 나와 `assert {"/login", ...} <= paths`가 실패.
- 원인 추적:
  1. 실제 라우터 정의는 `APIRouter(prefix="/auth")`(및 `/bots`, `/edit-locks`)처럼 **라우터 생성 시점에 prefix를 부여**하고, 상위에서는 `api_router.include_router(auth.router)`처럼 **추가 prefix 없이** 포함한다(`apps/api/app/api/router.py:7-15`).
  2. 실제 서비스 경로: `app.include_router(api_router, prefix="/api/v1")`(`apps/api/app/main.py:280`) → 최종 경로는 `/api/v1/auth/login`, `/api/v1/bots`, `/api/v1/edit-locks/acquire` 등으로 **정상 동작**한다. 직접 임포트해 확인한 실제 `router.routes[].path` 값도 `/auth/login`, `/bots`, `/edit-locks/acquire` 등으로 일관되게 나타났다.
  3. 즉, 이 테스트는 "라우터 객체 자체에는 prefix가 없고 include 시점에 prefix가 붙는다"는 **과거 구조**를 가정하고 작성된 것으로 보이며, 이후 라우터 정의 방식이 바뀌면서 테스트만 갱신되지 않았다.
- 판정: **사용자 관점의 실제 API 엔드포인트는 정상적으로 존재하고 동작한다.** 이 3건은 코드 리팩터링 이후 갱신되지 않은 내부 계약 테스트의 결함이다. `CODEx_WORK_LOG.md`에도 "기존 범위 5 실패이며 별도 확인 대상으로 남겼다"고 기록되어 있어, 이번 조사로 그 5건의 정체(2건 픽스처 결함 + 3건 테스트 노후화)를 구체적으로 규명했다.
- 권고: `_route_paths` 헬퍼가 라우터의 `prefix`를 감안하도록 하거나, 기대값을 `/auth/login` 형태로 갱신. 별도 수정 작업으로 분리 권고.

---

## 7. 최근 커밋 회귀 확인 결과

| 커밋 | 내용 | 확인 결과 |
|---|---|---|
| `63b012c` | Bot Hub 생성 옵션 비활성화 | 회귀 테스트 통과 확인 (`HUB-01`) |
| `18f0da4` | 재학습 이력 페이지네이션 + 봇 엔진 정보 표시 | 회귀 테스트 통과 확인 (`HUB-03`, `HUB-05`) |
| `fdedbb0`/`6e0c357` | 템플릿 CSV 임포트, 활성 채널 선택 | 관련 테스트(`test_admin_template_upload_ui_contract.py`) 통과 확인 (`ADM-05`) |
| `08118aa` | 작업공간 평가 진단 기능 추가 | 코드 존재 확인 (`SIM-03`), 실제 화면 동작은 미실행 |

세 건의 최신 수정사항 모두 `main`에서 회귀 없이 유지되고 있음을 자동화 테스트로 재확인했다.

---

## 8. 결론 및 권고사항

### 8.1 결론

- 백엔드 자동화 회귀 테스트 517건 중 508건(98.3%) 통과, 4건은 의도된 스킵, 5건은 실패했으나 **전부 테스트 자체의 결함(픽스처 누락 2건, 오래된 계약 검증 3건)이며 실제 기능 결함으로 판정되지 않았다.**
- 프론트엔드는 타입 검사와 프로덕션 빌드 모두 오류 없이 통과했다.
- 다만 이번 라운드는 **PostgreSQL/Redis/Docker가 없는 로컬 환경 제약으로 실제 브라우저 기반 E2E 테스트(로그인, 봇 생성, 의도/개체 편집, 재학습 실행, 시뮬레이터 대화, Aidot 패키지 실제 업로드 등)를 수행하지 못했다.** 이는 코드 품질과 무관한 순수 인프라 제약이다.

### 8.2 권고사항 (우선순위 순)

1. **다음 라운드에 테스트용 PostgreSQL(+ Redis) 환경을 준비**하여 `AIDOT_TEST_DATABASE_URL`을 설정하고 스킵된 4건의 DB 통합 테스트를 실행할 것. 동일 환경에서 `apps/api` 서버와 `apps/web` 개발 서버를 함께 기동해 3장에서 `BLOCKED`로 표기한 E2E 시나리오(특히 `AIDOT-06` 실제 샘플 파일 왕복 업로드, `HUB-07` 삭제 플로우, `SIM-01` 시뮬레이터 대화)를 우선 실행할 것.
2. **이슈 A**: `tests/test_channel_runtime_flow.py`의 `_FakeBot` 픽스처에 `llm_provider`/`llm_model` 값을 보강하는 별도 수정 작업(테스트 파일만 수정, 제품 코드 변경 불필요)을 진행할 것.
3. **이슈 B**: `tests/test_regression_core_behavior.py`의 라우트 경로 기대값을 현재 라우터 구조(prefix가 라우터에 내재)에 맞게 갱신할 것.
4. CI 환경에 Python 버전을 고정(예: 3.10~3.12대)하거나, Python 3.14로 이전할 경우 SQLAlchemy를 사전에 호환 버전으로 업그레이드해 둘 것(2.1절 참조).
5. `test_*_ui_contract.py` 계열(정적 텍스트 검증)은 유지하되, 핵심 플로우(로그인 → 봇 생성 → 재학습 → 시뮬레이터)에 대해서는 실제 브라우저 기반 E2E(예: Playwright) 테스트를 별도로 도입해 5장에서 언급한 한계를 보완할 것.

### 8.3 조치 현황 (2026-07-22 최종 업데이트)

- **항목 1(테스트용 PostgreSQL 환경)**: 조치 완료. WSL PostgreSQL로 DB 통합 테스트 4건을 활성화하고 Alembic URL 마스킹/상대경로/로깅 격리 관련 픽스처 결함 3건을 수정함(`bd9f6a4`, `6a0caf9`, 문서 `qa-regression-test-baseline.tdd.md`). 이 자리에서 언급한 `AIDOT-06`/`HUB-07`/`SIM-01` 실제 E2E 실행은 [qa-live-test-report-2026-07-22.md](qa-live-test-report-2026-07-22.md)에서 별도로 다뤘고, 파괴적 항목 3건은 전용 테스트 환경과 승인 전까지 보류로 확정됨.
- **항목 2(이슈 A: LLM 픽스처)** · **항목 3(이슈 B: 라우트 경로)**: 조치 완료. 두 항목 모두 커밋 `5905d44`(`test: align QA regression fixtures and route contracts`)에서 정확히 이 보고서가 제안한 방식대로 수정됨. 재실행 결과 `5 failed → 5 passed`.
- **항목 4(Python 버전 고정)** · **항목 5(Playwright 등 E2E 도입)**: 아직 별도 조치 없음. 후속 과제로 유지.
- 회귀 방지용 테스트는 [test_workspace_context_shared_callers_regression.py](../../apps/api/tests/test_workspace_context_shared_callers_regression.py)에 통합해 작성·커밋함(`9679d28`, 브랜치 `bugfix/qa-regression-test-baseline`).

---

## 부록 A. 실행 명령 요약 (재현용)

```bash
# 백엔드
python3.10 -m venv .venv-test
source .venv-test/Scripts/activate
pip install -r apps/api/requirements.txt pytest
cd apps/api
python -m pytest -q -rs

# 프론트엔드
cd apps/web
npx tsc --noEmit -p tsconfig.json
npm run build
```

## 부록 B. 이번 라운드에서 변경/생성된 파일

- 생성: 본 보고서 (`docs/testing/qa-regression-report-2026-07-22.md`)
- 생성(저장소 외부 취급, 커밋 대상 아님): `.venv-test/` — 테스트 실행용 임시 Python 가상환경. 정리 필요 시 삭제해도 무방.
- 소스 코드 변경: 없음 (빌드 과정에서 자동 갱신된 `apps/web/next-env.d.ts`는 확인 후 원상복구함)
