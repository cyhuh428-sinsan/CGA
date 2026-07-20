# CGA 작업 현황

- 최종 갱신: 2026-07-20
- 저장소: `D:\Project\cga`
- 현재 브랜치: `feature/daon-test-deployment`
- 현재 HEAD: `6ea0e54 fix: enable bot creation page scrolling`
- 목표: 기존 CGA 화면 구조와 Aidot 기능을 결합하고 Aidot 산출물과 상호 호환되는 CGA Studio 구축

## 1. 확정된 작업 방향

- 현재 저장소를 기준으로 계속 개발한다.
- 기존 CGA 데이터베이스를 재사용하고 필요한 경우에만 테이블을 변경한다.
- WebChat은 CGA와 Aidot 모두 사용하지 않으므로 작업 범위에서 제외한다.
- 전체 화면과 메뉴 연결을 먼저 완성한 뒤 화면별 세부 수정과 기능 검증을 진행한다.
- 봇 패키지, 의도, 개체, 사전 등 Aidot 업로드·다운로드 왕복 호환성은 핵심 요구사항이다.
- 왕복 호환성은 각 기능을 검증할 때 하나씩 확인한다.
- 브라우저 코드는 운영 내부 API 주소나 `localhost`를 직접 호출하지 않고 same-origin 프록시/BFF를 사용한다.

## 2. 화면 및 메뉴 연결 현황

### 공통 화면

- 로그인 화면 브랜드를 `CGA Studio`로 변경했다.
- 상단 헤더 디자인을 CGA 기준으로 확정했다.
- 좌측 1차 메뉴를 운영, 제작, API, Admin으로 확정했다.
- 좌측 하단 N 버튼은 중앙 정렬 방향으로 확정했다.

### 운영

- `BM 봇 관리`: 기존 CGA 화면 유지 방향으로 연결했다.
- `BOT 봇 작업공간`: 기존 CGA 화면 유지 방향으로 연결했다.
- `DB 운영 대시보드`: 기존 CGA 화면 유지 방향으로 연결했다.
- `RT 재학습`: Aidot 재학습 화면으로 연결했다.
- `AN 분석`: Aidot 분석 화면으로 연결했다.

### 제작

- `01 봇 생성`: 기존 CGA 화면으로 연결했다.
- `02 봇 설정`: Aidot의 AI 모델 설정, 기본값 설정, 메시지 설정, 메신저 편의 기능, 제외/무시 목록 설정, 룰 설정, 스몰토크, 봇스테이션 화면으로 연결했다.
- 봇 설정 8개 화면은 Aidot 내부 좌측 메뉴를 제거하고 실제 화면 내용만 CGA 셸에 붙이는 방향이다.
- 봇 설정 8개 실제 화면 내용은 임의로 수정하지 않는다.
- `03 봇 구성`: Aidot 구성 화면으로 연결했다.
- `04 의도·개체·사전`: Aidot 의도, 개체, 사전 화면으로 연결했다.
- `05 봇 테스트`: Aidot 시뮬레이터 화면으로 연결했다.
- `06 봇 평가`: Aidot 평가 화면으로 연결했다.
- 봇 생성 화면의 상하 스크롤 수정은 커밋 `6ea0e54`에 반영됐다.

### API와 Admin

- API 화면의 메뉴 연결을 완료했다.
- API는 별도 서브메뉴를 두지 않는 방향으로 확정했다.
- Admin은 Aidot Admin의 실제 관리 항목을 CGA 서브메뉴로 표시하는 방향으로 연결했다.
- 세부 기능과 화면 검증은 아직 남아 있다.

## 3. 현재 Git 상태

- 현재 브랜치 `feature/daon-test-deployment`에는 upstream이 설정되어 있지 않다.
- `apps/web/Dockerfile`: `MM`
- `apps/web/lib/api.ts`: `MM`
- 두 파일 모두 스테이징 영역과 작업 트리에 서로 다른 상태가 있다.
- 스테이징 영역에는 Daon 배포 시험 변경이 들어 있다.
  - `apps/web` 독립 의존성 설치와 빌드
  - 컨테이너 포트 4173
  - 브라우저의 상대 API 경로
  - 서버의 `AIDOT_INTERNAL_API_BASE_URL` 지원
- 작업 트리는 두 파일을 HEAD 상태로 되돌린 내용이 미스테이징 변경으로 보인다.
- 현재 상태에서 무심코 `git add` 또는 `git commit`하면 의도하지 않은 결과가 생길 수 있다.
- 다음 작업 전에 스테이징 변경을 작업 트리에 반영할지 폐기할지 먼저 결정해야 한다.

최근 기준 커밋:

- `6ea0e54 fix: enable bot creation page scrolling`
- `e54df3e feat: replace legacy CGA with Aidot-compatible Studio`

## 4. 현재 실행 상태

2026-07-20 확인 기준:

- 웹 포트 5173은 Node PID 5784로 실행 중이었다.
- API 포트 8320은 실행 중이 아니었다.
- 장시간 실행된 `npm ci --ignore-scripts`는 읽기 I/O가 계속 증가하여 완전 정지로 판정하지 않았고 이후 종료됐다.

## 5. Daon 서버 배포 기준

- SSH 별칭: `daon-server`
- 배포 경로: `/home/ubuntu/deploy/cga`
- 서비스 주소: `https://cga.sinsan.kr`
- 서버의 과거 소스는 교체할 수 있다.
- 서버의 기존 `.env`는 재사용 후보이며 값은 로그나 Git에 기록하지 않는다.
- 로컬에서 작업한 뒤 Git을 통해 Daon 서버에 배포하고 테스트한다.
- 배포 전에 현재 브랜치의 스테이징/작업 트리 분리 상태를 해결해야 한다.

## 6. 성능 및 도구 진단

- D:는 USB 연결 SDXC 저장장치로 확인됐다.
- 작은 파일 생성, 이름 변경, 삭제 시 D: 활성 시간이 100%에 도달하고 대기열이 최대 11까지 증가했다.
- 40개 파일 처리 총시간 중앙값은 약 4.5초였다.
- 500개 임시 파일 삭제에는 약 153.6초가 걸렸다.
- 단순 파일 존재 확인도 포화 시 317.8초가 걸렸다.
- Microsoft Defender의 `D:\Project` 검사 제외 전 중앙값은 4,535ms, 제외 후 중앙값은 4,513ms로 차이는 오차 범위였다.
- Defender는 현재 병목의 주원인으로 보기 어렵다.
- 임시 Defender 제외는 측정 후 제거했으며 AhnLab 설정은 변경하지 않았다.
- `apply_patch`가 대상 파일 생성 전에 장시간 대기한 사례가 있다.
- D: I/O 병목은 확인됐지만 모든 적용 도구 대기의 원인을 D: 하나로 확정하지 않는다.
- 장기적으로 개발 저장소와 `node_modules`를 내부 NVMe SSD로 이동하는 것이 권장된다.

## 7. 검증 상태

- 메뉴의 큰 연결 구조는 완료한 상태다.
- 화면별 세부 디자인과 기능 검증은 완료되지 않았다.
- Aidot 업로드·다운로드 왕복 호환성 검증은 기능별 작업 시 수행한다.
- 정적 검사, 빌드, HTTP 응답, 실제 브라우저 클릭 검증을 서로 다른 검증 단계로 구분한다.
- Daon 운영 유사 환경에서 브라우저 Network 기준 same-origin 요청 검증은 아직 완료되지 않았다.

## 8. 다음 작업

1. `apps/web/Dockerfile`과 `apps/web/lib/api.ts`의 스테이징/작업 트리 분리 상태를 결정한다.
2. Daon 배포용 Docker와 same-origin API 구성을 확정한다.
3. 빌드와 타입 검사를 수행한다.
4. 작업 브랜치를 commit/push 한다.
5. `daon-server`의 `/home/ubuntu/deploy/cga`에 Git 기준으로 배포한다.
6. `https://cga.sinsan.kr`에서 로그인, 메뉴 이동, 실제 API Network 요청을 확인한다.
7. 큰 화면 구조를 먼저 정리한 뒤 메뉴별 세부 수정과 Aidot 왕복 호환 검증을 진행한다.

## 9. 재개 시 주의사항

- 현재 `MM` 두 파일을 확인하지 않고 스테이징하거나 커밋하지 않는다.
- 연결된 메뉴와 Aidot 실제 화면 내용을 임의로 재작성하지 않는다.
- WebChat 관련 코드는 건드리지 않는다.
- 운영 브라우저가 `localhost`, `127.0.0.1`, Docker 내부 호스트나 내부 포트를 직접 호출하지 않도록 한다.
- `.env`의 비밀값을 문서, 로그, Git에 남기지 않는다.

## 10. 2026-07-20 독립 CGA API 배포 준비

- 포트와 도메인을 다음과 같이 확정했다.
  - `cga.sinsan.kr -> cga-studio:4173`
  - `api-cga.sinsan.kr -> cga-api:8000`
  - `5173`은 로컬 개발 화면에서만 사용
- 브라우저는 same-origin `/api/v1`을 호출하고 Studio 서버만 `CGA_INTERNAL_API_BASE_URL=http://cga-api:8000`을 사용한다.
- `cga-api`는 Aidot DB가 아니라 기존 `cga` DB에 Alembic 신규 테이블을 추가하도록 구성했다.
- 기존 `cga_state_store`는 유지하고, 필요한 조직·역할이 이미 있으면 초기 시드를 다시 실행하지 않는다.
- 운영 환경의 기본 JWT 비밀값, 기본 관리자 비밀번호, 기본 DB 자격증명 사용을 차단했다.
- 관련 테스트 21개와 Web 운영 빌드, Daon Docker Compose 파서 검증이 통과했다.
- 전체 API 테스트는 485 통과, 4 건너뜀, 기존 범위 5 실패이며 별도 확인 대상으로 남겼다.
- 커밋:
  - `7d98773 test: add CGA deployment contract`
  - `3b0abf0 test: require safe CGA API bootstrap`
  - `b0f55c9 test: reject insecure CGA production defaults`
  - `05aa356 fix: restore web production build`
  - `7b61884 feat: add independent CGA API deployment`
- 아직 Daon DB 마이그레이션, 컨테이너 교체, NPM SSL, 실제 브라우저 Network 검증은 수행하지 않았다.
