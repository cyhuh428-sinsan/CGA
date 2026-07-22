# QA 회귀 테스트 기준선 TDD 증거

## 목적

- QA 보고서에서 확인된 테스트 결함 5건을 현재 `main` 기준으로 교정한다.
- 제품 코드는 변경하지 않고 테스트 픽스처와 노후 경로 기대값만 현재 계약에 맞춘다.

## RED 기준선

실행 명령:

```powershell
$env:PYTHONPATH='apps/api'
uv run pytest apps/api/tests/test_channel_runtime_flow.py::test_llm_answer_uses_llm_generated_answer_text apps/api/tests/test_channel_runtime_flow.py::test_llm_answer_keeps_llm_answer_even_when_same_as_query apps/api/tests/test_regression_core_behavior.py::test_regression_auth_routes_keep_manual_entry_points apps/api/tests/test_regression_core_behavior.py::test_regression_bot_routes_keep_core_management_entry_points apps/api/tests/test_regression_core_behavior.py::test_regression_edit_lock_routes_keep_save_conflict_contract -q
```

결과: `5 failed`

- LLM 답변 테스트 2건: 테스트 봇에 `llm_provider`와 `llm_model`이 없어 모킹한 LLM 클라이언트 호출 전에 중단된다.
- 라우트 계약 테스트 3건: 라우터 자체에 prefix가 포함된 현재 구조와 과거 상대 경로 기대값이 불일치한다.

별도 현재 계약 확인:

```powershell
$env:PYTHONPATH='apps/api'
uv run pytest apps/api/tests/test_api_contract_regression.py apps/api/tests/test_api_method_contract_regression.py -q
```

결과: `16 passed`

## GREEN 결과

### 대상 테스트

동일한 5개 테스트를 재실행한 결과: `5 passed, 1 warning`

### 관련 계약·런타임 테스트

```powershell
$env:PYTHONPATH='apps/api'
uv run pytest apps/api/tests/test_channel_runtime_flow.py apps/api/tests/test_regression_core_behavior.py apps/api/tests/test_api_contract_regression.py apps/api/tests/test_api_method_contract_regression.py -q
```

결과: `129 passed, 1 warning`

### 전체 추적 소스 기준 백엔드 테스트

사용자 소유 미추적 파일 `apps/api/tests/test_workspace_context_shared_callers_regression.py`는 이번 변경 범위에서 제외했다.

```powershell
$env:PYTHONPATH='apps/api'
uv run pytest apps/api/tests -q -rs --ignore=apps/api/tests/test_workspace_context_shared_callers_regression.py
```

결과: `520 passed, 4 skipped, 1 warning`

- 스킵 4건은 `AIDOT_TEST_DATABASE_URL`이 없는 전용 DB 통합 테스트다.
- 경고 1건은 Starlette의 `python_multipart` 전환 예정 안내다.

## DB 통합 테스트 RED 기준선

WSL PostgreSQL에 일회성 전용 DB를 생성하고 스킵 4건을 실행했다. 임시 DB는 테스트 종료 후 삭제했다.

결과: `2 passed, 2 errors`

- 단순 연결과 트랜잭션 롤백 fixture는 통과했다.
- `str(test_engine.url)`이 비밀번호를 `***`로 마스킹해 Alembic 재연결이 실패했다.
- `alembic.ini`의 상대 `script_location`이 실행 작업 디렉터리에 의존했다.

제품 기능 결함이 아니라, DB 통합 테스트를 실제 활성화할 때 드러나는 fixture 결함이다.

## DB 포함 전체 실행 RED 기준선

DB fixture 4건을 고친 뒤 전용 DB로 전체 추적 테스트를 실행했다.

결과: `520 passed, 4 failed`

- DB 통합 테스트 4건은 모두 통과했다.
- 인프로세스 Alembic 실행의 `fileConfig()`가 기존 로거를 비활성화해, 이후 캐시 로그 테스트 4건의 `caplog` 캡처가 실패했다.
- Alembic 설정 파일은 이미 파싱된 상태이므로 통합 fixture에서는 `config_file_name`을 비워 로깅 재설정만 차단해야 한다.

## DB 통합 테스트 GREEN 결과

- DB 통합 fixture 4건: `4 passed`
- DB 통합 후 캐시 로그 격리 회귀: `12 passed`
- 전용 DB를 포함한 전체 추적 테스트: `524 passed, 0 skipped, 2 warnings`
- 테스트 종료 후 WSL PostgreSQL의 `cga_qa_%` 임시 DB 개수: `0`

수정 내용:

- SQLAlchemy URL을 Alembic에 전달할 때 `render_as_string(hide_password=False)`를 사용한다.
- Alembic `script_location`을 절대 경로로 지정해 실행 작업 디렉터리 의존성을 제거한다.
- 인프로세스 통합 테스트에서는 Alembic의 로깅 재설정을 차단해 이후 테스트와 격리한다.

## 운영 브라우저 비파괴 회귀 결과

- 기존 로그인 세션: 시스템관리자 컨텍스트와 테스트 봇 화면 진입 확인
- 봇 생성 화면: `봇 허브` 라디오가 `disabled` 상태임을 확인
- 기존 테스트 봇 시뮬레이터: `가입안했어요` 입력 → `무동의 계약` 응답
- 분석 데이터: `Exacting Matching`, 선택 의도 `무동의 계약`, `오류 없음` 확인

신규 봇 생성, 삭제, 재학습, 패키지 업로드처럼 운영 데이터를 변경하는 시나리오는 실행하지 않았다.

## 알려진 범위

- 이 작업은 자동화 테스트 기준선 복구만 다룬다.
- 운영 데이터 변경이 필요한 브라우저 E2E는 전용 CGA 테스트 배포가 준비된 뒤 별도로 검증한다.
- 제품 코드 변경은 없다.
