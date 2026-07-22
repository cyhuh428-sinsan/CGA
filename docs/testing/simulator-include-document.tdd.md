# 시뮬레이터 전체 버전 문서 요청 TDD 증거

## 사용자 여정

- 운영자는 학습이 완료된 봇의 학습문장과 동일한 발화를 시뮬레이터에 입력하면, 선택 버전의 전체 문서를 사용한 의도 분류 결과를 확인할 수 있어야 한다.

## RED

- 명령: `uv run pytest apps/api/tests/test_simulator_workspace_context_ui_contract.py -q`
- 결과: `1 failed, 1 passed`
- 원인: `includeDocument=true` 요청이 `include_document=true`를 명시하지 않았다.
- 체크포인트: `a97f401 test: reproduce missing simulator document query`

## GREEN

- 변경: `fetchStudioWorkspaceContext()`가 `include_document=true|false`를 항상 명시한다.
- 명령: `uv run pytest apps/api/tests/test_simulator_workspace_context_ui_contract.py -q`
- 결과: `2 passed`
- 체크포인트: `470b33a fix: request full simulator version document`

## 회귀 검증

| 보장 내용 | 검증 | 결과 |
|---|---|---|
| 전체 문서 요청은 `include_document=true`를 전송한다 | `test_simulator_workspace_context_ui_contract.py` | PASS |
| 시뮬레이터는 선택 버전 전체 문서를 요구한다 | `test_simulator_workspace_context_ui_contract.py` | PASS |
| 기존 봇 운영/재학습 UI 계약을 유지한다 | 관련 계약 테스트 3개 파일, 총 6건 | PASS |
| Next.js 컴파일·TypeScript·정적 페이지 생성을 유지한다 | `npm run build` | PASS |

## 커버리지와 잔여 검증

- `apps/web`에는 단위 테스트·커버리지 스크립트가 없어 수치형 커버리지는 산출하지 못했다.
- 운영 배포 후 브라우저 Network에서 `include_document=true`와 응답의 `version_json.dialogs`를 확인한다.
- 실제 테스트 봇에서 `가입안했어요` 발화가 `무동의 계약`으로 분류되는지 확인한다.
