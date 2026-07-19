import {
  type VersionDialogAsset,
  type VersionDialogType,
  type VersionDocument,
} from "@/lib/version-document";

export type DialogFlowNodeKind =
  | "start"
  | "system-variable"
  | "talk"
  | "jump"
  | "condition"
  | "function"
  | "variable"
  | "script"
  | "end";

type DialogFlowFunctionDataType = "string" | "number" | "boolean" | "object" | "array";

export type DialogFlowLinkKind = "default" | "condition" | "jump";

export type DialogFlowPosition = {
  x: number;
  y: number;
};

export type DialogFlowLink = {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  kind: DialogFlowLinkKind;
  waypoints: DialogFlowPosition[];
};

export type DialogFlowTalkMessageType =
  | "text"
  | "html"
  | "card"
  | "table"
  | "button"
  | "link-button"
  | "form"
  | "carousel"
  | "dtmf"
  | "form-a-card";

export type DialogFlowTalkChannelTemplate = {
  messageType: DialogFlowTalkMessageType;
  messages: string[];
  tableUseVariable: boolean;
  tableVariableItemId: string;
  tableKeyColumn: string;
  tableColumnMappings: Array<{
    id: string;
    column: string;
    value: string;
  }>;
  tableManualRows: Array<{
    id: string;
    key: string;
    values: string[];
  }>;
  linkButtonItems: Array<{
    id: string;
    label: string;
    url: string;
  }>;
};

export type DialogFlowTalkConfig = DialogFlowTalkChannelTemplate & {
  templateChannel: string;
  channelTemplates: Record<string, DialogFlowTalkChannelTemplate>;
  basicMessages: string[];
  responseType: "none" | "single-select" | "relay" | "extract-entity" | "form-relay" | "tts-auto";
  responseVariableName: string;
  responseLocal: boolean;
  responseEntityBindingIds: string[];
  responseEntityExtractions: Array<{
    id: string;
    entityId: string;
    entityName: string;
    variableName: string;
    required: boolean;
    local: boolean;
    chatbotMessages: string[];
  }>;
  intentTransitionLocked: boolean;
  repeatType: "bot-setting" | "custom";
  repeatCount: number;
  floatingButtonMode: "disabled" | "bot-setting" | "custom";
  floatingButtons: Array<{
    id: string;
    label: string;
    key: string;
    enabled: boolean;
  }>;
};

export type DialogFlowJumpTargetType = "card" | "dialog";

export type DialogFlowJumpConfig = {
  targetType: DialogFlowJumpTargetType;
  targetCardId: string;
  targetDialogId: string;
  targetDialogName: string;
  targetDialogType: VersionDialogType;
};

export const CONDITION_OPERATOR_OPTIONS = [
  { value: "exists", label: "가 존재할 때", requiresValue: false },
  { value: "not-exists", label: "가 존재하지 않을 때", requiresValue: false },
  { value: "equals", label: "와 같을 때", requiresValue: true },
  { value: "not-equals", label: "와 다를 때", requiresValue: true },
  { value: "contains", label: "를 포함할 때", requiresValue: true },
  { value: "greater-than", label: "보다 클 때", requiresValue: true },
  { value: "greater-or-equal", label: "보다 크거나 같을 때", requiresValue: true },
  { value: "less-than", label: "보다 작을 때", requiresValue: true },
  { value: "less-or-equal", label: "보다 작거나 같을 때", requiresValue: true },
  { value: "regex", label: "가 패턴과 일치할 때", requiresValue: true },
  { value: "else", label: "그 외의 경우", requiresValue: false },
] as const;

export type DialogFlowConditionOperator =
  (typeof CONDITION_OPERATOR_OPTIONS)[number]["value"];

export type DialogFlowConditionBranch = {
  id: string;
  label: string;
  operator: DialogFlowConditionOperator;
  compareValue: string;
};

export type DialogFlowConditionConfig = {
  variableName: string;
  hideLabels: boolean;
  branches: DialogFlowConditionBranch[];
};

export type DialogFlowVariableItem = {
  id: string;
  variableName: string;
  value: string;
  tableEnabled: boolean;
  tableColumns: string[];
  local: boolean;
};

export type DialogFlowVariableConfig = {
  items: DialogFlowVariableItem[];
};

export type DialogFlowFunctionParameterMapping = {
  id: string;
  parameterId: string;
  name: string;
  value: string;
};

export type DialogFlowFunctionOutputMapping = {
  id: string;
  parameterId: string;
  name: string;
  path: string;
  dataType: string;
  variableName: string;
  local: boolean;
};

export type DialogFlowFunctionOutputSchema = {
  id: string;
  name: string;
  path: string;
  dataType: DialogFlowFunctionDataType;
  description: string;
};

export type DialogFlowFunctionConfig = {
  iconOnly: boolean;
  apiId: string;
  methodId: string;
  resultVariableName: string;
  parameterMappings: DialogFlowFunctionParameterMapping[];
  outputMappings: DialogFlowFunctionOutputMapping[];
  outputSchema: DialogFlowFunctionOutputSchema[];
};

export type DialogFlowScriptParameter = {
  id: string;
  name: string;
  value: string;
};

export type DialogFlowScriptReturnVariable = {
  id: string;
  type: "string" | "array";
  variableName: string;
  scriptVariableName: string;
  local: boolean;
};

export type DialogFlowScriptConfig = {
  iconOnly: boolean;
  parameters: DialogFlowScriptParameter[];
  returnVariables: DialogFlowScriptReturnVariable[];
  code: string;
};

export type DialogFlowEndConfig = {
  message: string;
  endSessionImmediately: boolean;
};

type DialogFlowNodeBase = {
  id: string;
  kind: DialogFlowNodeKind;
  title: string;
  position: DialogFlowPosition;
};

export type DialogFlowNode =
  | (DialogFlowNodeBase & {
      kind: "start";
      config: {
        previewUtterance: string;
      };
    })
  | (DialogFlowNodeBase & {
      kind: "system-variable";
      config: Record<string, never>;
    })
  | (DialogFlowNodeBase & {
      kind: "talk";
      config: DialogFlowTalkConfig;
    })
  | (DialogFlowNodeBase & {
      kind: "jump";
      config: DialogFlowJumpConfig;
    })
  | (DialogFlowNodeBase & {
      kind: "condition";
      config: DialogFlowConditionConfig;
    })
  | (DialogFlowNodeBase & {
      kind: "function";
      config: DialogFlowFunctionConfig;
    })
  | (DialogFlowNodeBase & {
      kind: "variable";
      config: DialogFlowVariableConfig;
    })
  | (DialogFlowNodeBase & {
      kind: "script";
      config: DialogFlowScriptConfig;
    })
  | (DialogFlowNodeBase & {
      kind: "end";
      config: DialogFlowEndConfig;
    });

export type DialogFlowGraph = {
  id: string;
  dialogId: string;
  dialogNo: number;
  dialogType: VersionDialogType;
  name: string;
  nodes: DialogFlowNode[];
  links: DialogFlowLink[];
  updatedAt: string;
  updatedBy: string;
};

export type DialogFlowVariableInfo = {
  id: string;
  name: string;
  local: boolean;
  source: string;
  value: string;
};

export type DialogFlowCommonVariableInfo = {
  id: string;
  name: string;
  value: string;
};

export const FLOW_CARD_LABELS: Record<DialogFlowNodeKind, string> = {
  start: "대화 시작",
  "system-variable": "변수",
  talk: "Talk",
  jump: "Jump",
  condition: "Condition",
  function: "Function",
  variable: "Variable",
  script: "Script",
  end: "End",
};

export const FLOW_NODE_SIZES: Record<DialogFlowNodeKind, { width: number; height: number }> = {
  start: { width: 92, height: 96 },
  "system-variable": { width: 96, height: 102 },
  talk: { width: 96, height: 102 },
  jump: { width: 96, height: 102 },
  condition: { width: 102, height: 106 },
  function: { width: 96, height: 102 },
  variable: { width: 98, height: 104 },
  script: { width: 96, height: 102 },
  end: { width: 92, height: 96 },
};

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

function buildStartNodeId(dialogId: string) {
  return `flow-start-${dialogId}`;
}

function buildSystemVariableNodeId(dialogId: string) {
  return `flow-system-variable-${dialogId}`;
}

function buildSystemLinkId(dialogId: string) {
  return `flow-link-start-${dialogId}`;
}

export function isSystemFlowNode(node: DialogFlowNode) {
  return node.kind === "start" || node.kind === "system-variable";
}

function getFirstUtterancePreview(dialog: VersionDialogAsset) {
  return dialog.utterances[0]?.text?.trim() || "대화 시작 표현이 없습니다.";
}

function normalizePosition(
  value: unknown,
  fallback: DialogFlowPosition,
): DialogFlowPosition {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const source = value as Record<string, unknown>;
  const x = typeof source.x === "number" && Number.isFinite(source.x) ? source.x : fallback.x;
  const y = typeof source.y === "number" && Number.isFinite(source.y) ? source.y : fallback.y;
  return { x, y };
}

function isFlowNodeKind(value: unknown): value is DialogFlowNodeKind {
  return (
    value === "start" ||
    value === "system-variable" ||
    value === "talk" ||
    value === "jump" ||
    value === "condition" ||
    value === "function" ||
    value === "variable" ||
    value === "script" ||
    value === "end"
  );
}

function normalizeNodeTitle(kind: DialogFlowNodeKind, title: unknown) {
  return typeof title === "string" && title.trim() ? title.trim() : FLOW_CARD_LABELS[kind];
}

function buildDefaultConditionBranches() {
  return [
    {
      id: crypto.randomUUID(),
      label: "기본",
      operator: "else",
      compareValue: "",
    },
  ] satisfies DialogFlowConditionBranch[];
}

function isDialogFlowTalkMessageType(value: unknown): value is DialogFlowTalkMessageType {
  return (
    value === "text" ||
    value === "html" ||
    value === "card" ||
    value === "table" ||
    value === "button" ||
    value === "link-button" ||
    value === "form" ||
    value === "carousel" ||
    value === "dtmf" ||
    value === "form-a-card"
  );
}

function normalizeTalkChannelTemplate(value: unknown): DialogFlowTalkChannelTemplate {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const messages = Array.isArray(source.messages)
    ? source.messages.map((item) => (typeof item === "string" ? item : "")).slice(0, 10)
    : [""];
  const tableColumnMappings = Array.isArray(source.tableColumnMappings)
    ? source.tableColumnMappings
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const mapping = item as Record<string, unknown>;
          return {
            id: typeof mapping.id === "string" && mapping.id.trim() ? mapping.id : crypto.randomUUID(),
            column: typeof mapping.column === "string" ? mapping.column.trim().slice(0, 100) : "",
            value: typeof mapping.value === "string" ? mapping.value : "",
          };
        })
        .filter((item): item is { id: string; column: string; value: string } => item !== null && item.column.length > 0)
    : [];
  const tableManualRows = Array.isArray(source.tableManualRows)
    ? source.tableManualRows
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const row = item as Record<string, unknown>;
          const values = Array.isArray(row.values)
            ? row.values.map((entry) => (typeof entry === "string" ? entry : "")).slice(0, 6)
            : [""];
          return {
            id: typeof row.id === "string" && row.id.trim() ? row.id : crypto.randomUUID(),
            key: typeof row.key === "string" ? row.key : "",
            values: values.length > 0 ? values : [""],
          };
        })
        .filter((item): item is { id: string; key: string; values: string[] } => item !== null)
    : [{ id: crypto.randomUUID(), key: "", values: [""] }];
  const linkButtonItems = Array.isArray(source.linkButtonItems)
    ? source.linkButtonItems
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const linkButton = item as Record<string, unknown>;
          return {
            id: typeof linkButton.id === "string" && linkButton.id.trim() ? linkButton.id : crypto.randomUUID(),
            label: typeof linkButton.label === "string" ? linkButton.label : "",
            url: typeof linkButton.url === "string" ? linkButton.url : "",
          };
        })
        .filter((item): item is { id: string; label: string; url: string } => item !== null)
    : [{ id: crypto.randomUUID(), label: "", url: "" }];

  return {
    messageType: isDialogFlowTalkMessageType(source.messageType) ? source.messageType : "text",
    messages: messages.length > 0 ? messages : [""],
    tableUseVariable: source.tableUseVariable !== false,
    tableVariableItemId: typeof source.tableVariableItemId === "string" ? source.tableVariableItemId : "",
    tableKeyColumn: typeof source.tableKeyColumn === "string" ? source.tableKeyColumn : "",
    tableColumnMappings,
    tableManualRows: tableManualRows.length > 0 ? tableManualRows : [{ id: crypto.randomUUID(), key: "", values: [""] }],
    linkButtonItems: linkButtonItems.length > 0 ? linkButtonItems : [{ id: crypto.randomUUID(), label: "", url: "" }],
  };
}

function normalizeTalkChannelTemplates(value: unknown): Record<string, DialogFlowTalkChannelTemplate> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([channelCode]) => channelCode.trim().length > 0)
      .map(([channelCode, template]) => [channelCode, normalizeTalkChannelTemplate(template)]),
  );
}
function normalizeTalkConfig(value: unknown): DialogFlowTalkConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      messageType: "text",
      templateChannel: "SM_CHAT",
      channelTemplates: {},
      basicMessages: [""],
      messages: [""],
      tableUseVariable: true,
      tableVariableItemId: "",
      tableKeyColumn: "",
      tableColumnMappings: [],
      tableManualRows: [{ id: crypto.randomUUID(), key: "", values: [""] }],
      linkButtonItems: [{ id: crypto.randomUUID(), label: "", url: "" }],
      responseType: "none",
      responseVariableName: "",
      responseLocal: false,
      responseEntityBindingIds: [],
      responseEntityExtractions: [],
      intentTransitionLocked: false,
      repeatType: "bot-setting",
      repeatCount: 3,
      floatingButtonMode: "bot-setting",
      floatingButtons: [],
    };
  }

  const source = value as Record<string, unknown>;
  const messages = Array.isArray(source.messages)
    ? source.messages
        .map((item) => (typeof item === "string" ? item : ""))
        .slice(0, 10)
    : [""];
  const basicMessages = Array.isArray(source.basicMessages)
    ? source.basicMessages
        .map((item) => (typeof item === "string" ? item : ""))
        .slice(0, 5)
    : source.messageType === "text"
      ? messages
      : [""];
  const tableManualRows = Array.isArray(source.tableManualRows)
    ? source.tableManualRows
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return null;
          }
          const row = item as Record<string, unknown>;
          const values = Array.isArray(row.values)
            ? row.values.map((value) => (typeof value === "string" ? value : "")).slice(0, 6)
            : [""];
          return {
            id: typeof row.id === "string" && row.id.trim() ? row.id : crypto.randomUUID(),
            key: typeof row.key === "string" ? row.key : "",
            values: values.length > 0 ? values : [""],
          };
        })
        .filter(
          (
            item,
          ): item is {
            id: string;
            key: string;
            values: string[];
          } => item !== null,
        )
    : [{ id: crypto.randomUUID(), key: "", values: [""] }];
  const linkButtonItems = Array.isArray(source.linkButtonItems)
    ? source.linkButtonItems
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return null;
          }
          const linkButton = item as Record<string, unknown>;
          return {
            id: typeof linkButton.id === "string" && linkButton.id.trim() ? linkButton.id : crypto.randomUUID(),
            label: typeof linkButton.label === "string" ? linkButton.label : "",
            url: typeof linkButton.url === "string" ? linkButton.url : "",
          };
        })
        .filter(
          (
            item,
          ): item is {
            id: string;
            label: string;
            url: string;
          } => item !== null,
        )
    : [{ id: crypto.randomUUID(), label: messages[0] ?? "", url: messages[1] ?? "" }];
  const floatingButtons = Array.isArray(source.floatingButtons)
    ? source.floatingButtons
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return null;
          }
          const button = item as Record<string, unknown>;
          return {
            id: typeof button.id === "string" && button.id.trim() ? button.id : crypto.randomUUID(),
            label: typeof button.label === "string" ? button.label : "",
            key: typeof button.key === "string" ? button.key : "",
            enabled: button.enabled !== false,
          };
        })
        .filter(
          (
            item,
          ): item is {
            id: string;
            label: string;
            key: string;
            enabled: boolean;
          } => item !== null,
        )
    : [];
  const responseEntityExtractions = Array.isArray(source.responseEntityExtractions)
    ? source.responseEntityExtractions
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return null;
          }
          const extraction = item as Record<string, unknown>;
          const entityId = typeof extraction.entityId === "string" ? extraction.entityId.trim() : "";
          const entityName = typeof extraction.entityName === "string" ? extraction.entityName.trim() : "";
          if (!entityId || !entityName) {
            return null;
          }
          return {
            id: typeof extraction.id === "string" && extraction.id.trim() ? extraction.id : entityId,
            entityId,
            entityName,
            variableName: typeof extraction.variableName === "string" ? extraction.variableName.trim() : "",
            required: extraction.required === true,
            local: extraction.local === true,
            chatbotMessages: Array.isArray(extraction.chatbotMessages)
              ? extraction.chatbotMessages.filter((message): message is string => typeof message === "string")
              : [],
          };
        })
        .filter(
          (
            item,
          ): item is {
            id: string;
            entityId: string;
            entityName: string;
            variableName: string;
            required: boolean;
            local: boolean;
            chatbotMessages: string[];
          } => item !== null,
        )
    : [];

  return {
    messageType:
      source.messageType === "html" ||
      source.messageType === "card" ||
      source.messageType === "table" ||
      source.messageType === "button" ||
      source.messageType === "link-button" ||
      source.messageType === "form" ||
      source.messageType === "carousel" ||
      source.messageType === "dtmf" ||
      source.messageType === "form-a-card"
        ? source.messageType
        : "text",
    templateChannel: typeof source.templateChannel === "string" && source.templateChannel.trim() ? source.templateChannel : "SM_CHAT",
    channelTemplates: normalizeTalkChannelTemplates(source.channelTemplates),
    basicMessages: basicMessages.length > 0 ? basicMessages : [""],
    messages: messages.length > 0 ? messages : [""],
    tableUseVariable: source.tableUseVariable !== false,
    tableVariableItemId: typeof source.tableVariableItemId === "string" ? source.tableVariableItemId : "",
    tableKeyColumn: typeof source.tableKeyColumn === "string" ? source.tableKeyColumn : "",
    tableColumnMappings: Array.isArray(source.tableColumnMappings)
      ? source.tableColumnMappings
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return null;
            }
            const mapping = item as Record<string, unknown>;
            return {
              id: typeof mapping.id === "string" && mapping.id.trim() ? mapping.id : crypto.randomUUID(),
              column: typeof mapping.column === "string" ? mapping.column.trim().slice(0, 100) : "",
              value: typeof mapping.value === "string" ? mapping.value : "",
            };
          })
          .filter(
            (
              item,
            ): item is {
              id: string;
              column: string;
              value: string;
            } => item !== null && item.column.length > 0,
          )
      : [],
    tableManualRows: tableManualRows.length > 0 ? tableManualRows : [{ id: crypto.randomUUID(), key: "", values: [""] }],
    linkButtonItems: linkButtonItems.length > 0 ? linkButtonItems : [{ id: crypto.randomUUID(), label: "", url: "" }],
    responseType:
      source.responseType === "single-select" ||
      source.responseType === "relay" ||
      source.responseType === "extract-entity" ||
      source.responseType === "form-relay" ||
      source.responseType === "tts-auto"
        ? source.responseType
        : "none",
    responseVariableName:
      typeof source.responseVariableName === "string" ? source.responseVariableName : "",
    responseLocal: source.responseLocal === true,
    responseEntityBindingIds: Array.isArray(source.responseEntityBindingIds)
      ? source.responseEntityBindingIds.filter((item): item is string => typeof item === "string")
      : [],
    responseEntityExtractions,
    intentTransitionLocked: source.intentTransitionLocked === true,
    repeatType: source.repeatType === "custom" ? "custom" : "bot-setting",
    repeatCount:
      typeof source.repeatCount === "number" && Number.isFinite(source.repeatCount)
        ? Math.max(1, Math.min(99, Math.round(source.repeatCount)))
        : 3,
    floatingButtonMode:
      source.floatingButtonMode === "disabled" || source.floatingButtonMode === "custom"
        ? source.floatingButtonMode
        : "bot-setting",
    floatingButtons,
  };
}

function normalizeJumpConfig(value: unknown): DialogFlowJumpConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      targetType: "card",
      targetCardId: "",
      targetDialogId: "",
      targetDialogName: "",
      targetDialogType: 1,
    };
  }

  const source = value as Record<string, unknown>;
  return {
    targetType: source.targetType === "dialog" ? "dialog" : "card",
    targetCardId: typeof source.targetCardId === "string" ? source.targetCardId : "",
    targetDialogId: typeof source.targetDialogId === "string" ? source.targetDialogId : "",
    targetDialogName: typeof source.targetDialogName === "string" ? source.targetDialogName : "",
    targetDialogType: source.targetDialogType === 0 ? 0 : 1,
  };
}

function normalizeConditionBranches(value: unknown) {
  if (!Array.isArray(value)) {
    return buildDefaultConditionBranches();
  }

  const branches = value
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const source = item as Record<string, unknown>;
      const operator = CONDITION_OPERATOR_OPTIONS.some((option) => option.value === source.operator)
        ? (source.operator as DialogFlowConditionOperator)
        : "equals";

      return {
        id: typeof source.id === "string" && source.id.trim() ? source.id : crypto.randomUUID(),
        label:
          typeof source.label === "string" && source.label.trim()
            ? source.label.trim()
            : operator === "else"
              ? "기본"
              : `조건 ${index + 1}`,
        operator,
        compareValue: typeof source.compareValue === "string" ? source.compareValue : "",
      } satisfies DialogFlowConditionBranch;
    })
    .filter((item): item is DialogFlowConditionBranch => item !== null);

  const nonElseBranches = branches.filter((branch) => branch.operator !== "else");
  const elseBranch = branches.find((branch) => branch.operator === "else");

  if (!elseBranch) {
    return [...nonElseBranches, buildDefaultConditionBranches()[0]];
  }

  return [...nonElseBranches, { ...elseBranch, label: "기본", compareValue: "" }];
}

function normalizeConditionConfig(value: unknown): DialogFlowConditionConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      variableName: "",
      hideLabels: false,
      branches: buildDefaultConditionBranches(),
    };
  }

  const source = value as Record<string, unknown>;
  return {
    variableName: typeof source.variableName === "string" ? source.variableName : "",
    hideLabels: source.hideLabels === true,
    branches: normalizeConditionBranches(source.branches),
  };
}

function normalizeVariableItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [
      {
        id: crypto.randomUUID(),
        variableName: "",
        value: "",
        tableEnabled: false,
        tableColumns: [],
        local: false,
      },
    ] satisfies DialogFlowVariableItem[];
  }

  const items = value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const source = item as Record<string, unknown>;
      const tableColumns = Array.isArray(source.tableColumns)
        ? source.tableColumns
            .map((column) => (typeof column === "string" ? column.trim().slice(0, 100) : ""))
            .filter((column) => column.length > 0)
        : [];
      return {
        id: typeof source.id === "string" && source.id.trim() ? source.id : crypto.randomUUID(),
        variableName: typeof source.variableName === "string" ? source.variableName : "",
        value: typeof source.value === "string" ? source.value : "",
        tableEnabled: source.tableEnabled === true,
        tableColumns,
        local: source.local === true,
      } satisfies DialogFlowVariableItem;
    })
    .filter((item): item is DialogFlowVariableItem => item !== null);

  return items.length > 0
    ? items
    : [
        {
          id: crypto.randomUUID(),
          variableName: "",
          value: "",
          tableEnabled: false,
          tableColumns: [],
          local: false,
        },
      ];
}

function normalizeVariableConfig(value: unknown): DialogFlowVariableConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      items: normalizeVariableItems([]),
    };
  }

  const source = value as Record<string, unknown>;
  return {
    items: normalizeVariableItems(source.items),
  };
}

function normalizeFunctionConfig(value: unknown): DialogFlowFunctionConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      iconOnly: false,
      apiId: "",
      methodId: "",
      resultVariableName: "apiResult",
      parameterMappings: [],
      outputMappings: [],
      outputSchema: [],
    };
  }

  const source = value as Record<string, unknown>;
  return {
    iconOnly: source.iconOnly === true,
    apiId: typeof source.apiId === "string" ? source.apiId : "",
    methodId: typeof source.methodId === "string" ? source.methodId : "",
    resultVariableName: typeof source.resultVariableName === "string" ? source.resultVariableName : "apiResult",
    parameterMappings: Array.isArray(source.parameterMappings)
      ? source.parameterMappings
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return null;
            }

            const mapping = item as Record<string, unknown>;
            return {
              id: typeof mapping.id === "string" ? mapping.id : crypto.randomUUID(),
              parameterId: typeof mapping.parameterId === "string" ? mapping.parameterId : "",
              name: typeof mapping.name === "string" ? mapping.name : "",
              value: typeof mapping.value === "string" ? mapping.value : "",
            } satisfies DialogFlowFunctionParameterMapping;
          })
          .filter((item): item is DialogFlowFunctionParameterMapping => item !== null)
      : [],
    outputMappings: Array.isArray(source.outputMappings)
      ? source.outputMappings
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return null;
            }

            const mapping = item as Record<string, unknown>;
            return {
              id: typeof mapping.id === "string" ? mapping.id : crypto.randomUUID(),
              parameterId: typeof mapping.parameterId === "string" ? mapping.parameterId : "",
              name: typeof mapping.name === "string" ? mapping.name : "",
              path: typeof mapping.path === "string" ? mapping.path : "",
              dataType: typeof mapping.dataType === "string" ? mapping.dataType : "string",
              variableName: typeof mapping.variableName === "string" ? mapping.variableName : "",
              local: mapping.local === true,
            } satisfies DialogFlowFunctionOutputMapping;
          })
          .filter((item): item is DialogFlowFunctionOutputMapping => item !== null)
      : [],
    outputSchema: Array.isArray(source.outputSchema)
      ? source.outputSchema
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return null;
            }

            const schema = item as Record<string, unknown>;
            return {
              id: typeof schema.id === "string" ? schema.id : crypto.randomUUID(),
              name: typeof schema.name === "string" ? schema.name : "",
              path: typeof schema.path === "string" ? schema.path : "",
              dataType: normalizeFunctionDataType(schema.dataType),
              description: typeof schema.description === "string" ? schema.description : "",
            } satisfies DialogFlowFunctionOutputSchema;
          })
          .filter((item): item is DialogFlowFunctionOutputSchema => item !== null)
      : [],
  };
}

function normalizeFunctionDataType(value: unknown): DialogFlowFunctionDataType {
  return value === "number" || value === "boolean" || value === "object" || value === "array"
    ? value
    : "string";
}

function normalizeScriptParameters(value: unknown): DialogFlowScriptParameter[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const source = item as Record<string, unknown>;
      return {
        id:
          typeof source.id === "string" && source.id.trim()
            ? source.id
            : crypto.randomUUID(),
        name: typeof source.name === "string" ? source.name : "",
        value: typeof source.value === "string" ? source.value : "",
      };
    })
    .filter((item): item is DialogFlowScriptParameter => item !== null);
}

function normalizeScriptReturnVariables(value: unknown): DialogFlowScriptReturnVariable[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const source = item as Record<string, unknown>;
      return {
        id:
          typeof source.id === "string" && source.id.trim()
            ? source.id
            : crypto.randomUUID(),
        type: source.type === "array" ? "array" : "string",
        variableName: typeof source.variableName === "string" ? source.variableName : "",
        scriptVariableName:
          typeof source.scriptVariableName === "string" ? source.scriptVariableName : "",
        local: source.local === true,
      };
    })
    .filter((item): item is DialogFlowScriptReturnVariable => item !== null);
}

function normalizeScriptConfig(value: unknown): DialogFlowScriptConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      iconOnly: false,
      parameters: [],
      returnVariables: [],
      code: "",
    };
  }

  const source = value as Record<string, unknown>;
  return {
    iconOnly: source.iconOnly === true,
    parameters: normalizeScriptParameters(source.parameters),
    returnVariables: normalizeScriptReturnVariables(source.returnVariables),
    code: typeof source.code === "string" ? source.code : "",
  };
}

function normalizeEndConfig(value: unknown): DialogFlowEndConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      message: "",
      endSessionImmediately: false,
    };
  }

  const source = value as Record<string, unknown>;
  return {
    message: typeof source.message === "string" ? source.message : "",
    endSessionImmediately: source.endSessionImmediately === true,
  };
}

function normalizeFlowNode(
  value: unknown,
  dialog: VersionDialogAsset,
): DialogFlowNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const rawKind = source.kind ?? source.type;
  if (!isFlowNodeKind(rawKind)) {
    return null;
  }

  const defaultPosition =
    rawKind === "start"
      ? { x: 120, y: 96 }
      : rawKind === "system-variable"
        ? { x: 280, y: 96 }
        : { x: 460, y: 96 };

  const base = {
    id:
      typeof source.id === "string" && source.id.trim()
        ? source.id
        : crypto.randomUUID(),
    kind: rawKind,
    title: normalizeNodeTitle(rawKind, source.title),
    position: normalizePosition(source.position, defaultPosition),
  } satisfies DialogFlowNodeBase;

  switch (rawKind) {
    case "start":
      return {
        ...base,
        kind: "start",
        title: "대화 시작",
        config: {
          previewUtterance:
            typeof (source.config as Record<string, unknown> | undefined)?.previewUtterance === "string"
              ? ((source.config as Record<string, unknown>).previewUtterance as string)
              : getFirstUtterancePreview(dialog),
        },
      };
    case "system-variable":
      return {
        ...base,
        kind: "system-variable",
        title: "변수",
        config: {},
      };
    case "talk":
      return {
        ...base,
        kind: "talk",
        config: normalizeTalkConfig(source.config),
      };
    case "jump":
      return {
        ...base,
        kind: "jump",
        config: normalizeJumpConfig(source.config),
      };
    case "condition":
      return {
        ...base,
        kind: "condition",
        config: normalizeConditionConfig(source.config),
      };
    case "function":
      return {
        ...base,
        kind: "function",
        config: normalizeFunctionConfig(source.config),
      };
    case "variable":
      return {
        ...base,
        kind: "variable",
        config: normalizeVariableConfig(source.config),
      };
    case "script":
      return {
        ...base,
        kind: "script",
        config: normalizeScriptConfig(source.config),
      };
    case "end":
      return {
        ...base,
        kind: "end",
        config: normalizeEndConfig(source.config),
      };
    default:
      return null;
  }
}

function normalizeLinkKind(value: unknown, sourcePort: string): DialogFlowLinkKind {
  if (value === "condition" || value === "jump" || value === "default") {
    return value;
  }

  if (sourcePort.startsWith("branch:")) {
    return "condition";
  }

  if (sourcePort === "jump") {
    return "jump";
  }

  return "default";
}

function normalizeFlowLinks(value: unknown, nodes: DialogFlowNode[]) {
  if (!Array.isArray(value)) {
    return [] as DialogFlowLink[];
  }

  const nodeIds = new Set(nodes.map((node) => node.id));

  const normalizedLinks = value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const source = item as Record<string, unknown>;
      const sourceNodeId =
        typeof source.sourceNodeId === "string" ? source.sourceNodeId : "";
      const targetNodeId =
        typeof source.targetNodeId === "string" ? source.targetNodeId : "";
      const sourcePort = typeof source.sourcePort === "string" ? source.sourcePort : "next";
      const waypoints = Array.isArray(source.waypoints)
        ? source.waypoints
            .map((item) => {
              if (!item || typeof item !== "object" || Array.isArray(item)) {
                return null;
              }

              const point = item as Record<string, unknown>;
              return {
                x:
                  typeof point.x === "number" && Number.isFinite(point.x)
                    ? point.x
                    : null,
                y:
                  typeof point.y === "number" && Number.isFinite(point.y)
                    ? point.y
                    : null,
              };
            })
            .filter(
              (
                item,
              ): item is {
                x: number;
                y: number;
              } => item !== null && item.x !== null && item.y !== null,
            )
        : [];

      if (!sourceNodeId || !targetNodeId) {
        return null;
      }

      if (!nodeIds.has(sourceNodeId) || !nodeIds.has(targetNodeId)) {
        return null;
      }

      return {
        id:
          typeof source.id === "string" && source.id.trim()
            ? source.id
            : crypto.randomUUID(),
        sourceNodeId,
        sourcePort,
        targetNodeId,
        kind: normalizeLinkKind(source.kind, sourcePort),
        waypoints,
      } satisfies DialogFlowLink;
    })
    .filter((item): item is DialogFlowLink => item !== null);

  const linksBySourcePort = new Map<string, DialogFlowLink>();
  normalizedLinks.forEach((link) => {
    const key = `${link.sourceNodeId}\u0000${link.sourcePort}`;
    if (!linksBySourcePort.has(key)) {
      linksBySourcePort.set(key, link);
    }
  });
  return Array.from(linksBySourcePort.values());
}

function ensureSystemNodes(
  dialog: VersionDialogAsset,
  nodes: DialogFlowNode[],
  links: DialogFlowLink[],
) {
  const startNodeId = buildStartNodeId(dialog.id);
  const startLikeIds = new Set(
    nodes
      .filter((node) => node.id === startNodeId || node.kind === "start")
      .map((node) => node.id),
  );
  startLikeIds.add(startNodeId);

  const existingStartNode =
    nodes.find((node) => node.id === startNodeId) ??
    nodes.find((node) => node.kind === "start");
  const refreshedStartNode = {
    ...(existingStartNode ?? {}),
    id: startNodeId,
    kind: "start",
    title: "대화 시작",
    position: existingStartNode?.position ?? { x: 120, y: 96 },
    config: {
      ...(existingStartNode?.config ?? {}),
      previewUtterance: getFirstUtterancePreview(dialog),
    },
  } as DialogFlowNode;

  const refreshedNodes = [
    refreshedStartNode,
    ...nodes.filter((node) => !startLikeIds.has(node.id) && node.kind !== "start"),
  ];

  const seenLinks = new Set<string>();
  const refreshedLinks = links
    .map((link) => ({
      ...link,
      sourceNodeId: startLikeIds.has(link.sourceNodeId) ? startNodeId : link.sourceNodeId,
      targetNodeId: startLikeIds.has(link.targetNodeId) ? startNodeId : link.targetNodeId,
    }))
    .filter((link) => link.sourceNodeId !== link.targetNodeId)
    .filter((link) => {
      const key = `${link.sourceNodeId}\u0000${link.sourcePort}\u0000${link.targetNodeId}\u0000${link.kind}`;
      if (seenLinks.has(key)) return false;
      seenLinks.add(key);
      return true;
    });

  return {
    nodes: refreshedNodes,
    links: refreshedLinks,
  };
}

export function createDefaultDialogFlowGraph(
  dialog: VersionDialogAsset,
): DialogFlowGraph {
  const nodes: DialogFlowNode[] = [
    {
      id: buildStartNodeId(dialog.id),
      kind: "start",
      title: "대화 시작",
      position: { x: 120, y: 96 },
      config: {
        previewUtterance: getFirstUtterancePreview(dialog),
      },
    },
    {
      id: buildSystemVariableNodeId(dialog.id),
      kind: "system-variable",
      title: "변수",
      position: { x: 280, y: 96 },
      config: {},
    },
  ];

  return {
    id: `flow-${dialog.id}`,
    dialogId: dialog.id,
    dialogNo: dialog.dialogNo,
    dialogType: dialog.dialogType,
    name: dialog.name,
    nodes,
    links: [
      {
        id: buildSystemLinkId(dialog.id),
        sourceNodeId: buildStartNodeId(dialog.id),
        sourcePort: "next",
        targetNodeId: buildSystemVariableNodeId(dialog.id),
        kind: "default",
        waypoints: [],
      },
    ],
    updatedAt: dialog.updatedAt,
    updatedBy: dialog.updatedBy,
  };
}

export function getDialogFlowGraph(
  document: VersionDocument,
  dialog: VersionDialogAsset,
): DialogFlowGraph {
  const sourceGraph = document.dialog_flow_graphs.find((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }
    return (item as Record<string, unknown>).dialogId === dialog.id;
  });

  if (!sourceGraph || typeof sourceGraph !== "object" || Array.isArray(sourceGraph)) {
    return createDefaultDialogFlowGraph(dialog);
  }

  const source = sourceGraph as Record<string, unknown>;
  const graph = createDefaultDialogFlowGraph(dialog);
  const nodes = Array.isArray(source.nodes)
    ? source.nodes
        .map((item) => normalizeFlowNode(item, dialog))
        .filter((item): item is DialogFlowNode => item !== null)
    : [];
  const links = normalizeFlowLinks(source.links, nodes);
  const withSystems = ensureSystemNodes(dialog, nodes, links);

  return {
    id:
      typeof source.id === "string" && source.id.trim()
        ? source.id
        : graph.id,
    dialogId: dialog.id,
    dialogNo:
      typeof source.dialogNo === "number" && Number.isFinite(source.dialogNo)
        ? source.dialogNo
        : dialog.dialogNo,
    dialogType: dialog.dialogType,
    name: dialog.name,
    nodes: withSystems.nodes,
    links: withSystems.links,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : dialog.updatedAt,
    updatedBy: typeof source.updatedBy === "string" ? source.updatedBy : dialog.updatedBy,
  };
}

export function putDialogFlowGraph(
  document: VersionDocument,
  graph: DialogFlowGraph,
): VersionDocument {
  const nextGraphs = document.dialog_flow_graphs.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return true;
    }

    return (item as Record<string, unknown>).dialogId !== graph.dialogId;
  });

  nextGraphs.push(graph as unknown as Record<string, unknown>);

  return {
    ...document,
    dialog_flow_graphs: nextGraphs,
  };
}

function getNodeIndexByKind(nodes: DialogFlowNode[], kind: DialogFlowNodeKind) {
  return nodes.filter((node) => node.kind === kind && !isSystemFlowNode(node)).length + 1;
}

export function createDialogFlowNode(
  kind: Exclude<DialogFlowNodeKind, "start" | "system-variable">,
  position: DialogFlowPosition,
  nodes: DialogFlowNode[],
): DialogFlowNode {
  const index = getNodeIndexByKind(nodes, kind);
  const title = `${FLOW_CARD_LABELS[kind]} ${index}`;

  switch (kind) {
    case "talk":
      return {
        id: crypto.randomUUID(),
        kind,
        title,
        position,
        config: {
          messageType: "text",
          templateChannel: "SM_CHAT",
          channelTemplates: {},
          basicMessages: [""],
          messages: [""],
          tableUseVariable: true,
          tableVariableItemId: "",
          tableKeyColumn: "",
          tableColumnMappings: [],
          tableManualRows: [{ id: crypto.randomUUID(), key: "", values: [""] }],
          linkButtonItems: [{ id: crypto.randomUUID(), label: "", url: "" }],
          responseType: "none",
          responseVariableName: "",
          responseLocal: false,
          responseEntityBindingIds: [],
          responseEntityExtractions: [],
          intentTransitionLocked: false,
          repeatType: "bot-setting",
          repeatCount: 3,
          floatingButtonMode: "bot-setting",
          floatingButtons: [],
        },
      };
    case "jump":
      return {
        id: crypto.randomUUID(),
        kind,
        title,
        position,
        config: {
          targetType: "card",
          targetCardId: "",
          targetDialogId: "",
          targetDialogName: "",
          targetDialogType: 1,
        },
      };
    case "condition":
      return {
        id: crypto.randomUUID(),
        kind,
        title,
        position,
        config: {
          variableName: "",
          hideLabels: false,
          branches: [],
        },
      };
    case "function":
      return {
        id: crypto.randomUUID(),
        kind,
        title,
        position,
        config: {
          iconOnly: false,
          apiId: "",
          methodId: "",
          resultVariableName: "apiResult",
          parameterMappings: [],
          outputMappings: [],
          outputSchema: [],
        },
      };
    case "variable":
      return {
        id: crypto.randomUUID(),
        kind,
        title,
        position,
        config: {
          items: [
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
      };
    case "script":
      return {
        id: crypto.randomUUID(),
        kind,
        title,
        position,
        config: {
          iconOnly: false,
          parameters: [],
          returnVariables: [],
          code: "",
        },
      };
    case "end":
      return {
        id: crypto.randomUUID(),
        kind,
        title,
        position,
        config: {
          message: "",
          endSessionImmediately: false,
        },
      };
  }
}

export function getFlowLinkTargetId(
  graph: DialogFlowGraph,
  sourceNodeId: string,
  sourcePort = "next",
) {
  return (
    graph.links.find(
      (link) => link.sourceNodeId === sourceNodeId && link.sourcePort === sourcePort,
    )?.targetNodeId ?? ""
  );
}

export function setFlowLinkTarget(
  graph: DialogFlowGraph,
  sourceNodeId: string,
  sourcePort: string,
  targetNodeId: string,
  waypoints: DialogFlowPosition[] = [],
): DialogFlowGraph {
  const nextLinks = graph.links.filter(
    (link) => !(link.sourceNodeId === sourceNodeId && link.sourcePort === sourcePort),
  );

  if (targetNodeId) {
    nextLinks.push({
      id: crypto.randomUUID(),
      sourceNodeId,
      sourcePort,
      targetNodeId,
      kind: normalizeLinkKind(undefined, sourcePort),
      waypoints,
    });
  }

  return {
    ...graph,
    links: nextLinks,
  };
}

export function removeFlowNode(graph: DialogFlowGraph, nodeId: string): DialogFlowGraph {
  const nextNodes = graph.nodes.filter((node) => node.id !== nodeId);
  const nextLinks = graph.links.filter(
    (link) => link.sourceNodeId !== nodeId && link.targetNodeId !== nodeId,
  );

  return {
    ...graph,
    nodes: nextNodes.map((node) => {
      if (
        node.kind === "jump" &&
        node.config.targetType === "card" &&
        node.config.targetCardId === nodeId
      ) {
        return {
          ...node,
          config: {
            ...node.config,
            targetCardId: "",
          },
        };
      }

      return node;
    }),
    links: nextLinks,
  };
}

export function countManualFlowCards(graph: DialogFlowGraph) {
  return graph.nodes.filter((node) => node.kind !== "start").length;
}

export function buildNextCanvasPosition(graph: DialogFlowGraph): DialogFlowPosition {
  const maxY = graph.nodes.reduce((maxValue, node) => {
    const size = FLOW_NODE_SIZES[node.kind];
    return Math.max(maxValue, node.position.y + size.height);
  }, 96);

  return {
    x: 460,
    y: maxY + 92,
  };
}

export function addConditionBranch(
  branches: DialogFlowConditionBranch[],
): DialogFlowConditionBranch[] {
  const elseBranch = branches.find((branch) => branch.operator === "else") ?? {
    id: crypto.randomUUID(),
    label: "기본",
    operator: "else" as const,
    compareValue: "",
  };
  const regularBranches = branches.filter((branch) => branch.operator !== "else");

  return [
    ...regularBranches,
    {
      id: crypto.randomUUID(),
      label: `조건 ${regularBranches.length + 1}`,
      operator: "equals",
      compareValue: "",
    },
    { ...elseBranch, label: "기본", compareValue: "" },
  ];
}

export function removeConditionBranch(
  branches: DialogFlowConditionBranch[],
  branchId: string,
) {
  const nextBranches = branches.filter(
    (branch) => branch.id !== branchId || branch.operator === "else",
  );

  const regularBranches = nextBranches.filter((branch) => branch.operator !== "else");
  const elseBranch = nextBranches.find((branch) => branch.operator === "else") ?? {
    id: crypto.randomUUID(),
    label: "기본",
    operator: "else" as const,
    compareValue: "",
  };

  return [
    ...regularBranches.map((branch, index) => ({
      ...branch,
      label: `조건 ${index + 1}`,
    })),
    { ...elseBranch, label: "기본", compareValue: "" },
  ];
}

export function stripVariablePrefix(value: string) {
  const trimmed = value.trim();
  return trimmed.replace(/^\$+/, "").trim();
}

export function formatVariableName(value: string) {
  const normalized = stripVariablePrefix(value);
  return normalized ? `$${normalized}` : "";
}

function isJavaScriptStyleVariableName(value: string) {
  return /^(?!_)[\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*$/u.test(value);
}

export function validateVariableName(
  value: string,
  existingNames: string[],
  currentName?: string,
) {
  const normalized = stripVariablePrefix(value);
  if (!normalized) {
    return "변수명을 입력해주세요.";
  }

  if (normalized.startsWith("_")) {
    return "`$_`로 시작하는 변수명은 시스템 변수 예약어라 사용할 수 없습니다.";
  }

  if (
    !isJavaScriptStyleVariableName(normalized) ||
    JAVASCRIPT_RESERVED_WORDS.has(normalized)
  ) {
    return "변수명은 JavaScript/Node.js 규칙에 맞게 입력해주세요.";
  }

  const normalizedCurrent = currentName ? stripVariablePrefix(currentName).toLowerCase() : "";
  const hasDuplicate = existingNames.some((item) => {
    const normalizedItem = stripVariablePrefix(item).toLowerCase();
    return normalizedItem !== normalizedCurrent && normalizedItem === normalized.toLowerCase();
  });

  if (hasDuplicate) {
    return `'$${normalized}' 변수명은 이미 등록되어 있습니다.`;
  }

  return null;
}

export function collectDialogFlowVariables(
  dialog: VersionDialogAsset,
  graph: DialogFlowGraph,
): DialogFlowVariableInfo[] {
  const entityVariables = dialog.entityBindings.map((binding) => ({
    id: `entity-${binding.id}`,
    name: formatVariableName(binding.variableName) || `$${binding.variableName}`,
    local: binding.local,
    source: "대화 시작 개체",
    value: binding.entityValue,
  }));

  const variableCardVariables = graph.nodes.flatMap((node) => {
    if (node.kind !== "variable") {
      return [];
    }

    return node.config.items
      .filter((item) => stripVariablePrefix(item.variableName))
      .map((item) => ({
        id: item.id,
        name: formatVariableName(item.variableName),
        local: item.local,
        source: node.title,
        value: item.value,
      }));
  });

  const scriptReturnVariables = graph.nodes.flatMap((node) => {
    if (node.kind !== "script") {
      return [];
    }

    return node.config.returnVariables
      .filter((item) => stripVariablePrefix(item.variableName))
      .map((item) => ({
        id: item.id,
        name: formatVariableName(item.variableName),
        local: item.local,
        source: node.title,
        value: item.scriptVariableName,
      }));
  });

  const functionOutputVariables = graph.nodes.flatMap((node) => {
    if (node.kind !== "function") {
      return [];
    }

    const mappedVariables = node.config.outputMappings
      .filter((item) => stripVariablePrefix(item.variableName))
      .map((item) => ({
        id: item.id,
        name: formatVariableName(item.variableName),
        local: item.local,
        source: node.title,
        value: item.path || item.name,
      }));

    if (mappedVariables.length > 0) {
      return mappedVariables;
    }

    const fallbackName = stripVariablePrefix(node.config.resultVariableName);
    return fallbackName
      ? [
          {
            id: `${node.id}-result`,
            name: formatVariableName(fallbackName),
            local: false,
            source: node.title,
            value: "root",
          },
        ]
      : [];
  });

  return [...entityVariables, ...variableCardVariables, ...scriptReturnVariables, ...functionOutputVariables];
}

export function collectCommonFlowVariables(
  document: VersionDocument,
): DialogFlowCommonVariableInfo[] {
  const systemConfig =
    document.system_config && typeof document.system_config === "object"
      ? (document.system_config as Record<string, unknown>)
      : {};
  const rawItems = (
    systemConfig.common_variables ??
    systemConfig.commonVariables ??
    []
  ) as unknown;

  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const source = item as Record<string, unknown>;
      const name = typeof source.name === "string" ? source.name.trim() : "";
      if (!name) {
        return null;
      }

      return {
        id:
          typeof source.id === "string" && source.id.trim()
            ? source.id
            : `common-${index}`,
        name: formatVariableName(name),
        value: typeof source.value === "string" ? source.value : "",
      } satisfies DialogFlowCommonVariableInfo;
    })
    .filter((item): item is DialogFlowCommonVariableInfo => item !== null);
}
