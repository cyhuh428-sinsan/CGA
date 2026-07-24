"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/components/language-provider";

import { type AuthSession } from "@/lib/auth";
import { ENTITY_NAME_DIALOG_CATALOGS } from "@/lib/i18n/entity-name-dialog";
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
  const { language: uiLanguage } = useI18n();
  const copy = ENTITY_NAME_DIALOG_CATALOGS[uiLanguage];
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
      setErrorMessage(copy.validation.noActiveVersion);
      return;
    }

    const normalizedName = name.trim();
    if (!normalizedName) {
      setErrorMessage(copy.validation.required);
      return;
    }

    const entities = getBotEntities(bot);
    const duplicated = entities.some(
      (item) => item.name === normalizedName && item.id !== entity?.id,
    );
    if (duplicated) {
      setErrorMessage(copy.validation.duplicate);
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
      onSaved(nextBot, isNew ? copy.validation.created : copy.validation.updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.validation.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div className="entity-name-dialog" role="dialog" aria-modal="true" aria-label={isNew ? copy.createTitle : copy.editTitle}>
        <div className="entity-editor-dialog__header">
          <strong>{isNew ? copy.createTitle : copy.editTitle}</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label={copy.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body">
          {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}
          <label className="entity-editor-dialog__name-field">
            <span>{copy.entityName}</span>
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
            {copy.cancel}
          </button>
          <button type="button" className="primary-action" disabled={saving} onClick={() => void handleSave()}>
            {saving ? copy.saving : copy.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
