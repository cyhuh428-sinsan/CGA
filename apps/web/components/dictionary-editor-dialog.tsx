"use client";

import { useEffect, useMemo, useState } from "react";

import { type AuthSession } from "@/lib/auth";
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

function validateDictionaryTerm(value: string, fieldName: string) {
  if (!value) {
    return `${fieldName}을(를) 입력해주세요.`;
  }
  if (value.length > 100) {
    return `${fieldName}은(는) 100자 이하로 입력해주세요.`;
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

  const dialogTitle = useMemo(() => (isNew ? "단어 등록" : "단어 수정"), [isNew]);
  const showRecommendationPanel = recommendedSynonyms.length > 0 || Boolean(recommendationMessage);
  const visibleSynonyms = useMemo(() => {
    const normalizedQuery = synonymQuery.trim().toLowerCase();
    return form.synonyms
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => (normalizedQuery ? value.toLowerCase().includes(normalizedQuery) : true));
  }, [form.synonyms, synonymQuery]);

  function handleRecommendSynonyms() {
    const normalizedWord = normalizeDictionaryWord(form.word);
    const wordValidationError = validateDictionaryTerm(normalizedWord, "단어");
    if (wordValidationError) {
      setErrorMessage(wordValidationError);
      return;
    }

    setErrorMessage("");
    setRecommendedSynonyms([]);
    setRecommendationMessage("동의어 추천 기능은 아직 준비 중입니다.");
  }

  function addSynonym() {
    const nextValue = normalizeDictionaryWord(synonymInput);
    const validationError = validateDictionaryTerm(nextValue, "동의어");
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    if (form.synonyms.map((value) => value.trim()).filter(Boolean).length >= 500) {
      setErrorMessage("동의어는 최대 500개까지 등록할 수 있습니다.");
      return;
    }
    if (form.synonyms.some((item) => normalizeDictionaryWord(item) === nextValue)) {
      setErrorMessage("이미 등록된 동의어입니다.");
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
      setErrorMessage("활성 버전이 없습니다.");
      return;
    }

    const normalizedWord = normalizeDictionaryWord(form.word);
    const wordValidationError = validateDictionaryTerm(normalizedWord, "단어");
    if (wordValidationError) {
      setErrorMessage(wordValidationError);
      return;
    }

    const duplicateWord = getBotDictionary(bot).find(
      (item) => item.id !== form.id && normalizeDictionaryWord(item.word) === normalizedWord,
    );
    if (duplicateWord) {
      setErrorMessage("이미 등록된 단어입니다.");
      return;
    }

    const normalizedSynonyms = form.synonyms
      .map((item) => normalizeDictionaryWord(item))
      .filter(Boolean);
    const invalidSynonym = normalizedSynonyms.find((item) => validateDictionaryTerm(item, "동의어"));
    if (invalidSynonym) {
      setErrorMessage(validateDictionaryTerm(invalidSynonym, "동의어"));
      return;
    }
    if (new Set(normalizedSynonyms).size !== normalizedSynonyms.length) {
      setErrorMessage("중복된 동의어는 등록할 수 없습니다.");
      return;
    }
    if (normalizedSynonyms.length > 500) {
      setErrorMessage("동의어는 최대 500개까지 등록할 수 있습니다.");
      return;
    }
    if (normalizedSynonyms.some((item) => item === normalizedWord)) {
      setErrorMessage("단어와 동일한 값을 동의어로 등록할 수 없습니다.");
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
      setMessage("사전이 저장되었습니다.");
      onSaved(nextBot, isNew ? "단어가 등록되었습니다." : "단어가 저장되었습니다.");
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "사전 저장 중 오류가 발생했습니다.");
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
          <button type="button" className="entity-editor-dialog__close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body entity-editor-dialog__body--dictionary">
          {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}
          {message ? <p className="form-message form-message--success">{message}</p> : null}

          <div className="dictionary-editor-dialog__layout">
            <section className="dictionary-editor-dialog__section">
              <label className="dictionary-editor-dialog__field">
                <span>단어</span>
                <div className="dictionary-editor-dialog__word-row">
                  <input
                    type="text"
                    className="dictionary-editor-dialog__input"
                    value={form.word}
                    onChange={(event) => setForm((current) => ({ ...current, word: event.target.value }))}
                  />
                  <button type="button" className="secondary-action" onClick={handleRecommendSynonyms}>
                    동의어 추천
                  </button>
                </div>
                <small className="dictionary-editor-dialog__counter">{normalizeDictionaryWord(form.word).length}/100</small>
                <small className="dictionary-editor-dialog__helper">
                  단어는 100자 이하로 입력합니다. 복합어와 구문도 대표 단어로 등록할 수 있습니다.
                </small>
              </label>
              {showRecommendationPanel ? (
                <div className="dictionary-editor-dialog__recommend">
                  <strong>추천 동의어</strong>
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
                  <span>동의어 검색</span>
                  <input
                    type="text"
                    className="dictionary-editor-dialog__input"
                    value={synonymQuery}
                    onChange={(event) => setSynonymQuery(event.target.value)}
                  />
                </label>

                <label className="dictionary-editor-dialog__field dictionary-editor-dialog__add-field">
                  <span>동의어</span>
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
                      추가
                    </button>
                  </div>
                  <small className="dictionary-editor-dialog__helper">
                    동의어는 100자 이하로 입력하고 Enter로 등록합니다. 최대 500개까지 등록할 수 있습니다.
                  </small>
                </label>
              </div>

              <p className="dictionary-editor-dialog__helper">
                동의어는 없어도 저장할 수 있습니다. 대표 단어만 등록하여 복합명사나 구문을 하나의 단어처럼 인식시킬 수 있습니다.
              </p>

              <div className="entity-detail__section-header">
                <div>
                  <strong>동의어 목록</strong>
                </div>
                <div className="settings-toolbar">
                  <button
                    type="button"
                    className="secondary-action secondary-action--danger"
                    disabled={selectedIndexes.length === 0}
                    onClick={deleteSelectedRows}
                  >
                    삭제
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
                    <span>동의어</span>
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
                        ? "검색 조건에 맞는 동의어가 없습니다."
                        : "등록된 동의어가 없습니다. 동의어 없이 저장할 수 있습니다."}
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
                <span>의도 사용여부</span>
              </label>
            </section>
          </div>
        </div>

        <div className="entity-editor-dialog__footer">
          <button type="button" className="secondary-action" onClick={onClose}>
            취소
          </button>
          <button type="button" className="primary-action" disabled={saving} onClick={() => void handleSave()}>
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
