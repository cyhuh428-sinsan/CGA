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

수정 후 실제 실행 결과를 기록한다.

## 알려진 범위

- 이 작업은 자동화 테스트 기준선 복구만 다룬다.
- DB 통합 테스트와 브라우저 E2E 결과는 별도 검증 결과로 구분한다.
