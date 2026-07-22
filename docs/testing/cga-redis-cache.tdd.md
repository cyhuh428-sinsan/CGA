# CGA Redis cache deployment TDD evidence

## Source and user journey

- Source plan: 별도 계획 문서 없음. 2026-07-22 운영 요청에서 도출했습니다.
- Journey: 운영자는 반복적인 봇 버전 조회를 CGA 전용 Redis에 캐시해 응답 속도를 높이되, Aidot Redis와 데이터 및 장애 범위를 분리할 수 있어야 합니다.

## Task report

| 단계 | 실행 명령 | 결과 | 보장 내용 |
|---|---|---|---|
| RED | `python -m pytest apps/api/tests/test_cga_deployment_contract.py -q` | `1 failed, 12 passed` | 기존 compose에 CGA 전용 Redis와 캐시 환경 계약이 없음을 재현했습니다. |
| GREEN | `python -m pytest apps/api/tests/test_cga_deployment_contract.py -q` | `13 passed` | API 캐시 설정, 전용 Redis, 헬스 의존성, 비공개 포트 및 `.env.example` 계약을 보장합니다. |
| 회귀 | `python -m pytest tests -q` (`apps/api` 기준) | `528 passed, 4 skipped` | 기존 API 동작에 회귀가 없음을 확인했습니다. |
| Compose | WSL `docker-compose ... config -q` | base/GPU 모두 PASS | 기본 및 GPU 오버레이 조합이 실제 Docker Compose에서 해석됩니다. |

## Test specification

| # | 보장 항목 | 테스트 유형 | 결과 |
|---|---|---|---|
| 1 | API가 `.env`의 Redis URL과 TTL 설정을 사용합니다. | 배포 계약 | PASS |
| 2 | `cga-redis`는 `cga_internal`에서만 동작하고 호스트 포트를 공개하지 않습니다. | 배포 계약 | PASS |
| 3 | API는 Redis 헬스체크 통과 후 시작합니다. | 배포 계약 | PASS |
| 4 | Redis는 256MB LRU 캐시로 구성되고 영속 데이터를 생성하지 않습니다. | Compose 검증 | PASS |
| 5 | Redis 장애 시 기존 cache-aside 구현이 DB 조회로 폴백합니다. | 기존 API 회귀 | PASS |

## Coverage and known gaps

- 이번 변경은 Python 실행 로직이 아닌 Docker Compose 및 환경 예제 변경이므로 코드 커버리지 수치는 별도로 생성하지 않았습니다.
- 운영 컨테이너 배포와 캐시 hit-rate 확인은 main 병합 후 별도 운영 반영 단계에서 수행합니다.

## Merge evidence

- RED commit: `1145f23 test: define CGA Redis cache deployment contract`
- GREEN commit: `55786af feat: enable isolated CGA Redis cache`
