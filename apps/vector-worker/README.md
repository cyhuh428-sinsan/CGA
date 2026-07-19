# Aidot Vector Worker

Aidot 본체와 분리해서 의도/답변용 Vector DB를 생성하고 검색하는 별도 프로그램입니다.

## 역할

- Intent Vector DB: Semantic Engine NLU용 의도 학습문장 검색
- Answer Vector DB: RAG 답변용 지식 문서 검색

Aidot 본체는 이 Worker의 검색 API URL만 저장하고 호출합니다.

## 실행

```powershell
cd D:\Project\Aidot\apps\vector-worker
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8350
```

## Aidot 설정값

봇 설정의 `Intent Vector DB 연결`에 아래처럼 입력합니다.

- 사용 여부: 사용
- 검색 API URL: `http://localhost:8350/intent/search`
- Index 이름: `aidot-intent`
- API Key: 선택

## API

### Health

```http
GET /health
```

### Intent Index 생성/갱신

```http
POST /intent/index
Content-Type: application/json

{
  "botId": "bot-1",
  "versionId": "version-1",
  "indexName": "aidot-intent",
  "intents": [
    {
      "intentId": "intent-1",
      "intentName": "암진단비",
      "utterances": ["암 진단비 알려줘", "암 보장 금액"]
    }
  ]
}
```

### Intent 검색

```http
POST /intent/search
Content-Type: application/json

{
  "botId": "bot-1",
  "versionId": "version-1",
  "indexName": "aidot-intent",
  "query": "암 보장 알려줘",
  "topK": 3
}
```

응답:

```json
{
  "matches": [
    {
      "intentId": "intent-1",
      "intentName": "암진단비",
      "score": 0.91,
      "matchedText": "암 진단비 알려줘"
    }
  ]
}
```

## 임베딩 모델

`AIDOT_VECTOR_EMBEDDING_PROVIDER`와 `AIDOT_VECTOR_EMBEDDING_MODEL`이 없으면 설치 부담이 작은
로컬 해시 임베딩(`aidot_vector_worker / semantic_engine_default`)을 사용합니다.

두 환경변수를 설정하면 해당 Vector Worker를 사용하는 모든 Semantic 의도 인덱싱과 검색에 같은 엔진이 적용됩니다.
`sentence-transformers`를 사용하는 경우는 다음과 같습니다.

```powershell
$env:AIDOT_VECTOR_EMBEDDING_PROVIDER="sentence_transformers"
$env:AIDOT_VECTOR_EMBEDDING_MODEL="jhgan/ko-sroberta-multitask"
```

Ollama에 올린 임베딩 모델을 사용할 때는 Aidot Vector Worker 컨테이너에서 접근 가능한 base URL을 사용합니다.

```powershell
ollama serve
ollama pull bge-m3:latest

$env:AIDOT_VECTOR_EMBEDDING_PROVIDER="ollama"
$env:AIDOT_VECTOR_EMBEDDING_MODEL="bge-m3:latest"
$env:AIDOT_OLLAMA_BASE_URL="http://192.168.220.180:11434"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8350
```

`AIDOT_OLLAMA_BASE_URL`은 기본 주소만 입력합니다. 예: `http://192.168.220.180:11434`
`docker-compose.prod.yml`은 Linux Docker에서도 `host.docker.internal`을 호스트 게이트웨이로 연결하므로,
호스트에서 실행 중인 Ollama는 `http://host.docker.internal:11434`로 설정할 수 있습니다.
LLM 호출은 `/api/chat`을 우선 사용하고, 필요하면 `/api/generate`로 대체 호출합니다.

권장 후보:

- `bge-m3:latest`
- `koill/sentence-transformers:all-minilm-l12-v2`
- `nomic-embed-text:latest`
- `paraphrase-multilingual:latest`
- `yxchia/paraphrase-multilingual-minilm-l12-v2:Q4_K_M`
- `qwen3-embedding:4b`
- `qwen3-embedding:8b`

임베딩 provider 또는 model을 변경하면 기존 벡터와 새 벡터의 차원·의미 공간이 달라질 수 있습니다.
변경 후에는 이 Vector Worker를 사용하는 모든 Semantic 봇을 다시 학습하여 의도 인덱스를 재생성해야 합니다.
