# 봇 UUID 단일 식별자 전환 TDD 기록

## 범위

- 봇의 유일한 키는 `bots.id` UUID로 통일한다.
- 활성 모델, API 조회·응답, 채널·웹챗, 봇스테이션, 프런트 타입에서 과거 slug 계약을 제거한다.
- 적용된 과거 마이그레이션은 변경하지 않고 신규 `20260720_0027`에서 기존 참조 데이터를 UUID로 변환한 뒤 컬럼을 제거한다.

## RED

- `test_bot_uuid_identity_contract.py`: 활성 코드의 과거 식별자 잔존, 제거 마이그레이션 부재, 즐겨찾기의 비 UUID 허용으로 3건 실패.
- RED 커밋: `2206ca1 test: require UUID-only bot identity`.

## GREEN

- UUID 계약 및 데이터 변환 테스트: 5개 통과.
- 관련 API 회귀 테스트: 127개 통과, 기존 LLM 픽스처 실패 2개 제외.
- 전체 API 테스트: 497개 통과, 4개 건너뜀, 기존 범위 실패 5개.
- Web 운영 빌드: Next.js 컴파일, TypeScript, 정적 페이지 46개 생성 통과.
- 격리 PostgreSQL 16에서 Alembic 전체 업그레이드가 `20260720_0027 (head)`까지 통과.
- `0027 -> 0026 -> 0027` 다운·재업그레이드 통과, `bots.slug` 컬럼 수가 다운 시 1, 재업 시 0임을 확인.
- GREEN 커밋: `ee9e472 refactor: use UUID as the only bot identity`.

## 영향과 호환성

- 봇 이름 또는 과거 식별문자열을 사용한 API 경로 호출은 더 이상 지원하지 않는다.
- 봇 목록 검색은 봇 이름과 정확한 UUID를 지원한다.
- API 응답과 내보내기 패키지에서 과거 식별자 필드를 제거한다.
- 봇스테이션의 봇 식별값은 UUID로 자동 고정되며 화면에서 편집할 수 없다.
- 마이그레이션은 저장된 `botIdentifier`, `favorite_bot_ids`, `last_bot_screen`을 UUID로 변환한다.

## 기존 실패 분리

- LLM 답변 테스트 2건은 픽스처에 provider/model 설정이 없어 실패한다.
- 라우터 접두사 기대값 테스트 3건은 현재 FastAPI 라우터 경로와 기대값이 달라 실패한다.
- 다섯 건 모두 이번 UUID 변경 파일과 무관하며 별도 수정 대상으로 유지한다.
