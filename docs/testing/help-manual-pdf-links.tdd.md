# 도움말 매뉴얼 PDF 링크 TDD 증거

## 사용자 여정

- 사용자는 CGA Studio 도움말에서 사용자 매뉴얼 또는 NLU 학습 가이드를 클릭하면 실제 배포된 PDF를 새 탭에서 열 수 있어야 한다.

## RED

- 명령: `uv run pytest apps/api/tests/test_help_manual_links_ui_contract.py -q`
- 결과: `2 failed`
- 원인: 도움말 항목이 동작 없는 버튼이었고 배포용 PDF 자산이 없었다.
- 체크포인트: `55d9e65 test: reproduce missing help manual links`

## GREEN

- 변경: 두 항목을 same-origin PDF 링크로 교체하고 원본 PDF를 `apps/web/public/manuals`에 포함했다.
- 명령: `uv run pytest apps/api/tests/test_help_manual_links_ui_contract.py -q`
- 결과: `2 passed`
- 체크포인트: `c0586fc fix: open deployed manuals from help menu`

## 회귀 검증

| 보장 내용 | 검증 | 결과 |
|---|---|---|
| 도움말의 두 항목이 새 탭 PDF 링크다 | `test_help_manual_links_ui_contract.py` | PASS |
| 배포 자산이 실제 PDF 형식이다 | `test_help_manual_links_ui_contract.py` | PASS |
| 복사본과 사용자 제공 원본의 SHA-256이 동일하다 | `Get-FileHash -Algorithm SHA256` | PASS |
| PDF 첫 페이지 한글·표 렌더링이 정상이다 | Poppler PNG 렌더링 및 시각 점검 | PASS |
| Next.js 컴파일·TypeScript·정적 페이지 생성을 유지한다 | `npm run build` | PASS |

## 커버리지와 잔여 검증

- `apps/web`에는 단위 테스트·커버리지 스크립트가 없어 수치형 커버리지는 산출하지 못했다.
- 운영 배포 후 도움말에서 각 링크를 클릭하고 PDF 응답·새 탭 표시를 확인한다.
