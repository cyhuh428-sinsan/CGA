import {
  normalizeVersionDialogs,
  normalizeVersionDocument,
  type VersionDialogAsset,
  type VersionDialogType,
  type VersionDocument,
} from "@/lib/version-document";
import {
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
} from "@/lib/studio-bots-api";

export function getBotDialogs(bot?: StudioBotApiItem | null): VersionDialogAsset[] {
  return normalizeVersionDialogs(normalizeVersionDocument(bot?.active_version?.version_json).dialogs);
}

export function getVersionDialogs(version?: StudioBotVersionApiItem | null): VersionDialogAsset[] {
  return normalizeVersionDialogs(normalizeVersionDocument(version?.version_json).dialogs);
}

export function getNextDialogNo(dialogs: VersionDialogAsset[]) {
  const currentMax = dialogs.reduce(
    (maxValue, item) => (item.dialogNo > maxValue ? item.dialogNo : maxValue),
    100000,
  );
  return currentMax + 1;
}

export function getDialogTypeLabel(dialogType: VersionDialogType) {
  return dialogType === 0 ? "모듈" : "의도";
}

export function getDialogValidationLabel(dialog: VersionDialogAsset) {
  switch (dialog.validationStatus) {
    case "success":
      return "성공";
    case "failure":
      return "실패";
    default:
      return "-";
  }
}

export function withUpdatedDialogs(
  document: VersionDocument,
  dialogs: VersionDialogAsset[],
): VersionDocument {
  return {
    ...document,
    dialogs,
  };
}

export function withEnsuredDialogFlowGraph(
  document: VersionDocument,
  dialog: VersionDialogAsset,
): VersionDocument {
  const nextFlowGraphs = Array.isArray(document.dialog_flow_graphs)
    ? [...document.dialog_flow_graphs]
    : [];

  const hasExistingGraph = nextFlowGraphs.some((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }
    return (item as Record<string, unknown>).dialogId === dialog.id;
  });

  if (hasExistingGraph) {
    return document;
  }

  nextFlowGraphs.push({
    id: `flow-${dialog.id}`,
    dialogId: dialog.id,
    dialogNo: dialog.dialogNo,
    dialogType: dialog.dialogType,
    name: dialog.name,
    nodes: [],
    links: [],
    updatedAt: dialog.updatedAt,
    updatedBy: dialog.updatedBy,
  });

  return {
    ...document,
    dialog_flow_graphs: nextFlowGraphs,
  };
}

export function applyUpdatedVersionToBot(
  bot: StudioBotApiItem,
  version: StudioBotVersionApiItem,
): StudioBotApiItem {
  if (!bot.active_version || bot.active_version.id !== version.id) {
    return bot;
  }

  return {
    ...bot,
    active_version: version,
    active_version_id: version.id,
    updated_at: version.updated_at ?? bot.updated_at,
  };
}

function jsonContainsValue(source: unknown, needle: string) {
  if (!needle) {
    return false;
  }

  try {
    return JSON.stringify(source).includes(needle);
  } catch {
    return false;
  }
}

function getStringField(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

function findExternalDialogJumpReferences(graph: Record<string, unknown>, dialog: VersionDialogAsset) {
  if (getStringField(graph, "dialogId") === dialog.id) {
    return [];
  }

  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  return nodes.flatMap((node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      return [];
    }

    const source = node as Record<string, unknown>;
    const config = source.config && typeof source.config === "object" && !Array.isArray(source.config)
      ? source.config as Record<string, unknown>
      : {};
    const targetType = getStringField(config, "targetType");
    const targetDialogId = getStringField(config, "targetDialogId");
    const targetDialogName = getStringField(config, "targetDialogName");

    if (source.kind !== "jump" || targetType !== "dialog") {
      return [];
    }

    const matched = targetDialogId === dialog.id || (!targetDialogId && targetDialogName === dialog.name);
    if (!matched) {
      return [];
    }

    const graphName = getStringField(graph, "name") || "이름 없는 대화설계";
    const nodeTitle = getStringField(source, "title") || "Jump";
    return [`대화설계 '${graphName}'의 '${nodeTitle}' Jump`];
  });
}

export function findDialogUsageReferences(
  document: VersionDocument,
  dialog: VersionDialogAsset,
) {
  const usages = new Set<string>();

  for (const graph of document.dialog_flow_graphs) {
    if (!graph || typeof graph !== "object" || Array.isArray(graph)) {
      continue;
    }

    const source = graph as Record<string, unknown>;
    findExternalDialogJumpReferences(source, dialog).forEach((usage) => usages.add(usage));
  }

  for (const rule of document.rules) {
    if (jsonContainsValue(rule, dialog.id) || jsonContainsValue(rule, dialog.name)) {
      usages.add("룰");
    }
  }

  return [...usages];
}

export function buildDialogSearchText(dialog: VersionDialogAsset) {
  return [
    dialog.dialogNo,
    dialog.name,
    dialog.displayName,
    dialog.dialogKey,
    getDialogTypeLabel(dialog.dialogType),
    dialog.classificationType,
    ...dialog.tags,
    ...dialog.utterances.map((item) => item.text),
    getDialogValidationLabel(dialog),
  ]
    .join(" ")
    .toLowerCase();
}

export function buildDialogTargetHref(
  botId: string,
  versionId: string,
  dialog: VersionDialogAsset,
) {
  const encodedBotId = encodeURIComponent(botId);
  const encodedVersionId = encodeURIComponent(versionId);

  if (dialog.dialogType === 0) {
    return `/studio/bots/${encodedBotId}/versions/${encodedVersionId}/flows/${dialog.id}`;
  }

  return `/studio/bots/${encodedBotId}/versions/${encodedVersionId}/intents/${dialog.id}`;
}
