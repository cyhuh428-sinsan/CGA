# CGA Studio 회귀 테스트 실행 가이드

## 1. 목적

기능 수정이나 운영 배포 전에 기존 기능이 깨지지 않았는지 사용자가 같은 기준으로 반복 확인하기 위한 가이드다.

회귀 테스트는 제품 데이터 변경 없이 소스 계약, API 로직, 화면 계약과 Web 운영 빌드를 검사한다. 봇 생성·삭제, 실제 재학습, 패키지 업로드처럼 운영 데이터를 변경하는 시나리오는 이 자동 실행 범위에 포함하지 않는다.

## 2. 실행 전 준비

1. PowerShell을 연다.
2. CGA 저장소 루트로 이동한다.
3. 테스트하려는 브랜치와 커밋을 확인한다.

```powershell
Set-Location "C:\Users\cyhuh\OneDrive\바탕 화면\D Driver\Project\cga"
git branch --show-current
git log -1 --oneline
git status --short
```

`git status --short`에 표시되는 사용자 작업 파일은 테스트 전에 삭제하거나 초기화하지 않는다.

## 3. 가장 자주 사용하는 빠른 회귀 테스트

최근 수정한 공용 작업 컨텍스트와 봇 테스트·팝업 시뮬레이터 계약 20개를 검사한다.

```powershell
.\scripts\run-regression-tests.ps1 -Scope Quick
```

정상 기준:

- 마지막에 `20 passed`가 표시된다.
- 스크립트 마지막 줄에 `CGA 회귀 테스트 완료: PASS`가 표시된다.
- `failed`, `error` 또는 PowerShell 예외가 없어야 한다.

실행 대상:

- `test_workspace_context_shared_callers_regression.py`
- `test_bot_configure_ui_contract.py`
- `test_simulator_workspace_context_ui_contract.py`

## 4. 전체 API 회귀 테스트

API 전체 테스트를 실행한다. 기능 병합 전이나 배포 전 최종 확인에 사용한다.

```powershell
.\scripts\run-regression-tests.ps1 -Scope Full
```

`AIDOT_TEST_DATABASE_URL`이 설정되지 않은 경우 전용 DB 통합 테스트는 `skipped`로 표시될 수 있다. 이는 실패가 아니다. 운영 DB 주소를 이 환경변수에 넣어서는 안 된다.

정상 기준:

- 실패와 수집 오류가 0건이어야 한다.
- `skipped`가 있으면 출력된 사유가 전용 테스트 DB 미설정인지 확인한다.
- 경고는 내용을 확인하되 테스트 실패와 구분한다.

## 5. Web 운영 빌드 검사

Next.js 컴파일, TypeScript 검사와 전체 페이지 생성을 확인한다.

```powershell
.\scripts\run-regression-tests.ps1 -Scope Web
```

스크립트가 `npm ci`로 의존성을 맞춘 뒤 `npm run build`를 실행한다. 정상 기준은 다음과 같다.

- `Compiled successfully`
- TypeScript 단계 통과
- 정적 페이지 생성 완료
- 마지막에 `CGA 회귀 테스트 완료: PASS`

`npm audit` 취약점 안내는 빌드 실패와 별개다. 단, 새 취약점이 확인되면 별도 보안 조치 대상으로 기록한다.

## 6. 배포 전 전체 검사

전체 API 테스트와 Web 운영 빌드를 순서대로 실행한다.

```powershell
.\scripts\run-regression-tests.ps1 -Scope All
```

실행 시간이 가장 길다. `main` 병합 전이나 운영 배포 직전에 사용한다.

## 7. 권장 실행 시점

| 상황 | 실행 범위 |
|---|---|
| 봇 테스트·화면 표시 수정 중 | `Quick` |
| API 또는 엔진 로직 수정 후 | `Full` |
| Web 화면·컴포넌트 수정 후 | `Quick` + `Web` |
| `main` 병합 전 | `All` |
| 운영 배포 직전 | `All` |
| 문서만 수정 | 관련 링크·파일 확인, 필요 시 `Quick` |

## 8. 실패했을 때 확인 순서

1. 최초 실패 테스트 이름과 오류 메시지를 저장한다.
2. 현재 브랜치와 커밋을 다시 확인한다.
3. `ModuleNotFoundError: No module named 'app'`이면 반드시 제공된 PowerShell 스크립트로 다시 실행한다.
4. DB 통합 테스트만 실패하면 `AIDOT_TEST_DATABASE_URL`이 운영 DB가 아닌 별도 테스트 DB인지 확인한다.
5. Web 빌드가 실패하면 `Compiled successfully` 이전의 최초 오류를 확인한다.
6. 실패 상태에서 운영 배포를 진행하지 않는다.

## 9. 결과 보고 형식

아래 형식으로 결과를 남긴다.

```text
실행일시:
브랜치:
커밋:
실행 범위: Quick / Full / Web / All
테스트 결과: passed / failed / skipped
Web 빌드: PASS / FAIL / 미실행
최초 오류:
판정: 배포 가능 / 수정 필요
```

## 10. 운영 확인은 별도 단계

자동 회귀 테스트 통과는 로컬 소스와 빌드 기준의 합격이다. 운영 배포 후에는 다음을 별도로 확인한다.

```powershell
curl.exe -fsS https://cga.sinsan.kr/health/ready
```

정상 응답:

```json
{"status":"ok","database":"ok"}
```

로그인 이후의 실제 버튼 클릭, 브라우저 Network의 same-origin 요청, 봇 응답과 분석 데이터 표시는 운영 브라우저에서 추가 확인한다.
