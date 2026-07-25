"use client";

import { getStudioRuntimeMessage } from "@/lib/i18n/studio-runtime-native";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AssetUploadDialog } from "@/components/asset-upload-dialog";
import { useI18n } from "@/components/language-provider";
import { getIntentStartLabel, INTENT_START_CATALOGS } from "@/lib/i18n/intent-start";
import type { SupportedLanguage } from "@/lib/language";
import { SimulatorFloatingLauncher } from "@/components/simulator-page";
import { useStudioWorkspace } from "@/components/studio-workspace-provider";
import {
  UploadResultDialog,
  type UploadResultSection,
} from "@/components/upload-result-dialog";
import { saveLastBotScreen, type AuthSession } from "@/lib/auth";
import { getBotVersionSettings } from "@/lib/bot-settings";
import { useEditLock } from "@/lib/use-edit-lock";
import {
  applyUpdatedVersionToBot,
  getBotDialogs,
  withUpdatedDialogs,
} from "@/lib/dialog-assets";
import { getBotEntities, getEntityPreviewValue } from "@/lib/entity-assets";
import { buildAssetExportFilename } from "@/lib/asset-text-format";
import {
  type StudioBotApiItem,
  fetchStudioBotVersionDialogs,
  fetchStudioBotVersionEntities,
  updateStudioBotVersionDialogs,
} from "@/lib/studio-bots-api";
import {
  normalizeVersionDialogs,
  normalizeVersionDocument,
  normalizeVersionEntities,
  type VersionDialogAsset,
  type VersionDialogEntityBinding,
  type VersionEntityAsset,
  type VersionDialogUtterance,
  type VersionDialogUtteranceType,
} from "@/lib/version-document";

type UploadResultState = {
  message: string;
  note?: string;
  sections: UploadResultSection[];
};

type FixedValidationIssue = {
  requiredValidationCount: number;
  message: string;
};

type SaveFailureDialogProps = {
  message: string;
  onClose: () => void;
};

type ViewModeDialogProps = {
  ownerLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

function SaveFailureDialog({ message, onClose }: SaveFailureDialogProps) {
  const { language: uiLanguage } = useI18n();
  const copy = INTENT_START_CATALOGS[uiLanguage];
  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div className="upload-result-dialog intent-editor__save-failure-dialog" role="dialog" aria-modal="true" aria-label={getIntentStartLabel(copy,"저장 실패")}>
        <div className="entity-editor-dialog__header">
          <strong>{getIntentStartLabel(copy,"저장 실패")}</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label={getIntentStartLabel(copy,"닫기")} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body">
          <div className="upload-result-dialog__panel intent-editor__save-failure-panel">
            <p className="upload-result-dialog__message">{getIntentStartLabel(copy,"변경사항이 저장이 되지 않았습니다.")}</p>
            <p className="upload-result-dialog__note">{message}</p>
          </div>
        </div>

        <div className="entity-editor-dialog__footer">
          <button type="button" className="secondary-action" onClick={onClose}>{getIntentStartLabel(copy,"취소")}</button>
          <button type="button" className="primary-action" onClick={onClose}>{getIntentStartLabel(copy,"확인")}</button>
        </div>
      </div>
    </div>
  );
}

function ViewModeDialog({ ownerLabel, onCancel, onConfirm }: ViewModeDialogProps) {
  const { language: uiLanguage } = useI18n();
  const copy = INTENT_START_CATALOGS[uiLanguage];
  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div className="intent-editor__view-mode-dialog" role="dialog" aria-modal="true" aria-label={getIntentStartLabel(copy,"조회모드 입장")}>
        <div className="entity-editor-dialog__header">
          <strong>{getIntentStartLabel(copy,"조회모드 입장")}</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label={getIntentStartLabel(copy,"닫기")} onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body">
          <div className="intent-editor__view-mode-message">
            현재 {ownerLabel}님이 작업중입니다. 조회모드로 들어가시겠습니까? 조회모드에서는 작업한 내용을 저장할 수 없습니다.
          </div>
        </div>

        <div className="entity-editor-dialog__footer">
          <button type="button" className="secondary-action" onClick={onCancel}>{getIntentStartLabel(copy,"취소")}</button>
          <button type="button" className="primary-action" onClick={onConfirm}>{getIntentStartLabel(copy,"확인")}</button>
        </div>
      </div>
    </div>
  );
}

type ChatbotMessageDialogProps = {
  binding: VersionDialogEntityBinding;
  messages: string[];
  onClose: () => void;
  onChangeMessage: (index: number, value: string) => void;
  onAddMessage: () => void;
  onRemoveMessage: (index: number) => void;
  onConfirm: () => void;
};

function ChatbotMessageDialog({
  binding,
  messages,
  onClose,
  onChangeMessage,
  onAddMessage,
  onRemoveMessage,
  onConfirm,
}: ChatbotMessageDialogProps) {
  const { language: uiLanguage } = useI18n();
  const copy = INTENT_START_CATALOGS[uiLanguage];
  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div
        className="entity-editor-dialog intent-editor__chatbot-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={getIntentStartLabel(copy,"챗봇 메시지 설정")}
      >
        <div className="entity-editor-dialog__header">
          <strong>{formatEntityDisplayName(binding.entityName)} 챗봇 메시지</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label={getIntentStartLabel(copy,"닫기")} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body">
          <p className="intent-editor__chatbot-dialog-note">
            필수 변수 추출에 실패했을 때 사용자에게 보여줄 챗봇 메시지를 설정합니다.
          </p>

          <div className="intent-editor__chatbot-dialog-list">
            {messages.map((chatbotMessage, index) => (
              <div key={`${binding.id}-${index}`} className="intent-editor__entity-message-block">
                <div className="intent-editor__entity-message-head">
                  <span>메시지 {index + 1}</span>
                  {messages.length > 1 ? (
                    <button
                      type="button"
                      className="intent-editor__entity-message-remove"
                      onClick={() => onRemoveMessage(index)}
                    >{getIntentStartLabel(copy,"삭제")}</button>
                  ) : null}
                </div>
                <textarea
                  className="textarea-control intent-editor__entity-message-textarea"
                  value={chatbotMessage}
                  onChange={(event) => onChangeMessage(index, event.target.value)}
                  placeholder={getIntentStartLabel(copy,"사용자에게 개체를 얻기 위한 질문을 입력하세요.")}
                  maxLength={1500}
                />
                <div className="intent-editor__entity-message-foot">
                  <span>
                    필수 변수 추출에 실패했을 때 사용자에게 보여줄 챗봇 메시지입니다.
                  </span>
                  <strong>{chatbotMessage.length}/1500</strong>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="intent-editor__entity-message-add"
            disabled={messages.length >= 3}
            onClick={onAddMessage}
          >
            + 메시지 추가
          </button>
        </div>

        <div className="entity-editor-dialog__footer">
          <button type="button" className="secondary-action" onClick={onClose}>{getIntentStartLabel(copy,"취소")}</button>
          <button type="button" className="primary-action" onClick={onConfirm}>{getIntentStartLabel(copy,"확인")}</button>
        </div>
      </div>
    </div>
  );
}

type ParsedUtteranceImportRow = {
  text: string;
  utteranceType: VersionDialogUtteranceType;
  empty: boolean;
  invalidType: boolean;
};

function buildUtterance(text: string, utteranceType: VersionDialogUtteranceType): VersionDialogUtterance {
  return {
    id: crypto.randomUUID(),
    text,
    utteranceType,
  };
}

function normalizeUtteranceKey(text: string) {
  return text.trim().toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAllOccurrences(text: string, searchText: string, replaceText: string) {
  return text.replace(new RegExp(escapeRegExp(searchText), "gi"), replaceText);
}

function renderHighlightedUtterance(text: string, query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  const parts: ReactNode[] = [];
  let startIndex = 0;
  let matchIndex = lowerText.indexOf(lowerQuery, startIndex);

  while (matchIndex !== -1) {
    if (matchIndex > startIndex) {
      parts.push(text.slice(startIndex, matchIndex));
    }

    const endIndex = matchIndex + normalizedQuery.length;
    parts.push(
      <mark key={`${matchIndex}-${endIndex}`} className="intent-editor__search-match">
        {text.slice(matchIndex, endIndex)}
      </mark>,
    );

    startIndex = endIndex;
    matchIndex = lowerText.indexOf(lowerQuery, startIndex);
  }

  if (startIndex < text.length) {
    parts.push(text.slice(startIndex));
  }

  return parts;
}

function buildBaseHref(botId: string, versionId: string) {
  return `/studio/bots/${botId}/versions/${versionId}`;
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function splitLines(text: string) {
  return stripBom(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseDelimitedLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseUtteranceImportRows(text: string): ParsedUtteranceImportRow[] {
  const lines = splitLines(text);
  if (lines.length === 0) {
    return [];
  }

  const header = parseDelimitedLine(lines[0]);
  const headerFirstCell = (header[0] ?? "").trim();
  const hasHeader = headerFirstCell === "발화문";
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const [textCell = "", typeCell = ""] = parseDelimitedLine(line);
    const normalizedText = textCell.trim();
    const normalizedType = typeCell.trim().toUpperCase();

    if (!normalizedText) {
      return {
        text: "",
        utteranceType: "T",
        empty: true,
        invalidType: false,
      };
    }

    if (!normalizedType) {
      return {
        text: normalizedText,
        utteranceType: "T",
        empty: false,
        invalidType: false,
      };
    }

    if (normalizedType !== "T" && normalizedType !== "V") {
      return {
        text: normalizedText,
        utteranceType: "T",
        empty: false,
        invalidType: true,
      };
    }

    return {
      text: normalizedText,
      utteranceType: normalizedType,
      empty: false,
      invalidType: false,
    };
  });
}

function buildUtteranceExportText(items: VersionDialogUtterance[]) {
  return items.map((item) => item.text).join("\r\n");
}

function buildFixedUtteranceExportText(items: VersionDialogUtterance[]) {
  return ["발화문,구분값", ...items.map((item) => `${item.text},${item.utteranceType}`)].join("\r\n");
}

function downloadTextFile(fileName: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildEntityBindingValue(entity: VersionEntityAsset) {
  return (
    getEntityPreviewValue(entity) ||
    entity.standardExpression?.trim() ||
    entity.examples?.[0]?.trim() ||
    entity.name
  );
}

function buildEntityBinding(entity: VersionEntityAsset): VersionDialogEntityBinding {
  return {
    id: crypto.randomUUID(),
    variableName: entity.name,
    entityId: entity.id,
    entityName: entity.name,
    entityValue: buildEntityBindingValue(entity),
    required: false,
    local: false,
    chatbotMessages: [],
  };
}

const JAVASCRIPT_RESERVED_WORDS = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

function normalizeVariableNameInput(value: string) {
  const trimmed = value.trim();
  const withoutPrefix = trimmed.startsWith("$") ? trimmed.slice(1) : trimmed;
  return withoutPrefix.trim();
}

function formatVariableNameInput(value: string) {
  const normalized = normalizeVariableNameInput(value);
  return normalized ? `$${normalized}` : "$";
}

function isJavaScriptStyleVariableName(value: string) {
  return /^(?!_)[\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*$/u.test(value);
}

function formatEntityDisplayName(name: string) {
  return name.startsWith("@") ? name : `@${name}`;
}

function getSystemPairBaseName(name: string) {
  const match = name.match(/^(.*)_(start|end)$/);
  return match ? match[1] : null;
}

function isSystemPairEntityName(name: string) {
  return getSystemPairBaseName(name) !== null;
}

function buildEntityMetaLabel(entityName: string, isSystem: boolean, language: SupportedLanguage) {
  if (!isSystem) {
    return getStudioRuntimeMessage(language, "사용자 개체");
  }

  if (isSystemPairEntityName(entityName)) {
    return getStudioRuntimeMessage(language, "시스템 개체 · start/end 쌍");
  }

  return getStudioRuntimeMessage(language, "시스템 개체");
}

function getEditableChatbotMessages(binding: VersionDialogEntityBinding) {
  return binding.chatbotMessages.length > 0 ? binding.chatbotMessages : [""];
}

function sanitizeChatbotMessages(messages: string[]) {
  return messages.map((item) => item.trim()).filter(Boolean).slice(0, 3);
}

function buildEntitySearchText(entity: VersionEntityAsset) {
  return [
    entity.name,
    formatEntityDisplayName(entity.name),
    entity.system ? "시스템 개체" : "사용자 개체",
    getEntityPreviewValue(entity),
    entity.standardExpression,
    ...(entity.examples ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getDialogEditingUserLabel(dialog: VersionDialogAsset | null) {
  if (!dialog) {
    return "";
  }

  const source = dialog as Record<string, unknown>;
  const editLock = source.editLock;
  if (editLock && typeof editLock === "object" && !Array.isArray(editLock)) {
    const lockSource = editLock as Record<string, unknown>;
    const displayName =
      typeof lockSource.displayName === "string" ? lockSource.displayName.trim() : "";
    const loginId =
      typeof lockSource.loginId === "string" ? lockSource.loginId.trim() : "";
    const userId =
      typeof lockSource.userId === "string" ? lockSource.userId.trim() : "";

    if (displayName && loginId) {
      return `${displayName}(${loginId})`;
    }
    if (displayName) {
      return displayName;
    }
    if (loginId) {
      return loginId;
    }
    if (userId) {
      return userId;
    }
  }

  const editingUser =
    typeof source.editingUser === "string" ? source.editingUser.trim() : "";
  const editingUserName =
    typeof source.editingUserName === "string" ? source.editingUserName.trim() : "";
  const editingUserLogin =
    typeof source.editingUserLogin === "string" ? source.editingUserLogin.trim() : "";

  if (editingUserName && editingUserLogin) {
    return `${editingUserName}(${editingUserLogin})`;
  }
  return editingUserName || editingUserLogin || editingUser;
}

export function IntentStartPage() {
  const { language: uiLanguage } = useI18n();
  const copy = INTENT_START_CATALOGS[uiLanguage];
  const workspace = useStudioWorkspace();
  const params = useParams<{ botId: string; versionId: string; intentId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const botId = workspace.bot.id || (typeof params.botId === "string" ? decodeURIComponent(params.botId) : "");
  const versionId = typeof params.versionId === "string" ? decodeURIComponent(params.versionId) : "v1";
  const dialogId = typeof params.intentId === "string" ? decodeURIComponent(params.intentId) : "";
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const entityPickerRef = useRef<HTMLDivElement | null>(null);
  const sectionFetchKeyRef = useRef<string | null>(null);

  const [authSession, setAuthSession] = useState<AuthSession | null>(workspace.session);
  const [bot, setBot] = useState<StudioBotApiItem | null>(workspace.bot);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [dialogDraft, setDialogDraft] = useState<VersionDialogAsset | null>(null);
  const [searchDraftValue, setSearchDraftValue] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [newUtteranceText, setNewUtteranceText] = useState("");
  const [newUtteranceType, setNewUtteranceType] = useState<VersionDialogUtteranceType>("T");
  const [selectedUtteranceIds, setSelectedUtteranceIds] = useState<string[]>([]);
  const [editingUtteranceId, setEditingUtteranceId] = useState<string | null>(null);
  const [editingUtteranceText, setEditingUtteranceText] = useState("");
  const [entitySearchValue, setEntitySearchValue] = useState("");
  const [selectedCandidateEntityIds, setSelectedCandidateEntityIds] = useState<string[]>([]);
  const [selectedEntityBindingIds, setSelectedEntityBindingIds] = useState<string[]>([]);
  const [bindingNameDrafts, setBindingNameDrafts] = useState<Record<string, string>>({});
  const [replaceValue, setReplaceValue] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResultState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveFailureMessage, setSaveFailureMessage] = useState<string | null>(null);
  const [validationTooltipOpen, setValidationTooltipOpen] = useState(false);
  const [entityPickerOpen, setEntityPickerOpen] = useState(false);
  const [chatbotMessageEditorBindingId, setChatbotMessageEditorBindingId] = useState<string | null>(null);
  const [chatbotMessageDrafts, setChatbotMessageDrafts] = useState<string[]>([""]);
  const [viewModeAccepted, setViewModeAccepted] = useState(false);
  const [startHelpOpen, setStartHelpOpen] = useState(false);

  useEffect(() => {
    setAuthSession(workspace.session);
    setBot(workspace.bot);
    setLoading(false);
    setErrorMessage("");
  }, [workspace.bot, workspace.session]);

  useEffect(() => {
    if (!authSession || !bot?.id || !bot.active_version?.id) {
      return;
    }

    const version = bot.active_version;
    const loadedDocument = version.version_json;
    const hasSectionDocument = Boolean(
      loadedDocument &&
      Array.isArray(loadedDocument.dialogs) &&
      Array.isArray(loadedDocument.entities),
    );
    const fetchKey = `${bot.id}:${version.id}`;
    if (sectionFetchKeyRef.current === fetchKey && hasSectionDocument) {
      return;
    }

    sectionFetchKeyRef.current = fetchKey;
    let ignore = false;
    setLoading(true);
    setErrorMessage("");

    Promise.allSettled([
      fetchStudioBotVersionDialogs(authSession.access_token, bot.id, version.id),
      fetchStudioBotVersionEntities(authSession.access_token, bot.id, version.id),
    ])
      .then(([dialogsResult, entitiesResult]) => {
        if (ignore) {
          return;
        }

        const loadedVersionDocument =
          bot.active_version?.version_json &&
          typeof bot.active_version.version_json === "object" &&
          !Array.isArray(bot.active_version.version_json)
            ? bot.active_version.version_json
            : null;
        const currentDocument = normalizeVersionDocument(loadedVersionDocument);
        const dialogsLoaded = dialogsResult.status === "fulfilled";
        const entitiesLoaded = entitiesResult.status === "fulfilled";
        const dialogsResponse = dialogsLoaded ? dialogsResult.value : null;
        const entitiesResponse = entitiesLoaded ? entitiesResult.value : null;
        const hasDialogsInDocument =
          loadedVersionDocument !== null &&
          Object.prototype.hasOwnProperty.call(loadedVersionDocument, "dialogs") &&
          Array.isArray(loadedVersionDocument.dialogs);
        const hasEntitiesInDocument =
          loadedVersionDocument !== null &&
          Object.prototype.hasOwnProperty.call(loadedVersionDocument, "entities") &&
          Array.isArray(loadedVersionDocument.entities);

        if (!dialogsLoaded && !entitiesLoaded) {
          const dialogsError = dialogsResult.reason instanceof Error ? dialogsResult.reason.message : "";
          const entitiesError = entitiesResult.reason instanceof Error ? entitiesResult.reason.message : "";
          setErrorMessage(dialogsError || entitiesError || getStudioRuntimeMessage(uiLanguage, "대화 시작 정보를 불러오지 못했습니다."));
          return;
        }

        const nextDocument = {
          ...currentDocument,
          dialogs: dialogsResponse
            ? normalizeVersionDialogs(dialogsResponse.items)
            : normalizeVersionDialogs(currentDocument.dialogs),
          entities: entitiesResponse
            ? normalizeVersionEntities(entitiesResponse.items)
            : normalizeVersionEntities(currentDocument.entities),
        };
        const versionResponse = dialogsResponse?.version ?? entitiesResponse?.version;
        if (!versionResponse) {
          setErrorMessage(getStudioRuntimeMessage(uiLanguage, "대화 시작 정보를 불러오지 못했습니다."));
          return;
        }
        const nextVersion = {
          ...versionResponse,
          version_json: nextDocument,
        };
        setBot((current) => (
          current && current.id === bot.id
            ? {
                ...current,
                active_version: nextVersion,
                active_version_id: nextVersion.id,
                updated_at: nextVersion.updated_at ?? current.updated_at,
              }
            : current
        ));

        if (!dialogsLoaded && !hasDialogsInDocument) {
          setErrorMessage(
            dialogsResult.reason instanceof Error
              ? dialogsResult.reason.message
              : getStudioRuntimeMessage(uiLanguage, "의도 학습문장 정보를 불러오지 못했습니다."),
          );
          return;
        }

        if (!entitiesLoaded && !hasEntitiesInDocument) {
          setErrorMessage(
            entitiesResult.reason instanceof Error
              ? entitiesResult.reason.message
              : getStudioRuntimeMessage(uiLanguage, "개체 정보를 불러오지 못했습니다."),
          );
          return;
        }

        setErrorMessage("");
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : getStudioRuntimeMessage(uiLanguage, "대화 시작 정보를 불러오지 못했습니다."));
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [authSession, bot]);

  useEffect(() => {
    if (pathname && bot && !errorMessage) {
      saveLastBotScreen(pathname);
    }
  }, [pathname, bot, errorMessage]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!actionMenuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!entityPickerOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!entityPickerRef.current?.contains(event.target as Node)) {
        setEntityPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [entityPickerOpen]);

  const dialogs = useMemo(() => getBotDialogs(bot), [bot]);
  const sourceDialog = useMemo(
    () => dialogs.find((item) => item.id === dialogId && item.dialogType === 1) ?? null,
    [dialogs, dialogId],
  );
  const editingUserLabel = useMemo(() => getDialogEditingUserLabel(sourceDialog), [sourceDialog]);
  const requestedViewMode =
    searchParams.get("mode") === "view" ||
    searchParams.get("viewMode") === "true" ||
    searchParams.get("readonly") === "true";
  const handleLockCancel = useCallback(() => {
    router.push(`/studio/bots/${botId}/versions/${versionId}/intents`);
  }, [botId, router, versionId]);
  const editLock = useEditLock({
    token: authSession?.access_token,
    botId: bot?.id,
    versionId: bot?.active_version?.id,
    dialogId,
    area: "start",
    enabled: Boolean(sourceDialog),
    onCancel: handleLockCancel,
  });
  const lockConflictOwner = editLock.conflictOwner;
  const isViewMode = Boolean(requestedViewMode || editingUserLabel || editLock.viewOnly);
  const showViewModeDialog = Boolean((requestedViewMode || editingUserLabel || lockConflictOwner) && !viewModeAccepted);

  useEffect(() => {
    if (!sourceDialog) {
      setDialogDraft(null);
      return;
    }

    setDialogDraft(structuredClone(sourceDialog));
    setSelectedUtteranceIds([]);
    setEditingUtteranceId(null);
    setEditingUtteranceText("");
    setSelectedCandidateEntityIds([]);
    setSelectedEntityBindingIds([]);
    setBindingNameDrafts(
      Object.fromEntries(
        sourceDialog.entityBindings.map((item) => [item.id, formatVariableNameInput(item.variableName)]),
      ),
    );
    setReplaceValue("");
    setSaveFailureMessage(null);
    setValidationTooltipOpen(false);
    setEntityPickerOpen(false);
    setChatbotMessageEditorBindingId(null);
    setChatbotMessageDrafts([""]);
    setViewModeAccepted(false);
  }, [sourceDialog]);

  const dialog = dialogDraft;
  const hasUnsavedStartChanges = useMemo(
    () => Boolean(dialog && sourceDialog && JSON.stringify(dialog) !== JSON.stringify(sourceDialog)),
    [dialog, sourceDialog],
  );
  const validationMode = getBotVersionSettings(bot ?? {}).conversationDefaults.validation.mode;
  const isFixedValidationMode = validationMode === "fixed";
  const otherIntentUtteranceOwners = useMemo(() => {
    const owners = new Map<string, string>();

    for (const item of dialogs) {
      if (item.id === dialogId || item.dialogType !== 1) {
        continue;
      }

      for (const utterance of item.utterances) {
        const key = normalizeUtteranceKey(utterance.text);
        if (key && !owners.has(key)) {
          owners.set(key, item.name);
        }
      }
    }

    return owners;
  }, [dialogId, dialogs]);

  const filteredUtterances = useMemo(() => {
    if (!dialog) {
      return [];
    }

    const normalizedQuery = searchValue.trim().toLowerCase();
    if (!normalizedQuery) {
      return dialog.utterances;
    }

    return dialog.utterances.filter((item) => item.text.toLowerCase().includes(normalizedQuery));
  }, [dialog, searchValue]);
  const hasSearchKeyword = searchValue.trim().length > 0;
  const displayedUtteranceCount = hasSearchKeyword ? filteredUtterances.length : (dialog?.utterances.length ?? 0);

  function commitUtteranceSearch() {
    setSearchValue(searchDraftValue.trim());
    setReplaceValue("");
  }

  function clearUtteranceSearch() {
    setSearchDraftValue("");
    setSearchValue("");
    setReplaceValue("");
  }

  const fixedValidationIssue = useMemo(
    () => (dialog ? getFixedValidationIssue(dialog, isFixedValidationMode) : null),
    [dialog, isFixedValidationMode],
  );

  const entityBindings = dialog?.entityBindings ?? [];
  const entities = useMemo(() => getBotEntities(bot), [bot]);
  const boundEntityIdSet = useMemo(
    () => new Set(entityBindings.map((item) => item.entityId)),
    [entityBindings],
  );

  const visibleCandidateEntities = useMemo(() => {
    const normalizedQuery = entitySearchValue.trim().toLowerCase();
    if (!normalizedQuery) {
      return entities;
    }

    return entities
      .filter((entity) => buildEntitySearchText(entity).includes(normalizedQuery))
      .slice(0, 50);
  }, [entities, entitySearchValue]);

  const candidateSelectableIds = useMemo(
    () =>
      visibleCandidateEntities
        .filter((entity) => !boundEntityIdSet.has(entity.id))
        .map((entity) => entity.id),
    [visibleCandidateEntities, boundEntityIdSet],
  );

  const entityCandidateSections = useMemo(
    () =>
      [
        {
          key: "user",
          title: getStudioRuntimeMessage(uiLanguage, "사용자 개체"),
          items: visibleCandidateEntities.filter((entity) => !entity.system),
        },
        {
          key: "system",
          title: getStudioRuntimeMessage(uiLanguage, "시스템 개체"),
          items: visibleCandidateEntities.filter((entity) => entity.system),
        },
      ].filter((section) => section.items.length > 0),
    [visibleCandidateEntities],
  );
  const chatbotMessageEditorBinding = useMemo(
    () =>
      entityBindings.find((item) => item.id === chatbotMessageEditorBindingId) ?? null,
    [chatbotMessageEditorBindingId, entityBindings],
  );

  useEffect(() => {
    if (
      chatbotMessageEditorBindingId &&
      (!chatbotMessageEditorBinding || !chatbotMessageEditorBinding.required)
    ) {
      setChatbotMessageEditorBindingId(null);
      setChatbotMessageDrafts([""]);
    }
  }, [chatbotMessageEditorBinding, chatbotMessageEditorBindingId]);

  function updateDialogDraft(updater: (current: VersionDialogAsset) => VersionDialogAsset) {
    if (isViewMode) {
      return;
    }
    setDialogDraft((current) => (current ? updater(current) : current));
  }

  function handleNavigateToIntentList() {
    if (hasUnsavedStartChanges && !window.confirm(getStudioRuntimeMessage(uiLanguage, "변경사항이 저장되지 않았습니다. 다른 화면으로 이동하시겠습니까?"))) {
      return;
    }

    router.push(`${buildBaseHref(botId, versionId)}/intents`);
  }

  function findUtteranceOwner(text: string) {
    return otherIntentUtteranceOwners.get(normalizeUtteranceKey(text)) ?? null;
  }

  async function persistDialog(
    nextDialog: VersionDialogAsset,
    successMessage: string,
    afterSave?: () => void,
  ) {
    if (isViewMode) {
      setMessage("");
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "조회모드에서는 작업한 내용을 저장할 수 없습니다."));
      return;
    }

    if (!authSession || !bot?.active_version) {
      router.replace("/login");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    try {
      const nextDialogs = dialogs.map((item) => (item.id === nextDialog.id ? nextDialog : item));
      const response = await updateStudioBotVersionDialogs(
        authSession.access_token,
        bot.id,
        bot.active_version.id,
        nextDialogs,
      );
      const nextDocument = withUpdatedDialogs(
        normalizeVersionDocument(bot.active_version.version_json),
        normalizeVersionDialogs(response.items),
      );
      const updatedVersion = {
        ...response.version,
        version_json: nextDocument,
      };

      setBot((current) => (current ? applyUpdatedVersionToBot(current, updatedVersion) : current));
      setDialogDraft(structuredClone(nextDialog));
      setSelectedUtteranceIds([]);
      setSelectedEntityBindingIds([]);
      setMessage(successMessage);
      afterSave?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : getStudioRuntimeMessage(uiLanguage, "대화 시작 설정을 저장하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  }

  function handleAddUtterance() {
    if (!dialog || isViewMode) {
      return;
    }

    const normalizedText = newUtteranceText.trim();
    if (!normalizedText) {
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "학습문장을 입력해주세요."));
      return;
    }

    const normalizedKey = normalizeUtteranceKey(normalizedText);
    if (dialog.utterances.some((item) => normalizeUtteranceKey(item.text) === normalizedKey)) {
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "이미 등록된 학습문장입니다."));
      return;
    }

    const ownerName = findUtteranceOwner(normalizedText);
    if (ownerName) {
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "'{text}' 학습문장은 '{intent}' 의도에서 이미 사용 중입니다.").replace("{text}", normalizedText).replace("{intent}", ownerName));
      return;
    }

    updateDialogDraft((current) => ({
      ...current,
      utterances: [
        buildUtterance(normalizedText, isFixedValidationMode ? newUtteranceType : "T"),
        ...current.utterances,
      ],
    }));
    setNewUtteranceText("");
    setErrorMessage("");
    setMessage("");
  }

  function handleDeleteSelected() {
    if (!dialog || isViewMode || selectedUtteranceIds.length === 0) {
      return;
    }

    updateDialogDraft((current) => ({
      ...current,
      utterances: current.utterances.filter((item) => !selectedUtteranceIds.includes(item.id)),
    }));
    setSelectedUtteranceIds([]);
    setMessage("");
    setErrorMessage("");
  }

  function handleUpdateUtteranceType(utteranceId: string, utteranceType: VersionDialogUtteranceType) {
    if (isViewMode) {
      return;
    }

    updateDialogDraft((current) => ({
      ...current,
      utterances: current.utterances.map((item) =>
        item.id === utteranceId ? { ...item, utteranceType } : item,
      ),
    }));
    setMessage("");
    setErrorMessage("");
  }

  function handleStartEditUtterance(utterance: VersionDialogUtterance) {
    if (isViewMode) {
      return;
    }

    setEditingUtteranceId(utterance.id);
    setEditingUtteranceText(utterance.text);
    setMessage("");
    setErrorMessage("");
  }

  function handleCancelEditUtterance() {
    setEditingUtteranceId(null);
    setEditingUtteranceText("");
  }

  function handleCommitEditUtterance(utteranceId: string) {
    if (!dialog || isViewMode) {
      return;
    }

    const normalizedText = editingUtteranceText.trim();
    if (!normalizedText) {
      setMessage("");
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "학습문장을 입력해주세요."));
      return;
    }

    const normalizedKey = normalizeUtteranceKey(normalizedText);
    const hasDuplicate = dialog.utterances.some(
      (item) => item.id !== utteranceId && normalizeUtteranceKey(item.text) === normalizedKey,
    );
    if (hasDuplicate) {
      setMessage("");
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "이미 등록된 학습문장입니다."));
      return;
    }

    const ownerName = findUtteranceOwner(normalizedText);
    if (ownerName) {
      setMessage("");
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "'{text}' 학습문장은 '{intent}' 의도에서 이미 사용 중입니다.").replace("{text}", normalizedText).replace("{intent}", ownerName));
      return;
    }

    updateDialogDraft((current) => ({
      ...current,
      utterances: current.utterances.map((item) =>
        item.id === utteranceId ? { ...item, text: normalizedText } : item,
      ),
    }));
    setEditingUtteranceId(null);
    setEditingUtteranceText("");
    setMessage("");
    setErrorMessage("");
  }

  function handleBulkValidation(nextType: VersionDialogUtteranceType) {
    if (!dialog || isViewMode || selectedUtteranceIds.length === 0) {
      return;
    }

    updateDialogDraft((current) => ({
      ...current,
      utterances: current.utterances.map((item) =>
        selectedUtteranceIds.includes(item.id) ? { ...item, utteranceType: nextType } : item,
      ),
    }));
    setMessage("");
    setErrorMessage("");
  }

  function handleToggleValidationSelection() {
    if (!dialog || selectedUtteranceIds.length === 0) {
      return;
    }

    const allSelectedValidation = dialog.utterances
      .filter((item) => selectedUtteranceIds.includes(item.id))
      .every((item) => item.utteranceType === "V");

    handleBulkValidation(allSelectedValidation ? "T" : "V");
  }

  function handleAddEntityBinding(entity: VersionEntityAsset) {
    if (!dialog || isViewMode) {
      return;
    }

    if (entityBindings.some((item) => item.entityId === entity.id)) {
      setMessage("");
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "'{entity}' 개체는 이미 등록되어 있습니다.").replace("{entity}", entity.name));
      return;
    }

    const nextBinding = buildEntityBinding(entity);
    updateDialogDraft((current) => ({
      ...current,
      entityBindings: [...current.entityBindings, nextBinding],
    }));
    setBindingNameDrafts((current) => ({
      ...current,
      [nextBinding.id]: formatVariableNameInput(nextBinding.variableName),
    }));
    setEntitySearchValue("");
    setEntityPickerOpen(false);
    setMessage("");
    setErrorMessage("");
  }

  function handleToggleCandidateEntity(entityId: string) {
    setSelectedCandidateEntityIds((current) =>
      current.includes(entityId)
        ? current.filter((id) => id !== entityId)
        : [...current, entityId],
    );
  }

  function handleAddSelectedEntityBindings() {
    if (!dialog || isViewMode) {
      return;
    }

    if (selectedCandidateEntityIds.length === 0) {
      setMessage("");
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "추가할 개체를 먼저 선택해주세요."));
      return;
    }

    const selectedEntities = entities.filter((entity) => selectedCandidateEntityIds.includes(entity.id));
    const existingIds = new Set(entityBindings.map((item) => item.entityId));
    const nextBindings = selectedEntities
      .filter((entity) => !existingIds.has(entity.id))
      .map((entity) => buildEntityBinding(entity));

    if (nextBindings.length === 0) {
      setMessage("");
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "선택한 개체는 이미 등록되어 있습니다."));
      return;
    }

    updateDialogDraft((current) => ({
      ...current,
      entityBindings: [...current.entityBindings, ...nextBindings],
    }));
    setBindingNameDrafts((current) => ({
      ...current,
      ...Object.fromEntries(
        nextBindings.map((item) => [item.id, formatVariableNameInput(item.variableName)]),
      ),
    }));
    setSelectedCandidateEntityIds([]);
    setEntitySearchValue("");
    setEntityPickerOpen(false);
    setMessage("");
    setErrorMessage("");
  }

  function handleToggleAllCandidateEntities(checked: boolean) {
    if (!checked) {
      setSelectedCandidateEntityIds((current) =>
        current.filter((id) => !candidateSelectableIds.includes(id)),
      );
      return;
    }

    setSelectedCandidateEntityIds((current) => [
      ...new Set([...current, ...candidateSelectableIds]),
    ]);
  }

  function handleDeleteEntityBindings() {
    if (!dialog || isViewMode || selectedEntityBindingIds.length === 0) {
      return;
    }

    updateDialogDraft((current) => ({
      ...current,
      entityBindings: current.entityBindings.filter((item) => !selectedEntityBindingIds.includes(item.id)),
    }));
    setBindingNameDrafts((current) => {
      const next = { ...current };
      for (const bindingId of selectedEntityBindingIds) {
        delete next[bindingId];
      }
      return next;
    });
    setSelectedEntityBindingIds([]);
    setMessage("");
    setErrorMessage("");
  }

  function handleUpdateEntityBinding(
    bindingId: string,
    updates: Partial<VersionDialogEntityBinding>,
  ) {
    if (isViewMode) {
      return;
    }

    updateDialogDraft((current) => ({
      ...current,
      entityBindings: current.entityBindings.map((item) =>
        item.id === bindingId ? { ...item, ...updates } : item,
      ),
    }));
    setMessage("");
    setErrorMessage("");
  }

  function handleToggleRequiredBinding(binding: VersionDialogEntityBinding) {
    if (isViewMode) {
      return;
    }

    const nextRequired = !binding.required;
    if (!nextRequired && chatbotMessageEditorBindingId === binding.id) {
      setChatbotMessageEditorBindingId(null);
      setChatbotMessageDrafts([""]);
    }
    handleUpdateEntityBinding(binding.id, {
      required: nextRequired,
      chatbotMessages: nextRequired ? getEditableChatbotMessages(binding) : binding.chatbotMessages,
    });
  }

  function handleOpenChatbotMessageEditor(binding: VersionDialogEntityBinding) {
    if (isViewMode) {
      return;
    }

    setChatbotMessageEditorBindingId(binding.id);
    setChatbotMessageDrafts(getEditableChatbotMessages(binding));
  }

  function handleCloseChatbotMessageEditor() {
    setChatbotMessageEditorBindingId(null);
    setChatbotMessageDrafts([""]);
  }

  function handleUpdateChatbotMessageDraft(index: number, value: string) {
    if (isViewMode) {
      return;
    }

    setChatbotMessageDrafts((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }

  function handleAddChatbotMessageDraft() {
    if (isViewMode) {
      return;
    }

    setChatbotMessageDrafts((current) => {
      if (current.length >= 3) {
        return current;
      }

      return [...current, ""];
    });
  }

  function handleRemoveChatbotMessageDraft(index: number) {
    if (isViewMode) {
      return;
    }

    setChatbotMessageDrafts((current) => {
      const nextMessages = current.filter((_, itemIndex) => itemIndex !== index);
      return nextMessages.length > 0 ? nextMessages : [""];
    });
  }

  function handleConfirmChatbotMessageEditor() {
    if (!chatbotMessageEditorBindingId || isViewMode) {
      return;
    }

    handleUpdateEntityBinding(chatbotMessageEditorBindingId, {
      chatbotMessages: chatbotMessageDrafts.slice(0, 3),
    });
    handleCloseChatbotMessageEditor();
  }

  function handleCommitVariableName(binding: VersionDialogEntityBinding) {
    if (isViewMode) {
      return;
    }

    const draftValue = normalizeVariableNameInput(
      bindingNameDrafts[binding.id] ?? formatVariableNameInput(binding.variableName),
    );
    if (!draftValue) {
      setMessage("");
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "변수명을 입력해주세요."));
      setBindingNameDrafts((current) => ({
        ...current,
        [binding.id]: formatVariableNameInput(binding.variableName),
      }));
      return;
    }

    if (draftValue.startsWith("_")) {
      setMessage("");
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "`$_`로 시작하는 변수명은 시스템 변수 예약어라 사용할 수 없습니다."));
      setBindingNameDrafts((current) => ({
        ...current,
        [binding.id]: formatVariableNameInput(binding.variableName),
      }));
      return;
    }

    if (!isJavaScriptStyleVariableName(draftValue) || JAVASCRIPT_RESERVED_WORDS.has(draftValue)) {
      setMessage("");
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "변수명은 JavaScript/Node.js 규칙에 맞게 입력해주세요."));
      setBindingNameDrafts((current) => ({
        ...current,
        [binding.id]: formatVariableNameInput(binding.variableName),
      }));
      return;
    }

    const hasDuplicate = entityBindings.some(
      (item) =>
        item.id !== binding.id &&
        normalizeVariableNameInput(item.variableName).toLowerCase() === draftValue.toLowerCase(),
    );
    if (hasDuplicate) {
      setMessage("");
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "'{variable}' 변수명은 이미 등록되어 있습니다.").replace("{variable}", `$${draftValue}`));
      setBindingNameDrafts((current) => ({
        ...current,
        [binding.id]: formatVariableNameInput(binding.variableName),
      }));
      return;
    }

    if (draftValue === normalizeVariableNameInput(binding.variableName)) {
      setBindingNameDrafts((current) => ({
        ...current,
        [binding.id]: formatVariableNameInput(draftValue),
      }));
      return;
    }

    handleUpdateEntityBinding(binding.id, { variableName: draftValue });
    setBindingNameDrafts((current) => ({
      ...current,
      [binding.id]: formatVariableNameInput(draftValue),
    }));
  }

  function getFixedValidationIssue(
    dialogValue: VersionDialogAsset,
    isFixed: boolean,
  ): FixedValidationIssue | null {
    if (!isFixed) {
      return null;
    }

    const utterances = dialogValue.utterances;
    if (utterances.length === 0) {
      return null;
    }

    const validationCount = utterances.filter((item) => item.utteranceType === "V").length;
    const requiredValidationCount = Math.ceil(utterances.length / 10);

    if (validationCount !== requiredValidationCount) {
      return {
        requiredValidationCount,
        message: getStudioRuntimeMessage(uiLanguage, "Training 문장 : Validation 문장 비율을 9:1로 조정하기 위해 Validation 문장을 {count}개로 설정하세요.").replace("{count}", String(requiredValidationCount)),
      };
    }

    return null;
  }

  async function handleSave(afterSave?: () => void) {
    if (!dialog || isViewMode) {
      if (isViewMode) {
        setMessage("");
        setErrorMessage(getStudioRuntimeMessage(uiLanguage, "조회모드에서는 작업한 내용을 저장할 수 없습니다."));
      }
      return;
    }

    const validationIssue = getFixedValidationIssue(dialog, isFixedValidationMode);
    if (validationIssue) {
      setMessage("");
      setErrorMessage("");
      setSaveFailureMessage(validationIssue.message);
      return;
    }

    const now = new Date().toISOString();
    const nextDialog: VersionDialogAsset = {
      ...dialog,
      entityBindings: dialog.entityBindings.map((binding) => ({
        ...binding,
        chatbotMessages: sanitizeChatbotMessages(binding.chatbotMessages),
      })),
      updatedAt: now,
      updatedBy: authSession?.user.login_id ?? dialog.updatedBy,
    };

    await persistDialog(nextDialog, getStudioRuntimeMessage(uiLanguage, "대화 시작 설정이 저장되었습니다."), afterSave);
  }

  function handleReplaceUtterances() {
    if (!dialog || isViewMode) {
      return;
    }

    const searchText = searchValue.trim();
    if (!searchText) {
      setMessage("");
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "검색어를 먼저 입력해주세요."));
      return;
    }

    if (!replaceValue.trim()) {
      setMessage("");
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "바꿀 내용을 입력해주세요."));
      return;
    }

    if (selectedUtteranceIds.length === 0) {
      setMessage("");
      setErrorMessage(getStudioRuntimeMessage(uiLanguage, "바꿀 학습문장을 먼저 선택해주세요. 모두 바꾸려면 학습문장 왼쪽 체크박스를 선택하세요."));
      return;
    }

    const targetIds = selectedUtteranceIds;
    const targetIdSet = new Set(targetIds);
    const occupiedTexts = new Set(
      dialog.utterances
        .filter((item) => !targetIdSet.has(item.id))
        .map((item) => normalizeUtteranceKey(item.text)),
    );
    let replacedCount = 0;
    let duplicateCount = 0;
    let blockedByOtherIntentCount = 0;

    const nextUtterances = dialog.utterances.map((item) => {
      if (
        !targetIdSet.has(item.id) ||
        !item.text.toLowerCase().includes(searchText.toLowerCase())
      ) {
        occupiedTexts.add(normalizeUtteranceKey(item.text));
        return item;
      }

      const replacedText = replaceAllOccurrences(item.text, searchText, replaceValue);
      const normalizedText = replacedText.trim();
      if (!normalizedText) {
        duplicateCount += 1;
        occupiedTexts.add(normalizeUtteranceKey(item.text));
        return item;
      }

      const ownerName = findUtteranceOwner(normalizedText);
      if (ownerName) {
        blockedByOtherIntentCount += 1;
        occupiedTexts.add(normalizeUtteranceKey(item.text));
        return item;
      }

      const normalizedKey = normalizeUtteranceKey(normalizedText);
      if (occupiedTexts.has(normalizedKey)) {
        duplicateCount += 1;
        occupiedTexts.add(normalizeUtteranceKey(item.text));
        return item;
      }

      replacedCount += 1;
      occupiedTexts.add(normalizedKey);
      return {
        ...item,
        text: normalizedText,
      };
    });

    if (replacedCount === 0) {
      setMessage("");
      setErrorMessage(
        duplicateCount > 0 || blockedByOtherIntentCount > 0
          ? getStudioRuntimeMessage(uiLanguage, "바꾸기 결과가 중복되었거나 다른 의도에서 이미 사용 중이라 적용되지 않았습니다.")
          : getStudioRuntimeMessage(uiLanguage, "검색어가 포함된 학습문장이 없습니다."),
      );
      return;
    }

    updateDialogDraft((current) => ({
      ...current,
      utterances: nextUtterances,
    }));
    setMessage(
      duplicateCount > 0 || blockedByOtherIntentCount > 0
        ? getStudioRuntimeMessage(uiLanguage, "{replaced}건을 바꾸고, {excluded}건은 중복 또는 다른 의도 사용으로 제외했습니다.").replace("{replaced}", String(replacedCount)).replace("{excluded}", String(duplicateCount + blockedByOtherIntentCount))
        : getStudioRuntimeMessage(uiLanguage, "{count}건을 바꿨습니다.").replace("{count}", String(replacedCount)),
    );
    setErrorMessage("");
  }

  async function handleUploadUtterances(file: File) {
    if (!dialog || isViewMode) {
      return;
    }

    const text = await file.text();
    const rows = parseUtteranceImportRows(text);
    const existingTexts = new Set(dialog.utterances.map((item) => normalizeUtteranceKey(item.text)));
    const seenTexts = new Set<string>();
    const nextUtterances: VersionDialogUtterance[] = [];
    let duplicateCount = 0;
    let emptyCount = 0;
    let invalidTypeCount = 0;

    for (const row of rows) {
      if (row.empty) {
        emptyCount += 1;
        continue;
      }

      if (row.invalidType) {
        invalidTypeCount += 1;
        continue;
      }

      const key = normalizeUtteranceKey(row.text);
      if (existingTexts.has(key) || seenTexts.has(key) || otherIntentUtteranceOwners.has(key)) {
        duplicateCount += 1;
        continue;
      }

      seenTexts.add(key);
      nextUtterances.push(
        buildUtterance(row.text, isFixedValidationMode ? row.utteranceType : "T"),
      );
    }

    updateDialogDraft((current) => ({
      ...current,
      utterances: [...nextUtterances, ...current.utterances],
    }));

    setUploadDialogOpen(false);
    setUploadResult({
      message: getStudioRuntimeMessage(uiLanguage, "업로드가 완료되었습니다."),
      note: isFixedValidationMode
        ? getStudioRuntimeMessage(uiLanguage, "중복되거나 다른 의도에서 이미 사용 중이거나 구분값(T/V)이 올바르지 않은 학습문장은 등록되지 않습니다.")
        : getStudioRuntimeMessage(uiLanguage, "중복되거나 다른 의도에서 이미 사용 중인 학습문장은 등록되지 않습니다."),
      sections: [
        {
          rows: [
            { label: getStudioRuntimeMessage(uiLanguage, "추가된 학습문장"), value: nextUtterances.length },
            { label: getStudioRuntimeMessage(uiLanguage, "중복된 학습문장"), value: duplicateCount },
            { label: getStudioRuntimeMessage(uiLanguage, "구분값이 잘못된 학습문장"), value: invalidTypeCount },
            { label: getStudioRuntimeMessage(uiLanguage, "비어 있는 학습문장"), value: emptyCount },
          ],
        },
      ],
    });
    setMessage(getStudioRuntimeMessage(uiLanguage, "학습문장 업로드 결과가 반영되었습니다. 저장하기를 눌러 완료하세요."));
    setErrorMessage("");
  }

  function handleDownloadTemplate() {
    downloadTextFile(
      "LearningExpr_양식.txt",
      ["발화문,구분값", "내가 디비에 보험 가입했다고?,T", "가입이 되있다구요,V"].join("\r\n"),
    );
  }

  function handleDownloadUtterances() {
    if (!dialog) {
      return;
    }

    downloadTextFile(
      buildAssetExportFilename("LearningExpr", dialog.name, "txt", "_"),
      isFixedValidationMode
        ? buildFixedUtteranceExportText(dialog.utterances)
        : buildUtteranceExportText(dialog.utterances),
    );
  }

  function handleNavigateToFlow() {
    if (!dialog) {
      return;
    }

    if (
      hasUnsavedStartChanges &&
      !window.confirm(getStudioRuntimeMessage(uiLanguage, "저장하지 않은 대화 시작 설정이 있습니다. 저장하지 않고 대화 설계로 이동하시겠습니까?"))
    ) {
      return;
    }

    router.push(`${buildBaseHref(botId, versionId)}/flows/${dialog.id}`);
  }

  function handleSaveAndNavigateToFlow() {
    if (!dialog) {
      return;
    }

    const nextFlowHref = `${buildBaseHref(botId, versionId)}/flows/${dialog.id}`;
    if (hasUnsavedStartChanges && !isViewMode) {
      void handleSave(() => router.push(nextFlowHref));
      return;
    }

    router.push(nextFlowHref);
  }

  if (loading) {
    return (
      <section className="intent-editor">
        <p className="manual-main__empty">{getIntentStartLabel(copy,"대화 시작 설정을 불러오는 중입니다...")}</p>
      </section>
    );
  }

  if (!authSession) {
    return null;
  }

  if (!dialog) {
    return (
      <section className="intent-editor">
        <p className="manual-main__empty">{getIntentStartLabel(copy,"등록된 의도를 찾을 수 없습니다.")}</p>
      </section>
    );
  }

  return (
    <section className={`intent-editor${isViewMode ? " intent-editor--view-mode" : ""}`}>
      <header className="intent-editor__header">
        <div>
          <h1 className="intent-editor__crumb">
            <button type="button" onClick={handleNavigateToIntentList}>
              의도 ({dialog.name})
            </button>
            <span>&gt;</span>
            <span className="intent-editor__crumb-current">{getIntentStartLabel(copy,"대화 시작")}</span>
            <button
              type="button"
              className="intent-editor__crumb-help"
              title={getIntentStartLabel(copy,"대화 시작 안내")}
              aria-label={getIntentStartLabel(copy,"대화 시작 안내")}
              onClick={() => setStartHelpOpen(true)}
            >
              <span className="dialog-help-icon" aria-hidden="true">?</span>
            </button>
            <span>&gt;</span>
            <button type="button" onClick={handleNavigateToFlow}>{getIntentStartLabel(copy,"대화 설계")}</button>
          </h1>
        </div>

        <div className="intent-editor__actions">
          <button
            type="button"
            className="studio-table-page__ghost"
            disabled={saving || isViewMode}
            onClick={() => void handleSave()}
          >
            저장하기
          </button>
          <button
            type="button"
            className="studio-table-page__primary"
            disabled={saving}
            onClick={handleSaveAndNavigateToFlow}
          >
            저장 후 대화설계
          </button>
        </div>
      </header>

      {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}
      {editLock.message ? <p className="form-message form-message--error">{editLock.message}</p> : null}
      {message ? <p className="form-message form-message--success">{message}</p> : null}

      <div className="intent-editor__body">
        <section className="intent-editor__panel intent-editor__panel--utterances">
          <div className="intent-editor__panel-header intent-editor__panel-header--utterances">
            <div className="intent-editor__panel-tools intent-editor__panel-tools--utterances">
              <span className="intent-editor__count-label intent-editor__count-label--header">{getIntentStartLabel(copy,"학습문장")}<strong>{displayedUtteranceCount}</strong>
              </span>
              {fixedValidationIssue ? (
                <div
                  className="intent-editor__validation-alert"
                  onMouseEnter={() => setValidationTooltipOpen(true)}
                  onMouseLeave={() => setValidationTooltipOpen(false)}
                >
                  <button
                    type="button"
                    className="intent-editor__validation-alert-button"
                    aria-label={getIntentStartLabel(copy,"Validation 오류 보기")}
                    onFocus={() => setValidationTooltipOpen(true)}
                    onBlur={() => setValidationTooltipOpen(false)}
                  >
                    !
                  </button>
                  {validationTooltipOpen ? (
                    <div className="intent-editor__validation-tooltip">{fixedValidationIssue.message}</div>
                  ) : null}
                </div>
              ) : null}
              <label className="intent-editor__search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="text"
                  value={searchDraftValue}
                  onChange={(event) => setSearchDraftValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitUtteranceSearch();
                    }
                  }}
                  placeholder={copy.trainingSentenceSearch}
                />
                {searchDraftValue || searchValue ? (
                  <button
                    type="button"
                    className="intent-editor__search-clear"
                    aria-label={getIntentStartLabel(copy,"검색어 지우기")}
                    onClick={clearUtteranceSearch}
                  >
                    ×
                  </button>
                ) : null}
              </label>
              <div className={`intent-editor__toolbar-right${hasSearchKeyword ? " intent-editor__toolbar-right--replace" : ""}`}>
                {hasSearchKeyword ? (
                  <input
                    type="text"
                    className="bot-settings-card__input intent-editor__replace-inline-input"
                    value={replaceValue}
                    onChange={(event) => setReplaceValue(event.target.value)}
                    placeholder={getIntentStartLabel(copy,"바꿀 내용을 입력하세요.")}
                    disabled={isViewMode}
                  />
                ) : null}
                <div className="intent-editor__toolbar-actions">
                  {hasSearchKeyword ? (
                    <button
                      type="button"
                      className="studio-table-page__ghost"
                      disabled={isViewMode || !replaceValue.trim()}
                      onClick={handleReplaceUtterances}
                    >
                      바꾸기
                    </button>
                  ) : null}
                  <button type="button" className="studio-table-page__ghost" disabled>
                    학습 문장 추천
                  </button>
                  <button
                    type="button"
                    className="studio-table-page__ghost"
                    disabled={selectedUtteranceIds.length === 0 || saving || isViewMode}
                    onClick={handleDeleteSelected}
                  >{getIntentStartLabel(copy,"삭제")}</button>
                  {isFixedValidationMode ? (
                    <button
                      type="button"
                      className="studio-table-page__ghost"
                      disabled={selectedUtteranceIds.length === 0 || isViewMode}
                      onClick={handleToggleValidationSelection}
                    >
                      Validation 지정/해제
                    </button>
                  ) : null}
                  <div className="manual-main__menu" ref={actionMenuRef}>
                    <button
                      type="button"
                      className="manual-main__menu-button"
                      aria-label={getIntentStartLabel(copy,"학습문장 메뉴")}
                      aria-expanded={menuOpen}
                      onClick={() => setMenuOpen((current) => !current)}
                    >
                      ⋮
                    </button>
                    {menuOpen ? (
                      <div className="manual-main__menu-popover manual-main__menu-popover--toolbar">
                        <button
                          type="button"
                          className="manual-main__menu-item manual-main__menu-item--button"
                          disabled={isViewMode}
                          onClick={() => {
                            setMenuOpen(false);
                            if (!isViewMode) {
                              setUploadDialogOpen(true);
                            }
                          }}
                        >{getIntentStartLabel(copy,"파일 업로드")}</button>
                        <button
                          type="button"
                          className="manual-main__menu-item manual-main__menu-item--button"
                          onClick={() => {
                            setMenuOpen(false);
                            handleDownloadUtterances();
                          }}
                        >{getIntentStartLabel(copy,"파일 다운로드")}</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="intent-editor__panel-body intent-editor__panel-body--fixed">
            <div className="intent-editor__composer">
              <label className="intent-editor__composer-type">
                <span>{getIntentStartLabel(copy,"구분")}</span>
                <select
                  className="bot-settings-card__select"
                  value={isFixedValidationMode ? newUtteranceType : "T"}
                  disabled={!isFixedValidationMode || isViewMode}
                  onChange={(event) => setNewUtteranceType(event.target.value as VersionDialogUtteranceType)}
                >
                  <option value="T">T</option>
                  {isFixedValidationMode ? <option value="V">V</option> : null}
                </select>
              </label>
              <label className="intent-editor__composer-input">
                <span>{getIntentStartLabel(copy,"학습문장")}</span>
                <input
                  type="text"
                  className="bot-settings-card__input"
                  value={newUtteranceText}
                  onChange={(event) => setNewUtteranceText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddUtterance();
                    }
                  }}
                  placeholder={getIntentStartLabel(copy,"봇과 대화를 시작할 때 사용자가 입력할 만한 문장을 입력하고 Enter를 눌러주세요.")}
                  disabled={isViewMode}
                />
              </label>
              <button type="button" className="studio-table-page__primary" disabled={saving || isViewMode} onClick={handleAddUtterance}>{getIntentStartLabel(copy,"추가")}</button>
            </div>

            <div className="intent-editor__status-row">
              <span>Validation Set 상태: {isFixedValidationMode ? "Fixed" : "Random"}</span>
            </div>
            <div className="intent-editor__panel-scroll">
              <div
                className={`intent-editor__table-head ${
                  isFixedValidationMode ? "intent-editor__table-head--fixed" : "intent-editor__table-head--random"
                }`}
              >
                <span className="intent-editor__table-check">
                  <input
                    type="checkbox"
                    aria-label={getIntentStartLabel(copy,"전체 선택")}
                    disabled={isViewMode}
                    checked={filteredUtterances.length > 0 && filteredUtterances.every((item) => selectedUtteranceIds.includes(item.id))}
                    onChange={(event) =>
                      setSelectedUtteranceIds(event.target.checked ? filteredUtterances.map((item) => item.id) : [])
                    }
                  />
                </span>
                <span>{getIntentStartLabel(copy,"구분")}</span>
                <span>{getIntentStartLabel(copy,"학습문장")}</span>
                <span aria-hidden="true" />
              </div>

              <div className="intent-editor__list">
                {filteredUtterances.map((item) => {
                  const displayType = isFixedValidationMode ? item.utteranceType : "T";
                  const isEditing = editingUtteranceId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`intent-editor__list-row ${
                        isFixedValidationMode ? "intent-editor__list-row--fixed" : "intent-editor__list-row--random"
                      }${isEditing ? " is-active" : ""}`}
                    >
                      <span className="intent-editor__table-check">
                        <input
                          type="checkbox"
                          disabled={isViewMode}
                          checked={selectedUtteranceIds.includes(item.id)}
                          onChange={() =>
                            setSelectedUtteranceIds((current) =>
                              current.includes(item.id)
                                ? current.filter((id) => id !== item.id)
                                : [...current, item.id],
                            )
                          }
                        />
                      </span>
                        <span className={`intent-editor__type intent-editor__type--${displayType.toLowerCase()}`}>
                          {displayType}
                        </span>
                        {isEditing ? (
                          <span className="intent-editor__utterance-edit">
                            <input
                              type="text"
                              className="bot-settings-card__input"
                              value={editingUtteranceText}
                              autoFocus
                              onChange={(event) => setEditingUtteranceText(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  handleCommitEditUtterance(item.id);
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  handleCancelEditUtterance();
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="intent-editor__utterance-edit-action"
                              onClick={() => handleCommitEditUtterance(item.id)}
                            >{getIntentStartLabel(copy,"저장")}</button>
                            <button
                              type="button"
                              className="intent-editor__utterance-edit-action"
                              onClick={handleCancelEditUtterance}
                            >{getIntentStartLabel(copy,"취소")}</button>
                          </span>
                        ) : (
                          <span>{renderHighlightedUtterance(item.text, searchValue)}</span>
                        )}
                        <button
                          type="button"
                          className="intent-editor__utterance-edit-button"
                          aria-label={getIntentStartLabel(copy, "학습문장 수정")}
                          disabled={isViewMode}
                          onClick={() => handleStartEditUtterance(item)}
                        >
                          ✎
                        </button>
                      </div>
                  );
                })}
              </div>

              {filteredUtterances.length === 0 ? (
                <p className="manual-main__empty">
                  {searchValue.trim() ? getStudioRuntimeMessage(uiLanguage, "검색 조건에 맞는 학습문장이 없습니다.") : getStudioRuntimeMessage(uiLanguage, "등록된 학습문장이 없습니다.")}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="intent-editor__panel intent-editor__panel--entities">
          <div className="intent-editor__panel-header">
            <h2>{copy.extractEntities} {entityBindings.length}</h2>
            <div className="intent-editor__panel-tools">
              <button
                type="button"
                className="studio-table-page__ghost"
                disabled={selectedCandidateEntityIds.length === 0 || isViewMode}
                onClick={handleAddSelectedEntityBindings}
              >
                선택 개체 추가
              </button>
              <button
                type="button"
                className="studio-table-page__ghost"
                disabled={selectedEntityBindingIds.length === 0 || saving || isViewMode}
                onClick={handleDeleteEntityBindings}
              >{getIntentStartLabel(copy,"삭제")}</button>
            </div>
          </div>
          <div className="intent-editor__panel-body">
            <div className="intent-editor__entity-picker" ref={entityPickerRef}>
              <label className="intent-editor__search intent-editor__search--wide">
                <span aria-hidden="true">⌕</span>
                <input
                  type="text"
                  value={entitySearchValue}
                  onFocus={() => setEntityPickerOpen(true)}
                  onClick={() => setEntityPickerOpen(true)}
                  onChange={(event) => {
                    setEntitySearchValue(event.target.value);
                    setEntityPickerOpen(true);
                  }}
                  placeholder={getIntentStartLabel(copy,"대화에서 사용할 개체를 검색하여 파라미터로 등록하세요.")}
                />
              </label>

              {entityPickerOpen ? (
                <div className="intent-editor__entity-candidates">
                  {entityCandidateSections.length > 0 ? (
                    <>
                      <div className="intent-editor__entity-candidate-head">
                        <span className="intent-editor__table-check">
                          <input
                            type="checkbox"
                            aria-label={getIntentStartLabel(copy,"개체 후보 전체 선택")}
                            disabled={candidateSelectableIds.length === 0 || isViewMode}
                            checked={
                              candidateSelectableIds.length > 0 &&
                              candidateSelectableIds.every((id) =>
                                selectedCandidateEntityIds.includes(id),
                              )
                            }
                            onChange={(event) => handleToggleAllCandidateEntities(event.target.checked)}
                          />
                        </span>
                        <span>{getIntentStartLabel(copy,"개체명")}</span>
                        <span>{getIntentStartLabel(copy,"구분")}</span>
                        <span>{getIntentStartLabel(copy,"개체값")}</span>
                      </div>
                      {entityCandidateSections.map((section) => (
                        <div key={section.key} className="intent-editor__entity-candidate-section">
                          <div className="intent-editor__entity-candidate-section-title">
                            {section.title}
                          </div>
                          {section.items.map((entity) => {
                            const alreadyBound = boundEntityIdSet.has(entity.id);
                            const selected = selectedCandidateEntityIds.includes(entity.id);

                            return (
                              <div
                                key={entity.id}
                                className={`intent-editor__entity-candidate${
                                  selected ? " is-selected" : ""
                                }${alreadyBound ? " is-disabled" : ""}`}
                              >
                                <span className="intent-editor__table-check">
                                  <input
                                    type="checkbox"
                                    disabled={alreadyBound || isViewMode}
                                    checked={selected}
                                    onChange={() => handleToggleCandidateEntity(entity.id)}
                                  />
                                </span>
                                <span className="intent-editor__entity-candidate-name">
                                  <strong>{formatEntityDisplayName(entity.name)}</strong>
                                  {alreadyBound ? <small>{getIntentStartLabel(copy,"이미 추가됨")}</small> : null}
                                </span>
                                <span className="intent-editor__entity-candidate-kind">
                                  {entity.system ? getStudioRuntimeMessage(uiLanguage, "시스템 개체") : getStudioRuntimeMessage(uiLanguage, "사용자 개체")}
                                </span>
                                <span className="intent-editor__entity-candidate-value">
                                  {buildEntityBindingValue(entity)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="intent-editor__entity-candidate-empty">
                      검색 조건에 맞는 개체가 없습니다.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="intent-editor__entity-head">
              <span className="intent-editor__table-check">
                <input
                  type="checkbox"
                  aria-label={getIntentStartLabel(copy,"개체 전체 선택")}
                  disabled={isViewMode}
                  checked={
                    entityBindings.length > 0 &&
                    entityBindings.every((item) => selectedEntityBindingIds.includes(item.id))
                  }
                  onChange={(event) =>
                    setSelectedEntityBindingIds(
                      event.target.checked ? entityBindings.map((item) => item.id) : [],
                    )
                  }
                />
              </span>
              <span>{getIntentStartLabel(copy,"변수명")}</span>
              <span>{getIntentStartLabel(copy,"개체명")}</span>
              <span>{getIntentStartLabel(copy,"개체값")}</span>
              <span>{getIntentStartLabel(copy,"필수 변수")}</span>
              <span>{getIntentStartLabel(copy,"로컬 변수")}</span>
              <span>{getIntentStartLabel(copy,"챗봇 메시지")}</span>
            </div>

            {entityBindings.length > 0 ? (
              <div className="intent-editor__entity-list">
                {entityBindings.map((binding) => {
                  const sourceEntity =
                    entities.find((entity) => entity.id === binding.entityId) ?? null;
                  const isSystemEntity = sourceEntity?.system === true;
                  const pairBaseName = getSystemPairBaseName(binding.entityName);
                  const pairBinding =
                    pairBaseName !== null
                      ? entityBindings.find(
                          (item) =>
                            item.id !== binding.id &&
                            getSystemPairBaseName(item.entityName) === pairBaseName,
                        ) ?? null
                      : null;
                  const filledMessageCount = sanitizeChatbotMessages(binding.chatbotMessages).length;

                  return (
                    <div key={binding.id} className="intent-editor__entity-item">
                      <div className="intent-editor__entity-row">
                        <span className="intent-editor__table-check">
                          <input
                            type="checkbox"
                            disabled={isViewMode}
                            checked={selectedEntityBindingIds.includes(binding.id)}
                            onChange={() =>
                              setSelectedEntityBindingIds((current) =>
                                current.includes(binding.id)
                                  ? current.filter((id) => id !== binding.id)
                                  : [...current, binding.id],
                              )
                            }
                          />
                        </span>
                        <label className="intent-editor__entity-field">
                          <input
                            type="text"
                            className="bot-settings-card__input"
                            value={
                              bindingNameDrafts[binding.id] ??
                              formatVariableNameInput(binding.variableName)
                            }
                            onChange={(event) =>
                              setBindingNameDrafts((current) => ({
                                ...current,
                                [binding.id]: event.target.value,
                              }))
                            }
                            onBlur={() => handleCommitVariableName(binding)}
                            disabled={isViewMode}
                          />
                        </label>
                        <span className="intent-editor__entity-name">
                          <strong>{formatEntityDisplayName(binding.entityName)}</strong>
                          <small>
                            {buildEntityMetaLabel(binding.entityName, isSystemEntity, uiLanguage)}
                            {pairBinding ? getStudioRuntimeMessage(uiLanguage, " · {entity} 연결").replace("{entity}", formatEntityDisplayName(pairBinding.entityName)) : ""}
                          </small>
                        </span>
                        <span className="intent-editor__entity-value" title={binding.entityValue}>
                          {binding.entityValue || "-"}
                        </span>
                        <label className="intent-editor__entity-toggle">
                          <input
                            type="checkbox"
                            checked={binding.required}
                            disabled={isViewMode}
                            onChange={() => handleToggleRequiredBinding(binding)}
                          />
                          <span>{binding.required ? getStudioRuntimeMessage(uiLanguage, "사용") : getStudioRuntimeMessage(uiLanguage, "미사용")}</span>
                        </label>
                        <label className="intent-editor__entity-toggle">
                          <input
                            type="checkbox"
                            checked={binding.local}
                            disabled={isViewMode}
                            onChange={() =>
                              handleUpdateEntityBinding(binding.id, { local: !binding.local })
                            }
                          />
                          <span>{binding.local ? getStudioRuntimeMessage(uiLanguage, "사용") : getStudioRuntimeMessage(uiLanguage, "미사용")}</span>
                        </label>
                        <span className="intent-editor__entity-message-cell">
                          {binding.required ? (
                            <button
                              type="button"
                              className="intent-editor__entity-message-button"
                              disabled={isViewMode}
                              onClick={() => handleOpenChatbotMessageEditor(binding)}
                            >
                              {filledMessageCount > 0 ? getStudioRuntimeMessage(uiLanguage, "{count}건").replace("{count}", String(filledMessageCount)) : getStudioRuntimeMessage(uiLanguage, "메시지 설정")}
                            </button>
                          ) : (
                            <span className="intent-editor__entity-message-empty">-</span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="intent-editor__entity-empty">
                <div className="intent-editor__entity-face">
                  <span />
                  <span />
                </div>
                <p>
                  아직 추출할 개체가 선택되지 않았습니다.
                  <br />
                  개체를 검색한 뒤 선택해서 변수로 등록해주세요.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <SimulatorFloatingLauncher startDialogId={dialog.id} />

      {isViewMode ? (
        <div className="intent-editor__view-mode-banner">
          지금은 조회모드입니다. 작업내용이 저장되지 않으며, 최신 저장버전으로만 대화 테스트를 진행할 수 있습니다.
        </div>
      ) : null}

      {showViewModeDialog ? (
        <ViewModeDialog
          ownerLabel={lockConflictOwner || editingUserLabel || getStudioRuntimeMessage(uiLanguage, "다른 사용자")}
          onCancel={lockConflictOwner ? editLock.cancelViewOnly : handleNavigateToIntentList}
          onConfirm={() => {
            if (lockConflictOwner) {
              editLock.acceptViewOnly();
            }
            setViewModeAccepted(true);
          }}
        />
      ) : null}

      {uploadDialogOpen ? (
        <AssetUploadDialog
          title={getIntentStartLabel(copy,"파일 업로드")}
          description={
            <p>{getIntentStartLabel(copy,"아래의 버튼으로 양식(.txt)을 다운받으신 후, 파일을 업로드 하세요.")}</p>
          }
          notice={
            <>
              <p>{getIntentStartLabel(copy,"UTF-8 형식으로 인코딩된 .txt/.csv 파일을 통해 학습문장을 한꺼번에 업로드할 수 있습니다.")}</p>
              <ul className="asset-upload-dialog__list">
                <li>{getIntentStartLabel(copy,"쉼표(,)로 구분하는 CSV 형식을 사용하세요.")}</li>
                <li>{getIntentStartLabel(copy,"구분값은 T 또는 V만 허용합니다. 생략하면 T로 등록됩니다.")}</li>
                <li>{getIntentStartLabel(copy,"한 줄에 한 개의 학습문장을 입력하세요.")}</li>
              </ul>
            </>
          }
          exampleTitle={getStudioRuntimeMessage(uiLanguage, "예시")}
          exampleLines={["발화문,구분값", "내가 디비에 보험 가입했다고?,T", "가입이 되있다구요,V"]}
          accept=".txt,.csv,text/plain,text/csv"
          templateFileName="LearningExpr_양식.txt"
          onDownloadTemplate={handleDownloadTemplate}
          onClose={() => setUploadDialogOpen(false)}
          onConfirm={(file) => void handleUploadUtterances(file)}
        />
      ) : null}

      {uploadResult ? (
        <UploadResultDialog
          title={getIntentStartLabel(copy,"업로드 결과")}
          message={uploadResult.message}
          note={uploadResult.note}
          sections={uploadResult.sections}
          onClose={() => setUploadResult(null)}
        />
      ) : null}

      {saveFailureMessage ? (
        <SaveFailureDialog
          message={saveFailureMessage}
          onClose={() => setSaveFailureMessage(null)}
        />
      ) : null}

      {chatbotMessageEditorBinding ? (
        <ChatbotMessageDialog
          binding={chatbotMessageEditorBinding}
          messages={chatbotMessageDrafts}
          onClose={handleCloseChatbotMessageEditor}
          onChangeMessage={handleUpdateChatbotMessageDraft}
          onAddMessage={handleAddChatbotMessageDraft}
          onRemoveMessage={handleRemoveChatbotMessageDraft}
          onConfirm={handleConfirmChatbotMessageEditor}
        />
      ) : null}

      {startHelpOpen ? (
        <div
          className="dialog-help-modal__backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setStartHelpOpen(false);
            }
          }}
        >
          <section
            className="dialog-help-modal dialog-help-modal--start"
            role="dialog"
            aria-modal="true"
            aria-labelledby="intent-start-help-title"
          >
            <header className="dialog-help-modal__header">
              <h2 id="intent-start-help-title">{getIntentStartLabel(copy,"대화 시작 안내")}</h2>
              <button type="button" aria-label={getIntentStartLabel(copy,"닫기")} onClick={() => setStartHelpOpen(false)}>
                ×
              </button>
            </header>
            <div className="dialog-help-modal__body">
              <section className="dialog-help-modal__section">
                <h3>{getIntentStartLabel(copy,"대화시작 하기")}</h3>
                <div className="dialog-help-modal__notice">
                  <p>{getIntentStartLabel(copy,"학습문장과 개체를 등록하고 관리할 수 있습니다.")}</p>
                  <p>
                    등록한 학습문장과 챗봇 사용자가 입력한 메시지를 비교해 사용자 의도와 가장 가까운 대화를
                    선택해 대화를 진행합니다.
                  </p>
                  <p>
                    개체 등록을 통해 대화 중 사용자가 입력한 메시지 속에서 키워드 정보를 추출해 적절한 질문과
                    답변을 제공할 수 있습니다.
                  </p>
                </div>
              </section>
              <section className="dialog-help-modal__section">
                <h3>{getIntentStartLabel(copy,"단축키")}</h3>
                <div className="dialog-help-modal__notice">
                  <ul>
                    <li>{getIntentStartLabel(copy,"대화시작 저장: Ctrl + S")}</li>
                    <li>{getIntentStartLabel(copy,"대화시작표현 파일 다운로드: Ctrl + D")}</li>
                    <li>{getIntentStartLabel(copy,"대화시작표현 파일 업로드: Ctrl + U")}</li>
                    <li>{getIntentStartLabel(copy, "대화시작 저장 후 대화설계 이동: Ctrl + >")}</li>
                    <li>{getIntentStartLabel(copy,"새로운 개체: Ctrl + E")}</li>
                  </ul>
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
