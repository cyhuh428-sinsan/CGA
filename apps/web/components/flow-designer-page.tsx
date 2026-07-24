"use client";

import Script from "next/script";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useI18n } from "@/components/language-provider";
import { useStudioWorkspace } from "@/components/studio-workspace-provider";
import { SimulatorPage } from "@/components/simulator-page";
import { getBotVersionSettings } from "@/lib/bot-settings";
import { FLOW_DESIGNER_CATALOGS, getFlowDesignerLabel, type FlowDesignerCatalog } from "@/lib/i18n/flow-designer";
import { useEditLock } from "@/lib/use-edit-lock";
import { normalizeApiAssets, type VersionApiMethod, type VersionApiOutputParameter } from "@/lib/api-assets";
import {
  CONDITION_OPERATOR_OPTIONS,
  FLOW_CARD_LABELS,
  FLOW_NODE_SIZES,
  buildNextCanvasPosition,
  collectCommonFlowVariables,
  countManualFlowCards,
  createDialogFlowNode,
  formatVariableName,
  getDialogFlowGraph,
  getFlowLinkTargetId,
  isSystemFlowNode,
  putDialogFlowGraph,
  removeFlowNode,
  setFlowLinkTarget,
  stripVariablePrefix,
  validateVariableName,
  type DialogFlowGraph,
  type DialogFlowLink,
  type DialogFlowNode,
  type DialogFlowNodeKind,
  type DialogFlowPosition,
  type DialogFlowTalkChannelTemplate,
} from "@/lib/dialog-flow";
import {
  applyUpdatedVersionToBot,
  getBotDialogs,
  getDialogTypeLabel,
  withUpdatedDialogs,
} from "@/lib/dialog-assets";
import { saveLastBotScreen, type AuthSession } from "@/lib/auth";


import {
  fetchStudioBotVersionDialogFlow,
  fetchStudioTalkTemplates,
  type StudioBotApiItem,
  type StudioTalkTemplateItem,
  updateStudioBotVersionDialogFlow,
} from "@/lib/studio-bots-api";
import {
  normalizeVersionDialogs,
  normalizeVersionDocument,
  normalizeVersionEntities,
  type VersionDialogAsset,
} from "@/lib/version-document";

type InspectorTab = "test" | "properties" | "variables";

type PaletteKind = Exclude<DialogFlowNodeKind, "start" | "system-variable">;

type ViewModeDialogProps = {
  ownerLabel: string;
  copy: FlowDesignerCatalog;
  onCancel: () => void;
  onConfirm: () => void;
};

function ViewModeDialog({ ownerLabel, copy, onCancel, onConfirm }: ViewModeDialogProps) {
  return (
    <div className="entity-editor-backdrop" role="presentation">
      <div className="intent-editor__view-mode-dialog" role="dialog" aria-modal="true" aria-label={getFlowDesignerLabel(copy, "조회모드 입장")}>
        <div className="entity-editor-dialog__header">
          <strong>{getFlowDesignerLabel(copy, "조회모드 입장")}</strong>
          <button type="button" className="entity-editor-dialog__close" aria-label={getFlowDesignerLabel(copy, "닫기")} onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="entity-editor-dialog__body">
          <div className="intent-editor__view-mode-message">
            {getFlowDesignerLabel(copy, "현재 편집자")} {ownerLabel}{getFlowDesignerLabel(copy, "님이 대화 설계를 편집 중입니다. 조회모드로 들어가시겠습니까? 조회모드에서는 대화 설계를 수정하거나 저장할 수 없습니다.")}
          </div>
        </div>

        <div className="entity-editor-dialog__footer">
          <button type="button" className="secondary-action" onClick={onCancel}>{getFlowDesignerLabel(copy, "취소")}</button>
          <button type="button" className="primary-action" onClick={onConfirm}>{getFlowDesignerLabel(copy, "확인")}</button>
        </div>
      </div>
    </div>
  );
}

type PaletteItem = {
  kind: PaletteKind;
  label: string;
  description: string;
};

type DraggingNodeState = {
  nodeId: string;
  offsetX: number;
  offsetY: number;
  nodeIds: string[];
  linkIds: string[];
  startPointer: DialogFlowPosition;
  startNodePositions: Record<string, DialogFlowPosition>;
  startLinkWaypoints: Record<string, DialogFlowPosition[]>;
};

type SelectionBoxState = {
  start: DialogFlowPosition;
  current: DialogFlowPosition;
};

type CopiedFlowNode = Exclude<DialogFlowNode, { kind: "start" | "system-variable" }>;

type FunctionPickerState = {
  step: "method" | "output";
  apiId: string;
  methodId: string;
  inputValues: Record<string, string>;
  outputIds: string[];
  expandedOutputPaths: string[];
  testOutput: string;
  testOutputValue: unknown;
  testOutputRows: VersionApiOutputParameter[];
  testError: string;
};

type EntityExtractionOption = {
  id: string;
  variableName: string;
  entityId: string;
  entityName: string;
  entityValue: string;
  required: boolean;
  local: boolean;
  category: string;
};

type AdaptiveCardDesignerOutput = {
  adaptiveCard?: unknown;
  submitData?: unknown;
  inputData?: unknown;
  mode?: string;
  [key: string]: unknown;
};

type LinkingState = {
  sourceNodeId: string;
  sourcePort: string;
};

type LinkDragState = {
  sourceNodeId: string;
  sourcePort: string;
  pointer: DialogFlowPosition;
  hoveredTargetNodeId: string | null;
};

type SelectedLinkHandle =
  | {
      linkId: string;
      mode: "source" | "target";
      pointer: DialogFlowPosition;
      hoveredTargetNodeId: string | null;
    }
  | {
      linkId: string;
      mode: "waypoint";
      waypointIndex: number;
      isNew?: boolean;
      startPointer?: DialogFlowPosition;
      hasMoved?: boolean;
    };

const PALETTE_ITEMS: PaletteItem[] = [
  { kind: "talk", label: "Talk", description: "텍스트 메시지를 전달합니다." },
  { kind: "jump", label: "Jump", description: "다른 카드 또는 대화로 이동합니다." },
  { kind: "condition", label: "Condition", description: "조건에 따라 흐름을 분기합니다." },
  { kind: "function", label: "Function", description: "1차에서는 아이콘만 제공합니다." },
  { kind: "variable", label: "Variable", description: "변수를 선언하고 값을 지정합니다." },
  { kind: "script", label: "Script", description: "JavaScript ES2020 코드를 실행합니다." },
  { kind: "end", label: "End", description: "메시지를 보낸 후 대화를 종료합니다." },
];

const CANVAS_SCALE_STEP = 10;
const CANVAS_MIN_SCALE = 50;
const CANVAS_MAX_SCALE = 150;
const CANVAS_STAGE_PADDING = 80;
const ADAPTIVE_CARD_SCRIPT_START = "// Aidot Adaptive Card Designer BEGIN";
const ADAPTIVE_CARD_SCRIPT_END = "// Aidot Adaptive Card Designer END";

const TALK_MESSAGE_TYPE_OPTIONS = [
  { value: "text", label: "기본 메시지", help: "기본 텍스트로 이루어진 메시지로, 최대 5개의 랜덤 메시지를 설정합니다." },
  { value: "html", label: "Html", help: "Html 에디터를 통해서 메시지를 작성할 수 있는 템플릿입니다." },
  { value: "card", label: "Card", help: "타이틀, 이미지 URL, 상세 설명으로 메시지를 작성할 수 있는 템플릿입니다." },
  { value: "table", label: "Table", help: "테이블 형태로 데이터를 전달하고 설정에 따라 값을 선택할 수 있도록 메시지를 설정합니다." },
  { value: "button", label: "Button", help: "버튼 형태의 메시지를 설정할 수 있는 템플릿입니다." },
  { value: "link-button", label: "Link Button", help: "링크 버튼의 Label과 URL을 설정할 수 있는 템플릿입니다." },
  { value: "form", label: "Form", help: "Rich form 메시지 문법에 맞는 JSON 데이터를 작성하는 템플릿입니다." },
  { value: "carousel", label: "Carousel", help: "여러 개의 본문을 슬라이드하여 볼 수 있도록 메시지를 설정할 수 있습니다." },
  { value: "dtmf", label: "DTMF", help: "Voice Bot 전용 설정을 진행할 수 있는 템플릿입니다." },
  { value: "form-a-card", label: "Form(A Card)", help: "Adaptive Cards 메시지 문법에 맞는 JSON 데이터를 작성하는 템플릿입니다." },
] as const;

const TALK_RESPONSE_TYPE_OPTIONS = [
  { value: "none", label: "사용 안함", help: "사용자 응답 처리를 사용하지 않습니다." },
  { value: "single-select", label: "단일 선택", help: "챗봇 사용자가 선택한 값을 대화에서 변수로 사용하도록 설정합니다." },
  { value: "relay", label: "응답 전달", help: "챗봇 사용자가 입력한 답변 전체를 대화에서 변수로 사용하도록 설정합니다." },
  { value: "extract-entity", label: "응답 내 개체 추출", help: "챗봇 사용자가 입력한 답변에서 개체를 추출해 그 값을 변수로 사용합니다." },
  { value: "form-relay", label: "Form 응답 전달", help: "JSON 형식의 응답을 변수에 전달 받기 위한 방법입니다." },
  { value: "tts-auto", label: "TTS 종료후 진행(응답받지않음)", help: "Voice Bot 전용 응답 처리입니다." },
] as const;

type TalkMessageTypeValue = (typeof TALK_MESSAGE_TYPE_OPTIONS)[number]["value"];
type TalkMessageTypeOption = {
  value: TalkMessageTypeValue;
  label: string;
  help: string;
};

type FlowIconKind = DialogFlowNodeKind;

type FlowIconVariant = "badge" | "panel" | "action" | "rail";

function renderFlowIcon(kind: FlowIconKind, variant: FlowIconVariant) {
  const baseClassName = `flow-designer-page__flow-icon flow-designer-page__flow-icon--${variant} flow-designer-page__flow-icon--${kind}`;

  switch (kind) {
    case "start":
      return (
        <span className={baseClassName} aria-hidden="true">
          <svg viewBox="0 0 20 20" focusable="false">
            <path d="M6 4.5L15 10L6 15.5V4.5Z" fill="currentColor" />
          </svg>
        </span>
      );
    case "system-variable":
    case "variable":
      return (
        <span className={`${baseClassName} flow-designer-page__flow-icon--wordmark`} aria-hidden="true">
          {"{Var}"}
        </span>
      );
    case "talk":
      return (
        <span className={`${baseClassName} flow-designer-page__flow-icon--quotes`} aria-hidden="true">
          <span>“</span>
          <span>”</span>
        </span>
      );
    case "jump":
      return (
        <span className={baseClassName} aria-hidden="true">
          <svg viewBox="0 0 20 20" focusable="false">
            <path
              d="M4.5 4.5H9.5V15.5H4.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
            <path
              d="M8 10H15"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
            <path
              d="M12 7L15 10L12 13"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </span>
      );
    case "condition":
      return (
        <span className={baseClassName} aria-hidden="true">
          <svg viewBox="0 0 20 20" focusable="false">
            <path
              d="M5 10H9M9 10V5M9 10V15M9 5H15M9 15H15"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
            <circle cx="5" cy="10" r="1.8" fill="currentColor" />
            <circle cx="15" cy="5" r="1.8" fill="currentColor" />
            <circle cx="15" cy="15" r="1.8" fill="currentColor" />
          </svg>
        </span>
      );
    case "function":
      return (
        <span className={`${baseClassName} flow-designer-page__flow-icon--wordmark`} aria-hidden="true">
          API
        </span>
      );
    case "script":
      return (
        <span className={`${baseClassName} flow-designer-page__flow-icon--wordmark`} aria-hidden="true">
          {"</>"}
        </span>
      );
    case "end":
      return (
        <span className={`${baseClassName} flow-designer-page__flow-icon--square`} aria-hidden="true">
          <span />
        </span>
      );
  }
}

function normalizeTalkMessageType(value: string): TalkMessageTypeValue {
  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === "simple-text") {
    return "text";
  }
  if (normalizedValue === "quick-reply") {
    return "button";
  }
  if (normalizedValue === "basic-card") {
    return "card";
  }
  if (normalizedValue === "list-card") {
    return "table";
  }
  return TALK_MESSAGE_TYPE_OPTIONS.some((item) => item.value === normalizedValue)
    ? (normalizedValue as TalkMessageTypeValue)
    : "text";
}

function getTalkMessageTypeMeta(value: DialogFlowNode["kind"] extends never ? never : string) {
  return TALK_MESSAGE_TYPE_OPTIONS.find((item) => item.value === value) ?? TALK_MESSAGE_TYPE_OPTIONS[0];
}

function getTalkResponseTypeMeta(value: string) {
  return TALK_RESPONSE_TYPE_OPTIONS.find((item) => item.value === value) ?? TALK_RESPONSE_TYPE_OPTIONS[0];
}

function getTalkResponseSettingTitle(value: string) {
  switch (value) {
    case "single-select":
      return "선택형 메시지 설정";
    case "relay":
      return "응답 전달 설정";
    case "form-relay":
      return "Form 응답 전달 설정";
    default:
      return "";
  }
}

function hasTalkUserResponse(value: string) {
  return (
    value === "single-select" ||
    value === "relay" ||
    value === "extract-entity" ||
    value === "form-relay"
  );
}

function getTalkTemplateRequiredError(node: Extract<DialogFlowNode, { kind: "talk" }>) {
  if (node.config.messageType === "html" && !(node.config.messages[0] ?? "").trim()) {
    return "HTML을 입력해주세요.";
  }

  if (node.config.messageType === "form") {
    const formMessage = (node.config.messages[0] ?? "").trim();
    if (!formMessage) {
      return "Form Message를 입력해주세요.";
    }
    if (!formMessage.startsWith("{") && !formMessage.startsWith("[")) {
      return "Form Message는 JSON 형식으로 입력해주세요.";
    }
  }

  if (node.config.messageType === "form-a-card") {
    const formCardMessage = (node.config.messages[0] ?? "").trim();
    if (!formCardMessage) {
      return "Form(A Card)를 입력해주세요.";
    }
    if (!formCardMessage.startsWith("{") && !formCardMessage.startsWith("[")) {
      return "Form(A Card)는 JSON 형식으로 입력해주세요.";
    }
  }

  if (node.config.messageType === "dtmf") {
    const requiredDtmfFields = [
      { value: node.config.messages[0] || "1", label: "DTMF 최대 길이" },
      { value: node.config.messages[1] || "1", label: "DTMF 최소 길이" },
      { value: node.config.messages[2] || "#", label: "입력 종료 문자" },
      { value: node.config.messages[3] || "10", label: "최초 입력 대기 시간" },
      { value: node.config.messages[4] || "10", label: "전체 입력 시간" },
    ];
    const emptyField = requiredDtmfFields.find((item) => !(item.value ?? "").trim());
    if (emptyField) {
      return `${emptyField.label}를 입력해주세요.`;
    }
  }

  if (node.config.messageType === "card" && !(node.config.messages[0] ?? "").trim()) {
    return "타이틀을 입력해주세요.";
  }

  if (node.config.messageType === "carousel" && !(node.config.messages[0] ?? "").trim()) {
    return "Carousel Title을 입력해주세요.";
  }

  if (node.config.messageType === "carousel" && !(node.config.messages[2] ?? "").trim()) {
    return "Item Title을 입력해주세요.";
  }

  if (node.config.messageType === "carousel" && !(node.config.messages[3] ?? "").trim()) {
    return "Item Contents를 입력해주세요.";
  }

  if (node.config.messageType === "button" && node.config.messages.some((item) => !item.trim())) {
    return "Button을 입력해주세요.";
  }

  if (
    node.config.messageType === "table" &&
    node.config.tableUseVariable &&
    !node.config.tableVariableItemId
  ) {
    return "리스트 변수를 선택해주세요.";
  }

  if (node.config.messageType === "link-button") {
    const emptyLinkButton = node.config.linkButtonItems.find(
      (item) => !item.label.trim() || !item.url.trim(),
    );
    if (emptyLinkButton) {
      return !emptyLinkButton.label.trim() ? "Label을 입력해주세요." : "Link를 입력해주세요.";
    }
  }

  if (node.config.floatingButtonMode === "custom") {
    const emptyFloatingButton = node.config.floatingButtons.find(
      (item) => item.enabled && (!item.label.trim() || !item.key.trim()),
    );
    if (emptyFloatingButton) {
      return !emptyFloatingButton.label.trim() ? "플로팅 버튼명을 입력해주세요." : "플로팅 버튼 Key를 입력해주세요.";
    }
  }

  return "";
}

function isActiveTalkTemplate(template: StudioTalkTemplateItem) {
  return template.status === "active";
}

function buildTalkTemplateChannelOptions(templates: StudioTalkTemplateItem[]) {
  const channelMap = new Map<string, string>();
  templates.filter(isActiveTalkTemplate).forEach((template) => {
    if (!channelMap.has(template.channel_code)) {
      channelMap.set(template.channel_code, template.channel_name || template.channel_code);
    }
  });
  return Array.from(channelMap.entries()).map(([value, label]) => ({ value, label }));
}

function buildTalkMessageTypeOptions(
  templates: StudioTalkTemplateItem[],
  channelCode: string,
  botMode?: "text" | "voice",
): TalkMessageTypeOption[] {
  return templates
    .filter(isActiveTalkTemplate)
    .filter((template) => template.channel_code === channelCode)
    .filter((template) => isTalkMessageTypeAvailableForBotMode(template.renderer_type, botMode))
    .map((template) => {
      const normalizedType = normalizeTalkMessageType(template.renderer_type);
      const base = getTalkMessageTypeMeta(normalizedType);
      return {
        ...base,
        value: normalizedType,
        label: template.name,
      };
    });
}

function isKakaoTalkTemplateChannel(channelCode: string) {
  return channelCode.trim().toUpperCase() === "KAKAO";
}

function normalizeTalkChannelTemplateMap(
  channelTemplates: Record<string, DialogFlowTalkChannelTemplate>,
  templates: StudioTalkTemplateItem[],
  botMode?: "text" | "voice",
) {
  return Object.fromEntries(
    Object.entries(channelTemplates).map(([channelCode, template]) => {
      const availableOptions = buildTalkMessageTypeOptions(templates, channelCode, botMode);
      const fallbackMessageType = availableOptions[0]?.value ?? "text";
      const normalizedMessageType = availableOptions.some((option) => option.value === template.messageType)
        ? template.messageType
        : fallbackMessageType;
      return [
        channelCode,
        {
          ...template,
          messageType: normalizedMessageType,
        },
      ];
    }),
  );
}

function buildTalkChannelTemplateFromConfig(
  config: Extract<DialogFlowNode, { kind: "talk" }>["config"],
): DialogFlowTalkChannelTemplate {
  return {
    messageType: config.messageType,
    messages: [...config.messages],
    tableUseVariable: config.tableUseVariable,
    tableVariableItemId: config.tableVariableItemId,
    tableKeyColumn: config.tableKeyColumn,
    tableColumnMappings: config.tableColumnMappings.map((item) => ({ ...item })),
    tableManualRows: config.tableManualRows.map((row) => ({
      ...row,
      values: [...row.values],
    })),
    linkButtonItems: config.linkButtonItems.map((item) => ({ ...item })),
  };
}

function applyTalkChannelTemplateToConfig(
  config: Extract<DialogFlowNode, { kind: "talk" }>["config"],
  channelCode: string,
  fallbackMessageType: Extract<DialogFlowNode, { kind: "talk" }>["config"]["messageType"],
): Extract<DialogFlowNode, { kind: "talk" }>["config"] {
  const template = config.channelTemplates[channelCode];
  if (!template) {
    return {
      ...config,
      templateChannel: channelCode,
      messageType: fallbackMessageType,
      messages: fallbackMessageType === "text" ? config.messages : [""],
      tableUseVariable: true,
      tableVariableItemId: "",
      tableKeyColumn: "",
      tableColumnMappings: [],
      tableManualRows: [{ id: crypto.randomUUID(), key: "", values: [""] }],
      linkButtonItems: [{ id: crypto.randomUUID(), label: "", url: "" }],
    };
  }

  return {
    ...config,
    templateChannel: channelCode,
    messageType: template.messageType,
    messages: [...template.messages],
    tableUseVariable: template.tableUseVariable,
    tableVariableItemId: template.tableVariableItemId,
    tableKeyColumn: template.tableKeyColumn,
    tableColumnMappings: template.tableColumnMappings.map((item) => ({ ...item })),
    tableManualRows: template.tableManualRows.map((row) => ({
      ...row,
      values: [...row.values],
    })),
    linkButtonItems: template.linkButtonItems.map((item) => ({ ...item })),
  };
}

function snapshotTalkActiveChannelConfig(
  config: Extract<DialogFlowNode, { kind: "talk" }>["config"],
): Extract<DialogFlowNode, { kind: "talk" }>["config"] {
  if (!config.templateChannel) return config;
  return {
    ...config,
    channelTemplates: {
      ...config.channelTemplates,
      [config.templateChannel]: buildTalkChannelTemplateFromConfig(config),
    },
  };
}
function isTalkMessageTypeAvailableForBotMode(value: string, botMode?: "text" | "voice") {
  const normalizedValue = normalizeTalkMessageType(value);
  if (botMode !== "voice") {
    return true;
  }

  return normalizedValue === "button" || normalizedValue === "dtmf";
}

function supportsExceptionHandling(kind: DialogFlowNodeKind) {
  return kind === "variable" || kind === "function" || kind === "script";
}

function buildTalkTableColumnMappings(
  columns: string[],
  existingMappings: Array<{ id: string; column: string; value: string }>,
) {
  return columns.map((column) => {
    const existingMapping = existingMappings.find((item) => item.column === column);
    return existingMapping ?? { id: crypto.randomUUID(), column, value: column };
  });
}

function collectTableColumnsFromValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const firstRow = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!firstRow || typeof firstRow !== "object" || Array.isArray(firstRow)) {
      return [];
    }

    return Object.keys(firstRow).filter((key) => key.trim().length > 0);
  } catch {
    return [];
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectTableColumnsFromScriptArray(code: string, scriptVariableName: string) {
  const variableName = scriptVariableName.trim();
  if (!code.trim() || !variableName) {
    return [];
  }

  const assignmentMatch = new RegExp(
    `(?:const|let|var)\\s+${escapeRegExp(variableName)}\\s*=\\s*(\\[[\\s\\S]*?\\])\\s*;?`,
  ).exec(code);
  if (!assignmentMatch) {
    return [];
  }

  return collectTableColumnsFromValue(assignmentMatch[1]);
}

function mergeTableColumns(manualColumns: string[], value: string) {
  return Array.from(
    new Set([
      ...manualColumns.map((column) => column.trim()).filter(Boolean),
      ...collectTableColumnsFromValue(value),
    ]),
  );
}

function collectVariableNamesFromText(value: string) {
  return Array.from(value.matchAll(/\$[\p{ID_Start}_][$_\u200C\u200D\p{ID_Continue}]*/gu), (match) => match[0]);
}

type FlowVariableHelpRow = {
  name: string;
  category: string;
  description: string;
};

type FlowVariablePanelRow = FlowVariableHelpRow & {
  cardNames?: string;
  source?: string;
  valueType?: string;
};

type FlowVariablePanelGroup = {
  key: "user" | "common";
  title: string;
  type: "user" | "common";
  rows: FlowVariablePanelRow[];
};

type FlowFunctionHelpRow = {
  name: string;
  description: string;
  valueType: string;
  input: string;
  value: string;
  example: string;
  result: string;
};

const FLOW_VARIABLE_PANEL_PAGE_SIZE = 10;

const COMMON_FLOW_VARIABLES: FlowVariableHelpRow[] = [
  { name: "_bot_hub_id", category: "시스템", description: "봇 허브 소속일 때의 허브 ID" },
  { name: "_bot_hub_name", category: "시스템", description: "봇 허브 소속일 때의 허브 이름" },
  { name: "_bot_id", category: "시스템", description: "현재 Bot ID" },
  { name: "_bot_name", category: "시스템", description: "현재 Bot 이름" },
  { name: "_channel_id", category: "시스템", description: "메신저 채널 ID" },
  { name: "_date_time", category: "시스템", description: "현재 날짜시각" },
  { name: "_dialog_id", category: "시스템", description: "현재 Dialog ID" },
  { name: "_dialog_start_time", category: "시스템", description: "현재 대화 시작시간" },
  { name: "_id", category: "시스템", description: "현재 대화 컨텍스트 ID" },
  { name: "_msg", category: "시스템", description: "마지막 사용자 발화 메시지" },
  { name: "_session_id", category: "시스템", description: "Session ID" },
  { name: "_today", category: "시스템", description: "오늘 날짜" },
  { name: "_user_id", category: "시스템", description: "메신저에서 제공하는 사용자 ID" },
  { name: "_user_name", category: "시스템", description: "메신저에서 제공하는 사용자 이름" },
  { name: "_semantic_answers", category: "시스템", description: "Semantic RAG 답변 후보 목록" },
  { name: "_semantic_answer_text", category: "시스템", description: "Semantic RAG 최상위 답변 본문" },
  { name: "_semantic_answer_score", category: "시스템", description: "Semantic RAG 최상위 답변 Score" },
  { name: "_semantic_answer_intent_id", category: "시스템", description: "Semantic RAG 답변 의도 ID" },
  { name: "_semantic_answer_intent_name", category: "시스템", description: "Semantic RAG 답변 의도명" },
  { name: "_semantic_answer_source_type", category: "시스템", description: "Semantic RAG 답변 출처 유형" },
  { name: "_semantic_answer_source_title", category: "시스템", description: "Semantic RAG 답변 출처 제목" },
  { name: "_semantic_answer_page", category: "시스템", description: "Semantic RAG PDF 페이지" },
  { name: "_rag_answers", category: "시스템", description: "Semantic RAG 답변 후보 목록(호환)" },
  { name: "_rag_answer_text", category: "시스템", description: "Semantic RAG 최상위 답변 본문(호환)" },
  { name: "_rag_answer_score", category: "시스템", description: "Semantic RAG 최상위 답변 Score(호환)" },
  { name: "_rag_answer_intent_id", category: "시스템", description: "Semantic RAG 답변 의도 ID(호환)" },
  { name: "_rag_answer_intent_name", category: "시스템", description: "Semantic RAG 답변 의도명(호환)" },
  { name: "_rag_answer_source_type", category: "시스템", description: "Semantic RAG 답변 출처 유형(호환)" },
  { name: "_rag_answer_source_title", category: "시스템", description: "Semantic RAG 답변 출처 제목(호환)" },
  { name: "_rag_answer_page", category: "시스템", description: "Semantic RAG PDF 페이지(호환)" },
  { name: "_llm_answers", category: "시스템", description: "LLM RAG 답변 후보 목록" },
  { name: "_llm_answer_text", category: "시스템", description: "LLM RAG 최상위 답변 본문" },
  { name: "_llm_answer_score", category: "시스템", description: "LLM RAG 최상위 답변 Score" },
  { name: "_llm_answer_intent_id", category: "시스템", description: "LLM RAG 답변 의도 ID" },
  { name: "_llm_answer_intent_name", category: "시스템", description: "LLM RAG 답변 의도명" },
  { name: "_llm_answer_source_type", category: "시스템", description: "LLM RAG 답변 출처 유형" },
  { name: "_llm_answer_source_title", category: "시스템", description: "LLM RAG 답변 출처 제목" },
  { name: "_llm_answer_page", category: "시스템", description: "LLM RAG PDF 페이지" },
];

const FLOW_DESIGN_FUNCTIONS: FlowFunctionHelpRow[] = [
  {
    name: "at",
    description: "해당 index의 값을 추출한다. 시작값은 0이다.",
    valueType: "Array",
    input: "(index_num)",
    value: '["사과", "배", "감", "귤"]',
    example: "{{$value.at(1)}}",
    result: "배",
  },
  {
    name: "size",
    description: "리스트의 사이즈를 추출한다.",
    valueType: "Array",
    input: "-",
    value: '["사과", "배", "감", "귤"]',
    example: "{{$value.size()}}",
    result: "4",
  },
  {
    name: "first",
    description: "리스트의 첫 번째 값을 추출한다.",
    valueType: "Array",
    input: "-",
    value: '["사과", "배", "감", "귤"]',
    example: "{{$value.first()}}",
    result: "사과",
  },
  {
    name: "last",
    description: "리스트의 마지막 값을 추출한다.",
    valueType: "Array",
    input: "-",
    value: '["사과", "배", "감", "귤"]',
    example: "{{$value.last()}}",
    result: "귤",
  },
  {
    name: "range",
    description: "variable의 배열일 때 from에서 to까지의 값을 추출한다. 시작값은 0이다.",
    valueType: "Array",
    input: "(from_index, to_index)",
    value: '["사과", "배", "감", "귤"]',
    example: "{{$value.range(0,2)}}",
    result: "사과, 배, 감",
  },
  {
    name: "splitby",
    description: "variable의 값을 해당 문자열로 분리한다.",
    valueType: "String",
    input: "(splitter_char)",
    value: "사과-배-감-귤",
    example: "{{$value.splitby('-')}}",
    result: "사과, 배, 감, 귤",
  },
  {
    name: "target",
    description: "해당 variable의 정규화된 값으로 변환한다.",
    valueType: "Target",
    input: "-",
    value: "오늘 오후 세시",
    example: "{{$value.target()}}",
    result: "2020-06-26 3:00:00 PM",
  },
  {
    name: "concat",
    description: "variable의 값에 해당 문자열을 붙인다.",
    valueType: "String",
    input: "(concat_char)",
    value: "사과",
    example: "{{$value.concat('는 맛있어')}}",
    result: "사과는 맛있어",
  },
  {
    name: "contains",
    description: "variable의 값에 해당 문자열이 있는지 판단한다.",
    valueType: "String",
    input: "(contains_char)",
    value: "아이디, 비밀번호 재설정 어떻게 하면 되나요?",
    example: "{{$value.contains('비밀번호')}}",
    result: "true",
  },
  {
    name: "substring",
    description: "variable의 값에서 from에서 to까지의 값을 추출한다. 시작값은 0이다.",
    valueType: "String",
    input: "(from_index, to_index)",
    value: "아이디, 비밀번호 재설정 어떻게 하면 되나요?",
    example: "{{$value.substring(0,3)}}",
    result: "아이디",
  },
  {
    name: "year",
    description: "yyyy-MM-dd HH:mm 포맷 데이터에서 연도값을 추출한다.",
    valueType: "Time",
    input: "-",
    value: "2020-01-06 6:30:00 PM",
    example: "{{$value.year()}}",
    result: "2020",
  },
  {
    name: "month",
    description: "yyyy-MM-dd HH:mm 포맷 데이터에서 월값을 추출한다.",
    valueType: "Time",
    input: "-",
    value: "2020-01-06 6:30:00 PM",
    example: "{{$value.month()}}",
    result: "1",
  },
  {
    name: "day",
    description: "yyyy-MM-dd HH:mm 포맷 데이터에서 일값을 추출한다.",
    valueType: "Time",
    input: "-",
    value: "2020-01-06 6:30:00 PM",
    example: "{{$value.day()}}",
    result: "6",
  },
  {
    name: "hour",
    description: "yyyy-MM-dd HH:mm 포맷 데이터에서 시간값을 추출한다.",
    valueType: "Time",
    input: "-",
    value: "2020-01-06 6:30:00 PM",
    example: "{{$value.hour()}}",
    result: "18",
  },
  {
    name: "format",
    description: "날짜 데이터를 파라미터 포맷값으로 변경한다.",
    valueType: "Time",
    input: "(datetime_format)",
    value: "2020-01-06 6:30:00 PM",
    example: "{{$value.format(yyyy-MM-dd)}}",
    result: "2020-01-06",
  },
  {
    name: "add",
    description: "variable에 숫자를 더한다.",
    valueType: "Double",
    input: "(Double)",
    value: "100.0",
    example: "{{$value.add(15.5)}}",
    result: "115.5",
  },
  {
    name: "sub",
    description: "variable에서 숫자를 뺀다.",
    valueType: "Double",
    input: "(Double)",
    value: "100.0",
    example: "{{$value.sub(15.5)}}",
    result: "84.5",
  },
  {
    name: "multi",
    description: "variable에 숫자를 곱한다.",
    valueType: "Double",
    input: "(Double)",
    value: "100.0",
    example: "{{$value.multi(15.5)}}",
    result: "1550.0",
  },
  {
    name: "div",
    description: "variable을 숫자로 나눈다.",
    valueType: "Double",
    input: "(Double)",
    value: "100.0",
    example: "{{$value.div(15.5)}}",
    result: "6.4516129032258",
  },
  {
    name: "jsonpath",
    description: "JSON Object를 JsonPath 방식으로 파싱한다.",
    valueType: "Array, Object",
    input: "(JsonPath Expression)",
    value: '{ "bookstore": { "book": [{ "author": "Elie Wiesel", "title": "Night" }] } }',
    example: "{{$value.jsonpath($.book[?(@.author=='Elie Wiesel')])}}",
    result: '[{ "author": "Elie Wiesel", "title": "Night" }]',
  },
];

const COMMON_FLOW_VARIABLE_NAME_SET = new Set(
  COMMON_FLOW_VARIABLES.map((item) => stripVariablePrefix(item.name).toLowerCase()),
);

function normalizeFlowVariableName(variableName: string) {
  return stripVariablePrefix(variableName);
}

function isQaFlowVariableName(variableName: string) {
  const normalized = normalizeFlowVariableName(variableName).toLowerCase();
  return normalized === "_qa" || normalized.startsWith("_qa.");
}

function displayFlowVariableName(value: string) {
  return stripVariablePrefix(formatVariableName(value) || value);
}

const SYSTEM_FLOW_VARIABLE_NAMES = Array.from(
  new Set(["input", "result", ...COMMON_FLOW_VARIABLES.map((item) => stripVariablePrefix(item.name))]),
);

function getVariableReferenceRoot(value: string) {
  let expression = stripVariablePrefix(value.trim());
  for (const suffix of [".target()", ".value()"]) {
    if (expression.endsWith(suffix)) {
      expression = expression.slice(0, -suffix.length);
    }
  }
  return expression.split(".")[0] ?? "";
}

function collectTemplateVariableNamesFromText(value: string) {
  return Array.from(value.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g), (match) => getVariableReferenceRoot(match[1] ?? "")).filter(Boolean);
}

function buildNodeSummary(node: DialogFlowNode, dialog: VersionDialogAsset) {
  switch (node.kind) {
    case "start":
      return node.config.previewUtterance || dialog.utterances[0]?.text || "대화 시작 표현이 없습니다.";
    case "system-variable":
      return dialog.entityBindings.length > 0
        ? dialog.entityBindings
            .map((binding) => formatVariableName(binding.variableName) || `$${binding.variableName}`)
            .slice(0, 3)
            .join(", ")
        : "대화 시작 개체가 없습니다.";
    case "talk":
      if (node.config.messageType === "table") {
        return node.config.tableVariableItemId ? "Table 템플릿" : "리스트 변수를 선택하세요.";
      }
      return node.config.basicMessages.find((item) => item.trim()) || "텍스트 메시지를 입력하세요.";
    case "jump":
      return node.config.targetType === "dialog"
        ? node.config.targetDialogName || "이동할 의도/모듈을 선택하세요."
        : node.config.targetCardId
          ? "현재 대화의 카드로 이동"
          : "이동할 카드를 선택하세요.";
    case "condition":
      return node.config.variableName || "조건 판단에 사용할 변수를 입력하세요.";
    case "function":
      return node.config.apiId ? node.config.resultVariableName || "API 호출 결과" : "API를 선택하세요.";
    case "variable":
      return node.config.items
        .map((item) => formatVariableName(item.variableName))
        .filter(Boolean)
        .slice(0, 3)
        .join(", ") || "변수를 추가하세요.";
    case "script":
      return node.config.code.trim() ? "JavaScript ES2020" : "스크립트 코드를 입력하세요.";
    case "end":
      return node.config.endSessionImmediately ? "Session 바로 종료" : "대화 종료";
  }
}

function buildNodeTypeLabel(node: DialogFlowNode) {
  if (node.kind === "system-variable") {
    return "기본 카드";
  }

  if (node.kind === "start") {
    return "시작 카드";
  }

  if (node.kind === "function") {
    return "API";
  }

  return FLOW_CARD_LABELS[node.kind];
}

function getNodeById(graph: DialogFlowGraph, nodeId: string) {
  return graph.nodes.find((node) => node.id === nodeId) ?? null;
}

function getFunctionOutputRows(method: VersionApiMethod): VersionApiOutputParameter[] {
  return method.outputParameters.length > 0
    ? method.outputParameters.some((parameter) => parameter.path === "root")
      ? method.outputParameters
      : [
          {
            id: "root",
            name: "root",
            path: "root",
            dataType: "object",
            description: "",
          },
          ...method.outputParameters,
        ]
    : [
        {
          id: "root",
          name: "root",
          path: "root",
          dataType: "object",
          description: "",
        },
      ];
}

function getFunctionValueDataType(value: unknown): VersionApiOutputParameter["dataType"] {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value && typeof value === "object") {
    return "object";
  }

  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  return "string";
}

function buildFunctionOutputRowsFromValue(value: unknown, name = "root", path = "root"): VersionApiOutputParameter[] {
  const row = {
    id: path,
    name,
    path,
    dataType: getFunctionValueDataType(value),
    description: "",
  } satisfies VersionApiOutputParameter;

  if (Array.isArray(value)) {
    const firstItem = value.find((item) => item !== null && item !== undefined);
    return firstItem === undefined
      ? [row]
      : [row, ...buildFunctionOutputRowsFromValue(firstItem, `${name}[]`, `${path}[]`).slice(1)];
  }

  if (value && typeof value === "object") {
    return [
      row,
      ...Object.entries(value as Record<string, unknown>).flatMap(([childName, childValue]) =>
        buildFunctionOutputRowsFromValue(childValue, childName, `${path}.${childName}`),
      ),
    ];
  }

  return [row];
}

function getFunctionOutputDepth(path: string) {
  return path.replace(/^root/, "").split(".").filter(Boolean).length;
}

function getFunctionOutputDisplayDepth(path: string, hideRoot: boolean) {
  const depth = getFunctionOutputDepth(path);
  return hideRoot ? Math.max(depth - 1, 0) : depth;
}

function getFunctionOutputParentPath(path: string) {
  if (path === "root") {
    return "";
  }

  const normalizedPath = path.replace(/\[\]/g, "");
  const lastDotIndex = normalizedPath.lastIndexOf(".");
  if (lastDotIndex < 0) {
    return "root";
  }

  return normalizedPath.slice(0, lastDotIndex);
}

function getFunctionOutputValue(source: unknown, path: string) {
  const normalizedPath = path.trim();
  if (!normalizedPath || normalizedPath === "root") {
    return source;
  }

  const segments = normalizedPath
    .replace(/^root\.?/, "")
    .replace(/\[\]/g, ".0")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.reduce<unknown>((current, segment) => {
    if (current == null) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, source);
}

function hasFunctionOutputChildren(rows: VersionApiOutputParameter[], path: string) {
  return rows.some((row) => getFunctionOutputParentPath(row.path) === path);
}

function getFunctionOutputAncestorPaths(path: string) {
  const ancestorPaths: string[] = [];
  let parentPath = getFunctionOutputParentPath(path);
  while (parentPath) {
    ancestorPaths.push(parentPath);
    parentPath = getFunctionOutputParentPath(parentPath);
  }
  return ancestorPaths;
}

function isFunctionOutputDescendantPath(path: string, parentPath: string) {
  return path.startsWith(`${parentPath}.`) || path.startsWith(`${parentPath}[]`);
}

function getVisibleFunctionOutputRows(rows: VersionApiOutputParameter[], expandedPaths: string[]) {
  const expandedPathSet = new Set(expandedPaths);
  return rows.filter((row) => {
    let parentPath = getFunctionOutputParentPath(row.path);
    while (parentPath) {
      if (!expandedPathSet.has(parentPath)) {
        return false;
      }
      parentPath = getFunctionOutputParentPath(parentPath);
    }

    return true;
  });
}

function buildFunctionPickerTestOutputPreview(
  source: unknown,
  rows: VersionApiOutputParameter[],
  selectedOutputIds: string[],
) {
  if (source === undefined) {
    return "";
  }

  const selectedRows = rows.filter((row) => selectedOutputIds.includes(row.id));
  if (selectedRows.length === 0) {
    return "";
  }

  if (selectedRows.some((row) => row.path === "root")) {
    return JSON.stringify(source, null, 2);
  }

  const selectedOutput = Object.fromEntries(
    selectedRows.map((row) => [row.name || row.path, getFunctionOutputValue(source, row.path)]),
  );
  return JSON.stringify(selectedRows.length === 1 ? Object.values(selectedOutput)[0] : selectedOutput, null, 2);
}

function buildFunctionOutputMappings(
  method: VersionApiMethod | null,
  existingMappings: Extract<DialogFlowNode, { kind: "function" }>["config"]["outputMappings"],
  fallbackVariableName = "apiResult",
  fallbackRows: VersionApiOutputParameter[] = [],
) {
  if (!method) {
    return [];
  }

  const rows =
    method.outputParameters.length > 0
      ? getFunctionOutputRows(method)
      : fallbackRows.length > 0
        ? fallbackRows
        : existingMappings.length > 0
          ? existingMappings.map((mapping) => ({
              id: mapping.parameterId,
              name: mapping.name,
              path: mapping.path,
              dataType: mapping.dataType,
              description: "",
            }))
          : getFunctionOutputRows(method);

  return rows.map((parameter) => {
    const existing = existingMappings.find(
      (mapping) =>
        mapping.parameterId === parameter.id ||
        mapping.path === parameter.path ||
        mapping.name === parameter.name,
    );
    const isRoot = parameter.path === "root" || parameter.name === "root";
    return {
      id: existing?.id ?? crypto.randomUUID(),
      parameterId: parameter.id,
      name: parameter.name,
      path: parameter.path,
      dataType: parameter.dataType,
      variableName: existing?.variableName ?? (isRoot ? stripVariablePrefix(fallbackVariableName) || "apiResult" : ""),
      local: existing?.local ?? false,
    };
  });
}

function getSavedFunctionOutputSchema(
  node: Extract<DialogFlowNode, { kind: "function" }>,
  method: VersionApiMethod | null,
) {
  if (!method || method.id !== node.config.methodId) {
    return [];
  }

  return method.outputParameters.length > 0 ? [] : node.config.outputSchema;
}

function getSelectedFunctionOutputMappings(
  method: VersionApiMethod,
  existingMappings: Extract<DialogFlowNode, { kind: "function" }>["config"]["outputMappings"],
  fallbackVariableName = "apiResult",
  fallbackRows: VersionApiOutputParameter[] = [],
) {
  const allRows = buildFunctionOutputMappings(method, existingMappings, fallbackVariableName, fallbackRows);
  const selectedIds = new Set(existingMappings.map((mapping) => mapping.parameterId));
  const selectedRows = allRows.filter((mapping) => selectedIds.has(mapping.parameterId));
  const nonRootRows = selectedRows.filter((mapping) => mapping.path !== "root");
  const rowsWithVariableName = nonRootRows.filter((mapping) => stripVariablePrefix(mapping.variableName));
  const displayRows = rowsWithVariableName.length > 0
    ? rowsWithVariableName
    : nonRootRows.length > 0
    ? nonRootRows
    : selectedRows;

  return displayRows.filter(
    (mapping) =>
      !displayRows.some(
        (selectedMapping) =>
          selectedMapping.parameterId !== mapping.parameterId &&
          isFunctionOutputDescendantPath(mapping.path, selectedMapping.path) &&
          (selectedMapping.dataType === "object" || selectedMapping.dataType === "array"),
      ),
  );
}

function clampPosition(position: DialogFlowPosition): DialogFlowPosition {
  return {
    x: Math.max(24, Math.round(position.x)),
    y: Math.max(24, Math.round(position.y)),
  };
}

function getCanvasPointerPosition(
  viewport: HTMLDivElement | null,
  clientX: number,
  clientY: number,
  scale = 1,
): DialogFlowPosition | null {
  if (!viewport) {
    return null;
  }

  const rect = viewport.getBoundingClientRect();
  return {
    x: (clientX - rect.left + viewport.scrollLeft) / scale,
    y: (clientY - rect.top + viewport.scrollTop) / scale,
  };
}

function getConditionOptionMeta(operator: string) {
  return CONDITION_OPERATOR_OPTIONS.find((item) => item.value === operator) ?? CONDITION_OPERATOR_OPTIONS[0];
}

function getPointToSegmentDistance(
  point: DialogFlowPosition,
  start: DialogFlowPosition,
  end: DialogFlowPosition,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)),
  );
  const projectionX = start.x + dx * t;
  const projectionY = start.y + dy * t;
  return Math.hypot(point.x - projectionX, point.y - projectionY);
}

function getRectFromPoints(start: DialogFlowPosition, end: DialogFlowPosition) {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  return { left, right, top, bottom };
}

function isPointInsideRect(point: DialogFlowPosition, rect: ReturnType<typeof getRectFromPoints>) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function isNodeInsideRect(node: DialogFlowNode, rect: ReturnType<typeof getRectFromPoints>) {
  const size = FLOW_NODE_SIZES[node.kind];
  return (
    node.position.x + size.width >= rect.left &&
    node.position.x <= rect.right &&
    node.position.y + size.height >= rect.top &&
    node.position.y <= rect.bottom
  );
}

function isSegmentRectOverlapping(
  start: DialogFlowPosition,
  end: DialogFlowPosition,
  rect: ReturnType<typeof getRectFromPoints>,
) {
  if (isPointInsideRect(start, rect) || isPointInsideRect(end, rect)) {
    return true;
  }

  const segmentLeft = Math.min(start.x, end.x);
  const segmentRight = Math.max(start.x, end.x);
  const segmentTop = Math.min(start.y, end.y);
  const segmentBottom = Math.max(start.y, end.y);
  return (
    segmentRight >= rect.left &&
    segmentLeft <= rect.right &&
    segmentBottom >= rect.top &&
    segmentTop <= rect.bottom
  );
}

function cloneFlowConfig<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneCopiedFlowNode(node: CopiedFlowNode, position: DialogFlowPosition): CopiedFlowNode {
  const base = {
    id: crypto.randomUUID(),
    title: node.title,
    position,
  };

  switch (node.kind) {
    case "talk":
      return { ...base, kind: "talk", config: cloneFlowConfig(node.config) };
    case "jump":
      return { ...base, kind: "jump", config: cloneFlowConfig(node.config) };
    case "condition":
      return { ...base, kind: "condition", config: cloneFlowConfig(node.config) };
    case "function":
      return { ...base, kind: "function", config: cloneFlowConfig(node.config) };
    case "variable":
      return { ...base, kind: "variable", config: cloneFlowConfig(node.config) };
    case "script":
      return { ...base, kind: "script", config: cloneFlowConfig(node.config) };
    case "end":
      return { ...base, kind: "end", config: cloneFlowConfig(node.config) };
  }
}

function sanitizeDialogFlowFileName(value: string) {
  const fileName = value.replace(/[\\/:*?"<>|]+/g, "_").trim();
  return fileName || "dialog-flow";
}

function isDialogFlowImportPayload(value: unknown): value is Partial<DialogFlowGraph> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<DialogFlowGraph>;
  return Array.isArray(candidate.nodes) && Array.isArray(candidate.links);
}

function downloadDialogFlowGraph(fileName: string, graph: DialogFlowGraph) {
  const blob = new Blob([JSON.stringify(graph, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildLinkPoints(
  source: DialogFlowPosition,
  target: DialogFlowPosition,
  waypoints: DialogFlowPosition[] = [],
) {
  return [source, ...waypoints, target];
}

function getLinkLabelPosition(points: DialogFlowPosition[]) {
  if (points.length <= 1) {
    return { x: 0, y: 0 };
  }

  const segmentIndex = Math.max(0, Math.floor((points.length - 2) / 2));
  const start = points[segmentIndex];
  const end = points[segmentIndex + 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  let normalX = -dy / length;
  let normalY = dx / length;

  if (normalY > -0.2) {
    normalX *= -1;
    normalY *= -1;
  }

  return {
    x: (start.x + end.x) / 2 + normalX * 14,
    y: (start.y + end.y) / 2 + normalY * 14,
  };
}

function getNearestLinkSegmentIndex(points: DialogFlowPosition[], pointer: DialogFlowPosition) {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < points.length - 1; index += 1) {
    const distance = getPointToSegmentDistance(pointer, points[index], points[index + 1]);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }

  return nearestIndex;
}

function getPointDistance(start: DialogFlowPosition, end: DialogFlowPosition) {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function offsetWaypoint(point: DialogFlowPosition, offsetX: number, offsetY: number): DialogFlowPosition {
  return {
    x: Math.round(point.x + offsetX),
    y: Math.round(point.y + offsetY),
  };
}

function preserveLinkWaypointShape(
  waypoints: DialogFlowPosition[],
  mode: "source" | "target",
  previousAnchor: DialogFlowPosition | null,
  nextAnchor: DialogFlowPosition | null,
) {
  if (!previousAnchor || !nextAnchor || waypoints.length === 0) {
    return waypoints;
  }

  const offsetX = nextAnchor.x - previousAnchor.x;
  const offsetY = nextAnchor.y - previousAnchor.y;
  if (offsetX === 0 && offsetY === 0) {
    return waypoints;
  }

  if (mode === "source") {
    return waypoints.map((point, index) =>
      index === 0 ? offsetWaypoint(point, offsetX, offsetY) : point,
    );
  }

  return waypoints.map((point, index) =>
    index === waypoints.length - 1 ? offsetWaypoint(point, offsetX, offsetY) : point,
  );
}

function removeUnlinkedConditionBranches(graph: DialogFlowGraph): DialogFlowGraph {
  const linkedBranchPorts = new Set(
    graph.links
      .filter((link) => link.sourcePort.startsWith("branch:"))
      .map((link) => `${link.sourceNodeId}:${link.sourcePort}`),
  );

  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.kind === "condition"
        ? {
            ...node,
            config: {
              ...node.config,
              branches: node.config.branches.filter((branch) =>
                linkedBranchPorts.has(`${node.id}:branch:${branch.id}`),
              ),
            },
          }
        : node,
    ),
  };
}

function getNodeSourceAnchor(graph: DialogFlowGraph, link: DialogFlowLink) {
  const node = getNodeById(graph, link.sourceNodeId);
  if (!node) {
    return null;
  }

  const size = FLOW_NODE_SIZES[node.kind];
  const x = node.position.x + size.width;

  if (node.kind === "condition" && link.sourcePort.startsWith("branch:")) {
    const branchId = link.sourcePort.slice("branch:".length);
    const branchIndex = node.config.branches.findIndex((branch) => branch.id === branchId);
    const spread = 20;
    const centerOffset = (branchIndex - (node.config.branches.length - 1) / 2) * spread;
    const y = node.position.y + size.height / 2 + centerOffset;
    return { x, y };
  }

  return {
    x,
    y: node.position.y + size.height / 2,
  };
}

function getNodeTargetAnchor(graph: DialogFlowGraph, link: DialogFlowLink) {
  const node = getNodeById(graph, link.targetNodeId);
  if (!node) {
    return null;
  }

  const size = FLOW_NODE_SIZES[node.kind];
  return {
    x: node.position.x,
    y: node.position.y + size.height / 2,
  };
}

function getLinkLabel(graph: DialogFlowGraph, link: DialogFlowLink) {
  const sourceNode = getNodeById(graph, link.sourceNodeId);
  if (!sourceNode) {
    return "";
  }

  if (link.sourcePort === "exception") {
    return "예외";
  }

  if (sourceNode.kind === "condition" && link.sourcePort.startsWith("branch:") && !sourceNode.config.hideLabels) {
    const branchId = link.sourcePort.slice("branch:".length);
    return sourceNode.config.branches.find((branch) => branch.id === branchId)?.label ?? "";
  }

  return "";
}

function getLinkKindLabel(link: DialogFlowLink) {
  if (link.sourcePort === "exception") {
    return "예외";
  }

  switch (link.kind) {
    case "condition":
      return "조건 분기";
    case "jump":
      return "이동";
    default:
      return "기본 연결";
  }
}

function getLinkSourcePortLabel(graph: DialogFlowGraph, link: DialogFlowLink) {
  const sourceNode = getNodeById(graph, link.sourceNodeId);
  if (!sourceNode) {
    return "";
  }

  if (link.sourcePort === "next") {
    return "다음 카드";
  }

  if (link.sourcePort === "jump") {
    return "이동";
  }

  if (link.sourcePort === "exception") {
    return "예외";
  }

  if (sourceNode.kind === "condition" && link.sourcePort.startsWith("branch:")) {
    const branchId = link.sourcePort.slice("branch:".length);
    return sourceNode.config.branches.find((branch) => branch.id === branchId)?.label ?? "분기";
  }

  return link.sourcePort;
}

function getLinkMarkerId(link: DialogFlowLink, isSelected: boolean) {
  if (isSelected) {
    return "flow-link-arrow-selected";
  }

  if (link.sourcePort === "exception") {
    return "flow-link-arrow-exception";
  }

  switch (link.kind) {
    case "condition":
      return "flow-link-arrow-condition";
    case "jump":
      return "flow-link-arrow-jump";
    default:
      return "flow-link-arrow-default";
  }
}

function getLinkPath(points: DialogFlowPosition[]) {
  if (points.length < 2) {
    return "";
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const delta = Math.max(48, Math.abs(next.x - current.x) / 2);
    path += ` C ${current.x + delta} ${current.y}, ${next.x - delta} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
}

export function FlowDesignerPage() {
  const { language: uiLanguage } = useI18n();
  const copy = FLOW_DESIGNER_CATALOGS[uiLanguage];
  const workspace = useStudioWorkspace();
  const params = useParams<{ botId: string; versionId: string; intentId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const botId = workspace.bot.id || (typeof params.botId === "string" ? decodeURIComponent(params.botId) : "");
  const versionId = typeof params.versionId === "string" ? decodeURIComponent(params.versionId) : "v1";
  const dialogId = typeof params.intentId === "string" ? decodeURIComponent(params.intentId) : "";

  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const scriptLineNumberRef = useRef<HTMLDivElement | null>(null);
  const adaptiveCardDesignerHostRef = useRef<HTMLDivElement | null>(null);
  const entityExtractionPickerRef = useRef<HTMLDivElement | null>(null);
  const htmlEditorRef = useRef<HTMLDivElement | null>(null);
  const flowMenuRef = useRef<HTMLDivElement | null>(null);
  const flowUploadInputRef = useRef<HTMLInputElement | null>(null);
  const suppressCanvasClickRef = useRef(false);
  const sectionFetchKeyRef = useRef<string | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(workspace.session);
  const [bot, setBot] = useState<StudioBotApiItem | null>(workspace.bot);
  const [talkTemplates, setTalkTemplates] = useState<StudioTalkTemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("properties");
  const [graph, setGraph] = useState<DialogFlowGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [multiSelectedNodeIds, setMultiSelectedNodeIds] = useState<string[]>([]);
  const [multiSelectedLinkIds, setMultiSelectedLinkIds] = useState<string[]>([]);
  const [copiedFlowNodes, setCopiedFlowNodes] = useState<CopiedFlowNode[]>([]);
  const lastGraphDialogIdRef = useRef<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draggingNode, setDraggingNode] = useState<DraggingNodeState | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBoxState | null>(null);
  const [canvasSearchKeyword, setCanvasSearchKeyword] = useState("");
  const [linkingState, setLinkingState] = useState<LinkingState | null>(null);
  const [linkDragState, setLinkDragState] = useState<LinkDragState | null>(null);
  const [selectedLinkHandle, setSelectedLinkHandle] = useState<SelectedLinkHandle | null>(null);
  const [variableColumnDrafts, setVariableColumnDrafts] = useState<Record<string, string>>({});
  const [jumpCardPickerOpen, setJumpCardPickerOpen] = useState(false);
  const [jumpCardSearchKeyword, setJumpCardSearchKeyword] = useState("");
  const [jumpDialogPickerOpen, setJumpDialogPickerOpen] = useState(false);
  const [jumpDialogSearchKeyword, setJumpDialogSearchKeyword] = useState("");
  const [variableSortOrder, setVariableSortOrder] = useState<"default" | "asc" | "desc">("default");
  const [variablePanelPages, setVariablePanelPages] = useState<Record<string, number>>({});
  const [functionPicker, setFunctionPicker] = useState<FunctionPickerState | null>(null);
  const [scriptEditorOpen, setScriptEditorOpen] = useState(false);
  const [scriptCodeDraft, setScriptCodeDraft] = useState("");
  const [scriptEditorError, setScriptEditorError] = useState("");
  const [adaptiveCardDesignerOpen, setAdaptiveCardDesignerOpen] = useState(false);
  const [adaptiveCardDesignerReady, setAdaptiveCardDesignerReady] = useState(false);
  const [adaptiveCardDesignerOutput, setAdaptiveCardDesignerOutput] =
    useState<AdaptiveCardDesignerOutput | null>(null);
  const [adaptiveCardDesignerStatus, setAdaptiveCardDesignerStatus] = useState("");
  const [canvasScalePercent, setCanvasScalePercent] = useState(100);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [talkTemplateSettingsOpen, setTalkTemplateSettingsOpen] = useState(false);
  const [entityExtractionDialogOpen, setEntityExtractionDialogOpen] = useState(false);
  const [entityExtractionPickerOpen, setEntityExtractionPickerOpen] = useState(false);
  const [entityExtractionSearchKeyword, setEntityExtractionSearchKeyword] = useState("");
  const [flowMenuOpen, setFlowMenuOpen] = useState(false);
  const [flowHelpOpen, setFlowHelpOpen] = useState(false);
  const canvasScale = canvasScalePercent / 100;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.customElements.get("daon-adaptive-card-designer")) {
      setAdaptiveCardDesignerReady(true);
    }
  }, []);

  useEffect(() => {
    const host = adaptiveCardDesignerHostRef.current;
    if (!adaptiveCardDesignerOpen || !host) {
      return;
    }

    host.innerHTML = "";

    if (typeof window === "undefined" || !window.customElements.get("daon-adaptive-card-designer")) {
      host.textContent = "Adaptive Card 디자이너를 불러오는 중입니다.";
      return;
    }

    const designer = document.createElement("daon-adaptive-card-designer");
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<AdaptiveCardDesignerOutput>).detail;
      setAdaptiveCardDesignerOutput(detail);
      setAdaptiveCardDesignerStatus("");
    };

    designer.addEventListener("daon-designer-change", handleChange);
    host.appendChild(designer);

    return () => {
      designer.removeEventListener("daon-designer-change", handleChange);
      host.innerHTML = "";
    };
  }, [adaptiveCardDesignerOpen, adaptiveCardDesignerReady]);

  useEffect(() => {
    setAuthSession(workspace.session);
    setBot(workspace.bot);
    setLoading(false);
    setErrorMessage("");
  }, [workspace.bot, workspace.session]);

  useEffect(() => {
    if (!authSession || !bot?.id || !bot.active_version?.id || !dialogId) {
      return;
    }

    const version = bot.active_version;
    const loadedDocument = version.version_json;
    const hasSectionDocument = Boolean(
      loadedDocument &&
      Array.isArray(loadedDocument.dialogs) &&
      Array.isArray(loadedDocument.dialog_flow_graphs) &&
      Array.isArray(loadedDocument.entities) &&
      Array.isArray(loadedDocument.apis) &&
      loadedDocument.system_config,
    );
    const fetchKey = `${bot.id}:${version.id}:${dialogId}`;
    if (sectionFetchKeyRef.current === fetchKey && hasSectionDocument) {
      return;
    }

    sectionFetchKeyRef.current = fetchKey;
    let ignore = false;
    setLoading(true);
    setErrorMessage("");

    fetchStudioBotVersionDialogFlow(authSession.access_token, bot.id, version.id, dialogId)
      .then((response) => {
        if (ignore) {
          return;
        }

        const currentDocument = normalizeVersionDocument(bot.active_version?.version_json);
        const nextDocument = {
          ...currentDocument,
          dialogs: normalizeVersionDialogs(response.dialogs),
          dialog_flow_graphs: response.dialog_flow_graphs,
          entities: normalizeVersionEntities(response.entities),
          apis: response.apis,
          system_config: response.system_config,
        };
        const nextVersion = {
          ...response.version,
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
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : copy.loadFailed);
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
  }, [authSession, bot, dialogId]);

  useEffect(() => {
    if (pathname && bot && !errorMessage) {
      saveLastBotScreen(pathname);
    }
  }, [pathname, bot, errorMessage]);

  useEffect(() => {
    if (!authSession) {
      setTalkTemplates([]);
      return;
    }

    let ignore = false;
    fetchStudioTalkTemplates(authSession.access_token)
      .then((response) => {
        if (!ignore) {
          setTalkTemplates(response.items);
        }
      })
      .catch(() => {
        if (!ignore) {
          setTalkTemplates([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, [authSession]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!entityExtractionPickerOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!entityExtractionPickerRef.current?.contains(event.target as Node)) {
        setEntityExtractionPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [entityExtractionPickerOpen]);

  useEffect(() => {
    if (!flowMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!flowMenuRef.current?.contains(event.target as Node)) {
        setFlowMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [flowMenuOpen]);

  const dialogs = useMemo(() => getBotDialogs(bot), [bot]);
  const dialog = useMemo(
    () => dialogs.find((item) => item.id === dialogId) ?? null,
    [dialogs, dialogId],
  );
  const handleLockCancel = useCallback(() => {
    router.push(`/studio/bots/${botId}/versions/${versionId}/intents`);
  }, [botId, router, versionId]);
  const editLock = useEditLock({
    token: authSession?.access_token,
    botId: bot?.id,
    versionId: bot?.active_version?.id,
    dialogId,
    area: "flow",
    enabled: Boolean(dialog),
    onCancel: handleLockCancel,
  });
  const isViewOnly = editLock.viewOnly;
  const versionDocument = useMemo(
    () => normalizeVersionDocument(bot?.active_version?.version_json),
    [bot?.active_version?.version_json],
  );
  const apiAssets = useMemo(() => normalizeApiAssets(versionDocument.apis), [versionDocument.apis]);
  const versionSettings = useMemo(
    () => getBotVersionSettings(bot ?? {}),
    [bot],
  );
  const botMode = bot?.data_json?.bot_mode === "voice" ? "voice" : "text";
  const talkTemplateChannelOptions = useMemo(
    () => buildTalkTemplateChannelOptions(talkTemplates),
    [talkTemplates],
  );
  const registeredTalkMessageTypeOptions = useMemo(
    () =>
      Array.from(
        new Map<string, TalkMessageTypeOption>(
          talkTemplates
            .filter(isActiveTalkTemplate)
            .filter((template) => isTalkMessageTypeAvailableForBotMode(template.renderer_type, botMode))
            .map((template) => {
              const normalizedType = normalizeTalkMessageType(template.renderer_type);
              const base = getTalkMessageTypeMeta(normalizedType);
              return [
                normalizedType,
                {
                  ...base,
                  value: normalizedType,
                  label: template.name,
                },
              ];
            }),
        ).values(),
      ),
    [botMode, talkTemplates],
  );
  const scriptEditorLineNumbers = useMemo(
    () =>
      Array.from(
        { length: Math.max(1, scriptCodeDraft.split(/\r\n|\r|\n/).length) },
        (_, index) => index + 1,
      ),
    [scriptCodeDraft],
  );

  useEffect(() => {
    if (!dialog) {
      setGraph(null);
      setSelectedNodeId(null);
      lastGraphDialogIdRef.current = null;
      return;
    }

    const nextGraph = getDialogFlowGraph(versionDocument, dialog);
    const dialogChanged = lastGraphDialogIdRef.current !== dialog.id;
    lastGraphDialogIdRef.current = dialog.id;
    setGraph(nextGraph);
    setSelectedNodeId((current) => {
      if (!dialogChanged && current && nextGraph.nodes.some((node) => node.id === current)) {
        return current;
      }

      return nextGraph.nodes[1]?.id ?? nextGraph.nodes[0]?.id ?? null;
    });
    setCanvasSearchKeyword("");
    setLinkingState(null);
    setLinkDragState(null);
    setSelectedLinkId(null);
    setSelectedLinkHandle(null);
    setMultiSelectedNodeIds([]);
    setMultiSelectedLinkIds([]);
    setCopiedFlowNodes([]);
    setHasUnsavedChanges(false);
  }, [dialog, versionDocument]);

  useEffect(() => {
    if (!draggingNode || isViewOnly) {
      return;
    }

    const activeDraggingNode = draggingNode;

    function handleMouseMove(event: MouseEvent) {
      if (!canvasViewportRef.current) {
        return;
      }

      const pointer = getCanvasPointerPosition(
        canvasViewportRef.current,
        event.clientX,
        event.clientY,
        canvasScale,
      );
      if (!pointer) {
        return;
      }

      const delta = {
        x: pointer.x - activeDraggingNode.startPointer.x,
        y: pointer.y - activeDraggingNode.startPointer.y,
      };
      const draggedNodeIdSet = new Set(activeDraggingNode.nodeIds);
      const draggedLinkIdSet = new Set(activeDraggingNode.linkIds);

      setGraph((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          nodes: current.nodes.map((node) =>
            draggedNodeIdSet.has(node.id)
              ? {
                  ...node,
                  position: clampPosition({
                    x: (activeDraggingNode.startNodePositions[node.id]?.x ?? node.position.x) + delta.x,
                    y: (activeDraggingNode.startNodePositions[node.id]?.y ?? node.position.y) + delta.y,
                  }),
                }
              : node,
          ),
          links: current.links.map((link) =>
            draggedLinkIdSet.has(link.id)
              ? {
                  ...link,
                  waypoints: (activeDraggingNode.startLinkWaypoints[link.id] ?? link.waypoints).map((point) => ({
                    x: point.x + delta.x,
                    y: point.y + delta.y,
                  })),
                }
              : link,
          ),
        };
      });
      setHasUnsavedChanges(true);
    }

    function handleMouseUp() {
      setDraggingNode(null);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [canvasScale, draggingNode, isViewOnly]);

  useEffect(() => {
    if (!selectionBox || !graph) {
      return;
    }

    const activeGraph = graph;
    const activeSelectionBox = selectionBox;

    function handleMouseMove(event: MouseEvent) {
      const pointer = getCanvasPointerPosition(
        canvasViewportRef.current,
        event.clientX,
        event.clientY,
        canvasScale,
      );
      if (!pointer) {
        return;
      }

      setSelectionBox((current) => (current ? { ...current, current: pointer } : current));
    }

    function handleMouseUp() {
      const selectionRect = getRectFromPoints(activeSelectionBox.start, activeSelectionBox.current);
      const selectedNodeIds = activeGraph.nodes
        .filter((node) => !isSystemFlowNode(node) && isNodeInsideRect(node, selectionRect))
        .map((node) => node.id);
      const selectedNodeIdSet = new Set(selectedNodeIds);
      const selectedLinkIds = activeGraph.links
        .filter((link) => {
          if (selectedNodeIdSet.has(link.sourceNodeId) && selectedNodeIdSet.has(link.targetNodeId)) {
            return true;
          }

          const source = getNodeSourceAnchor(activeGraph, link);
          const target = getNodeTargetAnchor(activeGraph, link);
          if (!source || !target) {
            return false;
          }

          const points = buildLinkPoints(source, target, link.waypoints);
          return points.some((point) => isPointInsideRect(point, selectionRect)) ||
            points.some((point, index) =>
              index > 0 ? isSegmentRectOverlapping(points[index - 1], point, selectionRect) : false,
            );
        })
        .map((link) => link.id);

      setMultiSelectedNodeIds(selectedNodeIds);
      setMultiSelectedLinkIds(selectedLinkIds);
      setSelectedNodeId(selectedNodeIds[0] ?? null);
      setSelectedLinkId(selectedNodeIds.length === 0 ? selectedLinkIds[0] ?? null : null);
      setSelectedLinkHandle(null);
      setSelectionBox(null);
      suppressCanvasClickRef.current = true;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [canvasScale, graph, selectionBox]);

  useEffect(() => {
    if (!graph || !selectedLinkId) {
      return;
    }

    if (!graph.links.some((link) => link.id === selectedLinkId)) {
      setSelectedLinkId(null);
      setSelectedLinkHandle(null);
    }
  }, [graph, selectedLinkId]);

  useEffect(() => {
    if (!linkDragState || !graph || isViewOnly) {
      return;
    }

    const activeLinkDragState = linkDragState;
    const activeGraph = graph;

    function handleMouseMove(event: MouseEvent) {
      const pointer = getCanvasPointerPosition(
        canvasViewportRef.current,
        event.clientX,
        event.clientY,
        canvasScale,
      );
      if (!pointer) {
        return;
      }

      const hoveredTargetNodeId = resolveHoveredTargetNodeId(
        activeGraph,
        event.clientX,
        event.clientY,
        [activeLinkDragState.sourceNodeId],
      );
      setLinkDragState((current) =>
        current
          ? {
              ...current,
              pointer,
              hoveredTargetNodeId,
            }
          : current,
      );
    }

    function handleMouseUp(event: MouseEvent) {
      const hoveredTargetNodeId = resolveHoveredTargetNodeId(
        activeGraph,
        event.clientX,
        event.clientY,
        [activeLinkDragState.sourceNodeId],
      ) ?? activeLinkDragState.hoveredTargetNodeId;
      if (hoveredTargetNodeId) {
        handleDefaultLinkChange(
          activeLinkDragState.sourceNodeId,
          activeLinkDragState.sourcePort,
          hoveredTargetNodeId,
        );
        setSelectedNodeId(hoveredTargetNodeId);
        setInspectorTab("properties");
        setMessage(
          activeLinkDragState.sourcePort === "exception"
            ? "예외 연결이 반영되었습니다."
            : "카드 연결이 반영되었습니다.",
        );
        setErrorMessage("");
      } else {
        setMessage("");
      }

      setLinkDragState(null);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [canvasScale, graph, isViewOnly, linkDragState]);

  useEffect(() => {
    if (!selectedLinkHandle || !graph || isViewOnly) {
      return;
    }

    const activeHandle = selectedLinkHandle;
    const activeGraph = graph;

    function handleMouseMove(event: MouseEvent) {
      const pointer = getCanvasPointerPosition(
        canvasViewportRef.current,
        event.clientX,
        event.clientY,
        canvasScale,
      );
      if (!pointer) {
        return;
      }

      if (activeHandle.mode === "waypoint") {
        applyGraphMutation((current) =>
          updateLinkInGraph(current, activeHandle.linkId, (link) => ({
            ...link,
            waypoints: link.waypoints.map((item, index) =>
              index === activeHandle.waypointIndex ? pointer : item,
            ),
          })),
        );
        setSelectedLinkHandle((current) =>
          current && current.mode === "waypoint"
            ? {
                ...current,
                hasMoved:
                  current.hasMoved ||
                  (current.startPointer
                    ? getPointDistance(current.startPointer, pointer) > 4
                    : true),
              }
            : current,
        );
        return;
      }

      const activeLink = activeGraph.links.find((link) => link.id === activeHandle.linkId);
      if (!activeLink) {
        return;
      }

      const hoveredTargetNodeId = resolveHoveredTargetNodeId(
        activeGraph,
        event.clientX,
        event.clientY,
        activeHandle.mode === "target"
          ? [activeLink.sourceNodeId]
          : [activeLink.targetNodeId],
      ) ?? activeHandle.hoveredTargetNodeId;
      setSelectedLinkHandle((current) =>
        current && current.mode !== "waypoint"
          ? {
              ...current,
              pointer,
              hoveredTargetNodeId,
            }
          : current,
      );
    }

    function handleMouseUp(event: MouseEvent) {
      if (activeHandle.mode === "waypoint") {
        if (activeHandle.isNew && !activeHandle.hasMoved) {
          applyGraphMutation((current) =>
            updateLinkInGraph(current, activeHandle.linkId, (link) => ({
              ...link,
              waypoints: link.waypoints.filter((_, index) => index !== activeHandle.waypointIndex),
            })),
          );
        }
        setSelectedLinkHandle(null);
        return;
      }

      const activeLink = activeGraph.links.find((link) => link.id === activeHandle.linkId);
      if (!activeLink) {
        setSelectedLinkHandle(null);
        return;
      }

      const hoveredTargetNodeId = resolveHoveredTargetNodeId(
        activeGraph,
        event.clientX,
        event.clientY,
        activeHandle.mode === "target"
          ? [activeLink.sourceNodeId]
          : [activeLink.targetNodeId],
      );

      if (hoveredTargetNodeId) {
        applyGraphMutation((current) => {
          const link = current.links.find((item) => item.id === activeHandle.linkId);
          if (!link) {
            return current;
          }

          if (activeHandle.mode === "target") {
            const previousTargetAnchor = getNodeTargetAnchor(current, link);
            const nextLink = {
              ...link,
              targetNodeId: hoveredTargetNodeId,
            };
            const nextTargetAnchor = getNodeTargetAnchor(current, nextLink);
            return removeUnlinkedConditionBranches(
              updateLinkInGraph(current, activeHandle.linkId, (item) => ({
                ...item,
                targetNodeId: hoveredTargetNodeId,
                waypoints: preserveLinkWaypointShape(
                  item.waypoints,
                  "target",
                  previousTargetAnchor,
                  nextTargetAnchor,
                ),
              })),
            );
          }

          const nextSourceNode = getNodeById(current, hoveredTargetNodeId);
          const nextSourcePort = nextSourceNode
            ? activeLink.sourcePort === "exception" && supportsExceptionHandling(nextSourceNode.kind)
              ? "exception"
              : getPreferredSourcePort(nextSourceNode, current)
            : null;
          if (!nextSourceNode || !nextSourcePort) {
            return current;
          }

          const previousSourceAnchor = getNodeSourceAnchor(current, link);
          const nextLink = {
            ...link,
            sourceNodeId: nextSourceNode.id,
            sourcePort: nextSourcePort,
            kind:
              nextSourcePort.startsWith("branch:")
                ? "condition" as const
                : "default" as const,
          };
          const nextSourceAnchor = getNodeSourceAnchor(current, nextLink);

          return removeUnlinkedConditionBranches(
            updateLinkInGraph(current, activeHandle.linkId, (item) => ({
              ...item,
              sourceNodeId: nextSourceNode.id,
              sourcePort: nextSourcePort,
              kind:
                nextSourcePort.startsWith("branch:")
                  ? "condition"
                  : "default",
              waypoints: preserveLinkWaypointShape(
                item.waypoints,
                "source",
                previousSourceAnchor,
                nextSourceAnchor,
              ),
            })),
          );
        });
      }

      setSelectedLinkHandle(null);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [canvasScale, graph, isViewOnly, selectedLinkHandle]);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      const tagName = target.tagName;
      return (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target.isContentEditable
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      const isCopyKey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c";
      const isPasteKey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v";
      const isSaveKey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
      const isDownloadKey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d";
      const isUploadKey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "u";
      const isNavigateToStartKey =
        (event.ctrlKey || event.metaKey) &&
        (event.key === "<" || (event.shiftKey && event.key === ","));

      if (isSaveKey) {
        event.preventDefault();
        void handleSave();
        return;
      }

      if (isNavigateToStartKey) {
        event.preventDefault();
        handleNavigateToStart();
        return;
      }

      if (isViewOnly) {
        return;
      }

      if (isDownloadKey) {
        event.preventDefault();
        handleDownloadFlowDesign();
        return;
      }

      if (isUploadKey) {
        event.preventDefault();
        flowUploadInputRef.current?.click();
        return;
      }

      if (isCopyKey || isPasteKey) {
        if (isEditableTarget(event.target)) {
          return;
        }

        if (isCopyKey) {
          if (!graph) {
            return;
          }

          const selectedNodeIdSet = new Set([
            ...multiSelectedNodeIds,
            ...(selectedNodeId ? [selectedNodeId] : []),
          ]);
          const nodesToCopy = graph.nodes.filter(
            (node): node is CopiedFlowNode =>
              selectedNodeIdSet.has(node.id) &&
              node.kind !== "start" &&
              node.kind !== "system-variable",
          );
          if (nodesToCopy.length === 0) {
            return;
          }

          event.preventDefault();
          setCopiedFlowNodes(nodesToCopy.map((node) => cloneFlowConfig(node)));
          setMessage("");
          setErrorMessage("");
          return;
        }

        if (copiedFlowNodes.length === 0) {
          return;
        }

        event.preventDefault();
        const offset = 48;
        const pastedNodes = copiedFlowNodes.map((node) =>
          cloneCopiedFlowNode(
            node,
            clampPosition({
              x: node.position.x + offset,
              y: node.position.y + offset,
            }),
          ),
        );

        applyGraphUpdate((current) => ({
          ...current,
          nodes: [...current.nodes, ...pastedNodes],
        }));
        setCopiedFlowNodes(pastedNodes.map((node) => cloneFlowConfig(node)));
        setSelectedNodeId(pastedNodes[0]?.id ?? null);
        setSelectedLinkId(null);
        setSelectedLinkHandle(null);
        setMultiSelectedNodeIds(pastedNodes.map((node) => node.id));
        setMultiSelectedLinkIds([]);
        setLinkingState(null);
        setLinkDragState(null);
        setMessage("");
        setErrorMessage("");
        return;
      }

      const arrowMoveMap: Partial<Record<string, DialogFlowPosition>> = {
        ArrowUp: { x: 0, y: -16 },
        ArrowDown: { x: 0, y: 16 },
        ArrowLeft: { x: -16, y: 0 },
        ArrowRight: { x: 16, y: 0 },
      };
      const arrowMove = arrowMoveMap[event.key];
      if (arrowMove) {
        if (isEditableTarget(event.target)) {
          return;
        }

        const activeNodeIds = new Set([
          ...multiSelectedNodeIds,
          ...(selectedNodeId ? [selectedNodeId] : []),
        ]);
        const movableNodeIds = new Set(
          (graph?.nodes ?? [])
            .filter((node) => activeNodeIds.has(node.id) && !isSystemFlowNode(node))
            .map((node) => node.id),
        );
        if (movableNodeIds.size === 0) {
          return;
        }

        event.preventDefault();
        applyGraphUpdate((current) => ({
          ...current,
          nodes: current.nodes.map((node) =>
            movableNodeIds.has(node.id)
              ? {
                  ...node,
                  position: clampPosition({
                    x: node.position.x + arrowMove.x,
                    y: node.position.y + arrowMove.y,
                  }),
                }
              : node,
          ),
        }));
        return;
      }

      if (event.key !== "Delete") {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (multiSelectedNodeIds.length > 0 || multiSelectedLinkIds.length > 0) {
        event.preventDefault();
        const deletableNodeIds = new Set(
          (graph?.nodes ?? [])
            .filter((node) => multiSelectedNodeIds.includes(node.id) && node.kind !== "start")
            .map((node) => node.id),
        );
        const selectedLinkIdSet = new Set(multiSelectedLinkIds);

        applyGraphUpdate((current) => {
          const nextGraph = Array.from(deletableNodeIds).reduce(
            (next, nodeId) => removeFlowNode(next, nodeId),
            current,
          );
          return removeUnlinkedConditionBranches({
            ...nextGraph,
            links: nextGraph.links.filter((link) => !selectedLinkIdSet.has(link.id)),
          });
        });
        setSelectedNodeId(null);
        setSelectedLinkId(null);
        setSelectedLinkHandle(null);
        setMultiSelectedNodeIds([]);
        setMultiSelectedLinkIds([]);
        return;
      }

      if (selectedLinkHandle?.mode === "waypoint") {
        event.preventDefault();
        applyGraphUpdate((current) =>
          updateLinkInGraph(current, selectedLinkHandle.linkId, (link) => ({
            ...link,
            waypoints: link.waypoints.filter((_, index) => index !== selectedLinkHandle.waypointIndex),
          })),
        );
        setSelectedLinkHandle(null);
        return;
      }

      if (selectedLinkId) {
        event.preventDefault();
        applyGraphUpdate((current) =>
          removeUnlinkedConditionBranches({
            ...current,
            links: current.links.filter((link) => link.id !== selectedLinkId),
          }),
        );
        setSelectedLinkId(null);
        setSelectedLinkHandle(null);
        return;
      }

      const activeSelectedNode =
        graph && selectedNodeId ? getNodeById(graph, selectedNodeId) : null;
      if (!activeSelectedNode || activeSelectedNode.kind === "start") {
        return;
      }

      event.preventDefault();
      handleDeleteSelectedNode();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    copiedFlowNodes,
    graph,
    isViewOnly,
    multiSelectedLinkIds,
    multiSelectedNodeIds,
    saving,
    selectedLinkHandle,
    selectedLinkId,
    selectedNodeId,
  ]);

  const selectedNode = useMemo(
    () => (graph && selectedNodeId ? getNodeById(graph, selectedNodeId) : null),
    [graph, selectedNodeId],
  );
  const nodeDesignIssues = useMemo(() => {
    const issues = new Map<string, string[]>();
    if (!graph || !dialog) {
      return issues;
    }

    const addIssue = (nodeId: string, message: string) => {
      issues.set(nodeId, [...(issues.get(nodeId) ?? []), message]);
    };
    const entityBindingNames = dialog.entityBindings.map((binding) => binding.variableName);
    const usedVariableNames = new Set(
      entityBindingNames.map((item) => stripVariablePrefix(item).toLowerCase()),
    );
    const knownVariableNames = new Set(SYSTEM_FLOW_VARIABLE_NAMES.map((item) => item.toLowerCase()));
    const addKnownVariableName = (value: string) => {
      const root = getVariableReferenceRoot(value);
      if (root) {
        knownVariableNames.add(root.toLowerCase());
      }
    };
    const addMissingVariableReferenceIssue = (nodeId: string, value: string) => {
      const root = getVariableReferenceRoot(value);
      if (root && !knownVariableNames.has(root.toLowerCase())) {
        addIssue(nodeId, `정의되지 않은 변수 '$${root}'를 사용하고 있습니다.`);
      }
    };
    const addMissingVariableReferencesFromText = (nodeId: string, value: string) => {
      for (const variableName of collectTemplateVariableNamesFromText(value)) {
        addMissingVariableReferenceIssue(nodeId, variableName);
      }
    };

    dialog.entityBindings.forEach((binding) => addKnownVariableName(binding.variableName));
    for (const node of graph.nodes) {
      if (node.kind === "talk") {
        addKnownVariableName(node.config.responseVariableName);
        node.config.responseEntityExtractions.forEach((item) => addKnownVariableName(item.variableName));
      }
      if (node.kind === "variable") {
        node.config.items.forEach((item) => addKnownVariableName(item.variableName));
      }
      if (node.kind === "script") {
        node.config.returnVariables.forEach((item) => addKnownVariableName(item.variableName));
      }
      if (node.kind === "function") {
        if (node.config.outputMappings.length > 0) {
          node.config.outputMappings.forEach((item) => addKnownVariableName(item.variableName));
        } else {
          addKnownVariableName(node.config.resultVariableName || "apiResult");
        }
      }
    }

    for (const node of graph.nodes) {
      if (node.kind === "talk") {
        const templateRequiredError = getTalkTemplateRequiredError(node);
        if (templateRequiredError) {
          addIssue(node.id, templateRequiredError);
        }
        node.config.basicMessages.forEach((item) => addMissingVariableReferencesFromText(node.id, item));
        node.config.messages.forEach((item) => addMissingVariableReferencesFromText(node.id, item));
        node.config.tableColumnMappings.forEach((mapping) => addMissingVariableReferencesFromText(node.id, mapping.value));
        node.config.tableManualRows.forEach((row) => {
          addMissingVariableReferencesFromText(node.id, row.key);
          row.values.forEach((value) => addMissingVariableReferencesFromText(node.id, value));
        });
        node.config.linkButtonItems.forEach((item) => {
          addMissingVariableReferencesFromText(node.id, item.label);
          addMissingVariableReferencesFromText(node.id, item.url);
        });
        Object.values(node.config.channelTemplates).forEach((template) => {
          template.messages.forEach((item) => addMissingVariableReferencesFromText(node.id, item));
          template.tableColumnMappings.forEach((mapping) => addMissingVariableReferencesFromText(node.id, mapping.value));
          template.tableManualRows.forEach((row) => {
            addMissingVariableReferencesFromText(node.id, row.key);
            row.values.forEach((value) => addMissingVariableReferencesFromText(node.id, value));
          });
          template.linkButtonItems.forEach((item) => {
            addMissingVariableReferencesFromText(node.id, item.label);
            addMissingVariableReferencesFromText(node.id, item.url);
          });
        });

        if (node.config.responseType === "extract-entity" && node.config.responseEntityBindingIds.length === 0) {
          addIssue(node.id, "추출할 개체를 선택해주세요.");
        }

        if (node.config.responseType === "extract-entity") {
          for (const extraction of node.config.responseEntityExtractions) {
            const validationError = validateVariableName(extraction.variableName, entityBindingNames);
            if (validationError) {
              addIssue(node.id, validationError);
            }
          }
        }

        if (
          node.config.responseType === "relay" ||
          node.config.responseType === "single-select" ||
          node.config.responseType === "form-relay"
        ) {
          const validationError = validateVariableName(node.config.responseVariableName, entityBindingNames);
          if (validationError) {
            addIssue(node.id, validationError);
          }
        }
      }

      if (node.kind === "jump") {
        if (node.config.targetType === "card" && !node.config.targetCardId) {
          addIssue(node.id, "이동 대상 카드가 없습니다.");
        }
        if (node.config.targetType === "card" && node.config.targetCardId && !getNodeById(graph, node.config.targetCardId)) {
          addIssue(node.id, "삭제된 카드로 이동하도록 설정되어 있습니다.");
        }
        if (node.config.targetType === "dialog" && !node.config.targetDialogId) {
          addIssue(node.id, "이동 대상 의도/모듈이 없습니다.");
        }
        if (node.config.targetType === "dialog" && !getFlowLinkTargetId(graph, node.id, "next")) {
          addIssue(node.id, "다음 카드가 연결되어 있지 않습니다.");
        }
      }

      if (node.kind === "condition") {
        if (!stripVariablePrefix(node.config.variableName)) {
          addIssue(node.id, "조건 판단 변수가 없습니다.");
        } else {
          addMissingVariableReferenceIssue(node.id, node.config.variableName);
        }
        const linkedBranches = node.config.branches.filter((branch) =>
          getFlowLinkTargetId(graph, node.id, `branch:${branch.id}`),
        );
        if (!linkedBranches.some((branch) => branch.operator === "else")) {
          addIssue(node.id, "'그 외의 경우' 분기가 없습니다.");
        }
        for (const branch of node.config.branches) {
          const optionMeta = getConditionOptionMeta(branch.operator);
          const targetNodeId = getFlowLinkTargetId(graph, node.id, `branch:${branch.id}`);
          if (optionMeta.requiresValue && targetNodeId && !branch.compareValue.trim()) {
            addIssue(node.id, `${branch.label} 비교값이 없습니다.`);
          }
          addMissingVariableReferencesFromText(node.id, branch.compareValue);
          if (targetNodeId && !getNodeById(graph, targetNodeId)) {
            addIssue(node.id, `${branch.label} 분기가 삭제된 카드로 연결되어 있습니다.`);
          }
        }
      }

      if (node.kind === "variable") {
        if (!getFlowLinkTargetId(graph, node.id, "next")) {
          addIssue(node.id, "다음 카드가 연결되어 있지 않습니다.");
        }
        for (const item of node.config.items) {
          const validationError = validateVariableName(item.variableName, entityBindingNames);
          if (validationError) {
            addIssue(node.id, validationError);
          }
          addMissingVariableReferencesFromText(node.id, item.value);

          const normalizedName = stripVariablePrefix(item.variableName).toLowerCase();
          if (usedVariableNames.has(normalizedName)) {
            addIssue(node.id, "중복된 변수명이 있습니다.");
          } else {
            usedVariableNames.add(normalizedName);
          }
        }
      }

      if (node.kind === "function") {
        if (!node.config.apiId || !node.config.methodId) {
          addIssue(node.id, "API와 Method를 선택해주세요.");
        }
        node.config.parameterMappings.forEach((mapping) => addMissingVariableReferencesFromText(node.id, mapping.value));
        if (!getFlowLinkTargetId(graph, node.id, "next") && !getFlowLinkTargetId(graph, node.id, "exception")) {
          addIssue(node.id, "실행 이후 이동할 카드가 없습니다.");
        }
      }

      if (node.kind === "end") {
        addMissingVariableReferencesFromText(node.id, node.config.message);
      }
    }

    return issues;
  }, [dialog, graph]);
  const selectedLink = useMemo(
    () => (graph && selectedLinkId ? graph.links.find((link) => link.id === selectedLinkId) ?? null : null),
    [graph, selectedLinkId],
  );
  const visibleConditionBranches = useMemo(() => {
    if (!graph || !selectedNode || selectedNode.kind !== "condition") {
      return [];
    }

    return selectedNode.config.branches.filter((branch) =>
      Boolean(getFlowLinkTargetId(graph, selectedNode.id, `branch:${branch.id}`)),
    );
  }, [graph, selectedNode]);

  useEffect(() => {
    if (!selectedNode || selectedNode.kind !== "jump" || selectedNode.config.targetType !== "dialog") {
      setJumpDialogPickerOpen(false);
      setJumpDialogSearchKeyword("");
    }

    if (!selectedNode || selectedNode.kind !== "jump" || selectedNode.config.targetType !== "card") {
      setJumpCardPickerOpen(false);
      setJumpCardSearchKeyword("");
    }
  }, [selectedNode]);

  const matchingNodeIds = useMemo(() => {
    if (!graph) {
      return new Set<string>();
    }

    const keyword = canvasSearchKeyword.trim().toLowerCase();
    if (!keyword) {
      return new Set<string>();
    }

    return new Set(
      graph.nodes
        .filter((node) => {
          const summary = dialog ? buildNodeSummary(node, dialog) : "";
          return (
            node.title.toLowerCase().includes(keyword) ||
            FLOW_CARD_LABELS[node.kind].toLowerCase().includes(keyword) ||
            summary.toLowerCase().includes(keyword)
          );
        })
        .map((node) => node.id),
    );
  }, [canvasSearchKeyword, dialog, graph]);

  const connectableNodes = useMemo(
    () =>
      graph?.nodes.filter((node) => node.id !== selectedNodeId && !isSystemFlowNode(node)) ?? [],
    [graph, selectedNodeId],
  );
  const selectedFunctionApi = useMemo(() => {
    if (!selectedNode || selectedNode.kind !== "function") {
      return null;
    }
    return apiAssets.find((api) => api.id === selectedNode.config.apiId) ?? null;
  }, [apiAssets, selectedNode]);
  const selectedFunctionMethod = useMemo(() => {
    if (!selectedNode || selectedNode.kind !== "function" || !selectedFunctionApi) {
      return null;
    }
    return selectedFunctionApi.methods.find((method) => method.id === selectedNode.config.methodId) ?? null;
  }, [selectedFunctionApi, selectedNode]);
  const functionPickerApi = useMemo(() => {
    if (!functionPicker) {
      return null;
    }
    return apiAssets.find((api) => api.id === functionPicker.apiId) ?? null;
  }, [apiAssets, functionPicker]);
  const functionPickerMethod = useMemo(() => {
    if (!functionPicker || !functionPickerApi) {
      return null;
    }
    return functionPickerApi.methods.find((method) => method.id === functionPicker.methodId) ?? null;
  }, [functionPicker, functionPickerApi]);
  const functionPickerOutputRows = useMemo(() => {
    if (!functionPicker || !functionPickerMethod) {
      return [];
    }

    return functionPickerMethod.outputParameters.length > 0
      ? getFunctionOutputRows(functionPickerMethod)
      : functionPicker.testOutputRows.length > 0
        ? functionPicker.testOutputRows
        : getFunctionOutputRows(functionPickerMethod);
  }, [functionPicker, functionPickerMethod]);
  const filteredJumpTargetCardOptions = useMemo(() => {
    const keyword = jumpCardSearchKeyword.trim().toLowerCase();
    if (!keyword) {
      return connectableNodes;
    }

    return connectableNodes.filter((node) => {
      const summary = dialog ? buildNodeSummary(node, dialog) : "";
      return (
        node.title.toLowerCase().includes(keyword) ||
        FLOW_CARD_LABELS[node.kind].toLowerCase().includes(keyword) ||
        summary.toLowerCase().includes(keyword)
      );
    });
  }, [connectableNodes, dialog, jumpCardSearchKeyword]);
  const jumpTargetDialogOptions = useMemo(
    () => dialogs.filter((item) => item.id !== dialog?.id),
    [dialog?.id, dialogs],
  );
  const filteredJumpTargetDialogOptions = useMemo(() => {
    const keyword = jumpDialogSearchKeyword.trim().toLowerCase();
    if (!keyword) {
      return jumpTargetDialogOptions;
    }

    return jumpTargetDialogOptions.filter((item) => {
      const typeLabel = getDialogTypeLabel(item.dialogType).toLowerCase();
      return item.name.toLowerCase().includes(keyword) || typeLabel.includes(keyword);
    });
  }, [jumpDialogSearchKeyword, jumpTargetDialogOptions]);

  const tableVariableOptions = useMemo(() => {
    if (!graph) {
      return [];
    }

    return graph.nodes.flatMap((node) => {
      if (node.kind === "variable") {
        return node.config.items
          .filter((item) => item.tableEnabled && stripVariablePrefix(item.variableName))
          .map((item) => ({
            id: item.id,
            name: formatVariableName(item.variableName) || item.variableName,
            columns: mergeTableColumns(item.tableColumns, item.value),
            source: node.title,
          }));
      }

      if (node.kind === "script") {
        return node.config.returnVariables
          .filter((item) => item.type === "array" && stripVariablePrefix(item.variableName))
          .map((item) => ({
            id: `${node.id}-${item.id}`,
            name: formatVariableName(item.variableName) || item.variableName,
            columns: collectTableColumnsFromScriptArray(node.config.code, item.scriptVariableName),
            source: node.title,
          }));
      }

      return [];
    });
  }, [graph]);
  const sortedSelectedVariableItems = useMemo(() => {
    if (!selectedNode || selectedNode.kind !== "variable") {
      return [];
    }

    const items = [...selectedNode.config.items];
    if (variableSortOrder === "default") {
      return items;
    }

    return items.sort((left, right) => {
      const leftName = stripVariablePrefix(formatVariableName(left.variableName) || left.variableName).toLowerCase();
      const rightName = stripVariablePrefix(formatVariableName(right.variableName) || right.variableName).toLowerCase();
      const comparison = leftName.localeCompare(rightName, "ko");
      return variableSortOrder === "asc" ? comparison : comparison * -1;
    });
  }, [selectedNode, variableSortOrder]);

  const usedVariableNames = useMemo(() => {
    if (!dialog || !graph) {
      return [];
    }

    const names = new Set<string>();
    const addName = (value: string) => {
      const formattedName = formatVariableName(value);
      if (formattedName) {
        names.add(formattedName);
      }
    };
    const addNamesFromText = (value: string) => {
      for (const variableName of collectVariableNamesFromText(value)) {
        addName(variableName);
      }
    };

    dialog.entityBindings.forEach((binding) => addName(binding.variableName));

    graph.nodes.forEach((node) => {
      if (node.kind === "talk") {
        node.config.basicMessages.forEach(addNamesFromText);
        node.config.messages.forEach(addNamesFromText);
        addName(node.config.responseVariableName);
        node.config.responseEntityExtractions.forEach((item) => addName(item.variableName));
        node.config.tableColumnMappings.forEach((mapping) => addNamesFromText(mapping.value));
        node.config.tableManualRows.forEach((row) => {
          addNamesFromText(row.key);
          row.values.forEach(addNamesFromText);
        });
        node.config.linkButtonItems.forEach((item) => {
          addNamesFromText(item.label);
          addNamesFromText(item.url);
        });
        Object.values(node.config.channelTemplates).forEach((template) => {
          template.messages.forEach(addNamesFromText);
          template.tableColumnMappings.forEach((mapping) => addNamesFromText(mapping.value));
          template.tableManualRows.forEach((row) => {
            addNamesFromText(row.key);
            row.values.forEach(addNamesFromText);
          });
          template.linkButtonItems.forEach((item) => {
            addNamesFromText(item.label);
            addNamesFromText(item.url);
          });
        });
        node.config.floatingButtons.forEach((item) => {
          addNamesFromText(item.label);
          addNamesFromText(item.key);
        });
      }

      if (node.kind === "condition") {
        addName(node.config.variableName);
        node.config.branches.forEach((branch) => addNamesFromText(branch.compareValue));
      }

      if (node.kind === "variable") {
        node.config.items.forEach((item) => {
          addName(item.variableName);
          addNamesFromText(item.value);
          item.tableColumns.forEach(addNamesFromText);
        });
      }

      if (node.kind === "script") {
        node.config.parameters.forEach((item) => {
          addNamesFromText(item.name);
          addNamesFromText(item.value);
        });
        node.config.returnVariables.forEach((item) => {
          addName(item.variableName);
          addNamesFromText(item.scriptVariableName);
        });
      }
    });

    return Array.from(names).sort((left, right) => left.localeCompare(right, "ko"));
  }, [dialog, graph]);

  const variableSourceMap = useMemo(() => {
    const sources = new Map<string, Set<string>>();
    const addSource = (value: string, source: string) => {
      const formattedName = formatVariableName(value);
      if (!formattedName) {
        return;
      }

      const current = sources.get(formattedName) ?? new Set<string>();
      current.add(source || "대화 설계");
      sources.set(formattedName, current);
    };
    const addTextSources = (value: string, source: string) => {
      for (const variableName of collectVariableNamesFromText(value)) {
        addSource(variableName, source);
      }
    };

    dialog?.entityBindings.forEach((binding) => addSource(binding.variableName, "대화 시작"));

    graph?.nodes.forEach((node) => {
      const sourceName = node.title || FLOW_CARD_LABELS[node.kind] || "대화 설계";
      if (node.kind === "talk") {
        node.config.basicMessages.forEach((value) => addTextSources(value, sourceName));
        node.config.messages.forEach((value) => addTextSources(value, sourceName));
        addSource(node.config.responseVariableName, sourceName);
        node.config.responseEntityExtractions.forEach((item) => addSource(item.variableName, sourceName));
        node.config.tableColumnMappings.forEach((mapping) => addTextSources(mapping.value, sourceName));
        node.config.tableManualRows.forEach((row) => {
          addTextSources(row.key, sourceName);
          row.values.forEach((value) => addTextSources(value, sourceName));
        });
        node.config.linkButtonItems.forEach((item) => {
          addTextSources(item.label, sourceName);
          addTextSources(item.url, sourceName);
        });
        Object.values(node.config.channelTemplates).forEach((template) => {
          template.messages.forEach((value) => addTextSources(value, sourceName));
          template.tableColumnMappings.forEach((mapping) => addTextSources(mapping.value, sourceName));
          template.tableManualRows.forEach((row) => {
            addTextSources(row.key, sourceName);
            row.values.forEach((value) => addTextSources(value, sourceName));
          });
          template.linkButtonItems.forEach((item) => {
            addTextSources(item.label, sourceName);
            addTextSources(item.url, sourceName);
          });
        });
        node.config.floatingButtons.forEach((item) => {
          addTextSources(item.label, sourceName);
          addTextSources(item.key, sourceName);
        });
      }

      if (node.kind === "condition") {
        addSource(node.config.variableName, sourceName);
        node.config.branches.forEach((branch) => addTextSources(branch.compareValue, sourceName));
      }

      if (node.kind === "variable") {
        node.config.items.forEach((item) => {
          addSource(item.variableName, sourceName);
          addTextSources(item.value, sourceName);
          item.tableColumns.forEach((value) => addTextSources(value, sourceName));
        });
      }

      if (node.kind === "script") {
        node.config.parameters.forEach((item) => {
          addTextSources(item.name, sourceName);
          addTextSources(item.value, sourceName);
        });
        node.config.returnVariables.forEach((item) => {
          addSource(item.variableName, sourceName);
          addTextSources(item.scriptVariableName, sourceName);
        });
      }

      if (node.kind === "function") {
        node.config.parameterMappings.forEach((item) => addTextSources(item.value, sourceName));
        node.config.outputMappings.forEach((item) => addSource(item.variableName, sourceName));
        addSource(node.config.resultVariableName, sourceName);
      }
    });

    return sources;
  }, [dialog, graph]);

  const usedVariableTypeMap = useMemo(() => {
    const types = new Map<string, "string" | "Array">();
    const setType = (name: string, type: "string" | "Array") => {
      const formattedName = formatVariableName(name);
      if (!formattedName) {
        return;
      }

      types.set(formattedName, type === "Array" ? "Array" : (types.get(formattedName) ?? "string"));
    };

    dialog?.entityBindings.forEach((binding) => setType(binding.variableName, "string"));

    graph?.nodes.forEach((node) => {
      if (node.kind === "talk") {
        setType(node.config.responseVariableName, "string");
        node.config.responseEntityExtractions.forEach((item) => setType(item.variableName, "string"));
      }

      if (node.kind === "condition") {
        setType(node.config.variableName, "string");
      }

      if (node.kind === "variable") {
        node.config.items.forEach((item) => {
          setType(
            item.variableName,
            item.tableEnabled || collectTableColumnsFromValue(item.value).length > 0 ? "Array" : "string",
          );
        });
      }

      if (node.kind === "script") {
        node.config.returnVariables.forEach((item) => {
          setType(item.variableName, item.type === "array" ? "Array" : "string");
        });
      }
    });

    return types;
  }, [dialog, graph]);

  const entityExtractionOptions = useMemo<EntityExtractionOption[]>(() => {
    const entityOptions = normalizeVersionEntities(versionDocument.entities).map((entity) => ({
      id: entity.id,
      variableName: entity.name.startsWith("@") ? entity.name : `@${entity.name}`,
      entityId: entity.id,
      entityName: entity.name.startsWith("@") ? entity.name : `@${entity.name}`,
      entityValue: entity.rows.map((row) => row.value).filter(Boolean).join(", "),
      required: false,
      local: false,
      category: entity.system ? "시스템 개체" : "사용자 개체",
    }));

    const optionMap = new Map<string, EntityExtractionOption>();
    entityOptions.forEach((option) => optionMap.set(option.entityId, option));
    dialog?.entityBindings.forEach((binding) => {
      if (!optionMap.has(binding.entityId)) {
        optionMap.set(binding.entityId, {
          id: binding.entityId,
          variableName: formatVariableName(binding.variableName) || `$${binding.variableName}`,
          entityId: binding.entityId,
          entityName: binding.entityName,
          entityValue: binding.entityValue,
          required: binding.required,
          local: binding.local,
          category: "사용자 개체",
        });
      }
    });

    return Array.from(optionMap.values()).sort((left, right) =>
      left.entityName.localeCompare(right.entityName, "ko"),
    );
  }, [dialog, versionDocument.entities]);

  const filteredEntityExtractionOptions = useMemo(() => {
    if (!dialog) {
      return [];
    }

    const keyword = entityExtractionSearchKeyword.trim().toLowerCase();
    if (!keyword) {
      return entityExtractionOptions;
    }

    return entityExtractionOptions.filter((option) =>
      [
        option.variableName,
        option.entityName,
        option.entityValue,
        option.category,
      ]
        .join(" ")
        .toLowerCase()
      .includes(keyword),
    );
  }, [dialog, entityExtractionOptions, entityExtractionSearchKeyword]);

  const selectedEntityExtractionOptions = useMemo(
    () =>
      entityExtractionOptions.filter((option) =>
        selectedNode?.kind === "talk"
          ? selectedNode.config.responseEntityBindingIds.includes(option.id)
          : false,
      ),
    [entityExtractionOptions, selectedNode],
  );
  const selectedEntityExtractionRows = useMemo(() => {
    if (selectedNode?.kind !== "talk") {
      return [];
    }

    return selectedEntityExtractionOptions.map((option) => {
      const extraction = selectedNode.config.responseEntityExtractions.find(
        (item) => item.entityId === option.entityId,
      );
      return {
        ...option,
        variableName: extraction
          ? extraction.variableName
          : option.variableName.startsWith("$")
            ? option.variableName
            : "",
        required: extraction?.required ?? option.required,
        local: extraction?.local ?? option.local,
        chatbotMessages: extraction?.chatbotMessages ?? [],
      };
    });
  }, [selectedEntityExtractionOptions, selectedNode]);

  const usedVariableGroups = useMemo(() => {
    const commonVariableNameSet = new Set(
      collectCommonFlowVariables(versionDocument).map((item) => stripVariablePrefix(item.name).toLowerCase()),
    );
    const groups = {
      user: [] as string[],
      common: [] as string[],
      system: [] as string[],
    };

    usedVariableNames.forEach((variableName) => {
      const normalizedName = stripVariablePrefix(variableName);
      const normalizedKey = normalizedName.toLowerCase();
      const displayedName = displayFlowVariableName(variableName);

      if (COMMON_FLOW_VARIABLE_NAME_SET.has(normalizedKey)) {
        groups.system.push(displayedName);
        return;
      }

      if (commonVariableNameSet.has(normalizedKey)) {
        groups.common.push(displayedName);
        return;
      }

      groups.user.push(variableName);
    });

    return {
      user: Array.from(new Set(groups.user)).sort((left, right) => left.localeCompare(right, "ko")),
      common: Array.from(new Set(groups.common)).sort((left, right) => left.localeCompare(right, "ko")),
      system: Array.from(new Set(groups.system)).sort((left, right) => left.localeCompare(right, "ko")),
    };
  }, [usedVariableNames, versionDocument]);

  const flowVariablePanelGroups = useMemo<FlowVariablePanelGroup[]>(() => {
    const commonRows = collectCommonFlowVariables(versionDocument)
      .filter((item) => !isQaFlowVariableName(item.name))
      .map((item) => ({
        name: displayFlowVariableName(item.name),
        category: "공통",
        description: item.value || "공통 변수",
      } satisfies FlowVariablePanelRow));
    const systemRows = COMMON_FLOW_VARIABLES
      .filter((item) => !isQaFlowVariableName(item.name))
      .map((item) => ({
        name: displayFlowVariableName(item.name),
        category: "시스템",
        description: item.description,
      } satisfies FlowVariablePanelRow));
    const commonOrSystemNameSet = new Set(
      [...commonRows, ...systemRows].map((item) => stripVariablePrefix(item.name).toLowerCase()),
    );
    const usedRows = Array.from(variableSourceMap.entries())
      .map(([name, sources]) => ({
        name,
        sources,
      }))
      .filter(({ name }) => !isQaFlowVariableName(name))
      .filter(({ name }) => !commonOrSystemNameSet.has(stripVariablePrefix(name).toLowerCase()))
      .map(({ name, sources }) => ({
        name: displayFlowVariableName(name),
        category: "사용자",
        description: "",
        cardNames: Array.from(sources).join(", "),
      } satisfies FlowVariablePanelRow))
      .sort((left, right) => left.name.localeCompare(right.name, "ko"));

    const legacyUsedRows = usedVariableNames
      .filter((name) => !isQaFlowVariableName(name))
      .filter((name) => {
        const normalized = stripVariablePrefix(name).toLowerCase();
        return !commonOrSystemNameSet.has(normalized) &&
          !usedRows.some((item) => stripVariablePrefix(item.name).toLowerCase() === normalized);
      })
      .map((name) => ({
        name: displayFlowVariableName(name),
        category: "사용자",
        description: "",
        cardNames: "대화 설계",
      } satisfies FlowVariablePanelRow));

    return [
      { key: "user", title: "사용자 변수", type: "user", rows: [...usedRows, ...legacyUsedRows] },
      { key: "common", title: "공통 변수", type: "common", rows: [...commonRows, ...systemRows] },
    ];
  }, [usedVariableNames, variableSourceMap, versionDocument]);

  function blockViewOnlyEdit() {
    setMessage("");
    setErrorMessage(getFlowDesignerLabel(copy, "조회모드에서는 대화 설계를 수정할 수 없습니다."));
  }

  function applyGraphUpdate(updater: (current: DialogFlowGraph) => DialogFlowGraph) {
    if (isViewOnly) {
      blockViewOnlyEdit();
      return;
    }

    setGraph((current) => {
      if (!current) {
        return current;
      }

      return updater(current);
    });
    setHasUnsavedChanges(true);
    setMessage("");
    setErrorMessage("");
  }

  function applyGraphMutation(updater: (current: DialogFlowGraph) => DialogFlowGraph) {
    if (isViewOnly) {
      blockViewOnlyEdit();
      return;
    }

    setGraph((current) => {
      if (!current) {
        return current;
      }

      return updater(current);
    });
    setHasUnsavedChanges(true);
  }

  function updateSelectedNodeTitle(value: string) {
    if (!selectedNodeId) {
      return;
    }

    applyGraphUpdate((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === selectedNodeId ? { ...node, title: value } : node,
      ),
    }));
  }

  function updateSelectedNode<T extends DialogFlowNode["kind"]>(
    kind: T,
    updater: (node: Extract<DialogFlowNode, { kind: T }>) => Extract<DialogFlowNode, { kind: T }>,
  ) {
    if (!selectedNodeId) {
      return;
    }

    applyGraphUpdate((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        if (node.id !== selectedNodeId || node.kind !== kind) {
          return node;
        }

        return updater(node as Extract<DialogFlowNode, { kind: T }>);
      }),
    }));
  }

  function openFunctionPicker() {
    if (!selectedNode || selectedNode.kind !== "function") {
      return;
    }

    const api = apiAssets.find((item) => item.id === selectedNode.config.apiId) ?? apiAssets[0] ?? null;
    const method =
      api?.methods.find((item) => item.id === selectedNode.config.methodId) ??
      api?.methods[0] ??
      null;
    const existingOutputIds = selectedNode.config.outputMappings.map((mapping) => mapping.parameterId);
    const savedOutputSchema = method ? getSavedFunctionOutputSchema(selectedNode, method) : [];
    const outputRows = method
      ? method.outputParameters.length > 0
        ? getFunctionOutputRows(method)
        : savedOutputSchema.length > 0
          ? savedOutputSchema
          : getFunctionOutputRows(method)
      : [];

    setFunctionPicker({
      step: "method",
      apiId: api?.id ?? "",
      methodId: method?.id ?? "",
      inputValues: Object.fromEntries(
        method?.parameters.map((parameter) => {
          const existing = selectedNode.config.parameterMappings.find(
            (mapping) => mapping.parameterId === parameter.id || mapping.name === parameter.name,
          );
          return [parameter.id, existing?.value || parameter.defaultValue];
        }) ?? [],
      ),
      outputIds:
        existingOutputIds.length > 0
          ? existingOutputIds
          : outputRows.length === 1 && outputRows[0]?.id === "root"
            ? ["root"]
            : [],
      expandedOutputPaths: outputRows.length > 1 ? ["root"] : [],
      testOutput: "",
      testOutputValue: undefined,
      testOutputRows: savedOutputSchema,
      testError: "",
    });
  }

  function applyFunctionPicker() {
    if (!functionPicker || !functionPickerApi || !functionPickerMethod) {
      return;
    }

    updateSelectedNode("function", (node) => {
      const parameterMappings = functionPickerMethod.parameters.map((parameter) => {
        const existing = node.config.parameterMappings.find(
          (mapping) => mapping.parameterId === parameter.id || mapping.name === parameter.name,
        );
        return {
          id: existing?.id ?? crypto.randomUUID(),
          parameterId: parameter.id,
          name: parameter.name,
          value: functionPicker.inputValues[parameter.id] || existing?.value || parameter.defaultValue,
        };
      });
      const outputRows = buildFunctionOutputMappings(
        functionPickerMethod,
        node.config.outputMappings,
        node.config.resultVariableName,
        functionPicker.testOutputRows,
      );
      const selectedOutputIdSet = new Set(functionPicker.outputIds);
      const selectedOutputMappings = outputRows.filter((mapping) => selectedOutputIdSet.has(mapping.parameterId));
      const outputMappings = selectedOutputMappings.filter(
        (mapping) =>
          !selectedOutputMappings.some(
            (selectedMapping) =>
              selectedMapping.parameterId !== mapping.parameterId &&
              isFunctionOutputDescendantPath(mapping.path, selectedMapping.path),
          ),
      );
      const normalizedOutputMappings =
        outputMappings.length > 1 && outputMappings.some((mapping) => mapping.path !== "root")
          ? outputMappings.filter((mapping) => mapping.path !== "root")
          : outputMappings;

      return {
        ...node,
        config: {
          ...node.config,
          apiId: functionPickerApi.id,
          methodId: functionPickerMethod.id,
          parameterMappings,
          outputMappings: normalizedOutputMappings,
          outputSchema:
            functionPickerMethod.outputParameters.length > 0
              ? []
              : functionPicker.testOutputRows.length > 0
                ? functionPicker.testOutputRows
                : node.config.outputSchema,
          resultVariableName:
            normalizedOutputMappings.find((mapping) => mapping.path === "root")?.variableName ||
            node.config.resultVariableName,
        },
      };
    });
    setFunctionPicker(null);
  }

  async function testFunctionPickerMethod() {
    if (!functionPicker || !functionPickerApi || !functionPickerMethod) {
      return;
    }

    const parameterValues = Object.fromEntries(
      functionPickerMethod.parameters.map((parameter) => [
        parameter.name,
        functionPicker.inputValues[parameter.id] || parameter.defaultValue,
      ]),
    );

    setFunctionPicker((current) => (current ? { ...current, testError: "" } : current));

    try {
      const response = await fetch("/api/function/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api: functionPickerApi,
          methodId: functionPickerMethod.id,
          parameterValues,
          variables: {},
        }),
      });
      const payload = await response.json().catch(() => null) as {
        body?: unknown;
        message?: string;
      } | null;
      const outputSource = payload;
      const outputRows =
        functionPickerMethod.outputParameters.length > 0
          ? []
          : buildFunctionOutputRowsFromValue(outputSource);
      const previewRows =
        functionPickerMethod.outputParameters.length > 0
          ? getFunctionOutputRows(functionPickerMethod)
          : outputRows;

      setFunctionPicker((current) =>
        current
          ? (() => {
              const nextOutputIds =
                current.outputIds.length > 0
                  ? current.outputIds
                  : outputRows.length > 0
                    ? ["root"]
                    : current.outputIds;

              return {
                ...current,
                outputIds: nextOutputIds,
                expandedOutputPaths: outputRows.length > 1 ? ["root"] : [],
              testOutput: buildFunctionPickerTestOutputPreview(outputSource, previewRows, nextOutputIds),
              testOutputValue: outputSource,
              testOutputRows: outputRows,
              testError: "",
            };
          })()
          : current,
      );
    } catch (error) {
      setFunctionPicker((current) =>
        current
          ? {
              ...current,
              testOutputValue: undefined,
              testError: error instanceof Error ? error.message : "API 테스트 중 오류가 발생했습니다.",
            }
          : current,
      );
    }
  }

  function isScriptIdentifier(value: string) {
    return /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(value.trim());
  }

  function validateScriptDraftSyntax(value: string) {
    if (!value.trim()) {
      return "";
    }

    try {
      new Function(value);
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : "스크립트 문법을 확인해주세요.";
    }
  }

  function buildAdaptiveCardScriptSnippet(cardJson: unknown) {
    if (!cardJson || typeof cardJson !== "object" || Array.isArray(cardJson)) {
      throw new Error("Adaptive Card JSON이 생성되지 않았습니다.");
    }

    const formattedCardJson = JSON.stringify(cardJson, null, 2);
    return [
      ADAPTIVE_CARD_SCRIPT_START,
      `const adaptiveCard = card.stringify(${formattedCardJson});`,
      "const msgKey = adaptiveCard;",
      'set("adaptiveCard", adaptiveCard);',
      'set("msgKey", msgKey);',
      ADAPTIVE_CARD_SCRIPT_END,
    ].join("\n");
  }

  function mergeAdaptiveCardScriptSnippet(code: string, snippet: string) {
    const generatedBlockPattern = new RegExp(
      `${escapeRegExp(ADAPTIVE_CARD_SCRIPT_START)}[\\s\\S]*?${escapeRegExp(ADAPTIVE_CARD_SCRIPT_END)}`,
    );
    const trimmedCode = code.trim();

    if (generatedBlockPattern.test(code)) {
      return code.replace(generatedBlockPattern, snippet);
    }

    return trimmedCode ? `${trimmedCode}\n\n${snippet}` : snippet;
  }

  function ensureAdaptiveCardReturnVariables(
    returnVariables: Extract<DialogFlowNode, { kind: "script" }>["config"]["returnVariables"],
  ) {
    const requiredVariables = [
      { variableName: "adaptiveCard", scriptVariableName: "adaptiveCard" },
      { variableName: "msgKey", scriptVariableName: "msgKey" },
    ];
    const nextReturnVariables = [...returnVariables];

    requiredVariables.forEach((requiredVariable) => {
      const existingIndex = nextReturnVariables.findIndex(
        (item) => stripVariablePrefix(item.variableName) === requiredVariable.variableName,
      );

      if (existingIndex >= 0) {
        nextReturnVariables[existingIndex] = {
          ...nextReturnVariables[existingIndex],
          type: "string",
          scriptVariableName: requiredVariable.scriptVariableName,
          local: false,
        };
        return;
      }

      nextReturnVariables.push({
        id: crypto.randomUUID(),
        type: "string",
        variableName: requiredVariable.variableName,
        scriptVariableName: requiredVariable.scriptVariableName,
        local: false,
      });
    });

    return nextReturnVariables;
  }

  function openAdaptiveCardDesigner() {
    if (!selectedNode || selectedNode.kind !== "script") {
      return;
    }

    setAdaptiveCardDesignerOutput(null);
    setAdaptiveCardDesignerStatus("");
    setAdaptiveCardDesignerOpen(true);
  }

  function applyAdaptiveCardDesignerOutput() {
    if (!selectedNode || selectedNode.kind !== "script") {
      return;
    }

    try {
      const snippet = buildAdaptiveCardScriptSnippet(adaptiveCardDesignerOutput?.adaptiveCard);
      updateSelectedNode("script", (node) => ({
        ...node,
        config: {
          ...node.config,
          code: mergeAdaptiveCardScriptSnippet(node.config.code, snippet),
          returnVariables: ensureAdaptiveCardReturnVariables(node.config.returnVariables),
        },
      }));
      setAdaptiveCardDesignerStatus("");
      setAdaptiveCardDesignerOpen(false);
    } catch (error) {
      setAdaptiveCardDesignerStatus(
        error instanceof Error ? error.message : "Adaptive Card JSON 적용에 실패했습니다.",
      );
    }
  }

  function openScriptEditor() {
    if (!selectedNode || selectedNode.kind !== "script") {
      return;
    }

    setScriptCodeDraft(selectedNode.config.code);
    setScriptEditorError("");
    setScriptEditorOpen(true);
  }

  function confirmScriptEditor() {
    const syntaxError = validateScriptDraftSyntax(scriptCodeDraft);
    if (syntaxError) {
      setScriptEditorError(syntaxError);
      return;
    }

    updateSelectedNode("script", (node) => ({
      ...node,
      config: {
        ...node.config,
        code: scriptCodeDraft,
      },
    }));
    setScriptEditorError("");
    setScriptEditorOpen(false);
  }

  function checkScriptEditorSyntax() {
    const syntaxError = validateScriptDraftSyntax(scriptCodeDraft);
    setScriptEditorError(syntaxError || "문법 오류가 없습니다.");
  }

  function handleScriptEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") {
      return;
    }

    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = `${scriptCodeDraft.slice(0, start)}  ${scriptCodeDraft.slice(end)}`;
    setScriptCodeDraft(nextValue);
    setScriptEditorError("");
    window.setTimeout(() => {
      textarea.selectionStart = start + 2;
      textarea.selectionEnd = start + 2;
    }, 0);
  }

  function updateTalkMessageValue(index: number, value: string) {
    updateSelectedNode("talk", (node) => {
      const nextMessages = [...node.config.messages];
      while (nextMessages.length <= index) {
        nextMessages.push("");
      }
      nextMessages[index] = value;

      return {
        ...node,
        config: {
          ...node.config,
          messages: nextMessages,
        },
      };
    });
  }

  function syncHtmlEditorValue() {
    updateTalkMessageValue(0, htmlEditorRef.current?.innerHTML ?? "");
  }

  function runHtmlEditorCommand(command: string, value?: string) {
    htmlEditorRef.current?.focus();
    document.execCommand(command, false, value);
    syncHtmlEditorValue();
  }

  function handleHtmlEditorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    document.execCommand("insertHTML", false, "<br>");
    syncHtmlEditorValue();
  }

  function updateTalkManualTableCell(rowId: string, index: number, value: string) {
    updateSelectedNode("talk", (node) => ({
      ...node,
      config: {
        ...node.config,
        tableManualRows: node.config.tableManualRows.map((row) => {
          if (row.id !== rowId) {
            return row;
          }

          const nextValues = [...row.values];
          while (nextValues.length <= index) {
            nextValues.push("");
          }
          nextValues[index] = value;
          return { ...row, values: nextValues };
        }),
      },
    }));
  }

  function updateTalkDtmfNumber(index: number, delta: number) {
    if (!selectedNode || selectedNode.kind !== "talk") {
      return;
    }

    const currentValue = Number.parseInt(selectedNode.config.messages[index] || "0", 10);
    updateTalkMessageValue(index, String(Math.max(1, (Number.isFinite(currentValue) ? currentValue : 0) + delta)));
  }

  function buildEntityExtractionConfig(option: EntityExtractionOption) {
    return {
      id: option.id,
      entityId: option.entityId,
      entityName: option.entityName,
      variableName: option.variableName.startsWith("$") ? option.variableName : "",
      required: option.required,
      local: option.local,
      chatbotMessages: [] as string[],
    };
  }

  function renderTalkTemplateSettingsIntro(
    node: Extract<DialogFlowNode, { kind: "talk" }>,
    templateContent?: ReactNode,
  ) {
    const selectedTemplateType =
      node.config.messageType === "text" && !isKakaoTalkTemplateChannel(node.config.templateChannel)
        ? ""
        : node.config.messageType;
    const currentTalkMessageTypeOptions = buildTalkMessageTypeOptions(
      talkTemplates,
      node.config.templateChannel,
      botMode,
    );

    return (
      <div className="flow-designer-page__template-dialog-layout">
        <aside className="flow-designer-page__template-dialog-variables">
          <strong>{getFlowDesignerLabel(copy, "변수")}</strong>
          <div className="flow-designer-page__template-dialog-variable-list">
            {usedVariableNames.length > 0 ? (
              usedVariableNames.map((variableName) => (
                <div key={`${node.id}-${variableName}`} className="flow-designer-page__template-dialog-variable">
                  <strong>{variableName}</strong>
                  <span>{usedVariableTypeMap.get(variableName) ?? "string"}</span>
                </div>
              ))
            ) : (
              <div className="flow-designer-page__template-dialog-variable"></div>
            )}
          </div>
        </aside>

        <section className="flow-designer-page__template-dialog-message">
          <strong>{getFlowDesignerLabel(copy, "메시지")}</strong>
          <div className="flow-designer-page__template-dialog-tabs">
            <div className="flow-designer-page__channel-tabs">
              {talkTemplateChannelOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    node.config.templateChannel === option.value
                      ? "flow-designer-page__channel-tab is-active"
                      : "flow-designer-page__channel-tab"
                  }
                  onClick={() =>
                    updateSelectedNode("talk", (currentNode) => {
                      if (currentNode.config.templateChannel === option.value) {
                        return currentNode;
                      }
                      const nextOptions = buildTalkMessageTypeOptions(talkTemplates, option.value, botMode);
                      const nextMessageType = (nextOptions[0]?.value ?? "text") as Extract<
                        DialogFlowNode,
                        { kind: "talk" }
                      >["config"]["messageType"];
                      const snapshottedConfig = snapshotTalkActiveChannelConfig(currentNode.config);
                      return {
                        ...currentNode,
                        config: applyTalkChannelTemplateToConfig(
                          snapshottedConfig,
                          option.value,
                          nextMessageType,
                        ),
                      };
                    })
                  }
                >
                  {option.label}
                  <span aria-hidden="true">ⓘ</span>
                </button>
              ))}
              <button type="button" className="flow-designer-page__channel-tab" disabled>
                +
              </button>
            </div>
          </div>

          <label className="flow-designer-page__field flow-designer-page__template-dialog-select">
            <span>
              {getFlowDesignerLabel(copy, "템플릿 선택")}<span className="flow-designer-page__required">*</span>
            </span>
            <select
              className="bot-settings-card__select flow-designer-page__plain-select"
              value={selectedTemplateType}
              onChange={(event) =>
                updateSelectedNode("talk", (currentNode) => {
                  const nextMessageType = (event.target.value || "text") as Extract<
                      DialogFlowNode,
                      { kind: "talk" }
                    >["config"]["messageType"];
                  const messageTypeChanged = currentNode.config.messageType !== nextMessageType;
                  const nextConfig = {
                    ...currentNode.config,
                    messageType: nextMessageType,
                    templateChannel: currentNode.config.templateChannel,
                    messages: messageTypeChanged ? [""] : currentNode.config.messages,
                    tableUseVariable: nextMessageType === "table" ? currentNode.config.tableUseVariable : true,
                    tableVariableItemId: nextMessageType === "table" ? currentNode.config.tableVariableItemId : "",
                    tableKeyColumn: nextMessageType === "table" ? currentNode.config.tableKeyColumn : "",
                    tableColumnMappings: nextMessageType === "table" ? currentNode.config.tableColumnMappings : [],
                    tableManualRows:
                      nextMessageType === "table"
                        ? currentNode.config.tableManualRows
                        : [{ id: crypto.randomUUID(), key: "", values: [""] }],
                    linkButtonItems:
                      nextMessageType === "link-button"
                        ? currentNode.config.linkButtonItems
                        : [{ id: crypto.randomUUID(), label: "", url: "" }],
                  };
                  return {
                    ...currentNode,
                    config: snapshotTalkActiveChannelConfig(nextConfig),
                  };
                })
              }
            >
              <option value="">{getFlowDesignerLabel(copy, "미선택")}</option>
              {currentTalkMessageTypeOptions
                .filter((option) =>
                  isKakaoTalkTemplateChannel(node.config.templateChannel) ? true : option.value !== "text",
                )
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
          {templateContent ? <div className="flow-designer-page__template-dialog-content">{templateContent}</div> : null}
        </section>
      </div>
    );
  }

  function updateVariableColumnDraft(itemId: string, value: string) {
    setVariableColumnDrafts((current) => ({
      ...current,
      [itemId]: value,
    }));
  }

  function commitVariableColumn(itemId: string) {
    const draft = (variableColumnDrafts[itemId] ?? "").trim().slice(0, 100);
    if (!draft) {
      return;
    }

    updateSelectedNode("variable", (node) => ({
      ...node,
      config: {
        items: node.config.items.map((entry) => {
          if (entry.id !== itemId) {
            return entry;
          }

          if (entry.tableColumns.includes(draft)) {
            return entry;
          }

          return {
            ...entry,
            tableColumns: [...entry.tableColumns, draft],
          };
        }),
      },
    }));

    setVariableColumnDrafts((current) => ({
      ...current,
      [itemId]: "",
    }));
  }

  function removeVariableColumn(itemId: string, columnIndex: number) {
    updateSelectedNode("variable", (node) => ({
      ...node,
      config: {
        items: node.config.items.map((entry) =>
          entry.id === itemId
            ? {
                ...entry,
                tableColumns: entry.tableColumns.filter((_, index) => index !== columnIndex),
              }
            : entry,
        ),
      },
    }));
  }

  function editVariableColumn(itemId: string, columnIndex: number) {
    const selectedNode = graph?.nodes.find((node) => node.id === selectedNodeId);
    if (!selectedNode || selectedNode.kind !== "variable") {
      return;
    }

    const selectedItem = selectedNode.config.items.find((item) => item.id === itemId);
    const columnValue = selectedItem?.tableColumns[columnIndex] ?? "";
    setVariableColumnDrafts((current) => ({
      ...current,
      [itemId]: columnValue,
    }));
    removeVariableColumn(itemId, columnIndex);
  }

  function getPreferredSourcePort(node: DialogFlowNode, currentGraph: DialogFlowGraph) {
    if (node.kind === "end") {
      return null;
    }

    if (node.kind === "jump") {
      if (
        node.config.targetType === "dialog" &&
        !getFlowLinkTargetId(currentGraph, node.id, "next")
      ) {
        return "next";
      }

      return null;
    }

    if (node.kind === "condition") {
      return "branch:new";
    }

    return "next";
  }

  function resolveHoveredTargetNodeId(
    currentGraph: DialogFlowGraph,
    clientX: number,
    clientY: number,
    excludedNodeIds: string[] = [],
  ) {
    const target = document.elementFromPoint(clientX, clientY);
    if (target instanceof Element) {
      const nodeElement = target.closest("[data-flow-node-id]");
      const nodeId = nodeElement?.getAttribute("data-flow-node-id") ?? "";
      if (nodeId && !excludedNodeIds.includes(nodeId)) {
        const hoveredNode = getNodeById(currentGraph, nodeId);
        if (hoveredNode && !isSystemFlowNode(hoveredNode)) {
          return hoveredNode.id;
        }
      }
    }

    const candidateElements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-flow-node-id]"),
    );
    let nearestNodeId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const element of candidateElements) {
      const nodeId = element.getAttribute("data-flow-node-id") ?? "";
      if (!nodeId || excludedNodeIds.includes(nodeId)) {
        continue;
      }

      const node = getNodeById(currentGraph, nodeId);
      if (!node || isSystemFlowNode(node)) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      const expandedLeft = rect.left - 28;
      const expandedRight = rect.right + 28;
      const expandedTop = rect.top - 28;
      const expandedBottom = rect.bottom + 28;
      const insideExpandedRect =
        clientX >= expandedLeft &&
        clientX <= expandedRight &&
        clientY >= expandedTop &&
        clientY <= expandedBottom;

      if (!insideExpandedRect) {
        continue;
      }

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(clientX - centerX, clientY - centerY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestNodeId = node.id;
      }
    }

    return nearestNodeId;
  }

  function updateLinkInGraph(
    currentGraph: DialogFlowGraph,
    linkId: string,
    updater: (link: DialogFlowLink) => DialogFlowLink,
  ) {
    return {
      ...currentGraph,
      links: currentGraph.links.map((link) => (link.id === linkId ? updater(link) : link)),
    };
  }

  function syncCardTargetFromLink(
    currentGraph: DialogFlowGraph,
    sourceNodeId: string,
    sourcePort: string,
    targetNodeId: string,
  ): DialogFlowGraph {
    return {
      ...currentGraph,
      nodes: currentGraph.nodes.map((node) => {
        if (node.id !== sourceNodeId || node.kind !== "jump" || sourcePort !== "jump") {
          return node;
        }

        return {
          ...node,
          config: {
            ...node.config,
            targetType: "card" as const,
            targetCardId: targetNodeId,
            targetDialogId: "",
            targetDialogName: "",
          },
        };
      }),
    };
  }

  function updateJumpCardTargetCard(
    currentGraph: DialogFlowGraph,
    sourceNodeId: string,
    targetNodeId: string,
  ): DialogFlowGraph {
    return {
      ...currentGraph,
      nodes: currentGraph.nodes.map((node) => {
        if (node.id !== sourceNodeId || node.kind !== "jump") {
          return node;
        }

        return {
          ...node,
          config: {
            ...node.config,
            targetType: "card",
            targetCardId: targetNodeId,
            targetDialogId: "",
            targetDialogName: "",
          },
        };
      }),
    };
  }

  function buildConnectedNodePosition(
    currentGraph: DialogFlowGraph,
    sourceNode: DialogFlowNode,
    kind: PaletteKind,
  ) {
    const sourceSize = FLOW_NODE_SIZES[sourceNode.kind];
    const targetSize = FLOW_NODE_SIZES[kind];

    if (sourceNode.kind === "condition") {
      const branchTargetNodes = currentGraph.links
        .filter(
          (link) =>
            link.sourceNodeId === sourceNode.id &&
            link.sourcePort.startsWith("branch:"),
        )
        .map((link) => getNodeById(currentGraph, link.targetNodeId))
        .filter((node): node is DialogFlowNode => Boolean(node));
      const nextBranchY =
        branchTargetNodes.length > 0
          ? Math.max(
              ...branchTargetNodes.map((node) => node.position.y + FLOW_NODE_SIZES[node.kind].height),
            ) + 38
          : sourceNode.position.y + Math.round((sourceSize.height - targetSize.height) / 2);
      let candidate = clampPosition({
        x: sourceNode.position.x + sourceSize.width + 118,
        y: nextBranchY,
      });

      for (let attempt = 0; attempt < 16; attempt += 1) {
        const overlaps = currentGraph.nodes.some((node) => {
          const size = FLOW_NODE_SIZES[node.kind];
          return (
            Math.abs(node.position.x - candidate.x) < Math.max(size.width, targetSize.width) * 0.72 &&
            Math.abs(node.position.y - candidate.y) < Math.max(size.height, targetSize.height) * 0.9
          );
        });

        if (!overlaps) {
          return candidate;
        }

        candidate = clampPosition({
          x: candidate.x,
          y: candidate.y + targetSize.height + 38,
        });
      }

      return candidate;
    }

    const candidate = clampPosition({
      x: sourceNode.position.x + sourceSize.width + 118,
      y: sourceNode.position.y + Math.round((sourceSize.height - targetSize.height) / 2),
    });

    const overlaps = currentGraph.nodes.some((node) => {
      const size = FLOW_NODE_SIZES[node.kind];
      return (
        Math.abs(node.position.x - candidate.x) < Math.max(size.width, targetSize.width) * 0.72 &&
        Math.abs(node.position.y - candidate.y) < Math.max(size.height, targetSize.height) * 0.9
      );
    });

    return overlaps ? buildNextCanvasPosition(currentGraph) : candidate;
  }

  function addNode(
    kind: PaletteKind,
    options?: {
      position?: DialogFlowPosition;
      sourceNodeId?: string;
      sourcePort?: string;
    },
  ) {
    if (!graph) {
      return;
    }

    let createdNodeId = "";

    applyGraphUpdate((current) => {
      const sourceNode = options?.sourceNodeId ? getNodeById(current, options.sourceNodeId) : null;
      const nextNode = createDialogFlowNode(
        kind,
        options?.position
          ? clampPosition(options.position)
          : sourceNode
            ? buildConnectedNodePosition(current, sourceNode, kind)
            : buildNextCanvasPosition(current),
        current.nodes,
      );
      createdNodeId = nextNode.id;

      let nextGraph: DialogFlowGraph = {
        ...current,
        nodes: [...current.nodes, nextNode],
      };

      if (options?.sourceNodeId && options.sourcePort) {
        if (options.sourcePort === "branch:new") {
          const branchId = crypto.randomUUID();
          nextGraph = {
            ...nextGraph,
            nodes: nextGraph.nodes.map((node) =>
              node.id === options.sourceNodeId && node.kind === "condition"
                ? {
                    ...node,
                    config: {
                      ...node.config,
                      branches: [
                        ...node.config.branches,
                        {
                          id: branchId,
                          label: "기본",
                          operator: "else" as const,
                          compareValue: "",
                        },
                      ],
                    },
                  }
                : node,
            ),
          };
          nextGraph = setFlowLinkTarget(
            nextGraph,
            options.sourceNodeId,
            `branch:${branchId}`,
            nextNode.id,
          );
          return nextGraph;
        }

        nextGraph = setFlowLinkTarget(
          nextGraph,
          options.sourceNodeId,
          options.sourcePort,
          nextNode.id,
        );
        nextGraph = syncCardTargetFromLink(
          nextGraph,
          options.sourceNodeId,
          options.sourcePort,
          nextNode.id,
        );
      }

      return nextGraph;
    });

    setSelectedNodeId(createdNodeId);
    setLinkingState(null);
    setInspectorTab("properties");
  }

  function handleCanvasDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (isViewOnly) {
      blockViewOnlyEdit();
      return;
    }

    const droppedKind = event.dataTransfer.getData("text/dialog-flow-kind") as PaletteKind;
    if (!droppedKind || !graph || !canvasViewportRef.current) {
      return;
    }

    const rect = canvasViewportRef.current.getBoundingClientRect();
    addNode(droppedKind, {
      position: {
        x: (event.clientX - rect.left + canvasViewportRef.current.scrollLeft) / canvasScale - 90,
        y: (event.clientY - rect.top + canvasViewportRef.current.scrollTop) / canvasScale - 40,
      },
    });
  }

  function handleNodeDragStart(event: React.MouseEvent<HTMLElement>, node: DialogFlowNode) {
    if (isViewOnly) {
      blockViewOnlyEdit();
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      return;
    }

    if (!canvasViewportRef.current) {
      return;
    }

    const pointer = getCanvasPointerPosition(
      canvasViewportRef.current,
      event.clientX,
      event.clientY,
      canvasScale,
    );
    if (!pointer) {
      return;
    }

    const activeNodeIds = multiSelectedNodeIds.includes(node.id)
      ? multiSelectedNodeIds
      : [node.id];
    const activeNodeIdSet = new Set(activeNodeIds);
    const activeLinkIds = multiSelectedNodeIds.includes(node.id)
      ? multiSelectedLinkIds
      : [];

    setSelectedNodeId(node.id);
    setSelectedLinkId(null);
    setSelectedLinkHandle(null);
    setMultiSelectedNodeIds(activeNodeIds);
    setMultiSelectedLinkIds(activeLinkIds);
    setDraggingNode({
      nodeId: node.id,
      offsetX: pointer.x - node.position.x,
      offsetY: pointer.y - node.position.y,
      nodeIds: activeNodeIds,
      linkIds: activeLinkIds,
      startPointer: pointer,
      startNodePositions: Object.fromEntries(
        (graph?.nodes ?? [])
          .filter((item) => activeNodeIdSet.has(item.id))
          .map((item) => [item.id, item.position]),
      ),
      startLinkWaypoints: Object.fromEntries(
        (graph?.links ?? [])
          .filter((link) => activeLinkIds.includes(link.id))
          .map((link) => [link.id, link.waypoints]),
      ),
    });
  }

  function handleDefaultLinkChange(sourceNodeId: string, sourcePort: string, targetNodeId: string) {
    applyGraphUpdate((current) => {
      if (sourcePort === "jump") {
        return updateJumpCardTargetCard(current, sourceNodeId, targetNodeId);
      }

      if (sourcePort === "branch:new") {
        if (!targetNodeId) {
          return current;
        }

        const branchId = crypto.randomUUID();
        const nextGraph: DialogFlowGraph = {
          ...current,
          nodes: current.nodes.map((node) =>
            node.id === sourceNodeId && node.kind === "condition"
              ? {
                  ...node,
                  config: {
                    ...node.config,
                    branches: [
                      ...node.config.branches,
                      {
                        id: branchId,
                        label: "기본",
                        operator: "else" as const,
                        compareValue: "",
                      },
                    ],
                  },
                }
              : node,
          ),
        };
        return setFlowLinkTarget(
          nextGraph,
          sourceNodeId,
          `branch:${branchId}`,
          targetNodeId,
        );
      }

      if (sourcePort.startsWith("branch:") && !targetNodeId) {
        return removeUnlinkedConditionBranches({
          ...current,
          links: current.links.filter(
            (link) => !(link.sourceNodeId === sourceNodeId && link.sourcePort === sourcePort),
          ),
        });
      }

      const existingLink = current.links.find(
        (link) => link.sourceNodeId === sourceNodeId && link.sourcePort === sourcePort,
      );
      const nextGraph = setFlowLinkTarget(
        current,
        sourceNodeId,
        sourcePort,
        targetNodeId,
        existingLink?.waypoints,
      );
      return syncCardTargetFromLink(nextGraph, sourceNodeId, sourcePort, targetNodeId);
    });
  }

  function handleSelectLink(linkId: string) {
    setSelectedNodeId(null);
    setSelectedLinkId(linkId);
    setSelectedLinkHandle(null);
    setMultiSelectedNodeIds([]);
    setMultiSelectedLinkIds([linkId]);
    setLinkingState(null);
    setLinkDragState(null);
    setInspectorTab("properties");
  }

  function handleLinkPathMouseDown(
    event: React.MouseEvent<SVGPathElement>,
    link: DialogFlowLink,
    points: DialogFlowPosition[],
  ) {
    event.stopPropagation();
    if (event.button !== 0 || selectedLinkId !== link.id) {
      return;
    }

    const pointer = getCanvasPointerPosition(
      canvasViewportRef.current,
      event.clientX,
      event.clientY,
      canvasScale,
    );
    if (!pointer) {
      return;
    }

    const waypointIndex = getNearestLinkSegmentIndex(points, pointer);
    applyGraphMutation((current) =>
      updateLinkInGraph(current, link.id, (item) => ({
        ...item,
        waypoints: [
          ...item.waypoints.slice(0, waypointIndex),
          pointer,
          ...item.waypoints.slice(waypointIndex),
        ],
      })),
    );
    setSelectedLinkHandle({
      linkId: link.id,
      mode: "waypoint",
      waypointIndex,
      isNew: true,
      startPointer: pointer,
      hasMoved: false,
    });
  }

  function handleLinkHandleMouseDown(
    event: React.MouseEvent<SVGCircleElement>,
    handle: SelectedLinkHandle,
  ) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(null);
    setSelectedLinkId(handle.linkId);
    setSelectedLinkHandle(handle);
    setLinkingState(null);
    setLinkDragState(null);
  }

  function handleLinkDragStart(
    event: React.MouseEvent<HTMLButtonElement>,
    node: DialogFlowNode,
    sourcePort?: string | null,
  ) {
    if (!sourcePort) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const pointer = getCanvasPointerPosition(
      canvasViewportRef.current,
      event.clientX,
      event.clientY,
      canvasScale,
    );

    if (!pointer) {
      return;
    }

    setLinkDragState({
      sourceNodeId: node.id,
      sourcePort,
      pointer,
      hoveredTargetNodeId: null,
    });
    setSelectedNodeId(node.id);
    setInspectorTab("properties");
    setLinkingState(null);
    setMessage("");
    setErrorMessage("");
  }

  function handleToolbarAdd(kind: PaletteKind) {
    if (graph && selectedNode) {
      const sourcePort = getPreferredSourcePort(selectedNode, graph);
      if (sourcePort) {
        addNode(kind, {
          sourceNodeId: selectedNode.id,
          sourcePort,
        });
        return;
      }
    }

    addNode(kind);
  }

  function handleStartLinkSelection(node: DialogFlowNode, sourcePort?: string | null) {
    if (!graph) {
      return;
    }

    const nextSourcePort = sourcePort ?? getPreferredSourcePort(node, graph);
    if (!nextSourcePort) {
      setMessage("");
      setErrorMessage("이 카드에서는 추가로 연결할 다음 카드를 선택할 수 없습니다.");
      return;
    }

    setLinkingState({
      sourceNodeId: node.id,
      sourcePort: nextSourcePort,
    });
    setLinkDragState(null);
    setErrorMessage("");
    setMessage(
      nextSourcePort === "exception"
        ? "캔버스에서 연결할 예외 카드를 선택하세요."
        : "캔버스에서 연결할 다음 카드를 선택하세요.",
    );
  }

  function handleNodeSelect(
    nodeId: string,
    options?: {
      debugMode?: boolean;
      toggleSelection?: boolean;
    },
  ) {
    if (!graph) {
      return;
    }

    if (linkingState) {
      if (linkingState.sourceNodeId === nodeId) {
        setLinkingState(null);
        setMessage("");
        return;
      }

      handleDefaultLinkChange(linkingState.sourceNodeId, linkingState.sourcePort, nodeId);
      setLinkingState(null);
      setSelectedNodeId(nodeId);
      setSelectedLinkId(null);
      setSelectedLinkHandle(null);
      setMultiSelectedNodeIds([]);
      setMultiSelectedLinkIds([]);
      setInspectorTab(options?.debugMode ? "test" : "properties");
      setErrorMessage("");
      setMessage(
        linkingState.sourcePort === "exception"
          ? "예외 연결이 반영되었습니다."
          : "카드 연결이 반영되었습니다.",
      );
      return;
    }

    setLinkDragState(null);
    if (options?.toggleSelection) {
      const selectedNodeIdSet = new Set([
        ...multiSelectedNodeIds,
        ...(selectedNodeId ? [selectedNodeId] : []),
      ]);
      if (selectedNodeIdSet.has(nodeId)) {
        selectedNodeIdSet.delete(nodeId);
      } else {
        selectedNodeIdSet.add(nodeId);
      }
      const nextSelectedNodeIds = Array.from(selectedNodeIdSet);

      setSelectedNodeId(nextSelectedNodeIds[0] ?? null);
      setSelectedLinkId(null);
      setSelectedLinkHandle(null);
      setMultiSelectedNodeIds(nextSelectedNodeIds);
      setMultiSelectedLinkIds([]);
      setInspectorTab(options.debugMode ? "test" : "properties");
      return;
    }

    setSelectedNodeId(nodeId);
    setSelectedLinkId(null);
    setSelectedLinkHandle(null);
    setMultiSelectedNodeIds([]);
    setMultiSelectedLinkIds([]);
    setInspectorTab(options?.debugMode ? "test" : "properties");
  }

  function handleDeleteSelectedNode() {
    if (isViewOnly) {
      blockViewOnlyEdit();
      return;
    }

    if (!graph || !selectedNode || selectedNode.kind === "start") {
      return;
    }

    applyGraphUpdate((current) => removeUnlinkedConditionBranches(removeFlowNode(current, selectedNode.id)));
    setLinkingState((current) => (current?.sourceNodeId === selectedNode.id ? null : current));
    setLinkDragState((current) => (current?.sourceNodeId === selectedNode.id ? null : current));
    setSelectedNodeId(null);
    setMultiSelectedNodeIds([]);
    setMultiSelectedLinkIds([]);
  }

  function handleDeleteSelectedLink() {
    if (isViewOnly) {
      blockViewOnlyEdit();
      return;
    }

    if (!selectedLinkId) {
      return;
    }

    applyGraphUpdate((current) =>
      removeUnlinkedConditionBranches({
        ...current,
        links: current.links.filter((link) => link.id !== selectedLinkId),
      }),
    );
    setSelectedLinkId(null);
    setSelectedLinkHandle(null);
    setMultiSelectedNodeIds([]);
    setMultiSelectedLinkIds([]);
  }

  function isNodeTerminal(node: DialogFlowNode) {
    return node.kind === "end";
  }

  function getNodeSuccessorIds(currentGraph: DialogFlowGraph, node: DialogFlowNode) {
    if (node.kind === "condition") {
      return node.config.branches
        .map((branch) => getFlowLinkTargetId(currentGraph, node.id, `branch:${branch.id}`))
        .filter((value): value is string => Boolean(value));
    }

    if (node.kind === "jump") {
      if (node.config.targetType === "card" && node.config.targetCardId) {
        return [node.config.targetCardId];
      }

      if (node.config.targetType === "dialog") {
        return [getFlowLinkTargetId(currentGraph, node.id, "next")].filter(
          (value): value is string => Boolean(value),
        );
      }

      return [];
    }

    const successorIds = [getFlowLinkTargetId(currentGraph, node.id, "next")];
    if (supportsExceptionHandling(node.kind)) {
      successorIds.push(getFlowLinkTargetId(currentGraph, node.id, "exception"));
    }

    return successorIds.filter((value): value is string => Boolean(value));
  }

  function findNodeWithoutTerminalPath(currentGraph: DialogFlowGraph) {
    const reverseLinks = new Map<string, string[]>();
    for (const node of currentGraph.nodes) {
      for (const successorId of getNodeSuccessorIds(currentGraph, node)) {
        reverseLinks.set(successorId, [...(reverseLinks.get(successorId) ?? []), node.id]);
      }
    }

    const terminalReachableNodeIds = new Set<string>();
    const terminalQueue = currentGraph.nodes
      .filter((node) => isNodeTerminal(node))
      .map((node) => node.id);

    while (terminalQueue.length > 0) {
      const nodeId = terminalQueue.shift();
      if (!nodeId || terminalReachableNodeIds.has(nodeId)) {
        continue;
      }

      terminalReachableNodeIds.add(nodeId);
      for (const predecessorId of reverseLinks.get(nodeId) ?? []) {
        if (!terminalReachableNodeIds.has(predecessorId)) {
          terminalQueue.push(predecessorId);
        }
      }
    }

    const startNode = currentGraph.nodes.find((node) => node.kind === "start");
    if (startNode && !terminalReachableNodeIds.has(startNode.id)) {
      return startNode;
    }

    return null;
  }

  function findImmediateLoopNode(currentGraph: DialogFlowGraph) {
    const startNode = currentGraph.nodes.find((node) => node.kind === "start");
    if (!startNode) {
      return null;
    }

    const visitedNodeIds = new Set<string>();
    const stackNodeIds: string[] = [];

    function visit(nodeId: string): DialogFlowNode | null {
      const node = getNodeById(currentGraph, nodeId);
      if (!node || node.kind === "end") {
        return null;
      }

      const stackIndex = stackNodeIds.indexOf(nodeId);
      if (stackIndex >= 0) {
        const cycleNodeIds = stackNodeIds.slice(stackIndex);
        const hasUserWait = cycleNodeIds.some((cycleNodeId) => {
          const cycleNode = getNodeById(currentGraph, cycleNodeId);
          return cycleNode?.kind === "talk";
        });
        return hasUserWait ? null : node;
      }

      if (visitedNodeIds.has(nodeId)) {
        return null;
      }

      visitedNodeIds.add(nodeId);
      stackNodeIds.push(nodeId);

      for (const successorId of getNodeSuccessorIds(currentGraph, node)) {
        const loopNode = visit(successorId);
        if (loopNode) {
          return node.kind === "jump" ? node : loopNode;
        }
      }

      stackNodeIds.pop();
      return null;
    }

    return visit(startNode.id);
  }

  function collectReachableNodeIds(currentGraph: DialogFlowGraph) {
    const startNode = currentGraph.nodes.find((node) => node.kind === "start");
    if (!startNode) {
      return new Set<string>();
    }

    const reachableNodeIds = new Set<string>();
    const pendingNodeIds = [startNode.id];

    while (pendingNodeIds.length > 0) {
      const nodeId = pendingNodeIds.shift();
      if (!nodeId || reachableNodeIds.has(nodeId)) {
        continue;
      }

      reachableNodeIds.add(nodeId);
      const node = getNodeById(currentGraph, nodeId);
      if (!node) {
        continue;
      }

      for (const successorId of getNodeSuccessorIds(currentGraph, node)) {
        if (!reachableNodeIds.has(successorId)) {
          pendingNodeIds.push(successorId);
        }
      }
    }

    return reachableNodeIds;
  }

  function handleNavigateToStart() {
    if (hasUnsavedChanges && !window.confirm(getFlowDesignerLabel(copy, "변경사항이 저장되지 않았습니다. 다른 화면으로 이동하시겠습니까?"))) {
      return;
    }

    router.push(`/studio/bots/${botId}/versions/${versionId}/intents/${dialogId}`);
  }

  function handleNavigateToDialogList() {
    if (hasUnsavedChanges && !window.confirm(getFlowDesignerLabel(copy, "변경사항이 저장되지 않았습니다. 다른 화면으로 이동하시겠습니까?"))) {
      return;
    }

    router.push(`/studio/bots/${botId}/versions/${versionId}/intents`);
  }

  function handleNavigateToSimulator(utterance?: string) {
    if (!dialog) {
      return;
    }
    if (hasUnsavedChanges && !window.confirm(getFlowDesignerLabel(copy, "변경사항이 저장되지 않았습니다. 저장된 내용 기준으로 테스트 화면을 열겠습니까?"))) {
      return;
    }

    const query = new URLSearchParams({ dialogId: dialog.id });
    if (utterance?.trim()) {
      query.set("q", utterance.trim());
    }
    router.push(`/studio/bots/${botId}/versions/${versionId}/simulator?${query.toString()}`);
  }

  function handleDownloadFlowDesign() {
    if (!graph || !dialog) {
      return;
    }

    downloadDialogFlowGraph(`dialog-flow-${sanitizeDialogFlowFileName(dialog.name)}.json`, graph);
    setFlowMenuOpen(false);
  }

  async function handleUploadFlowDesign(file: File) {
    if (isViewOnly) {
      blockViewOnlyEdit();
      return;
    }

    if (!authSession || !dialog || !graph) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!isDialogFlowImportPayload(parsed)) {
        setMessage("");
        setErrorMessage(getFlowDesignerLabel(copy, "대화설계 파일을 확인해주세요."));
        return;
      }

      const now = new Date().toISOString();
      const nextGraph: DialogFlowGraph = {
        ...graph,
        ...parsed,
        id: graph.id,
        dialogId: dialog.id,
        dialogNo: dialog.dialogNo,
        dialogType: dialog.dialogType,
        name: dialog.name,
        nodes: parsed.nodes as DialogFlowNode[],
        links: parsed.links as DialogFlowLink[],
        updatedAt: now,
        updatedBy: authSession.user.login_id,
      };

      setGraph(nextGraph);
      setSelectedNodeId(nextGraph.nodes.find((node) => !isSystemFlowNode(node))?.id ?? nextGraph.nodes[0]?.id ?? null);
      setSelectedLinkId(null);
      setMultiSelectedNodeIds([]);
      setMultiSelectedLinkIds([]);
      setHasUnsavedChanges(true);
      setMessage(getFlowDesignerLabel(copy, "대화설계 업로드가 반영되었습니다. 저장을 눌러 적용하세요."));
      setErrorMessage("");
    } catch {
      setMessage("");
      setErrorMessage(getFlowDesignerLabel(copy, "대화설계 파일을 확인해주세요."));
    }
  }

  function handleConfirmTalkTemplateSettings(node: Extract<DialogFlowNode, { kind: "talk" }>) {
    if (isViewOnly) {
      blockViewOnlyEdit();
      return;
    }

    const templateRequiredError = getTalkTemplateRequiredError(node);
    if (templateRequiredError) {
      setMessage("");
      setErrorMessage(`'${node.title}' 카드의 ${templateRequiredError}`);
      return;
    }

    updateSelectedNode("talk", (currentNode) => ({
      ...currentNode,
      config: snapshotTalkActiveChannelConfig(currentNode.config),
    }));
    setErrorMessage("");
    setTalkTemplateSettingsOpen(false);
  }

  async function handleSave() {
    if (isViewOnly) {
      setMessage("");
      setErrorMessage(getFlowDesignerLabel(copy, "조회모드에서는 대화 설계를 저장할 수 없습니다."));
      return;
    }
    if (!authSession || !bot?.active_version || !dialog || !graph) {
      router.replace("/login");
      return;
    }

    const designValidationIssues: Array<{ nodeId: string; message: string }> = [];
    const fatalDesignValidationIssues: Array<{ nodeId: string; message: string }> = [];
    const addDesignValidationIssue = (nodeId: string, message: string) => {
      designValidationIssues.push({ nodeId, message });
    };
    const addFatalDesignValidationIssue = (nodeId: string, message: string) => {
      fatalDesignValidationIssues.push({ nodeId, message });
    };
    const nodeExists = (nodeId: string) => graph.nodes.some((item) => item.id === nodeId);
    const entityBindingNames = dialog.entityBindings.map((binding) => binding.variableName);
    const reachableNodeIds = collectReachableNodeIds(graph);
    const usedVariableNames = new Set(
      entityBindingNames.map((item) => stripVariablePrefix(item).toLowerCase()),
    );
    for (const node of graph.nodes) {
      if (!isSystemFlowNode(node) && !reachableNodeIds.has(node.id)) {
        continue;
      }

      if (node.kind === "talk") {
        const targetNodeId = getFlowLinkTargetId(graph, node.id, "next");
        if (!targetNodeId) {
          addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 다음 카드를 연결해주세요.`);
        } else if (!nodeExists(targetNodeId)) {
          addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 다음 연결 대상이 삭제되었습니다.`);
        }

        const templateRequiredError = getTalkTemplateRequiredError(node);
        if (templateRequiredError) {
          addDesignValidationIssue(node.id, `'${node.title}' 카드의 ${templateRequiredError}`);
        }

        if (node.config.responseType === "extract-entity" && node.config.responseEntityBindingIds.length === 0) {
          addDesignValidationIssue(node.id, `'${node.title}' 카드의 추출할 개체를 선택해주세요.`);
        }

        if (node.config.responseType === "extract-entity") {
          for (const extraction of node.config.responseEntityExtractions) {
            const validationError = validateVariableName(extraction.variableName, entityBindingNames);
            if (validationError) {
              addDesignValidationIssue(node.id, `'${node.title}' 카드: ${validationError}`);
            }
          }
        }

        if (
          node.config.responseType === "relay" ||
          node.config.responseType === "single-select" ||
          node.config.responseType === "form-relay"
        ) {
          const validationError = validateVariableName(
            node.config.responseVariableName,
            entityBindingNames,
          );
          if (validationError) {
            addDesignValidationIssue(node.id, `'${node.title}' 카드: ${validationError}`);
          }

        }
      }

      if (node.kind === "jump") {
        if (node.config.targetType === "card" && !node.config.targetCardId) {
          addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 이동 대상 값을 입력해주세요.`);
        } else if (node.config.targetType === "card" && !nodeExists(node.config.targetCardId)) {
          addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 이동 대상이 삭제되었습니다.`);
        }

        if (
          node.config.targetType === "card" &&
          graph.links.some(
            (link) =>
              link.targetNodeId === node.id &&
              link.sourceNodeId === node.config.targetCardId,
          )
        ) {
          addDesignValidationIssue(node.id, `'${node.title}' 카드의 이동 대상이 점프를 호출한 카드와 같습니다.`);
        }

        if (node.config.targetType === "dialog" && !node.config.targetDialogId) {
          addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 이동 대상 값을 입력해주세요.`);
        }

        if (node.config.targetType === "dialog") {
          const targetNodeId = getFlowLinkTargetId(graph, node.id, "next");
          if (!targetNodeId) {
            addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 다음 카드 값을 입력해주세요.`);
          } else if (!nodeExists(targetNodeId)) {
            addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 다음 연결 대상이 삭제되었습니다.`);
          }
        }
      }

      if (node.kind === "condition") {
        if (!stripVariablePrefix(node.config.variableName)) {
          addDesignValidationIssue(node.id, `'${node.title}' 카드의 조건 판단 변수를 입력해주세요.`);
        }

        const linkedBranches = node.config.branches.filter((branch) =>
          getFlowLinkTargetId(graph, node.id, `branch:${branch.id}`),
        );
        const hasElseBranch = linkedBranches.some((branch) => branch.operator === "else");
        if (!hasElseBranch) {
          addDesignValidationIssue(node.id, `'${node.title}' 카드에는 '그 외의 경우' 조건이 1개 이상 필요합니다.`);
        }

        for (const branch of node.config.branches) {
          const optionMeta = getConditionOptionMeta(branch.operator);
          const targetNodeId = getFlowLinkTargetId(graph, node.id, `branch:${branch.id}`);
          const targetExists = targetNodeId ? graph.nodes.some((item) => item.id === targetNodeId) : false;
          if (!targetNodeId) {
            addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 ${branch.label} 다음 카드를 연결해주세요.`);
          } else if (!targetExists) {
            addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 ${branch.label} 연결 대상이 삭제되었습니다.`);
          }
          if (optionMeta.requiresValue && targetNodeId && !branch.compareValue.trim()) {
            addDesignValidationIssue(node.id, `'${node.title}' 카드의 ${branch.label} 비교값을 입력해주세요.`);
          }
        }
      }

      if (node.kind === "variable") {
        const targetNodeId = getFlowLinkTargetId(graph, node.id, "next");
        if (!targetNodeId) {
          addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 다음 카드를 연결해주세요.`);
        } else if (!nodeExists(targetNodeId)) {
          addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 다음 연결 대상이 삭제되었습니다.`);
        }

        for (const item of node.config.items) {
          const validationError = validateVariableName(item.variableName, entityBindingNames);
          if (validationError) {
            addDesignValidationIssue(node.id, `'${node.title}' 카드: ${validationError}`);
          }

          const normalizedName = stripVariablePrefix(item.variableName).toLowerCase();
          if (usedVariableNames.has(normalizedName)) {
            addDesignValidationIssue(node.id, `'${node.title}' 카드에 중복된 변수명이 있습니다.`);
            continue;
          }
          usedVariableNames.add(normalizedName);
        }
      }

      if (node.kind === "function") {
        const functionApi = apiAssets.find((api) => api.id === node.config.apiId) ?? null;
        const functionMethod = functionApi?.methods.find((method) => method.id === node.config.methodId) ?? null;
        if (!node.config.apiId || !node.config.methodId) {
          addDesignValidationIssue(node.id, `'${node.title}' 카드의 API와 Method를 선택해주세요.`);
        }

        const nextTargetNodeId = getFlowLinkTargetId(graph, node.id, "next");
        const exceptionTargetNodeId = getFlowLinkTargetId(graph, node.id, "exception");
        if (!nextTargetNodeId && !exceptionTargetNodeId) {
          addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 실행 이후 이동할 카드를 연결해주세요.`);
        }
        if (nextTargetNodeId && !nodeExists(nextTargetNodeId)) {
          addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 실행 이후 연결 대상이 삭제되었습니다.`);
        }
        if (exceptionTargetNodeId && !nodeExists(exceptionTargetNodeId)) {
          addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 예외 흐름 연결 대상이 삭제되었습니다.`);
        }

        if (functionMethod) {
          for (const parameter of functionMethod.parameters) {
            const mapping = node.config.parameterMappings.find(
              (item) => item.parameterId === parameter.id || item.name === parameter.name,
            );
            const value = mapping?.value ?? parameter.defaultValue;
            if (parameter.required && !value.trim()) {
              addDesignValidationIssue(node.id, `'${node.title}' 카드의 ${parameter.name} 입력값이 없습니다.`);
            }
          }

          if (node.config.outputMappings.length === 0) {
            addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 출력 Parameter를 선택해주세요.`);
          }
        }
      }

      if (node.kind === "script") {
        const targetNodeId = getFlowLinkTargetId(graph, node.id, "next");
        if (!targetNodeId) {
          addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 다음 카드를 연결해주세요.`);
        } else if (!nodeExists(targetNodeId)) {
          addFatalDesignValidationIssue(node.id, `'${node.title}' 카드의 다음 연결 대상이 삭제되었습니다.`);
        }

        if (!node.config.code.trim()) {
          addDesignValidationIssue(node.id, `'${node.title}' 카드의 스크립트 코드를 입력해주세요.`);
        }

        for (const parameter of node.config.parameters) {
          if (!parameter.name.trim()) {
            addDesignValidationIssue(node.id, `'${node.title}' 카드의 파라미터명을 입력해주세요.`);
            continue;
          }

          if (!isScriptIdentifier(parameter.name)) {
            addDesignValidationIssue(node.id, `'${node.title}' 카드의 파라미터명은 JavaScript 변수명 규칙에 맞게 입력해주세요.`);
          }
        }

        for (const returnVariable of node.config.returnVariables) {
          const validationError = validateVariableName(returnVariable.variableName, entityBindingNames);
          if (validationError) {
            addDesignValidationIssue(node.id, `'${node.title}' 카드: ${validationError}`);
          }

          if (!returnVariable.scriptVariableName.trim()) {
            addDesignValidationIssue(node.id, `'${node.title}' 카드의 스크립트 변수명을 입력해주세요.`);
            continue;
          }

          if (!isScriptIdentifier(returnVariable.scriptVariableName)) {
            addDesignValidationIssue(node.id, `'${node.title}' 카드의 스크립트 변수명은 JavaScript 변수명 규칙에 맞게 입력해주세요.`);
          }

          const normalizedName = stripVariablePrefix(returnVariable.variableName).toLowerCase();
          if (usedVariableNames.has(normalizedName)) {
            addDesignValidationIssue(node.id, `'${node.title}' 카드에 중복된 리턴 변수명이 있습니다.`);
            continue;
          }
          usedVariableNames.add(normalizedName);
        }
      }
    }

    const immediateLoopNode = findImmediateLoopNode(graph);
    if (immediateLoopNode) {
      addDesignValidationIssue(
        immediateLoopNode.id,
        `'${immediateLoopNode.title}' 카드가 사용자 입력 없이 반복되는 흐름을 만들고 있습니다.`,
      );
    }

    const nodeWithoutTerminalPath = findNodeWithoutTerminalPath(graph);
    if (nodeWithoutTerminalPath) {
      addDesignValidationIssue(
        nodeWithoutTerminalPath.id,
        `'${nodeWithoutTerminalPath.title}' 카드 흐름이 End 카드로 이어지도록 연결해주세요.`,
      );
    }

    if (fatalDesignValidationIssues.length > 0) {
      const firstIssue = fatalDesignValidationIssues[0];
      setSelectedNodeId(firstIssue.nodeId);
      setMessage("");
      setErrorMessage(
        `저장할 수 없는 설계 오류 ${fatalDesignValidationIssues.length}건이 있습니다. ${firstIssue.message}`,
      );
      return;
    }

    const now = new Date().toISOString();
    const normalizedLinks = graph.links.filter((link) => {
      const sourceNode = getNodeById(graph, link.sourceNodeId);
      return !(sourceNode?.kind === "jump" && link.sourcePort === "jump");
    });
    const graphWithNormalizedLinks = removeUnlinkedConditionBranches({
      ...graph,
      links: normalizedLinks,
    });
    const normalizedGraph: DialogFlowGraph = {
      ...graphWithNormalizedLinks,
      dialogNo: dialog.dialogNo,
      dialogType: dialog.dialogType,
      name: dialog.name,
      updatedAt: now,
      updatedBy: authSession.user.login_id,
      nodes: graphWithNormalizedLinks.nodes.map((node) => {
        if (node.kind === "start") {
          return {
            ...node,
            config: {
              previewUtterance: dialog.utterances[0]?.text || "대화 시작 표현이 없습니다.",
            },
          };
        }

        if (node.kind === "variable") {
          return {
            ...node,
            config: {
              items: node.config.items.map((item) => ({
                ...item,
                variableName: formatVariableName(item.variableName),
                tableColumns: item.tableColumns
                  .map((column) => column.trim().slice(0, 100))
                  .filter((column) => column.length > 0),
              })),
            },
          };
        }

        if (node.kind === "talk") {
          const canLockIntentTransition =
            !dialog.transitionLocked && hasTalkUserResponse(node.config.responseType);
          const normalizedMessageType = isTalkMessageTypeAvailableForBotMode(node.config.messageType, botMode)
            ? node.config.messageType
            : registeredTalkMessageTypeOptions[0]?.value ?? node.config.messageType;
          const activeChannelCodes = new Set(talkTemplateChannelOptions.map((option) => option.value));
          const normalizedTemplateChannel = activeChannelCodes.has(node.config.templateChannel)
            ? node.config.templateChannel
            : talkTemplateChannelOptions[0]?.value ?? node.config.templateChannel;
          const snapshottedConfig = snapshotTalkActiveChannelConfig({
            ...node.config,
            messageType: normalizedMessageType,
            templateChannel: normalizedTemplateChannel,
          });
          const activeChannelTemplates = normalizeTalkChannelTemplateMap(
            Object.fromEntries(
            Object.entries(snapshottedConfig.channelTemplates).filter(([channelCode]) => activeChannelCodes.has(channelCode)),
            ),
            talkTemplates,
            botMode,
          );
          return {
            ...node,
            config: {
              ...snapshottedConfig,
              channelTemplates: activeChannelTemplates,
              responseVariableName: formatVariableName(node.config.responseVariableName),
              responseEntityExtractions: node.config.responseEntityExtractions.map((item) => ({
                ...item,
                variableName: formatVariableName(item.variableName),
              })),
              intentTransitionLocked: canLockIntentTransition
                ? node.config.intentTransitionLocked
                : false,
            },
          };
        }

        if (node.kind === "condition") {
          return {
            ...node,
            config: {
              ...node.config,
              variableName: formatVariableName(node.config.variableName),
            },
          };
        }

        return node;
      }),
    };

    const nextDialog = {
      ...dialog,
      cardCount: countManualFlowCards(normalizedGraph),
      updatedAt: now,
      updatedBy: authSession.user.login_id,
    };
    const nextDialogs = dialogs.map((item) =>
      item.id === dialog.id
        ? nextDialog
        : item,
    );

    let nextDocument = withUpdatedDialogs(versionDocument, nextDialogs);
    nextDocument = putDialogFlowGraph(nextDocument, normalizedGraph);

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await updateStudioBotVersionDialogFlow(
        authSession.access_token,
        bot.id,
        bot.active_version.id,
        dialog.id,
        {
          dialog: nextDialog as unknown as Record<string, unknown>,
          graph: normalizedGraph as unknown as Record<string, unknown>,
        },
      );
      const updatedDocument = {
        ...nextDocument,
        dialogs: normalizeVersionDialogs(response.dialogs),
        dialog_flow_graphs: response.dialog_flow_graphs,
        entities: normalizeVersionEntities(response.entities),
        apis: response.apis,
        system_config: response.system_config,
      };
      const updatedVersion = {
        ...response.version,
        version_json: updatedDocument,
      };
      setBot((current) => (current ? applyUpdatedVersionToBot(current, updatedVersion) : current));
      setGraph(normalizedGraph);
      setHasUnsavedChanges(false);
      if (designValidationIssues.length > 0) {
        const firstIssue = designValidationIssues[0];
        setSelectedNodeId(firstIssue.nodeId);
        setMessage(getFlowDesignerLabel(copy, "대화 설계가 저장되었습니다."));
        setErrorMessage(
          `설계 오류 ${designValidationIssues.length}건이 있습니다. 학습과 실행은 제한됩니다. ${firstIssue.message}`,
        );
      } else {
        setMessage(getFlowDesignerLabel(copy, "대화 설계가 저장되었습니다."));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : getFlowDesignerLabel(copy, "대화 설계를 저장하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="workspace-stack">
        <p className="manual-main__empty">{getFlowDesignerLabel(copy, "대화 설계 화면을 불러오는 중입니다...")}</p>
      </section>
    );
  }

  if (!authSession) {
    return null;
  }

  if (!dialog || !graph) {
    return (
      <section className="workspace-stack">
        <p className="manual-main__empty">{getFlowDesignerLabel(copy, "등록된 의도/모듈을 찾을 수 없습니다.")}</p>
      </section>
    );
  }

  const nodeCount = countManualFlowCards(graph);
  const linkCount = graph.links.length;
  const selectedNodeSourcePort = selectedNode ? getPreferredSourcePort(selectedNode, graph) : null;
  const selectedNodeSupportsException = selectedNode ? supportsExceptionHandling(selectedNode.kind) : false;
  const canvasStageSize = graph.links.reduce(
    (linkSize, link) => {
      return link.waypoints.reduce(
        (size, waypoint) => ({
          width: Math.max(size.width, waypoint.x + CANVAS_STAGE_PADDING),
          height: Math.max(size.height, waypoint.y + CANVAS_STAGE_PADDING),
        }),
        linkSize,
      );
    },
    graph.nodes.reduce(
      (size, node) => {
        const nodeSize = FLOW_NODE_SIZES[node.kind];
        return {
          width: Math.max(size.width, node.position.x + nodeSize.width + CANVAS_STAGE_PADDING),
          height: Math.max(size.height, node.position.y + nodeSize.height + CANVAS_STAGE_PADDING),
        };
      },
      { width: 1, height: 1 },
    ),
  );

  return (
    <section className="flow-designer-page">
      <Script
        src="/vendor/daon-adaptive-card-designer.js"
        strategy="afterInteractive"
        onLoad={() => setAdaptiveCardDesignerReady(true)}
        onReady={() => setAdaptiveCardDesignerReady(true)}
      />
      <header className="flow-designer-page__header">
        <div className="flow-designer-page__title-block">
          <div className="flow-designer-page__title-line">
            <nav className="flow-designer-page__crumb" aria-label={getFlowDesignerLabel(copy, "대화 경로")}>
              <button type="button" onClick={handleNavigateToDialogList}>
                {getFlowDesignerLabel(copy, getDialogTypeLabel(dialog.dialogType))} ({dialog.name})
              </button>
              <span>&gt;</span>
              <button type="button" onClick={handleNavigateToStart}>{getFlowDesignerLabel(copy, "대화 시작")}</button>
              <span>&gt;</span>
              <span className="flow-designer-page__crumb-current">{getFlowDesignerLabel(copy, "대화 설계")}</span>
              <button
                type="button"
                className="flow-designer-page__help"
                aria-label={getFlowDesignerLabel(copy, "대화 설계 안내")}
                title={getFlowDesignerLabel(copy, "대화 설계 안내")}
                onClick={() => setFlowHelpOpen(true)}
              >
                <span className="dialog-help-icon" aria-hidden="true">?</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="flow-designer-page__header-tools">
          <label className="flow-designer-page__search">
            <span>⌕</span>
            <input
              type="text"
              value={canvasSearchKeyword}
              onChange={(event) => setCanvasSearchKeyword(event.target.value)}
              placeholder={getFlowDesignerLabel(copy, "봇 메시지를 검색하세요.")}
            />
          </label>

          <button type="button" className="primary-action flow-designer-page__save" disabled={saving || isViewOnly} onClick={() => void handleSave()}>
            {saving ? getFlowDesignerLabel(copy, "저장 중...") : getFlowDesignerLabel(copy, "저장")}
          </button>

          <div className="flow-designer-page__header-menu" ref={flowMenuRef}>
            <button
              type="button"
              className="flow-designer-page__more-button"
              aria-label={getFlowDesignerLabel(copy, "대화설계 메뉴")}
              aria-expanded={flowMenuOpen}
              disabled={saving || isViewOnly}
              onClick={() => setFlowMenuOpen((current) => !current)}
            >
              ⋮
            </button>
            {flowMenuOpen ? (
              <div className="flow-designer-page__more-menu">
                <button
                  type="button"
                  onClick={() => {
                    setFlowMenuOpen(false);
                    flowUploadInputRef.current?.click();
                  }}
                >{getFlowDesignerLabel(copy, "대화설계 업로드")}</button>
                <button type="button" onClick={handleDownloadFlowDesign}>{getFlowDesignerLabel(copy, "대화설계 다운로드")}</button>
              </div>
            ) : null}
            <input
              ref={flowUploadInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  void handleUploadFlowDesign(file);
                }
              }}
            />
          </div>
        </div>
      </header>

      {errorMessage ? <p className="form-message form-message--error">{errorMessage}</p> : null}
      {editLock.message ? <p className="form-message form-message--error">{editLock.message}</p> : null}
      {message ? <p className="form-message form-message--success">{message}</p> : null}
      {isViewOnly ? (
        <p className="form-message form-message--error">
          {getFlowDesignerLabel(copy, "현재 대화 설계는 조회 모드입니다. 다른 사용자의 편집 잠금이 해제된 뒤 수정할 수 있습니다.")}
        </p>
      ) : null}
      {editLock.conflictOwner ? (
        <ViewModeDialog
          ownerLabel={editLock.conflictOwner}
          copy={copy}
          onCancel={editLock.cancelViewOnly}
          onConfirm={editLock.acceptViewOnly}
        />
      ) : null}

      <div className={`flow-designer-page__layout${inspectorCollapsed ? " is-inspector-collapsed" : ""}`}>
        <div className="flow-designer-page__canvas-panel">
          <div className="flow-designer-page__summary">
            <span>{getFlowDesignerLabel(copy, dialog.dialogType === 1 ? "의도" : "모듈")} {getFlowDesignerLabel(copy, "카드")} {nodeCount}</span>
            <span>{getFlowDesignerLabel(copy, "링크")} {linkCount}</span>
            <span>{getFlowDesignerLabel(copy, "필수 변수 기본 반복")} {versionSettings.conversationDefaults.entityPrompt.maxRepeatCount}</span>
            {linkDragState ? <span className="flow-designer-page__dirty">{getFlowDesignerLabel(copy, "마우스로 다음 카드를 연결 중")}</span> : null}
            {linkingState ? <span className="flow-designer-page__dirty">{getFlowDesignerLabel(copy, "다음 카드를 캔버스에서 선택 중")}</span> : null}
            {hasUnsavedChanges ? <span className="flow-designer-page__dirty">{getFlowDesignerLabel(copy, "저장되지 않은 변경사항")}</span> : null}
          </div>

          <div
            ref={canvasViewportRef}
            className="flow-designer-page__canvas-viewport"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleCanvasDrop}
            onMouseDown={(event) => {
              if (event.button !== 0) {
                return;
              }

              const target = event.target as HTMLElement;
              if (
                target.closest(".flow-designer-page__node-wrap") ||
                target.closest(".flow-designer-page__canvas-link-hit") ||
                target.closest(".flow-designer-page__canvas-link-handle") ||
                target.closest(".flow-designer-page__canvas-link-waypoint")
              ) {
                return;
              }

              const pointer = getCanvasPointerPosition(
                canvasViewportRef.current,
                event.clientX,
                event.clientY,
                canvasScale,
              );
              if (!pointer) {
                return;
              }

              setSelectionBox({ start: pointer, current: pointer });
              setLinkingState(null);
              setLinkDragState(null);
              setSelectedLinkId(null);
              setSelectedLinkHandle(null);
              setSelectedNodeId(null);
              setMultiSelectedNodeIds([]);
              setMultiSelectedLinkIds([]);
              setMessage("");
            }}
            onClick={(event) => {
              if (suppressCanvasClickRef.current) {
                suppressCanvasClickRef.current = false;
                return;
              }

              const target = event.target as HTMLElement;
              if (target.closest(".flow-designer-page__node-wrap")) {
                return;
              }

              setLinkingState(null);
              setLinkDragState(null);
              setSelectedLinkId(null);
              setSelectedLinkHandle(null);
              setMultiSelectedNodeIds([]);
              setMultiSelectedLinkIds([]);
              setMessage("");
              setSelectedNodeId(null);
            }}
          >
            <div
              className="flow-designer-page__canvas-stage"
              style={{
                width: `${canvasStageSize.width * canvasScale}px`,
                height: `${canvasStageSize.height * canvasScale}px`,
              }}
            >
              <div
                className="flow-designer-page__canvas-stage-content"
                style={{
                  width: `${canvasStageSize.width}px`,
                  height: `${canvasStageSize.height}px`,
                  transform: `scale(${canvasScale})`,
                }}
              >
              <svg className="flow-designer-page__canvas-svg" aria-hidden="true">
                <defs>
                  <marker
                    id="flow-link-arrow-default"
                    viewBox="0 0 12 12"
                    refX="10"
                    refY="6"
                    markerWidth="12"
                    markerHeight="12"
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    <path d="M 0 0 L 12 6 L 0 12 z" fill="#a1aebb" />
                  </marker>
                  <marker
                    id="flow-link-arrow-condition"
                    viewBox="0 0 12 12"
                    refX="10"
                    refY="6"
                    markerWidth="12"
                    markerHeight="12"
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    <path d="M 0 0 L 12 6 L 0 12 z" fill="#c48a37" />
                  </marker>
                  <marker
                    id="flow-link-arrow-jump"
                    viewBox="0 0 12 12"
                    refX="10"
                    refY="6"
                    markerWidth="12"
                    markerHeight="12"
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    <path d="M 0 0 L 12 6 L 0 12 z" fill="#5f798f" />
                  </marker>
                  <marker
                    id="flow-link-arrow-exception"
                    viewBox="0 0 12 12"
                    refX="10"
                    refY="6"
                    markerWidth="12"
                    markerHeight="12"
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    <path d="M 0 0 L 12 6 L 0 12 z" fill="#8f96a3" />
                  </marker>
                  <marker
                    id="flow-link-arrow-selected"
                    viewBox="0 0 12 12"
                    refX="10"
                    refY="6"
                    markerWidth="12"
                    markerHeight="12"
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    <path d="M 0 0 L 12 6 L 0 12 z" fill="#4d7fc1" />
                  </marker>
                  <marker
                    id="flow-link-arrow-draft"
                    viewBox="0 0 12 12"
                    refX="10"
                    refY="6"
                    markerWidth="12"
                    markerHeight="12"
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    <path d="M 0 0 L 12 6 L 0 12 z" fill="#4d7fc1" />
                  </marker>
                </defs>

                {graph.links.map((link) => {
                  const sourceNode = getNodeById(graph, link.sourceNodeId);
                  if (sourceNode?.kind === "jump" && link.sourcePort === "jump") {
                    return null;
                  }

                  const source = getNodeSourceAnchor(graph, link);
                  const target = getNodeTargetAnchor(graph, link);
                  if (!source || !target) {
                    return null;
                  }

                  const isSelected = selectedLinkId === link.id || multiSelectedLinkIds.includes(link.id);
                  const endpointDragHandle =
                    selectedLinkHandle &&
                    selectedLinkHandle.linkId === link.id &&
                    selectedLinkHandle.mode !== "waypoint"
                      ? selectedLinkHandle
                      : null;
                  const points = buildLinkPoints(
                    endpointDragHandle?.mode === "source" ? endpointDragHandle.pointer : source,
                    endpointDragHandle?.mode === "target" ? endpointDragHandle.pointer : target,
                    link.waypoints,
                  );
                  const path = getLinkPath(points);
                  const linkLabel = getLinkLabel(graph, link);
                  const labelPosition = getLinkLabelPosition(points);

                  return (
                    <g key={link.id}>
                      <path
                        d={path}
                        className={`flow-designer-page__canvas-link-hit${isSelected ? " is-selected" : ""}`}
                        onMouseDown={(event) => handleLinkPathMouseDown(event, link, points)}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSelectLink(link.id);
                        }}
                      />
                      <path
                        d={path}
                        className={`flow-designer-page__canvas-link flow-designer-page__canvas-link--${link.kind}${link.sourcePort === "exception" ? " flow-designer-page__canvas-link--exception" : ""}${isSelected ? " is-selected" : ""}`}
                        markerEnd={`url(#${getLinkMarkerId(link, isSelected)})`}
                      />
                      {linkLabel ? (
                        <text
                          x={labelPosition.x}
                          y={labelPosition.y - 8}
                          className={`flow-designer-page__canvas-link-label${isSelected ? " is-selected" : ""}`}
                        >
                          {linkLabel}
                        </text>
                      ) : null}
                    </g>
                  );
                })}

                {linkDragState ? (() => {
                  const source = getNodeSourceAnchor(graph, {
                    id: "draft-link",
                    sourceNodeId: linkDragState.sourceNodeId,
                    sourcePort: linkDragState.sourcePort,
                    targetNodeId: linkDragState.sourceNodeId,
                    kind: "default",
                    waypoints: [],
                  });
                  if (!source) {
                    return null;
                  }

                  return (
                    <path
                      d={getLinkPath(buildLinkPoints(source, linkDragState.pointer))}
                      className="flow-designer-page__canvas-link flow-designer-page__canvas-link--draft"
                      markerEnd="url(#flow-link-arrow-draft)"
                    />
                  );
                })() : null}
              </svg>

              {graph.nodes.map((node) => {
                const size = FLOW_NODE_SIZES[node.kind];
                const selected = node.id === selectedNodeId || multiSelectedNodeIds.includes(node.id);
                const isLinkingSource = linkingState?.sourceNodeId === node.id;
                const isSearchMatch = matchingNodeIds.has(node.id);
                const isSelectedLinkSource = selectedLink?.sourceNodeId === node.id;
                const isSelectedLinkDestination = selectedLink?.targetNodeId === node.id;
                const isSelectedLinkTarget =
                  selectedLinkHandle?.mode !== "waypoint" &&
                  selectedLinkHandle?.hoveredTargetNodeId === node.id;
                const isLinkDragTarget =
                  linkDragState?.hoveredTargetNodeId === node.id || isSelectedLinkTarget;
                const preferredSourcePort = getPreferredSourcePort(node, graph);
                const nodeIssues = nodeDesignIssues.get(node.id) ?? [];
                const nodeIssueTitle = nodeIssues.join("\n");

                return (
                  <article
                    key={node.id}
                    data-flow-node-id={node.id}
                    className={`flow-designer-page__node-wrap${selected ? " is-selected" : ""}${isLinkDragTarget ? " is-link-target" : ""}${isSelectedLinkSource ? " is-link-source" : ""}${isSelectedLinkDestination ? " is-link-destination" : ""}`}
                    style={{
                      left: `${node.position.x}px`,
                      top: `${node.position.y}px`,
                    }}
                  >
                    <button
                      type="button"
                      data-flow-node-id={node.id}
                      className={`flow-designer-page__node flow-designer-page__node--${node.kind}${selected ? " is-selected" : ""}${isSearchMatch ? " is-search-match" : ""}${isLinkingSource ? " is-linking-source" : ""}${isLinkDragTarget ? " is-link-target" : ""}${isSelectedLinkSource ? " is-link-source" : ""}${isSelectedLinkDestination ? " is-link-destination" : ""}${nodeIssues.length > 0 ? " is-error" : ""}`}
                      style={{
                        width: `${size.width}px`,
                        minHeight: `${size.height}px`,
                      }}
                      title={nodeIssueTitle || undefined}
                      onMouseDown={(event) => handleNodeDragStart(event, node)}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleNodeSelect(node.id, {
                          debugMode: event.altKey,
                          toggleSelection: event.ctrlKey || event.metaKey,
                        });
                      }}
                    >
                      <span
                        className={`flow-designer-page__node-badge flow-designer-page__node-badge--${node.kind}`}
                        style={{ position: "relative" }}
                      >
                        {renderFlowIcon(node.kind, "badge")}
                        {nodeIssues.length > 0 ? (
                          <span
                            style={{
                              position: "absolute",
                              top: "-6px",
                              right: "-6px",
                              width: "18px",
                              height: "18px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "999px",
                              background: "#b42318",
                              color: "#fff",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            E
                          </span>
                        ) : null}
                      </span>
                      <strong>{node.title}</strong>
                      <small>{FLOW_CARD_LABELS[node.kind]}</small>
                      {nodeIssues.length > 0 ? (
                        <span style={{ color: "#b42318", fontSize: "10px" }}>{nodeIssues[0]}</span>
                      ) : null}
                    </button>

                    {selected && node.id === selectedNodeId && node.kind !== "end" ? (
                      <div className="flow-designer-page__node-actions" onClick={(event) => event.stopPropagation()}>
                        {selectedNodeSourcePort ? (
                          <button
                            type="button"
                            className="flow-designer-page__node-action flow-designer-page__node-action--link"
                            onMouseDown={(event) => handleLinkDragStart(event, node, selectedNodeSourcePort)}
                            onClick={() => handleStartLinkSelection(node, selectedNodeSourcePort)}
                            title={getFlowDesignerLabel(copy, "캔버스에서 다음 카드 선택")}
                            >
                              →
                            </button>
                        ) : null}

                        {selectedNodeSupportsException ? (
                          <button
                            type="button"
                            className="flow-designer-page__node-action flow-designer-page__node-action--exception"
                            onMouseDown={(event) => handleLinkDragStart(event, node, "exception")}
                            onClick={() => handleStartLinkSelection(node, "exception")}
                            title={getFlowDesignerLabel(copy, "예외 카드 연결")}
                          >
                            예
                          </button>
                        ) : null}

                        {PALETTE_ITEMS.map((item) => (
                          <button
                            key={`${node.id}-${item.kind}`}
                            type="button"
                            className={`flow-designer-page__node-action flow-designer-page__node-action--${item.kind}`}
                            onClick={() =>
                              addNode(item.kind, selectedNodeSourcePort ? {
                                sourceNodeId: node.id,
                                sourcePort: selectedNodeSourcePort,
                              } : undefined)
                            }
                            title={`${item.label} 카드 추가`}
                          >
                            {renderFlowIcon(item.kind, "action")}
                          </button>
                        ))}

                        {node.kind !== "start" ? (
                          <button
                            type="button"
                            className="flow-designer-page__node-action flow-designer-page__node-action--delete"
                            onClick={handleDeleteSelectedNode}
                            title={getFlowDesignerLabel(copy, "카드 삭제")}
                          >
                            🗑
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}

              {selectedLinkId ? (() => {
                const link = graph.links.find((item) => item.id === selectedLinkId);
                if (!link) {
                  return null;
                }

                const sourceNode = getNodeById(graph, link.sourceNodeId);
                if (sourceNode?.kind === "jump" && link.sourcePort === "jump") {
                  return null;
                }

                const source = getNodeSourceAnchor(graph, link);
                const target = getNodeTargetAnchor(graph, link);
                if (!source || !target) {
                  return null;
                }

                const endpointDragHandle =
                  selectedLinkHandle &&
                  selectedLinkHandle.linkId === link.id &&
                  selectedLinkHandle.mode !== "waypoint"
                    ? selectedLinkHandle
                    : null;
                const points = buildLinkPoints(
                  endpointDragHandle?.mode === "source" ? endpointDragHandle.pointer : source,
                  endpointDragHandle?.mode === "target" ? endpointDragHandle.pointer : target,
                  link.waypoints,
                );

                return (
                  <svg className="flow-designer-page__canvas-overlay" aria-hidden="true">
                    <circle
                      cx={points[0].x}
                      cy={points[0].y}
                      r={9}
                      className="flow-designer-page__canvas-link-handle"
                      onMouseDown={(event) =>
                        handleLinkHandleMouseDown(event, {
                          linkId: link.id,
                          mode: "source",
                          pointer: points[0],
                          hoveredTargetNodeId: null,
                        })
                      }
                    />
                    <circle
                      cx={points[points.length - 1].x}
                      cy={points[points.length - 1].y}
                      r={9}
                      className="flow-designer-page__canvas-link-handle"
                      onMouseDown={(event) =>
                        handleLinkHandleMouseDown(event, {
                          linkId: link.id,
                          mode: "target",
                          pointer: points[points.length - 1],
                          hoveredTargetNodeId: null,
                        })
                      }
                    />
                    {link.waypoints.map((point, index) => (
                      <circle
                        key={`${link.id}-waypoint-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={8}
                        className={`flow-designer-page__canvas-link-waypoint${selectedLinkHandle?.mode === "waypoint" && selectedLinkHandle.linkId === link.id && selectedLinkHandle.waypointIndex === index ? " is-selected" : ""}`}
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          applyGraphUpdate((current) =>
                            updateLinkInGraph(current, link.id, (item) => ({
                              ...item,
                              waypoints: item.waypoints.filter((_, waypointIndex) => waypointIndex !== index),
                            })),
                          );
                          setSelectedLinkHandle(null);
                        }}
                        onMouseDown={(event) =>
                          handleLinkHandleMouseDown(event, {
                            linkId: link.id,
                            mode: "waypoint",
                            waypointIndex: index,
                            startPointer: point,
                            hasMoved: false,
                          })
                        }
                      />
                    ))}
                  </svg>
                );
              })() : null}
              {selectionBox ? (() => {
                const rect = getRectFromPoints(selectionBox.start, selectionBox.current);
                return (
                  <div
                    className="flow-designer-page__selection-box"
                    style={{
                      left: `${rect.left}px`,
                      top: `${rect.top}px`,
                      width: `${rect.right - rect.left}px`,
                      height: `${rect.bottom - rect.top}px`,
                    }}
                  />
                );
              })() : null}
              </div>
            </div>
          </div>

          <div className="flow-designer-page__canvas-footer">
            <button
              type="button"
              className="flow-designer-page__zoom-button"
              disabled={canvasScalePercent <= CANVAS_MIN_SCALE}
              onClick={() =>
                setCanvasScalePercent((current) => Math.max(CANVAS_MIN_SCALE, current - CANVAS_SCALE_STEP))
              }
            >
              −
            </button>
            <span>{canvasScalePercent}%</span>
            <button
              type="button"
              className="flow-designer-page__zoom-button"
              disabled={canvasScalePercent >= CANVAS_MAX_SCALE}
              onClick={() =>
                setCanvasScalePercent((current) => Math.min(CANVAS_MAX_SCALE, current + CANVAS_SCALE_STEP))
              }
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          className="flow-designer-page__collapse-button"
          onClick={() => setInspectorCollapsed((current) => !current)}
          title={getFlowDesignerLabel(copy, "접기/펼치기")}
          aria-label={getFlowDesignerLabel(copy, "접기/펼치기")}
        >
          {inspectorCollapsed ? "←" : "→"}
        </button>

        <aside className="flow-designer-page__inspector" aria-hidden={inspectorCollapsed}>
          <div className="flow-designer-page__palette-rail">
            {PALETTE_ITEMS.map((item) => (
              <button
                key={`toolbar-${item.kind}`}
                type="button"
                className={`flow-designer-page__rail-button flow-designer-page__rail-button--${item.kind}`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/dialog-flow-kind", item.kind);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                title={item.label}
              >
                {renderFlowIcon(item.kind, "rail")}
              </button>
            ))}
          </div>

          <div className="flow-designer-page__inspector-tabs">
            <button
              type="button"
              className={inspectorTab === "test" ? "is-active" : ""}
              onClick={() => setInspectorTab("test")}
            >{getFlowDesignerLabel(copy, "대화 테스트")}</button>
            <button
              type="button"
              className={inspectorTab === "properties" ? "is-active" : ""}
              onClick={() => setInspectorTab("properties")}
            >{getFlowDesignerLabel(copy, "속성")}</button>
            <button
              type="button"
              className={inspectorTab === "variables" ? "is-active" : ""}
              onClick={() => setInspectorTab("variables")}
            >{getFlowDesignerLabel(copy, "변수")}</button>
          </div>

          {inspectorTab === "test" ? (
            <div className="flow-designer-page__panel-stack">
              <div className="flow-designer-page__test-head">
                <strong>{getFlowDesignerLabel(copy, "대화 테스트")}</strong>
                <button type="button" className="secondary-action" onClick={() => handleNavigateToSimulator()}>{getFlowDesignerLabel(copy, "전체 화면")}</button>
              </div>
              {hasUnsavedChanges ? (
                <p className="flow-designer-page__section-note">{getFlowDesignerLabel(copy, "저장하지 않은 변경사항은 시뮬레이터에 반영되지 않을 수 있습니다.")}</p>
              ) : null}
              <div className="flow-designer-page__embedded-simulator">
                <SimulatorPage
                  key={dialog.id}
                  embedded
                  startDialogId={dialog.id}
                  onClose={() => setInspectorTab("properties")}
                />
              </div>
            </div>
          ) : inspectorTab === "variables" ? (
            <div className="flow-designer-page__panel-stack">
              {flowVariablePanelGroups.map((group) => {
                const totalPages = Math.max(1, Math.ceil(group.rows.length / FLOW_VARIABLE_PANEL_PAGE_SIZE));
                const requestedPage = variablePanelPages[group.key] ?? 1;
                const page = Math.min(Math.max(requestedPage, 1), totalPages);
                const startIndex = (page - 1) * FLOW_VARIABLE_PANEL_PAGE_SIZE;
                const pageRows = group.rows.slice(startIndex, startIndex + FLOW_VARIABLE_PANEL_PAGE_SIZE);
                const movePage = (nextPage: number) => {
                  setVariablePanelPages((current) => ({
                    ...current,
                    [group.key]: Math.min(Math.max(nextPage, 1), totalPages),
                  }));
                };

                return (
                  <div key={group.key} className="flow-designer-page__variable-panel">
                    <strong>{group.title}</strong>
                    {group.rows.length > 0 ? (
                      <>
                        <div
                          className={`flow-designer-page__variable-help-table flow-designer-page__variable-help-table--${group.type}`}
                        >
                          <div className="flow-designer-page__variable-help-row flow-designer-page__variable-help-head">
                            <span>{getFlowDesignerLabel(copy, "변수명")}</span>
                            {group.type === "user" ? (
                              <span>{getFlowDesignerLabel(copy, "설정한 카드")}</span>
                            ) : (
                              <>
                                <span>{getFlowDesignerLabel(copy, "구분")}</span>
                                <span>{getFlowDesignerLabel(copy, "설명")}</span>
                              </>
                            )}
                          </div>
                          {pageRows.map((variable) => (
                            <div
                              key={`${group.key}-${variable.name}`}
                              className="flow-designer-page__variable-help-row"
                            >
                              <span title={variable.name}>{variable.name}</span>
                              {group.type === "user" ? (
                                <span title={variable.cardNames || "-"}>{variable.cardNames || "-"}</span>
                              ) : (
                                <>
                                  <span title={variable.category}>{variable.category}</span>
                                  <span title={variable.description || "-"}>{variable.description || "-"}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flow-designer-page__variable-help-pager">
                          <button
                            type="button"
                            className="flow-designer-page__variable-help-page-button"
                            disabled={page === 1}
                            onClick={() => movePage(1)}
                          >
                            {"|<"}
                          </button>
                          <button
                            type="button"
                            className="flow-designer-page__variable-help-page-button"
                            disabled={page === 1}
                            onClick={() => movePage(page - 1)}
                          >
                            {"<"}
                          </button>
                          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                            <button
                              key={`${group.key}-page-${pageNumber}`}
                              type="button"
                              className={`flow-designer-page__variable-help-page-button${
                                pageNumber === page ? " is-active" : ""
                              }`}
                              onClick={() => movePage(pageNumber)}
                            >
                              {pageNumber}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="flow-designer-page__variable-help-page-button"
                            disabled={page === totalPages}
                            onClick={() => movePage(page + 1)}
                          >
                            {">"}
                          </button>
                          <button
                            type="button"
                            className="flow-designer-page__variable-help-page-button"
                            disabled={page === totalPages}
                            onClick={() => movePage(totalPages)}
                          >
                            {">|"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="flow-designer-page__empty">{getFlowDesignerLabel(copy, "표시할 변수가 없습니다.")}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : selectedNode ? (
            <div className="flow-designer-page__panel-stack">
              <div className="flow-designer-page__inspector-title">
                <span className={`flow-designer-page__panel-icon flow-designer-page__panel-icon--${selectedNode.kind}`}>
                  {renderFlowIcon(selectedNode.kind, "panel")}
                </span>
                <strong>{getFlowDesignerLabel(copy, FLOW_CARD_LABELS[selectedNode.kind])}</strong>
              </div>

              <div className="flow-designer-page__section">
                <div className="flow-designer-page__section-head">
                  <strong>{getFlowDesignerLabel(copy, "카드 이름")}</strong>
                </div>
                <div className="flow-designer-page__section-body">
                  <label className="flow-designer-page__field">
                    <input
                      className="bot-settings-card__input"
                      type="text"
                      value={selectedNode.title}
                      onChange={(event) => updateSelectedNodeTitle(event.target.value)}
                      disabled={selectedNode.kind === "start" || selectedNode.kind === "system-variable"}
                    />
                  </label>
                </div>
              </div>

              {selectedNode.kind === "start" ? (
                <div className="flow-designer-page__section">
                  <div className="flow-designer-page__section-head">
                    <strong>{getFlowDesignerLabel(copy, "대화 시작 카드")}</strong>
                  </div>
                  <div className="flow-designer-page__section-body">
                    <div className="flow-designer-page__readonly-box">{selectedNode.config.previewUtterance}</div>
                  </div>
                </div>
              ) : null}

              {selectedNode.kind === "system-variable" ? (
                <>
                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "기본 변수 카드")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                      <div className="flow-designer-page__chip-list">
                        {dialog.entityBindings.length > 0 ? (
                          dialog.entityBindings.map((binding) => (
                            <span key={binding.id} className="flow-designer-page__chip">
                              {formatVariableName(binding.variableName) || `$${binding.variableName}`}
                            </span>
                          ))
                        ) : (
                          <span className="flow-designer-page__chip">{getFlowDesignerLabel(copy, "등록된 개체 없음")}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>
                        {getFlowDesignerLabel(copy, "다음 카드")} <span className="flow-designer-page__required">*</span>
                      </strong>
                    </div>
                    <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                      <div className="flow-designer-page__link-picker">
                        <select
                          className="bot-settings-card__select"
                          value={getFlowLinkTargetId(graph, selectedNode.id, "next")}
                          onChange={(event) => handleDefaultLinkChange(selectedNode.id, "next", event.target.value)}
                        >
                          <option value=""></option>
                          {connectableNodes.map((node) => (
                            <option key={node.id} value={node.id}>
                              {node.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              {selectedNode.kind === "talk" ? (
                <>
                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "기본 메시지")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body">
                      <label className="flow-designer-page__field">
                        <span>{getFlowDesignerLabel(copy, "랜덤 메시지")}</span>
                      </label>
                      <div className="flow-designer-page__message-list">
                        {selectedNode.config.basicMessages.map((messageValue, index) => (
                          <div key={`${selectedNode.id}-basic-${index}`} className="flow-designer-page__message-item">
                            <div className="flow-designer-page__message-head">
                              <span>메시지 {index + 1}</span>
                              {selectedNode.config.basicMessages.length > 1 ? (
                                <button
                                  type="button"
                                  className="flow-designer-page__text-button"
                                  onClick={() =>
                                    updateSelectedNode("talk", (node) => ({
                                      ...node,
                                      config: {
                                        ...node.config,
                                        basicMessages: node.config.basicMessages.filter(
                                          (_, itemIndex) => itemIndex !== index,
                                        ),
                                      },
                                    }))
                                  }
                                >
                                  삭제
                                </button>
                              ) : null}
                            </div>
                            <textarea
                              className="textarea-control"
                              value={messageValue}
                              onChange={(event) =>
                                updateSelectedNode("talk", (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    basicMessages: node.config.basicMessages.map((item, itemIndex) =>
                                      itemIndex === index ? event.target.value : item,
                                    ),
                                  },
                                }))
                              }
                              placeholder={getFlowDesignerLabel(copy, "텍스트를 입력하세요.")}
                            />
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="secondary-action"
                        disabled={selectedNode.config.basicMessages.length >= 5}
                        onClick={() =>
                          updateSelectedNode("talk", (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              basicMessages: [...node.config.basicMessages, ""],
                            },
                          }))
                        }
                      >
                        + 메시지 추가
                      </button>
                      {botMode === "voice" ? (
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() =>
                            setMessage(
                              versionSettings.conversationDefaults.voice.ttsUrl
                                ? `TTS 테스트 URL: ${versionSettings.conversationDefaults.voice.ttsUrl}`
                                : "TTS 테스트 URL이 설정되어 있지 않습니다.",
                            )
                          }
                        >
                          TTS 테스트
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "템플릿 메시지")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body">
                      <button
                        type="button"
                        className="flow-designer-page__template-settings-button"
                        onClick={() => setTalkTemplateSettingsOpen(true)}
                      >{getFlowDesignerLabel(copy, "템플릿 메시지 설정")}</button>
                    </div>
                  </div>

                  {selectedNode.config.messageType === "text" && talkTemplateSettingsOpen ? (
                    <div
                      className="flow-designer-page__section flow-designer-page__template-dialog"
                      role="dialog"
                      aria-modal="true"
                      aria-label={getFlowDesignerLabel(copy, "템플릿 메시지 설정")}
                    >
                      <div className="flow-designer-page__section-head">
                        <strong>{getFlowDesignerLabel(copy, "템플릿 메시지 설정")}</strong>
                        <button
                          type="button"
                          className="flow-designer-page__template-dialog-close"
                          aria-label={getFlowDesignerLabel(copy, "닫기")}
                          onClick={() => setTalkTemplateSettingsOpen(false)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                        {renderTalkTemplateSettingsIntro(selectedNode)}
                      </div>
                      <div className="flow-designer-page__template-dialog-footer">
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => setTalkTemplateSettingsOpen(false)}
                        >{getFlowDesignerLabel(copy, "취소")}</button>
                        <button
                          type="button"
                          className="flow-designer-page__save"
                          onClick={() => handleConfirmTalkTemplateSettings(selectedNode)}
                        >{getFlowDesignerLabel(copy, "확인")}</button>
                      </div>
                    </div>
                  ) : null}

                  {selectedNode.config.messageType === "table" && talkTemplateSettingsOpen ? (
                    <div
                      className="flow-designer-page__section flow-designer-page__template-dialog"
                      role="dialog"
                      aria-modal="true"
                      aria-label={getFlowDesignerLabel(copy, "템플릿 메시지 설정")}
                    >
                      <div className="flow-designer-page__section-head">
                        <strong>{getFlowDesignerLabel(copy, "템플릿 메시지 설정")}</strong>
                        <button
                          type="button"
                          className="flow-designer-page__template-dialog-close"
                          aria-label={getFlowDesignerLabel(copy, "닫기")}
                          onClick={() => setTalkTemplateSettingsOpen(false)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                        {renderTalkTemplateSettingsIntro(selectedNode, (() => {
                          const selectedTableVariable =
                            tableVariableOptions.find(
                              (option) => option.id === selectedNode.config.tableVariableItemId,
                            ) ?? null;
                          const availableColumns = selectedTableVariable?.columns ?? [];
                          const resolvedMappings = buildTalkTableColumnMappings(
                            availableColumns,
                            selectedNode.config.tableColumnMappings,
                          );

                          return (
                            <>
                              <label className="flow-designer-page__check">
                                <input
                                  type="checkbox"
                                  checked={selectedNode.config.tableUseVariable}
                                  onChange={(event) =>
                                    updateSelectedNode("talk", (node) => ({
                                      ...node,
                                      config: {
                                        ...node.config,
                                        tableUseVariable: event.target.checked,
                                      },
                                    }))
                                  }
                                />
                                <span>{getFlowDesignerLabel(copy, "테이블 변수 사용")}</span>
                              </label>

                              {selectedNode.config.tableUseVariable ? (
                                <>
                                  <label className="flow-designer-page__field">
                                    <span>
                                      {getFlowDesignerLabel(copy, "리스트 변수")}<em className="flow-designer-page__required-mark">*</em>
                                    </span>
                                    <select
                                      className="bot-settings-card__select"
                                      value={selectedNode.config.tableVariableItemId}
                                      onChange={(event) => {
                                        const nextVariable =
                                          tableVariableOptions.find((option) => option.id === event.target.value) ?? null;
                                        const nextColumns = nextVariable?.columns ?? [];
                                        updateSelectedNode("talk", (node) => ({
                                          ...node,
                                          config: {
                                            ...node.config,
                                            tableVariableItemId: event.target.value,
                                            tableKeyColumn: nextColumns[0] ?? "",
                                            tableColumnMappings: buildTalkTableColumnMappings(
                                              nextColumns,
                                              node.config.tableColumnMappings,
                                            ),
                                          },
                                        }));
                                      }}
                                    >
                                      <option value=""></option>
                                      {tableVariableOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                          {option.name} ({option.source})
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label className="flow-designer-page__field">
                                    <span>{getFlowDesignerLabel(copy, "키 값 선택")}</span>
                                    <select
                                      className="bot-settings-card__select"
                                      value={selectedNode.config.tableKeyColumn}
                                      onChange={(event) =>
                                        updateSelectedNode("talk", (node) => ({
                                          ...node,
                                          config: {
                                            ...node.config,
                                            tableKeyColumn: event.target.value,
                                          },
                                        }))
                                      }
                                      disabled={availableColumns.length === 0}
                                    >
                                      <option value=""></option>
                                      {availableColumns.map((column) => (
                                        <option key={`${selectedNode.id}-${column}`} value={column}>
                                          {column}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <div className="flow-designer-page__field">
                                    <span>{getFlowDesignerLabel(copy, "변수 값 선택")}</span>
                                    <div className="flow-designer-page__table-mapping-list">
                                      {availableColumns.length === 0 ? (
                                        <div className="flow-designer-page__readonly-box">{getFlowDesignerLabel(copy, "리스트 변수에 등록된 Column 키값이 없습니다.")}</div>
                                      ) : (
                                        resolvedMappings.map((mapping) => (
                                          <div key={mapping.id} className="flow-designer-page__table-mapping-row">
                                            <div className="flow-designer-page__readonly-box flow-designer-page__readonly-box--compact">
                                              {mapping.column}
                                            </div>
                                            <input
                                              className="bot-settings-card__input"
                                              type="text"
                                              value={mapping.value}
                                              onChange={(event) =>
                                                updateSelectedNode("talk", (node) => ({
                                                  ...node,
                                                  config: {
                                                    ...node.config,
                                                    tableColumnMappings: buildTalkTableColumnMappings(
                                                      availableColumns,
                                                      node.config.tableColumnMappings,
                                                    ).map((item) =>
                                                      item.column === mapping.column
                                                        ? { ...item, value: event.target.value }
                                                        : item,
                                                    ),
                                                  },
                                                }))
                                              }
                                              placeholder={getFlowDesignerLabel(copy, "Column 값을 입력하세요.")}
                                            />
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="flow-designer-page__field">
                                  <span>{getFlowDesignerLabel(copy, "테이블 값 설정")}</span>
                                  <div className="flow-designer-page__manual-table-list">
                                    {selectedNode.config.tableManualRows.map((row, rowIndex) => (
                                      <div key={row.id} className="flow-designer-page__manual-table-row">
                                        <input
                                          className="bot-settings-card__input"
                                          type="text"
                                          value={row.key}
                                          onChange={(event) =>
                                            updateSelectedNode("talk", (node) => ({
                                              ...node,
                                              config: {
                                                ...node.config,
                                                tableManualRows: node.config.tableManualRows.map((item) =>
                                                  item.id === row.id ? { ...item, key: event.target.value } : item,
                                                ),
                                              },
                                            }))
                                          }
                                          placeholder={`키 ${rowIndex + 1}`}
                                        />
                                        <input
                                          className="bot-settings-card__input"
                                          type="text"
                                          value={row.values[0] ?? ""}
                                          onChange={(event) => updateTalkManualTableCell(row.id, 0, event.target.value)}
                                          placeholder={getFlowDesignerLabel(copy, "값 1")}
                                        />
                                        {row.values.slice(1).map((value, valueIndex) => (
                                          <input
                                            key={`${row.id}-value-${valueIndex + 1}`}
                                            className="bot-settings-card__input"
                                            type="text"
                                            value={value}
                                            onChange={(event) =>
                                              updateTalkManualTableCell(row.id, valueIndex + 1, event.target.value)
                                            }
                                            placeholder={`값 ${valueIndex + 2}`}
                                          />
                                        ))}
                                        <button
                                          type="button"
                                          className="flow-designer-page__text-button"
                                          disabled={row.values.length >= 6}
                                          onClick={() =>
                                            updateSelectedNode("talk", (node) => ({
                                              ...node,
                                              config: {
                                                ...node.config,
                                                tableManualRows: node.config.tableManualRows.map((item) =>
                                                  item.id === row.id
                                                    ? { ...item, values: [...item.values, ""] }
                                                    : item,
                                                ),
                                              },
                                            }))
                                          }
                                        >{getFlowDesignerLabel(copy, "값 추가")}</button>
                                        {selectedNode.config.tableManualRows.length > 1 ? (
                                          <button
                                            type="button"
                                            className="flow-designer-page__text-button"
                                            onClick={() =>
                                              updateSelectedNode("talk", (node) => ({
                                                ...node,
                                                config: {
                                                  ...node.config,
                                                  tableManualRows: node.config.tableManualRows.filter(
                                                    (item) => item.id !== row.id,
                                                  ),
                                                },
                                              }))
                                            }
                                          >
                                            삭제
                                          </button>
                                        ) : (
                                          <span />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    className="secondary-action"
                                    onClick={() =>
                                      updateSelectedNode("talk", (node) => ({
                                        ...node,
                                        config: {
                                          ...node.config,
                                          tableManualRows: [
                                            ...node.config.tableManualRows,
                                            { id: crypto.randomUUID(), key: "", values: [""] },
                                          ],
                                        },
                                      }))
                                    }
                                  >{getFlowDesignerLabel(copy, "+ Table Row 추가")}</button>
                                </div>
                              )}
                            </>
                          );
                        })())}
                      </div>
                      <div className="flow-designer-page__template-dialog-footer">
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => setTalkTemplateSettingsOpen(false)}
                        >{getFlowDesignerLabel(copy, "취소")}</button>
                        <button
                          type="button"
                          className="flow-designer-page__save"
                          onClick={() => handleConfirmTalkTemplateSettings(selectedNode)}
                        >{getFlowDesignerLabel(copy, "확인")}</button>
                      </div>
                    </div>
                  ) : null}

                  {selectedNode.config.messageType !== "text" &&
                  selectedNode.config.messageType !== "table" &&
                  talkTemplateSettingsOpen ? (
                    <div
                      className="flow-designer-page__section flow-designer-page__template-dialog"
                      role="dialog"
                      aria-modal="true"
                      aria-label={getFlowDesignerLabel(copy, "템플릿 메시지 설정")}
                    >
                      <div className="flow-designer-page__section-head">
                        <strong>{getFlowDesignerLabel(copy, "템플릿 메시지 설정")}</strong>
                        <button
                          type="button"
                          className="flow-designer-page__template-dialog-close"
                          aria-label={getFlowDesignerLabel(copy, "닫기")}
                          onClick={() => setTalkTemplateSettingsOpen(false)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                        {renderTalkTemplateSettingsIntro(
                          selectedNode,
                          <>
                        {selectedNode.config.messageType === "card" ? (
                          <div className="flow-designer-page__template-fields">
                            <label className="flow-designer-page__field">
                              <span>
                                {getFlowDesignerLabel(copy, "타이틀")}<em className="flow-designer-page__required-mark">*</em>
                              </span>
                              <input
                                className="bot-settings-card__input"
                                type="text"
                                value={selectedNode.config.messages[0] ?? ""}
                                onChange={(event) => updateTalkMessageValue(0, event.target.value)}
                                placeholder={getFlowDesignerLabel(copy, "타이틀을 입력하세요.")}
                              />
                            </label>
                            <label className="flow-designer-page__field">
                              <span>Image URL</span>
                              <input
                                className="bot-settings-card__input"
                                type="text"
                                value={selectedNode.config.messages[1] ?? ""}
                                onChange={(event) => updateTalkMessageValue(1, event.target.value)}
                                placeholder={getFlowDesignerLabel(copy, "이미지 URL을 입력하세요.")}
                              />
                            </label>
                            <label className="flow-designer-page__field">
                              <span>{getFlowDesignerLabel(copy, "상세 설명")}</span>
                              <textarea
                                className="textarea-control"
                                value={selectedNode.config.messages[2] ?? ""}
                                onChange={(event) => updateTalkMessageValue(2, event.target.value)}
                                placeholder={getFlowDesignerLabel(copy, "상세 설명을 입력하세요.")}
                              />
                            </label>
                          </div>
                        ) : null}

                        {selectedNode.config.messageType === "button" ? (
                          <div className="flow-designer-page__message-list">
                            {selectedNode.config.messages.map((messageValue, index) => (
                              <div key={`${selectedNode.id}-button-${index}`} className="flow-designer-page__message-item">
                                <div className="flow-designer-page__message-head">
                                  <span>
                                    Button {index + 1}<em className="flow-designer-page__required-mark">*</em>
                                  </span>
                                  {selectedNode.config.messages.length > 1 ? (
                                    <button
                                      type="button"
                                      className="flow-designer-page__text-button"
                                      onClick={() =>
                                        updateSelectedNode("talk", (node) => ({
                                          ...node,
                                          config: {
                                            ...node.config,
                                            messages: node.config.messages.filter((_, itemIndex) => itemIndex !== index),
                                          },
                                        }))
                                      }
                                    >
                                      삭제
                                    </button>
                                  ) : null}
                                </div>
                                <input
                                  className="bot-settings-card__input"
                                  type="text"
                                  value={messageValue}
                                  onChange={(event) => updateTalkMessageValue(index, event.target.value)}
                                  placeholder={getFlowDesignerLabel(copy, "버튼명을 입력하세요.")}
                                />
                              </div>
                            ))}
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() =>
                                updateSelectedNode("talk", (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    messages: [...node.config.messages, ""],
                                  },
                                }))
                              }
                            >
                              + 입력 추가하기
                            </button>
                          </div>
                        ) : null}

                        {selectedNode.config.messageType === "link-button" ? (
                          <div className="flow-designer-page__link-button-list">
                            <div className="flow-designer-page__link-button-head">
                              <span>
                                Label<em className="flow-designer-page__required-mark">*</em>
                              </span>
                              <span>
                                Link<em className="flow-designer-page__required-mark">*</em>
                              </span>
                              <span />
                            </div>
                            {selectedNode.config.linkButtonItems.map((item) => (
                              <div key={item.id} className="flow-designer-page__link-button-row">
                                <input
                                  className="bot-settings-card__input"
                                  type="text"
                                  value={item.label}
                                  onChange={(event) =>
                                    updateSelectedNode("talk", (node) => ({
                                      ...node,
                                      config: {
                                        ...node.config,
                                        linkButtonItems: node.config.linkButtonItems.map((button) =>
                                          button.id === item.id ? { ...button, label: event.target.value } : button,
                                        ),
                                      },
                                    }))
                                  }
                                  placeholder={getFlowDesignerLabel(copy, "버튼명")}
                                />
                                <input
                                  className="bot-settings-card__input"
                                  type="text"
                                  value={item.url}
                                  onChange={(event) =>
                                    updateSelectedNode("talk", (node) => ({
                                      ...node,
                                      config: {
                                        ...node.config,
                                        linkButtonItems: node.config.linkButtonItems.map((button) =>
                                          button.id === item.id ? { ...button, url: event.target.value } : button,
                                        ),
                                      },
                                    }))
                                  }
                                  placeholder="URL"
                                />
                                {selectedNode.config.linkButtonItems.length > 1 ? (
                                  <button
                                    type="button"
                                    className="flow-designer-page__text-button"
                                    onClick={() =>
                                      updateSelectedNode("talk", (node) => ({
                                        ...node,
                                        config: {
                                          ...node.config,
                                          linkButtonItems: node.config.linkButtonItems.filter(
                                            (button) => button.id !== item.id,
                                          ),
                                        },
                                      }))
                                    }
                                  >
                                    삭제
                                  </button>
                                ) : (
                                  <span />
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() =>
                                updateSelectedNode("talk", (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    linkButtonItems: [
                                      ...node.config.linkButtonItems,
                                      { id: crypto.randomUUID(), label: "", url: "" },
                                    ],
                                  },
                                }))
                              }
                            >
                              + 입력 추가하기
                            </button>
                          </div>
                        ) : null}

                        {selectedNode.config.messageType === "carousel" ? (
                          <div className="flow-designer-page__template-fields">
                            <label className="flow-designer-page__field">
                              <span>
                                Carousel Title<em className="flow-designer-page__required-mark">*</em>
                              </span>
                              <input
                                className="bot-settings-card__input"
                                type="text"
                                value={selectedNode.config.messages[0] ?? ""}
                                onChange={(event) => updateTalkMessageValue(0, event.target.value)}
                                placeholder={getFlowDesignerLabel(copy, "제목을 입력하세요.")}
                              />
                            </label>
                            <div className="flow-designer-page__carousel-settings">
                              <strong>
                                {getFlowDesignerLabel(copy, "Carousel Item 설정")} <span aria-hidden="true">ⓘ</span>
                              </strong>
                              <label className="flow-designer-page__field flow-designer-page__carousel-field">
                                <span>Item Image Url</span>
                                <input
                                  className="bot-settings-card__input"
                                  type="text"
                                  value={selectedNode.config.messages[1] ?? ""}
                                  onChange={(event) => updateTalkMessageValue(1, event.target.value)}
                                />
                              </label>
                              <label className="flow-designer-page__field flow-designer-page__carousel-field">
                                <span>
                                  Item Title<em className="flow-designer-page__required-mark">*</em>
                                </span>
                                <input
                                  className="bot-settings-card__input"
                                  type="text"
                                  value={selectedNode.config.messages[2] ?? ""}
                                  onChange={(event) => updateTalkMessageValue(2, event.target.value)}
                                />
                              </label>
                              <label className="flow-designer-page__field flow-designer-page__carousel-field">
                                <span>
                                  Item Contents<em className="flow-designer-page__required-mark">*</em>
                                </span>
                                <input
                                  className="bot-settings-card__input"
                                  type="text"
                                  value={selectedNode.config.messages[3] ?? ""}
                                  onChange={(event) => updateTalkMessageValue(3, event.target.value)}
                                />
                              </label>
                              <label className="flow-designer-page__field flow-designer-page__carousel-field">
                                <span>Item Button Label</span>
                                <input
                                  className="bot-settings-card__input"
                                  type="text"
                                  value={selectedNode.config.messages[4] ?? ""}
                                  onChange={(event) => updateTalkMessageValue(4, event.target.value)}
                                />
                              </label>
                              <label className="flow-designer-page__field flow-designer-page__carousel-field">
                                <span>Item Button Value</span>
                                <input
                                  className="bot-settings-card__input"
                                  type="text"
                                  value={selectedNode.config.messages[5] ?? ""}
                                  onChange={(event) => updateTalkMessageValue(5, event.target.value)}
                                />
                              </label>
                            </div>
                            <label className="flow-designer-page__field flow-designer-page__carousel-button-type">
                              <span>Button Type</span>
                              <select
                                className="bot-settings-card__select"
                                value={selectedNode.config.messages[6] ?? "Hidden Button"}
                                onChange={(event) => updateTalkMessageValue(6, event.target.value)}
                              >
                                <option value="Hidden Button">Hidden Button</option>
                                <option value="Button">Button</option>
                              </select>
                            </label>
                            <div className="flow-designer-page__carousel-bottom-buttons">
                              <label className="flow-designer-page__field">
                                <span>Button Label</span>
                                <input
                                  className="bot-settings-card__input"
                                  type="text"
                                  value={selectedNode.config.messages[7] ?? ""}
                                  onChange={(event) => updateTalkMessageValue(7, event.target.value)}
                                />
                              </label>
                              <label className="flow-designer-page__field">
                                <span>Button Value</span>
                                <input
                                  className="bot-settings-card__input"
                                  type="text"
                                  value={selectedNode.config.messages[8] ?? ""}
                                  onChange={(event) => updateTalkMessageValue(8, event.target.value)}
                                />
                              </label>
                            </div>
                          </div>
                        ) : null}

                        {selectedNode.config.messageType === "dtmf" ? (
                          <div className="flow-designer-page__dtmf-settings">
                            {[
                              { label: "DTMF 최대 길이", index: 0, value: selectedNode.config.messages[0] || "1" },
                              { label: "DTMF 최소 길이", index: 1, value: selectedNode.config.messages[1] || "1" },
                            ].map((field) => (
                              <label key={field.label} className="flow-designer-page__field flow-designer-page__dtmf-stepper-field">
                                <span>
                                  {field.label}<em className="flow-designer-page__required-mark">*</em>
                                </span>
                                <div className="flow-designer-page__dtmf-stepper">
                                  <button type="button" onClick={() => updateTalkDtmfNumber(field.index, -1)}>
                                    −
                                  </button>
                                  <input
                                    className="bot-settings-card__input"
                                    type="number"
                                    min="1"
                                    value={field.value}
                                    onChange={(event) => updateTalkMessageValue(field.index, event.target.value)}
                                  />
                                  <button type="button" onClick={() => updateTalkDtmfNumber(field.index, 1)}>
                                    +
                                  </button>
                                </div>
                              </label>
                            ))}
                            <label className="flow-designer-page__field flow-designer-page__dtmf-text-field">
                              <span>
                                {getFlowDesignerLabel(copy, "입력 종료 문자")}<em className="flow-designer-page__required-mark">*</em>
                              </span>
                              <input
                                className="bot-settings-card__input"
                                type="text"
                                value={selectedNode.config.messages[2] || "#"}
                                onChange={(event) => updateTalkMessageValue(2, event.target.value)}
                              />
                            </label>
                            {[
                              { label: "최초 입력 대기 시간(100ms)", index: 3, value: selectedNode.config.messages[3] || "10" },
                              { label: "전체 입력 시간(100ms)", index: 4, value: selectedNode.config.messages[4] || "10" },
                            ].map((field) => (
                              <label key={field.label} className="flow-designer-page__field flow-designer-page__dtmf-stepper-field">
                                <span>
                                  {field.label}<em className="flow-designer-page__required-mark">*</em>
                                </span>
                                <div className="flow-designer-page__dtmf-stepper">
                                  <button type="button" onClick={() => updateTalkDtmfNumber(field.index, -1)}>
                                    −
                                  </button>
                                  <input
                                    className="bot-settings-card__input"
                                    type="number"
                                    min="1"
                                    value={field.value}
                                    onChange={(event) => updateTalkMessageValue(field.index, event.target.value)}
                                  />
                                  <button type="button" onClick={() => updateTalkDtmfNumber(field.index, 1)}>
                                    +
                                  </button>
                                </div>
                              </label>
                            ))}
                          </div>
                        ) : null}

                        {["html", "form", "form-a-card"].includes(selectedNode.config.messageType) ? (
                          <div className="flow-designer-page__template-fields">
                            <label className="flow-designer-page__field">
                              <span>
                                {selectedNode.config.messageType === "html"
                                  ? "HTML"
                                  : selectedNode.config.messageType === "form-a-card"
                                      ? "Form(A Card)"
                                      : "Form Message"}
                                <em className="flow-designer-page__required-mark">*</em>
                              </span>
                              {selectedNode.config.messageType === "html" ? (
                                <div className="flow-designer-page__html-editor">
                                  <div className="flow-designer-page__html-editor-toolbar">
                                    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runHtmlEditorCommand("bold")}>
                                      B
                                    </button>
                                    <select
                                      aria-label={getFlowDesignerLabel(copy, "문단")}
                                      defaultValue="div"
                                      onChange={(event) => runHtmlEditorCommand("formatBlock", event.target.value)}
                                    >
                                      <option value="div">Normal</option>
                                      <option value="h1">Header 1</option>
                                      <option value="h2">Header 2</option>
                                      <option value="p">Paragraph</option>
                                    </select>
                                    <select
                                      aria-label={getFlowDesignerLabel(copy, "크기")}
                                      defaultValue="3"
                                      onChange={(event) => runHtmlEditorCommand("fontSize", event.target.value)}
                                    >
                                      <option value="2">T</option>
                                      <option value="3">T.</option>
                                      <option value="4">T..</option>
                                    </select>
                                    <select
                                      aria-label={getFlowDesignerLabel(copy, "글꼴")}
                                      defaultValue=""
                                      onChange={(event) => runHtmlEditorCommand("fontName", event.target.value)}
                                    >
                                      <option value="">Font</option>
                                      <option value="Arial">Arial</option>
                                      <option value="Malgun Gothic">Malgun Gothic</option>
                                      <option value="Times New Roman">Times New Roman</option>
                                    </select>
                                    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runHtmlEditorCommand("foreColor", "#111827")}>
                                      /
                                    </button>
                                    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runHtmlEditorCommand("justifyLeft")}>
                                      ≡
                                    </button>
                                    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runHtmlEditorCommand("createLink", window.prompt("URL") || "")}>
                                      ↗
                                    </button>
                                    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runHtmlEditorCommand("undo")}>
                                      ↶
                                    </button>
                                    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runHtmlEditorCommand("removeFormat")}>
                                      ×
                                    </button>
                                    <button type="button" onMouseDown={(event) => event.preventDefault()}>
                                      ▧
                                    </button>
                                  </div>
                                  <div
                                    ref={htmlEditorRef}
                                    className="flow-designer-page__html-editor-body"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onInput={syncHtmlEditorValue}
                                    onKeyDown={handleHtmlEditorKeyDown}
                                    dangerouslySetInnerHTML={{ __html: selectedNode.config.messages[0] ?? "" }}
                                  />
                                </div>
                              ) : (
                                <textarea
                                  className="textarea-control flow-designer-page__form-message-textarea"
                                  value={selectedNode.config.messages[0] ?? ""}
                                  onChange={(event) => updateTalkMessageValue(0, event.target.value)}
                                  placeholder={getFlowDesignerLabel(copy, "메시지를 입력하세요.")}
                                />
                              )}
                            </label>
                            {selectedNode.config.messageType === "form-a-card" ? (
                              <label className="flow-designer-page__field">
                                <span>MsgKey</span>
                                <textarea
                                  className="textarea-control flow-designer-page__form-a-card-msgkey"
                                  value={selectedNode.config.messages[1] ?? ""}
                                  onChange={(event) => updateTalkMessageValue(1, event.target.value)}
                                  placeholder={getFlowDesignerLabel(copy, "텍스트를 입력하세요.")}
                                />
                              </label>
                            ) : null}
                            {botMode === "voice" ? (
                              <button
                                type="button"
                                className="secondary-action"
                                onClick={() =>
                                  setMessage(
                                    versionSettings.conversationDefaults.voice.ttsUrl
                                      ? `TTS 테스트 URL: ${versionSettings.conversationDefaults.voice.ttsUrl}`
                                      : "TTS 테스트 URL이 설정되어 있지 않습니다.",
                                  )
                                }
                              >
                                TTS 테스트
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                          </>,
                        )}
                      </div>
                      <div className="flow-designer-page__template-dialog-footer">
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => setTalkTemplateSettingsOpen(false)}
                        >{getFlowDesignerLabel(copy, "취소")}</button>
                        <button
                          type="button"
                          className="flow-designer-page__save"
                          onClick={() => handleConfirmTalkTemplateSettings(selectedNode)}
                        >{getFlowDesignerLabel(copy, "확인")}</button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "사용자 응답 처리")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body">
                      <div className="flow-designer-page__response-list">
                        {TALK_RESPONSE_TYPE_OPTIONS.map((option) => (
                          <label key={option.value} className="flow-designer-page__response-item">
                            <span className="flow-designer-page__radio">
                              <input
                                type="radio"
                                checked={selectedNode.config.responseType === option.value}
                                onChange={() => {
                                  updateSelectedNode("talk", (node) => ({
                                    ...node,
                                    config: {
                                      ...node.config,
                                      responseType: option.value,
                                      intentTransitionLocked: hasTalkUserResponse(option.value)
                                        ? node.config.intentTransitionLocked
                                        : false,
                                    },
                                  }));
                                  if (option.value === "extract-entity") {
                                    setEntityExtractionSearchKeyword("");
                                    setEntityExtractionDialogOpen(true);
                                  }
                                }}
                              />
                              <strong>{option.label}</strong>
                            </span>
                          </label>
                        ))}
                      </div>

                      {selectedNode.config.responseType === "relay" ||
                      selectedNode.config.responseType === "single-select" ||
                      selectedNode.config.responseType === "form-relay" ? (
                        <div className="flow-designer-page__subcard">
                          <div className="flow-designer-page__message-head">
                            <strong>{getTalkResponseSettingTitle(selectedNode.config.responseType)}</strong>
                          </div>
                          <label className="flow-designer-page__field">
                            <div className="flow-designer-page__variable-prefix-field">
                              <span aria-hidden="true">$</span>
                              <input
                                className="bot-settings-card__input"
                                type="text"
                                value={stripVariablePrefix(selectedNode.config.responseVariableName)}
                                onChange={(event) =>
                                  updateSelectedNode("talk", (node) => ({
                                    ...node,
                                    config: {
                                      ...node.config,
                                      responseVariableName: stripVariablePrefix(event.target.value),
                                    },
                                  }))
                                }
                                onBlur={() =>
                                  updateSelectedNode("talk", (node) => ({
                                    ...node,
                                    config: {
                                      ...node.config,
                                      responseVariableName: formatVariableName(node.config.responseVariableName),
                                    },
                                  }))
                                }
                                placeholder={getFlowDesignerLabel(copy, "변수명")}
                              />
                            </div>
                          </label>
                          <label className="flow-designer-page__check">
                            <input
                              type="checkbox"
                              checked={selectedNode.config.responseLocal}
                              onChange={(event) =>
                                updateSelectedNode("talk", (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    responseLocal: event.target.checked,
                                  },
                                }))
                              }
                            />
                            <span>{getFlowDesignerLabel(copy, "로컬 변수")}</span>
                          </label>
                        </div>
                      ) : null}

                      {selectedNode.config.responseType === "extract-entity" ? (
                        <div className="flow-designer-page__subcard">
                          <div className="flow-designer-page__message-head">
                            <strong>{getFlowDesignerLabel(copy, "응답 내 개체 추출")}</strong>
                            <button
                              type="button"
                              className="flow-designer-page__text-button"
                              onClick={() => {
                                setEntityExtractionSearchKeyword("");
                                setEntityExtractionDialogOpen(true);
                              }}
                            >
                              상세 설정
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {(() => {
                    const canLockIntentTransition =
                      !dialog.transitionLocked && hasTalkUserResponse(selectedNode.config.responseType);

                    return (
                      <label className="flow-designer-page__setting-toggle">
                        <span>{getFlowDesignerLabel(copy, "의도전환잠금")}</span>
                        <span className="settings-switch">
                          <input
                            type="checkbox"
                            checked={canLockIntentTransition && selectedNode.config.intentTransitionLocked}
                            disabled={!canLockIntentTransition}
                            onChange={(event) =>
                              updateSelectedNode("talk", (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  intentTransitionLocked: event.target.checked,
                                },
                              }))
                            }
                          />
                          <span className="settings-switch__track" />
                        </span>
                      </label>
                    );
                  })()}

                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "최대 반복횟수")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body">
                      <div className="flow-designer-page__toggle-row">
                        <label className="flow-designer-page__radio">
                          <input
                            type="radio"
                            checked={selectedNode.config.repeatType === "bot-setting"}
                            onChange={() =>
                              updateSelectedNode("talk", (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  repeatType: "bot-setting",
                                },
                              }))
                            }
                          />
                          <span>봇 설정값 사용 ({versionSettings.conversationDefaults.entityPrompt.maxRepeatCount}회)</span>
                        </label>
                        <label className="flow-designer-page__radio">
                          <input
                            type="radio"
                            checked={selectedNode.config.repeatType === "custom"}
                            onChange={() =>
                              updateSelectedNode("talk", (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  repeatType: "custom",
                                },
                              }))
                            }
                          />
                          <span>{getFlowDesignerLabel(copy, "직접 설정")}</span>
                        </label>
                      </div>
                      {selectedNode.config.repeatType === "custom" ? (
                        <label className="flow-designer-page__field">
                          <span>{getFlowDesignerLabel(copy, "반복횟수")}</span>
                          <input
                            className="bot-settings-card__input"
                            type="number"
                            min={1}
                            max={99}
                            value={selectedNode.config.repeatCount}
                            onChange={(event) =>
                              updateSelectedNode("talk", (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  repeatCount: Math.max(1, Math.min(99, Number(event.target.value) || 1)),
                                },
                              }))
                            }
                          />
                        </label>
                      ) : null}
                    </div>
                  </div>

                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "플로팅 버튼")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body">
                      <div className="flow-designer-page__toggle-row">
                        {[
                          { value: "disabled", label: "사용 안함" },
                          { value: "bot-setting", label: "봇 설정값 사용" },
                          { value: "custom", label: "직접 설정" },
                        ].map((option) => (
                          <label key={option.value} className="flow-designer-page__radio">
                            <input
                              type="radio"
                              checked={selectedNode.config.floatingButtonMode === option.value}
                              onChange={() =>
                                updateSelectedNode("talk", (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    floatingButtonMode: option.value as "disabled" | "bot-setting" | "custom",
                                  },
                                }))
                              }
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>

                      {selectedNode.config.floatingButtonMode === "custom" ? (
                        <div className="flow-designer-page__floating-button-list">
                          <div className="flow-designer-page__floating-button-head">
                            <span>
                              {getFlowDesignerLabel(copy, "버튼명")}<em className="flow-designer-page__required-mark">*</em>
                            </span>
                            <span>
                              Key<em className="flow-designer-page__required-mark">*</em>
                            </span>
                            <span>{getFlowDesignerLabel(copy, "사용")}</span>
                            <span />
                          </div>
                          {selectedNode.config.floatingButtons.map((button) => (
                            <div key={button.id} className="flow-designer-page__floating-button-row">
                              <input
                                className="bot-settings-card__input"
                                type="text"
                                value={button.label}
                                onChange={(event) =>
                                  updateSelectedNode("talk", (node) => ({
                                    ...node,
                                    config: {
                                      ...node.config,
                                      floatingButtons: node.config.floatingButtons.map((item) =>
                                        item.id === button.id ? { ...item, label: event.target.value } : item,
                                      ),
                                    },
                                  }))
                                }
                                placeholder={getFlowDesignerLabel(copy, "버튼명")}
                              />
                              <input
                                className="bot-settings-card__input"
                                type="text"
                                value={button.key}
                                onChange={(event) =>
                                  updateSelectedNode("talk", (node) => ({
                                    ...node,
                                    config: {
                                      ...node.config,
                                      floatingButtons: node.config.floatingButtons.map((item) =>
                                        item.id === button.id ? { ...item, key: event.target.value } : item,
                                      ),
                                    },
                                  }))
                                }
                                placeholder="Key"
                              />
                              <label className="flow-designer-page__table-switch settings-switch" aria-label={getFlowDesignerLabel(copy, "사용")}>
                                <input
                                  type="checkbox"
                                  checked={button.enabled}
                                  onChange={(event) =>
                                    updateSelectedNode("talk", (node) => ({
                                      ...node,
                                      config: {
                                        ...node.config,
                                        floatingButtons: node.config.floatingButtons.map((item) =>
                                          item.id === button.id ? { ...item, enabled: event.target.checked } : item,
                                        ),
                                      },
                                    }))
                                  }
                                />
                                <span className="settings-switch__track" />
                              </label>
                              <button
                                type="button"
                                className="flow-designer-page__text-button"
                                onClick={() =>
                                  updateSelectedNode("talk", (node) => ({
                                    ...node,
                                    config: {
                                      ...node.config,
                                      floatingButtons: node.config.floatingButtons.filter(
                                        (item) => item.id !== button.id,
                                      ),
                                    },
                                  }))
                                }
                              >
                                삭제
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() =>
                              updateSelectedNode("talk", (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  floatingButtons: [
                                    ...node.config.floatingButtons,
                                    { id: crypto.randomUUID(), label: "", key: "", enabled: true },
                                  ],
                                },
                              }))
                            }
                          >
                            + 플로팅 버튼 추가
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "다음 카드")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body">
                      <div className="flow-designer-page__link-picker">
                        <select
                          className="bot-settings-card__select"
                          value={getFlowLinkTargetId(graph, selectedNode.id, "next")}
                          onChange={(event) => handleDefaultLinkChange(selectedNode.id, "next", event.target.value)}
                        >
                          <option value=""></option>
                          {connectableNodes.map((node) => (
                            <option key={node.id} value={node.id}>
                              {node.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              {selectedNode.kind === "jump" ? (
                <>
                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "이동 설정")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                      <div className="flow-designer-page__toggle-row">
                        <label className="flow-designer-page__radio">
                          <input
                            name={`${selectedNode.id}-jump-target-type`}
                            type="radio"
                            checked={selectedNode.config.targetType === "card"}
                            onChange={() => {
                              applyGraphUpdate((current) => ({
                                ...current,
                                links: current.links.filter(
                                  (link) => !(link.sourceNodeId === selectedNode.id && link.sourcePort === "next"),
                                ),
                                nodes: current.nodes.map((node) =>
                                  node.id === selectedNode.id && node.kind === "jump"
                                    ? {
                                        ...node,
                                        config: {
                                          ...node.config,
                                          targetType: "card",
                                          targetDialogId: "",
                                          targetDialogName: "",
                                          targetCardId: "",
                                        },
                                      }
                                    : node,
                                ),
                              }));
                              setJumpCardPickerOpen(false);
                              setJumpCardSearchKeyword("");
                              setJumpDialogPickerOpen(false);
                              setJumpDialogSearchKeyword("");
                            }}
                          />
                          <span>{getFlowDesignerLabel(copy, "이 대화의 카드")}</span>
                        </label>
                        <label className="flow-designer-page__radio">
                          <input
                            name={`${selectedNode.id}-jump-target-type`}
                            type="radio"
                            checked={selectedNode.config.targetType === "dialog"}
                            onChange={() => {
                              applyGraphUpdate((current) => ({
                                ...current,
                                links: current.links.filter(
                                  (link) => !(link.sourceNodeId === selectedNode.id && link.sourcePort === "jump"),
                                ),
                                nodes: current.nodes.map((node) =>
                                  node.id === selectedNode.id && node.kind === "jump"
                                    ? {
                                        ...node,
                                        config: {
                                          ...node.config,
                                          targetType: "dialog",
                                          targetCardId: "",
                                        },
                                      }
                                    : node,
                                ),
                              }));
                              setJumpCardPickerOpen(false);
                              setJumpCardSearchKeyword("");
                            }}
                          />
                          <span>{getFlowDesignerLabel(copy, "다른 대화")}</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "이동 대상")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                      {selectedNode.config.targetType === "card" ? (
                        <label className="flow-designer-page__field">
                          <span>{getFlowDesignerLabel(copy, "카드")}<span className="flow-designer-page__required">*</span>
                          </span>
                          <div className="flow-designer-page__dialog-target-picker">
                            <input
                              className="bot-settings-card__input flow-designer-page__dialog-target-display"
                              type="text"
                              value={getNodeById(graph, selectedNode.config.targetCardId)?.title ?? ""}
                              readOnly
                              placeholder={getFlowDesignerLabel(copy, "카드를 선택하세요.")}
                              onClick={() => {
                                setJumpCardSearchKeyword("");
                                setJumpCardPickerOpen(true);
                              }}
                            />
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() => {
                                setJumpCardSearchKeyword("");
                                setJumpCardPickerOpen(true);
                              }}
                            >
                              카드 목록
                            </button>
                          </div>
                        </label>
                      ) : (
                        <>
                          <label className="flow-designer-page__field">
                            <span>
                              {getFlowDesignerLabel(copy, "의도/모듈")} <span className="flow-designer-page__required">*</span>
                            </span>
                            <div className="flow-designer-page__dialog-target-picker">
                              <input
                                className="bot-settings-card__input flow-designer-page__dialog-target-display"
                                type="text"
                                value={selectedNode.config.targetDialogName}
                                readOnly
                                placeholder={getFlowDesignerLabel(copy, "의도/모듈을 선택하세요.")}
                                onClick={() => {
                                  setJumpDialogSearchKeyword("");
                                  setJumpDialogPickerOpen(true);
                                }}
                              />
                              <button
                                type="button"
                                className="secondary-action"
                                onClick={() => {
                                  setJumpDialogSearchKeyword("");
                                  setJumpDialogPickerOpen(true);
                                }}
                              >
                                의도/모듈 목록
                              </button>
                            </div>
                          </label>
                          <label className="flow-designer-page__field">
                            <span>
                              {getFlowDesignerLabel(copy, "다음 카드")} <span className="flow-designer-page__required">*</span>
                            </span>
                            <div className="flow-designer-page__link-picker">
                              <select
                                className="bot-settings-card__select"
                                value={getFlowLinkTargetId(graph, selectedNode.id, "next")}
                                onChange={(event) =>
                                  handleDefaultLinkChange(selectedNode.id, "next", event.target.value)
                                }
                              >
                                <option value=""></option>
                                {connectableNodes.map((node) => (
                                  <option key={node.id} value={node.id}>
                                    {node.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : null}

              {selectedNode.kind === "condition" ? (
                <>
                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "조건")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body">
                      <div className="flow-designer-page__condition-config">
                        <label className="flow-designer-page__field">
                          <span>
                            {getFlowDesignerLabel(copy, "변수명")} <span className="flow-designer-page__required">*</span>
                          </span>
                          <div className="flow-designer-page__variable-prefix-field">
                            <span aria-hidden="true">$</span>
                            <input
                              className="bot-settings-card__input"
                              type="text"
                              value={stripVariablePrefix(selectedNode.config.variableName)}
                              onChange={(event) =>
                                updateSelectedNode("condition", (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    variableName: stripVariablePrefix(event.target.value),
                                  },
                                }))
                              }
                              onBlur={() =>
                                updateSelectedNode("condition", (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    variableName: formatVariableName(node.config.variableName),
                                  },
                                }))
                              }
                              placeholder={getFlowDesignerLabel(copy, "변수명")}
                            />
                          </div>
                        </label>

                        <label className="flow-designer-page__check flow-designer-page__check--inline">
                          <input
                            type="checkbox"
                            checked={selectedNode.config.hideLabels}
                            onChange={(event) =>
                              updateSelectedNode("condition", (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  hideLabels: event.target.checked,
                                },
                              }))
                            }
                          />
                          <span>{getFlowDesignerLabel(copy, "라벨 숨기기")}</span>
                        </label>
                      </div>

                      <div className="flow-designer-page__condition-table">
                        <div className="flow-designer-page__condition-head">
                          <span>{getFlowDesignerLabel(copy, "비교값")}</span>
                          <span>{getFlowDesignerLabel(copy, "조건")}</span>
                          <span>
                            {getFlowDesignerLabel(copy, "다음 카드")} <span className="flow-designer-page__required">*</span>
                          </span>
                        </div>
                        {visibleConditionBranches.map((branch) => {
                          const optionMeta = getConditionOptionMeta(branch.operator);
                          const targetNodeId = getFlowLinkTargetId(graph, selectedNode.id, `branch:${branch.id}`);
                          return (
                            <div key={branch.id} className="flow-designer-page__condition-row">
                              {optionMeta.requiresValue ? (
                                <input
                                  className="bot-settings-card__input"
                                  type="text"
                                  value={branch.compareValue}
                                  onChange={(event) =>
                                    updateSelectedNode("condition", (node) => ({
                                      ...node,
                                      config: {
                                        ...node.config,
                                        branches: node.config.branches.map((item) =>
                                          item.id === branch.id
                                            ? { ...item, compareValue: event.target.value }
                                            : item,
                                        ),
                                      },
                                    }))
                                  }
                                  placeholder={getFlowDesignerLabel(copy, "비교값")}
                                />
                              ) : (
                                <div className="flow-designer-page__readonly-box flow-designer-page__readonly-box--compact flow-designer-page__readonly-box--no-input">{getFlowDesignerLabel(copy, "입력 없음")}</div>
                              )}

                              <select
                                className="bot-settings-card__select"
                                value={branch.operator}
                                onChange={(event) =>
                                  updateSelectedNode("condition", (node) => {
                                    const nextOperator = event.target.value as typeof branch.operator;
                                    const filteredBranches = node.config.branches.filter((item) => item.id !== branch.id);
                                    const nextBranch =
                                      nextOperator === "else"
                                        ? {
                                            ...branch,
                                            label: "기본",
                                            operator: "else" as const,
                                            compareValue: "",
                                          }
                                        : {
                                            ...branch,
                                            label: branch.label,
                                            operator: nextOperator,
                                          };

                                    const nextBranches = [...filteredBranches, nextBranch];
                                    let regularIndex = 0;

                                    return {
                                      ...node,
                                      config: {
                                        ...node.config,
                                        branches: nextBranches.map((item) => {
                                          if (item.operator === "else") {
                                            return { ...item, label: "기본", compareValue: "" };
                                          }

                                          regularIndex += 1;
                                          return { ...item, label: `조건 ${regularIndex}` };
                                        }),
                                      },
                                    };
                                  })
                                }
                              >
                                {CONDITION_OPERATOR_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>

                              <div className="flow-designer-page__condition-target">
                                <div className="flow-designer-page__link-picker">
                                  <select
                                    className="bot-settings-card__select"
                                    value={targetNodeId}
                                    onChange={(event) =>
                                      handleDefaultLinkChange(
                                        selectedNode.id,
                                        `branch:${branch.id}`,
                                        event.target.value,
                                      )
                                    }
                                  >
                                    <option value=""></option>
                                    {connectableNodes.map((node) => (
                                      <option key={node.id} value={node.id}>
                                        {node.title}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              {selectedNode.kind === "variable" ? (
                <>
                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "변수 설정")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                      <div className="flow-designer-page__variable-table">
                        <div className="flow-designer-page__variable-table-head">
                          <span>
                            {getFlowDesignerLabel(copy, "변수명")} <span className="flow-designer-page__required">*</span>
                            <button
                              type="button"
                              className={`flow-designer-page__sort-button flow-designer-page__sort-button--${variableSortOrder}`}
                              aria-label={getFlowDesignerLabel(copy, "변수명 정렬")}
                              onClick={() =>
                                setVariableSortOrder((current) =>
                                  current === "default" ? "asc" : current === "asc" ? "desc" : "default",
                                )
                              }
                            >
                              ⇅
                            </button>
                          </span>
                          <span>{getFlowDesignerLabel(copy, "변수값")}</span>
                          <span>{getFlowDesignerLabel(copy, "테이블 사용")}</span>
                          <span>{getFlowDesignerLabel(copy, "로컬 변수")}</span>
                          <span className="flow-designer-page__variable-table-action-head" />
                        </div>
                        {sortedSelectedVariableItems.map((item) => (
                          <div key={item.id} className="flow-designer-page__variable-table-entry">
                            <div className="flow-designer-page__variable-table-row">
                              <div className="flow-designer-page__variable-prefix-field flow-designer-page__variable-prefix-field--table">
                                <span aria-hidden="true">$</span>
                                <input
                                  className="bot-settings-card__input"
                                  type="text"
                                  value={stripVariablePrefix(item.variableName)}
                                  onChange={(event) =>
                                    updateSelectedNode("variable", (node) => ({
                                      ...node,
                                      config: {
                                        items: node.config.items.map((entry) =>
                                          entry.id === item.id
                                            ? { ...entry, variableName: stripVariablePrefix(event.target.value) }
                                            : entry,
                                        ),
                                      },
                                    }))
                                  }
                                  onBlur={() =>
                                    updateSelectedNode("variable", (node) => ({
                                      ...node,
                                      config: {
                                        items: node.config.items.map((entry) =>
                                          entry.id === item.id
                                            ? { ...entry, variableName: formatVariableName(entry.variableName) }
                                            : entry,
                                        ),
                                      },
                                    }))
                                  }
                                  placeholder={getFlowDesignerLabel(copy, "변수를 입력하세요.")}
                                />
                              </div>
                              <input
                                className="bot-settings-card__input"
                                type="text"
                                value={item.value}
                                onChange={(event) =>
                                  updateSelectedNode("variable", (node) => ({
                                    ...node,
                                    config: {
                                      items: node.config.items.map((entry) =>
                                        entry.id === item.id
                                          ? { ...entry, value: event.target.value }
                                          : entry,
                                      ),
                                    },
                                  }))
                                }
                                placeholder={getFlowDesignerLabel(copy, "변수값을 입력하세요.")}
                              />
                              <label className="flow-designer-page__table-switch settings-switch" aria-label={getFlowDesignerLabel(copy, "테이블 사용")}>
                                <input
                                  type="checkbox"
                                  checked={item.tableEnabled}
                                  onChange={(event) =>
                                    updateSelectedNode("variable", (node) => ({
                                      ...node,
                                      config: {
                                        items: node.config.items.map((entry) =>
                                          entry.id === item.id
                                            ? { ...entry, tableEnabled: event.target.checked }
                                            : entry,
                                        ),
                                      },
                                    }))
                                  }
                                />
                                <span className="settings-switch__track" />
                              </label>
                              <label className="flow-designer-page__table-switch settings-switch" aria-label={getFlowDesignerLabel(copy, "로컬 변수")}>
                                <input
                                  type="checkbox"
                                  checked={item.local}
                                  onChange={(event) =>
                                    updateSelectedNode("variable", (node) => ({
                                      ...node,
                                      config: {
                                        items: node.config.items.map((entry) =>
                                          entry.id === item.id
                                            ? { ...entry, local: event.target.checked }
                                            : entry,
                                        ),
                                      },
                                    }))
                                  }
                                />
                                <span className="settings-switch__track" />
                              </label>
                              <div className="flow-designer-page__variable-table-action">
                                {selectedNode.config.items.length > 1 ? (
                                  <button
                                    type="button"
                                    className="flow-designer-page__text-button"
                                    onClick={() =>
                                      updateSelectedNode("variable", (node) => ({
                                        ...node,
                                        config: {
                                          items: node.config.items.filter((entry) => entry.id !== item.id),
                                        },
                                      }))
                                    }
                                  >
                                    삭제
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            {item.tableEnabled ? (
                              <div className="flow-designer-page__variable-column-panel">
                                <div className="flow-designer-page__variable-column-tags">
                                  {item.tableColumns.map((column, columnIndex) => (
                                    <span key={`${item.id}-${column}-${columnIndex}`} className="flow-designer-page__variable-column-tag">
                                      <span>{column}</span>
                                      <button
                                        type="button"
                                        className="flow-designer-page__variable-column-tag-button"
                                        onClick={() => editVariableColumn(item.id, columnIndex)}
                                        aria-label={`${column} 키값 수정`}
                                      >
                                        ✎
                                      </button>
                                      <button
                                        type="button"
                                        className="flow-designer-page__variable-column-tag-button"
                                        onClick={() => removeVariableColumn(item.id, columnIndex)}
                                        aria-label={`${column} 키값 삭제`}
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                <input
                                  className="bot-settings-card__input"
                                  type="text"
                                  value={variableColumnDrafts[item.id] ?? ""}
                                  onChange={(event) => updateVariableColumnDraft(item.id, event.target.value.slice(0, 100))}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      commitVariableColumn(item.id);
                                    }
                                  }}
                                  onBlur={() => commitVariableColumn(item.id)}
                                  placeholder={getFlowDesignerLabel(copy, "키값을 입력하세요. 엔터키로 구분됩니다.(최대 100자)")}
                                />
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() =>
                          updateSelectedNode("variable", (node) => ({
                            ...node,
                            config: {
                              items: [
                                ...node.config.items,
                                {
                                  id: crypto.randomUUID(),
                                  variableName: "",
                                  value: "",
                                  tableEnabled: false,
                                  tableColumns: [],
                                  local: false,
                                },
                              ],
                            },
                          }))
                        }
                      >
                        변수 추가하기
                      </button>
                    </div>
                  </div>

                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "흐름 설정")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                      <label className="flow-designer-page__field">
                        <span>
                          {getFlowDesignerLabel(copy, "다음 카드")} <span className="flow-designer-page__required">*</span>
                        </span>
                        <div className="flow-designer-page__link-picker">
                          <select
                            className="bot-settings-card__select"
                            value={getFlowLinkTargetId(graph, selectedNode.id, "next")}
                            onChange={(event) => handleDefaultLinkChange(selectedNode.id, "next", event.target.value)}
                          >
                            <option value=""></option>
                            {connectableNodes.map((node) => (
                              <option key={node.id} value={node.id}>
                                {node.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      </label>

                      <label className="flow-designer-page__field">
                        <span>{getFlowDesignerLabel(copy, "예외")}</span>
                        <div className="flow-designer-page__link-picker">
                          <select
                            className="bot-settings-card__select"
                            value={getFlowLinkTargetId(graph, selectedNode.id, "exception")}
                            onChange={(event) => handleDefaultLinkChange(selectedNode.id, "exception", event.target.value)}
                          >
                            <option value="">{getFlowDesignerLabel(copy, "연결 안 함")}</option>
                            {connectableNodes.map((node) => (
                              <option key={node.id} value={node.id}>
                                {node.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      </label>
                    </div>
                  </div>
                </>
              ) : null}

              {selectedNode.kind === "function" ? (
                <>
                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "API 속성")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                      <div className="flow-designer-page__function-api-summary">
                        <span className="flow-designer-page__function-api-label">API</span>
                        <button
                          type="button"
                          className="flow-designer-page__function-api-select"
                          onClick={openFunctionPicker}
                        >{getFlowDesignerLabel(copy, "API 선택")}</button>
                        <div>
                          <span>{getFlowDesignerLabel(copy, "API 이름")}</span>
                          <strong>{selectedFunctionApi?.name || "선택 안 함"}</strong>
                        </div>
                        <div>
                          <span>{getFlowDesignerLabel(copy, "API 메서드")}</span>
                          <strong>
                            {selectedFunctionMethod
                              ? `${selectedFunctionMethod.name} (${selectedFunctionMethod.httpMethod})`
                              : "선택 안 함"}
                          </strong>
                        </div>
                      </div>

                      {selectedFunctionMethod ? (
                        <div className="flow-designer-page__function-config">
                          <strong className="flow-designer-page__function-subtitle">{getFlowDesignerLabel(copy, "입력 Parameter 변수")}</strong>
                          <div className="flow-designer-page__script-table">
                            <div className="flow-designer-page__script-table-head">
                              <span>{getFlowDesignerLabel(copy, "이름")}</span>
                              <span>{getFlowDesignerLabel(copy, "Data 타입")}</span>
                              <span>{getFlowDesignerLabel(copy, "변수 정의")}</span>
                            </div>
                            {selectedFunctionMethod.parameters.length > 0 ? (
                              selectedFunctionMethod.parameters.map((parameter) => {
                                const mapping =
                                  selectedNode.config.parameterMappings.find(
                                    (item) => item.parameterId === parameter.id || item.name === parameter.name,
                                  ) ?? {
                                    id: crypto.randomUUID(),
                                    parameterId: parameter.id,
                                    name: parameter.name,
                                    value: parameter.defaultValue,
                                  };
                                const mappingValue = mapping.value || parameter.defaultValue;

                                return (
                                  <div key={parameter.id} className="flow-designer-page__script-table-row">
                                    <span className="flow-designer-page__parameter-name">
                                      {parameter.name || "-"}
                                      {parameter.required ? <span className="flow-designer-page__required">*</span> : null}
                                    </span>
                                    <span>{parameter.dataType}</span>
                                    <input
                                      className="bot-settings-card__input"
                                      type="text"
                                      value={mappingValue}
                                      placeholder={parameter.defaultValue || "$변수명"}
                                      onChange={(event) =>
                                        updateSelectedNode("function", (node) => {
                                          const exists = node.config.parameterMappings.some(
                                            (item) => item.parameterId === parameter.id || item.name === parameter.name,
                                          );
                                          const nextMapping = {
                                            id: mapping.id,
                                            parameterId: parameter.id,
                                            name: parameter.name,
                                            value: event.target.value,
                                          };
                                          return {
                                            ...node,
                                            config: {
                                              ...node.config,
                                              parameterMappings: exists
                                                ? node.config.parameterMappings.map((item) =>
                                                    item.parameterId === parameter.id || item.name === parameter.name
                                                      ? nextMapping
                                                      : item,
                                                  )
                                                : [...node.config.parameterMappings, nextMapping],
                                            },
                                          };
                                        })
                                      }
                                    />
                                  </div>
                                );
                              })
                            ) : (
                              <p className="flow-designer-page__section-note">{getFlowDesignerLabel(copy, "등록된 입력 Parameter가 없습니다.")}</p>
                            )}
                          </div>

                          <strong className="flow-designer-page__function-subtitle">{getFlowDesignerLabel(copy, "출력 Parameter 변수")}</strong>
                          <div className="flow-designer-page__function-output-table">
                            <div className="flow-designer-page__function-output-head">
                              <span>{getFlowDesignerLabel(copy, "이름")}</span>
                              <span>{getFlowDesignerLabel(copy, "Data 타입")}</span>
                              <span>{getFlowDesignerLabel(copy, "변수 정의")}</span>
                              <span>{getFlowDesignerLabel(copy, "로컬변수")}</span>
                            </div>
                            {getSelectedFunctionOutputMappings(
                              selectedFunctionMethod,
                              selectedNode.config.outputMappings,
                              selectedNode.config.resultVariableName,
                              selectedNode.config.outputSchema,
                            ).map((mapping) => (
                              <div key={mapping.parameterId} className="flow-designer-page__function-output-row">
                                <span className="flow-designer-page__parameter-name">{mapping.name || mapping.path}</span>
                                <span>{mapping.dataType}</span>
                                <div className="flow-designer-page__variable-prefix-field">
                                  <span>$</span>
                                  <input
                                    className="bot-settings-card__input"
                                    type="text"
                                    value={stripVariablePrefix(mapping.variableName)}
                                    placeholder={getFlowDesignerLabel(copy, "변수명")}
                                    onChange={(event) =>
                                      updateSelectedNode("function", (node) => ({
                                        ...node,
                                        config: {
                                          ...node.config,
                                          resultVariableName:
                                            mapping.path === "root" ? event.target.value : node.config.resultVariableName,
                                          outputMappings: buildFunctionOutputMappings(
                                            selectedFunctionMethod,
                                            node.config.outputMappings,
                                            node.config.resultVariableName,
                                          ).map((item) =>
                                            item.parameterId === mapping.parameterId
                                              ? { ...item, variableName: event.target.value }
                                              : item,
                                          ),
                                        },
                                      }))
                                    }
                                    onBlur={() =>
                                      updateSelectedNode("function", (node) => ({
                                        ...node,
                                        config: {
                                          ...node.config,
                                          outputMappings: node.config.outputMappings.map((item) =>
                                            item.parameterId === mapping.parameterId
                                              ? { ...item, variableName: stripVariablePrefix(item.variableName) }
                                              : item,
                                          ),
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <label className="flow-designer-page__check">
                                  <input
                                    type="checkbox"
                                    checked={mapping.local}
                                    onChange={(event) =>
                                      updateSelectedNode("function", (node) => ({
                                        ...node,
                                        config: {
                                          ...node.config,
                                          outputMappings: buildFunctionOutputMappings(
                                            selectedFunctionMethod,
                                            node.config.outputMappings,
                                            node.config.resultVariableName,
                                          ).map((item) =>
                                            item.parameterId === mapping.parameterId
                                              ? { ...item, local: event.target.checked }
                                              : item,
                                          ),
                                        },
                                      }))
                                    }
                                  />
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="flow-designer-page__section-note">{getFlowDesignerLabel(copy, "API와 Method를 선택하세요.")}</p>
                      )}
                    </div>
                  </div>

                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "다음 카드")} <span className="flow-designer-page__required">*</span></strong>
                    </div>
                    <div className="flow-designer-page__section-body">
                      <div className="flow-designer-page__link-picker">
                        <select
                          className="bot-settings-card__select"
                          value={getFlowLinkTargetId(graph, selectedNode.id, "next")}
                          onChange={(event) => handleDefaultLinkChange(selectedNode.id, "next", event.target.value)}
                        >
                          <option value=""></option>
                          {connectableNodes.map((node) => (
                            <option key={node.id} value={node.id}>
                              {node.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "예외 처리")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body">
                      <div className="flow-designer-page__link-picker">
                        <select
                          className="bot-settings-card__select"
                          value={getFlowLinkTargetId(graph, selectedNode.id, "exception")}
                          onChange={(event) => handleDefaultLinkChange(selectedNode.id, "exception", event.target.value)}
                        >
                          <option value="">{getFlowDesignerLabel(copy, "연결 안 함")}</option>
                          {connectableNodes.map((node) => (
                            <option key={node.id} value={node.id}>
                              {node.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              {selectedNode.kind === "script" ? (
                <>
                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "파라미터")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                      <div className="flow-designer-page__script-table">
                        <div className="flow-designer-page__script-table-head">
                          <span>{getFlowDesignerLabel(copy, "파라미터명")}</span>
                          <span>{getFlowDesignerLabel(copy, "파라미터 값")}</span>
                          <span />
                        </div>
                        {selectedNode.config.parameters.map((parameter) => (
                          <div key={parameter.id} className="flow-designer-page__script-table-row">
                            <input
                              className="bot-settings-card__input"
                              type="text"
                              value={parameter.name}
                              onChange={(event) =>
                                updateSelectedNode("script", (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    parameters: node.config.parameters.map((item) =>
                                      item.id === parameter.id ? { ...item, name: event.target.value } : item,
                                    ),
                                  },
                                }))
                              }
                              placeholder={getFlowDesignerLabel(copy, "파라미터명")}
                            />
                            <input
                              className="bot-settings-card__input"
                              type="text"
                              value={parameter.value}
                              onChange={(event) =>
                                updateSelectedNode("script", (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    parameters: node.config.parameters.map((item) =>
                                      item.id === parameter.id ? { ...item, value: event.target.value } : item,
                                    ),
                                  },
                                }))
                              }
                              placeholder={getFlowDesignerLabel(copy, "파라미터 값")}
                            />
                            <button
                              type="button"
                              className="flow-designer-page__text-button"
                              onClick={() =>
                                updateSelectedNode("script", (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    parameters: node.config.parameters.filter((item) => item.id !== parameter.id),
                                  },
                                }))
                              }
                            >
                              삭제
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() =>
                          updateSelectedNode("script", (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              parameters: [
                                ...node.config.parameters,
                                { id: crypto.randomUUID(), name: "", value: "" },
                              ],
                            },
                          }))
                        }
                      >{getFlowDesignerLabel(copy, "파라미터 추가하기")}</button>
                    </div>
                  </div>

                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "리턴 변수 설정")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                      <div className="flow-designer-page__script-return-table">
                        <div className="flow-designer-page__script-return-head">
                          <span>{getFlowDesignerLabel(copy, "변수유형")}</span>
                          <span>{getFlowDesignerLabel(copy, "변수명")}</span>
                          <span>{getFlowDesignerLabel(copy, "스크립트 변수명")}</span>
                          <span>{getFlowDesignerLabel(copy, "로컬 변수")}</span>
                          <span />
                        </div>
                        {selectedNode.config.returnVariables.map((returnVariable) => (
                          <div key={returnVariable.id} className="flow-designer-page__script-return-row">
                            <select
                              className="bot-settings-card__select"
                              value={returnVariable.type}
                              onChange={(event) =>
                                updateSelectedNode("script", (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    returnVariables: node.config.returnVariables.map((item) =>
                                      item.id === returnVariable.id
                                        ? { ...item, type: event.target.value === "array" ? "array" : "string" }
                                        : item,
                                    ),
                                  },
                                }))
                              }
                            >
                              <option value="string">string</option>
                              <option value="array">Array</option>
                            </select>
                            <div className="flow-designer-page__variable-prefix-field flow-designer-page__variable-prefix-field--table">
                              <span aria-hidden="true">$</span>
                              <input
                                className="bot-settings-card__input"
                                type="text"
                                value={stripVariablePrefix(returnVariable.variableName)}
                                onChange={(event) =>
                                  updateSelectedNode("script", (node) => ({
                                    ...node,
                                    config: {
                                      ...node.config,
                                      returnVariables: node.config.returnVariables.map((item) =>
                                        item.id === returnVariable.id
                                          ? { ...item, variableName: stripVariablePrefix(event.target.value) }
                                          : item,
                                      ),
                                    },
                                  }))
                                }
                                onBlur={() =>
                                  updateSelectedNode("script", (node) => ({
                                    ...node,
                                    config: {
                                      ...node.config,
                                      returnVariables: node.config.returnVariables.map((item) =>
                                        item.id === returnVariable.id
                                          ? { ...item, variableName: formatVariableName(item.variableName) }
                                          : item,
                                      ),
                                    },
                                  }))
                                }
                                placeholder={getFlowDesignerLabel(copy, "변수명")}
                              />
                            </div>
                            <input
                              className="bot-settings-card__input"
                              type="text"
                              value={returnVariable.scriptVariableName}
                              onChange={(event) =>
                                updateSelectedNode("script", (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    returnVariables: node.config.returnVariables.map((item) =>
                                      item.id === returnVariable.id
                                        ? { ...item, scriptVariableName: event.target.value }
                                        : item,
                                    ),
                                  },
                                }))
                              }
                              placeholder={getFlowDesignerLabel(copy, "스크립트 변수명")}
                            />
                            <label className="flow-designer-page__table-switch settings-switch" aria-label={getFlowDesignerLabel(copy, "로컬 변수")}>
                              <input
                                type="checkbox"
                                checked={returnVariable.local}
                                onChange={(event) =>
                                  updateSelectedNode("script", (node) => ({
                                    ...node,
                                    config: {
                                      ...node.config,
                                      returnVariables: node.config.returnVariables.map((item) =>
                                        item.id === returnVariable.id
                                          ? { ...item, local: event.target.checked }
                                          : item,
                                      ),
                                    },
                                  }))
                                }
                              />
                              <span className="settings-switch__track" />
                            </label>
                            <button
                              type="button"
                              className="flow-designer-page__text-button"
                              onClick={() =>
                                updateSelectedNode("script", (node) => ({
                                  ...node,
                                  config: {
                                    ...node.config,
                                    returnVariables: node.config.returnVariables.filter((item) => item.id !== returnVariable.id),
                                  },
                                }))
                              }
                            >
                              삭제
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() =>
                          updateSelectedNode("script", (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              returnVariables: [
                                ...node.config.returnVariables,
                                {
                                  id: crypto.randomUUID(),
                                  type: "string",
                                  variableName: "",
                                  scriptVariableName: "",
                                  local: false,
                                },
                              ],
                            },
                          }))
                        }
                      >
                        리턴 변수 추가하기
                      </button>
                    </div>
                  </div>

                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "스크립트 코드")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                      <div className="flow-designer-page__script-actions">
                        <button type="button" className="secondary-action" onClick={openScriptEditor}>{getFlowDesignerLabel(copy, "편집 팝업 열기")}</button>
                        <button type="button" className="secondary-action" onClick={openAdaptiveCardDesigner}>{getFlowDesignerLabel(copy, "Adaptive Card 디자이너")}</button>
                      </div>
                      <div className="flow-designer-page__code-preview">
                        {selectedNode.config.code.trim() || "스크립트 코드가 없습니다."}
                      </div>
                    </div>
                  </div>

                  <div className="flow-designer-page__section">
                    <div className="flow-designer-page__section-head">
                      <strong>{getFlowDesignerLabel(copy, "흐름 설정")}</strong>
                    </div>
                    <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                      <label className="flow-designer-page__field">
                        <span>
                          {getFlowDesignerLabel(copy, "다음 카드")} <span className="flow-designer-page__required">*</span>
                        </span>
                        <div className="flow-designer-page__link-picker">
                          <select
                            className="bot-settings-card__select"
                            value={getFlowLinkTargetId(graph, selectedNode.id, "next")}
                            onChange={(event) => handleDefaultLinkChange(selectedNode.id, "next", event.target.value)}
                          >
                            <option value=""></option>
                            {connectableNodes.map((node) => (
                              <option key={node.id} value={node.id}>
                                {node.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      </label>

                      <label className="flow-designer-page__field">
                        <span>{getFlowDesignerLabel(copy, "예외 처리")}</span>
                        <div className="flow-designer-page__link-picker">
                          <select
                            className="bot-settings-card__select"
                            value={getFlowLinkTargetId(graph, selectedNode.id, "exception")}
                            onChange={(event) => handleDefaultLinkChange(selectedNode.id, "exception", event.target.value)}
                          >
                            <option value="">{getFlowDesignerLabel(copy, "연결 안 함")}</option>
                            {connectableNodes.map((node) => (
                              <option key={node.id} value={node.id}>
                                {node.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      </label>
                    </div>
                  </div>
                </>
              ) : null}

              {selectedNode.kind === "end" ? (
                <div className="flow-designer-page__section">
                  <div className="flow-designer-page__section-head">
                    <strong>{getFlowDesignerLabel(copy, "종료 설정")}</strong>
                  </div>
                  <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                    <label className="flow-designer-page__check">
                      <input
                        type="checkbox"
                        checked={selectedNode.config.endSessionImmediately}
                        onChange={(event) =>
                          updateSelectedNode("end", (node) => ({
                            ...node,
                            config: {
                              ...node.config,
                              endSessionImmediately: event.target.checked,
                            },
                          }))
                        }
                      />
                      <span>{getFlowDesignerLabel(copy, "Session 바로 종료")}</span>
                    </label>
                  </div>
                </div>
              ) : null}

              {selectedNode.kind !== "start" ? (
                <button type="button" className="secondary-action secondary-action--danger" onClick={handleDeleteSelectedNode}>{getFlowDesignerLabel(copy, "삭제")}</button>
              ) : null}
            </div>
          ) : selectedLink ? (
            <div className="flow-designer-page__panel-stack">
              <div className="flow-designer-page__inspector-title">
                <span className="flow-designer-page__panel-icon">↗</span>
                <strong>{getFlowDesignerLabel(copy, "링크")}</strong>
              </div>

              <div className="flow-designer-page__section">
                <div className="flow-designer-page__section-head">
                  <strong>{getFlowDesignerLabel(copy, "연결 정보")}</strong>
                </div>
                <div className="flow-designer-page__section-body flow-designer-page__section-body--compact flow-designer-page__link-summary-grid">
                  <label className="flow-designer-page__field">
                    <span>{getFlowDesignerLabel(copy, "유형")}</span>
                    <div className="flow-designer-page__readonly-box">
                      {getLinkKindLabel(selectedLink)}
                    </div>
                  </label>
                  <label className="flow-designer-page__field">
                    <span>{getFlowDesignerLabel(copy, "시작 카드")}</span>
                    <div className="flow-designer-page__readonly-box">
                      {getNodeById(graph, selectedLink.sourceNodeId)?.title ?? "-"}
                    </div>
                  </label>
                  <label className="flow-designer-page__field">
                    <span>{getFlowDesignerLabel(copy, "연결 기준")}</span>
                    <div className="flow-designer-page__readonly-box">
                      {getLinkSourcePortLabel(graph, selectedLink) || "-"}
                    </div>
                  </label>
                  <label className="flow-designer-page__field">
                    <span>{getFlowDesignerLabel(copy, "도착 카드")}</span>
                    <div className="flow-designer-page__readonly-box">
                      {getNodeById(graph, selectedLink.targetNodeId)?.title ?? "-"}
                    </div>
                  </label>
                </div>
              </div>

              <div className="flow-designer-page__section">
                <div className="flow-designer-page__section-head">
                  <strong>{getFlowDesignerLabel(copy, "링크 모양")}</strong>
                </div>
                <div className="flow-designer-page__section-body flow-designer-page__section-body--compact">
                  <label className="flow-designer-page__field">
                    <span>{getFlowDesignerLabel(copy, "꺾임점")}</span>
                    <div className="flow-designer-page__readonly-box">
                      {selectedLink.waypoints.length}개
                    </div>
                  </label>
                  <button
                    type="button"
                    className="secondary-action"
                    disabled={selectedLink.waypoints.length === 0}
                    onClick={() =>
                      applyGraphUpdate((current) =>
                        updateLinkInGraph(current, selectedLink.id, (link) => ({
                          ...link,
                          waypoints: [],
                        })),
                      )
                    }
                  >
                    선 모양 초기화
                  </button>
                </div>
              </div>

              <button type="button" className="secondary-action secondary-action--danger" onClick={handleDeleteSelectedLink}>{getFlowDesignerLabel(copy, "삭제")}</button>
            </div>
          ) : (
            <div className="flow-designer-page__panel-stack">
              <div className="flow-designer-page__card-property">
                <strong>{getFlowDesignerLabel(copy, "속성")}</strong>
                <div className="flow-designer-page__summary-grid">
                  <div>
                    <span>{getFlowDesignerLabel(copy, "사용자 카드")}</span>
                    <strong>{nodeCount}</strong>
                  </div>
                  <div>
                    <span>{getFlowDesignerLabel(copy, "링크")}</span>
                    <strong>{linkCount}</strong>
                  </div>
                  <div>
                    <span>{getFlowDesignerLabel(copy, "대화 유형")}</span>
                    <strong>{getDialogTypeLabel(dialog.dialogType)}</strong>
                  </div>
                  <div>
                    <span>{getFlowDesignerLabel(copy, "필수 변수 반복")}</span>
                    <strong>{versionSettings.conversationDefaults.entityPrompt.maxRepeatCount}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {entityExtractionDialogOpen && selectedNode?.kind === "talk" ? (
        <div className="entity-editor-backdrop" role="presentation">
          <div
            className="flow-designer-page__entity-extraction-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={getFlowDesignerLabel(copy, "응답 내 개체 추출")}
          >
            <div className="entity-editor-dialog__header">
              <strong>{getFlowDesignerLabel(copy, "응답 내 개체 추출")}</strong>
              <button
                type="button"
                className="entity-editor-dialog__close"
                aria-label={getFlowDesignerLabel(copy, "닫기")}
                onClick={() => setEntityExtractionDialogOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="flow-designer-page__entity-extraction-body">
              <div className="flow-designer-page__entity-extraction-toolbar">
                <strong>
                  추출할 개체 {selectedEntityExtractionOptions.length}
                  <span aria-hidden="true"> ⓘ</span>
                </strong>
                <span className="flow-designer-page__entity-extraction-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      setEntityExtractionSearchKeyword("");
                      setEntityExtractionPickerOpen(true);
                    }}
                  >
                    선택 개체 추가
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    disabled={selectedNode.config.responseEntityBindingIds.length === 0}
                    onClick={() =>
                      updateSelectedNode("talk", (node) => ({
                        ...node,
                        config: {
                          ...node.config,
                          responseEntityBindingIds: [],
                          responseEntityExtractions: [],
                        },
                      }))
                    }
                  >
                    삭제
                  </button>
                </span>
              </div>
              {entityExtractionPickerOpen ? (
                <div ref={entityExtractionPickerRef} className="flow-designer-page__entity-picker">
                  <div className="flow-designer-page__entity-extraction-search">
                    <input
                      className="bot-settings-card__input"
                      type="text"
                      value={entityExtractionSearchKeyword}
                      onChange={(event) => setEntityExtractionSearchKeyword(event.target.value)}
                      placeholder={getFlowDesignerLabel(copy, "대화에서 사용할 개체를 검색하여 파라미터로 등록하세요.")}
                    />
                    <span aria-hidden="true">⌕</span>
                  </div>
                  <div className="flow-designer-page__entity-catalog-table">
                    <div className="flow-designer-page__entity-catalog-head">
                      <span>
                        <input
                          type="checkbox"
                          checked={
                            entityExtractionOptions.length > 0 &&
                            entityExtractionOptions.every((option) =>
                              selectedNode.config.responseEntityBindingIds.includes(option.id),
                            )
                          }
                          onChange={(event) => {
                            updateSelectedNode("talk", (node) => ({
                              ...node,
                              config: {
                                ...node.config,
                                responseEntityBindingIds: event.target.checked
                                  ? entityExtractionOptions.map((option) => option.id)
                                  : [],
                                responseEntityExtractions: event.target.checked
                                  ? entityExtractionOptions.map((option) => buildEntityExtractionConfig(option))
                                  : [],
                              },
                            }));
                            setEntityExtractionPickerOpen(false);
                          }}
                        />
                      </span>
                      <span>{getFlowDesignerLabel(copy, "개체명")}</span>
                      <span>{getFlowDesignerLabel(copy, "구분")}</span>
                      <span>{getFlowDesignerLabel(copy, "개체값")}</span>
                    </div>
                    {filteredEntityExtractionOptions.length > 0 ? (
                      <div className="flow-designer-page__entity-catalog-rows">
                        {["사용자 개체", "시스템 개체"].map((category) => {
                          const options = filteredEntityExtractionOptions.filter((option) => option.category === category);
                          if (options.length === 0) {
                            return null;
                          }
                          return (
                            <div key={category}>
                              <div className="flow-designer-page__entity-extraction-group">{category}</div>
                              {options.map((option) => {
                                const checked = selectedNode.config.responseEntityBindingIds.includes(option.id);
                                return (
                                  <label key={option.id} className="flow-designer-page__entity-catalog-row">
                                    <span>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) => {
                                          updateSelectedNode("talk", (node) => ({
                                            ...node,
                                            config: {
                                              ...node.config,
                                              responseEntityBindingIds: event.target.checked
                                                ? [...new Set([...node.config.responseEntityBindingIds, option.id])]
                                                : node.config.responseEntityBindingIds.filter((id) => id !== option.id),
                                              responseEntityExtractions: event.target.checked
                                                ? node.config.responseEntityExtractions.some(
                                                    (item) => item.entityId === option.entityId,
                                                  )
                                                  ? node.config.responseEntityExtractions
                                                  : [
                                                      ...node.config.responseEntityExtractions,
                                                      buildEntityExtractionConfig(option),
                                                    ]
                                                : node.config.responseEntityExtractions.filter(
                                                    (item) => item.entityId !== option.entityId,
                                                  ),
                                            },
                                          }));
                                          setEntityExtractionPickerOpen(false);
                                        }}
                                      />
                                    </span>
                                    <span>
                                      <strong>{option.entityName}</strong>
                                      {checked ? <small>{getFlowDesignerLabel(copy, "이미 추가됨")}</small> : null}
                                    </span>
                                    <span>{option.category}</span>
                                    <span>{option.entityValue}</span>
                                  </label>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flow-designer-page__entity-extraction-empty">
                        아직 추출할 개체가 선택되지 않았습니다.
                        <br />
                        대화에서 추출할 개체를 선택하세요.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flow-designer-page__entity-picker flow-designer-page__entity-picker--closed">
                  <div className="flow-designer-page__entity-extraction-search">
                    <input
                      className="bot-settings-card__input"
                      type="text"
                      value=""
                      readOnly
                      onClick={() => {
                        setEntityExtractionSearchKeyword("");
                        setEntityExtractionPickerOpen(true);
                      }}
                      placeholder={getFlowDesignerLabel(copy, "대화에서 사용할 개체를 검색하여 파라미터로 등록하세요.")}
                    />
                    <span aria-hidden="true">⌕</span>
                  </div>
                </div>
              )}
              <div className="flow-designer-page__entity-selected-table">
                <div className="flow-designer-page__entity-selected-head">
                  <span>
                    <input
                      type="checkbox"
                      checked={selectedEntityExtractionOptions.length > 0}
                      onChange={(event) =>
                        updateSelectedNode("talk", (node) => ({
                          ...node,
                          config: {
                            ...node.config,
                            responseEntityBindingIds: event.target.checked
                              ? selectedEntityExtractionRows.map((option) => option.id)
                              : [],
                            responseEntityExtractions: event.target.checked
                              ? selectedEntityExtractionRows.map((option) => ({
                                  id: option.id,
                                  entityId: option.entityId,
                                  entityName: option.entityName,
                                  variableName: option.variableName,
                                  required: option.required,
                                  local: option.local,
                                  chatbotMessages: option.chatbotMessages,
                                }))
                              : [],
                          },
                        }))
                      }
                    />
                  </span>
                  <span>{getFlowDesignerLabel(copy, "변수명")}</span>
                  <span>{getFlowDesignerLabel(copy, "개체명")}</span>
                  <span>{getFlowDesignerLabel(copy, "개체값")}</span>
                  <span>{getFlowDesignerLabel(copy, "필수 변수")}</span>
                  <span>{getFlowDesignerLabel(copy, "로컬 변수")}</span>
                  <span>{getFlowDesignerLabel(copy, "챗봇 메시지")}</span>
                </div>
                <div className="flow-designer-page__entity-selected-rows">
                  {selectedEntityExtractionRows.map((option) => (
                    <label key={`selected-${option.id}`} className="flow-designer-page__entity-selected-row">
                      <span>
                        <input
                          type="checkbox"
                          checked
                          onChange={() =>
                            updateSelectedNode("talk", (node) => ({
                              ...node,
                              config: {
                                ...node.config,
                                responseEntityBindingIds: node.config.responseEntityBindingIds.filter(
                                  (id) => id !== option.id,
                                ),
                                responseEntityExtractions: node.config.responseEntityExtractions.filter(
                                  (item) => item.entityId !== option.entityId,
                                ),
                              },
                            }))
                          }
                        />
                      </span>
                      <span>
                        <div className="flow-designer-page__variable-prefix-field">
                          <span aria-hidden="true">$</span>
                          <input
                            className="bot-settings-card__input"
                            type="text"
                            value={stripVariablePrefix(option.variableName)}
                            onChange={(event) =>
                              updateSelectedNode("talk", (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  responseEntityExtractions: node.config.responseEntityExtractions.map((item) =>
                                    item.entityId === option.entityId
                                      ? { ...item, variableName: stripVariablePrefix(event.target.value) }
                                      : item,
                                  ),
                                },
                              }))
                            }
                            onBlur={() =>
                              updateSelectedNode("talk", (node) => ({
                                ...node,
                                config: {
                                  ...node.config,
                                  responseEntityExtractions: node.config.responseEntityExtractions.map((item) =>
                                    item.entityId === option.entityId
                                      ? { ...item, variableName: formatVariableName(item.variableName) }
                                      : item,
                                  ),
                                },
                              }))
                            }
                          />
                        </div>
                      </span>
                      <span>
                        <strong>{option.entityName}</strong>
                        <small>{option.category}</small>
                      </span>
                      <span>{option.entityValue}</span>
                      <span>
                        <input
                          type="checkbox"
                          checked={option.required}
                          onChange={(event) =>
                            updateSelectedNode("talk", (node) => ({
                              ...node,
                              config: {
                                ...node.config,
                                responseEntityExtractions: node.config.responseEntityExtractions.map((item) =>
                                  item.entityId === option.entityId ? { ...item, required: event.target.checked } : item,
                                ),
                              },
                            }))
                          }
                        />{" "}
                        미사용
                      </span>
                      <span>
                        <input
                          type="checkbox"
                          checked={option.local}
                          onChange={(event) =>
                            updateSelectedNode("talk", (node) => ({
                              ...node,
                              config: {
                                ...node.config,
                                responseEntityExtractions: node.config.responseEntityExtractions.map((item) =>
                                  item.entityId === option.entityId ? { ...item, local: event.target.checked } : item,
                                ),
                              },
                            }))
                          }
                        />{" "}
                        미사용
                      </span>
                      <span>-</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flow-designer-page__entity-extraction-footer">
              <button
                type="button"
                className="secondary-action"
                onClick={() => setEntityExtractionDialogOpen(false)}
              >{getFlowDesignerLabel(copy, "취소")}</button>
              <button
                type="button"
                className="flow-designer-page__save"
                onClick={() => setEntityExtractionDialogOpen(false)}
              >{getFlowDesignerLabel(copy, "확인")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {scriptEditorOpen && selectedNode?.kind === "script" ? (
        <div className="entity-editor-backdrop" role="presentation">
          <div
            className="flow-designer-page__script-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={getFlowDesignerLabel(copy, "스크립트 코드 편집")}
          >
            <div className="entity-editor-dialog__header">
              <strong>{getFlowDesignerLabel(copy, "스크립트 코드 편집")}</strong>
              <button
                type="button"
                className="entity-editor-dialog__close"
                aria-label={getFlowDesignerLabel(copy, "닫기")}
                onClick={() => setScriptEditorOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="flow-designer-page__script-dialog-body">
              <div className="flow-designer-page__script-dialog-note">{getFlowDesignerLabel(copy, "JavaScript ES2020 기준으로 작성합니다. 실행 환경 제한은 런타임 정책에서 별도로 적용됩니다.")}</div>
              {scriptEditorError ? (
                <div
                  className={
                    scriptEditorError === "문법 오류가 없습니다."
                      ? "flow-designer-page__script-dialog-status is-valid"
                      : "flow-designer-page__script-dialog-status"
                  }
                >
                  {scriptEditorError}
                </div>
              ) : null}
              <div className="flow-designer-page__script-editor-shell">
                <div className="flow-designer-page__script-line-numbers" ref={scriptLineNumberRef}>
                  {scriptEditorLineNumbers.map((lineNumber) => (
                    <span key={lineNumber}>{lineNumber}</span>
                  ))}
                </div>
                <textarea
                  className="flow-designer-page__script-editor"
                  value={scriptCodeDraft}
                  onChange={(event) => {
                    setScriptCodeDraft(event.target.value);
                    setScriptEditorError("");
                  }}
                  onKeyDown={handleScriptEditorKeyDown}
                  onScroll={(event) => {
                    if (scriptLineNumberRef.current) {
                      scriptLineNumberRef.current.scrollTop = event.currentTarget.scrollTop;
                    }
                  }}
                  spellCheck={false}
                  placeholder={"var result = input;\nreturn result;"}
                />
              </div>
            </div>
            <div className="flow-designer-page__script-dialog-footer">
              <button type="button" className="secondary-action" onClick={() => setScriptEditorOpen(false)}>{getFlowDesignerLabel(copy, "취소")}</button>
              <button type="button" className="secondary-action" onClick={checkScriptEditorSyntax}>{getFlowDesignerLabel(copy, "문법 확인")}</button>
              <button type="button" className="flow-designer-page__save" onClick={confirmScriptEditor}>{getFlowDesignerLabel(copy, "확인")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {adaptiveCardDesignerOpen && selectedNode?.kind === "script" ? (
        <div className="entity-editor-backdrop" role="presentation">
          <div
            className="flow-designer-page__adaptive-card-designer-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={getFlowDesignerLabel(copy, "Adaptive Card 디자이너")}
          >
            <div className="entity-editor-dialog__header">
              <strong>{getFlowDesignerLabel(copy, "Adaptive Card 디자이너")}</strong>
              <button
                type="button"
                className="entity-editor-dialog__close"
                aria-label={getFlowDesignerLabel(copy, "닫기")}
                onClick={() => setAdaptiveCardDesignerOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="flow-designer-page__adaptive-card-designer-body">
              <div ref={adaptiveCardDesignerHostRef} className="flow-designer-page__adaptive-card-designer-host" />
              <aside className="flow-designer-page__adaptive-card-designer-side">
                <strong>{getFlowDesignerLabel(copy, "Script 반영")}</strong>
                <p>{getFlowDesignerLabel(copy, "적용하면 현재 Script 카드에 Adaptive Card JSON을 $adaptiveCard, $msgKey 변수로 저장하는 코드가 들어갑니다.")}</p>
                <div className="flow-designer-page__adaptive-card-designer-preview">
                  <span>{getFlowDesignerLabel(copy, "생성 상태")}</span>
                  <b>{adaptiveCardDesignerOutput?.adaptiveCard ? "Adaptive Card JSON 생성됨" : "디자인 내용을 기다리는 중"}</b>
                </div>
                {adaptiveCardDesignerStatus ? (
                  <div className="flow-designer-page__script-dialog-status">
                    {adaptiveCardDesignerStatus}
                  </div>
                ) : null}
              </aside>
            </div>
            <div className="flow-designer-page__script-dialog-footer">
              <button type="button" className="secondary-action" onClick={() => setAdaptiveCardDesignerOpen(false)}>{getFlowDesignerLabel(copy, "취소")}</button>
              <button type="button" className="flow-designer-page__save" onClick={applyAdaptiveCardDesignerOutput}>{getFlowDesignerLabel(copy, "Script에 적용")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {functionPicker ? (
        <div className="entity-editor-backdrop" role="presentation">
          <div
            className="flow-designer-page__function-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={getFlowDesignerLabel(copy, "Function 카드 설정")}
          >
            <div className="entity-editor-dialog__header">
              <strong>{getFlowDesignerLabel(copy, "Function 카드 설정")}</strong>
              <button
                type="button"
                className="entity-editor-dialog__close"
                aria-label={getFlowDesignerLabel(copy, "닫기")}
                onClick={() => setFunctionPicker(null)}
              >
                ×
              </button>
            </div>
            <div className="flow-designer-page__function-picker-body">
              {functionPicker.step === "method" ? (
                <div className="flow-designer-page__function-picker-layout">
                  <section>
                    <strong>{getFlowDesignerLabel(copy, "API 목록")}</strong>
                    <div className="flow-designer-page__function-picker-list">
                      {apiAssets.map((api) => (
                        <button
                          key={api.id}
                          type="button"
                          className={api.id === functionPicker.apiId ? "is-selected" : ""}
                          onClick={() => {
                            const nextMethod = api.methods[0] ?? null;
                            const outputRows = nextMethod ? getFunctionOutputRows(nextMethod) : [];
                            setFunctionPicker({
                              step: "method",
                              apiId: api.id,
                              methodId: nextMethod?.id ?? "",
                              inputValues: Object.fromEntries(
                                nextMethod?.parameters.map((parameter) => [parameter.id, parameter.defaultValue]) ?? [],
                              ),
                              outputIds:
                                outputRows.length === 1 && outputRows[0]?.id === "root" ? ["root"] : [],
                              expandedOutputPaths: [],
                              testOutput: "",
                              testOutputValue: undefined,
                              testOutputRows: [],
                              testError: "",
                            });
                          }}
                        >
                          <span>{api.name}</span>
                          <small>{api.description || api.baseUrl}</small>
                        </button>
                      ))}
                    </div>
                  </section>
                  <section>
                    <strong>{getFlowDesignerLabel(copy, "API Method 목록")}</strong>
                    <div className="flow-designer-page__function-picker-methods">
                      {functionPickerApi?.methods.map((method) => (
                        <label
                          key={method.id}
                          className={method.id === functionPicker.methodId ? "is-selected" : ""}
                        >
                          <input
                            type="radio"
                            name="function-method"
                            checked={method.id === functionPicker.methodId}
                            onChange={() => {
                              const outputRows = getFunctionOutputRows(method);
                              setFunctionPicker((current) =>
                                current
                                  ? {
                                      ...current,
                                      methodId: method.id,
                                      inputValues: Object.fromEntries(
                                        method.parameters.map((parameter) => [
                                          parameter.id,
                                          current.inputValues[parameter.id] || parameter.defaultValue,
                                        ]),
                                      ),
                                      outputIds:
                                        outputRows.length === 1 && outputRows[0]?.id === "root" ? ["root"] : [],
                                      expandedOutputPaths: [],
                                      testOutput: "",
                                      testOutputValue: undefined,
                                      testOutputRows: [],
                                      testError: "",
                                    }
                                  : current,
                              );
                            }}
                          />
                          <span>{method.name}</span>
                          <small>{method.httpMethod} {method.methodUrl}</small>
                        </label>
                      )) ?? <p className="flow-designer-page__section-note">{getFlowDesignerLabel(copy, "등록된 Method가 없습니다.")}</p>}
                    </div>
                  </section>
                </div>
              ) : (
                <div className="flow-designer-page__function-picker-parameter">
                  <section className="flow-designer-page__function-picker-input">
                    <strong>{getFlowDesignerLabel(copy, "입력 Parameter")}</strong>
                    <div className="flow-designer-page__function-picker-input-table">
                      <div className="flow-designer-page__function-picker-input-head">
                        <span>Name</span>
                        <span>Description</span>
                        <span>Parameter type</span>
                        <span>Data type</span>
                        <span>Test input</span>
                      </div>
                      {functionPickerMethod && functionPickerMethod.parameters.length > 0 ? (
                        functionPickerMethod.parameters.map((parameter) => (
                          <div key={parameter.id} className="flow-designer-page__function-picker-input-row">
                            <span className="flow-designer-page__parameter-name">
                              {parameter.name}
                              {parameter.required ? <span className="flow-designer-page__required">*</span> : null}
                            </span>
                            <span>{parameter.description || "-"}</span>
                            <span>{parameter.location}</span>
                            <span>{parameter.dataType}</span>
                            <input
                              className="bot-settings-card__input"
                              type="text"
                              value={functionPicker.inputValues[parameter.id] || parameter.defaultValue}
                              placeholder={parameter.defaultValue}
                              onChange={(event) =>
                                setFunctionPicker((current) =>
                                  current
                                    ? {
                                        ...current,
                                        inputValues: {
                                          ...current.inputValues,
                                          [parameter.id]: event.target.value,
                                        },
                                      }
                                    : current,
                                )
                              }
                            />
                          </div>
                        ))
                      ) : (
                        <p className="flow-designer-page__section-note">{getFlowDesignerLabel(copy, "등록된 입력 Parameter가 없습니다.")}</p>
                      )}
                    </div>
                  </section>

                  <div className="flow-designer-page__function-picker-output-grid">
                    <section className="flow-designer-page__function-picker-output">
                      <strong>{getFlowDesignerLabel(copy, "출력 Parameter")}</strong>
                      <div className="flow-designer-page__function-picker-output-table">
                        <div className="flow-designer-page__function-picker-output-head">
                          <span />
                          <span>Name</span>
                          <span>Data type</span>
                        </div>
                        {functionPickerMethod ? (
                          getVisibleFunctionOutputRows(
                            functionPickerOutputRows,
                            functionPicker.expandedOutputPaths,
                          ).map((parameter) => {
                            const hasChildren = hasFunctionOutputChildren(functionPickerOutputRows, parameter.path);
                            const expanded = functionPicker.expandedOutputPaths.includes(parameter.path);
                            const depth = getFunctionOutputDisplayDepth(parameter.path, false);
                            const selectedByAncestor = getFunctionOutputAncestorPaths(parameter.path).some((path) =>
                              functionPicker.outputIds.includes(path),
                            );
                            const checked = selectedByAncestor || functionPicker.outputIds.includes(parameter.id);

                            return (
                              <label key={parameter.id} className="flow-designer-page__function-picker-output-row">
                                <span>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={selectedByAncestor}
                                    onChange={(event) =>
                                      setFunctionPicker((current) =>
                                        current
                                          ? (() => {
                                              const nextOutputIds = event.target.checked
                                                ? [
                                                    ...new Set([
                                                      ...current.outputIds.filter((id) => {
                                                        const row = functionPickerOutputRows.find((item) => item.id === id);
                                                        return row ? !isFunctionOutputDescendantPath(row.path, parameter.path) : true;
                                                      }),
                                                      parameter.id,
                                                    ]),
                                                  ]
                                                : current.outputIds.filter((id) => id !== parameter.id);

                                              return {
                                                ...current,
                                                outputIds: nextOutputIds,
                                                testOutput: buildFunctionPickerTestOutputPreview(
                                                  current.testOutputValue,
                                                  functionPickerOutputRows,
                                                  nextOutputIds,
                                                ),
                                              };
                                            })()
                                          : current,
                                      )
                                    }
                                  />
                                </span>
                                <span style={{ paddingLeft: 6 + depth * 16 }}>
                                  {hasChildren ? (
                                    <button
                                      type="button"
                                      className="flow-designer-page__function-output-toggle"
                                      aria-label={expanded ? "하위 Parameter 닫기" : "하위 Parameter 열기"}
                                      onClick={(event) => {
                                        event.preventDefault();
                                        setFunctionPicker((current) =>
                                          current
                                            ? {
                                                ...current,
                                                expandedOutputPaths: expanded
                                                  ? current.expandedOutputPaths.filter((path) => path !== parameter.path)
                                                  : [...new Set([...current.expandedOutputPaths, parameter.path])],
                                              }
                                            : current,
                                        );
                                      }}
                                    >
                                      {expanded ? "-" : "+"}
                                    </button>
                                  ) : (
                                    <span className="flow-designer-page__function-output-toggle-spacer" />
                                  )}
                                  {parameter.name}
                                </span>
                                <span>{parameter.dataType}</span>
                              </label>
                            );
                          })
                        ) : (
                          <p className="flow-designer-page__section-note">{getFlowDesignerLabel(copy, "Method를 선택하세요.")}</p>
                        )}
                      </div>
                    </section>

                    <section className="flow-designer-page__function-picker-test">
                      <div className="flow-designer-page__function-picker-test-head">
                        <strong>Test Output</strong>
                        <button type="button" className="secondary-action" onClick={testFunctionPickerMethod}>
                          Test
                        </button>
                      </div>
                      <pre>{functionPicker.testOutput || ""}</pre>
                      {functionPicker.testError && !functionPicker.testOutput ? (
                        <p className="flow-designer-page__dialog-error">{functionPicker.testError}</p>
                      ) : null}
                    </section>
                  </div>
                </div>
              )}
            </div>
            <div className="flow-designer-page__function-picker-footer">
              <button type="button" className="secondary-action" onClick={() => setFunctionPicker(null)}>{getFlowDesignerLabel(copy, "취소")}</button>
              {functionPicker.step === "output" ? (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setFunctionPicker((current) => (current ? { ...current, step: "method" } : current))}
                >
                  이전
                </button>
              ) : null}
              {functionPicker.step === "method" ? (
                <button
                  type="button"
                  className="flow-designer-page__save"
                  disabled={!functionPickerApi || !functionPickerMethod}
                  onClick={() => setFunctionPicker((current) => (current ? { ...current, step: "output" } : current))}
                >
                  다음
                </button>
              ) : (
                <button type="button" className="flow-designer-page__save" onClick={applyFunctionPicker}>{getFlowDesignerLabel(copy, "저장")}</button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {jumpCardPickerOpen && selectedNode?.kind === "jump" && selectedNode.config.targetType === "card" ? (
        <div className="entity-editor-backdrop" role="presentation">
          <div
            className="flow-designer-page__jump-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={getFlowDesignerLabel(copy, "카드 목록")}
          >
            <div className="entity-editor-dialog__header">
              <strong>{getFlowDesignerLabel(copy, "카드 목록")}</strong>
              <button
                type="button"
                className="entity-editor-dialog__close"
                aria-label={getFlowDesignerLabel(copy, "닫기")}
                onClick={() => setJumpCardPickerOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="flow-designer-page__jump-dialog-body">
              <input
                className="bot-settings-card__input"
                type="text"
                value={jumpCardSearchKeyword}
                onChange={(event) => setJumpCardSearchKeyword(event.target.value)}
                placeholder={getFlowDesignerLabel(copy, "카드명을 검색하세요.")}
              />
              <div className="flow-designer-page__jump-dialog-list">
                {filteredJumpTargetCardOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      selectedNode.config.targetCardId === item.id
                        ? "flow-designer-page__jump-dialog-row is-selected"
                        : "flow-designer-page__jump-dialog-row"
                    }
                    onClick={() => {
                      handleDefaultLinkChange(selectedNode.id, "jump", item.id);
                      setJumpCardPickerOpen(false);
                    }}
                  >
                    <span>{item.title}</span>
                    <small>{FLOW_CARD_LABELS[item.kind]}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {jumpDialogPickerOpen && selectedNode?.kind === "jump" ? (
        <div className="entity-editor-backdrop" role="presentation">
          <div
            className="flow-designer-page__jump-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={getFlowDesignerLabel(copy, "모듈대화 목록")}
          >
            <div className="entity-editor-dialog__header">
              <strong>{getFlowDesignerLabel(copy, "모듈대화 목록")}</strong>
              <button
                type="button"
                className="entity-editor-dialog__close"
                aria-label={getFlowDesignerLabel(copy, "닫기")}
                onClick={() => setJumpDialogPickerOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="flow-designer-page__jump-dialog-body">
              <input
                className="bot-settings-card__input"
                type="text"
                value={jumpDialogSearchKeyword}
                onChange={(event) => setJumpDialogSearchKeyword(event.target.value)}
                placeholder={getFlowDesignerLabel(copy, "의도/모듈명을 검색하세요.")}
              />
              <div className="flow-designer-page__jump-dialog-list">
                {filteredJumpTargetDialogOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      selectedNode.config.targetDialogId === item.id
                        ? "flow-designer-page__jump-dialog-row is-selected"
                        : "flow-designer-page__jump-dialog-row"
                    }
                    onClick={() => {
                      updateSelectedNode("jump", (node) => ({
                        ...node,
                        config: {
                          ...node.config,
                          targetDialogId: item.id,
                          targetDialogName: item.name,
                          targetDialogType: item.dialogType,
                        },
                      }));
                      setJumpDialogPickerOpen(false);
                    }}
                  >
                    <span>{item.name}</span>
                    <small>{getDialogTypeLabel(item.dialogType)}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {flowHelpOpen ? (
        <div
          className="dialog-help-modal__backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setFlowHelpOpen(false);
            }
          }}
        >
          <section
            className="dialog-help-modal dialog-help-modal--flow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="flow-design-help-title"
          >
            <header className="dialog-help-modal__header">
              <h2 id="flow-design-help-title">{getFlowDesignerLabel(copy, "대화 설계 안내")}</h2>
              <button type="button" aria-label={getFlowDesignerLabel(copy, "닫기")} onClick={() => setFlowHelpOpen(false)}>
                ×
              </button>
            </header>
            <div className="dialog-help-modal__body">
              <section className="dialog-help-modal__section">
                <h3>{getFlowDesignerLabel(copy, "단축키")}</h3>
                <div className="dialog-help-modal__notice dialog-help-modal__notice--columns">
                  <ul>
                    <li>{getFlowDesignerLabel(copy, "저장 : Ctrl + S")}</li>
                    <li>{getFlowDesignerLabel(copy, "파일 다운로드 : Ctrl + D")}</li>
                    <li>{getFlowDesignerLabel(copy, "파일 업로드 : Ctrl + U")}</li>
                    <li>{getFlowDesignerLabel(copy, "대화시작으로 이동 : Ctrl + <")}</li>
                    <li>{getFlowDesignerLabel(copy, "셀 선택 : 마우스 왼쪽 클릭, 마우스 드래그")}</li>
                    <li>{getFlowDesignerLabel(copy, "셀 선택 해제 : 셀 선택 Ctrl + 마우스 왼쪽 클릭, 캔버스 영역 클릭")}</li>
                    <li>{getFlowDesignerLabel(copy, "디버그 모드 : Alt + 셀 선택")}</li>
                  </ul>
                  <ul>
                    <li>{getFlowDesignerLabel(copy, "선택된 셀 위로 이동 : ↑ (방향키)")}</li>
                    <li>{getFlowDesignerLabel(copy, "선택된 셀 아래 이동 : ↓ (방향키)")}</li>
                    <li>{getFlowDesignerLabel(copy, "선택된 셀 왼쪽 이동 : ← (방향키)")}</li>
                    <li>{getFlowDesignerLabel(copy, "선택된 셀 오른쪽 이동 : → (방향키)")}</li>
                    <li>{getFlowDesignerLabel(copy, "선택된 셀 삭제 : Del")}</li>
                    <li>{getFlowDesignerLabel(copy, "선택된 셀 복사하기 : Ctrl + Shift + C")}</li>
                    <li>{getFlowDesignerLabel(copy, "선택된 셀 붙여넣기 : Ctrl + Shift + V")}</li>
                  </ul>
                </div>
              </section>
              <section className="dialog-help-modal__section">
                <h3>{getFlowDesignerLabel(copy, "대화 설계하기")}</h3>
                <div className="dialog-help-modal__notice">
                  <p>{getFlowDesignerLabel(copy, "7가지 종류의 대화카드를 Drag & Drop으로 캔버스에 옮겨 사용하세요.")}</p>
                  <p>{getFlowDesignerLabel(copy, "봇과 사용자의 말을 쌍으로 정의하는 Talk Card,")}<br />
                    다른 대화로 이동할 수 있는 Jump Card,<br />{getFlowDesignerLabel(copy, "조건에 따라 대화를 분기하여 설계하는 Condition Card,")}<br />{getFlowDesignerLabel(copy, "기간계 API 함수와 대화 변수를 매핑하는 Function Card,")}<br />
                    변수를 선언하는 Variable Card,<br />{getFlowDesignerLabel(copy, "자바스크립트로 코드를 작성하여 메시지나 변수를 정의하는 Script Card,")}<br />
                    대화 종료를 선언하는 End Card.
                  </p>
                  <p>{getFlowDesignerLabel(copy, "모든 대화는 End Card로 종료해야하며 End Card가 없을 시 최종 저장이 되지않아 봇이 대화를 학습할 수 없습니다. 꼭 End Card로 설계를 끝맺음 하세요.")}</p>
                </div>
              </section>
              <section className="dialog-help-modal__section">
                <h3>{getFlowDesignerLabel(copy, "사용 가능 변수")}</h3>
                <div className="dialog-help-modal__table dialog-help-modal__table--variables">
                  <div><strong>{getFlowDesignerLabel(copy, "변수명")}</strong><strong>{getFlowDesignerLabel(copy, "구분")}</strong><strong>{getFlowDesignerLabel(copy, "설명")}</strong></div>
                  {[...COMMON_FLOW_VARIABLES, ...collectCommonFlowVariables(versionDocument).map((item) => ({
                    name: item.name,
                    category: "공통",
                    description: item.value || "공통 변수",
                  }))].filter((item) => !isQaFlowVariableName(item.name)).map((item) => (
                    <div key={`${item.category}-${item.name}`}>
                      <span>{item.name}</span>
                      <span>{item.category}</span>
                      <span>{item.description}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="dialog-help-modal__section">
                <h3>{getFlowDesignerLabel(copy, "내장 함수")}</h3>
                <div className="dialog-help-modal__table dialog-help-modal__table--functions">
                  <div>
                    <strong>{getFlowDesignerLabel(copy, "함수")}</strong>
                    <strong>{getFlowDesignerLabel(copy, "유형")}</strong>
                    <strong>{getFlowDesignerLabel(copy, "설명")}</strong>
                    <strong>{getFlowDesignerLabel(copy, "예시")}</strong>
                    <strong>{getFlowDesignerLabel(copy, "결과")}</strong>
                  </div>
                  {FLOW_DESIGN_FUNCTIONS.map((item) => (
                    <div key={item.name}>
                      <span>{item.name}{item.input !== "-" ? item.input : "()"}</span>
                      <span>{item.valueType}</span>
                      <span>{item.description}</span>
                      <code>{item.example}</code>
                      <span>{item.result}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
