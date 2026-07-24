"use client";

import { useState } from "react";

import { useI18n } from "@/components/language-provider";
import { loadAuthSession } from "@/lib/auth";
import { formatKoreanDateTime } from "@/lib/date-time";
import { TRAINING_CATALOGS, type TrainingCatalog } from "@/lib/i18n/training";
import {
  trainStudioBotVersionNlu,
  type NluModelManifest,
} from "@/lib/studio-bots-api";

type NluTrainingButtonProps = {
  aiConfig?: Record<string, unknown>;
  botId?: string | null;
  versionId?: string | null;
  statusText?: string;
  disabledReason?: string;
  onTrained?: (manifest: NluModelManifest) => void;
};

function formatTrainingResult(manifest: NluModelManifest, copy: TrainingCatalog) {
  const counts = manifest.model?.counts;
  const trainedAt = formatKoreanDateTime(manifest.model?.trained_at);
  const prefix = trainedAt ? `${copy.completedAt} ${trainedAt}` : copy.completed;
  const answerDocumentCount = manifest.answer_training?.document_count;
  const answerPart =
    typeof answerDocumentCount === "number" ? ` / ${copy.answerDocuments} ${answerDocumentCount}` : "";
  if (!counts) {
    return `${prefix}${answerPart}`;
  }

  return `${prefix} / ${copy.intentSentences} ${counts.intent_documents} / ${copy.entities} ${counts.entity_documents} / ${copy.vocabulary} ${counts.vocabulary}${answerPart}`;
}

function showTrainingPopup(message: string) {
  if (typeof window !== "undefined") {
    window.alert(message);
  }
}

function isRagAnswerMode(aiConfig?: Record<string, unknown>) {
  const answerMode = typeof aiConfig?.answer_mode === "string" ? aiConfig.answer_mode : "fixed";
  return answerMode === "semantic_rag" || answerMode === "llm_rag";
}

export function NluTrainingButton({
  aiConfig,
  botId,
  versionId,
  statusText = "",
  disabledReason = "",
  onTrained,
}: NluTrainingButtonProps) {
  const { language: uiLanguage } = useI18n();
  const copy = TRAINING_CATALOGS[uiLanguage];
  const [training, setTraining] = useState(false);
  const [message, setMessage] = useState("");
  const disabled = !botId || !versionId || training || Boolean(disabledReason);
  const ragAnswerMode = isRagAnswerMode(aiConfig);

  async function runTraining() {
    if (!botId || !versionId || training) {
      return;
    }

    const session = loadAuthSession();
    if (!session) {
      const nextMessage = copy.loginRequired;
      setMessage(nextMessage);
      showTrainingPopup(nextMessage);
      return;
    }

    setTraining(true);
    setMessage(ragAnswerMode ? copy.ragTraining : copy.nluTraining);

    try {
      const manifest = await trainStudioBotVersionNlu(
        session.access_token,
        botId,
        versionId,
        undefined,
        {
          onStatus: (job) => {
            setMessage(
              job.status === "queued"
                ? copy.queued
                : copy.processing,
            );
          },
        },
      );
      const nextMessage = formatTrainingResult(manifest, copy);
      setMessage(nextMessage);
      showTrainingPopup(nextMessage);
      onTrained?.(manifest);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : copy.error;
      setMessage(nextMessage);
      showTrainingPopup(nextMessage);
    } finally {
      setTraining(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="manual-main__learn-button"
        disabled={disabled}
        onClick={() => void runTraining()}
      >
        {training ? copy.training : copy.train}
      </button>
      <p className="manual-main__updated">{message || disabledReason || statusText}</p>
    </>
  );
}
