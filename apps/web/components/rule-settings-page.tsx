"use client";

import { getStudioRuntimeMessage } from "@/lib/i18n/studio-runtime-native";

import { useEffect, useMemo, useRef, useState } from "react";

import { buildRuleText, parseRuleText } from "@/lib/asset-text-format";
import { type RuleConfig } from "@/lib/bot-settings";
import { SortHeaderLabel } from "@/components/sort-header-label";
import { BotSettingsShell } from "@/components/bot-settings-shell";
import { type VersionDialogAsset } from "@/lib/version-document";
import { fetchStudioBotVersionDialogs } from "@/lib/studio-bots-api";
import { loadAuthSession } from "@/lib/auth";
import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";

type SortKey = "name" | "description" | "expression" | "target" | "enabled" | "updatedAt" | "updatedBy";

type RuleTargetOption = {
  value: string;
  label: string;
  typeLabel: string;
};

type RuleRegexTestState = {
  tone: "success" | "error";
  message: string;
} | null;

function createEmptyRule(): RuleConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    expression: "",
    target: "",
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

function tryCreateRuleRegex(pattern: string) {
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

function buildRuleTargetOption(dialog: VersionDialogAsset): RuleTargetOption | null {
  const value = (dialog.name || dialog.displayName || "").trim();
  if (!value) {
    return null;
  }

  const displayName = (dialog.displayName || dialog.name || value).trim();
  return {
    value,
    label: displayName,
    typeLabel: dialog.dialogType === 0 ? "모듈" : "의도",
  };
}

export function RuleSettingsPage() {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  return (
    <BotSettingsShell activeMenu="rules">
      {({ bot, token, versionSettings, saveVersionSettings, setErrorMessage, setMessage }) => {
        const session = loadAuthSession();
        const editorName = session?.user?.name?.trim() || "";
        const fileInputRef = useRef<HTMLInputElement | null>(null);
        const moreMenuRef = useRef<HTMLDivElement | null>(null);
        const [items, setItems] = useState<RuleConfig[]>(versionSettings.rules);
        const [editor, setEditor] = useState<RuleConfig>(versionSettings.rules[0] ?? createEmptyRule());
        const [editorOpen, setEditorOpen] = useState(false);
        const [moreMenuOpen, setMoreMenuOpen] = useState(false);
        const [selectedIds, setSelectedIds] = useState<string[]>([]);
        const [query, setQuery] = useState("");
        const [sortKey, setSortKey] = useState<SortKey>("name");
        const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
        const [saving, setSaving] = useState(false);
        const [testSentence, setTestSentence] = useState("");
        const [regexTestText, setRegexTestText] = useState("");
        const [regexTestState, setRegexTestState] = useState<RuleRegexTestState>(null);
        const [pageSize, setPageSize] = useState(30);
        const [page, setPage] = useState(1);
        const [targetDialogs, setTargetDialogs] = useState<VersionDialogAsset[]>(
          bot.active_version?.version_json?.dialogs ?? [],
        );

        useEffect(() => {
          setItems(versionSettings.rules);
          setSelectedIds([]);
          setQuery("");
          setTestSentence("");
          setPage(1);
          setEditor(versionSettings.rules[0] ?? createEmptyRule());
          setRegexTestText("");
          setRegexTestState(null);
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

        useEffect(() => {
          const versionId = bot.active_version?.id;
          if (!token || !bot.id || !versionId) {
            setTargetDialogs(bot.active_version?.version_json?.dialogs ?? []);
            return;
          }

          let ignore = false;
          const embeddedDialogs = bot.active_version?.version_json?.dialogs ?? [];
          if (embeddedDialogs.length > 0) {
            setTargetDialogs(embeddedDialogs);
            return;
          }

          fetchStudioBotVersionDialogs(token, bot.id, versionId)
            .then((data) => {
              if (!ignore) {
                setTargetDialogs(data.items);
              }
            })
            .catch(() => {
              if (!ignore) {
                setTargetDialogs([]);
              }
            });

          return () => {
            ignore = true;
          };
        }, [bot.active_version?.id, bot.active_version?.version_json?.dialogs, bot.id, token]);

        const visibleItems = useMemo(() => {
          const keyword = query.trim().toLowerCase();
          const filtered = keyword
            ? items.filter((item) =>
                [item.name, item.description, item.expression, item.target].some((value) =>
                  String(value ?? "")
                    .toLowerCase()
                    .includes(keyword),
                ),
              )
            : items;

          return [...filtered].sort((left, right) => {
            const leftValue =
              sortKey === "enabled" ? (left.enabled ? "1" : "0") : String(left[sortKey]).toLowerCase();
            const rightValue =
              sortKey === "enabled" ? (right.enabled ? "1" : "0") : String(right[sortKey]).toLowerCase();
            if (leftValue === rightValue) {
              return 0;
            }
            const compare = leftValue > rightValue ? 1 : -1;
            return sortDirection === "asc" ? compare : compare * -1;
          });
        }, [items, query, sortDirection, sortKey]);
        const targetOptions = useMemo(() => {
          const optionMap = new Map<string, RuleTargetOption>();

          targetDialogs.forEach((dialog) => {
            const option = buildRuleTargetOption(dialog);
            if (option && !optionMap.has(option.value)) {
              optionMap.set(option.value, option);
            }
          });

          return Array.from(optionMap.values()).sort((left, right) => {
            if (left.typeLabel !== right.typeLabel) {
              return left.typeLabel === "의도" ? -1 : 1;
            }
            return left.label.localeCompare(right.label, "ko");
          });
        }, [targetDialogs]);
        const hasEditorTargetInOptions = targetOptions.some((option) => option.value === editor.target);
        const pageCount = Math.max(1, Math.ceil(visibleItems.length / pageSize));
        const currentPage = Math.min(page, pageCount);
        const pagedItems = visibleItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
        const allPagedSelected =
          pagedItems.length > 0 && pagedItems.every((item) => selectedIds.includes(item.id));

        useEffect(() => {
          setPage((current) => Math.min(current, Math.max(1, Math.ceil(visibleItems.length / pageSize))));
        }, [pageSize, visibleItems.length]);

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

        function selectEditor(nextEditor: RuleConfig) {
          setEditor(nextEditor);
          setRegexTestState(null);
          setEditorOpen(true);
          setMoreMenuOpen(false);
        }

        async function persistItems(nextItems: RuleConfig[], successMessage: string) {
          setSaving(true);
          setErrorMessage("");
          setMessage("");
          try {
            await saveVersionSettings(
              {
                rules: nextItems,
              },
              successMessage,
            );
            setItems(nextItems);
            return true;
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : getStudioRuntimeMessage(uiLanguage, "룰 저장 중 오류가 발생했습니다."));
            return false;
          } finally {
            setSaving(false);
          }
        }

        function runRegexSyntaxCheck() {
          const expression = editor.expression.trim();
          if (!expression) {
            setRegexTestState({
              tone: "error",
              message: "먼저 룰 표현식을 입력해주세요.",
            });
            return;
          }

          const regexResult = tryCreateRuleRegex(expression);
          setRegexTestState(
            typeof regexResult === "string"
              ? {
                  tone: "error",
                  message: `정규식 문법 오류: ${regexResult}`,
                }
              : {
                  tone: "success",
                  message: "등록 가능한 정규식입니다.",
                },
          );
        }

        function runRegexTest() {
          const expression = editor.expression.trim();
          const testText = regexTestText.trim();
          if (!expression) {
            setRegexTestState({
              tone: "error",
              message: "먼저 룰 표현식을 입력해주세요.",
            });
            return;
          }

          if (!testText) {
            setRegexTestState({
              tone: "error",
              message: "테스트할 문장을 입력해주세요.",
            });
            return;
          }

          const regexResult = tryCreateRuleRegex(expression);
          if (typeof regexResult === "string") {
            setRegexTestState({
              tone: "error",
              message: `정규식 문법 오류: ${regexResult}`,
            });
            return;
          }

          setRegexTestState(
            regexResult.test(testText)
              ? {
                  tone: "success",
                  message: "룰 표현식과 일치합니다.",
                }
              : {
                  tone: "error",
                  message: "룰 표현식과 일치하지 않습니다.",
                },
          );
        }

        async function handleSaveEditor() {
          if (!editor.name.trim() || !editor.expression.trim()) {
            setErrorMessage(getStudioRuntimeMessage(uiLanguage, "룰 이름과 룰 표현식을 입력해주세요."));
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
          const saved = await persistItems(nextItems, "룰 설정이 저장되었습니다.");
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
          await persistItems(nextItems, "룰 순서가 저장되었습니다.");
        }

        async function handleDeleteSelected() {
          if (selectedIds.length === 0) {
            return;
          }
          const nextItems = items.filter((item) => !selectedIds.includes(item.id));
          const saved = await persistItems(nextItems, "룰 설정이 저장되었습니다.");
          if (!saved) {
            return;
          }
          setSelectedIds([]);
        }

        async function handleUploadFile(file: File) {
          try {
            const text = await file.text();
            const uploaded = parseRuleText(text);
            if (uploaded.length === 0) {
              setErrorMessage(getStudioRuntimeMessage(uiLanguage, "업로드 가능한 룰이 없습니다."));
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
            await persistItems(nextItems, `룰 업로드: 추가 ${addedCount}건, 갱신 ${updatedCount}건`);
          } catch {
            setErrorMessage(getStudioRuntimeMessage(uiLanguage, "룰 업로드 파일을 읽지 못했습니다."));
          }
        }

        function handleDownload() {
          setMoreMenuOpen(false);
          const blob = new Blob([buildRuleText(items)], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "Rule.txt";
          link.click();
          URL.revokeObjectURL(url);
        }

        const testResultText = useMemo(() => {
          const utterance = testSentence.trim();
          if (!utterance) {
            return "";
          }

          const matchedRule = items.find((item) => {
            if (!item.enabled || !item.expression.trim()) {
              return false;
            }
            const regexResult = tryCreateRuleRegex(item.expression);
            return typeof regexResult !== "string" && regexResult.test(utterance);
          });

          return matchedRule
            ? `${matchedRule.target || "의도/모듈 미연결"} 으로 연결됩니다.`
            : "룰이 매칭되지 않는 표현입니다.";
        }, [items, testSentence]);

        return (
          <>
            <section className="bot-settings-section">
              <h2>{getStudioPageLabel(copy,"룰 설정")}</h2>
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
                    placeholder={getStudioPageLabel(copy,"룰 이름을 검색하세요.")}
                  />
                  <button type="button" className="settings-search-inline__filter" aria-label={getStudioPageLabel(copy,"필터")}>
                    ▾
                  </button>
                </div>

                <div className="settings-toolbar__group">
                  <button type="button" className="primary-action" disabled={saving} onClick={() => selectEditor(createEmptyRule())}>{getStudioPageLabel(copy,"+ 룰 추가")}</button>
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
                  <span>{getStudioPageLabel(copy,"테스트")}</span>
                  <div className="settings-inline-actions settings-inline-actions--compact">
                    <input
                      type="text"
                      className="bot-settings-card__input"
                      value={testSentence}
                      onChange={(event) => setTestSentence(event.target.value)}
                      placeholder={getStudioPageLabel(copy,"테스트 표현을 입력하세요.")}
                    />
                    <button type="button" className="secondary-action">{getStudioPageLabel(copy,"테스트")}</button>
                  </div>
                </label>
                <div className="settings-form-card">
                  <span>{getStudioPageLabel(copy,"결과")}</span>
                  <p className="bot-settings-page__caption">{testResultText || getStudioRuntimeMessage(uiLanguage, "룰이 연결되는지 확인해보세요.")}</p>
                </div>
              </div>

              <div className="settings-toolbar settings-toolbar--subtle">
                <span className="bot-settings-page__caption">전체 {visibleItems.length}</span>
                <select
                  className="settings-toolbar__select"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  <option value={30}>{getStudioPageLabel(copy, "30개 보기")}</option>
                  <option value={50}>{getStudioPageLabel(copy, "50개 보기")}</option>
                  <option value={100}>{getStudioPageLabel(copy, "100개 보기")}</option>
                </select>
                <button
                  type="button"
                  className="secondary-action secondary-action--danger"
                  disabled={saving || selectedIds.length === 0}
                  onClick={() => void handleDeleteSelected()}
                >{getStudioPageLabel(copy,"삭제")}</button>
                <div className="settings-toolbar__spacer" />
                <button
                  type="button"
                  className="secondary-action"
                  disabled={saving || selectedIds.length === 0}
                  onClick={() => void moveSelected(-1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={saving || selectedIds.length === 0}
                  onClick={() => void moveSelected(1)}
                >
                  ↓
                </button>
              </div>

              <div className="settings-list-card">
                  <div className="settings-list-card__header settings-list-card__header--rule">
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
                    <span>{getStudioPageLabel(copy,"우선순위")}</span>
                    <button type="button" className="settings-sort-button" onClick={() => toggleSort("name")}>
                      <SortHeaderLabel label={getStudioPageLabel(copy, "룰 이름")} direction={sortKey === "name" ? sortDirection : "none"} />
                    </button>
                    <button type="button" className="settings-sort-button" onClick={() => toggleSort("expression")}>
                      <SortHeaderLabel label={getStudioPageLabel(copy, "룰 표현식")} direction={sortKey === "expression" ? sortDirection : "none"} />
                    </button>
                    <button type="button" className="settings-sort-button" onClick={() => toggleSort("target")}>
                      <SortHeaderLabel label={getStudioPageLabel(copy, "연결할 의도/모듈")} direction={sortKey === "target" ? sortDirection : "none"} />
                    </button>
                    <button type="button" className="settings-sort-button" onClick={() => toggleSort("enabled")}>
                      <SortHeaderLabel label={getStudioPageLabel(copy, "사용")} direction={sortKey === "enabled" ? sortDirection : "none"} />
                    </button>
                    <button type="button" className="settings-sort-button" onClick={() => toggleSort("updatedAt")}>
                      <SortHeaderLabel label={getStudioPageLabel(copy, "최종수정일시")} direction={sortKey === "updatedAt" ? sortDirection : "none"} />
                    </button>
                    <button type="button" className="settings-sort-button" onClick={() => toggleSort("updatedBy")}>
                      <SortHeaderLabel label={getStudioPageLabel(copy, "최종수정자")} direction={sortKey === "updatedBy" ? sortDirection : "none"} />
                    </button>
                  </div>

                  {pagedItems.length === 0 ? <p className="bot-settings-page__loading">{getStudioPageLabel(copy,"등록된 룰이 없습니다.")}</p> : null}

                  {pagedItems.map((item, index) => (
                    <div key={item.id} className="settings-list-row settings-list-row--rule">
                      <span className="settings-list-card__check">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelection(item.id)}
                        />
                      </span>
                      <span>{(currentPage - 1) * pageSize + index + 1}</span>
                      <button type="button" className="settings-link-button" onClick={() => selectEditor(item)}>
                        {item.name}
                      </button>
                      <span>{item.expression || "-"}</span>
                      <span>{item.target || "-"}</span>
                      <span>{item.enabled ? "Y" : "N"}</span>
                      <span>{formatDateTime(item.updatedAt)}</span>
                      <span>{item.updatedBy || "-"}</span>
                    </div>
                  ))}
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
                <button type="button" className="secondary-action" disabled={currentPage >= pageCount} onClick={() => setPage(pageCount)}>
                  »
                </button>
              </div>

              {editorOpen ? (
                <div className="settings-dialog-backdrop" role="presentation" onClick={() => setEditorOpen(false)}>
                  <div
                    className="settings-dialog settings-dialog--wide"
                    role="dialog"
                    aria-modal="true"
                    aria-label={getStudioPageLabel(copy,"룰 상세 정보")}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="settings-dialog__header">
                      <strong>{getStudioPageLabel(copy,"룰 상세 정보")}</strong>
                      <button type="button" className="settings-dialog__close" onClick={() => setEditorOpen(false)} aria-label={getStudioPageLabel(copy,"닫기")}>
                        ×
                      </button>
                    </div>
                    <div className="settings-dialog__body settings-dialog__body--form">
                      <div className="settings-form-grid settings-form-grid--compact">
                        <label className="settings-form-card">
                          <span>{getStudioPageLabel(copy,"룰 이름")}</span>
                          <input
                            type="text"
                            className="bot-settings-card__input"
                            value={editor.name}
                            onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value }))}
                          />
                        </label>

                        <label className="settings-form-card">
                          <span>{getStudioPageLabel(copy,"룰 설명")}</span>
                          <input
                            type="text"
                            className="bot-settings-card__input"
                            value={editor.description}
                            onChange={(event) => setEditor((current) => ({ ...current, description: event.target.value }))}
                          />
                        </label>

                        <label className="settings-form-card settings-form-card--wide">
                          <span>{getStudioPageLabel(copy,"룰 표현식")}</span>
                          <textarea
                            className="bot-settings-intro__textarea"
                            value={editor.expression}
                            onChange={(event) => {
                              setEditor((current) => ({ ...current, expression: event.target.value }));
                              setRegexTestState(null);
                            }}
                          />
                          <div className="entity-value-dialog__pattern-actions">
                            <button type="button" className="secondary-action" onClick={runRegexSyntaxCheck}>{getStudioPageLabel(copy,"정규식 확인")}</button>
                          </div>
                        </label>

                        <div className="settings-form-card settings-form-card--wide">
                          <span>{getStudioPageLabel(copy,"정규식 테스트")}</span>
                          <div className="entity-value-dialog__pattern-test-row">
                            <input
                              type="text"
                              className="rule-settings__regex-test-input"
                              value={regexTestText}
                              onChange={(event) => {
                                setRegexTestText(event.target.value);
                                setRegexTestState(null);
                              }}
                              placeholder={getStudioPageLabel(copy,"테스트할 문장을 입력하세요.")}
                            />
                            <button type="button" className="secondary-action" onClick={runRegexTest}>{getStudioPageLabel(copy,"테스트")}</button>
                          </div>
                          {regexTestState ? (
                            <p
                              className={`entity-value-dialog__inline-message${
                                regexTestState.tone === "success" ? " is-success" : " is-error"
                              }`}
                            >
                              {regexTestState.message}
                            </p>
                          ) : null}
                        </div>

                        <label className="settings-form-card">
                          <span>{getStudioPageLabel(copy,"연결할 의도/모듈")}</span>
                          <select
                            className="rule-settings__target-select"
                            value={editor.target}
                            disabled={targetOptions.length === 0}
                            onChange={(event) => setEditor((current) => ({ ...current, target: event.target.value }))}
                          >
                            <option value="">{targetOptions.length === 0 ? getStudioRuntimeMessage(uiLanguage, "선택 가능한 의도/모듈 없음") : getStudioRuntimeMessage(uiLanguage, "선택 안 함")}</option>
                            {editor.target && !hasEditorTargetInOptions ? (
                              <option value={editor.target}>{editor.target} - 기존 연결값</option>
                            ) : null}
                            {targetOptions.map((option) => (
                              <option key={`${option.typeLabel}-${option.value}`} value={option.value}>
                                {option.label} ({option.typeLabel})
                              </option>
                            ))}
                          </select>
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
