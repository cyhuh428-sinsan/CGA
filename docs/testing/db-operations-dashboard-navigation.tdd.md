# DB 운영 대시보드 메뉴 이동 TDD 기록

## 사용자 요구

- Admin 현황 조회에서 운영 대시보드 메뉴를 제거한다.
- 기존 Admin 운영 대시보드 화면을 운영의 DB 운영 대시보드에 연결한다.

## RED

- 커밋: `b6eed1e test: require DB operations dashboard navigation`
- 명령: `python -m pytest tests/test_operations_dashboard_navigation_ui_contract.py -q`
- 결과: 신규 계약 테스트 3개 실패.

## GREEN

- 커밋: `9fdb29d feat: move operations dashboard entry to operations menu`
- 관련 UI 계약 테스트 결과: `9 passed`.
- Web 운영 빌드와 TypeScript 검사 통과.

## 보장 범위

| 보장 내용 | 결과 |
|---|---|
| Admin 현황 조회 메뉴에서 운영 대시보드 항목 제거 | PASS |
| 운영의 DB 운영 대시보드가 `/admin/operations-dashboard`로 이동 | PASS |
| 대상 화면에서 운영 메뉴 활성 및 Admin 메뉴 비활성 | PASS |
| 메뉴 제거 후에도 운영 권한의 대시보드 접근 유지 | PASS |

## 운영 확인

- Daon Studio를 `9fdb29d`로 배포했다.
- Studio와 API가 healthy이고 DB ready 상태가 정상이다.
- 실제 브라우저에서 Admin 메뉴 부재, 운영 링크 표시와 클릭 이동, 운영 메뉴 활성 상태를 확인했다.
- API 컨테이너와 DB는 변경하지 않았다.

## 알려진 범위

- 기존 `/studio/operations-dashboard` 경로는 직접 접근 호환을 위해 유지했다.
- 대시보드 화면과 데이터 API는 변경하지 않았다.
