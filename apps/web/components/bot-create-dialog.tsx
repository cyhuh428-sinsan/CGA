"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";

import {
  ANSWER_MODE_OPTIONS,
  DEFAULT_ANSWER_MODE,
  type AnswerMode,
} from "@/lib/answer-options";
import { loadAuthSession } from "@/lib/auth";
import { buildBotAiCombinationRows, selectedBotAiCombination } from "@/lib/bot-ai-combinations";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  defaultLlmModelForProvider,
  LLM_MODEL_OPTIONS_BY_PROVIDER,
  LLM_PROVIDER_OPTIONS,
  type LlmModelKey,
  type LlmProvider,
} from "@/lib/llm-options";
import {
  defaultNluModelForType,
  getNluModelDescription,
  isSemanticNluType,
  NLU_MODEL_OPTIONS_BY_TYPE,
  NLU_TYPE_OPTIONS,
  type NluModelKey,
  type NluType,
} from "@/lib/nlu-options";
import { createStudioBot } from "@/lib/studio-bots-api";
import { type VectorConnectionConfig, type VectorConnectionsConfig } from "@/lib/bot-settings";

const PROFILE_OPTIONS = [
  { key: "gray" as const, className: "bot-create-dialog__profile--muted" },
  { key: "accent" as const, className: "bot-create-dialog__profile--active" },
  { key: "outline" as const, className: "bot-create-dialog__profile--outline" },
];

const BOT_NAME_MAX_LENGTH = 40;
const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const BOT_NAME_PATTERN = /^[가-힣a-zA-Z0-9\s\-()_.]+$/;
const INTERNAL_INTENT_INDEX_NAME = "aidot-intent";
const INTERNAL_ANSWER_INDEX_NAME = "aidot-answer";

function defaultVectorConnections(): VectorConnectionsConfig {
  return {
    intent: {
      enabled: false,
      endpoint_url: "",
      index_name: "",
      api_key: "",
    },
    answer: {
      enabled: false,
      endpoint_url: "",
      index_name: "",
      api_key: "",
    },
  };
}

function normalizeVectorConnection(value?: Partial<VectorConnectionConfig> | null): VectorConnectionConfig {
  return {
    enabled: value?.enabled === true,
    endpoint_url: value?.endpoint_url ?? "",
    index_name: value?.index_name ?? "",
    api_key: value?.api_key ?? "",
  };
}

function internalVectorConnection(kind: "intent" | "answer", enabled = true): VectorConnectionConfig {
  return {
    enabled,
    endpoint_url: "",
    index_name: kind === "intent" ? INTERNAL_INTENT_INDEX_NAME : INTERNAL_ANSWER_INDEX_NAME,
    api_key: "",
  };
}

export function BotCreateDialog() {
  const router = useRouter();
  const [botKind, setBotKind] = useState<"bot" | "hub">("bot");
  const [botMode, setBotMode] = useState<"text" | "voice">("text");
  const [hubCallMethod, setHubCallMethod] = useState<"button" | "natural">("button");
  const [profileKey, setProfileKey] = useState<"gray" | "accent" | "outline">("accent");
  const [profileImageData, setProfileImageData] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<"ko">("ko");
  const [nluType, setNluType] = useState<NluType>("ml");
  const [nluModel, setNluModel] = useState<NluModelKey>("deep_learning_lite");
  const [answerMode, setAnswerMode] = useState<AnswerMode>(DEFAULT_ANSWER_MODE);
  const [llmProvider, setLlmProvider] = useState<LlmProvider>(DEFAULT_LLM_PROVIDER);
  const [llmModel, setLlmModel] = useState<LlmModelKey>(DEFAULT_LLM_MODEL);
  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [vectorConnections, setVectorConnections] = useState<VectorConnectionsConfig>(defaultVectorConnections());
  const [introduction, setIntroduction] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nluModelOptions = NLU_MODEL_OPTIONS_BY_TYPE[nluType] ?? [];
  const nluModelDescription = getNluModelDescription(nluType, nluModel);
  const llmModelOptions = LLM_MODEL_OPTIONS_BY_PROVIDER[llmProvider];
  const aiCombinationRows = buildBotAiCombinationRows();
  const selectedCombination = selectedBotAiCombination(nluType, nluModel, answerMode);
  const usesLlmEngine = nluType === "llm" || answerMode === "llm_rag" || answerMode === "llm";
  const usesSemanticNlu = isSemanticNluType(nluType);
  const usesSemanticAnswer = answerMode === "semantic_rag";

  function selectCombination(nextType: NluType, nextAnswerMode: AnswerMode) {
    setNluType(nextType);
    setNluModel(defaultNluModelForType(nextType));
    setAnswerMode(nextAnswerMode);
    setVectorConnections((current) => ({
      intent: nextType === "semantic_vector"
        ? internalVectorConnection("intent")
        : normalizeVectorConnection(current.intent),
      answer: nextAnswerMode === "semantic_rag"
        ? internalVectorConnection("answer")
        : normalizeVectorConnection(current.answer),
    }));
  }

  function handleProfileImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!PROFILE_IMAGE_TYPES.has(file.type)) {
      setErrorMessage("프로필 이미지는 PNG, JPEG 또는 WEBP 파일만 사용할 수 있습니다.");
      return;
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      setErrorMessage("프로필 이미지는 2MB 이하만 사용할 수 있습니다.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileImageData(reader.result);
        setErrorMessage("");
      }
    };
    reader.onerror = () => setErrorMessage("프로필 이미지를 읽지 못했습니다.");
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    const session = loadAuthSession();
    if (!session) {
      setErrorMessage("로그인이 필요합니다.");
      return;
    }

    if (!name.trim()) {
      setErrorMessage("봇 이름을 입력해주세요.");
      return;
    }

    if (!BOT_NAME_PATTERN.test(name.trim())) {
      setErrorMessage("봇 이름은 한글/영문/숫자/공백/특수문자(-, (), _, .)만 입력할 수 있습니다.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const sharedPayload = {
        name: name.trim(),
        description: introduction.trim() || undefined,
        bot_kind: botKind,
        bot_mode: botKind === "hub" ? "text" : botMode,
        profile_key: profileKey,
        profile_image_data: profileImageData || undefined,
        language,
        introduction: introduction.trim() || undefined,
        hub_call_method: botKind === "hub" ? hubCallMethod : undefined,
      };
      const createdBot = await createStudioBot(
        session.access_token,
        botKind === "hub"
          ? sharedPayload
          : {
              ...sharedPayload,
              nlu_engine: nluModel,
              nlu_type: nluType,
              nlu_model: nluModel,
              answer_mode: answerMode,
              llm_provider: llmProvider,
              llm_model: llmModel,
              llm_base_url: llmBaseUrl.trim() || undefined,
              vector_connections: vectorConnections,
            },
      );

      if (botKind === "hub") {
        router.push(`/studio/hubs/${createdBot.id}`);
        return;
      }

      router.push(`/studio/bots/${createdBot.id}/versions/${createdBot.active_version?.name ?? "v1"}/intents`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "봇 생성 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bot-create-dialog cga-bot-create-page">
      <div className="bot-create-dialog__header">
        <div className="cga-bot-create-page__heading">
          <span>01</span>
          <strong>봇 생성</strong>
          <button type="button" title="봇 생성 정보를 확인합니다." aria-label="봇 생성 정보">i</button>
        </div>
        <Link href="/studio/bots" className="cga-bot-create-page__version-link">버전 관리</Link>
        <span className="cga-bot-create-page__current">+ 봇 생성</span>
      </div>

      <div className="bot-create-dialog__body">
        <div className="cga-bot-create-page__section-title cga-bot-create-page__section-title--basic">기본 정보 <span>i</span></div>
        <div className="cga-bot-create-page__section-title cga-bot-create-page__section-title--ai">AI 생성 항목 <span>i</span></div>
        <aside className="cga-bot-create-page__summary">
          <header><strong>구조 요약</strong><span>선택 상태</span></header>
          <dl>
            <div><dt>언어</dt><dd>{language}</dd></div>
            <div><dt>NLU 방식</dt><dd>{nluType}</dd></div>
            <div><dt>NLU 모델</dt><dd>{nluModel}</dd></div>
            <div><dt>답변 방식</dt><dd>{answerMode}</dd></div>
            <div><dt>LLM</dt><dd>{usesLlmEngine ? llmModel : "-"}</dd></div>
            <div><dt>버전</dt><dd>v1</dd></div>
          </dl>
          <p>Next: configure using the selected input structure.</p>
        </aside>
        <div className="bot-create-dialog__field cga-bot-create-page__field--type">
          <span className="bot-create-dialog__label">봇 유형 <em>*</em></span>
          <div className="bot-create-dialog__type-row">
            <label className="bot-create-dialog__radio">
              <input
                type="radio"
                name="bot-kind"
                checked={botKind === "bot"}
                onChange={() => setBotKind("bot")}
              />
              <span>봇</span>
            </label>
            <div className="bot-create-dialog__switch">
              <button
                type="button"
                className={botMode === "text" && botKind === "bot" ? "is-active" : ""}
                onClick={() => setBotMode("text")}
                disabled={botKind === "hub"}
              >
                텍스트형
              </button>
              <button
                type="button"
                className={botMode === "voice" && botKind === "bot" ? "is-active" : ""}
                onClick={() => setBotMode("voice")}
                disabled={botKind === "hub"}
              >
                보이스형
              </button>
            </div>
            <label className="bot-create-dialog__radio">
              <input
                type="radio"
                name="bot-kind"
                checked={botKind === "hub"}
                onChange={() => setBotKind("hub")}
              />
              <span>봇 허브</span>
            </label>
          </div>
        </div>

        <div className="bot-create-dialog__field cga-bot-create-page__field--profile">
          <span className="bot-create-dialog__label">봇 프로필 <em>*</em></span>
          <div className="bot-create-dialog__profile-row">
            {profileImageData ? (
              <img
                className="bot-create-dialog__profile bot-create-dialog__profile-image is-selected"
                src={profileImageData}
                alt="선택한 봇 프로필"
              />
            ) : (
              PROFILE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-label={"기본 프로필 " + option.key}
                  className={option.className + (profileKey === option.key ? " is-selected" : "") + " bot-create-dialog__profile"}
                  onClick={() => setProfileKey(option.key)}
                />
              ))
            )}
            <label className="bot-create-dialog__profile-upload">
              PC 이미지 선택
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleProfileImageChange}
              />
            </label>
            {profileImageData ? (
              <button
                type="button"
                className="bot-create-dialog__profile-reset"
                onClick={() => setProfileImageData(null)}
              >
                기본 프로필 사용
              </button>
            ) : null}
          </div>
          <small>PNG, JPEG, WEBP · 2MB 이하</small>
        </div>

        <div className="bot-create-dialog__field cga-bot-create-page__field--name">
          <span className="bot-create-dialog__label">봇 이름 <em>*</em></span>
          <input
            type="text"
            className="bot-create-dialog__input"
            placeholder="봇의 이름을 입력하세요."
            value={name}
            maxLength={BOT_NAME_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
          />
          <small>
            한글/영문/숫자/공백/특수문자(-, (){};:) 으로만 입력
            <span>{name.length}/{BOT_NAME_MAX_LENGTH}</span>
          </small>
        </div>

        <div className="bot-create-dialog__field cga-bot-create-page__field--language">
          <span className="bot-create-dialog__label">언어 <em>*</em></span>
          <select
            className="bot-create-dialog__select"
            value={language}
            onChange={(event) => setLanguage(event.target.value as "ko")}
          >
            <option value="ko">한국어</option>
          </select>
        </div>

        {botKind === "hub" ? (
          <div className="bot-create-dialog__field cga-bot-create-page__field--hub-call">
            <span className="bot-create-dialog__label">호출 방식 <em>*</em></span>
            <select
              className="bot-create-dialog__select"
              value={hubCallMethod}
              onChange={(event) => setHubCallMethod(event.target.value as "button" | "natural")}
            >
              <option value="button">버튼 선택형</option>
              <option value="natural">자연어 입력형</option>
            </select>
          </div>
        ) : null}

        {botKind === "bot" ? (
          <>
        <div className="bot-create-dialog__field cga-bot-create-page__field--nlu-type">
          <span className="bot-create-dialog__label">NLU 방식 <em>*</em></span>
          <select
            className="bot-create-dialog__select"
            value={nluType}
            onChange={(event) => {
              const nextType = event.target.value as NluType;
              setNluType(nextType);
              setNluModel(defaultNluModelForType(nextType));
              setVectorConnections((current) => ({
                ...current,
                intent: nextType === "semantic_vector"
                  ? internalVectorConnection("intent")
                  : normalizeVectorConnection(current.intent),
              }));
            }}
          >
            {NLU_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label} ({option.note})
              </option>
            ))}
          </select>
        </div>

        {nluType !== "llm" ? (
          <div className="bot-create-dialog__field cga-bot-create-page__field--nlu-model">
            <span className="bot-create-dialog__label">NLU 모델 <em>*</em></span>
            <select
              className="bot-create-dialog__select"
              value={nluModel}
              onChange={(event) => setNluModel(event.target.value as NluModelKey)}
            >
              {nluModelOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label} ({option.note})
                </option>
              ))}
            </select>
            {nluModelDescription ? (
              <small>{nluModelDescription}</small>
            ) : null}
          </div>
        ) : null}

        <div className="bot-create-dialog__field cga-bot-create-page__field--answer-mode">
          <span className="bot-create-dialog__label">답변 방식 <em>*</em></span>
          <select
            className="bot-create-dialog__select"
            value={answerMode}
            onChange={(event) => {
              const nextAnswerMode = event.target.value as AnswerMode;
              setAnswerMode(nextAnswerMode);
              setVectorConnections((current) => ({
                ...current,
                answer: nextAnswerMode === "semantic_rag"
                  ? internalVectorConnection("answer")
                  : normalizeVectorConnection(current.answer),
              }));
            }}
          >
            {ANSWER_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label} ({option.note})
              </option>
            ))}
          </select>
        </div>

        {usesLlmEngine ? (
          <>
            <div className="bot-create-dialog__field cga-bot-create-page__field--llm-provider">
              <span className="bot-create-dialog__label">LLM Provider <em>*</em></span>
              <select
                className="bot-create-dialog__select"
                value={llmProvider}
                onChange={(event) => {
                  const nextProvider = event.target.value as LlmProvider;
                  setLlmProvider(nextProvider);
                  setLlmModel(defaultLlmModelForProvider(nextProvider));
                }}
              >
                {LLM_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.note})
                  </option>
                ))}
              </select>
            </div>

            <div className="bot-create-dialog__field cga-bot-create-page__field--llm-model">
              <span className="bot-create-dialog__label">LLM 세부 모델 <em>*</em></span>
              <select
                className="bot-create-dialog__select"
                value={llmModel}
                onChange={(event) => setLlmModel(event.target.value as LlmModelKey)}
              >
                {llmModelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.note})
                  </option>
                ))}
              </select>
            </div>

            {llmProvider === "ollama" ? (
              <div className="bot-create-dialog__field cga-bot-create-page__field--llm-base">
                <span className="bot-create-dialog__label">Ollama 주소</span>
                <input
                  type="url"
                  className="bot-create-dialog__input"
                  placeholder="http://192.168.220.180:11434"
                  value={llmBaseUrl}
                  onChange={(event) => setLlmBaseUrl(event.target.value)}
                />
              </div>
            ) : null}
          </>
        ) : null}

        {usesSemanticNlu ? (
          <div className="bot-create-dialog__field bot-create-dialog__field--vector cga-bot-create-page__field--intent-vector">
            <span className="bot-create-dialog__label">Intent Vector DB 연결</span>
            <small>
              {nluType === "semantic_external"
                ? "외부에서 만든 Vector DB의 검색 API를 연결합니다. 응답 규격과 임베딩 모델 호환이 필요합니다."
                : "Aidot Vector Worker 기본 연결을 사용합니다. 의도 벡터는 Local Vector DB에 저장됩니다."}
            </small>
            <select
              className="bot-create-dialog__select"
              value={vectorConnections.intent?.enabled ? "true" : "false"}
              onChange={(event) =>
                setVectorConnections((current) => ({
                  ...current,
                  intent: {
                    ...normalizeVectorConnection(current.intent),
                    enabled: event.target.value === "true",
                  },
                }))
              }
            >
              <option value="false">미사용</option>
              <option value="true">사용</option>
            </select>
            {nluType === "semantic_external" ? (
              <input
                type="url"
                className="bot-create-dialog__input"
                placeholder="검색 API URL 예: https://vector.example.com/intent/search"
                value={vectorConnections.intent?.endpoint_url ?? ""}
                onChange={(event) =>
                  setVectorConnections((current) => ({
                    ...current,
                    intent: {
                      ...normalizeVectorConnection(current.intent),
                      endpoint_url: event.target.value,
                    },
                  }))
                }
              />
            ) : null}
            <input
              type="text"
              className="bot-create-dialog__input"
              placeholder="Index 이름 예: aidot-intent"
              value={vectorConnections.intent?.index_name ?? ""}
              onChange={(event) =>
                setVectorConnections((current) => ({
                  ...current,
                  intent: {
                    ...normalizeVectorConnection(current.intent),
                    index_name: event.target.value,
                  },
                }))
              }
            />
            {nluType === "semantic_external" ? (
              <input
                type="password"
                className="bot-create-dialog__input"
                placeholder="API Key 선택 입력"
                value={vectorConnections.intent?.api_key ?? ""}
                onChange={(event) =>
                  setVectorConnections((current) => ({
                    ...current,
                    intent: {
                      ...normalizeVectorConnection(current.intent),
                      api_key: event.target.value,
                    },
                  }))
                }
              />
            ) : null}
          </div>
        ) : null}

        {usesSemanticAnswer ? (
          <div className="bot-create-dialog__field bot-create-dialog__field--vector cga-bot-create-page__field--answer-vector">
            <span className="bot-create-dialog__label">Answer Vector DB 연결</span>
            <small>Aidot Vector Worker 기본 연결을 사용합니다. 답변 검색용 지식은 의도 분류와 별도 Answer Vector DB에 저장합니다.</small>
            <select
              className="bot-create-dialog__select"
              value={vectorConnections.answer?.enabled ? "true" : "false"}
              onChange={(event) =>
                setVectorConnections((current) => ({
                  ...current,
                  answer: {
                    ...normalizeVectorConnection(current.answer),
                    enabled: event.target.value === "true",
                  },
                }))
              }
            >
              <option value="false">미사용</option>
              <option value="true">사용</option>
            </select>
            <input
              type="text"
              className="bot-create-dialog__input"
              placeholder="Index 이름 예: aidot-answer"
              value={vectorConnections.answer?.index_name ?? ""}
              onChange={(event) =>
                setVectorConnections((current) => ({
                  ...current,
                  answer: {
                    ...normalizeVectorConnection(current.answer),
                    index_name: event.target.value,
                  },
                }))
              }
            />
          </div>
        ) : null}

          </>
        ) : null}

        <div className="bot-create-dialog__field cga-bot-create-page__field--introduction">
          <span className="bot-create-dialog__label">소개</span>
          <input
            type="text"
            className="bot-create-dialog__input"
            placeholder="봇을 설명할 수 있는 소개 문장을 입력하세요."
            value={introduction}
            onChange={(event) => setIntroduction(event.target.value)}
          />
        </div>

        {botKind === "bot" ? (
          <section className="bot-ai-combinations bot-ai-combinations--compact" aria-label="NLU와 답변 조합 지원 상태">
          <div className="bot-ai-combinations__summary">
            <strong>선택 조합</strong>
            <span>
              {selectedCombination
                ? `의도인식: ${selectedCombination.nluLabel} · ${selectedCombination.nluModelLabel} / 답변: ${selectedCombination.answerLabel}`
                : "선택된 조합을 확인할 수 없습니다."}
            </span>
            {selectedCombination ? (
              <em className={`bot-ai-combinations__badge bot-ai-combinations__badge--${selectedCombination.status}`}>
                {selectedCombination.statusLabel}
              </em>
            ) : null}
          </div>
          <div className="bot-ai-combinations__matrix">
            <div className="bot-ai-combinations__axis bot-ai-combinations__axis--corner">
              <span>의도인식 엔진</span>
              <strong>답변 엔진</strong>
            </div>
            {ANSWER_MODE_OPTIONS.map((option) => (
              <div key={option.value} className="bot-ai-combinations__axis bot-ai-combinations__axis--answer">
                <span>답변 엔진</span>
                <strong>{option.label}</strong>
              </div>
            ))}
            {aiCombinationRows.map((row) => (
              <div key={row.nluType} className="bot-ai-combinations__row">
                <div className="bot-ai-combinations__axis bot-ai-combinations__axis--nlu">
                  <span>의도인식 엔진</span>
                  <strong>{row.nluLabel}</strong>
                  <small>{row.nluModelLabel}</small>
                </div>
                {row.combinations.map((item) => {
                  const selected = item.nluType === nluType && item.answerMode === answerMode;
                  const unsupported = item.status === "unsupported";
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`bot-ai-combinations__item bot-ai-combinations__item--${item.status}${selected ? " is-selected" : ""}`}
                      disabled={unsupported}
                      onClick={() => {
                        if (!unsupported) {
                          selectCombination(item.nluType, item.answerMode);
                        }
                      }}
                      aria-pressed={selected}
                    >
                      <span>조합 상태</span>
                      <strong>{item.statusLabel}</strong>
                      <small>{unsupported ? "사용 불가" : selected ? "현재 선택" : "선택 가능"}</small>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <p>{selectedCombination?.note ?? "현재 선택한 조합의 지원 상태를 확인해주세요."}</p>
        </section>
        ) : null}

        {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}
      </div>

      <div className="bot-create-dialog__footer">
        <Link href="/studio/bots" className="bot-create-dialog__ghost">
          취소
        </Link>
        <button
          type="button"
          className="bot-create-dialog__primary"
          disabled={isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "생성 중..." : "확인"}
        </button>
      </div>
    </div>
  );
}
