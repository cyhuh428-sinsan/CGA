"use client";

import { useState } from "react";

import { loadAuthSession } from "@/lib/auth";
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

function formatTrainingDate(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.replace("T", " ").slice(0, 19);
}

function formatTrainingResult(manifest: NluModelManifest) {
  const counts = manifest.model?.counts;
  const trainedAt = formatTrainingDate(manifest.model?.trained_at);
  const prefix = trainedAt ? `학습완료 ${trainedAt}` : "학습이 완료되었습니다.";
  const answerDocumentCount = manifest.answer_training?.document_count;
  const answerPart =
    typeof answerDocumentCount === "number" ? ` / 답변문서 ${answerDocumentCount}` : "";
  if (!counts) {
    return `${prefix}${answerPart}`;
  }

  return `${prefix} / 의도문장 ${counts.intent_documents} / 개체 ${counts.entity_documents} / 어휘 ${counts.vocabulary}${answerPart}`;
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
      const nextMessage = "로그인이 필요합니다.";
      setMessage(nextMessage);
      showTrainingPopup(nextMessage);
      return;
    }

    setTraining(true);
    setMessage(ragAnswerMode ? "구성에서 확정한 RAG 의도와 답변 문서 기준으로 NLU 학습 중입니다." : "NLU 학습 중입니다.");

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
                ? "NLU 학습 요청이 Queue에 등록되었습니다."
                : "NLU 학습 작업을 처리하고 있습니다.",
            );
          },
        },
      );
      const nextMessage = formatTrainingResult(manifest);
      setMessage(nextMessage);
      showTrainingPopup(nextMessage);
      onTrained?.(manifest);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "학습 중 오류가 발생했습니다.";
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
        {training ? "학습중" : "학습하기"}
      </button>
      <p className="manual-main__updated">{message || disabledReason || statusText}</p>
    </>
  );
}
