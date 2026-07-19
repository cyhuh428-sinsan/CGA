"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ANSWER_MODE_OPTIONS,
  DEFAULT_ANSWER_MODE,
  normalizeAnswerMode,
  type AnswerMode,
} from "@/lib/answer-options";
import {
  isStudioBotVersionTrained,
  type StudioBotApiItem,
  updateStudioBot,
} from "@/lib/studio-bots-api";
import {
  normalizeConfigurationScoring,
  type ConfigurationScoringConfig,
  type StudioBotDataJson,
  type VectorConnectionConfig,
  type VectorConnectionsConfig,
} from "@/lib/bot-settings";
import { buildBotAiCombinationRows, selectedBotAiCombination } from "@/lib/bot-ai-combinations";
import { BotSettingsShell } from "@/components/bot-settings-shell";
import {
  getNluModelLabel,
  getNluModelDescription,
  getNluTypeLabel,
  isSemanticNluType,
  NLU_MODEL_OPTIONS_BY_TYPE,
  normalizeNluModel,
  normalizeNluType,
  type NluModelKey,
  type NluType,
} from "@/lib/nlu-options";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  defaultLlmModelForProvider,
  LLM_MODEL_OPTIONS_BY_PROVIDER,
  LLM_PROVIDER_OPTIONS,
  normalizeLlmModel,
  normalizeLlmProvider,
  type LlmModelKey,
  type LlmProvider,
} from "@/lib/llm-options";

const PROFILE_OPTIONS = [
  { key: "gray" as const, className: "bot-create-dialog__profile--muted" },
  { key: "accent" as const, className: "bot-create-dialog__profile--active" },
  { key: "outline" as const, className: "bot-create-dialog__profile--outline" },
];

const BOT_NAME_MAX_LENGTH = 40;
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

function normalizeVectorConnections(value?: VectorConnectionsConfig | null): VectorConnectionsConfig {
  return {
    intent: normalizeVectorConnection(value?.intent),
    answer: normalizeVectorConnection(value?.answer),
  };
}

function internalVectorConnection(kind: "intent" | "answer", value?: Partial<VectorConnectionConfig> | null): VectorConnectionConfig {
  const current = normalizeVectorConnection(value);
  return {
    enabled: true,
    endpoint_url: "",
    index_name: current.index_name || (kind === "intent" ? INTERNAL_INTENT_INDEX_NAME : INTERNAL_ANSWER_INDEX_NAME),
    api_key: "",
  };
}

function mapBotTypeLabel(bot: {
  data_json?: { bot_kind?: "bot" | "hub"; bot_mode?: "text" | "voice" };
}) {
  if (bot.data_json?.bot_kind === "hub") {
    return "봇 허브";
  }

  if (bot.data_json?.bot_mode === "voice") {
    return "보이스형";
  }

  return "텍스트형";
}

function formatUpdatedAt(value?: string | null) {
  if (!value) {
    return "-";
  }

  return value.replace("T", " ").slice(0, 16).replace(/-/g, ". ");
}

function getSelectedAiConfig(bot: StudioBotApiItem): StudioBotDataJson {
  const botConfig = bot.data_json ?? {};
  const systemConfig = bot.active_version?.version_json?.system_config;
  const aiConfig =
    systemConfig && typeof systemConfig === "object" && "ai_config" in systemConfig
      ? systemConfig.ai_config
      : null;

  if (aiConfig && typeof aiConfig === "object" && !Array.isArray(aiConfig)) {
    return {
      ...botConfig,
      ...(aiConfig as Partial<StudioBotDataJson>),
    };
  }

  return botConfig;
}

type BotEditSectionProps = {
  bot: StudioBotApiItem;
  mainHref: string;
  token: string;
  versionName: string;
  setBot: (bot: StudioBotApiItem) => void;
  setMessage: (value: string) => void;
  setErrorMessage: (value: string) => void;
};

function BotEditSection({
  bot,
  mainHref,
  token,
  versionName,
  setBot,
  setMessage,
  setErrorMessage,
}: BotEditSectionProps) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<"ko">("ko");
  const [nluType, setNluType] = useState<NluType>("ml");
  const [nluModel, setNluModel] = useState<NluModelKey>("deep_learning_lite");
  const [answerMode, setAnswerMode] = useState<AnswerMode>(DEFAULT_ANSWER_MODE);
  const [llmProvider, setLlmProvider] = useState<LlmProvider>(DEFAULT_LLM_PROVIDER);
  const [llmModel, setLlmModel] = useState<LlmModelKey>(DEFAULT_LLM_MODEL);
  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [vectorConnections, setVectorConnections] = useState<VectorConnectionsConfig>(defaultVectorConnections());
  const [configurationScoring, setConfigurationScoring] = useState<ConfigurationScoringConfig>(normalizeConfigurationScoring());
  const [profileKey, setProfileKey] = useState<"gray" | "accent" | "outline">("accent");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const aiConfig = getSelectedAiConfig(bot);
    const nextType = normalizeNluType(aiConfig.nlu_type);
    setName(bot.name);
    setLanguage((aiConfig.language as "ko") ?? "ko");
    setNluType(nextType);
    setNluModel(normalizeNluModel(nextType, aiConfig.nlu_model ?? aiConfig.nlu_engine));
    setAnswerMode(normalizeAnswerMode(aiConfig.answer_mode));
    const nextLlmProvider = normalizeLlmProvider(aiConfig.llm_provider);
    setLlmProvider(nextLlmProvider);
    setLlmModel(normalizeLlmModel(nextLlmProvider, aiConfig.llm_model));
    setLlmBaseUrl(typeof aiConfig.llm_base_url === "string" ? aiConfig.llm_base_url : "");
    setVectorConnections(normalizeVectorConnections(aiConfig.vector_connections));
    setConfigurationScoring(normalizeConfigurationScoring(aiConfig.configuration_scoring));
    setProfileKey((aiConfig.profile_key as "gray" | "accent" | "outline") ?? "accent");
    setDescription(aiConfig.introduction ?? bot.description ?? "");
  }, [bot]);

  const typeLabel = mapBotTypeLabel(bot);
  const llmModelOptions = LLM_MODEL_OPTIONS_BY_PROVIDER[llmProvider];
  const nluModelOptions = NLU_MODEL_OPTIONS_BY_TYPE[nluType] ?? [];
  const nluModelDescription = getNluModelDescription(nluType, nluModel);
  const aiCombinationRows = buildBotAiCombinationRows();
  const selectedCombination = selectedBotAiCombination(nluType, nluModel, answerMode);
  const usesLlmEngine = nluType === "llm" || answerMode === "llm_rag" || answerMode === "llm";
  const usesSemanticNlu = isSemanticNluType(nluType);
  const usesSemanticAnswer = answerMode === "semantic_rag";
  const answerModeLabel = ANSWER_MODE_OPTIONS.find((option) => option.value === answerMode)?.label ?? "정해진 답변";
  const selectedVersionTrained = isStudioBotVersionTrained(bot.active_version);
  const modelLockHint = selectedVersionTrained ? "학습 완료 후 고정" : "학습 전 변경 가능";
  const fixedModeMessage = "언어, NLU 방식, 답변 방식은 봇 생성 시 고정됩니다. 모델은 학습 전까지 변경할 수 있고 학습 완료 후에는 고정됩니다.";

  async function handleSave() {
    if (!token) {
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

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    try {
      const normalizedVectorConnections: VectorConnectionsConfig = {
        intent: nluType === "semantic_vector"
          ? internalVectorConnection("intent", vectorConnections.intent)
          : normalizeVectorConnection(vectorConnections.intent),
        answer: answerMode === "semantic_rag"
          ? internalVectorConnection("answer", vectorConnections.answer)
          : normalizeVectorConnection(vectorConnections.answer),
      };
      const payload = {
        settings_scope: bot.active_version?.id ?? versionName,
        name: name.trim(),
        description: description.trim() || undefined,
        profile_key: profileKey,
        nlu_engine: nluModel,
        nlu_model: nluModel,
        llm_provider: llmProvider,
        llm_model: llmModel,
        llm_base_url: llmBaseUrl.trim() || undefined,
        vector_connections: normalizedVectorConnections,
        configuration_scoring: configurationScoring,
        introduction: description.trim() || undefined,
      };
      const updated = await updateStudioBot(token, bot.id, payload, {
        responseMode: "settings",
        versionScope: versionName,
      });

      setBot(updated);
      setMessage("봇 설정이 저장되었습니다.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "봇 설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
          <div className="bot-settings-page__top-actions">
            <Link href={mainHref} className="secondary-action">
              취소
            </Link>
            <button type="button" className="primary-action" disabled={saving} onClick={handleSave}>
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>

          <section className="bot-settings-section">
            <h2>기본 정보</h2>
            <div className="bot-settings-grid bot-settings-grid--4">
              <label className="bot-settings-card">
                <span>봇 이름 <em>*</em></span>
                <input
                  type="text"
                  className="bot-settings-card__input"
                  maxLength={BOT_NAME_MAX_LENGTH}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <small className="bot-settings-card__hint">
                  한글/영문/숫자/공백/특수문자(-, (){};:) 으로만 입력
                  <span>{name.length}/{BOT_NAME_MAX_LENGTH}</span>
                </small>
              </label>

              <div className="bot-settings-card">
                <span>유형</span>
                <strong>{typeLabel}</strong>
              </div>

              <div className="bot-settings-card">
                <span>봇 ID</span>
                <strong>{bot.id}</strong>
              </div>

              <div className="bot-settings-card">
                <span>최근 수정</span>
                <strong>{formatUpdatedAt(bot.updated_at)}</strong>
              </div>
            </div>
          </section>

          <section className="bot-settings-section">
            <h2>생성 정보</h2>
            <div className="bot-settings-grid bot-settings-grid--5">
              <div className="bot-settings-card">
                <span>언어 <em>*</em></span>
                <strong>{language === "ko" ? "한국어" : language}</strong>
                <small className="bot-settings-card__hint">봇 생성 시 고정</small>
              </div>

              <div className="bot-settings-card">
                <span>NLU 방식</span>
                <strong>{getNluTypeLabel(nluType)}</strong>
                <small className="bot-settings-card__hint">봇 생성 시 고정</small>
              </div>

              {nluType === "semantic_external" ? (
                <label className="bot-settings-card">
                  <span>NLU 모델 <em>*</em></span>
                  <select
                    className="bot-settings-card__select"
                    value={nluModel}
                    disabled={selectedVersionTrained}
                    onChange={(event) => setNluModel(event.target.value as NluModelKey)}
                  >
                    {nluModelOptions.map((option) => (
                      <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label} ({option.note})
                      </option>
                    ))}
                  </select>
                  <small className="bot-settings-card__hint">{selectedVersionTrained ? modelLockHint : (nluModelDescription || modelLockHint)}</small>
                </label>
              ) : (
                <div className="bot-settings-card">
                  <span>NLU 모델 <em>*</em></span>
                  <strong>{getNluModelLabel(nluType, nluModel)}</strong>
                  <small className="bot-settings-card__hint">{modelLockHint}</small>
                </div>
              )}

              <div className="bot-settings-card">
                <span>답변 방식</span>
                <strong>{answerModeLabel}</strong>
                <small className="bot-settings-card__hint">봇 생성 시 고정</small>
              </div>

              <div className="bot-settings-card">
                <span>프로필</span>
                <div className="bot-settings-card__profiles">
                  {PROFILE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`${option.className}${profileKey === option.key ? " is-selected" : ""} bot-create-dialog__profile`}
                      onClick={() => setProfileKey(option.key)}
                      aria-label={`프로필 ${option.key}`}
                    />
                  ))}
                </div>
              </div>

              <div className="bot-settings-card">
                <span>버전 수</span>
                <strong>{bot.version_count}</strong>
              </div>

            </div>

            {usesLlmEngine ? (
              <div className="bot-settings-grid bot-settings-grid--4 bot-settings-grid--llm">
                <label className="bot-settings-card">
                  <span>LLM Provider <em>*</em></span>
                  <select
                    className="bot-settings-card__select"
                    value={llmProvider}
                    disabled={selectedVersionTrained}
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
                </label>

                <label className="bot-settings-card">
                  <span>LLM 세부 모델 <em>*</em></span>
                  <select
                    className="bot-settings-card__select"
                    value={llmModel}
                    disabled={selectedVersionTrained}
                    onChange={(event) => setLlmModel(event.target.value as LlmModelKey)}
                  >
                    {llmModelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} ({option.note})
                      </option>
                    ))}
                  </select>
                  <small className="bot-settings-card__hint">{modelLockHint}</small>
                </label>

                {llmProvider === "ollama" ? (
                  <label className="bot-settings-card">
                    <span>Ollama 주소</span>
                    <input
                      type="url"
                      className="bot-settings-card__input"
                      placeholder="http://192.168.220.180:11434"
                      value={llmBaseUrl}
                      onChange={(event) => setLlmBaseUrl(event.target.value)}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}

            {usesSemanticNlu ? (
              <div className="bot-settings-vector">
                <div className="bot-settings-vector__header">
                  <strong>Intent Vector DB 연결</strong>
                  <span>
                    {nluType === "semantic_external"
                      ? "외부에서 만든 Vector DB의 검색 API를 연결합니다. 응답 규격과 임베딩 모델 호환이 필요합니다."
                      : "Aidot Vector Worker 기본 연결을 사용합니다. 의도 벡터는 Local Vector DB에 저장됩니다."}
                  </span>
                </div>
                <div className="bot-settings-grid bot-settings-grid--4">
                  <label className="bot-settings-card">
                    <span>사용 여부</span>
                    <select
                      className="bot-settings-card__select"
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
                  </label>

                  {nluType === "semantic_external" ? (
                    <label className="bot-settings-card bot-settings-card--wide">
                      <span>검색 API URL</span>
                      <input
                        type="url"
                        className="bot-settings-card__input"
                        placeholder="https://vector.example.com/intent/search"
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
                    </label>
                  ) : null}

                  <label className="bot-settings-card">
                    <span>Index 이름</span>
                    <input
                      type="text"
                      className="bot-settings-card__input"
                      placeholder="aidot-intent"
                      value={vectorConnections.intent?.index_name || (nluType === "semantic_vector" ? INTERNAL_INTENT_INDEX_NAME : "")}
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
                  </label>

                  {nluType === "semantic_external" ? (
                    <label className="bot-settings-card">
                      <span>API Key</span>
                      <input
                        type="password"
                        className="bot-settings-card__input"
                        placeholder="선택 입력"
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
                    </label>
                  ) : null}
                </div>
              </div>
            ) : null}

            {usesSemanticAnswer ? (
              <div className="bot-settings-vector">
                <div className="bot-settings-vector__header">
                  <strong>Answer Vector DB 연결</strong>
                  <span>Aidot Vector Worker 기본 연결을 사용합니다. 답변 검색용 지식은 의도 분류와 별도 Answer Vector DB에 저장합니다.</span>
                </div>
                <div className="bot-settings-grid bot-settings-grid--4">
                  <label className="bot-settings-card">
                    <span>사용 여부</span>
                    <select
                      className="bot-settings-card__select"
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
                  </label>

                  <label className="bot-settings-card">
                    <span>Index 이름</span>
                    <input
                      type="text"
                      className="bot-settings-card__input"
                      placeholder="aidot-answer"
                      value={vectorConnections.answer?.index_name || (answerMode === "semantic_rag" ? INTERNAL_ANSWER_INDEX_NAME : "")}
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
                  </label>

                </div>
              </div>
            ) : null}

            {nluType !== "llm" ? (
              <div className="bot-settings-vector">
                <div className="bot-settings-vector__header">
                  <strong>구성 자동분류 가중치</strong>
                  <span>구성 화면의 의도 후보 분류에서 사전, 개체, 단어, 글자 조각, 조사/어미 반영 비율을 조정합니다.</span>
                </div>
                <div className="bot-settings-grid bot-settings-grid--6">
                  {[
                    ["dictionaryWeight", "사전 대표어"],
                    ["entityWeight", "개체"],
                    ["wordWeight", "명사/동사"],
                    ["gramWeight", "글자 조각"],
                    ["particleEndingWeight", "조사/어미"],
                    ["keyMatchScore", "대표어 일치 최소점수"],
                  ].map(([key, label]) => (
                    <label key={key} className="bot-settings-card">
                      <span>{label}</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={key === "keyMatchScore" ? 1 : 20}
                        className="bot-settings-card__input"
                        value={configurationScoring[key as keyof ConfigurationScoringConfig]}
                        onChange={(event) =>
                          setConfigurationScoring((current) => ({
                            ...current,
                            [key]: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="bot-settings-intro">
              <span>소개</span>
              <textarea
                className="bot-settings-intro__textarea"
                placeholder="봇을 설명할 수 있는 소개 문장을 입력하세요."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <section className="bot-ai-combinations" aria-label="NLU와 답변 조합 지원 상태">
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
              <p className="bot-ai-combinations__lock">{fixedModeMessage}</p>
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
                      return (
                        <button
                          type="button"
                          key={item.id}
                          className={`bot-ai-combinations__item bot-ai-combinations__item--${item.status}${selected ? " is-selected" : ""}`}
                          disabled={!selected}
                          aria-pressed={selected}
                        >
                          <span>조합 상태</span>
                          <strong>{item.statusLabel}</strong>
                          <small>{item.status === "unsupported" ? "사용 불가" : selected ? "현재 선택" : "학습 후 고정"}</small>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p>{selectedCombination?.note ?? "현재 선택한 조합의 지원 상태를 확인해주세요."}</p>
            </section>
          </section>

    </>
  );
}

export function BotSettingsPage() {
  return (
    <BotSettingsShell activeMenu="edit">
      {(args) => <BotEditSection {...args} />}
    </BotSettingsShell>
  );
}
