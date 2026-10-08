# CGA × Laya NLU 연동 변경 정리

작성 기준: 브랜치 `laya-nlu-integration` (미푸시), 변경 14개 파일, +485 / -3.

이 문서는 Laya 의도분류 엔진을 CGA의 NLU 유형(`nlu_type = "laya"`)으로 추가하면서 바뀐 부분과 그 이유를 정리합니다.

## 1. 설계 요약

- Laya는 CGA 내부 라이브러리가 아니라 별도 HTTP 서비스(`laya-serve`)로 띄웁니다. CGA API는 `POST /v1/systemone`으로만 호출합니다.
- CPU/GPU 선택은 Docker Compose 프로필로 합니다. `COMPOSE_PROFILES=laya-cpu` 또는 `laya-gpu`.
- `laya` NLU는 "정해진 답변(fixed)" 답변 방식에서만 사용합니다. 다른 답변 방식과의 조합은 런타임과 웹 UI 양쪽에서 막습니다.
- 학습은 Laya 쪽 체크포인트를 사용하므로 CGA에서 별도 학습 작업을 돌리지 않고, 의도 목록 검증과 평가 메타데이터 기록만 합니다.

## 2. 파일별 변경

### 백엔드 (apps/api)

`apps/api/app/core/config.py` (+5)
- `laya_serve_base_url` (기본 빈 값), `laya_serve_api_key`, `laya_serve_model_name` (기본 `intent`), `laya_serve_timeout_seconds` (기본 5.0)을 추가했습니다.
- 이유: 엔드포인트와 인증 정보를 환경변수로 받기 위함입니다. 기존 설정 값은 건드리지 않았습니다.

`apps/api/app/schemas/bot.py` (+1 / -1 수준)
- `NluType`에 `"laya"`를 추가하고, `NluModel`에 `"laya_intent"`를 추가했습니다.
- `MODELS_BY_NLU_TYPE["laya"] = {"laya_intent"}`를 추가했습니다.
- 이유: API 입력 검증에서 새 유형을 허용하기 위함입니다.

`apps/api/app/services/laya_nlu.py` (신규, 118줄)
- `build_intent_criteria(dialogs)`: 의도(dialog) 목록을 `{키: "이름 (예: 발화1 / 발화2 / 발화3)"}` 형태의 criteria로 만듭니다. 예시 발화는 최대 3개만 씁니다.
- `classify_intent_with_laya(query, criteria)`: `/v1/systemone`에 choice 질문을 보내고 확률 순으로 정렬한 결과를 돌려줍니다. Bearer 키가 있으면 헤더에 넣습니다.
- `LayaNluError`: 연결 실패, HTTP 오류, 응답 형식 오류를 하나의 예외로 감쌉니다. 호출하는 쪽은 이 예외만 잡으면 됩니다.
- 의도가 1개뿐이면 서버를 호출하지 않고 확률 1.0으로 바로 반환합니다.
- HTTP는 기존 의존성과 맞추기 위해 `urllib.request`를 씁니다. 새 패키지를 추가하지 않았습니다.

`apps/api/app/services/bot_ai_policy.py` (+10 / -1 수준)
- `runtime_block_reason`: `laya`이면 답변 방식이 `fixed`인지 확인하고, `LAYA_SERVE_BASE_URL`이 없으면 차단 사유를 돌려줍니다.
- `training_block_reason`: `llm`과 같이 `laya`도 별도 학습 차단 대상에서 뺍니다.
- 이유: 정책 판단을 한 곳에서 유지하기 위함입니다.

`apps/api/app/api/routes/webchat.py` (+22)
- `_laya_select_dialog(document, message)`를 추가하고, `nlu_type == "laya"` 분기를 `llm` 분기 뒤에 넣었습니다.
- 분류 결과의 1순위 키로 기존 `_dialog_by_id_or_name`을 호출해 의도를 고릅니다.

`apps/api/app/api/routes/channels.py` (+22)
- 웹챗과 같은 분기를 채널 런타임에 추가했습니다. 실패 시 `channel.laya_nlu.classification_failed` 로그를 남깁니다.
- 기존 cutoff 처리 방식(`with_cutoff`)을 그대로 따릅니다.

`apps/api/app/api/routes/bots.py` (+58)
- 학습 API에 `laya` 전용 분기를 추가했습니다. 이 분기가 없으면 `laya` 봇이 딥러닝 Lite 학습 경로로 빠집니다. 이 문제를 검토하면서 추가했습니다.
- 의도가 1개 이상 있어야 합니다. 없으면 HTTP 400을 돌려줍니다.
- `system_config["nlu_evaluation"]`에 엔진 종류, 모델명, 학습 시각, 의도 수, 발화 수를 기록합니다. 감사 로그 `bot.version.nlu.train`도 남깁니다.
- 기존 SEMANTIC/ML 학습 분기는 변경하지 않았습니다.

`apps/api/tests/test_laya_nlu.py` (신규, 92줄, 6개 테스트)
- criteria 생성, 요청 본문 형식, 확률 순 정렬, 설정 누락 시 오류, HTTP 오류 감싸기, 의도 1개 단축 경로를 검증합니다.

`apps/api/tests/test_laya_compose_profiles.py` (신규, 32줄, 3개 테스트)
- `docker-compose.yml`에 laya-cpu/laya-gpu 서비스와 api의 환경변수가 들어갔는지 확인합니다.

### 웹 (apps/web)

`apps/web/lib/nlu-options.ts` (+13 / -1 수준)
- `NluType`에 `"laya"`, `NluModelKey`에 `"laya_intent"`를 추가했습니다.
- `NLU_TYPE_OPTIONS`에 Laya 항목을, `NLU_MODEL_OPTIONS_BY_TYPE`에 `laya` 키를 추가했습니다. `Record<NluType, ...>` 타입이 모든 유형을 요구하므로 이 항목이 없으면 타입 오류가 납니다.
- 단독 타입 검사(`tsc --strict`)를 통과했습니다.

`apps/web/lib/bot-ai-combinations.ts` (+3)
- `laya` + `fixed`는 "실행/학습 가능", 그 외 답변 방식은 "사용 못함"으로 표시합니다. 백엔드 정책과 맞춘 것입니다.

`apps/web/lib/nlu/index.ts` (+3)
- `inferNluTypeFromModel`에서 모델 이름에 `laya`가 있으면 `laya`로 판단하도록 가장 먼저 검사합니다.

### 설정/배포

`docker-compose.yml` (+97)
- `laya-cpu` 서비스: `services/laya`를 CPU 토치로 빌드합니다. `profiles: ["laya-cpu"]`, 내부 네트워크 `cga_internal`의 별칭 `laya-serve`, 체크포인트는 `${LAYA_INTENT_MODEL_DIR}`를 읽기 전용으로 마운트합니다. `HF_HUB_OFFLINE=1`로 외부 다운로드를 막습니다.
- `laya-gpu` 서비스: `profiles: ["laya-gpu"]`, `TORCH_INDEX`는 기본 `cu130`, GPU는 `${LAYA_GPU_ID:-0}`로 지정합니다.
- `api` 서비스: `LAYA_SERVE_BASE_URL=${CGA_LAYA_SERVE_BASE_URL:-}`, `LAYA_SERVE_API_KEY=${LAYA_API_KEY:-}`를 추가했습니다. 프로필을 켜지 않으면 두 값은 비어 있고, 이 경우 laya 봇은 런타임에서 차단됩니다.
- 기존 서비스(api, nlu-training-worker, redis, studio, vector-worker)의 설정은 바꾸지 않았습니다.

`.env.example` (+9)
- Laya 블록을 주석으로 추가했습니다. `COMPOSE_PROFILES`로 CPU/GPU를 고르고, `CGA_LAYA_SERVE_BASE_URL`, `LAYA_INTENT_MODEL_DIR`, `LAYA_API_KEY`, `LAYA_TORCH_INDEX`, `LAYA_GPU_ID`를 안내합니다.

## 3. 기존 동작에 미치는 영향

- `nlu_type`이 `laya`가 아니면 모든 분기는 이전과 같습니다. 새 분기는 `laya` 조건에서만 실행됩니다.
- `NluType` 리터럴과 `Record<NluType, ...>`이 늘어나므로, 새 유형을 처리하지 않는 코드가 있다면 타입 검사에서 드러납니다. 웹 쪽은 exhaustive switch가 없어서 추가 수정이 필요하지 않았습니다.
- `docker compose up`을 프로필 없이 실행하면 laya 서비스는 기동되지 않습니다. 기존 배포 동작은 바뀌지 않습니다.

## 4. 테스트 결과

- 백엔드 전체: 704 통과, 6 건너뜀, 2 실패.
- 실패 2건(`tests/test_nlu_engine.py`의 deep_learning_lite 관련 2개)은 기존 기준 커밋에서도 실패하는 것을 확인했습니다. 이번 변경과 무관합니다.
- Laya 관련 테스트 9개와 bot schema, channel runtime, deployment contract 테스트는 모두 통과했습니다.
- 웹: `nlu-options.ts`를 단독으로 `tsc --strict` 검사해 통과했습니다. 전체 웹 빌드는 `node_modules`가 없어 실행하지 않았습니다.

## 5. 아직 검증되지 않은 것

- 실제 `laya-serve`에 학습된 체크포인트를 올린 상태에서 `/health`와 `/v1/systemone` 응답을 확인하지 않았습니다. 샌드박스에는 Docker가 없습니다.
- `LAYA_EXTRA_MODELS`로 체크포인트를 등록하는 경로와 `HF_HUB_OFFLINE` 동작은 서버에서 확인해야 합니다.
- 학습 데이터의 의도 목록(13개)과 CGA 봇의 의도 이름이 일치하는지 확인해야 합니다. 맞지 않으면 CGA 의도 목록 기준으로 재학습이 필요합니다.
- 의도 기준(criteria)과 긴급도 기준은 업무 담당자 승인 전까지 초안입니다.

## 6. 다음 단계

- 서버에서 `COMPOSE_PROFILES=laya-cpu`로 기동해 `/health`를 확인합니다.
- 웹에서 Laya 봇을 만들고 정해진 답변 방식으로 웹챗 테스트를 진행합니다.
- 테스트가 끝나면 커밋하고 푸시 여부를 결정합니다. 푸시는 신산님 승인 후 진행합니다.
