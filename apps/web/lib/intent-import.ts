export type IntentUploadRow = {
  name: string;
  displayName: string;
  dialogKey: string;
  utterance: string;
  tags: string[];
  answer: string;
};

export type IntentUploadGroup = {
  name: string;
  displayName: string;
  dialogKey: string;
  utterances: string[];
  tags: string[];
  answer: string;
};

export type IntentExportDialog = {
  id: string;
  dialogType: number;
  name: string;
  displayName: string;
  dialogKey: string;
  tags: string[];
  utterances: Array<{ text: string }>;
};

function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuote && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (char === "," && !inQuote) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvText(text: string) {
  const normalizedText = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let currentLine = "";
  let inQuote = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const char = normalizedText[index];
    const nextChar = normalizedText[index + 1];

    if (char === '"' && inQuote && nextChar === '"') {
      currentLine += '""';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuote = !inQuote;
    }
    if (char === "\n" && !inQuote) {
      if (currentLine.trim()) {
        rows.push(splitCsvLine(currentLine));
      }
      currentLine = "";
      continue;
    }
    currentLine += char;
  }

  if (currentLine.trim()) {
    rows.push(splitCsvLine(currentLine));
  }
  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

function getCellByHeaders(
  cells: string[],
  headerMap: Map<string, number>,
  keys: string[],
  fallbackIndex: number,
) {
  for (const key of keys) {
    const index = headerMap.get(normalizeHeader(key));
    if (index != null) {
      return cells[index]?.trim() ?? "";
    }
  }
  return cells[fallbackIndex]?.trim() ?? "";
}

export function parseIntentImportRows(text: string): IntentUploadRow[] {
  const rows = parseCsvText(text);
  if (rows.length === 0) {
    return [];
  }

  const firstRow = rows[0].map(normalizeHeader);
  const hasHeader = firstRow.some((cell) =>
    ["의도명", "intentname", "학습문장", "utterance"].includes(cell),
  );
  const headerMap = new Map<string, number>();
  const dataRows = hasHeader ? rows.slice(1) : rows;

  if (hasHeader) {
    rows[0].forEach((header, index) => {
      headerMap.set(normalizeHeader(header), index);
    });
  }

  return dataRows
    .map((cells) => {
      const name = getCellByHeaders(cells, headerMap, ["의도명", "Intent Name", "intentName", "name"], 0);
      const displayName = getCellByHeaders(cells, headerMap, ["표시명", "Display Name", "displayName"], 1);
      const dialogKey = getCellByHeaders(cells, headerMap, ["의도 Key", "Intent Key", "dialogKey"], 2);
      const utterance = getCellByHeaders(cells, headerMap, ["학습문장", "Utterance", "utterance"], 3);
      const tagText = getCellByHeaders(cells, headerMap, ["태그", "Tags", "tags"], 4);
      const answer = getCellByHeaders(cells, headerMap, ["답변", "Answer", "answer"], 5);

      return {
        name,
        displayName,
        dialogKey,
        utterance,
        tags: tagText.split(/[|;]/).map((item) => item.trim()).filter(Boolean),
        answer,
      };
    })
    .filter((row) =>
      row.name || row.displayName || row.dialogKey || row.utterance || row.tags.length > 0 || row.answer,
    );
}

export function groupIntentImportRows(rows: IntentUploadRow[]): IntentUploadGroup[] {
  const groups = new Map<string, IntentUploadGroup>();

  rows.forEach((row) => {
    const name = row.name.trim();
    if (!name) {
      return;
    }

    const key = name.replace(/\s+/g, " ").toLowerCase();
    const current = groups.get(key) ?? {
      name,
      displayName: "",
      dialogKey: "",
      utterances: [],
      tags: [],
      answer: "",
    };
    const utterance = row.utterance.trim();

    groups.set(key, {
      ...current,
      displayName: row.displayName.trim() || current.displayName,
      dialogKey: row.dialogKey.trim() || current.dialogKey,
      utterances: utterance ? [...current.utterances, utterance] : current.utterances,
      tags: [...new Set([...current.tags, ...row.tags])],
      answer: current.answer || row.answer.trim(),
    });
  });

  return [...groups.values()];
}

export function findMissingNewIntentAnswerNames(
  groups: IntentUploadGroup[],
  existingIntentNames: Iterable<string>,
) {
  const existingKeys = new Set(
    [...existingIntentNames].map((name) => name.trim().replace(/\s+/g, " ").toLowerCase()),
  );
  return groups
    .filter((group) => !existingKeys.has(group.name.trim().replace(/\s+/g, " ").toLowerCase()) && !group.answer)
    .map((group) => group.name);
}

export function buildIntentUploadTemplateCsv() {
  return [
    ["의도명", "표시명", "의도 Key", "학습문장", "태그", "답변"],
    ["주문조회", "주문조회", "", "주문 상태 알려줘", "주문|배송", "주문조회입니다"],
  ].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function buildIntentDownloadCsv(
  dialogs: IntentExportDialog[],
  answersByDialogId: ReadonlyMap<string, string>,
) {
  const rows = [["의도명", "표시명", "의도 Key", "학습문장", "태그", "답변"]];

  dialogs.filter((dialog) => dialog.dialogType === 1).forEach((dialog) => {
    const tags = dialog.tags.join("|");
    const answer = answersByDialogId.get(dialog.id) ?? "";
    if (dialog.utterances.length === 0) {
      rows.push([dialog.name, dialog.displayName, dialog.dialogKey, "", tags, answer]);
      return;
    }
    dialog.utterances.forEach((utterance) => {
      rows.push([dialog.name, dialog.displayName, dialog.dialogKey, utterance.text, tags, answer]);
    });
  });

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}
