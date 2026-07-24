"use client";

import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/language-provider";

import { type AuthSession } from "@/lib/auth";
import { DICTIONARY_EDITOR_CATALOGS, formatDictionaryEditorText, type DictionaryEditorCatalog } from "@/lib/i18n/dictionary-editor";
import {
  applyUpdatedVersionToDictionaryBot,
  getBotDictionary,
  getBotVersionDocument,
  validateDictionaryEntries,
  withUpdatedDictionary,
} from "@/lib/dictionary-assets";
import {
  type StudioBotApiItem,
  updateStudioBotVersionDictionary,
} from "@/lib/studio-bots-api";
import {
  createEmptyVersionDictionary,
  type VersionDictionaryAsset,
} from "@/lib/version-document";

type DictionaryEditorDialogProps = {
  authSession: AuthSession;
  bot: StudioBotApiItem;
  entry: VersionDictionaryAsset | null;
  onClose: () => void;
  onSaved: (nextBot: StudioBotApiItem, successMessage: string) => void;
};

function stampDictionary(entry: VersionDictionaryAsset, loginId: string): VersionDictionaryAsset {
  return {
    ...entry,
    updatedAt: new Date().toISOString(),
    updatedBy: loginId,
  };
}

function normalizeDictionaryWord(value: string) {
  return value.trim();
}

function validateDictionaryTerm(value: string, fieldName: string, copy: DictionaryEditorCatalog) {
  if (!value) {
    return formatDictionaryEditorText(copy.validation.required, { field: fieldName });
  }
  if (value.length > 100) {
    return formatDictionaryEditorText(copy.validation.maxLength, { field: fieldName });
  }
  return "";
}

export function DictionaryEditorDialog({
  authSession,
  bot,
  entry,
  onClose,
  onSaved,
}: DictionaryEditorDialogProps) {
  const { language: uiLanguage } = useI18n();
  const copy = DICTIONARY_EDITOR_CATALOGS[uiLanguage];
  const isNew = !entry;
  const [form, setForm] = useState<VersionDictionaryAsset>(entry ?? createEmptyVersionDictionary());
  const [synonymQuery, setSynonymQuery] = useState("");
  const [synonymInput, setSynonymInput] = useState("");
  const [recommendedSynonyms, setRecommendedSynonyms] = useState<string[]>([]);
  const [recommendationMessage, setRecommendationMessage] = useState("");
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setForm(entry ?? createEmptyVersionDictionary());
    setSynonymQuery("");
    setSynonymInput("");
    setRecommendedSynonyms([]);
    setRecommendationMessage("");
    setSelectedIndexes([]);
    setSaving(false);
    setMessage("");
    setErrorMessage("");
  }, [entry]);

  const dialogTitle = useMemo(() => (isNew ? copy.createTitle : copy.editTitle), [copy, isNew]);
  const showRecommendationPanel = recommendedSynonyms.length > 0 || Boolean(recommendationMessage);
  const visibleSynonyms = useMemo(() => {
    const normalizedQuery = synonymQuery.trim().toLowerCase();
    return form.synonyms
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => (normalizedQuery ? value.toLowerCase().includes(normalizedQuery) : true));
  }, [form.synonyms, synonymQuery]);

  function handleRecommendSynonyms() {
    const normalizedWord = normalizeDictionaryWord(form.word);
    const wordValidationError = validateDictionaryTerm(normalizedWord, copy.word, copy);
    if (wordValidationError) {
      setErrorMessage(wordValidationError);
      return;
    }

    setErrorMessage("");
    setRecommendedSynonyms([]);
    setRecommendationMessage(copy.recommendationUnavailable);
  }

  function addSynonym() {
    const nextValue = normalizeDictionaryWord(synonymInput);
    const validationError = validateDictionaryTerm(nextValue, copy.synonym, copy);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    if (form.synonyms.map((value) => value.trim()).filter(Boolean).length >= 500) {
      setErrorMessage(copy.validation.maxSynonyms);
      return;
    }
    if (form.synonyms.some((item) => normalizeDictionaryWord(item) === nextValue)) {
      setErrorMessage(copy.validation.duplicateSynonym);
      return;
    }

    setForm((current) => ({
      ...current,
      synonyms: [...current.synonyms, nextValue],
    }));
    setSynonymInput("");
    setErrorMessage("");
  }

  function updateSynonym(index: number, value: string) {
    setForm((current) => ({
      ...current,
      synonyms: current.synonyms.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  }

  function deleteSelectedRows() {
    if (selectedIndexes.length === 0) {
      return;
    }

    setForm((current) => ({
      ...current,
      synonyms: current.synonyms.filter((_, index) => !selectedIndexes.includes(index)),
    }));
    setSelectedIndexes([]);
  }

  async function handleSave() {
    if (!bot.active_version) {
      setErrorMessage(copy.validation.noActiveVersion);
      return;
    }

    const normalizedWord = normalizeDictionaryWord(form.word);
    const wordValidationError = validateDictionaryTerm(normalizedWord, copy.word, copy);
    if (wordValidationError) {
      setErrorMessage(wordValidationError);
      return;
    }

    const duplicateWord = getBotDictionary(bot).find(
      (item) => item.id !== form.id && normalizeDictionaryWord(item.word) === normalizedWord,
    );
    if (duplicateWord) {
      setErrorMessage(copy.validation.duplicateWord);
      return;
    }

    const normalizedSynonyms = form.synonyms
      .map((item) => normalizeDictionaryWord(item))
      .filter(Boolean);
    const invalidSynonym = normalizedSynonyms.find((item) => validateDictionaryTerm(item, copy.synonym, copy));
    if (invalidSynonym) {
      setErrorMessage(validateDictionaryTerm(invalidSynonym, copy.synonym, copy));
      return;
    }
    if (new Set(normalizedSynonyms).size !== normalizedSynonyms.length) {
      setErrorMessage(copy.validation.duplicateSynonyms);
      return;
    }
    if (normalizedSynonyms.length > 500) {
      setErrorMessage(copy.validation.maxSynonyms);
      return;
    }
    if (normalizedSynonyms.some((item) => item === normalizedWord)) {
      setErrorMessage(copy.validation.sameAsWord);
      return;
    }
    setSaving(true);
    setErrorMessage("");
    setMessage("");

    try {
      const nextEntry = stampDictionary(
        {
          ...form,
          word: normalizedWord,
          synonyms: normalizedSynonyms,
          qaEnabled: false,
          domainCandidate: false,
          domainEnabled: false,
        },
        authSession.user.login_id,
      );

      const dictionary = getBotDictionary(bot);
      const nextDictionary = isNew
        ? [nextEntry, ...dictionary]
        : dictionary.map((item) => (item.id === nextEntry.id ? nextEntry : item));

      const graphValidationError = validateDictionaryEntries(nextDictionary);
      if (graphValidationError) {
        setErrorMessage(graphValidationError);
        setSaving(false);
        return;
      }

      const nextDocument = withUpdatedDictionary(getBotVersionDocument(bot), nextDictionary);
      const response = await updateStudioBotVersionDictionary(
        authSession.access_token,
        bot.id,
        bot.active_version.id,
        nextDictionary,
      );
      const updatedVersion = {
        ...response.version,
        version_json: nextDocument,
      };

      const nextBot = applyUpdatedVersionToDictionaryBot(bot, updatedVersion);
      setMessage(copy.validation.saved);
      onSaved(nextBot, isNew ? copy.validation.created : copy.validation.updated);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.validation.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div
        className="entity-editor-dialog dictionary-editor-dialog dictionary-editor-dialog--compact"
        role="dialog"
        aria-modal="true"
        aria-label={dialogTitle}
      >
        <div className="entity-editor-dialog__header">
          <strong>{dialogTitle}</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label={copy.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body entity-editor-dialog__body--dictionary">
          {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}
          {message ? <p className="form-message form-message--success">{message}</p> : null}

          <div className="dictionary-editor-dialog__layout">
            <section className="dictionary-editor-dialog__section">
              <label className="dictionary-editor-dialog__field">
                <span>{copy.word}</span>
                <div className="dictionary-editor-dialog__word-row">
                  <input
                    type="text"
                    className="dictionary-editor-dialog__input"
                    value={form.word}
                    onChange={(event) => setForm((current) => ({ ...current, word: event.target.value }))}
                  />
                  <button type="button" className="secondary-action" onClick={handleRecommendSynonyms}>
                    {copy.synonymRecommendation}
                  </button>
                </div>
                <small className="dictionary-editor-dialog__counter">{normalizeDictionaryWord(form.word).length}/100</small>
                <small className="dictionary-editor-dialog__helper">
                  {copy.wordHelp}
                </small>
              </label>
              {showRecommendationPanel ? (
                <div className="dictionary-editor-dialog__recommend">
                  <strong>{copy.recommendedSynonyms}</strong>
                  {recommendedSynonyms.length > 0 ? (
                    <div className="dictionary-editor-dialog__recommend-list">
                      {recommendedSynonyms.map((value) => (
                        <button
                          key={value}
                          type="button"
                          className="dictionary-editor-dialog__recommend-chip"
                          onClick={() => {
                            setSynonymInput(value);
                            setRecommendationMessage("");
                          }}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="dictionary-editor-dialog__recommend-empty">{recommendationMessage}</p>
                  )}
                </div>
              ) : null}
            </section>

            <section className="dictionary-editor-dialog__section dictionary-editor-dialog__section--synonyms dictionary-editor-dialog__section--synonyms-layout">
              <div className="dictionary-editor-dialog__controls">
                <label className="dictionary-editor-dialog__field">
                  <span>{copy.synonymSearch}</span>
                  <input
                    type="text"
                    className="dictionary-editor-dialog__input"
                    value={synonymQuery}
                    onChange={(event) => setSynonymQuery(event.target.value)}
                  />
                </label>

                <label className="dictionary-editor-dialog__field dictionary-editor-dialog__add-field">
                  <span>{copy.synonym}</span>
                  <div className="dictionary-editor-dialog__add-row">
                    <div className="dictionary-editor-dialog__add-input-stack">
                      <input
                        type="text"
                        className="dictionary-editor-dialog__input"
                        value={synonymInput}
                        onChange={(event) => setSynonymInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addSynonym();
                          }
                        }}
                      />
                      <small className="dictionary-editor-dialog__counter">{normalizeDictionaryWord(synonymInput).length}/100</small>
                    </div>
                    <button type="button" className="secondary-action" onClick={addSynonym}>
                      {copy.add}
                    </button>
                  </div>
                  <small className="dictionary-editor-dialog__helper">
                    {copy.synonymHelp}
                  </small>
                </label>
              </div>

              <p className="dictionary-editor-dialog__helper">
                {copy.optionalHelp}
              </p>

              <div className="entity-detail__section-header">
                <div>
                  <strong>{copy.synonymList}</strong>
                </div>
                <div className="settings-toolbar">
                  <button
                    type="button"
                    className="secondary-action secondary-action--danger"
                    disabled={selectedIndexes.length === 0}
                    onClick={deleteSelectedRows}
                  >
                    {copy.delete}
                  </button>
                </div>
              </div>

              <div className="dictionary-editor-dialog__synonym-panel">
                <div className="entity-detail__rows entity-detail__rows--dictionary">
                  <div className="entity-detail__head entity-detail__head--dictionary">
                    <span>
                      <input
                        type="checkbox"
                        checked={
                          visibleSynonyms.length > 0 &&
                          visibleSynonyms.every(({ index }) => selectedIndexes.includes(index))
                        }
                        onChange={(event) =>
                          setSelectedIndexes(
                            event.target.checked ? visibleSynonyms.map(({ index }) => index) : [],
                          )
                        }
                      />
                    </span>
                    <span>{copy.synonym}</span>
                  </div>

                  {visibleSynonyms.map(({ value, index }) => (
                    <div key={`${form.id}-${index}`} className="entity-detail__row entity-detail__row--dictionary">
                      <span>
                        <input
                          type="checkbox"
                          checked={selectedIndexes.includes(index)}
                          onChange={() =>
                            setSelectedIndexes((current) =>
                              current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
                            )
                          }
                        />
                      </span>
                      <input
                        type="text"
                        className="dictionary-editor-dialog__input entity-detail__input"
                        value={value}
                        onChange={(event) => updateSynonym(index, event.target.value)}
                      />
                    </div>
                  ))}

                  {visibleSynonyms.length === 0 ? (
                    <div className="entity-detail__empty">
                      {synonymQuery.trim()
                        ? copy.noSearchResults
                        : copy.emptySynonyms}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="dictionary-editor-dialog__section dictionary-editor-dialog__section--usage">
              <label className="entity-editor-dialog__toggle-field">
                <input
                  type="checkbox"
                  checked={form.intentEnabled}
                  onChange={(event) => setForm((current) => ({ ...current, intentEnabled: event.target.checked }))}
                />
                <span>{copy.intentUsage}</span>
              </label>
            </section>
          </div>
        </div>

        <div className="entity-editor-dialog__footer">
          <button type="button" className="secondary-action" onClick={onClose}>
            {copy.cancel}
          </button>
          <button type="button" className="primary-action" disabled={saving} onClick={() => void handleSave()}>
            {saving ? copy.saving : copy.save}
          </button>
        </div>
      </div>
    </div>
  );
}
