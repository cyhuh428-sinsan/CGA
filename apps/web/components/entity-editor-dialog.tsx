"use client";

import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/language-provider";

import { type AuthSession } from "@/lib/auth";
import { ENTITY_EDITOR_CATALOGS, formatEntityEditorText, type EntityEditorCatalog } from "@/lib/i18n/entity-editor";
import { getBotDictionary } from "@/lib/dictionary-assets";
import {
  applyUpdatedVersionToBot,
  getBotUserEntities,
  getBotVersionDocument,
  withUpdatedEntities,
} from "@/lib/entity-assets";
import { extractSystemEntityMatches } from "@/lib/system-entity-extractor";
import {
  type StudioBotApiItem,
  updateStudioBotVersionEntities,
} from "@/lib/studio-bots-api";
import {
  type VersionDictionaryAsset,
  type VersionEntityAsset,
  type VersionEntityRow,
} from "@/lib/version-document";
import {
  DIALOG_PAGE_SIZE_OPTIONS,
  type DialogPageSize,
  usePersistedPageSize,
} from "@/lib/use-persisted-page-size";

type EntityEditorDialogProps = {
  authSession: AuthSession;
  bot: StudioBotApiItem;
  entity: VersionEntityAsset | null;
  onClose: () => void;
  onSaved: (nextBot: StudioBotApiItem, successMessage: string) => void;
};

type EntityValueEditorTarget = {
  mode: "new" | "edit";
  row: VersionEntityRow;
};

type PatternSyntaxState = {
  tone: "error" | "success";
  message: string;
} | null;

function stampEntity(entity: VersionEntityAsset, loginId: string): VersionEntityAsset {
  return {
    ...entity,
    updatedAt: new Date().toISOString(),
    updatedBy: loginId,
  };
}

function createEmptyEntityValueRow(): VersionEntityRow {
  return {
    id: crypto.randomUUID(),
    value: "",
    rowType: "S",
    details: [],
  };
}

function normalizeWordList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function tryCreateRegex(pattern: string, fallbackMessage: string) {
  const rawPattern = pattern.trim();
  const literalMatch = rawPattern.match(/^\/(.+)\/([dgimsuvy]*)$/);
  const source = literalMatch ? literalMatch[1] : rawPattern;
  const flags = literalMatch ? literalMatch[2] : "";

  try {
    return new RegExp(source, flags);
  } catch (error) {
    return error instanceof Error ? error.message : fallbackMessage;
  }
}

function buildDialogRowPreview(row: VersionEntityRow) {
  if (row.details.length === 0) {
    return "-";
  }
  return row.details.slice(0, 3).join(", ");
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

type DictionaryImportDialogProps = {
  dictionary: VersionDictionaryAsset[];
  copy: EntityEditorCatalog;
  onClose: () => void;
  onImport: (entries: VersionDictionaryAsset[]) => void;
};

function DictionaryImportDialog({ dictionary, copy, onClose, onImport }: DictionaryImportDialogProps) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = usePersistedPageSize<DialogPageSize>(
    "aidot.page_size.entity.dictionary_import",
    5,
    DIALOG_PAGE_SIZE_OPTIONS,
  );
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dictionary.filter((entry) => {
      if (!normalizedQuery) {
        return true;
      }
      const haystack = [entry.word, ...entry.synonyms].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [dictionary, query]);

  const totalPages = Math.max(1, Math.ceil(visibleEntries.length / pageSize));
  const pagedEntries = useMemo(() => paginate(visibleEntries, page, pageSize), [page, pageSize, visibleEntries]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, query]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const selectedEntries = useMemo(
    () => dictionary.filter((entry) => selectedIds.includes(entry.id)),
    [dictionary, selectedIds],
  );

  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div className="entity-sub-dialog" role="dialog" aria-modal="true" aria-label={copy.dictionaryImportTitle}>
        <div className="entity-editor-dialog__header">
          <strong>{copy.dictionaryImportTitle}</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label={copy.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body">
          <div className="entity-sub-dialog__toolbar">
            <div className="entity-sub-dialog__toolbar-left">
              <strong>{formatEntityEditorText(copy.total, { count: visibleEntries.length })}</strong>
              <label className="manual-main__mini-select manual-main__mini-select--select">
                <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as DialogPageSize)}>
                  <option value={5}>{formatEntityEditorText(copy.pageSize, { count: 5 })}</option>
                  <option value={10}>{formatEntityEditorText(copy.pageSize, { count: 10 })}</option>
                  <option value={25}>{formatEntityEditorText(copy.pageSize, { count: 25 })}</option>
                  <option value={50}>{formatEntityEditorText(copy.pageSize, { count: 50 })}</option>
                  <option value={100}>{formatEntityEditorText(copy.pageSize, { count: 100 })}</option>
                </select>
              </label>
            </div>

            <label className="entity-sub-dialog__search">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
              />
            </label>
          </div>

          <div className="entity-sub-dialog__table">
            <div className="entity-sub-dialog__table-head entity-sub-dialog__table-head--dictionary">
              <span>
                <input
                  type="checkbox"
                  aria-label={copy.selectAll}
                  checked={pagedEntries.length > 0 && pagedEntries.every((entry) => selectedIds.includes(entry.id))}
                  onChange={(event) =>
                    setSelectedIds(
                      event.target.checked ? pagedEntries.map((entry) => entry.id) : [],
                    )
                  }
                />
              </span>
              <span>{copy.word}</span>
              <span>{copy.synonym}</span>
            </div>

            {pagedEntries.map((entry) => (
              <div key={entry.id} className="entity-sub-dialog__table-row entity-sub-dialog__table-row--dictionary">
                <span>
                  <input
                    type="checkbox"
                    aria-label={formatEntityEditorText(copy.selectRow, { name: entry.word })}
                    checked={selectedIds.includes(entry.id)}
                    onChange={() =>
                      setSelectedIds((current) =>
                        current.includes(entry.id)
                          ? current.filter((id) => id !== entry.id)
                          : [...current, entry.id],
                      )
                    }
                  />
                </span>
                <span>{entry.word}</span>
                <span>{entry.synonyms.length > 0 ? entry.synonyms.join(", ") : "-"}</span>
              </div>
            ))}

            {pagedEntries.length === 0 ? <div className="entity-detail__empty">{copy.noDictionary}</div> : null}
          </div>

          <div className="manual-main__pagination">
            <button type="button" disabled={page === 1} onClick={() => setPage(1)}>
              «
            </button>
            <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .slice(Math.max(0, page - 3), Math.max(0, page - 3) + 5)
              .map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={pageNumber === page ? "is-active" : undefined}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
            <button type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
              ›
            </button>
            <button type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)}>
              »
            </button>
          </div>
        </div>

        <div className="entity-editor-dialog__footer">
          <button type="button" className="secondary-action" onClick={onClose}>
            {copy.cancel}
          </button>
          <button
            type="button"
            className="primary-action"
            disabled={selectedEntries.length === 0}
            onClick={() => onImport(selectedEntries)}
          >
            {copy.import}
          </button>
        </div>
      </div>
    </div>
  );
}

type EntityValueItemDialogProps = {
  existingRows: VersionEntityRow[];
  copy: EntityEditorCatalog;
  target: EntityValueEditorTarget;
  onClose: () => void;
  onSave: (row: VersionEntityRow) => void;
};

function EntityValueItemDialog({ existingRows, copy, target, onClose, onSave }: EntityValueItemDialogProps) {
  const [value, setValue] = useState(target.row.value);
  const [rowType, setRowType] = useState<VersionEntityRow["rowType"]>(target.row.rowType);
  const [details, setDetails] = useState<string[]>(target.row.details);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailInput, setDetailInput] = useState("");
  const [selectedDetails, setSelectedDetails] = useState<string[]>([]);
  const [patternTestText, setPatternTestText] = useState("");
  const [patternSyntaxState, setPatternSyntaxState] = useState<PatternSyntaxState>(null);
  const [patternTestState, setPatternTestState] = useState<PatternSyntaxState>(null);
  const [valueError, setValueError] = useState("");
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    setValue(target.row.value);
    setRowType(target.row.rowType);
    setDetails(target.row.details);
    setDetailSearch("");
    setDetailInput("");
    setSelectedDetails([]);
    setPatternTestText("");
    setPatternSyntaxState(null);
    setPatternTestState(null);
    setValueError("");
    setDetailError("");
  }, [target]);

  const visibleDetails = useMemo(() => {
    const normalizedQuery = detailSearch.trim().toLowerCase();
    if (!normalizedQuery) {
      return details;
    }
    return details.filter((item) => item.toLowerCase().includes(normalizedQuery));
  }, [detailSearch, details]);

  function validateValueField(nextValue: string) {
    const normalizedValue = nextValue.trim();
    if (!normalizedValue) {
      return copy.validation.valueRequired;
    }
    if (normalizedValue.length > 100) {
      return copy.validation.valueMaxLength;
    }
    const duplicated = existingRows.some(
      (item) => item.id !== target.row.id && item.value.trim() === normalizedValue,
    );
    if (duplicated) {
      return copy.validation.duplicateValue;
    }
    return "";
  }

  function addDetail() {
    const normalizedValue = detailInput.trim();
    if (!normalizedValue) {
      setDetailError(rowType === "P" ? copy.validation.patternRequired : copy.validation.synonymRequired);
      return;
    }

    const maxLength = rowType === "P" ? 256 : 100;
    if (normalizedValue.length > maxLength) {
      setDetailError(rowType === "P" ? copy.validation.patternMaxLength : copy.validation.synonymMaxLength);
      return;
    }

    if (details.some((item) => item === normalizedValue)) {
      setDetailError(rowType === "P" ? copy.validation.duplicatePattern : copy.validation.duplicateSynonym);
      return;
    }

    if (rowType === "P") {
      const regexResult = tryCreateRegex(normalizedValue, copy.validation.invalidRegex);
      if (typeof regexResult === "string") {
        setDetailError(formatEntityEditorText(copy.validation.invalidRegexWithReason, { value: normalizedValue, reason: regexResult }));
        setPatternSyntaxState({
          tone: "error",
          message: formatEntityEditorText(copy.validation.regexSyntaxError, { reason: regexResult }),
        });
        return;
      }

      if (details.length >= 5) {
        setDetailError(copy.validation.maxPatterns);
        return;
      }

      setPatternSyntaxState({
        tone: "success",
        message: copy.validRegex,
      });
    }

    setDetails((current) => [normalizedValue, ...current]);
    setDetailInput("");
    setDetailError("");
  }

  function deleteSelectedDetails() {
    if (selectedDetails.length === 0) {
      return;
    }
    setDetails((current) => current.filter((item) => !selectedDetails.includes(item)));
    setSelectedDetails([]);
  }

  function runPatternSyntaxCheck() {
    const normalizedValue = detailInput.trim();
    if (!normalizedValue) {
      setDetailError(copy.validation.patternCheckRequired);
      setPatternSyntaxState(null);
      return;
    }

    const regexResult = tryCreateRegex(normalizedValue, copy.validation.invalidRegex);
    if (typeof regexResult === "string") {
      setDetailError(formatEntityEditorText(copy.validation.invalidRegexWithReason, { value: normalizedValue, reason: regexResult }));
      setPatternSyntaxState({
        tone: "error",
        message: regexResult,
      });
      return;
    }

    setDetailError("");
    setPatternSyntaxState({
      tone: "success",
      message: copy.validRegex,
    });
  }

  function runPatternTest() {
    if (details.length === 0) {
      setPatternTestState({
        tone: "error",
        message: copy.validation.patternRequiredBeforeTest,
      });
      return;
    }

    if (!patternTestText.trim()) {
      setPatternTestState({
        tone: "error",
        message: copy.validation.testTextRequired,
      });
      return;
    }

    const matched = details.filter((pattern) => {
      const regexResult = tryCreateRegex(pattern, copy.validation.invalidRegex);
      if (typeof regexResult === "string") {
        return false;
      }
      return regexResult.test(patternTestText);
    });

    setPatternTestState(
      matched.length > 0
        ? {
            tone: "success",
            message: formatEntityEditorText(copy.matchedPatterns, { patterns: matched.join(", ") }),
          }
        : {
            tone: "error",
            message: copy.noMatchedPatterns,
          },
    );
  }

  function handleSave() {
    const nextValueError = validateValueField(value);
    if (nextValueError) {
      setValueError(nextValueError);
      return;
    }

    const normalizedDetails = normalizeWordList(details);
    if (rowType === "P") {
      if (normalizedDetails.length === 0) {
        setDetailError(copy.validation.atLeastOnePattern);
        return;
      }
      const invalidPattern = normalizedDetails.find((pattern) => typeof tryCreateRegex(pattern, copy.validation.invalidRegex) === "string");
      if (invalidPattern) {
        setDetailError(formatEntityEditorText(copy.validation.invalidPattern, { value: invalidPattern }));
        return;
      }
    }

    setValueError("");
    setDetailError("");
    onSave({
      id: target.row.id,
      value: value.trim(),
      rowType,
      details: normalizedDetails,
    });
  }

  const dialogTitle = target.mode === "new" ? copy.valueCreateTitle : copy.valueEditTitle;

  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div className="entity-sub-dialog entity-sub-dialog--value" role="dialog" aria-modal="true" aria-label={dialogTitle}>
        <div className="entity-editor-dialog__header">
          <strong>{dialogTitle}</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label={copy.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body">
          <div className="entity-value-dialog__section">
            <label className="entity-value-dialog__field">
              <span>
                개체값 <em>*</em>
              </span>
              <input
                type="text"
                className={`dictionary-editor-dialog__input${valueError ? " is-invalid" : ""}`}
                value={value}
                maxLength={100}
                onChange={(event) => {
                  setValue(event.target.value);
                  setValueError("");
                }}
              />
              <div className="entity-value-dialog__meta">
                {valueError ? <span className="entity-value-dialog__error">{valueError}</span> : <span />}
                <span>{value.length}/100</span>
              </div>
            </label>

            <div className="entity-value-dialog__type-row">
              <strong>{copy.type}</strong>
              <label>
                <input
                  type="radio"
                  name={`entity-row-type-${target.row.id}`}
                  checked={rowType === "S"}
                  onChange={() => {
                    setRowType("S");
                    setDetails([]);
                    setDetailInput("");
                    setDetailError("");
                    setPatternSyntaxState(null);
                    setPatternTestState(null);
                  }}
                />
                {copy.synonym}
              </label>
              <label>
                <input
                  type="radio"
                  name={`entity-row-type-${target.row.id}`}
                  checked={rowType === "P"}
                  onChange={() => {
                    setRowType("P");
                    setDetails([]);
                    setDetailInput("");
                    setDetailError("");
                    setPatternSyntaxState(null);
                    setPatternTestState(null);
                  }}
                />
                {copy.pattern}
              </label>
            </div>
          </div>

          {rowType === "S" ? (
            <section className="entity-value-dialog__section">
              <div className="dictionary-editor-dialog__controls">
                <label className="dictionary-editor-dialog__field">
                  <span>{copy.synonymSearch}</span>
                  <input
                    type="text"
                    className="dictionary-editor-dialog__input"
                    value={detailSearch}
                    onChange={(event) => setDetailSearch(event.target.value)}
                    placeholder={copy.synonymSearchPlaceholder}
                  />
                </label>

                <label className="dictionary-editor-dialog__field dictionary-editor-dialog__add-field">
                  <span>{copy.synonym}</span>
                  <div className="dictionary-editor-dialog__add-row">
                    <input
                      type="text"
                      className={`dictionary-editor-dialog__input${detailError ? " is-invalid" : ""}`}
                      value={detailInput}
                      maxLength={100}
                      onChange={(event) => {
                        setDetailInput(event.target.value);
                        setDetailError("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addDetail();
                        }
                      }}
                    />
                    <button type="button" className="secondary-action" onClick={addDetail}>
                      {copy.add}
                    </button>
                  </div>
                  <div className="entity-value-dialog__meta">
                    {detailError ? <span className="entity-value-dialog__error">{detailError}</span> : <span />}
                    <span>{detailInput.length}/100</span>
                  </div>
                </label>
              </div>

              <div className="entity-detail__section-header">
                <div>
                  <strong>{copy.synonymList}</strong>
                </div>
                <button
                  type="button"
                  className="secondary-action secondary-action--danger"
                  disabled={selectedDetails.length === 0}
                  onClick={deleteSelectedDetails}
                >
                  {copy.delete}
                </button>
              </div>

              <div className="entity-detail__rows entity-detail__rows--dictionary">
                <div className="entity-detail__head entity-detail__head--dictionary">
                  <span>
                    <input
                      type="checkbox"
                      checked={visibleDetails.length > 0 && visibleDetails.every((item) => selectedDetails.includes(item))}
                      onChange={(event) =>
                        setSelectedDetails(event.target.checked ? [...visibleDetails] : [])
                      }
                    />
                  </span>
                  <span>{copy.synonym}</span>
                </div>

                {visibleDetails.map((detail) => (
                  <div key={detail} className="entity-detail__row entity-detail__row--dictionary">
                    <span>
                      <input
                        type="checkbox"
                        checked={selectedDetails.includes(detail)}
                        onChange={() =>
                          setSelectedDetails((current) =>
                            current.includes(detail)
                              ? current.filter((item) => item !== detail)
                              : [...current, detail],
                          )
                        }
                      />
                    </span>
                    <span className="entity-value-dialog__detail-text">{detail}</span>
                  </div>
                ))}

                {visibleDetails.length === 0 ? (
                  <div className="entity-detail__empty">
                    {detailSearch.trim() ? copy.noSynonymSearchResults : copy.emptySynonyms}
                  </div>
                ) : null}
              </div>
            </section>
          ) : (
            <section className="entity-value-dialog__section">
              <label className="dictionary-editor-dialog__field">
                <span>
                  {copy.pattern} <em>*</em>
                </span>
                <div className="dictionary-editor-dialog__add-row">
                  <input
                    type="text"
                    className={`dictionary-editor-dialog__input${detailError ? " is-invalid" : ""}`}
                    value={detailInput}
                    maxLength={256}
                    onChange={(event) => {
                      setDetailInput(event.target.value);
                      setDetailError("");
                      setPatternSyntaxState(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addDetail();
                      }
                    }}
                  />
                  <button type="button" className="secondary-action" onClick={addDetail}>
                    추가
                  </button>
                </div>
                <div className="entity-value-dialog__meta">
                  {detailError ? <span className="entity-value-dialog__error">{detailError}</span> : <span />}
                  <span>{detailInput.length}/256</span>
                </div>
              </label>

              <div className="entity-value-dialog__button-row">
                <button type="button" className="secondary-action" onClick={runPatternSyntaxCheck}>
                  {copy.regexCheck}
                </button>
              </div>
              {patternSyntaxState ? (
                <p
                  className={`entity-value-dialog__inline-message${
                    patternSyntaxState.tone === "success" ? " is-success" : " is-error"
                  }`}
                >
                  {patternSyntaxState.message}
                </p>
              ) : null}

              <div className="entity-detail__section-header">
                <div>
                  <strong>{copy.patternList}</strong>
                </div>
                <button
                  type="button"
                  className="secondary-action secondary-action--danger"
                  disabled={selectedDetails.length === 0}
                  onClick={deleteSelectedDetails}
                >
                  {copy.delete}
                </button>
              </div>

              <div className="entity-detail__rows entity-detail__rows--dictionary">
                <div className="entity-detail__head entity-detail__head--dictionary">
                  <span>
                    <input
                      type="checkbox"
                      checked={details.length > 0 && details.every((item) => selectedDetails.includes(item))}
                      onChange={(event) =>
                        setSelectedDetails(event.target.checked ? [...details] : [])
                      }
                    />
                  </span>
                  <span>{copy.pattern}</span>
                </div>

                {details.map((detail) => (
                  <div key={detail} className="entity-detail__row entity-detail__row--dictionary">
                    <span>
                      <input
                        type="checkbox"
                        checked={selectedDetails.includes(detail)}
                        onChange={() =>
                          setSelectedDetails((current) =>
                            current.includes(detail)
                              ? current.filter((item) => item !== detail)
                              : [...current, detail],
                          )
                        }
                      />
                    </span>
                    <span className="entity-value-dialog__detail-text">{detail}</span>
                  </div>
                ))}

                {details.length === 0 ? <div className="entity-detail__empty">{copy.emptyPatterns}</div> : null}
              </div>

              <div className="entity-value-dialog__pattern-test">
                <strong>{copy.regexTest}</strong>
                <div className="entity-value-dialog__pattern-test-row">
                  <input
                    type="text"
                    className="dictionary-editor-dialog__input"
                    value={patternTestText}
                    onChange={(event) => setPatternTestText(event.target.value)}
                    placeholder={copy.regexTestPlaceholder}
                  />
                  <button type="button" className="secondary-action" onClick={runPatternTest}>
                    {copy.test}
                  </button>
                </div>
                {patternTestState ? (
                  <p
                    className={`entity-value-dialog__inline-message${
                      patternTestState.tone === "success" ? " is-success" : " is-error"
                    }`}
                  >
                    {patternTestState.message}
                  </p>
                ) : null}
              </div>
            </section>
          )}
        </div>

        <div className="entity-editor-dialog__footer">
          <button type="button" className="secondary-action" onClick={onClose}>
            {copy.cancel}
          </button>
          <button type="button" className="primary-action" onClick={handleSave}>
            {copy.save}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EntityEditorDialog({ authSession, bot, entity, onClose, onSaved }: EntityEditorDialogProps) {
  const { language: uiLanguage } = useI18n();
  const copy = ENTITY_EDITOR_CATALOGS[uiLanguage];
  const [form, setForm] = useState<VersionEntityAsset | null>(entity);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = usePersistedPageSize<DialogPageSize>(
    "aidot.page_size.entity.value_list",
    5,
    DIALOG_PAGE_SIZE_OPTIONS,
  );
  const [page, setPage] = useState(1);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [rowEditorTarget, setRowEditorTarget] = useState<EntityValueEditorTarget | null>(null);
  const [dictionaryImportOpen, setDictionaryImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [systemTestText, setSystemTestText] = useState("");

  useEffect(() => {
    setForm(entity);
    setQuery("");
    setPage(1);
    setSelectedRowIds([]);
    setRowEditorTarget(null);
    setDictionaryImportOpen(false);
    setSaving(false);
    setMessage("");
    setErrorMessage("");
    setSystemTestText("");
  }, [entity]);

  const isSystem = !!form?.system;
  const dictionary = useMemo(() => getBotDictionary(bot), [bot]);
  const filteredRows = useMemo(() => {
    const rows = form?.rows ?? [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return rows;
    }
    return rows.filter((row) => {
      const haystack = [row.value, ...row.details].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [form?.rows, query]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = useMemo(() => paginate(filteredRows, page, pageSize), [filteredRows, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, query]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const systemMatches = useMemo(() => {
    if (!form?.system) {
      return [];
    }
    return extractSystemEntityMatches(form.name, systemTestText);
  }, [form, systemTestText]);

  if (!form) {
    return null;
  }

  const currentEntity = form;

  function updateRows(nextRows: VersionEntityRow[]) {
    setForm((current) => (current ? { ...current, rows: nextRows } : current));
  }

  function handleSaveRow(nextRow: VersionEntityRow) {
    const currentRows = currentEntity.rows;
    const exists = currentRows.some((row) => row.id === nextRow.id);
    const nextRows = exists
      ? currentRows.map((row) => (row.id === nextRow.id ? nextRow : row))
      : [nextRow, ...currentRows];

    updateRows(nextRows);
    setRowEditorTarget(null);
  }

  function handleDeleteSelectedRows() {
    if (selectedRowIds.length === 0) {
      return;
    }
    updateRows(currentEntity.rows.filter((row) => !selectedRowIds.includes(row.id)));
    setSelectedRowIds([]);
  }

  function handleImportDictionary(entries: VersionDictionaryAsset[]) {
    const nextRows = [...currentEntity.rows];
    for (const entry of entries) {
      const existingRow = nextRows.find((row) => row.rowType === "S" && row.value === entry.word.trim());
      const synonyms = normalizeWordList(entry.synonyms);
      if (existingRow) {
        existingRow.details = normalizeWordList([...existingRow.details, ...synonyms]);
        continue;
      }
      nextRows.unshift({
        id: crypto.randomUUID(),
        value: entry.word.trim(),
        rowType: "S",
        details: synonyms,
      });
    }
    updateRows(nextRows);
    setDictionaryImportOpen(false);
  }

  async function handlePersist() {
    if (!bot.active_version || currentEntity.system) {
      onClose();
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const userEntities = getBotUserEntities(bot);
      const nextEntity = stampEntity(currentEntity, authSession.user.login_id);
      const nextEntities = userEntities.map((item) => (item.id === nextEntity.id ? nextEntity : item));
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
      onSaved(nextBot, copy.saved);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const dialogTitle = isSystem
    ? formatEntityEditorText(copy.systemTitle, { name: currentEntity.name })
    : currentEntity.rows.length === 0
      ? copy.createTitle
      : copy.viewTitle;

  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div className="entity-editor-dialog" role="dialog" aria-modal="true" aria-label={dialogTitle}>
        <div className="entity-editor-dialog__header">
          <strong>{dialogTitle}</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label={copy.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={`entity-editor-dialog__body${isSystem ? "" : " entity-editor-dialog__body--list"}`}>
          {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}
          {message ? <p className="form-message form-message--success">{message}</p> : null}

          {isSystem ? (
            <section className="entity-editor-dialog__system-sheet">
              <p className="entity-editor-dialog__system-note">
                {copy.systemEntityDescription}
              </p>

              <div className="entity-editor-dialog__system-grid">
                <article className="entity-editor-dialog__system-card">
                  <span>{copy.category}</span>
                  <strong>{copy.systemEntity}</strong>
                </article>
                <article className="entity-editor-dialog__system-card">
                  <span>{copy.dictionaryType}</span>
                  <strong>{currentEntity.systemKind === "regex" ? "regex" : "look-up"}</strong>
                </article>
                <article className="entity-editor-dialog__system-card">
                  <span>{copy.standardExpression}</span>
                  <strong>{currentEntity.standardExpression || "-"}</strong>
                </article>
                <article className="entity-editor-dialog__system-card">
                  <span>{copy.entityName}</span>
                  <strong>{currentEntity.name}</strong>
                </article>
              </div>

              <div className="entity-editor-dialog__system-examples">
                <span>{copy.examples}</span>
                <ul>
                  {(currentEntity.examples ?? []).map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>
              </div>

              <div className="entity-editor-dialog__system-test">
                <span>{copy.sentenceTest}</span>
                <div className="entity-editor-dialog__system-test-grid">
                  <textarea
                    className="dictionary-editor-dialog__textarea"
                    value={systemTestText}
                    onChange={(event) => setSystemTestText(event.target.value)}
                    placeholder={copy.systemPlaceholder}
                  />
                  <div className="entity-editor-dialog__system-test-result">
                    <strong>{copy.extractResult}</strong>
                    {!systemTestText.trim() ? (
                      <p>{copy.enterTestText}</p>
                    ) : systemMatches.length === 0 ? (
                      <p>{copy.noExtractedValue}</p>
                    ) : (
                      <div className="entity-editor-dialog__system-test-table">
                        <div className="entity-editor-dialog__system-test-table-head">
                          <span>{copy.sourceValue}</span>
                          <span>{copy.targetValue}</span>
                        </div>
                        {systemMatches.map((match, index) => (
                          <div
                            key={`${match.value}-${match.target}-${index}`}
                            className="entity-editor-dialog__system-test-table-row"
                          >
                            <span>{match.value}</span>
                            <span>{match.target}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <div className="entity-editor-dialog__list-layout">
              <div className="entity-editor-dialog__toolbar">
                <div className="entity-editor-dialog__toolbar-left">
                  <strong>{formatEntityEditorText(copy.total, { count: filteredRows.length })}</strong>
                  <label className="manual-main__mini-select manual-main__mini-select--select">
                    <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as DialogPageSize)}>
                      <option value={5}>{formatEntityEditorText(copy.pageSize, { count: 5 })}</option>
                      <option value={10}>{formatEntityEditorText(copy.pageSize, { count: 10 })}</option>
                      <option value={25}>{formatEntityEditorText(copy.pageSize, { count: 25 })}</option>
                      <option value={50}>{formatEntityEditorText(copy.pageSize, { count: 50 })}</option>
                      <option value={100}>{formatEntityEditorText(copy.pageSize, { count: 100 })}</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="manual-main__ghost-button"
                    disabled={selectedRowIds.length === 0}
                    onClick={handleDeleteSelectedRows}
                  >
                    {copy.delete}
                  </button>
                </div>

                <div className="entity-editor-dialog__toolbar-right">
                  <button type="button" className="manual-main__ghost-button" onClick={() => setDictionaryImportOpen(true)}>
                    {copy.importDictionary}
                  </button>
                  <button
                    type="button"
                    className="manual-main__action-button"
                    onClick={() => setRowEditorTarget({ mode: "new", row: createEmptyEntityValueRow() })}
                  >
                    {copy.addEntityValue}
                  </button>
                </div>
              </div>

              <label className="entity-editor-dialog__search">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                />
              </label>

              <div className="entity-editor-dialog__table-panel">
                <div className="entity-sub-dialog__table entity-sub-dialog__table--entity">
                  <div className="entity-sub-dialog__table-head entity-sub-dialog__table-head--entity">
                    <span>
                      <input
                        type="checkbox"
                        checked={pagedRows.length > 0 && pagedRows.every((row) => selectedRowIds.includes(row.id))}
                        onChange={(event) =>
                          setSelectedRowIds(event.target.checked ? pagedRows.map((row) => row.id) : [])
                        }
                      />
                    </span>
                    <span>{copy.entityValue}</span>
                    <span>{copy.type}</span>
                    <span>{copy.synonymPattern}</span>
                  </div>

                  {pagedRows.map((row) => (
                    <div key={row.id} className="entity-sub-dialog__table-row entity-sub-dialog__table-row--entity">
                      <span>
                        <input
                          type="checkbox"
                          checked={selectedRowIds.includes(row.id)}
                          onChange={() =>
                            setSelectedRowIds((current) =>
                              current.includes(row.id)
                                ? current.filter((item) => item !== row.id)
                                : [...current, row.id],
                            )
                          }
                        />
                      </span>
                      <button
                        type="button"
                        className="manual-main__link-button"
                        onClick={() => setRowEditorTarget({ mode: "edit", row })}
                      >
                        {row.value}
                      </button>
                      <span>{row.rowType}</span>
                      <span>{buildDialogRowPreview(row)}</span>
                    </div>
                  ))}

                  {pagedRows.length === 0 ? (
                    <div className="entity-detail__empty">{copy.emptyValues}</div>
                  ) : null}
                </div>
              </div>

              <div className="manual-main__pagination entity-editor-dialog__pagination">
                <button type="button" disabled={page === 1} onClick={() => setPage(1)}>
                  «
                </button>
                <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .slice(Math.max(0, page - 3), Math.max(0, page - 3) + 5)
                  .map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      className={pageNumber === page ? "is-active" : undefined}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}
                <button type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                  ›
                </button>
                <button type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)}>
                  »
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="entity-editor-dialog__footer">
          <button type="button" className="secondary-action" onClick={onClose}>
            {copy.cancel}
          </button>
          {!isSystem ? (
            <button type="button" className="primary-action" disabled={saving} onClick={() => void handlePersist()}>
              {saving ? copy.saving : copy.save}
            </button>
          ) : null}
        </div>
      </div>

      {!isSystem && rowEditorTarget ? (
        <EntityValueItemDialog
          existingRows={currentEntity.rows}
          copy={copy}
          target={rowEditorTarget}
          onClose={() => setRowEditorTarget(null)}
          onSave={handleSaveRow}
        />
      ) : null}

      {!isSystem && dictionaryImportOpen ? (
        <DictionaryImportDialog
          dictionary={dictionary}
          copy={copy}
          onClose={() => setDictionaryImportOpen(false)}
          onImport={handleImportDictionary}
        />
      ) : null}
    </div>
  );
}
