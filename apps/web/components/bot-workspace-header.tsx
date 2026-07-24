"use client";

import { useI18n } from "@/components/language-provider";
import { ManualMainHeaderActions, ManualMainVersionSelect } from "@/components/manual-main-version-select";
import { NluTrainingButton } from "@/components/nlu-training-button";
import { SummaryStatGrid, type SummaryStatItem } from "@/components/summary-stat-grid";
import { ANSWER_MODE_OPTIONS, normalizeAnswerMode } from "@/lib/answer-options";
import { formatKoreanDateTime } from "@/lib/date-time";
import { translateAiOptionText } from "@/lib/i18n/ai-options";
import { TRAINING_CATALOGS, type TrainingCatalog } from "@/lib/i18n/training";
import type { SupportedLanguage } from "@/lib/language";
import { getNluModelLabel, getNluTypeLabel } from "@/lib/nlu-options";
import type { StudioBotApiItem, StudioBotVersionApiItem } from "@/lib/studio-bots-api";
import { normalizeVersionDocument } from "@/lib/version-document";

type BotWorkspaceHeaderProps = {
  bot: StudioBotApiItem;
  botId: string;
  currentVersionId: string;
  fallbackVersionNo: number;
  version: StudioBotVersionApiItem;
  versions: StudioBotVersionApiItem[];
  summaryCards: SummaryStatItem[];
  compact?: boolean;
  hideSummary?: boolean;
  className?: string;
  disabledReason?: string;
  onError: (message: string) => void;
  onTrained: () => void;
};

function botTypeLabel(copy: TrainingCatalog, bot?: StudioBotApiItem | null) {
  if (bot?.data_json?.bot_kind === "hub") {
    return copy.botHub;
  }
  if (bot?.data_json?.bot_mode === "voice") {
    return copy.voiceType;
  }
  return copy.textType;
}

function getVersionAiConfig(version?: StudioBotVersionApiItem | null, bot?: StudioBotApiItem | null) {
  const document = normalizeVersionDocument(version?.version_json);
  const snapshotConfig = version?.system_config;
  const versionConfig =
    snapshotConfig && typeof snapshotConfig === "object" && !Array.isArray(snapshotConfig)
      ? snapshotConfig.ai_config
      : document.system_config?.ai_config;
  const safeVersionConfig =
    versionConfig && typeof versionConfig === "object" && !Array.isArray(versionConfig)
      ? versionConfig
      : {};
  return {
    ...(bot?.data_json ?? {}),
    ...safeVersionConfig,
  } as Record<string, unknown>;
}

function getAnswerModeLabel(value: string | null | undefined) {
  const normalized = normalizeAnswerMode(value);
  return ANSWER_MODE_OPTIONS.find((option) => option.value === normalized)?.label ?? "정해진 답변";
}

function getEngineSummary(
  version: StudioBotVersionApiItem,
  bot: StudioBotApiItem,
  uiLanguage: SupportedLanguage,
  copy: TrainingCatalog,
) {
  const aiConfig = getVersionAiConfig(version, bot);
  const nluType = typeof aiConfig.nlu_type === "string" ? aiConfig.nlu_type : undefined;
  const nluModel = typeof aiConfig.nlu_model === "string" ? aiConfig.nlu_model : undefined;
  const answerMode = typeof aiConfig.answer_mode === "string" ? aiConfig.answer_mode : undefined;
  return `${translateAiOptionText(uiLanguage, getNluTypeLabel(nluType))} · ${translateAiOptionText(uiLanguage, getNluModelLabel(nluType, nluModel))} / ${copy.answer}: ${translateAiOptionText(uiLanguage, getAnswerModeLabel(answerMode))}`;
}

function getTrainingStatusText(version: StudioBotVersionApiItem, copy: TrainingCatalog) {
  const training = version.nlu_training ?? {};
  const trainedAt = formatKoreanDateTime(training.trained_at);
  const trainedBy =
    typeof training.trained_by_login_id === "string" && training.trained_by_login_id.trim()
      ? training.trained_by_login_id.trim()
      : typeof training.trained_by === "string" && training.trained_by.trim()
        ? training.trained_by.trim()
        : "";

  if (version.is_trained || training.status === "success" || trainedAt) {
    return [copy.trained, trainedAt, trainedBy].filter(Boolean).join(" ");
  }

  return copy.untrained;
}

export function BotWorkspaceHeader({
  bot,
  botId,
  currentVersionId,
  fallbackVersionNo,
  version,
  versions,
  summaryCards,
  compact = false,
  hideSummary = false,
  className = "",
  disabledReason,
  onError,
  onTrained,
}: BotWorkspaceHeaderProps) {
  const { language: uiLanguage } = useI18n();
  const copy = TRAINING_CATALOGS[uiLanguage];
  const headerClassName = ["manual-main__top", className].filter(Boolean).join(" ");
  const trainingStatusText = getTrainingStatusText(version, copy);
  const aiConfig = getVersionAiConfig(version, bot);

  return (
    <header className={headerClassName}>
      <div className="manual-main__profile">
        <div className="manual-main__avatar" aria-hidden="true">
          <span className="manual-main__avatar-face">
            <span />
            <span />
          </span>
        </div>

        <div className="manual-main__meta">
          <div className="manual-main__title-row">
            <h1>{bot.name}</h1>
            <ManualMainVersionSelect
              botId={botId}
              currentVersionId={currentVersionId}
              fallbackVersionNo={fallbackVersionNo}
              versions={versions}
            />
            <span className="manual-main__status">{botTypeLabel(copy, bot)}</span>
            {compact ? null : (
              <ManualMainHeaderActions
                botId={botId}
                currentVersionId={currentVersionId}
                onError={onError}
              />
            )}
          </div>

          <p className="manual-main__subtext manual-main__engine-meta">{getEngineSummary(version, bot, uiLanguage, copy)}</p>
          {compact ? null : (
            <div className="manual-main__meta-row">
              <NluTrainingButton
                aiConfig={aiConfig}
                botId={bot.id}
                versionId={version.id}
                statusText={trainingStatusText}
                disabledReason={disabledReason}
                onTrained={onTrained}
              />
            </div>
          )}
        </div>
      </div>

      {compact || hideSummary ? null : (
        <SummaryStatGrid items={summaryCards} />
      )}
    </header>
  );
}
