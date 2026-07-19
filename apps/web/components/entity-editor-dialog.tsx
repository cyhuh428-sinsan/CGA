"use client";

import { useEffect, useMemo, useState } from "react";

import { type AuthSession } from "@/lib/auth";
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

function tryCreateRegex(pattern: string) {
  const rawPattern = pattern.trim();
  const literalMatch = rawPattern.match(/^\/(.+)\/([dgimsuvy]*)$/);
  const source = literalMatch ? literalMatch[1] : rawPattern;
  const flags = literalMatch ? literalMatch[2] : "";

  try {
    return new RegExp(source, flags);
  } catch (error) {
    return error instanceof Error ? error.message : "정규식 문법이 올바르지 않습니다.";
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
  onClose: () => void;
  onImport: (entries: VersionDictionaryAsset[]) => void;
};

function DictionaryImportDialog({ dictionary, onClose, onImport }: DictionaryImportDialogProps) {
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
      <div className="entity-sub-dialog" role="dialog" aria-modal="true" aria-label="사전 불러오기">
        <div className="entity-editor-dialog__header">
          <strong>사전 불러오기</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body">
          <div className="entity-sub-dialog__toolbar">
            <div className="entity-sub-dialog__toolbar-left">
              <strong>전체 {visibleEntries.length}건</strong>
              <label className="manual-main__mini-select manual-main__mini-select--select">
                <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as DialogPageSize)}>
                  <option value={5}>5개씩 보기</option>
                  <option value={10}>10개씩 보기</option>
                  <option value={25}>25개씩 보기</option>
                  <option value={50}>50개씩 보기</option>
                  <option value={100}>100개씩 보기</option>
                </select>
              </label>
            </div>

            <label className="entity-sub-dialog__search">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="개체값, 동의어 또는 패턴을 검색하세요."
              />
            </label>
          </div>

          <div className="entity-sub-dialog__table">
            <div className="entity-sub-dialog__table-head entity-sub-dialog__table-head--dictionary">
              <span>
                <input
                  type="checkbox"
                  aria-label="전체 선택"
                  checked={pagedEntries.length > 0 && pagedEntries.every((entry) => selectedIds.includes(entry.id))}
                  onChange={(event) =>
                    setSelectedIds(
                      event.target.checked ? pagedEntries.map((entry) => entry.id) : [],
                    )
                  }
                />
              </span>
              <span>단어</span>
              <span>동의어</span>
            </div>

            {pagedEntries.map((entry) => (
              <div key={entry.id} className="entity-sub-dialog__table-row entity-sub-dialog__table-row--dictionary">
                <span>
                  <input
                    type="checkbox"
                    aria-label={`${entry.word} 선택`}
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

            {pagedEntries.length === 0 ? <div className="entity-detail__empty">불러올 수 있는 사전이 없습니다.</div> : null}
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
            취소
          </button>
          <button
            type="button"
            className="primary-action"
            disabled={selectedEntries.length === 0}
            onClick={() => onImport(selectedEntries)}
          >
            불러오기
          </button>
        </div>
      </div>
    </div>
  );
}

type EntityValueItemDialogProps = {
  existingRows: VersionEntityRow[];
  target: EntityValueEditorTarget;
  onClose: () => void;
  onSave: (row: VersionEntityRow) => void;
};

function EntityValueItemDialog({ existingRows, target, onClose, onSave }: EntityValueItemDialogProps) {
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
      return "개체값을 입력해주세요.";
    }
    if (normalizedValue.length > 100) {
      return "개체값은 100자 이하로 입력해주세요.";
    }
    const duplicated = existingRows.some(
      (item) => item.id !== target.row.id && item.value.trim() === normalizedValue,
    );
    if (duplicated) {
      return "동일한 이름의 개체값이 등록되어 있습니다.";
    }
    return "";
  }

  function addDetail() {
    const normalizedValue = detailInput.trim();
    if (!normalizedValue) {
      setDetailError(rowType === "P" ? "패턴을 입력해주세요." : "동의어를 입력해주세요.");
      return;
    }

    const maxLength = rowType === "P" ? 256 : 100;
    if (normalizedValue.length > maxLength) {
      setDetailError(rowType === "P" ? "패턴은 256자 이하로 입력해주세요." : "동의어는 100자 이하로 입력해주세요.");
      return;
    }

    if (details.some((item) => item === normalizedValue)) {
      setDetailError(rowType === "P" ? "동일한 패턴이 등록되어 있습니다." : "동일한 이름의 동의어가 등록되어 있습니다.");
      return;
    }

    if (rowType === "P") {
      const regexResult = tryCreateRegex(normalizedValue);
      if (typeof regexResult === "string") {
        setDetailError(`'${normalizedValue}' 정규식이 올바르지 않습니다. ${regexResult}`);
        setPatternSyntaxState({
          tone: "error",
          message: `정규식 문법 오류: ${regexResult}`,
        });
        return;
      }

      if (details.length >= 5) {
        setDetailError("패턴은 최대 5개까지 등록할 수 있습니다.");
        return;
      }

      setPatternSyntaxState({
        tone: "success",
        message: "등록 가능한 정규식입니다.",
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
      setDetailError("확인할 패턴을 입력해주세요.");
      setPatternSyntaxState(null);
      return;
    }

    const regexResult = tryCreateRegex(normalizedValue);
    if (typeof regexResult === "string") {
      setDetailError(`'${normalizedValue}' 정규식이 올바르지 않습니다. ${regexResult}`);
      setPatternSyntaxState({
        tone: "error",
        message: regexResult,
      });
      return;
    }

    setDetailError("");
    setPatternSyntaxState({
      tone: "success",
      message: "등록 가능한 정규식입니다.",
    });
  }

  function runPatternTest() {
    if (details.length === 0) {
      setPatternTestState({
        tone: "error",
        message: "먼저 패턴을 1개 이상 등록해주세요.",
      });
      return;
    }

    if (!patternTestText.trim()) {
      setPatternTestState({
        tone: "error",
        message: "테스트할 문장을 입력해주세요.",
      });
      return;
    }

    const matched = details.filter((pattern) => {
      const regexResult = tryCreateRegex(pattern);
      if (typeof regexResult === "string") {
        return false;
      }
      return regexResult.test(patternTestText);
    });

    setPatternTestState(
      matched.length > 0
        ? {
            tone: "success",
            message: `일치하는 패턴: ${matched.join(", ")}`,
          }
        : {
            tone: "error",
            message: "일치하는 패턴이 없습니다.",
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
        setDetailError("패턴을 1개 이상 등록해주세요.");
        return;
      }
      const invalidPattern = normalizedDetails.find((pattern) => typeof tryCreateRegex(pattern) === "string");
      if (invalidPattern) {
        setDetailError(`'${invalidPattern}' 정규식이 올바르지 않습니다.`);
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

  const dialogTitle = target.mode === "new" ? "개체값 생성" : "개체값 수정";

  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div className="entity-sub-dialog entity-sub-dialog--value" role="dialog" aria-modal="true" aria-label={dialogTitle}>
        <div className="entity-editor-dialog__header">
          <strong>{dialogTitle}</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label="닫기" onClick={onClose}>
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
              <strong>유형</strong>
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
                동의어
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
                패턴
              </label>
            </div>
          </div>

          {rowType === "S" ? (
            <section className="entity-value-dialog__section">
              <div className="dictionary-editor-dialog__controls">
                <label className="dictionary-editor-dialog__field">
                  <span>동의어 검색</span>
                  <input
                    type="text"
                    className="dictionary-editor-dialog__input"
                    value={detailSearch}
                    onChange={(event) => setDetailSearch(event.target.value)}
                    placeholder="동의어를 검색하세요."
                  />
                </label>

                <label className="dictionary-editor-dialog__field dictionary-editor-dialog__add-field">
                  <span>동의어</span>
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
                      추가
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
                  <strong>동의어 목록</strong>
                </div>
                <button
                  type="button"
                  className="secondary-action secondary-action--danger"
                  disabled={selectedDetails.length === 0}
                  onClick={deleteSelectedDetails}
                >
                  삭제
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
                  <span>동의어</span>
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
                    {detailSearch.trim() ? "검색 조건에 맞는 동의어가 없습니다." : "등록된 동의어가 없습니다."}
                  </div>
                ) : null}
              </div>
            </section>
          ) : (
            <section className="entity-value-dialog__section">
              <label className="dictionary-editor-dialog__field">
                <span>
                  패턴 <em>*</em>
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
                  정규식 확인
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
                  <strong>패턴 목록</strong>
                </div>
                <button
                  type="button"
                  className="secondary-action secondary-action--danger"
                  disabled={selectedDetails.length === 0}
                  onClick={deleteSelectedDetails}
                >
                  삭제
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
                  <span>패턴</span>
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

                {details.length === 0 ? <div className="entity-detail__empty">등록된 패턴이 없습니다.</div> : null}
              </div>

              <div className="entity-value-dialog__pattern-test">
                <strong>정규식 테스트</strong>
                <div className="entity-value-dialog__pattern-test-row">
                  <input
                    type="text"
                    className="dictionary-editor-dialog__input"
                    value={patternTestText}
                    onChange={(event) => setPatternTestText(event.target.value)}
                    placeholder="테스트할 문장을 입력하세요."
                  />
                  <button type="button" className="secondary-action" onClick={runPatternTest}>
                    테스트
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
            취소
          </button>
          <button type="button" className="primary-action" onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

export function EntityEditorDialog({ authSession, bot, entity, onClose, onSaved }: EntityEditorDialogProps) {
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
      onSaved(nextBot, "개체값이 저장되었습니다.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "개체값 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const dialogTitle = isSystem
    ? `${currentEntity.name} 시스템 개체`
    : currentEntity.rows.length === 0
      ? "개체값 조회(개체 생성)"
      : "개체값 조회";

  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div className="entity-editor-dialog" role="dialog" aria-modal="true" aria-label={dialogTitle}>
        <div className="entity-editor-dialog__header">
          <strong>{dialogTitle}</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>

        <div className={`entity-editor-dialog__body${isSystem ? "" : " entity-editor-dialog__body--list"}`}>
          {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}
          {message ? <p className="form-message form-message--success">{message}</p> : null}

          {isSystem ? (
            <section className="entity-editor-dialog__system-sheet">
              <p className="entity-editor-dialog__system-note">
                시스템 개체는 AIDOT 시스템이 제공하는 기본 개체로 수정하거나 삭제할 수 없습니다.
              </p>

              <div className="entity-editor-dialog__system-grid">
                <article className="entity-editor-dialog__system-card">
                  <span>구분</span>
                  <strong>시스템 개체</strong>
                </article>
                <article className="entity-editor-dialog__system-card">
                  <span>사전종류</span>
                  <strong>{currentEntity.systemKind === "regex" ? "regex" : "look-up"}</strong>
                </article>
                <article className="entity-editor-dialog__system-card">
                  <span>표준 표현</span>
                  <strong>{currentEntity.standardExpression || "-"}</strong>
                </article>
                <article className="entity-editor-dialog__system-card">
                  <span>개체명</span>
                  <strong>{currentEntity.name}</strong>
                </article>
              </div>

              <div className="entity-editor-dialog__system-examples">
                <span>예제</span>
                <ul>
                  {(currentEntity.examples ?? []).map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>
              </div>

              <div className="entity-editor-dialog__system-test">
                <span>문장 테스트</span>
                <div className="entity-editor-dialog__system-test-grid">
                  <textarea
                    className="dictionary-editor-dialog__textarea"
                    value={systemTestText}
                    onChange={(event) => setSystemTestText(event.target.value)}
                    placeholder="예: 내 전화번호는 010-4350-1234 입니다."
                  />
                  <div className="entity-editor-dialog__system-test-result">
                    <strong>추출 결과</strong>
                    {!systemTestText.trim() ? (
                      <p>테스트할 문장을 입력해주세요.</p>
                    ) : systemMatches.length === 0 ? (
                      <p>추출된 값이 없습니다.</p>
                    ) : (
                      <div className="entity-editor-dialog__system-test-table">
                        <div className="entity-editor-dialog__system-test-table-head">
                          <span>원문값</span>
                          <span>표준값(target)</span>
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
                  <strong>전체 {filteredRows.length}건</strong>
                  <label className="manual-main__mini-select manual-main__mini-select--select">
                    <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as DialogPageSize)}>
                      <option value={5}>5개씩 보기</option>
                      <option value={10}>10개씩 보기</option>
                      <option value={25}>25개씩 보기</option>
                      <option value={50}>50개씩 보기</option>
                      <option value={100}>100개씩 보기</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="manual-main__ghost-button"
                    disabled={selectedRowIds.length === 0}
                    onClick={handleDeleteSelectedRows}
                  >
                    삭제
                  </button>
                </div>

                <div className="entity-editor-dialog__toolbar-right">
                  <button type="button" className="manual-main__ghost-button" onClick={() => setDictionaryImportOpen(true)}>
                    + 사전 불러오기
                  </button>
                  <button
                    type="button"
                    className="manual-main__action-button"
                    onClick={() => setRowEditorTarget({ mode: "new", row: createEmptyEntityValueRow() })}
                  >
                    + 개체값 추가
                  </button>
                </div>
              </div>

              <label className="entity-editor-dialog__search">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="개체값, 동의어 또는 패턴을 검색하세요."
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
                    <span>개체값</span>
                    <span>유형</span>
                    <span>동의어/패턴</span>
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
                    <div className="entity-detail__empty">등록된 개체값이 없습니다. 먼저 개체값을 추가해주세요.</div>
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
            취소
          </button>
          {!isSystem ? (
            <button type="button" className="primary-action" disabled={saving} onClick={() => void handlePersist()}>
              {saving ? "저장 중..." : "저장"}
            </button>
          ) : null}
        </div>
      </div>

      {!isSystem && rowEditorTarget ? (
        <EntityValueItemDialog
          existingRows={currentEntity.rows}
          target={rowEditorTarget}
          onClose={() => setRowEditorTarget(null)}
          onSave={handleSaveRow}
        />
      ) : null}

      {!isSystem && dictionaryImportOpen ? (
        <DictionaryImportDialog
          dictionary={dictionary}
          onClose={() => setDictionaryImportOpen(false)}
          onImport={handleImportDictionary}
        />
      ) : null}
    </div>
  );
}
