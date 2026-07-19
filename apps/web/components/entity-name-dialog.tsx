"use client";

import { useEffect, useState } from "react";

import { type AuthSession } from "@/lib/auth";
import {
  applyUpdatedVersionToBot,
  getBotEntities,
  getBotVersionDocument,
  withUpdatedEntities,
} from "@/lib/entity-assets";
import {
  type StudioBotApiItem,
  updateStudioBotVersionEntities,
} from "@/lib/studio-bots-api";
import {
  createEmptyVersionEntity,
  type VersionEntityAsset,
} from "@/lib/version-document";

type EntityNameDialogProps = {
  authSession: AuthSession;
  bot: StudioBotApiItem;
  entity: VersionEntityAsset | null;
  onClose: () => void;
  onSaved: (nextBot: StudioBotApiItem, successMessage: string) => void;
};

function stampEntityName(entity: VersionEntityAsset, loginId: string): VersionEntityAsset {
  return {
    ...entity,
    updatedAt: new Date().toISOString(),
    updatedBy: loginId,
  };
}

export function EntityNameDialog({ authSession, bot, entity, onClose, onSaved }: EntityNameDialogProps) {
  const isNew = !entity;
  const [name, setName] = useState(entity?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setName(entity?.name ?? "");
    setSaving(false);
    setErrorMessage("");
  }, [entity]);

  async function handleSave() {
    if (!bot.active_version) {
      setErrorMessage("활성 버전이 없습니다.");
      return;
    }

    const normalizedName = name.trim();
    if (!normalizedName) {
      setErrorMessage("개체명을 입력해주세요.");
      return;
    }

    const entities = getBotEntities(bot);
    const duplicated = entities.some(
      (item) => item.name === normalizedName && item.id !== entity?.id,
    );
    if (duplicated) {
      setErrorMessage("이미 사용 중인 개체명입니다.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const nextEntity = stampEntityName(
        entity
          ? {
              ...entity,
              name: normalizedName,
            }
          : {
              ...createEmptyVersionEntity(),
              name: normalizedName,
              intentEnabled: true,
              qaEnabled: false,
              rows: [],
            },
        authSession.user.login_id,
      );

      const nextEntities = entity
        ? entities.map((item) => (item.id === nextEntity.id ? nextEntity : item))
        : [nextEntity, ...entities.filter((item) => !item.system)];

      const nextDocument = withUpdatedEntities(getBotVersionDocument(bot), nextEntities);
      const response = await updateStudioBotVersionEntities(
        authSession.access_token,
        bot.id,
        bot.active_version.id,
        nextEntities,
      );
      const updatedVersion = {
        ...response.version,
        version_json: nextDocument,
      };

      const nextBot = applyUpdatedVersionToBot(bot, updatedVersion);
      onSaved(nextBot, isNew ? "개체명이 등록되었습니다." : "개체명이 수정되었습니다.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "개체명을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div className="entity-name-dialog" role="dialog" aria-modal="true" aria-label={isNew ? "개체명 추가" : "개체명 수정"}>
        <div className="entity-editor-dialog__header">
          <strong>{isNew ? "개체명 추가" : "개체명 수정"}</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body">
          {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}
          <label className="entity-editor-dialog__name-field">
            <span>개체명</span>
            <input
              type="text"
              className="bot-settings-card__input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </label>
        </div>

        <div className="entity-editor-dialog__footer">
          <button type="button" className="secondary-action" onClick={onClose}>
            취소
          </button>
          <button type="button" className="primary-action" disabled={saving} onClick={() => void handleSave()}>
            {saving ? "저장 중..." : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}
