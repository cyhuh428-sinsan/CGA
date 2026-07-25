"use client";

import { getStudioRuntimeMessage } from "@/lib/i18n/studio-runtime-native";

import { useEffect, useMemo, useRef, useState } from "react";

import { buildBlocklistText, parseBlocklistText } from "@/lib/asset-text-format";
import { type BlocklistConfig } from "@/lib/bot-settings";
import { SortHeaderLabel } from "@/components/sort-header-label";
import { BotSettingsShell } from "@/components/bot-settings-shell";
import { loadAuthSession } from "@/lib/auth";
import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";

type SortKey = "name" | "pattern" | "updatedAt" | "updatedBy";

function createEmptyBlocklist(): BlocklistConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    type: "word",
    pattern: "",
    description: "",
    enabled: true,
    updatedAt: "",
    updatedBy: "",
  };
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function tryCreateRuntimeRegex(pattern: string) {
  const rawPattern = pattern.trim();
  const literalMatch = rawPattern.match(/^\/(.+)\/([dgimsuvy]*)$/);
  const source = literalMatch ? literalMatch[1] : rawPattern;
  const flags = literalMatch ? literalMatch[2] : "i";
  return new RegExp(source, flags);
}

export function BlocklistSettingsPage() {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  return (
    <BotSettingsShell activeMenu="blocklist">
      {({ versionSettings, saveVersionSettings, setErrorMessage, setMessage }) => {
        const session = loadAuthSession();
        const editorName = session?.user?.name?.trim() || "";
        const fileInputRef = useRef<HTMLInputElement | null>(null);
        const moreMenuRef = useRef<HTMLDivElement | null>(null);
        const [items, setItems] = useState<BlocklistConfig[]>(versionSettings.blocklists);
        const [editor, setEditor] = useState<BlocklistConfig>(versionSettings.blocklists[0] ?? createEmptyBlocklist());
        const [editorOpen, setEditorOpen] = useState(false);
        const [moreMenuOpen, setMoreMenuOpen] = useState(false);
        const [selectedIds, setSelectedIds] = useState<string[]>([]);
        const [query, setQuery] = useState("");
        const [testSentence, setTestSentence] = useState("");
        const [sortKey, setSortKey] = useState<SortKey>("name");
        const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
        const [testResults, setTestResults] = useState<BlocklistConfig[]>([]);
        const [saving, setSaving] = useState(false);
        const [page, setPage] = useState(1);
        const pageSize = 15;

        useEffect(() => {
          setItems(versionSettings.blocklists);
          setSelectedIds([]);
          setEditor(versionSettings.blocklists[0] ?? createEmptyBlocklist());
          setTestResults([]);
          setPage(1);
        }, [versionSettings]);

        useEffect(() => {
          function handleOutsideClick(event: MouseEvent) {
            if (!moreMenuRef.current?.contains(event.target as Node)) {
              setMoreMenuOpen(false);
            }
          }

          document.addEventListener("mousedown", handleOutsideClick);
          return () => document.removeEventListener("mousedown", handleOutsideClick);
        }, []);

        const visibleItems = useMemo(() => {
          const normalizedQuery = query.trim().toLowerCase();
          const filtered = normalizedQuery
            ? items.filter(
                (item) =>
                  item.name.toLowerCase().includes(normalizedQuery) ||
                  item.pattern.toLowerCase().includes(normalizedQuery),
              )
            : items;

          return [...filtered].sort((left, right) => {
            const leftValue = String(left[sortKey] ?? "").toLowerCase();
            const rightValue = String(right[sortKey] ?? "").toLowerCase();
            if (leftValue === rightValue) {
              return 0;
            }
            const compare = leftValue > rightValue ? 1 : -1;
            return sortDirection === "asc" ? compare : compare * -1;
          });
        }, [items, query, sortDirection, sortKey]);

        const pageCount = Math.max(1, Math.ceil(visibleItems.length / pageSize));
        const currentPage = Math.min(page, pageCount);
        const pagedItems = useMemo(
          () => visibleItems.slice((currentPage - 1) * pageSize, currentPage * pageSize),
          [currentPage, visibleItems],
        );

        useEffect(() => {
          setPage(1);
        }, [query, sortDirection, sortKey]);

        useEffect(() => {
          if (page > pageCount) {
            setPage(pageCount);
          }
        }, [page, pageCount]);

        function toggleSort(nextKey: SortKey) {
          if (sortKey === nextKey) {
            setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
            return;
          }
          setSortKey(nextKey);
          setSortDirection("asc");
        }

        function toggleSelection(targetId: string) {
          setSelectedIds((current) =>
            current.includes(targetId) ? current.filter((id) => id !== targetId) : [...current, targetId],
          );
        }

        function openEditor(item: BlocklistConfig) {
          setEditor(item);
          setEditorOpen(true);
          setMoreMenuOpen(false);
        }

        async function persistItems(nextItems: BlocklistConfig[], successMessage: string) {
          setSaving(true);
          setErrorMessage("");
          setMessage("");
          try {
            await saveVersionSettings(
              {
                blocklists: nextItems,
              },
              successMessage,
            );
            setItems(nextItems);
            return true;
          } catch (error) {
            setErrorMessage(
              error instanceof Error ? error.message : "제외/무시 목록 저장 중 오류가 발생했습니다.",
            );
            return false;
          } finally {
            setSaving(false);
          }
        }

        async function handleSaveEditor() {
          if (!editor.name.trim() || !editor.pattern.trim()) {
            setErrorMessage(getStudioRuntimeMessage(uiLanguage, "제외/무시 목록 이름과 제외/무시 텍스트 또는 정규식을 입력해주세요."));
            return;
          }

          const nextEditor = {
            ...editor,
            updatedAt: new Date().toISOString(),
            updatedBy: editorName,
          };
          const currentIndex = items.findIndex((item) => item.id === nextEditor.id);
          const nextItems =
            currentIndex === -1
              ? [...items, nextEditor]
              : items.map((item, index) => (index === currentIndex ? nextEditor : item));
          const saved = await persistItems(nextItems, "제외/무시 목록 설정이 저장되었습니다.");
          if (!saved) {
            return;
          }
          setEditor(nextEditor);
          setEditorOpen(false);
        }

        async function moveSelected(direction: -1 | 1) {
          const selectedId = selectedIds[0];
          if (!selectedId) {
            return;
          }

          const index = items.findIndex((item) => item.id === selectedId);
          if (index === -1) {
            return;
          }
          const targetIndex = index + direction;
          if (targetIndex < 0 || targetIndex >= items.length) {
            return;
          }
          const nextItems = [...items];
          const [moved] = nextItems.splice(index, 1);
          nextItems.splice(targetIndex, 0, moved);
          await persistItems(nextItems, "제외/무시 목록 순서가 저장되었습니다.");
        }

        async function handleDeleteSelected() {
          if (selectedIds.length === 0) {
            return;
          }
          const nextItems = items.filter((item) => !selectedIds.includes(item.id));
          const saved = await persistItems(nextItems, "제외/무시 목록 설정이 저장되었습니다.");
          if (!saved) {
            return;
          }
          setSelectedIds([]);
        }

        function handleTest() {
          const normalized = testSentence.trim().toLowerCase();
          if (!normalized) {
            setTestResults([]);
            return;
          }

          setTestResults(
            items.filter((item) => {
              if (!item.enabled) {
                return false;
              }
              if (item.type === "regex") {
                try {
                  return tryCreateRuntimeRegex(item.pattern).test(testSentence);
                } catch {
                  return false;
                }
              }
              return normalized.includes(item.pattern.toLowerCase());
            }),
          );
        }

        async function handleUploadFile(file: File) {
          try {
            const text = await file.text();
            const uploaded = parseBlocklistText(text);
            if (uploaded.length === 0) {
              setErrorMessage(getStudioRuntimeMessage(uiLanguage, "업로드 가능한 제외/무시 목록이 없습니다."));
              return;
            }
            const stamped = uploaded.map((item) => ({
              ...item,
              updatedAt: item.updatedAt || new Date().toISOString(),
              updatedBy: item.updatedBy || editorName,
            }));
            const nextItems = [...items];
            let addedCount = 0;
            let updatedCount = 0;
            stamped.forEach((uploadedItem) => {
              const normalizedName = uploadedItem.name.trim().toLocaleLowerCase();
              const existingIndex = nextItems.findIndex(
                (item) => item.name.trim().toLocaleLowerCase() === normalizedName,
              );
              if (existingIndex >= 0) {
                nextItems[existingIndex] = { ...uploadedItem, id: nextItems[existingIndex].id };
                updatedCount += 1;
              } else {
                nextItems.push(uploadedItem);
                addedCount += 1;
              }
            });
            setMoreMenuOpen(false);
            await persistItems(nextItems, `제외/무시 목록 업로드: 추가 ${addedCount}건, 갱신 ${updatedCount}건`);
          } catch {
            setErrorMessage(getStudioRuntimeMessage(uiLanguage, "제외/무시 목록 업로드 파일을 읽지 못했습니다."));
          }
        }

        function handleDownload() {
          setMoreMenuOpen(false);
          const blob = new Blob([buildBlocklistText(items)], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "Blocklist.txt";
          link.click();
          URL.revokeObjectURL(url);
        }

        return (
          <>
            <section className="bot-settings-section">
              <h2>{getStudioPageLabel(copy,"제외/무시 목록 설정")}</h2>
              <div className="settings-toolbar settings-toolbar--between">
                <div className="settings-search-inline">
                  <span className="settings-search-inline__icon" aria-hidden="true">
                    ⌕
                  </span>
                  <input
                    type="text"
                    className="settings-search-inline__input"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={getStudioPageLabel(copy, "제외/무시 목록 이름 또는 제외/무시 텍스트/정규식")}
                  />
                  <button type="button" className="settings-search-inline__filter" aria-label={getStudioPageLabel(copy,"필터")}>
                    ▾
                  </button>
                </div>

                <div className="settings-toolbar__group">
                  <button type="button" className="primary-action" disabled={saving} onClick={() => openEditor(createEmptyBlocklist())}>{getStudioPageLabel(copy,"+ 제외/무시 목록 추가")}</button>
                  <div className="settings-overflow" ref={moreMenuRef}>
                    <button
                      type="button"
                      className="secondary-action settings-overflow__trigger"
                      disabled={saving}
                      aria-haspopup="menu"
                      aria-expanded={moreMenuOpen}
                      onClick={() => setMoreMenuOpen((current) => !current)}
                    >
                      <span className="settings-overflow__dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      <span className="sr-only">{getStudioPageLabel(copy,"더보기")}</span>
                    </button>
                    {moreMenuOpen ? (
                      <div className="settings-overflow__menu" role="menu" aria-label={getStudioPageLabel(copy,"파일 메뉴")}>
                        <button
                          type="button"
                          role="menuitem"
                          className="settings-overflow__item"
                          disabled={saving}
                          onClick={() => fileInputRef.current?.click()}
                        >{getStudioPageLabel(copy,"파일 업로드")}</button>
                        <button
                          type="button"
                          role="menuitem"
                          className="settings-overflow__item"
                          disabled={saving}
                          onClick={handleDownload}
                        >{getStudioPageLabel(copy,"파일 다운로드")}</button>
                      </div>
                    ) : null}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleUploadFile(file);
                      }
                      event.target.value = "";
                    }}
                  />
                </div>
              </div>

              <div className="settings-search-grid settings-search-grid--test">
                <label className="settings-form-card">
                  <span>{getStudioPageLabel(copy, "발화 제외/무시 테스트")}</span>
                  <div className="settings-inline-actions">
                    <input
                      type="text"
                      className="bot-settings-card__input"
                      value={testSentence}
                      onChange={(event) => setTestSentence(event.target.value)}
                      placeholder={getStudioPageLabel(copy, "제외/무시 규칙을 시험할 발화")}
                    />
                    <button type="button" className="secondary-action" onClick={handleTest}>{getStudioPageLabel(copy,"테스트")}</button>
                  </div>
                </label>
              </div>

              <div className="settings-toolbar settings-toolbar--subtle">
                <span className="bot-settings-page__caption">전체 {visibleItems.length}</span>
                <button type="button" className="secondary-action secondary-action--danger" disabled={saving || selectedIds.length === 0} onClick={() => void handleDeleteSelected()}>{getStudioPageLabel(copy,"삭제")}</button>
                <div className="settings-toolbar__spacer" />
                <button type="button" className="secondary-action" disabled={saving || selectedIds.length === 0} onClick={() => void moveSelected(-1)}>
                  ↑
                </button>
                <button type="button" className="secondary-action" disabled={saving || selectedIds.length === 0} onClick={() => void moveSelected(1)}>
                  ↓
                </button>
              </div>

              <div className="settings-list-card">
                <div className="settings-list-card__header settings-list-card__header--blocklist">
                  <span className="settings-list-card__check">
                    <input
                      type="checkbox"
                      checked={pagedItems.length > 0 && pagedItems.every((item) => selectedIds.includes(item.id))}
                      onChange={(event) =>
                        setSelectedIds((current) => {
                          const pageIds = pagedItems.map((item) => item.id);
                          return event.target.checked
                            ? Array.from(new Set([...current, ...pageIds]))
                            : current.filter((id) => !pageIds.includes(id));
                        })
                      }
                    />
                  </span>
                  <button type="button" className="settings-sort-button" onClick={() => toggleSort("name")}>
                    <SortHeaderLabel label={getStudioPageLabel(copy, "제외/무시 목록 이름")} />
                  </button>
                  <span>{getStudioPageLabel(copy,"유형")}</span>
                  <button type="button" className="settings-sort-button" onClick={() => toggleSort("pattern")}>
                    <SortHeaderLabel label={getStudioPageLabel(copy, "제외/무시 텍스트/정규식")} />
                  </button>
                  <span>{getStudioPageLabel(copy,"사용")}</span>
                  <button type="button" className="settings-sort-button" onClick={() => toggleSort("updatedAt")}>
                    <SortHeaderLabel label={getStudioPageLabel(copy, "최종수정일시")} direction={sortKey === "updatedAt" ? sortDirection : "none"} />
                  </button>
                  <button type="button" className="settings-sort-button" onClick={() => toggleSort("updatedBy")}>
                    <SortHeaderLabel label={getStudioPageLabel(copy, "최종수정자")} direction={sortKey === "updatedBy" ? sortDirection : "none"} />
                  </button>
                </div>

                {pagedItems.map((item) => (
                  <div key={item.id} className="settings-list-row settings-list-row--blocklist">
                    <span className="settings-list-card__check">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelection(item.id)}
                      />
                    </span>
                    <button type="button" className="settings-link-button" onClick={() => openEditor(item)}>
                      {item.name}
                    </button>
                    <span>{item.type === "regex" ? getStudioRuntimeMessage(uiLanguage, "정규식") : getStudioRuntimeMessage(uiLanguage, "텍스트")}</span>
                    <span>{item.pattern}</span>
                    <span>{item.enabled ? getStudioRuntimeMessage(uiLanguage, "사용") : getStudioRuntimeMessage(uiLanguage, "미사용")}</span>
                    <span>{formatDateTime(item.updatedAt)}</span>
                    <span>{item.updatedBy || "-"}</span>
                  </div>
                ))}

                {pagedItems.length === 0 ? <p className="bot-settings-page__loading">{getStudioPageLabel(copy,"등록된 제외/무시 목록이 없습니다.")}</p> : null}
              </div>

              <div className="bot-settings-page__pagination">
                <button type="button" className="secondary-action" disabled={currentPage <= 1} onClick={() => setPage(1)}>
                  «
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  ‹
                </button>
                <strong>{currentPage}</strong>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                >
                  ›
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(pageCount)}
                >
                  »
                </button>
              </div>

              {testSentence.trim() ? (
                <div className="settings-test-result">
                  <strong>{getStudioPageLabel(copy, "제외/무시 규칙 테스트 결과")}</strong>
                  {testResults.length > 0 ? (
                    <ul>
                      {testResults.map((item) => (
                        <li key={item.id}>{item.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{getStudioPageLabel(copy, "적용되는 제외/무시 규칙이 없습니다.")}</p>
                  )}
                </div>
              ) : null}

              {editorOpen ? (
                <div className="settings-dialog-backdrop" role="presentation" onClick={() => setEditorOpen(false)}>
                  <div
                    className="settings-dialog settings-dialog--wide"
                    role="dialog"
                    aria-modal="true"
                    aria-label={getStudioPageLabel(copy,"제외/무시 목록 상세")}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="settings-dialog__header">
                      <strong>{getStudioPageLabel(copy,"제외/무시 목록 상세")}</strong>
                      <button type="button" className="settings-dialog__close" onClick={() => setEditorOpen(false)} aria-label={getStudioPageLabel(copy,"닫기")}>
                        ×
                      </button>
                    </div>
                    <div className="settings-dialog__body settings-dialog__body--form">
                      <div className="settings-form-grid settings-form-grid--compact">
                        <label className="settings-form-card">
                          <span>{getStudioPageLabel(copy,"제외/무시 목록 이름")}</span>
                          <input
                            type="text"
                            className="bot-settings-card__input"
                            value={editor.name}
                            onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value }))}
                          />
                        </label>

                        <label className="settings-form-card">
                          <span>{getStudioPageLabel(copy,"유형")}</span>
                          <select
                            className="bot-settings-card__select"
                            value={editor.type}
                            onChange={(event) =>
                              setEditor((current) => ({
                                ...current,
                                type: event.target.value as "word" | "regex",
                              }))
                            }
                          >
                            <option value="word">{getStudioPageLabel(copy, "텍스트 제외/무시")}</option>
                            <option value="regex">{getStudioPageLabel(copy, "정규식 제외/무시")}</option>
                          </select>
                        </label>

                        <label className="settings-form-card settings-form-card--wide">
                          <span>{getStudioPageLabel(copy,"제외/무시 텍스트/정규식")}</span>
                          <textarea
                            className="bot-settings-intro__textarea"
                            value={editor.pattern}
                            onChange={(event) => setEditor((current) => ({ ...current, pattern: event.target.value }))}
                          />
                        </label>

                        <label className="settings-form-card settings-form-card--wide">
                          <span>{getStudioPageLabel(copy,"설명")}</span>
                          <textarea
                            className="bot-settings-intro__textarea"
                            value={editor.description}
                            onChange={(event) => setEditor((current) => ({ ...current, description: event.target.value }))}
                          />
                        </label>

                        <label className="settings-form-card settings-form-card--check">
                          <input
                            type="checkbox"
                            checked={editor.enabled}
                            onChange={(event) => setEditor((current) => ({ ...current, enabled: event.target.checked }))}
                          />
                          <span>{getStudioPageLabel(copy,"사용 여부")}</span>
                        </label>
                      </div>
                    </div>
                    <div className="settings-dialog__footer">
                      <button type="button" className="secondary-action" disabled={saving} onClick={() => setEditorOpen(false)}>{getStudioPageLabel(copy,"취소")}</button>
                      <button type="button" className="primary-action" disabled={saving} onClick={() => void handleSaveEditor()}>
                        {saving ? getStudioRuntimeMessage(uiLanguage, "저장 중...") : getStudioRuntimeMessage(uiLanguage, "확인")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </>
        );
      }}
    </BotSettingsShell>
  );
}
