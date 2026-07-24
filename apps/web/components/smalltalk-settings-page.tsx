"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { buildSmalltalkText, parseSmalltalkText } from "@/lib/asset-text-format";
import {
  type SmalltalkItemConfig,
  type SmalltalkPriority,
  type SmalltalkSettingsConfig,
} from "@/lib/bot-settings";
import { SortHeaderLabel } from "@/components/sort-header-label";
import { BotSettingsShell } from "@/components/bot-settings-shell";
import { loadAuthSession } from "@/lib/auth";
import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";

type SortKey = "title" | "priority" | "userMessages" | "botMessages" | "updatedAt" | "updatedBy";
type MessageKind = "user" | "bot";

const priorityRank: Record<SmalltalkPriority, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

function compactTextList(value: unknown, fallback = "") {
  const values = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const result = values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });

  const trimmedFallback = fallback.trim();
  if (result.length === 0 && trimmedFallback) {
    result.push(trimmedFallback);
  }

  return result;
}

function normalizeSmalltalkItem(item: SmalltalkItemConfig): SmalltalkItemConfig {
  const userMessages = compactTextList(item.userMessages, item.utterance);
  const botMessages = compactTextList(item.botMessages, item.response);
  const updatedBy = item.updatedBy?.trim() || item.createdBy?.trim() || "";
  const updatedAt = item.updatedAt?.trim() || item.createdAt?.trim() || "";

  return {
    ...item,
    priority: item.priority ?? "Medium",
    userMessages,
    botMessages,
    utterance: userMessages[0] ?? "",
    response: botMessages[0] ?? "",
    updatedBy,
    updatedAt,
  };
}

function normalizeSmalltalkSettings(settings: SmalltalkSettingsConfig): SmalltalkSettingsConfig {
  return {
    ...settings,
    items: settings.items.map(normalizeSmalltalkItem),
  };
}

function createSmalltalkItem(): SmalltalkItemConfig {
  return {
    id: crypto.randomUUID(),
    title: "",
    priority: "Medium",
    utterance: "",
    response: "",
    userMessages: [],
    botMessages: [],
    enabled: true,
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

function messageCount(value: unknown, fallback = "") {
  return compactTextList(value, fallback).length;
}

export function SmalltalkSettingsPage() {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  return (
    <BotSettingsShell activeMenu="smalltalk">
      {({ versionSettings, saveVersionSettings, setErrorMessage, setMessage }) => {
        const session = loadAuthSession();
        const editorName = session?.user?.name?.trim() || "";
        const fileInputRef = useRef<HTMLInputElement | null>(null);
        const moreMenuRef = useRef<HTMLDivElement | null>(null);
        const initialSettings = normalizeSmalltalkSettings(versionSettings.smalltalk);
        const [form, setForm] = useState<SmalltalkSettingsConfig>(initialSettings);
        const [selectedIds, setSelectedIds] = useState<string[]>([]);
        const [editor, setEditor] = useState<SmalltalkItemConfig>(createSmalltalkItem());
        const [editorOpen, setEditorOpen] = useState(false);
        const [userMessageDraft, setUserMessageDraft] = useState("");
        const [botMessageDraft, setBotMessageDraft] = useState("");
        const [selectedUserMessageIndexes, setSelectedUserMessageIndexes] = useState<number[]>([]);
        const [selectedBotMessageIndexes, setSelectedBotMessageIndexes] = useState<number[]>([]);
        const [query, setQuery] = useState("");
        const [sortKey, setSortKey] = useState<SortKey>("title");
        const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
        const [saving, setSaving] = useState(false);
        const [pageSize, setPageSize] = useState(10);
        const [page, setPage] = useState(1);
        const [moreMenuOpen, setMoreMenuOpen] = useState(false);

        useEffect(() => {
          const nextSettings = normalizeSmalltalkSettings(versionSettings.smalltalk);
          setForm(nextSettings);
          setSelectedIds([]);
          setEditor(createSmalltalkItem());
          setEditorOpen(false);
          resetMessageEditorState();
          setQuery("");
          setPage(1);
          setMoreMenuOpen(false);
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
          const keyword = query.trim().toLowerCase();
          const filtered = keyword
            ? form.items.filter((item) =>
                normalizeSmalltalkItem(item).title.toLowerCase().includes(keyword),
              )
            : form.items;

          return [...filtered].sort((left, right) => {
            const normalizedLeft = normalizeSmalltalkItem(left);
            const normalizedRight = normalizeSmalltalkItem(right);
            let leftValue: string | number;
            let rightValue: string | number;

            if (sortKey === "priority") {
              leftValue = priorityRank[normalizedLeft.priority ?? "Medium"];
              rightValue = priorityRank[normalizedRight.priority ?? "Medium"];
            } else if (sortKey === "userMessages") {
              leftValue = messageCount(normalizedLeft.userMessages, normalizedLeft.utterance);
              rightValue = messageCount(normalizedRight.userMessages, normalizedRight.utterance);
            } else if (sortKey === "botMessages") {
              leftValue = messageCount(normalizedLeft.botMessages, normalizedLeft.response);
              rightValue = messageCount(normalizedRight.botMessages, normalizedRight.response);
            } else {
              leftValue = String(normalizedLeft[sortKey] ?? "").toLowerCase();
              rightValue = String(normalizedRight[sortKey] ?? "").toLowerCase();
            }

            if (leftValue === rightValue) {
              return 0;
            }
            const compare = leftValue > rightValue ? 1 : -1;
            return sortDirection === "asc" ? compare : compare * -1;
          });
        }, [form.items, query, sortDirection, sortKey]);

        const pageCount = Math.max(1, Math.ceil(visibleItems.length / pageSize));
        const currentPage = Math.min(page, pageCount);
        const pagedItems = useMemo(
          () => visibleItems.slice((currentPage - 1) * pageSize, currentPage * pageSize),
          [currentPage, pageSize, visibleItems],
        );
        const allPagedSelected =
          pagedItems.length > 0 && pagedItems.every((item) => selectedIds.includes(item.id));

        const editorUserMessages = compactTextList(editor.userMessages, editor.utterance);
        const editorBotMessages = compactTextList(editor.botMessages, editor.response);

        useEffect(() => {
          setPage(1);
        }, [pageSize, query, sortDirection, sortKey]);

        useEffect(() => {
          if (page > pageCount) {
            setPage(pageCount);
          }
        }, [page, pageCount]);

        function resetMessageEditorState() {
          setUserMessageDraft("");
          setBotMessageDraft("");
          setSelectedUserMessageIndexes([]);
          setSelectedBotMessageIndexes([]);
        }

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

        function openEditor(item: SmalltalkItemConfig) {
          setEditor(normalizeSmalltalkItem(item));
          resetMessageEditorState();
          setEditorOpen(true);
        }

        function updateEditorMessages(kind: MessageKind, messages: string[]) {
          const nextMessages = compactTextList(messages);
          setEditor((current) =>
            kind === "user"
              ? {
                  ...current,
                  userMessages: nextMessages,
                  utterance: nextMessages[0] ?? "",
                }
              : {
                  ...current,
                  botMessages: nextMessages,
                  response: nextMessages[0] ?? "",
                },
          );
        }

        function addUserMessage() {
          const nextMessage = userMessageDraft.trim();
          if (!nextMessage) {
            setErrorMessage("사용자 메시지를 입력해주세요.");
            return;
          }
          setErrorMessage("");
          updateEditorMessages("user", [...editorUserMessages, nextMessage]);
          setUserMessageDraft("");
        }

        function addBotMessage() {
          const nextMessage = botMessageDraft.trim();
          if (!nextMessage) {
            setErrorMessage("봇 메시지를 입력해주세요.");
            return;
          }
          setErrorMessage("");
          updateEditorMessages("bot", [...editorBotMessages, nextMessage]);
          setBotMessageDraft("");
        }

        function toggleSelectedIndex(kind: MessageKind, index: number, checked: boolean) {
          const setter = kind === "user" ? setSelectedUserMessageIndexes : setSelectedBotMessageIndexes;
          setter((current) => {
            if (checked) {
              return current.includes(index) ? current : [...current, index];
            }
            return current.filter((item) => item !== index);
          });
        }

        function removeSelectedUserMessages() {
          updateEditorMessages(
            "user",
            editorUserMessages.filter((_, index) => !selectedUserMessageIndexes.includes(index)),
          );
          setSelectedUserMessageIndexes([]);
        }

        function removeSelectedBotMessages() {
          updateEditorMessages(
            "bot",
            editorBotMessages.filter((_, index) => !selectedBotMessageIndexes.includes(index)),
          );
          setSelectedBotMessageIndexes([]);
        }

        async function persistItems(nextItems: SmalltalkItemConfig[], successMessage: string) {
          const nextSettings = normalizeSmalltalkSettings({
            ...form,
            items: nextItems,
          });
          setSaving(true);
          setErrorMessage("");
          setMessage("");
          try {
            await saveVersionSettings(
              {
                smalltalk: nextSettings,
              },
              successMessage,
            );
            setForm(nextSettings);
            return true;
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "스몰토크 저장 중 오류가 발생했습니다.");
            return false;
          } finally {
            setSaving(false);
          }
        }

        async function handleReflectEditor() {
          const normalizedEditor = normalizeSmalltalkItem({
            ...editor,
            updatedAt: new Date().toISOString(),
            updatedBy: editorName,
            createdAt: editor.createdAt || new Date().toISOString(),
            createdBy: editor.createdBy || editorName,
          });
          if (!normalizedEditor.title.trim() || !normalizedEditor.userMessages?.length || !normalizedEditor.botMessages?.length) {
            setErrorMessage("스몰토크명, 사용자 메시지, 봇 메시지를 모두 입력해주세요.");
            return;
          }

          const currentIndex = form.items.findIndex((item) => item.id === normalizedEditor.id);
          const nextItems =
            currentIndex === -1
              ? [...form.items, normalizedEditor]
              : form.items.map((item, index) => (index === currentIndex ? normalizedEditor : item));
          const saved = await persistItems(nextItems, "스몰토크 설정이 저장되었습니다.");
          if (!saved) {
            return;
          }
          setSelectedIds([normalizedEditor.id]);
          setEditorOpen(false);
          resetMessageEditorState();
        }

        async function handleDeleteSelected() {
          if (selectedIds.length === 0) {
            return;
          }
          const nextItems = form.items.filter((item) => !selectedIds.includes(item.id));
          const saved = await persistItems(nextItems, "스몰토크 설정이 저장되었습니다.");
          if (!saved) {
            return;
          }
          setSelectedIds([]);
        }

        async function handleUploadFile(file: File) {
          try {
            const text = await file.text();
            const uploaded = parseSmalltalkText(text);
            if (uploaded.length === 0) {
              setErrorMessage("업로드 가능한 스몰토크가 없습니다.");
              return;
            }
            const stamped = uploaded.map((item) => ({
              ...item,
              createdAt: item.createdAt || new Date().toISOString(),
              createdBy: item.createdBy || editorName,
              updatedAt: item.updatedAt || new Date().toISOString(),
              updatedBy: item.updatedBy || editorName,
            }));
            const nextItems = [...form.items, ...stamped];
            setMoreMenuOpen(false);
            await persistItems(nextItems, `${uploaded.length}개의 스몰토크를 불러왔습니다.`);
          } catch {
            setErrorMessage("스몰토크 업로드 파일을 읽지 못했습니다.");
          }
        }

        function handleDownload() {
          setMoreMenuOpen(false);
          const blob = new Blob([buildSmalltalkText(form.items)], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "Smalltalk.txt";
          link.click();
          URL.revokeObjectURL(url);
        }

        return (
          <>
            <section className="bot-settings-section">
              <h2>{getStudioPageLabel(copy,"스몰토크")}</h2>

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
                    placeholder={getStudioPageLabel(copy,"스몰토크 이름을 검색하세요.")}
                  />
                  <button type="button" className="settings-search-inline__filter" aria-label={getStudioPageLabel(copy,"필터")}>
                    ▾
                  </button>
                </div>

                <div className="settings-toolbar__group">
                  <button
                    type="button"
                    className="primary-action"
                    disabled={saving}
                    onClick={() => openEditor(createSmalltalkItem())}
                  >{getStudioPageLabel(copy,"+ 스몰토크 추가")}</button>
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

              <div className="settings-toolbar settings-toolbar--subtle">
                <span className="bot-settings-page__caption">전체 {visibleItems.length}</span>
                <select
                  className="settings-toolbar__select settings-toolbar__select--compact"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  <option value={10}>10개씩 보기</option>
                  <option value={30}>30개씩 보기</option>
                  <option value={50}>50개씩 보기</option>
                </select>
                <button
                  type="button"
                  className="secondary-action secondary-action--danger"
                  disabled={saving || selectedIds.length === 0}
                  onClick={() => void handleDeleteSelected()}
                >{getStudioPageLabel(copy,"삭제")}</button>
              </div>

              <div className="settings-list-card">
                <div className="settings-list-card__header settings-list-card__header--smalltalk">
                  <span className="settings-list-card__check">
                    <input
                      type="checkbox"
                      checked={allPagedSelected}
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
                  <button type="button" className="settings-sort-button" onClick={() => toggleSort("title")}>
                    <SortHeaderLabel label="스몰토크 이름" direction={sortKey === "title" ? sortDirection : "none"} />
                  </button>
                  <button type="button" className="settings-sort-button" onClick={() => toggleSort("priority")}>
                    <SortHeaderLabel label="우선순위" direction={sortKey === "priority" ? sortDirection : "none"} />
                  </button>
                  <button type="button" className="settings-sort-button" onClick={() => toggleSort("userMessages")}>
                    <SortHeaderLabel label="사용자 메시지" direction={sortKey === "userMessages" ? sortDirection : "none"} />
                  </button>
                  <button type="button" className="settings-sort-button" onClick={() => toggleSort("botMessages")}>
                    <SortHeaderLabel label="봇 메시지" direction={sortKey === "botMessages" ? sortDirection : "none"} />
                  </button>
                  <button type="button" className="settings-sort-button" onClick={() => toggleSort("updatedAt")}>
                    <SortHeaderLabel label="최종수정일시" direction={sortKey === "updatedAt" ? sortDirection : "none"} />
                  </button>
                  <button type="button" className="settings-sort-button" onClick={() => toggleSort("updatedBy")}>
                    <SortHeaderLabel label="최종수정자" direction={sortKey === "updatedBy" ? sortDirection : "none"} />
                  </button>
                </div>

                {pagedItems.length === 0 ? (
                  <p className="bot-settings-page__loading">{getStudioPageLabel(copy,"등록된 스몰토크가 없습니다.")}</p>
                ) : null}

                {pagedItems.map((item) => {
                  const normalizedItem = normalizeSmalltalkItem(item);
                  return (
                    <div key={normalizedItem.id} className="settings-list-row settings-list-row--smalltalk">
                      <span className="settings-list-card__check">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(normalizedItem.id)}
                          onChange={() => toggleSelection(normalizedItem.id)}
                        />
                      </span>
                      <button type="button" className="settings-link-button" onClick={() => openEditor(normalizedItem)}>
                        {normalizedItem.title}
                      </button>
                      <span>{normalizedItem.priority ?? "Medium"}</span>
                      <span>{messageCount(normalizedItem.userMessages, normalizedItem.utterance)}</span>
                      <span>{messageCount(normalizedItem.botMessages, normalizedItem.response)}</span>
                      <span>{formatDateTime(normalizedItem.updatedAt)}</span>
                      <span>{normalizedItem.updatedBy || "-"}</span>
                    </div>
                  );
                })}
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

              {editorOpen ? (
                <div className="settings-dialog-backdrop" role="presentation" onClick={() => setEditorOpen(false)}>
                  <div
                    className="settings-dialog settings-dialog--smalltalk"
                    role="dialog"
                    aria-modal="true"
                    aria-label={getStudioPageLabel(copy,"스몰토크 상세")}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="settings-dialog__header">
                      <strong>{form.items.some((item) => item.id === editor.id) ? "스몰토크 수정" : "스몰토크 추가"}</strong>
                      <button type="button" className="settings-dialog__close" onClick={() => setEditorOpen(false)} aria-label={getStudioPageLabel(copy,"닫기")}>
                        ×
                      </button>
                    </div>
                    <div className="settings-dialog__body settings-dialog__body--form">
                      <div className="settings-smalltalk-meta-grid">
                        <label className="settings-smalltalk-field">
                          <span>{getStudioPageLabel(copy,"스몰토크 이름*")}</span>
                          <span>
                            <input
                              type="text"
                              className="bot-settings-card__input"
                              value={editor.title}
                              maxLength={40}
                              onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))}
                              placeholder="유일한 스몰토크 이름을 입력하세요."
                            />
                            <em>한글/영문/숫자/공백/특수문자 -_()[]:; 만 입력/40</em>
                          </span>
                        </label>

                        <label className="settings-smalltalk-field">
                          <span>우선순위*</span>
                          <select
                            className="bot-settings-card__select"
                            value={editor.priority ?? "Medium"}
                            onChange={(event) =>
                              setEditor((current) => ({
                                ...current,
                                priority: event.target.value as SmalltalkPriority,
                              }))
                            }
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </label>

                        <div className="settings-smalltalk-meta">
                          <span>
                            <strong>{getStudioPageLabel(copy,"등록자")}</strong>
                            {editor.createdBy || "-"}
                          </span>
                          <span>
                            <strong>{getStudioPageLabel(copy,"등록일자")}</strong>
                            {formatDateTime(editor.createdAt)}
                          </span>
                          <span>
                            <strong>{getStudioPageLabel(copy,"최종수정자")}</strong>
                            {editor.updatedBy || "-"}
                          </span>
                          <span>
                            <strong>{getStudioPageLabel(copy,"최종수정일시")}</strong>
                            {formatDateTime(editor.updatedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="settings-message-grid settings-message-grid--smalltalk">
                        <section className="settings-message-panel">
                          <div className="settings-message-panel__header">
                            <span className="settings-message-panel__title">
                              사용자 메시지*
                              <strong className="settings-message-panel__count">{editorUserMessages.length}</strong>
                            </span>
                            <button
                              type="button"
                              className="secondary-action"
                              disabled={selectedUserMessageIndexes.length === 0}
                              onClick={removeSelectedUserMessages}
                            >{getStudioPageLabel(copy,"삭제")}</button>
                          </div>
                          <div className="settings-message-input-row">
                            <input
                              type="text"
                              value={userMessageDraft}
                              onChange={(event) => setUserMessageDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  addUserMessage();
                                }
                              }}
                              placeholder={getStudioPageLabel(copy,"사용자 메시지가 될 수 있는 문장을 입력하세요.")}
                            />
                            <button type="button" onClick={addUserMessage} aria-label={getStudioPageLabel(copy,"사용자 메시지 추가")}>
                              +
                            </button>
                          </div>
                          <div className="settings-message-list">
                            <div className="settings-message-list__header">
                              <input
                                type="checkbox"
                                checked={editorUserMessages.length > 0 && selectedUserMessageIndexes.length === editorUserMessages.length}
                                onChange={(event) =>
                                  setSelectedUserMessageIndexes(event.target.checked ? editorUserMessages.map((_, index) => index) : [])
                                }
                                aria-label="사용자 메시지 전체 선택"
                              />
                              <span>{getStudioPageLabel(copy,"사용자 메시지")}</span>
                            </div>
                            {editorUserMessages.length === 0 ? (
                              <p className="settings-message-list__empty">{getStudioPageLabel(copy,"등록된 사용자 메시지가 없습니다.")}</p>
                            ) : null}
                            {editorUserMessages.map((message, index) => (
                              <label key={`${message}-${index}`} className="settings-message-list__row">
                                <input
                                  type="checkbox"
                                  checked={selectedUserMessageIndexes.includes(index)}
                                  onChange={(event) => toggleSelectedIndex("user", index, event.target.checked)}
                                />
                                <span>{message}</span>
                              </label>
                            ))}
                          </div>
                        </section>

                        <section className="settings-message-panel">
                          <div className="settings-message-panel__header">
                            <span className="settings-message-panel__title">
                              봇 메시지*
                              <strong className="settings-message-panel__count">{editorBotMessages.length}</strong>
                            </span>
                            <button
                              type="button"
                              className="secondary-action"
                              disabled={selectedBotMessageIndexes.length === 0}
                              onClick={removeSelectedBotMessages}
                            >{getStudioPageLabel(copy,"삭제")}</button>
                          </div>
                          <div className="settings-message-input-row">
                            <input
                              type="text"
                              value={botMessageDraft}
                              onChange={(event) => setBotMessageDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  addBotMessage();
                                }
                              }}
                              placeholder={getStudioPageLabel(copy,"봇 메시지가 될 수 있는 문장을 입력하십시오. 메시지는 사용자에게 무작위로 표시됩니다.")}
                            />
                            <button type="button" onClick={addBotMessage} aria-label={getStudioPageLabel(copy,"봇 메시지 추가")}>
                              +
                            </button>
                          </div>
                          <div className="settings-message-list">
                            <div className="settings-message-list__header">
                              <input
                                type="checkbox"
                                checked={editorBotMessages.length > 0 && selectedBotMessageIndexes.length === editorBotMessages.length}
                                onChange={(event) =>
                                  setSelectedBotMessageIndexes(event.target.checked ? editorBotMessages.map((_, index) => index) : [])
                                }
                                aria-label="봇 메시지 전체 선택"
                              />
                              <span>{getStudioPageLabel(copy,"봇 메시지")}</span>
                            </div>
                            {editorBotMessages.length === 0 ? (
                              <p className="settings-message-list__empty">{getStudioPageLabel(copy,"등록된 봇 메시지가 없습니다.")}</p>
                            ) : null}
                            {editorBotMessages.map((message, index) => (
                              <label key={`${message}-${index}`} className="settings-message-list__row">
                                <input
                                  type="checkbox"
                                  checked={selectedBotMessageIndexes.includes(index)}
                                  onChange={(event) => toggleSelectedIndex("bot", index, event.target.checked)}
                                />
                                <span>{message}</span>
                              </label>
                            ))}
                          </div>
                        </section>
                      </div>
                    </div>
                    <div className="settings-dialog__footer">
                      <button type="button" className="secondary-action" onClick={() => setEditorOpen(false)}>{getStudioPageLabel(copy,"취소")}</button>
                      <button type="button" className="primary-action" disabled={saving} onClick={() => void handleReflectEditor()}>
                        {saving ? "저장 중..." : "확인"}
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
