# CGA Studio npm 보안 업데이트 TDD 증거

## 목적

- CGA Studio 이미지에 포함된 `next`, `postcss`, `sharp`의 알려진 취약 버전을 제거한다.
- 운영 재빌드가 임의 최신 버전에 의존하지 않도록 보안 관련 버전을 고정한다.
- API, 엔진, DB 동작은 변경하지 않는다.

## 사용자 여정

- 운영자는 같은 Git 커밋을 어느 서버에서 빌드하더라도 감사 결과가 동일한 Studio 이미지를 얻는다.
- 사용자는 의존성 보안 업데이트 이후에도 기존 46개 Studio 경로를 동일하게 사용할 수 있다.

## RED

명령:

```powershell
C:\Users\cyhuh\anaconda3\python.exe -m pytest tests\test_web_dependency_security.py -q
```

결과:

- `2 failed`
- `package.json`의 `next`가 `latest`였음
- 잠금 파일의 `next`가 `16.2.10`이었음

체크포인트: `2abffc9 test: reproduce vulnerable web dependency lock`

## GREEN

적용 버전:

- Next.js `16.2.12`
- PostCSS `8.5.18`
- Sharp `0.35.3`

명령 및 결과:

| 보장 항목 | 명령 | 결과 |
|---|---|---|
| 보안 버전 고정 및 잠금 | `python -m pytest tests/test_web_dependency_security.py -q` | `2 passed` |
| 알려진 npm 취약점 제거 | `npm audit --json` | `0 vulnerabilities` |
| 전체 백엔드 회귀 | `scripts/run-regression-tests.ps1 -Scope All` | `689 passed, 4 skipped` |
| 재현 설치 | `npm ci` | PASS, `0 vulnerabilities` |
| Next 운영 빌드 | `npm run build` | PASS, 46개 경로 생성 |
| Daon Alpine Docker 빌드 | `docker build -f apps/web/Dockerfile -t cga-studio:npm-security-verify .` | PASS, `npm audit 0`, 46개 경로 생성 |

GREEN 체크포인트: `347bc1d fix: update vulnerable web dependencies`

## 검증 환경과 알려진 제한

- Next.js, PostCSS, Sharp는 Dockerfile의 Node.js 22 요구사항과 일치한다.
- 로컬 Windows에는 Docker CLI가 없어 Daon의 격리 checkout에서 운영 동일 Docker 빌드를 확인했다.
- DB 통합 테스트 4건은 `AIDOT_TEST_DATABASE_URL` 미설정으로 기존과 동일하게 건너뛰었다. 이번 변경은 웹 의존성에만 한정된다.
- 깨끗한 worktree에서 공식 `-Scope All`을 처음 실행하면 카탈로그 테스트보다 `npm ci`가 뒤에 있어 2건이 선행조건 부족으로 실패한다. `npm ci` 후 같은 명령을 다시 실행해 위 결과를 확인했다.
