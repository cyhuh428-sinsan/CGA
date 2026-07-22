# CGA Studio 실제 운영 사이트 라이브 테스트 보고서 (cga.sinsan.kr)

- 작성일: 2026-07-22
- 테스트 대상: **https://cga.sinsan.kr/** (실제 배포 환경, Daon 서버)
- 관계 문서: [qa-regression-report-2026-07-22.md](qa-regression-report-2026-07-22.md) — 코드 기준 정적/자동화 테스트 보고서. 본 문서는 그 보고서의 "인프라 부재로 BLOCKED" 항목들을 실제 사이트에서 검증한 후속 라운드다.
- 인증: 사용자가 브라우저 창에서 직접 로그인(계정 `cyhuh` / 허철영 · 시스템관리자, 그룹 `Support Bot Group`). **본인은 정책상 비밀번호를 직접 입력하지 않았으며, 로그인은 사용자가 수행했다.**
- 원칙: 소스 코드 미수정. 조회 위주로 진행했고, 데이터를 변경할 수 있는 동작(삭제, 실제 재학습 실행, 패키지 업로드/다운로드 등)은 이번 라운드에서 실행하지 않음(4장 참조).

---

## 1. 테스트 방식

- 실제 배포된 CGA Studio(https://cga.sinsan.kr, apps/web) + CGA API(https://api-cga.sinsan.kr) 조합을 대상으로 함.
- 인증 전: `curl`로 공개 엔드포인트/헤더/접근 제어를 점검.
- 인증 후: 브라우저(Claude in Chrome, 사용자의 실제 Chrome)로 화면을 순회하며 조회 위주 기능 확인.
- 계정에 이미 준비되어 있던 실제 테스트 봇 7종(이름에 "테스트"가 명시된 QA 픽스처)을 대상으로 진행해 운영 데이터 훼손 위험을 낮췄다.

---

## 2. 인증 전(비로그인) 점검 결과 — 전부 PASS

| 항목 | 확인 내용 | 결과 |
|---|---|---|
| `/health/ready` | `{"status":"ok","database":"ok"}` (200) | PASS |
| `api-cga.sinsan.kr/health/ready` | `{"status":"ok","database":"ok"}` (200) | PASS |
| `/` → `/login` 리다이렉트 | 307 → `/login` | PASS |
| `/login` 렌더링 | 아이디/비밀번호/자동로그인/언어선택/회원가입 링크 정상 노출 | PASS |
| `/signup` 렌더링 + API 연동 | 서버·그룹 셀렉트가 `/api/v1/auth/signup-options` 응답("기본 서버", "기본그룹", "Support Bot Group")과 정확히 일치 | PASS |
| 존재하지 않는 경로 | `/no-such-page-xyz` → 404 | PASS |
| 보호된 API 무인증 접근 | `GET /api/v1/bots` → `401 {"detail":"Not authenticated"}` | PASS |
| 잘못된 로그인 시도(임의 문자열, 실제 계정 아님) | `POST /api/v1/auth/login` → `401 {"detail":"아이디 또는 비밀번호가 올바르지 않습니다."}` | PASS |
| 보호된 페이지(`/admin/users` 등) 무인증 접근 | 서버는 200으로 앱 셸만 반환(실 데이터 미노출, `인증: - · 권한없음`), 브라우저 JS 실행 시 `/login`으로 클라이언트 리다이렉트 확인 | PASS |

**결론**: 인증/접근 제어 계층은 실제 배포 환경에서 설계대로 동작한다. 서버 사이드에서 200을 반환하지만 실제 데이터는 노출하지 않고, 클라이언트에서 인증 상태를 확인해 로그인 화면으로 보내는 구조(Next.js 클라이언트 가드)를 실측으로 확인했다.

---

## 3. 인증 후 화면 점검 — 이전 보고서의 BLOCKED 항목 갱신

qa-regression-report-2026-07-22.md에서 `BLOCKED`로 표기했던 항목들을 실제 사이트에서 재검증한 결과다. ID는 이전 보고서의 시나리오 ID를 그대로 사용한다.

| ID | 시나리오 | 실제 결과 |
|---|---|---|
| HUB-01 | 봇 생성 화면에서 "봇 허브" 옵션 비활성화 | **PASS(라이브)** — 라디오에 `disabled` 및 안내문 "봇 허브 생성은 현재 사용할 수 없습니다." 노출 확인 |
| HUB-02 | 봇 관리(BM) 목록/그룹/선택 | **PASS(라이브)** — Support Bot Group 소속 봇 7개(테스트 봇, 테스트 봇 - 시맨틱 등) 목록·검색 정상 |
| HUB-03 | 선택 버전 AI 상세(NLU 방식/모델, 답변 방식, LLM) 노출 | **PASS(라이브)** — "NLU 방식 ml · NLU 모델 deep_learning_lite · 답변 방식 fixed · LLM gpt-4o-mini" 정상 표시 |
| BOTCFG-02/03 | 봇 설정 8개 화면(AI모델/기본값/메시지/메신저/제외목록/룰/스몰토크/봇스테이션) | **PASS(라이브)** — 8개 화면 전부 진입 및 실제 데이터 렌더링 확인(예: 봇스테이션 화면에서 Kakao/Simulator/MS Teams/Webchat 4채널 연동 상태 표시) |
| NLU-01 | 의도 목록/편집 화면 | **PASS(라이브)** — "테스트 봇"에 16건 의도/모듈, 개별 의도 편집 화면에서 학습문장 목록(예: "무동의 계약" 17개 문장) 정상 표시 |
| NLU-02 | 개체(Entity) 목록 | **PASS(라이브)** — 사용자 개체 6건 + 시스템 개체 다수 정상 표시 |
| NLU-03 | 사전(Dictionary) 목록 | **PASS(라이브)** — 단어 6건, 동의어 매핑 정상 표시 |
| RT-02 | 재학습 이력 화면(페이지네이션) | **PASS(라이브)** — 10/25/50/100건 보기 옵션 정상 동작, 빈 데이터 상태 정상 처리 |
| SIM-01 | 시뮬레이터 대화 테스트 | **FAIL — 원인 확정, 5.1 참조** |
| SIM-02 | 평가(Evaluation) 화면 | **PASS(라이브)** — 실제 평가 지표(정확도 65.4%, Confusion Matrix, Feature Balance 차트, 오분류/저신뢰 문장 목록) 정상 표시 |
| API-01 | API 스토어 목록 | **PASS(라이브)** — 등록된 API 5건(JSONPlaceholder, httpbin, REST Countries 등) 정상 표시 |
| ADM-02 | Admin 공통변수 | **PASS(라이브)** — 시스템 변수 38건(`_bot_id`, `_dialog_id` 등) 정상 표시 |
| ADM-06 | Admin 사용자 관리 | **PASS(라이브)** — 사용자 2건(cyhuh/master), 그룹·역할·계정상태 컬럼 정상 표시 |
| ADM-07/LIC-01/02 | Admin 라이선스 | **PASS(라이브)** — 사용자 120/봇 30/API 50 라이선스 총량과 사용량(2/7/5), 만료일 2026-12-31 정상 표시 |
| ADM-04 | 운영 대시보드 | **PASS(라이브) + 이슈 2건 발견 — 5장 참조** |

---

## 4. 이번 라운드에서 실행하지 않은 항목 (파괴적/변경 동작)

아래는 실제 운영 계정의 데이터를 변경할 수 있어, 사용자 확인 없이 진행하지 않은 항목이다. 필요 시 별도 승인 후 진행 권고.

- `AIDOT-06` Aidot 봇 패키지 실제 업로드/다운로드 왕복 (BM 화면에 버튼 확인함, 클릭 시 파일 다운로드가 발생하여 진행 보류)
- `HUB-07` 봇 삭제
- 실제 재학습(학습하기) 실행 — 시간이 걸리고 모델 아티팩트를 갱신하므로 보류
- 회원가입 폼 제출(계정 생성) — `/signup` 렌더링만 확인, 실제 제출은 하지 않음
- 의도/개체/사전/룰/스몰토크 등 실제 생성·수정·삭제

---

## 5. 발견된 결함 (라이브 테스트로만 드러난 이슈)

### 5.1 [결함 1 · 심각 · 원인 확정] 시뮬레이터가 항상 버전 요약(summary)만 받아 학습문장을 인식하지 못함

- **대상**: 봇 `테스트 봇` (`38f0dfda-9160-4868-ba67-56e2ed043941`), 버전 `v1`, NLU 방식 `ML/DeepLearning Lite`
- **재현 절차**:
  1. `/studio/bots/38f0dfda-9160-4868-ba67-56e2ed043941/versions/v1/intents`에서 "학습성공 2026-05-04 15:43", 의도 16건, "무동의 계약" 의도에 학습문장 17개(그 중 하나가 정확히 `가입안했어요`)가 존재함을 확인.
  2. `/studio/bots/38f0dfda-9160-4868-ba67-56e2ed043941/versions/v1/evaluation`에서 학습모델 평가 정확도 65.4%(Random), Confusion Matrix, 의도 13개·학습문장 228개 통계가 정상적으로 존재함을 확인. **즉 이 버전은 실제로 학습이 완료되어 평가 리포트까지 생성된 상태다.**
  3. `/studio/bots/38f0dfda-9160-4868-ba67-56e2ed043941/versions/v1/simulator`에서 학습문장과 100% 동일한 문장 `가입안했어요`를 그대로 입력.
- **기대 결과**: "무동의 계약" 의도로 분류되거나, 적어도 Score 기반의 근접 판정 결과가 표시되어야 한다.
- **실제 결과**: 봇 응답은 "질문을 이해하지 못했습니다. 다시 말씀해주세요."이고, 분석 패널의 분류 결과는 **"학습 문장이 없어 의도 분류를 수행할 수 없습니다."**
- **재현성**: 동일 세션에서 서로 다른 문장 2개(`상담사 연결해주세요`, `가입안했어요`)로 재시도했고 둘 다 동일하게 실패했다. 별도 세션(재로그인 후)에서도 동일하게 재현됨.

- **확정된 근본 원인 (네트워크 응답으로 직접 확인)**:
  1. 시뮬레이터([simulator-page.tsx:3410](../../apps/web/components/simulator-page.tsx))는 `refreshStudioBotSelectedVersion(accessToken, botId, versionId, null, true)`를 호출해 버전 전체 문서(`version_json.dialogs` 포함)를 요청한다.
  2. 이 함수는 내부적으로 `fetchStudioWorkspaceContext(token, botId, versionScope, includeDocument)`([studio-bots-api.ts:1690](../../apps/web/lib/studio-bots-api.ts))를 호출하는데, 쿼리 문자열 생성 로직이 다음과 같다:
     ```js
     const search = new URLSearchParams();
     if (!includeDocument) {
       search.set("include_document", "false");
     }
     ```
     **`includeDocument === true`일 때 `include_document` 쿼리 파라미터를 아예 붙이지 않는다** — "파라미터를 생략하면 서버가 true로 알아서 처리해줄 것"이라는 잘못된 전제로 보인다.
  3. 그런데 백엔드 엔드포인트 `GET /bots/{bot_id}/versions/{version_scope}/context`([bots.py:4559-4568](../../apps/api/app/api/routes/bots.py))는 `include_document: bool = Query(default=False)`로 선언되어 있다. 파라미터가 없으면 FastAPI는 **기본값 `False`**를 사용한다.
  4. 결과적으로 시뮬레이터는 매번 `GET .../context`(파라미터 없음) 요청을 보내고, 백엔드는 이를 `include_document=False`로 해석해 **`_serialize_version_summary()`(버전 요약, `version_json` 필드 자체가 없음)** 를 반환한다. 시뮬레이터가 원했던 `_serialize_version()`(전체 문서, `version_json.dialogs` 포함)은 절대 반환되지 않는다.
  5. **실측 증거**: 로그인 세션에서 시뮬레이터 페이지 진입 시 실제 발생한 네트워크 요청은 `GET https://cga.sinsan.kr/api/v1/bots/38f0dfda-9160-4868-ba67-56e2ed043941/versions/v1/context` (쿼리 파라미터 없음)였고, 응답 바디의 `"version"` 객체에는 `system_config`, `asset_counts`(`"dialogs":16` 등 정확한 개수는 포함됨), `nlu_training`, `nlu_evaluation` 등은 있었지만 **`version_json` 키 자체가 존재하지 않았다.**
  6. 프론트엔드 `trainDeepLearningLite()`([deep-learning-lite.ts:428](../../apps/web/lib/nlu/deep-learning-lite.ts))는 `versionDocument.dialogs`(정규화 후 빈 배열)를 순회해 학습 문서를 만드는데, 소스 데이터가 없으니 문서 0건 → 클라이언트 ML 모델이 완전히 비어 학습됨 → `classifyIntent()`가 항상 빈 결과를 반환 → "학습 문장이 없어 의도 분류를 수행할 수 없습니다."
- **왜 다른 화면(의도/평가)은 정상인가**: 같은 `context` 엔드포인트는 `prefetch_section=dialogs`라는 별도 파라미터를 지원하며, 이 경로는 `include_document=false`여도 `_serialize_version_dialogs()`를 통해 dialogs만 별도로 채워 넣는다([bots.py:4592-4606](../../apps/api/app/api/routes/bots.py)). 의도/개체/사전/평가 화면은 이 `prefetch_section=dialogs` 경로(또는 별도 dialogs 전용 엔드포인트)를 사용하기 때문에 정상적으로 학습문장을 받아온다. **시뮬레이터만 `includeDocument=true` 단독 경로를 쓰다가 이 버그에 걸린다.**
- **영향 범위**: 코드 검색 결과 `refreshStudioBotSelectedVersion`/`fetchStudioWorkspaceContext`를 호출하는 화면은 다수 있으나(의도/개체/사전/재학습/평가 등), 그중 실제로 `includeDocument=true`를 사용하면서 `prefetch_section`도 없이 문서 전체가 필요한 곳은 **시뮬레이터가 유일하게 확인됨**. 다만 `studio-workspace-provider.tsx`, `bot-operations-workspace-page.tsx` 등 다른 호출부도 `includeDocument`를 인자로 그대로 전달하므로, 그 화면들의 실제 호출 인자값(true로 호출되는 경우가 있는지)은 이번 라운드에서 전수 검증하지 못했다 — 후속 점검 권고.
- **실 채널(Kakao 등) 영향 여부**: 실 채널 런타임(`apps/api/app/api/routes/channels.py`)은 시뮬레이터와 달리 서버 사이드에서 직접 DB의 `version.version_json`을 읽는 것으로 보이며(웹 프론트엔드의 `fetchStudioWorkspaceContext`를 거치지 않음), 이번에 확인된 버그는 **웹 프론트엔드 전용 캐시/쿼리 파라미터 버그**로, 실 채널 응답에는 영향이 없을 가능성이 높다. 다만 이번 라운드에서 Kakao 등 실 채널로 직접 재현 확인은 하지 않았으므로 완전히 배제하지는 않는다.
- **수정 방향(참고, 이번 라운드에서 적용하지 않음)**: `fetchStudioWorkspaceContext`의 쿼리 문자열 생성 로직을 `includeDocument`가 `true`일 때 명시적으로 `include_document=true`를 설정하도록 수정하거나(가장 간단), 백엔드 `Query(default=False)`를 상황에 맞게 조정. 어느 쪽이든 프론트/백엔드 두 곳의 "생략 시 의미"에 대한 암묵적 합의가 어긋나 있다는 점이 근본 문제다.
- **참고**: 같은 방식으로 확인한 "테스트 봇 - LLM - LLM" 등 나머지 6개 테스트 봇은 실제로 의도가 0건(미학습 상태)인 빈 픽스처였다. 이 계정에 준비된 7개 테스트 봇 중 실제 학습문장이 있는 봇은 "테스트 봇"(ML/DeepLearning Lite) 1개뿐이라, Semantic/LLM 엔진에서도 동일 버그로 실제 분류가 깨지는지는 이번 라운드에서 데이터 부재로 실증하지 못했다(7장 참고).

### 5.2 [결함 2 · 경미] 만료된 편집 잠금(Edit Lock) 1건이 해제되지 않은 채 남아 있음

- **위치**: `/admin/operations-dashboard`
- **증상**: "시스템 로그" 알림에 "만료된 편집 잠금 남음 — 해제되지 않은 채 만료된 편집 잠금이 1건 있습니다."가 표시되고, 상단 요약 카드에도 "편집 잠금 1 · 활성 0 · 만료 1 · 충돌 0"로 집계됨.
- **판정**: 만료된 잠금을 정리하는 백그라운드 청소 작업이 없거나 동작하지 않는 것으로 보인다. 즉시 장애는 아니지만, 방치되면 해당 리소스(봇/버전 편집)에 대한 잠금 상태 조회·통계가 계속 왜곡될 수 있다.
- **권고**: 만료된 잠금을 주기적으로 정리하는 배치/TTL 로직 존재 여부 확인, 또는 Admin 화면에서 수동 정리(강제 해제) 기능 노출 검토.

### 5.3 [결함 3 · 정보성] 시맨틱 GPU / Vector Worker가 "unreachable" 상태

- **위치**: `/admin/operations-dashboard` → "시멘틱 GPU: 미사용 · worker_unreachable"
- **증상**: Semantic 계열 NLU/RAG 엔진이 의존하는 `apps/vector-worker`(별도 서비스)가 현재 배포에 연결되지 않은 것으로 표시됨.
- **판정**: 이번 배포가 vector-worker 없이 운영되는 상태일 가능성이 높다(구성상 선택적 서비스일 수 있음). 다만 계정에 "테스트 봇 - 시맨틱", "테스트 봇 - 외부시맨틱 - RAG", "테스트 봇 - 시맨틱 - RAG" 등 Semantic 계열 테스트 봇이 실제로 존재하므로, 이 봇들의 시뮬레이터/재학습을 테스트할 경우 worker 미연결로 실패할 것으로 예상된다.
- **권고**: 의도된 상태(vector-worker 별도 배포 예정)인지, 배포 설정 누락인지 확인 필요. Semantic 계열 봇 검증 시 최우선으로 재확인할 것.

---

## 6. 종합 결론

- 이전 보고서(코드/pytest 기준)에서 "인프라 부재로 BLOCKED"였던 대부분의 화면 단위 기능(봇 관리, 봇 설정 8개, 의도/개체/사전, 재학습 이력, 평가, Admin, 라이선스, API 스토어)은 **실제 운영 사이트에서 정상 동작을 확인했다.**
- 실제 브라우저로 시뮬레이터를 조작한 뒤 코드 추적과 실제 네트워크 응답 캡처까지 진행해, **정적 테스트나 코드 리뷰만으로는 드러나기 어려운 결함(5.1)의 정확한 원인(프론트엔드의 쿼리 파라미터 생략 로직과 백엔드의 기본값이 서로 반대로 가정되어 있음)을 확정했다.** 코드 위치까지 특정했으므로 개발팀이 별도 재현 없이 바로 수정에 들어갈 수 있다.
- 운영 대시보드에서 만료된 편집 잠금 미해제(5.2, TTL 120초·자동 정리 로직 없음을 코드로 확인 — 이번 세션의 부산물일 가능성이 높은 경미한 위생 이슈), 시맨틱 워커 unreachable(5.3) 등도 함께 확인했다.
- 계정에 준비된 테스트 봇 7개 중 실제 학습 데이터가 있는 것은 1개뿐이라, Semantic/LLM 엔진에서의 동일 버그 여부는 데이터 부재로 실증하지 못했다(7장 참고).
- 파괴적 동작(삭제, 실제 재학습 실행, 패키지 업로드/다운로드, 계정 생성)은 사용자 승인 없이 진행하지 않았다. 필요 시 범위를 좁혀 별도 승인 후 진행 권고.

## 7. 다음 우선순위 권고

1. **[최우선]** 5.1 수정: `apps/web/lib/studio-bots-api.ts`의 `fetchStudioWorkspaceContext` 쿼리 문자열 생성 로직에서 `includeDocument === true`일 때 `include_document=true`를 명시적으로 전송하도록 수정. 수정 후 시뮬레이터로 "테스트 봇"에서 `가입안했어요` 재전송해 "무동의 계약"으로 정상 분류되는지 회귀 확인.
2. 이 수정 이후, Semantic/LLM 엔진 테스트 봇 중 하나에 실제 의도/학습문장을 추가해 해당 엔진 경로에서도 동일 버그가 있었는지 확인 (현재는 데이터가 없어 검증 불가).
3. `studio-workspace-provider.tsx`, `bot-operations-workspace-page.tsx` 등 `fetchStudioWorkspaceContext`의 다른 호출부가 실제로 `includeDocument=true`로 호출되는 경우가 있는지 전수 확인 — 같은 버그의 잠재적 추가 영향 범위 점검.
4. 5.3 vector-worker 연결 상태 확인.
5. 5.2 만료 편집 잠금 자동 정리(TTL 배치) 로직 도입 검토 — 필수는 아니나 위생적으로 권장.
6. 사용자 승인 하에 `AIDOT-06`(패키지 다운로드/업로드 왕복)과 `HUB-07`(봇 삭제 플로우), 실제 재학습 실행을 별도 라운드로 검증.

---

## 8. 조치 현황 (2026-07-22 최종 업데이트)

담당자 확인에 따른 각 항목의 최종 처리 방침이다.

| 항목 | 처리 방침 | 상세 |
|---|---|---|
| 5.1 시뮬레이터 결함 + QA 테스트 기준선 5건 | **조치 완료** | `apps/web/lib/studio-bots-api.ts`의 `fetchStudioWorkspaceContext`가 `include_document=true\|false`를 항상 명시적으로 전송하도록 수정됨(커밋 `470b33a`). 실제 운영 사이트에서 "테스트 봇"에 `가입안했어요` 재전송 → `무동의 계약` 정상 분류를 확인함(`776eb1a` 문서). QA 테스트 기준선의 실패 5건도 함께 정렬 완료(`5905d44`). 회귀 방지용으로 [test_workspace_context_shared_callers_regression.py](../../apps/api/tests/test_workspace_context_shared_callers_regression.py)를 작성해 커밋(`9679d28`, 브랜치 `bugfix/qa-regression-test-baseline`)함. |
| 5.3 시맨틱 GPU / Vector Worker unreachable | **다음 단계에서 운영환경 진단** | 코드 수정 대상이 아니라 배포/인프라 구성 확인 사항으로 판단. `apps/vector-worker` 서비스의 실제 배포·연결 상태를 다음 인프라 점검 단계에서 확인하기로 함. Semantic 계열 테스트 봇 3종(테스트 봇 - 시맨틱/외부시맨틱-RAG/시맨틱-RAG)은 그때까지 검증 보류. |
| 5.2 만료 편집 잠금 자동 정리 부재 | **별도 경미 버그 수정 후보로 분리** | 이번 라운드 범위에서 제외하고 독립적인 버그 수정 작업으로 분리하기로 함. |
| AIDOT-06(패키지 다운로드/업로드 왕복), HUB-07(봇 삭제), 실제 재학습 실행 | **보류** | 전용 테스트 환경 구성과 사용자 승인 전까지 실행하지 않음. 운영 데이터가 있는 계정에서 파괴적 동작을 수행하는 항목이므로, 별도 테스트 배포가 준비된 뒤 재개하기로 함. |
