# CGA Vector Worker 독립 배포 TDD 증거

## 목적

- `cga-api`가 `localhost:8350`이 아니라 CGA 전용 Vector Worker를 호출한다.
- CGA Vector Worker의 네트워크, 벡터 데이터 볼륨, 이미지와 상태를 기존 Aidot 서비스와 분리한다.
- Worker가 준비된 뒤에만 API가 시작되고 운영 대시보드가 `worker_unreachable`을 반환하지 않게 한다.

## 사용자 여정

- 운영자는 CGA 대시보드에서 Semantic Worker 연결 상태를 정상으로 확인할 수 있다.
- Semantic 봇 실행 경로는 CGA 전용 Worker에 인덱싱하고 해당 인덱스에서 검색한다.
- Aidot Worker와 데이터는 CGA 배포·재시작·검색의 영향을 받지 않는다.

## RED / GREEN

| 단계 | 명령 | 결과 | 보장 내용 |
| --- | --- | --- | --- |
| RED 1 | `uv run pytest apps/api/tests/test_cga_deployment_contract.py -q` | `1 failed, 8 passed` | 기존 Compose에 `cga-vector-worker`가 없음을 재현 |
| GREEN 1 | 동일 명령 | `9 passed` | 전용 서비스, 내부 주소, 네트워크, 볼륨, 헬스 의존성 반영 |
| RED 2 | 동일 명령 | `1 failed, 9 passed` | CPU 빌드가 CUDA PyTorch를 설치하는 문제를 계약으로 재현 |
| GREEN 2 | 동일 명령 | `10 passed` | 기본 이미지가 PyTorch CPU 저장소를 먼저 사용함을 보장 |

체크포인트 커밋:

- `f751658` — CGA Worker 누락 RED
- `8a36594` — 독립 Worker 배포 GREEN
- `09d3123` — CUDA 의존성 RED
- `6304fa5` — CPU 전용 이미지 GREEN

## 회귀 검증

| 검증 | 결과 |
| --- | --- |
| 배포·Vector Search·NLU·Admin 관련 API 테스트 | `89 passed` |
| Vector Worker 테스트 | `17 passed` |
| Next.js 프로덕션 빌드 및 TypeScript | PASS, 46개 정적 페이지 생성 |
| Daon `docker compose ... config --quiet` | PASS |
| Daon 외부 Studio/API `/health/ready` | 둘 다 `status=ok`, `database=ok` |

## 운영 검증

- 배포 전 백업: `/home/ubuntu/backups/cga-before-vector-worker-20260722.dump`
- `cga_state_store`: 배포 전 13건, 배포 후 13건
- 컨테이너: `cga-vector-worker` healthy, 호스트 포트 미공개
- 전용 네트워크: `cga_cga_internal`
- 전용 볼륨: `cga_cga_vector_data`
- CPU 전용 최종 이미지 크기: 382,851,732 bytes
- API 내부 Worker 주소: `http://cga-vector-worker:8350`
- 대시보드 상태 함수: `worker_unreachable` 없이 상태 객체 반환
- 실제 HTTP smoke: 6개 벡터 인덱싱 후 `계약을 조회하고 싶어요`가 `계약 조회` 의도로 검색됨
- smoke 인덱스 파일은 확인 후 제거함
- 기존 Aidot 컨테이너는 재생성하거나 중지하지 않음

## 알려진 확인 사항

- Chrome의 기존 로그인 토큰이 만료되어 운영 대시보드의 최종 화면 캡처는 로그인 후 다시 확인해야 한다.
- 서버에서 대시보드가 호출하는 동일 상태 함수를 실행해 `worker_unreachable` 해소는 확인했다.
- `npm ci`는 기존 lock 기준 취약점 3건(중간 1, 높음 2)을 보고했으나 이번 배포 범위와 무관하여 의존성 강제 변경은 하지 않았다.
- 선언형 Compose 변경은 코드 커버리지 수치 대신 계약 테스트, Compose 렌더링, 실제 컨테이너 및 HTTP smoke로 검증했다.
