const designerStyle = `
  :host {
    --dacd-bg: #edf1f7;
    --dacd-panel: #ffffff;
    --dacd-panel-soft: #f7f9fc;
    --dacd-line: #d9e0ec;
    --dacd-text: #172033;
    --dacd-muted: #68758a;
    --dacd-accent: #0f6cbd;
    --dacd-accent-soft: rgba(15, 108, 189, 0.1);
    --dacd-danger: #c13734;
    --dacd-shadow: 0 18px 40px rgba(25, 36, 61, 0.08);
    display: block;
    min-height: 100%;
    color: var(--dacd-text);
    font-family: "Malgun Gothic", "Segoe UI", sans-serif;
  }
  * { box-sizing: border-box; }
  .dacd-shell {
    min-height: 100vh;
    background: var(--dacd-bg);
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 18px;
    padding: 22px;
  }
  .dacd-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 18px 20px;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid var(--dacd-line);
    border-radius: 22px;
    box-shadow: var(--dacd-shadow);
  }
  .dacd-title { font-size: 24px; font-weight: 800; }
  .dacd-subtitle { margin-top: 6px; color: var(--dacd-muted); font-size: 13px; line-height: 1.5; }
  .dacd-tabs {
    display: inline-flex;
    border: 1px solid var(--dacd-line);
    border-radius: 999px;
    overflow: hidden;
    background: #ffffff;
    flex: 0 0 auto;
  }
  .dacd-tab {
    border: 0;
    background: transparent;
    padding: 10px 16px;
    cursor: pointer;
    font-weight: 700;
    color: var(--dacd-muted);
  }
  .dacd-tab.active { background: var(--dacd-accent); color: #ffffff; }
  .dacd-workspace {
    display: grid;
    grid-template-columns: minmax(620px, 1fr) minmax(320px, 420px);
    grid-template-areas:
      "designer preview"
      "output output";
    gap: 18px;
    min-height: 0;
  }
  .dacd-panel {
    background: var(--dacd-panel);
    border: 1px solid var(--dacd-line);
    border-radius: 22px;
    box-shadow: var(--dacd-shadow);
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .dacd-designer-panel { grid-area: designer; }
  .dacd-preview-panel { grid-area: preview; }
  .dacd-output-panel { grid-area: output; }
  .dacd-panel-header {
    padding: 18px 18px 14px;
    border-bottom: 1px solid var(--dacd-line);
    font-weight: 800;
  }
  .dacd-panel-body {
    padding: 18px;
    overflow: auto;
    display: grid;
    gap: 12px;
    align-content: start;
  }
  .dacd-input-builder {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr) 320px;
    gap: 18px;
    align-items: stretch;
  }
  .dacd-toolbox {
    background: linear-gradient(180deg, #0f141d 0%, #131927 100%);
    color: #edf2ff;
    border-radius: 18px;
    padding: 16px;
    display: grid;
    gap: 14px;
    align-content: start;
    min-height: 520px;
  }
  .dacd-toolbox-title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #dbe7ff;
  }
  .dacd-toolbox-search {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(8, 11, 18, 0.4);
    color: #f7f9ff;
    border-radius: 12px;
    padding: 10px 12px;
  }
  .dacd-toolbox-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .dacd-toolbox-filter {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: #dbe7ff;
    border-radius: 999px;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 700;
  }
  .dacd-toolbox-filter.active {
    background: rgba(121, 184, 255, 0.18);
    border-color: rgba(121, 184, 255, 0.36);
    color: #ffffff;
  }
  .dacd-toolbox-list {
    display: grid;
    gap: 8px;
  }
  .dacd-toolbox-btn {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: #edf2ff;
    border-radius: 12px;
    padding: 10px 12px;
    cursor: pointer;
    text-align: left;
    font-weight: 700;
  }
  .dacd-toolbox-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  .dacd-toolbox-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .dacd-canvas {
    min-height: 520px;
    border: 1px solid var(--dacd-line);
    border-radius: 18px;
    background: linear-gradient(180deg, #f8faff 0%, #f2f5fb 100%);
    padding: 18px;
    display: grid;
    gap: 12px;
    align-content: start;
  }
  .dacd-empty-canvas {
    min-height: 220px;
    border: 1px dashed #c3d3ef;
    border-radius: 16px;
    background: rgba(15, 108, 189, 0.04);
    color: #6f83a8;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 13px;
    line-height: 1.6;
    padding: 18px;
  }
  .dacd-canvas.drag-over,
  .dacd-empty-canvas.drag-over {
    border-color: var(--dacd-accent);
    background: rgba(15, 108, 189, 0.1);
  }
  .dacd-data-key-btn {
    border: 1px solid #bfd2ef;
    border-radius: 999px;
    background: #f6f9ff;
    color: #315d9a;
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 800;
    cursor: grab;
  }
  .dacd-data-key-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .dacd-field { display: grid; gap: 6px; }
  .dacd-field span { font-size: 12px; color: var(--dacd-muted); font-weight: 700; white-space: nowrap; }
  input, textarea, select {
    width: 100%;
    border: 1px solid var(--dacd-line);
    border-radius: 12px;
    padding: 9px 10px;
    font: inherit;
    color: var(--dacd-text);
    background: #ffffff;
  }
  textarea {
    min-height: 150px;
    resize: vertical;
    font-family: Consolas, "Malgun Gothic", monospace;
    font-size: 12px;
    line-height: 1.5;
  }
  .dacd-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .dacd-btn {
    border: 1px solid var(--dacd-line);
    border-radius: 12px;
    background: #ffffff;
    padding: 8px 11px;
    cursor: pointer;
    font-weight: 700;
    color: var(--dacd-text);
  }
  .dacd-btn.primary { background: var(--dacd-accent); color: #ffffff; border-color: var(--dacd-accent); }
  .dacd-btn.danger { color: var(--dacd-danger); border-color: rgba(193, 55, 52, 0.28); }
  .dacd-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .dacd-list { display: grid; gap: 8px; }
  .dacd-chip-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .dacd-chip {
    border: 1px solid #bfd2ef;
    border-radius: 999px;
    background: #f6f9ff;
    color: #315d9a;
    padding: 6px 9px;
    font-size: 12px;
    font-weight: 700;
  }
  .dacd-card {
    border: 1px solid var(--dacd-line);
    border-radius: 16px;
    padding: 14px;
    display: grid;
    gap: 12px;
    background: #fbfcfe;
  }
  .dacd-card[draggable="true"] {
    cursor: grab;
  }
  .dacd-card[draggable="true"]:active {
    cursor: grabbing;
  }
  .dacd-card-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .dacd-card-title { font-weight: 800; word-break: keep-all; }
  .dacd-mini { font-size: 12px; color: var(--dacd-muted); }
  .dacd-design-section {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 0.42fr);
    gap: 12px;
    align-items: start;
  }
  .dacd-output-field-list,
  .dacd-input-field-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    gap: 10px;
  }
  .dacd-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .dacd-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .dacd-grid-4 { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(120px, 1fr) minmax(96px, 130px) 74px; gap: 10px; align-items: end; }
  .dacd-output-visible-row { justify-content: space-between; }
  .dacd-error {
    color: var(--dacd-danger);
    background: #fff4f4;
    border: 1px solid rgba(193, 55, 52, 0.18);
    padding: 9px 10px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.5;
  }
  .dacd-preview-card {
    width: 100%;
    border: 1px solid #d5dce8;
    border-radius: 8px;
    background: #ffffff;
    padding: 16px;
    display: grid;
    gap: 12px;
  }
  .dacd-textblock { line-height: 1.5; word-break: keep-all; overflow-wrap: normal; }
  .dacd-textblock.title { font-size: 18px; font-weight: 800; }
  .dacd-factset { display: grid; gap: 8px; }
  .dacd-fact { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 16px; }
  .dacd-fact strong { word-break: keep-all; }
  .dacd-columnset {
    display: grid;
    gap: 12px;
    align-items: stretch;
    width: 100%;
  }
  .dacd-column {
    min-width: 0;
    border: 1px solid var(--dacd-line);
    border-radius: 12px;
    padding: 10px;
    display: grid;
    gap: 6px;
    align-content: start;
    background: #fbfcff;
  }
  .dacd-card.selected {
    border-color: rgba(15, 108, 189, 0.55);
    box-shadow: 0 0 0 3px rgba(15, 108, 189, 0.1);
  }
  .dacd-output-toolbox-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .dacd-output-builder {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr) 320px;
    gap: 14px;
    align-items: stretch;
  }
  .dacd-table-editor {
    display: grid;
    gap: 10px;
  }
  .dacd-table-editor-toolbar {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .dacd-table-editor-grid {
    display: grid;
    gap: 6px;
  }
  .dacd-table-editor-grid input {
    min-width: 0;
    padding: 8px 10px;
    font-size: 12px;
  }
  .dacd-output-commandbar {
    display: grid;
    gap: 10px;
    margin-bottom: 14px;
  }
  .dacd-command-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .dacd-side-textarea { min-height: 92px; max-height: 140px; resize: vertical; }
  .dacd-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
    background: rgba(15, 23, 42, 0.34);
    display: grid;
    place-items: center;
    padding: 24px;
  }
  .dacd-modal {
    width: min(860px, 96vw);
    max-height: 88vh;
    overflow: auto;
    background: #ffffff;
    border: 1px solid var(--dacd-line);
    border-radius: 16px;
    box-shadow: 0 22px 60px rgba(15, 23, 42, 0.24);
  }
  .dacd-modal-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    padding: 16px 18px;
    border-bottom: 1px solid var(--dacd-line);
  }
  .dacd-modal-body { padding: 18px; display: grid; gap: 14px; }
  .dacd-modal textarea { min-height: 220px; }
  .dacd-properties {
    border: 1px solid var(--dacd-line);
    border-radius: 18px;
    background: #ffffff;
    overflow: hidden;
  }
  .dacd-properties-header {
    padding: 16px;
    border-bottom: 1px solid var(--dacd-line);
  }
  .dacd-properties-header h3 {
    margin: 0 0 6px;
    font-size: 18px;
  }
  .dacd-properties-header p {
    margin: 0;
    color: var(--dacd-muted);
    font-size: 13px;
    line-height: 1.5;
  }
  .dacd-properties-body {
    padding: 14px;
    display: grid;
    gap: 12px;
  }
  .dacd-properties-section {
    color: #68758a;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .dacd-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
  .dacd-action { border: 1px solid #c9d3e2; background: #ffffff; padding: 9px 14px; border-radius: 4px; font-weight: 700; }
  .dacd-form-preview { display: grid; gap: 12px; }
  .dacd-json-output { min-height: 260px; }
  .dacd-json-output.compact { min-height: 150px; }
  .dacd-json-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
    gap: 14px;
  }
  .dacd-pill {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--dacd-line);
    border-radius: 999px;
    padding: 5px 8px;
    font-size: 12px;
    color: var(--dacd-muted);
    background: #ffffff;
  }
  @media (max-width: 1280px) {
    .dacd-workspace {
      grid-template-columns: 1fr;
      grid-template-areas:
        "designer"
        "preview"
        "output";
    }
    .dacd-preview-panel { max-height: none; }
  }
  @media (max-width: 760px) {
    .dacd-shell { padding: 12px; }
    .dacd-topbar { align-items: stretch; flex-direction: column; border-radius: 18px; }
    .dacd-tabs { width: 100%; }
    .dacd-tab { flex: 1; }
    .dacd-grid-2, .dacd-grid-3, .dacd-grid-4, .dacd-json-grid, .dacd-output-field-list, .dacd-input-field-list { grid-template-columns: 1fr; }
    .dacd-design-section { grid-template-columns: 1fr; }
    .dacd-input-builder, .dacd-output-builder { grid-template-columns: 1fr; }
  }
`;

const DEFAULT_OUTPUT_JSON = `{
  "userName": "홍길동",
  "departmentName": "AI전략팀",
  "remainingLeaveDays": 12,
  "expireDate": "2026-12-31"
}`;

const DEFAULT_CSV = `userName,departmentName,remainingLeaveDays,expireDate
홍길동,AI전략팀,12,2026-12-31
김다온,인사팀,8,2026-11-30`;

const KOREAN_HEADER_ALIASES = {
  이름: "userName",
  성명: "userName",
  사용자명: "userName",
  사용자이름: "userName",
  직원명: "employeeName",
  사원명: "employeeName",
  부서: "departmentName",
  부서명: "departmentName",
  부서코드: "departmentCode",
  직급: "positionName",
  직책: "roleName",
  이메일: "email",
  메일: "email",
  전화번호: "phoneNumber",
  휴대폰번호: "mobileNumber",
  날짜: "date",
  시작일: "startDate",
  종료일: "endDate",
  만료일: "expireDate",
  남은연차: "remainingLeaveDays",
  잔여연차: "remainingLeaveDays",
};

function toCamelCase(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const compact = text.replace(/\s+/g, "");
  if (KOREAN_HEADER_ALIASES[compact]) return KOREAN_HEADER_ALIASES[compact];
  const ascii = text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
  if (!ascii) return text;
  const words = ascii.split(/\s+/);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function isCamelCase(value) {
  return /^[a-z][a-zA-Z0-9]*$/.test(String(value || ""));
}

function makeUniqueKey(key, used, fallbackKey) {
  let base = isCamelCase(key) ? key : fallbackKey;
  if (!isCamelCase(base)) base = "field";
  let next = base;
  let index = 2;
  while (used.has(next)) {
    next = `${base}${index}`;
    index += 1;
  }
  used.add(next);
  return next;
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
  return rows;
}

function csvToJson(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = buildCsvHeaderMap(rows[0]).map((item) => item.key);
  return rows.slice(1).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header || `field${index + 1}`] = row[index] ?? "";
    });
    return item;
  });
}

function buildCsvHeaderMap(headers) {
  const used = new Set();
  return headers.map((header, index) => {
    const converted = toCamelCase(header);
    const fallbackKey = `field${index + 1}`;
    return {
      source: String(header || "").trim(),
      key: makeUniqueKey(converted, used, fallbackKey),
    };
  });
}

function getCsvHeaderMap(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  return buildCsvHeaderMap(rows[0]);
}

function bindTemplate(value, data) {
  if (typeof value === "string") {
    return value.replace(/\$\{([^}]+)\}/g, (_, key) => {
      const trimmed = String(key).trim();
      return data?.[trimmed] ?? "";
    });
  }
  if (Array.isArray(value)) return value.map((item) => bindTemplate(item, data));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, bindTemplate(item, data)]));
  }
  return value;
}

function getRows(data) {
  if (Array.isArray(data)) return data.filter((item) => item && typeof item === "object");
  if (data && typeof data === "object") return [data];
  return [];
}

function getDataKeys(data) {
  const keys = new Set();
  getRows(data).forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
  return Array.from(keys);
}

function labelFromKey(key) {
  return String(key || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}

function normalizeOutputFields(data, currentFields = []) {
  const currentByKey = new Map(currentFields.map((field) => [field.key, field]));
  return getDataKeys(data).map((key) => ({
    key,
    label: currentByKey.get(key)?.label || labelFromKey(key) || key,
    element: currentByKey.get(key)?.element || "Fact",
    visible: currentByKey.get(key)?.visible ?? true,
  }));
}

class DaonAdaptiveCardDesigner extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.mode = "input";
    this.inputFields = [];
    this.outputData = JSON.parse(DEFAULT_OUTPUT_JSON);
    this.csvText = DEFAULT_CSV;
    this.outputLayout = "grid";
    this.outputFields = [];
    this.selectedInputIndex = null;
    this.selectedOutputIndex = null;
    this.toolboxSearch = "";
    this.toolboxFilter = "all";
    this.outputPanel = null;
    this.render();
  }

  connectedCallback() {
    this.bindEvents();
    this.refreshAll();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>${designerStyle}</style>
      <div class="dacd-shell">
        <header class="dacd-topbar">
          <div>
            <div class="dacd-title">Daon Adaptive Card Designer</div>
            <div class="dacd-subtitle">입력용 Form 카드와 출력용 Data 카드를 분리해서 설계합니다.</div>
          </div>
          <div class="dacd-tabs">
            <button class="dacd-tab active" data-mode="input" type="button">입력용</button>
            <button class="dacd-tab" data-mode="output" type="button">출력용</button>
          </div>
        </header>
        <main class="dacd-workspace">
          <section class="dacd-panel dacd-designer-panel">
            <div class="dacd-panel-header" data-left-title>입력 필드</div>
            <div class="dacd-panel-body" data-left></div>
          </section>
          <section class="dacd-panel dacd-preview-panel">
            <div class="dacd-panel-header" data-center-title>미리보기</div>
            <div class="dacd-panel-body" data-preview></div>
          </section>
          <section class="dacd-panel dacd-output-panel">
            <div class="dacd-panel-header">생성 JSON</div>
            <div class="dacd-panel-body">
              <div class="dacd-json-grid">
                <label class="dacd-field">
                  <span>Adaptive Card JSON</span>
                  <textarea class="dacd-json-output" data-output-json readonly></textarea>
                </label>
                <label class="dacd-field">
                  <span data-data-json-title>Submit Data JSON</span>
                  <textarea class="dacd-json-output compact" data-data-json readonly></textarea>
                </label>
              </div>
              <div class="dacd-row">
                <button class="dacd-btn primary" data-copy-output type="button">Card JSON 복사</button>
                <button class="dacd-btn" data-copy-data type="button">Data JSON 복사</button>
                <button class="dacd-btn" data-download-output type="button">Card JSON 다운로드</button>
                <button class="dacd-btn" data-copy-meta type="button">Meta JSON 복사</button>
              </div>
              <details>
                <summary class="dacd-mini">Runtime Meta JSON 보기</summary>
                <textarea class="dacd-json-output" data-meta-json readonly></textarea>
              </details>
              <div data-validation></div>
            </div>
          </section>
        </main>
      </div>
    `;
  }

  bindEvents() {
    this.shadowRoot.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        this.mode = button.dataset.mode;
        this.shadowRoot.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("active", item === button));
        this.refreshAll();
      });
    });

    this.shadowRoot.addEventListener("click", (event) => {
      const target = event.target.closest("button");
      const inputCard = event.target.closest("[data-select-input-field]");
      const outputCard = event.target.closest("[data-select-output-field]");
      if (inputCard) {
        this.selectedInputIndex = Number(inputCard.dataset.selectInputField);
        this.renderLeftPanel();
      }
      if (outputCard) {
        this.selectedOutputIndex = Number(outputCard.dataset.selectOutputField);
        this.renderLeftPanel();
      }
      if (!target) return;

      if (target.matches("[data-add-field]")) this.addField();
      if (target.matches("[data-add-element]")) this.addElement(target.dataset.addElement);
      if (target.matches("[data-clear-input]")) this.clearInputFields();
      if (target.matches("[data-output-panel]")) {
        this.outputPanel = target.dataset.outputPanel;
        this.renderLeftPanel();
      }
      if (target.matches("[data-close-output-panel]")) {
        this.outputPanel = null;
        this.renderLeftPanel();
      }
      if (target.matches("[data-toolbox-filter]")) {
        this.toolboxFilter = target.dataset.toolboxFilter;
        this.renderLeftPanel();
      }
      if (target.matches("[data-remove-field]")) this.removeField(Number(target.dataset.removeField));
      if (target.matches("[data-csv-convert]")) this.convertCsv();
      if (target.matches("[data-sync-fields]")) this.syncOutputFields();
      if (target.matches("[data-add-output-key]")) this.addOutputField(target.dataset.addOutputKey);
      if (target.matches("[data-add-output-element]")) this.addOutputElement(target.dataset.addOutputElement);
      if (target.matches("[data-remove-output-field]")) this.removeOutputField(Number(target.dataset.removeOutputField));
      if (target.matches("[data-move-output-field]")) this.moveOutputField(Number(target.dataset.moveOutputField), target.dataset.direction);
      if (target.matches("[data-table-action]")) {
        this.applyTableAction(
          target.dataset.tableScope,
          Number(target.dataset.tableIndex),
          target.dataset.tableAction
        );
      }
      if (target.matches("[data-container-add]")) {
        this.addContainerItem(
          target.dataset.containerScope,
          Number(target.dataset.containerIndex),
          target.dataset.containerAdd
        );
      }
      if (target.matches("[data-container-remove]")) {
        this.removeContainerItem(
          target.dataset.containerScope,
          Number(target.dataset.containerIndex),
          Number(target.dataset.containerRemove)
        );
      }
      if (target.matches("[data-columnset-action]")) {
        this.applyColumnSetAction(
          target.dataset.columnsetScope,
          Number(target.dataset.columnsetIndex),
          target.dataset.columnsetAction
        );
      }
      if (target.matches("[data-column-item-remove]")) {
        this.removeColumnItem(
          target.dataset.columnScope,
          Number(target.dataset.columnsetIndex),
          Number(target.dataset.columnIndex),
          Number(target.dataset.columnItemIndex)
        );
      }
      if (target.matches("[data-copy-output]")) this.copyOutput();
      if (target.matches("[data-copy-data]")) this.copyData();
      if (target.matches("[data-copy-meta]")) this.copyMeta();
      if (target.matches("[data-download-output]")) this.downloadOutput();
    });

    this.shadowRoot.addEventListener("input", (event) => {
      const target = event.target;
      if (target.matches("[data-field-prop]")) {
        const index = Number(target.dataset.fieldIndex);
        const prop = target.dataset.fieldProp;
        this.updateFieldProperty(this.inputFields[index], prop, target.type === "checkbox" ? target.checked : target.value);
        this.refreshPreviewAndOutput();
      }
      if (target.matches("[data-output-data]")) {
        try {
          this.outputData = JSON.parse(target.value || "{}");
          const keys = new Set(getDataKeys(this.outputData));
          this.outputFields = this.outputFields.filter((field) => keys.has(field.key));
          this.renderLeftPanel();
          this.refreshPreviewAndOutput();
        } catch {
          this.writeValidation("Input Data JSON 형식이 올바르지 않습니다.");
        }
      }
      if (target.matches("[data-csv-input]")) {
        this.csvText = target.value;
      }
      if (target.matches("[data-toolbox-search]")) {
        this.toolboxSearch = target.value;
        this.renderLeftPanel();
      }
      if (target.matches("[data-output-layout]")) {
        this.outputLayout = target.value;
        this.refreshPreviewAndOutput();
      }
      if (target.matches("[data-output-field-prop]")) {
        const index = Number(target.dataset.outputFieldIndex);
        const prop = target.dataset.outputFieldProp;
        this.updateFieldProperty(this.outputFields[index], prop, target.type === "checkbox" ? target.checked : target.value);
        this.refreshPreviewAndOutput();
      }
      if (target.matches("[data-table-cell]")) {
        this.updateTableCellText(
          target.dataset.tableScope,
          Number(target.dataset.tableIndex),
          Number(target.dataset.tableRow),
          Number(target.dataset.tableColumn),
          target.value
        );
      }
      if (target.matches("[data-container-item-field]")) {
        this.updateContainerItem(
          target.dataset.containerScope,
          Number(target.dataset.containerIndex),
          Number(target.dataset.containerItemIndex),
          target.dataset.containerItemField,
          target.value
        );
      }
      if (target.matches("[data-column-width]")) {
        this.updateColumnWidth(
          target.dataset.columnScope,
          Number(target.dataset.columnsetIndex),
          Number(target.dataset.columnIndex),
          target.value
        );
      }
    });

    this.shadowRoot.addEventListener("dragstart", (event) => {
      if (event.target.closest("button, input, textarea, select")) return;
      const inputCard = event.target.closest("[data-drag-input-index]");
      const outputCard = event.target.closest("[data-drag-output-index]");
      const inputTool = event.target.closest("[data-add-element]");
      const outputKey = event.target.closest("[data-add-output-key]");
      const outputElement = event.target.closest("[data-add-output-element]");
      if (inputCard) {
        event.dataTransfer.setData("text/plain", `input-move:${inputCard.dataset.dragInputIndex}`);
        event.dataTransfer.effectAllowed = "move";
        return;
      }
      if (outputCard) {
        event.dataTransfer.setData("text/plain", `output-move:${outputCard.dataset.dragOutputIndex}`);
        event.dataTransfer.effectAllowed = "move";
        return;
      }
      if (inputTool && !inputTool.disabled) event.dataTransfer.setData("text/plain", `input:${inputTool.dataset.addElement}`);
      if (outputKey && !outputKey.disabled) event.dataTransfer.setData("text/plain", `output:${outputKey.dataset.addOutputKey}`);
      if (outputElement && !outputElement.disabled) event.dataTransfer.setData("text/plain", `output-element:${outputElement.dataset.addOutputElement}`);
    });

    this.shadowRoot.addEventListener("dragover", (event) => {
      const containerDrop = event.target.closest("[data-container-drop]");
      const columnDrop = event.target.closest("[data-column-drop]");
      const inputCanvas = event.target.closest("[data-input-canvas]");
      const outputCanvas = event.target.closest("[data-output-canvas]");
      if (!containerDrop && !columnDrop && !inputCanvas && !outputCanvas) return;
      event.preventDefault();
      (containerDrop || columnDrop || inputCanvas || outputCanvas).classList.add("drag-over");
    });

    this.shadowRoot.addEventListener("dragleave", (event) => {
      const canvas = event.target.closest("[data-container-drop], [data-column-drop], [data-input-canvas], [data-output-canvas]");
      if (canvas) canvas.classList.remove("drag-over");
    });

    this.shadowRoot.addEventListener("drop", (event) => {
      const containerDrop = event.target.closest("[data-container-drop]");
      const inputCanvas = event.target.closest("[data-input-canvas]");
      const outputCanvas = event.target.closest("[data-output-canvas]");
      const inputTarget = event.target.closest("[data-select-input-field]");
      const outputTarget = event.target.closest("[data-select-output-field]");
      const payload = event.dataTransfer.getData("text/plain");
      if (containerDrop && (payload.startsWith("input:") || payload.startsWith("output-element:"))) {
        event.preventDefault();
        containerDrop.classList.remove("drag-over");
        const type = payload.startsWith("input:")
          ? payload.slice("input:".length)
          : payload.slice("output-element:".length);
        this.addContainerItem(
          containerDrop.dataset.containerScope,
          Number(containerDrop.dataset.containerIndex),
          type
        );
        return;
      }
      const columnDrop = event.target.closest("[data-column-drop]");
      if (columnDrop && (payload.startsWith("input:") || payload.startsWith("output-element:"))) {
        event.preventDefault();
        columnDrop.classList.remove("drag-over");
        const type = payload.startsWith("input:")
          ? payload.slice("input:".length)
          : payload.slice("output-element:".length);
        this.addColumnItem(
          columnDrop.dataset.columnScope,
          Number(columnDrop.dataset.columnsetIndex),
          Number(columnDrop.dataset.columnIndex),
          type
        );
        return;
      }
      if (inputCanvas && payload.startsWith("input-move:")) {
        event.preventDefault();
        inputCanvas.classList.remove("drag-over");
        this.moveFieldByDrop(
          "input",
          Number(payload.slice("input-move:".length)),
          inputTarget ? Number(inputTarget.dataset.selectInputField) : null,
          inputTarget ? this.getDropPlacement(event, inputTarget) : "below"
        );
        return;
      }
      if (outputCanvas && payload.startsWith("output-move:")) {
        event.preventDefault();
        outputCanvas.classList.remove("drag-over");
        this.moveFieldByDrop(
          "output",
          Number(payload.slice("output-move:".length)),
          outputTarget ? Number(outputTarget.dataset.selectOutputField) : null,
          outputTarget ? this.getDropPlacement(event, outputTarget) : "below"
        );
        return;
      }
      if (inputCanvas && payload.startsWith("input:")) {
        event.preventDefault();
        inputCanvas.classList.remove("drag-over");
        this.addElement(payload.slice("input:".length));
      }
      if (outputCanvas && payload.startsWith("output:")) {
        event.preventDefault();
        outputCanvas.classList.remove("drag-over");
        this.addOutputField(payload.slice("output:".length));
      }
      if (outputCanvas && payload.startsWith("output-element:")) {
        event.preventDefault();
        outputCanvas.classList.remove("drag-over");
        this.addOutputElement(payload.slice("output-element:".length));
      }
    });
  }

  refreshAll() {
    this.renderLeftPanel();
    this.refreshPreviewAndOutput();
  }

  renderLeftPanel() {
    const title = this.shadowRoot.querySelector("[data-left-title]");
    const centerTitle = this.shadowRoot.querySelector("[data-center-title]");
    const left = this.shadowRoot.querySelector("[data-left]");

    if (this.mode === "input") {
      title.textContent = "입력 Form 설계";
      centerTitle.textContent = "입력용 카드 미리보기";
      left.innerHTML = `
        <div class="dacd-input-builder">
          ${this.renderElementToolbox()}
          <div class="dacd-canvas" data-input-canvas>
            <div class="dacd-row">
              <button class="dacd-btn primary" data-add-element="Input.Text" type="button">Input.Text 추가</button>
              <span class="dacd-pill">Input id는 camelCase</span>
            </div>
            ${
              this.inputFields.length > 0
                ? `<div class="dacd-input-field-list">${this.inputFields.map((field, index) => this.renderFieldEditor(field, index)).join("")}</div>`
                : `<div class="dacd-empty-canvas">왼쪽 Element Toolbox의 요소를 이 빈 공간에 끌어다 놓아 입력 화면을 구성합니다.</div>`
            }
          </div>
          ${this.renderInputProperties()}
        </div>
      `;
    } else {
      title.textContent = "출력 디자인";
      centerTitle.textContent = "출력용 카드 미리보기";
      left.innerHTML = `
        <div class="dacd-output-commandbar">
          <div class="dacd-command-row">
            <button class="dacd-btn" data-output-panel="options" type="button">출력 옵션</button>
            <button class="dacd-btn" data-sync-fields type="button">데이터 필드 동기화</button>
            <button class="dacd-btn" data-output-panel="data" type="button">Input Data 확인</button>
            <button class="dacd-btn" data-output-panel="csv" type="button">CSV 변환</button>
          </div>
        </div>
        <div class="dacd-output-builder">
          ${this.renderOutputToolbox()}
          <div class="dacd-canvas" data-output-canvas>
            <div class="dacd-row" style="justify-content: space-between; margin-bottom: 10px;">
              <div class="dacd-card-title">출력 디자인 캔버스</div>
              <span class="dacd-pill">Element와 Data Key를 배치</span>
            </div>
            <div class="dacd-output-field-list" data-output-fields></div>
          </div>
          ${this.renderOutputProperties()}
        </div>
        ${this.renderOutputUtilityPanel()}
      `;
      this.renderOutputFields();
    }
  }

  renderOutputUtilityPanel() {
    if (!this.outputPanel) return "";
    if (this.outputPanel === "options") {
      return `
        <div class="dacd-modal-backdrop">
          <section class="dacd-modal">
            <div class="dacd-modal-head">
              <div class="dacd-card-title">출력 옵션</div>
              <button class="dacd-btn" data-close-output-panel type="button">닫기</button>
            </div>
            <div class="dacd-modal-body">
              <label class="dacd-field">
                <span>표현 방식</span>
                <select data-output-layout>
                  <option value="grid" ${this.outputLayout === "grid" ? "selected" : ""}>그리드</option>
                  <option value="facts" ${this.outputLayout === "facts" ? "selected" : ""}>FactSet</option>
                  <option value="list" ${this.outputLayout === "list" ? "selected" : ""}>목록</option>
                </select>
              </label>
              <div class="dacd-row">
                <button class="dacd-btn primary" data-sync-fields type="button">데이터 필드 동기화</button>
              </div>
            </div>
          </section>
        </div>
      `;
    }
    if (this.outputPanel === "csv") {
      return `
        <div class="dacd-modal-backdrop">
          <section class="dacd-modal">
            <div class="dacd-modal-head">
              <div class="dacd-card-title">CSV 변환 확인</div>
              <button class="dacd-btn" data-close-output-panel type="button">닫기</button>
            </div>
            <div class="dacd-modal-body">
              <label class="dacd-field">
                <span>헤더 CSV</span>
                <textarea data-csv-input>${escapeHtml(this.csvText)}</textarea>
              </label>
              <div class="dacd-row">
                <button class="dacd-btn primary" data-csv-convert type="button">CSV를 JSON으로 변환</button>
              </div>
              <div class="dacd-card">
                <div class="dacd-card-title">CSV header 변환</div>
                <div class="dacd-list">
                  ${getCsvHeaderMap(this.csvText).map((item) => `
                    <div class="dacd-mini">${escapeHtml(item.source || "(빈 header)")} → <strong>${escapeHtml(item.key)}</strong></div>
                  `).join("") || `<span class="dacd-mini">CSV header가 없습니다.</span>`}
                </div>
              </div>
            </div>
          </section>
        </div>
      `;
    }
    return `
      <div class="dacd-modal-backdrop">
        <section class="dacd-modal">
          <div class="dacd-modal-head">
            <div class="dacd-card-title">Input Data 확인</div>
            <button class="dacd-btn" data-close-output-panel type="button">닫기</button>
          </div>
          <div class="dacd-modal-body">
            <label class="dacd-field">
              <span>Input Data JSON</span>
              <textarea data-output-data>${escapeHtml(formatJson(this.outputData))}</textarea>
            </label>
          </div>
        </section>
      </div>
    `;
  }

  renderOutputFields() {
    const host = this.shadowRoot.querySelector("[data-output-fields]");
    if (!host) return;
    host.innerHTML = this.outputFields.length > 0
      ? this.outputFields.map((field, index) => this.renderOutputFieldEditor(field, index)).join("")
      : `<div class="dacd-empty-canvas">감지된 데이터 키를 이 빈 공간에 끌어다 놓아 출력 화면을 구성합니다.</div>`;
  }

  renderInputProperties() {
    const field = Number.isInteger(this.selectedInputIndex) ? this.inputFields[this.selectedInputIndex] : null;
    if (!field) {
      return `
        <aside class="dacd-properties">
          <div class="dacd-properties-header">
            <h3>Element Properties</h3>
          </div>
          <div class="dacd-properties-body">
            <div class="dacd-mini">No selection</div>
          </div>
        </aside>
      `;
    }
    return this.renderElementProperties(field, this.selectedInputIndex, "input");
  }

  renderOutputProperties() {
    const field = Number.isInteger(this.selectedOutputIndex) ? this.outputFields[this.selectedOutputIndex] : null;
    if (!field) {
      return `
        <aside class="dacd-properties">
          <div class="dacd-properties-header">
            <h3>Element Properties</h3>
          </div>
          <div class="dacd-properties-body">
            <div class="dacd-mini">No selection</div>
          </div>
        </aside>
      `;
    }
    if (field.kind === "Element") {
      return this.renderElementProperties(field, this.selectedOutputIndex, "output");
    }
    return `
      <aside class="dacd-properties">
        <div class="dacd-properties-header">
          <h3>Element Properties</h3>
        </div>
        <div class="dacd-properties-body">
          <div class="dacd-properties-section">Common</div>
          <label class="dacd-field"><span>Type</span><input value="Data Field" readonly /></label>
          <label class="dacd-field"><span>Data key</span><input value="${escapeAttr(field.key || "")}" readonly /></label>
          <div class="dacd-properties-section">Properties</div>
          <label class="dacd-field"><span>화면 라벨</span><input data-output-field-index="${this.selectedOutputIndex}" data-output-field-prop="label" value="${escapeAttr(field.label || "")}" /></label>
          <label class="dacd-field"><span>표현</span><select data-output-field-index="${this.selectedOutputIndex}" data-output-field-prop="element">
            ${["Fact", "TextBlock", "Title"].map((type) => `<option value="${type}" ${field.element === type ? "selected" : ""}>${type}</option>`).join("")}
          </select></label>
          <label class="dacd-row">
            <input style="width:auto" type="checkbox" data-output-field-index="${this.selectedOutputIndex}" data-output-field-prop="visible" ${field.visible ? "checked" : ""} />
            <span class="dacd-mini">표시</span>
          </label>
        </div>
      </aside>
    `;
  }

  renderElementProperties(field, index, scope) {
    const isOutput = scope === "output";
    const propPrefix = isOutput ? `data-output-field-index="${index}" data-output-field-prop` : `data-field-index="${index}" data-field-prop`;
    const type = field.type || "TextBlock";
    const body = this.renderElementPropertyBody(field, index, scope, propPrefix);
    return `
      <aside class="dacd-properties">
        <div class="dacd-properties-header">
          <h3>Element Properties</h3>
        </div>
        <div class="dacd-properties-body">
          <div class="dacd-properties-section">Common</div>
          <label class="dacd-field"><span>Type</span><input value="${escapeAttr(type)}" readonly /></label>
          ${field.id || type.startsWith("Input.") ? `<label class="dacd-field"><span>Id</span><input ${propPrefix}="id" value="${escapeAttr(field.id || "")}" /></label>` : ""}
          <label class="dacd-field"><span>Spacing</span><select ${propPrefix}="spacing">
            ${["", "None", "Small", "Default", "Medium", "Large", "ExtraLarge", "Padding"].map((value) => `<option value="${value}" ${field.spacing === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}
          </select></label>
          <label class="dacd-row">
            <input style="width:auto" type="checkbox" ${propPrefix}="separator" ${field.separator ? "checked" : ""} />
            <span class="dacd-mini">Separator</span>
          </label>
          <label class="dacd-row">
            <input style="width:auto" type="checkbox" ${propPrefix}="isVisible" ${field.isVisible === false ? "" : "checked"} />
            <span class="dacd-mini">Initially Visible</span>
          </label>
          <label class="dacd-field"><span>Height</span><select ${propPrefix}="height">
            ${["", "auto", "stretch"].map((value) => `<option value="${value}" ${field.height === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}
          </select></label>
          ${body}
          ${this.renderElementQuickEdit(field, index, scope)}
          ${this.renderElementActions(field, index, scope)}
          <div class="dacd-properties-section">Selected Node JSON</div>
          <textarea class="dacd-json-output compact" readonly>${escapeHtml(formatJson(this.toAdaptiveNode(field)))}</textarea>
        </div>
      </aside>
    `;
  }

  renderElementQuickEdit(field, index, scope) {
    if (field.type === "Container") {
      return `
        <div class="dacd-properties-section">Quick Edit</div>
        <div class="dacd-row">
          <button class="dacd-btn" data-container-scope="${scope}" data-container-index="${index}" data-container-add="TextBlock" type="button">TextBlock 추가</button>
          <button class="dacd-btn" data-container-scope="${scope}" data-container-index="${index}" data-container-add="Container" type="button">Container 추가</button>
        </div>
      `;
    }
    if (field.type === "ColumnSet") {
      return `
        <div class="dacd-properties-section">Quick Edit</div>
        <div class="dacd-row">
          <button class="dacd-btn" data-columnset-action="add-column" data-columnset-scope="${scope}" data-columnset-index="${index}" type="button">Column 추가</button>
          <button class="dacd-btn danger" data-columnset-action="delete-column" data-columnset-scope="${scope}" data-columnset-index="${index}" type="button">Column 삭제</button>
        </div>
      `;
    }
    return "";
  }

  renderElementActions(field, index, scope) {
    const isOutput = scope === "output";
    return `
      <div class="dacd-properties-section">Actions</div>
      <div class="dacd-row">
        ${isOutput ? `
          <button class="dacd-btn" data-move-output-field="${index}" data-direction="up" type="button">위로 이동</button>
          <button class="dacd-btn" data-move-output-field="${index}" data-direction="down" type="button">아래로 이동</button>
        ` : ""}
        <button class="dacd-btn danger" ${isOutput ? `data-remove-output-field="${index}"` : `data-remove-field="${index}"`} type="button">선택 요소 삭제</button>
      </div>
    `;
  }

  toAdaptiveNode(field) {
    if (field.type === "Table") return this.buildTableElement(field);
    if (field.type === "Container") return { type: "Container", style: field.style || undefined, items: this.normalizeContainerField(field).items };
    if (field.type === "ColumnSet") return { type: "ColumnSet", columns: this.normalizeColumnSetField(field).columns };
    return { ...field, kind: undefined, row: undefined, visible: undefined };
  }

  getDesignerPropertyFields(type) {
    const commonInputs = [
      { label: "Label", name: "label" },
      { label: "Value", name: "value" },
      { label: "Required", name: "isRequired", kind: "checkbox", defaultValue: false },
      { label: "Error Message", name: "errorMessage" },
    ];
    const colorOptions = ["", "Default", "Dark", "Light", "Accent", "Good", "Warning", "Attention"];
    const containerStyleOptions = ["", "default", "emphasis", "good", "attention", "warning", "accent"];
    const horizontalOptions = ["", "Left", "Center", "Right"];
    const verticalOptions = ["", "Top", "Center", "Bottom"];
    const actionModeOptions = ["", "primary", "secondary"];
    const actionStyleOptions = ["", "default", "positive", "destructive"];
    const associatedInputsOptions = ["", "auto", "none"];
    const byType = {
      TextBlock: [
        { label: "Text", name: "text", kind: "textarea" },
        { label: "Font Type", name: "fontType", kind: "select", options: ["", "Default", "Monospace"] },
        { label: "Size", name: "size", kind: "select", options: ["", "Small", "Default", "Medium", "Large", "ExtraLarge"] },
        { label: "Weight", name: "weight", kind: "select", options: ["", "Lighter", "Default", "Bolder"] },
        { label: "Color", name: "color", kind: "select", options: colorOptions },
        { label: "Horizontal Align", name: "horizontalAlignment", kind: "select", options: horizontalOptions },
        { label: "Is Subtle", name: "isSubtle", kind: "checkbox", defaultValue: false },
        { label: "Italic", name: "italic", kind: "checkbox", defaultValue: false },
        { label: "Strikethrough", name: "strikethrough", kind: "checkbox", defaultValue: false },
        { label: "Wrap", name: "wrap", kind: "checkbox", defaultValue: true },
        { label: "Max Lines", name: "maxLines", kind: "number" },
        { label: "Style", name: "style", kind: "select", options: ["", "default", "heading"] },
      ],
      RichTextBlock: [
        { label: "Horizontal Align", name: "horizontalAlignment", kind: "select", options: horizontalOptions },
        { label: "Inlines JSON", name: "inlines", kind: "json", defaultValue: [] },
      ],
      Container: [
        { label: "Style", name: "style", kind: "select", options: containerStyleOptions },
        { label: "Vertical Align", name: "verticalContentAlignment", kind: "select", options: verticalOptions },
        { label: "Bleed", name: "bleed", kind: "checkbox", defaultValue: false },
        { label: "Min Height", name: "minHeight" },
        { label: "RTL", name: "rtl", kind: "checkbox", defaultValue: false },
        { label: "Select Action JSON", name: "selectAction", kind: "json", defaultValue: {} },
        { label: "Items JSON", name: "items", kind: "json", defaultValue: [] },
      ],
      ColumnSet: [
        { label: "Columns Count", name: "columns_count", kind: "number", readonly: true },
        { label: "Style", name: "style", kind: "select", options: containerStyleOptions },
        { label: "Bleed", name: "bleed", kind: "checkbox", defaultValue: false },
        { label: "Min Height", name: "minHeight" },
        { label: "Select Action JSON", name: "selectAction", kind: "json", defaultValue: {} },
        { label: "Columns JSON", name: "columns", kind: "json", defaultValue: [] },
      ],
      Image: [
        { label: "URL", name: "url" },
        { label: "Alt Text", name: "altText" },
        { label: "Size", name: "size", kind: "select", options: ["", "Auto", "Stretch", "Small", "Medium", "Large"] },
        { label: "Style", name: "style", kind: "select", options: ["", "Default", "Person"] },
        { label: "Width", name: "width" },
        { label: "Height", name: "height" },
        { label: "Background Color", name: "backgroundColor" },
        { label: "Horizontal Align", name: "horizontalAlignment", kind: "select", options: horizontalOptions },
        { label: "Select Action JSON", name: "selectAction", kind: "json", defaultValue: {} },
      ],
      ImageSet: [
        { label: "Image Size", name: "imageSize", kind: "select", options: ["", "Auto", "Stretch", "Small", "Medium", "Large"] },
        { label: "Images JSON", name: "images", kind: "json", defaultValue: [] },
      ],
      FactSet: [{ label: "Facts JSON", name: "facts", kind: "json", defaultValue: [] }],
      Table: [
        { label: "First Row As Headers", name: "firstRowAsHeaders", kind: "checkbox", defaultValue: true },
        { label: "Show Grid Lines", name: "showGridLines", kind: "checkbox", defaultValue: true },
        { label: "Grid Style", name: "gridStyle", kind: "select", options: containerStyleOptions },
        { label: "Horizontal Cell Content Align", name: "horizontalCellContentAlignment", kind: "select", options: horizontalOptions },
        { label: "Vertical Cell Content Align", name: "verticalCellContentAlignment", kind: "select", options: verticalOptions },
      ],
      Media: [
        { label: "Alt Text", name: "altText" },
        { label: "Poster", name: "poster" },
        { label: "Sources JSON", name: "sources", kind: "json", defaultValue: [] },
      ],
      Icon: [
        { label: "Name", name: "name" },
        { label: "Size", name: "size", kind: "select", options: ["", "xxSmall", "xSmall", "Small", "Medium", "Large", "xLarge", "xxLarge"] },
        { label: "Color", name: "color", kind: "select", options: colorOptions },
        { label: "Style", name: "style", kind: "select", options: ["", "Regular", "Filled"] },
      ],
      Badge: [
        { label: "Text", name: "text" },
        { label: "Appearance", name: "appearance", kind: "select", options: ["", "Filled", "Tint", "Outline"] },
        { label: "Style", name: "style", kind: "select", options: colorOptions },
        { label: "Size", name: "size", kind: "select", options: ["", "Small", "Medium", "Large"] },
        { label: "Icon", name: "icon.name" },
      ],
      CompoundButton: [
        { label: "Title", name: "title" },
        { label: "Description", name: "description" },
        { label: "Icon", name: "icon.name" },
        { label: "Select Action JSON", name: "selectAction", kind: "json", defaultValue: {} },
      ],
      CodeBlock: [
        { label: "Code", name: "code", kind: "textarea" },
        { label: "Language", name: "language" },
        { label: "Start Line Number", name: "startLineNumber", kind: "number" },
        { label: "Wrap", name: "wrap", kind: "checkbox", defaultValue: false },
      ],
      ProgressBar: [
        { label: "Value", name: "value", kind: "number" },
        { label: "Max", name: "max", kind: "number" },
        { label: "Color", name: "color", kind: "select", options: colorOptions },
      ],
      ProgressRing: [
        { label: "Label", name: "label" },
        { label: "Color", name: "color", kind: "select", options: colorOptions },
      ],
      Rating: [
        { label: "Value", name: "value", kind: "number" },
        { label: "Max", name: "max", kind: "number" },
        { label: "Color", name: "color", kind: "select", options: colorOptions },
      ],
      "Input.Text": [
        ...commonInputs,
        { label: "Placeholder", name: "placeholder" },
        { label: "Style", name: "style", kind: "select", options: ["", "text", "tel", "url", "email", "password"] },
        { label: "Regex", name: "regex" },
        { label: "Inline Action JSON", name: "inlineAction", kind: "json", defaultValue: {} },
        { label: "Max Length", name: "maxLength", kind: "number" },
        { label: "Is Multiline", name: "isMultiline", kind: "checkbox", defaultValue: false },
      ],
      "Input.Number": [...commonInputs, { label: "Placeholder", name: "placeholder" }, { label: "Min", name: "min", kind: "number" }, { label: "Max", name: "max", kind: "number" }],
      "Input.Date": [...commonInputs, { label: "Placeholder", name: "placeholder" }, { label: "Min", name: "min" }, { label: "Max", name: "max" }],
      "Input.Time": [...commonInputs, { label: "Placeholder", name: "placeholder" }, { label: "Min", name: "min" }, { label: "Max", name: "max" }],
      "Input.Toggle": [...commonInputs, { label: "Title", name: "title" }, { label: "Value On", name: "valueOn" }, { label: "Value Off", name: "valueOff" }, { label: "Wrap", name: "wrap", kind: "checkbox", defaultValue: false }],
      "Input.ChoiceSet": [
        ...commonInputs,
        { label: "Style", name: "style", kind: "select", options: ["", "compact", "expanded", "filtered"] },
        { label: "Placeholder", name: "placeholder" },
        { label: "Is Multi Select", name: "isMultiSelect", kind: "checkbox", defaultValue: false },
        { label: "Wrap", name: "wrap", kind: "checkbox", defaultValue: false },
        { label: "Choices JSON", name: "choices", kind: "json", defaultValue: [] },
      ],
      "Input.Rating": [...commonInputs, { label: "Max", name: "max", kind: "number" }, { label: "Color", name: "color", kind: "select", options: colorOptions }],
      ActionSet: [{ label: "Actions JSON", name: "actions", kind: "json", defaultValue: [] }],
    };
    const actionFields = {
      "Action.Submit": [{ label: "Data", name: "data", kind: "json", defaultValue: {} }, { label: "Associated inputs", name: "associatedInputs", kind: "select", options: associatedInputsOptions }],
      "Action.OpenUrl": [{ label: "URL", name: "url" }],
      "Action.Execute": [{ label: "Data", name: "data", kind: "json", defaultValue: {} }, { label: "Associated inputs", name: "associatedInputs", kind: "select", options: associatedInputsOptions }, { label: "Only enable when inputs change", name: "conditionallyEnabled", kind: "checkbox", defaultValue: false }, { label: "Verb", name: "verb" }],
      "Action.ToggleVisibility": [{ label: "Target elements", name: "targetElements", kind: "json", defaultValue: [] }],
      "Action.ShowCard": [{ label: "Card JSON", name: "card", kind: "json", defaultValue: { type: "AdaptiveCard", body: [] } }],
      "Action.ResetInputs": [{ label: "Target input ids", name: "targetInputIds", kind: "json", defaultValue: [] }],
      "Action.Popover": [{ label: "Card JSON", name: "card", kind: "json", defaultValue: { type: "AdaptiveCard", body: [] } }],
      "Action.OpenUrlDialog": [{ label: "URL", name: "url" }, { label: "Width", name: "width" }, { label: "Height", name: "height" }],
      "Action.InsertImage": [{ label: "Image URL", name: "url" }, { label: "Alt Text", name: "altText" }],
      "Action.RunCommands": [{ label: "Commands JSON", name: "commands", kind: "json", defaultValue: [] }],
    };
    if (type?.startsWith("Action.")) {
      return [
        { label: "Id", name: "id" },
        { label: "Enabled", name: "isEnabled", kind: "checkbox", defaultValue: true },
        { label: "Title", name: "title" },
        { label: "Tooltip", name: "tooltip" },
        { label: "Mode", name: "mode", kind: "select", options: actionModeOptions },
        { label: "Style", name: "style", kind: "select", options: actionStyleOptions },
        { label: "Icon URL", name: "iconUrl" },
        { label: "Requires JSON", name: "requires", kind: "json", defaultValue: {} },
        { label: "Fallback JSON", name: "fallback", kind: "json", defaultValue: {} },
        ...(actionFields[type] || []),
      ];
    }
    if (type?.startsWith("Chart.")) {
      return [
        { label: "Title", name: "title" },
        { label: "Data JSON", name: "data", kind: "json", defaultValue: [] },
        { label: "Color", name: "color", kind: "select", options: colorOptions },
      ];
    }
    return byType[type] || null;
  }

  getPropertyValue(field, name, defaultValue = "") {
    if (name === "columns_count") return (field.columns || []).length;
    return String(name).split(".").reduce((value, key) => value?.[key], field) ?? defaultValue ?? "";
  }

  renderDesignerPropertyFields(field, propPrefix) {
    const fields = this.getDesignerPropertyFields(field.type);
    if (!fields) return "";
    return `
      <div class="dacd-properties-section">Properties</div>
      ${fields.map((item) => this.renderDesignerPropertyField(field, propPrefix, item)).join("")}
    `;
  }

  renderDesignerPropertyField(field, propPrefix, item) {
    const value = this.getPropertyValue(field, item.name, item.defaultValue);
    const attr = `${propPrefix}="${escapeAttr(item.name)}"`;
    const readonly = item.readonly ? "readonly" : "";
    if (item.kind === "checkbox") {
      return `<label class="dacd-row"><input style="width:auto" type="checkbox" ${attr} ${value ? "checked" : ""} ${readonly} /><span class="dacd-mini">${escapeHtml(item.label)}</span></label>`;
    }
    if (item.kind === "select") {
      return `<label class="dacd-field"><span>${escapeHtml(item.label)}</span><select ${attr} ${readonly}>${(item.options || [""]).map((option) => `<option value="${escapeAttr(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option || "(not set)")}</option>`).join("")}</select></label>`;
    }
    if (item.kind === "json") {
      return `<label class="dacd-field"><span>${escapeHtml(item.label)}</span><textarea ${attr} ${readonly}>${escapeHtml(formatJson(value || item.defaultValue || {}))}</textarea></label>`;
    }
    if (item.kind === "textarea") {
      return `<label class="dacd-field"><span>${escapeHtml(item.label)}</span><textarea ${attr} ${readonly}>${escapeHtml(value || "")}</textarea></label>`;
    }
    return `<label class="dacd-field"><span>${escapeHtml(item.label)}</span><input type="${item.kind === "number" ? "number" : "text"}" ${attr} value="${escapeAttr(value || "")}" ${readonly} /></label>`;
  }

  renderElementPropertyBody(field, index, scope, propPrefix) {
    const type = field.type || "TextBlock";
    const designerProperties = this.renderDesignerPropertyFields(field, propPrefix);
    if (designerProperties) {
      return type === "Table" ? `${designerProperties}<div class="dacd-properties-section">Table Editor</div>${this.renderTableInlineEditor(field, index, scope)}` : designerProperties;
    }
    if (type === "TextBlock") {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>Text</span><textarea ${propPrefix}="text">${escapeHtml(field.text || "")}</textarea></label>
        <label class="dacd-field"><span>Size</span><select ${propPrefix}="size">${["", "Small", "Default", "Medium", "Large", "ExtraLarge"].map((value) => `<option value="${value}" ${field.size === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}</select></label>
        <label class="dacd-field"><span>Weight</span><select ${propPrefix}="weight">${["", "Default", "Bolder"].map((value) => `<option value="${value}" ${field.weight === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}</select></label>
        <label class="dacd-field"><span>Color</span><select ${propPrefix}="color">${["", "Default", "Dark", "Light", "Accent", "Good", "Warning", "Attention"].map((value) => `<option value="${value}" ${field.color === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}</select></label>
        <label class="dacd-field"><span>Horizontal Align</span><select ${propPrefix}="horizontalAlignment">${["", "Left", "Center", "Right"].map((value) => `<option value="${value}" ${field.horizontalAlignment === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}</select></label>
        <label class="dacd-row"><input style="width:auto" type="checkbox" ${propPrefix}="isSubtle" ${field.isSubtle ? "checked" : ""} /><span class="dacd-mini">Is Subtle</span></label>
        <label class="dacd-field"><span>Max Lines</span><input type="number" min="0" ${propPrefix}="maxLines" value="${escapeAttr(field.maxLines || "")}" /></label>
        <label class="dacd-row"><input style="width:auto" type="checkbox" ${propPrefix}="wrap" ${field.wrap === false ? "" : "checked"} /><span class="dacd-mini">Wrap</span></label>
      `;
    }
    if (type === "Container") {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>Style</span><select ${propPrefix}="style">${["", "default", "emphasis"].map((value) => `<option value="${value}" ${field.style === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}</select></label>
        <label class="dacd-field"><span>Vertical Align</span><select ${propPrefix}="verticalContentAlignment">${["", "Top", "Center", "Bottom"].map((value) => `<option value="${value}" ${field.verticalContentAlignment === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}</select></label>
        <label class="dacd-row"><input style="width:auto" type="checkbox" ${propPrefix}="bleed" ${field.bleed ? "checked" : ""} /><span class="dacd-mini">Bleed</span></label>
        <label class="dacd-field"><span>Min Height</span><input type="number" min="0" ${propPrefix}="minHeight" value="${escapeAttr(field.minHeight || "")}" /></label>
      `;
    }
    if (type === "Image") {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>URL</span><input ${propPrefix}="url" value="${escapeAttr(field.url || "")}" /></label>
        <label class="dacd-field"><span>Alt Text</span><input ${propPrefix}="altText" value="${escapeAttr(field.altText || "")}" /></label>
        <label class="dacd-field"><span>Size</span><select ${propPrefix}="size">${["", "Auto", "Stretch", "Small", "Medium", "Large"].map((value) => `<option value="${value}" ${field.size === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}</select></label>
        <label class="dacd-field"><span>Horizontal Align</span><select ${propPrefix}="horizontalAlignment">${["", "Left", "Center", "Right"].map((value) => `<option value="${value}" ${field.horizontalAlignment === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}</select></label>
      `;
    }
    if (type === "CodeBlock") {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>Language</span><input ${propPrefix}="language" value="${escapeAttr(field.language || "")}" /></label>
        <label class="dacd-field"><span>Code</span><textarea ${propPrefix}="codeSnippet">${escapeHtml(field.codeSnippet || "")}</textarea></label>
      `;
    }
    if (type === "ImageSet") {
      return `<div class="dacd-properties-section">Properties</div><label class="dacd-field"><span>Images Count</span><input value="${escapeAttr((field.images || []).length)}" readonly /></label>`;
    }
    if (type === "Media") {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>Alt Text</span><input ${propPrefix}="altText" value="${escapeAttr(field.altText || "")}" /></label>
        <label class="dacd-field"><span>Poster URL</span><input ${propPrefix}="poster" value="${escapeAttr(field.poster || "")}" /></label>
      `;
    }
    if (type === "Icon") {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>Name</span><input ${propPrefix}="name" value="${escapeAttr(field.name || "")}" /></label>
        <label class="dacd-field"><span>Size</span><select ${propPrefix}="size">${["", "Small", "Medium", "Large", "ExtraLarge"].map((value) => `<option value="${value}" ${field.size === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}</select></label>
        <label class="dacd-field"><span>Color</span><select ${propPrefix}="color">${["", "Default", "Accent", "Good", "Warning", "Attention"].map((value) => `<option value="${value}" ${field.color === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}</select></label>
      `;
    }
    if (type === "Badge") {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>Title</span><input ${propPrefix}="title" value="${escapeAttr(field.title || "")}" /></label>
        <label class="dacd-field"><span>Style</span><input ${propPrefix}="style" value="${escapeAttr(field.style || "")}" /></label>
        <label class="dacd-field"><span>Shape</span><input ${propPrefix}="shape" value="${escapeAttr(field.shape || "")}" /></label>
      `;
    }
    if (type === "ProgressBar") {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>Value</span><input type="number" ${propPrefix}="value" value="${escapeAttr(field.value || 0)}" /></label>
        <label class="dacd-field"><span>Max</span><input type="number" ${propPrefix}="max" value="${escapeAttr(field.max || 100)}" /></label>
      `;
    }
    if (type === "ProgressRing") {
      return `<div class="dacd-properties-section">Properties</div><label class="dacd-field"><span>Label</span><input ${propPrefix}="label" value="${escapeAttr(field.label || "")}" /></label>`;
    }
    if (type === "Rating" || type === "Input.Rating") {
      return `
        <div class="dacd-properties-section">Properties</div>
        ${type === "Input.Rating" ? `<label class="dacd-field"><span>Label</span><input ${propPrefix}="label" value="${escapeAttr(field.label || "")}" /></label>` : ""}
        <label class="dacd-field"><span>Value</span><input type="number" ${propPrefix}="value" value="${escapeAttr(field.value || 0)}" /></label>
        <label class="dacd-field"><span>Max</span><input type="number" ${propPrefix}="max" value="${escapeAttr(field.max || 5)}" /></label>
      `;
    }
    if (type === "FactSet") {
      return `<div class="dacd-properties-section">Properties</div><label class="dacd-field"><span>Facts</span><input ${propPrefix}="facts" value="${escapeAttr(Array.isArray(field.facts) ? this.formatFactsText(field.facts) : field.facts || "")}" /></label>`;
    }
    if (type === "Table") {
      return `<div class="dacd-properties-section">Table</div>${this.renderTableInlineEditor(field, index, scope)}`;
    }
    if (type === "ColumnSet") {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>Columns Count</span><input type="number" value="${escapeAttr((field.columns || []).length)}" readonly /></label>
        <label class="dacd-field"><span>Style</span><select ${propPrefix}="style">${["", "default", "emphasis"].map((value) => `<option value="${value}" ${field.style === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}</select></label>
        <label class="dacd-row"><input style="width:auto" type="checkbox" ${propPrefix}="bleed" ${field.bleed ? "checked" : ""} /><span class="dacd-mini">Bleed</span></label>
      `;
    }
    if (type === "Input.Toggle") {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>Title</span><input ${propPrefix}="title" value="${escapeAttr(field.title || "")}" /></label>
        <label class="dacd-field"><span>Value</span><input ${propPrefix}="value" value="${escapeAttr(field.value || "")}" /></label>
        <label class="dacd-field"><span>Value On</span><input ${propPrefix}="valueOn" value="${escapeAttr(field.valueOn || "")}" /></label>
        <label class="dacd-field"><span>Value Off</span><input ${propPrefix}="valueOff" value="${escapeAttr(field.valueOff || "")}" /></label>
      `;
    }
    if (type === "Input.ChoiceSet") {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>Label</span><input ${propPrefix}="label" value="${escapeAttr(field.label || "")}" /></label>
        <label class="dacd-field"><span>Style</span><select ${propPrefix}="style">${["", "compact", "expanded", "filtered"].map((value) => `<option value="${value}" ${field.style === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}</select></label>
        <label class="dacd-field"><span>Value</span><input ${propPrefix}="value" value="${escapeAttr(field.value || "")}" /></label>
        <label class="dacd-row"><input style="width:auto" type="checkbox" ${propPrefix}="isMultiSelect" ${field.isMultiSelect ? "checked" : ""} /><span class="dacd-mini">Is Multi Select</span></label>
        <label class="dacd-field"><span>Choices</span><input ${propPrefix}="choices" value="${escapeAttr(field.choices || "")}" /></label>
      `;
    }
    if (type.startsWith("Input.")) {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>Label</span><input ${propPrefix}="label" value="${escapeAttr(field.label || "")}" /></label>
        <label class="dacd-field"><span>Placeholder</span><input ${propPrefix}="placeholder" value="${escapeAttr(field.placeholder || "")}" /></label>
        <label class="dacd-field"><span>Value</span><input ${propPrefix}="value" value="${escapeAttr(field.value || "")}" /></label>
        <label class="dacd-row"><input style="width:auto" type="checkbox" ${propPrefix}="required" ${field.required ? "checked" : ""} /><span class="dacd-mini">Required</span></label>
      `;
    }
    if (type.startsWith("Action.")) {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>Title</span><input ${propPrefix}="title" value="${escapeAttr(field.title || "")}" /></label>
        <label class="dacd-field"><span>Style</span><select ${propPrefix}="style">${["", "default", "positive", "destructive"].map((value) => `<option value="${value}" ${field.style === value ? "selected" : ""}>${value || "(none)"}</option>`).join("")}</select></label>
        ${["Action.OpenUrl", "Action.OpenUrlDialog", "Action.InsertImage"].includes(type) ? `<label class="dacd-field"><span>URL</span><input ${propPrefix}="url" value="${escapeAttr(field.url || "")}" /></label>` : ""}
        ${type === "Action.OpenUrlDialog" ? `
          <label class="dacd-field"><span>Width</span><input ${propPrefix}="width" value="${escapeAttr(field.width || "")}" /></label>
          <label class="dacd-field"><span>Height</span><input ${propPrefix}="height" value="${escapeAttr(field.height || "")}" /></label>
        ` : ""}
        ${type === "Action.InsertImage" ? `<label class="dacd-field"><span>Alt Text</span><input ${propPrefix}="altText" value="${escapeAttr(field.altText || "")}" /></label>` : ""}
        ${["Action.Submit", "Action.Execute"].includes(type) ? `<label class="dacd-field"><span>Verb</span><input ${propPrefix}="verb" value="${escapeAttr(field.verb || "")}" /></label>` : ""}
        ${["Action.ShowCard", "Action.Popover"].includes(type) ? `<label class="dacd-field"><span>Card JSON</span><textarea ${propPrefix}="cardJson">${escapeHtml(formatJson(field.card || { type: "AdaptiveCard", body: [] }))}</textarea></label>` : ""}
        ${type === "Action.RunCommands" ? `<label class="dacd-field"><span>Commands JSON</span><textarea ${propPrefix}="commandsJson">${escapeHtml(formatJson(field.commands || []))}</textarea></label>` : ""}
      `;
    }
    if (type === "ActionSet") {
      return `<div class="dacd-properties-section">Properties</div><label class="dacd-field"><span>Actions Count</span><input value="${escapeAttr((field.actions || []).length)}" readonly /></label>`;
    }
    if (type === "CompoundButton") {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>Title</span><input ${propPrefix}="title" value="${escapeAttr(field.title || "")}" /></label>
        <label class="dacd-field"><span>Description</span><input ${propPrefix}="description" value="${escapeAttr(field.description || "")}" /></label>
      `;
    }
    if (type.startsWith("Chart.")) {
      return `
        <div class="dacd-properties-section">Properties</div>
        <label class="dacd-field"><span>Title</span><input ${propPrefix}="title" value="${escapeAttr(field.title || "")}" /></label>
        <label class="dacd-field"><span>Data</span><textarea ${propPrefix}="facts">${escapeHtml(field.facts || "")}</textarea></label>
      `;
    }
    return `
      <div class="dacd-properties-section">Properties</div>
      <label class="dacd-field"><span>Title</span><input ${propPrefix}="title" value="${escapeAttr(field.title || "")}" /></label>
      <label class="dacd-field"><span>Text</span><textarea ${propPrefix}="text">${escapeHtml(field.text || "")}</textarea></label>
      <label class="dacd-field"><span>URL</span><input ${propPrefix}="url" value="${escapeAttr(field.url || "")}" /></label>
    `;
  }

  renderOutputToolbox() {
    const tools = [
      { type: "Badge", category: "content" },
      { type: "CodeBlock", category: "content" },
      { type: "TextBlock", category: "content" },
      { type: "RichTextBlock", category: "content" },
      { type: "FactSet", category: "content" },
      { type: "Icon", category: "content" },
      { type: "Image", category: "content" },
      { type: "ImageSet", category: "content" },
      { type: "Media", category: "content" },
      { type: "ProgressBar", category: "content" },
      { type: "ProgressRing", category: "content" },
      { type: "Rating", category: "content" },
      { type: "Container", category: "layout" },
      { type: "ColumnSet", category: "layout" },
      { type: "Table", category: "layout" },
      { type: "Input.Text", category: "input" },
      { type: "Input.Number", category: "input" },
      { type: "Input.Date", category: "input" },
      { type: "Input.Rating", category: "input" },
      { type: "Input.Time", category: "input" },
      { type: "Input.Toggle", category: "input" },
      { type: "Input.ChoiceSet", category: "input" },
      { type: "Action.Submit", category: "action" },
      { type: "Action.OpenUrl", category: "action" },
      { type: "Action.Execute", category: "action" },
      { type: "Action.ShowCard", category: "action" },
      { type: "Action.ToggleVisibility", category: "action" },
      { type: "Action.ResetInputs", category: "action" },
      { type: "Action.Popover", category: "action" },
      { type: "Action.OpenUrlDialog", category: "action" },
      { type: "Action.InsertImage", category: "action" },
      { type: "Action.RunCommands", category: "action" },
      { type: "CompoundButton", category: "action" },
      { type: "ActionSet", category: "action" },
      { type: "Chart.Donut", category: "chart" },
      { type: "Chart.Gauge", category: "chart" },
      { type: "Chart.HorizontalBar", category: "chart" },
      { type: "Chart.HorizontalBar.Stacked", category: "chart" },
      { type: "Chart.Line", category: "chart" },
      { type: "Chart.Pie", category: "chart" },
      { type: "Chart.VerticalBar", category: "chart" },
      { type: "Chart.VerticalBar.Grouped", category: "chart" },
    ];
    const filters = [
      { key: "all", label: "전체" },
      { key: "content", label: "콘텐츠" },
      { key: "layout", label: "레이아웃" },
      { key: "input", label: "입력" },
      { key: "action", label: "액션" },
      { key: "chart", label: "차트" },
    ];
    const query = this.toolboxSearch.trim().toLowerCase();
    const visibleTools = tools.filter((tool) => {
      const matchesFilter = this.toolboxFilter === "all" || tool.category === this.toolboxFilter;
      const matchesQuery = !query || tool.type.toLowerCase().includes(query);
      return matchesFilter && matchesQuery;
    }).sort((a, b) => this.toolboxFilter === "all" ? a.type.localeCompare(b.type) : 0);
    return `
      <aside class="dacd-toolbox">
        <div class="dacd-toolbox-title">Element Toolbox</div>
        <div class="dacd-row" style="justify-content: space-between;">
          <span class="dacd-mini" style="color:#dbe7ff;">출력 사용 요소</span>
          <button class="dacd-btn" data-sync-fields type="button">동기화</button>
        </div>
        <input class="dacd-toolbox-search" data-toolbox-search type="text" placeholder="요소 검색" value="${escapeAttr(this.toolboxSearch)}" />
        <div class="dacd-toolbox-filters">
          ${filters.map((filter) => `
            <button class="dacd-toolbox-filter ${this.toolboxFilter === filter.key ? "active" : ""}" data-toolbox-filter="${filter.key}" type="button">${filter.label}</button>
          `).join("")}
        </div>
        <div class="dacd-toolbox-list">
          ${visibleTools.map((tool) => `
            <button class="dacd-toolbox-btn" data-add-output-element="${escapeAttr(tool.type)}" draggable="true" type="button">
              ${escapeHtml(tool.type)}
            </button>
          `).join("") || `<div class="dacd-mini" style="color:#dbe7ff;">검색 결과가 없습니다.</div>`}
        </div>
        <div class="dacd-toolbox-title" style="margin-top:18px;">Data Key</div>
        <div class="dacd-toolbox-list">
          ${getDataKeys(this.outputData).map((key) => {
            const exists = this.outputFields.some((field) => field.key === key);
            return `<button class="dacd-toolbox-btn" data-add-output-key="${escapeAttr(key)}" draggable="${exists ? "false" : "true"}" type="button" ${exists ? "disabled" : ""}>${escapeHtml(key)}</button>`;
          }).join("") || `<div class="dacd-mini" style="color:#dbe7ff;">데이터 키가 없습니다.</div>`}
        </div>
      </aside>
    `;
  }

  renderElementToolbox() {
    const tools = [
      { type: "Badge", category: "content" },
      { type: "CodeBlock", category: "content" },
      { type: "TextBlock", category: "content" },
      { type: "RichTextBlock", category: "content" },
      { type: "FactSet", category: "content" },
      { type: "Icon", category: "content" },
      { type: "Image", category: "content" },
      { type: "ImageSet", category: "content" },
      { type: "Media", category: "content" },
      { type: "ProgressBar", category: "content" },
      { type: "ProgressRing", category: "content" },
      { type: "Rating", category: "content" },
      { type: "Container", category: "layout" },
      { type: "ColumnSet", category: "layout" },
      { type: "Table", category: "layout" },
      { type: "Input.Text", category: "input" },
      { type: "Input.Number", category: "input" },
      { type: "Input.Date", category: "input" },
      { type: "Input.Rating", category: "input" },
      { type: "Input.Time", category: "input" },
      { type: "Input.Toggle", category: "input" },
      { type: "Input.ChoiceSet", category: "input" },
      { type: "Action.Submit", category: "action" },
      { type: "Action.OpenUrl", category: "action" },
      { type: "Action.Execute", category: "action" },
      { type: "Action.ShowCard", category: "action" },
      { type: "Action.ToggleVisibility", category: "action" },
      { type: "Action.ResetInputs", category: "action" },
      { type: "Action.Popover", category: "action" },
      { type: "Action.OpenUrlDialog", category: "action" },
      { type: "Action.InsertImage", category: "action" },
      { type: "Action.RunCommands", category: "action" },
      { type: "CompoundButton", category: "action" },
      { type: "ActionSet", category: "action" },
      { type: "Chart.Donut", category: "chart" },
      { type: "Chart.Gauge", category: "chart" },
      { type: "Chart.HorizontalBar", category: "chart" },
      { type: "Chart.HorizontalBar.Stacked", category: "chart" },
      { type: "Chart.Line", category: "chart" },
      { type: "Chart.Pie", category: "chart" },
      { type: "Chart.VerticalBar", category: "chart" },
      { type: "Chart.VerticalBar.Grouped", category: "chart" },
    ];
    const filters = [
      { key: "all", label: "전체" },
      { key: "content", label: "콘텐츠" },
      { key: "layout", label: "레이아웃" },
      { key: "input", label: "입력" },
      { key: "action", label: "액션" },
      { key: "chart", label: "차트" },
    ];
    const query = this.toolboxSearch.trim().toLowerCase();
    const visibleTools = tools.filter((tool) => {
      const matchesFilter = this.toolboxFilter === "all" || tool.category === this.toolboxFilter;
      const matchesQuery = !query || tool.type.toLowerCase().includes(query);
      return matchesFilter && matchesQuery;
    }).sort((a, b) => this.toolboxFilter === "all" ? a.type.localeCompare(b.type) : 0);
    return `
      <aside class="dacd-toolbox">
        <div class="dacd-toolbox-title">Element Toolbox</div>
        <div class="dacd-row" style="justify-content: space-between;">
          <span class="dacd-mini" style="color:#dbe7ff;">사용 가능 요소</span>
          <button class="dacd-btn" data-clear-input type="button" ${this.inputFields.length > 0 ? "" : "disabled"}>지우기</button>
        </div>
        <input class="dacd-toolbox-search" data-toolbox-search type="text" placeholder="요소 검색" value="${escapeAttr(this.toolboxSearch)}" />
        <div class="dacd-toolbox-filters">
          ${filters.map((filter) => `
            <button class="dacd-toolbox-filter ${this.toolboxFilter === filter.key ? "active" : ""}" data-toolbox-filter="${filter.key}" type="button">${filter.label}</button>
          `).join("")}
        </div>
        <div class="dacd-toolbox-list">
          ${visibleTools.map((tool) => `
            <button class="dacd-toolbox-btn" data-add-element="${escapeAttr(tool.type)}" draggable="true" type="button">
              ${escapeHtml(tool.type)}
            </button>
          `).join("") || `<div class="dacd-mini" style="color:#dbe7ff;">검색 결과가 없습니다.</div>`}
        </div>
      </aside>
    `;
  }

  createTableCell(text = "", weight = "") {
    const textBlock = { type: "TextBlock", text, wrap: true };
    if (weight) textBlock.weight = weight;
    return { type: "TableCell", items: [textBlock] };
  }

  createDefaultTableField(base = {}) {
    return {
      ...base,
      columns: [{ width: 1 }, { width: 1 }, { width: 1 }],
      rows: [
        {
          type: "TableRow",
          cells: [
            this.createTableCell("Header 1", "Bolder"),
            this.createTableCell("Header 2", "Bolder"),
            this.createTableCell("Header 3", "Bolder"),
          ],
        },
        {
          type: "TableRow",
          cells: [
            this.createTableCell(""),
            this.createTableCell(""),
            this.createTableCell(""),
          ],
        },
      ],
      showGridLines: true,
    };
  }

  createDefaultContainerField(base = {}) {
    return {
      ...base,
      style: base.style || "default",
      items: [],
    };
  }

  createDefaultColumnSetField(base = {}) {
    return {
      ...base,
      columns: [
        { type: "Column", width: "stretch", items: [] },
        { type: "Column", width: "stretch", items: [] },
      ],
    };
  }

  createDefaultElement(type, base = {}) {
    const common = { ...base, type, row: base.row || 1 };
    if (type === "TextBlock") return { ...common, text: "새 텍스트", wrap: true };
    if (type === "RichTextBlock") return { ...common, inlines: [{ type: "TextRun", text: "새 리치 텍스트", weight: "Bolder" }] };
    if (type === "CodeBlock") return { ...common, language: "json", code: '{\n  "hello": "world"\n}' };
    if (type === "Container") return this.createDefaultContainerField(common);
    if (type === "Image") return { ...common, url: "", altText: "Empty Image" };
    if (type === "ImageSet") return { ...common, images: [{ type: "Image", url: "", altText: "Empty Image" }] };
    if (type === "Media") return { ...common, altText: "media", sources: [{ mimeType: "video/mp4", url: "https://adaptivecards.io/content/video.mp4" }] };
    if (type === "FactSet") return { ...common, facts: [{ title: "항목", value: "값" }, { title: "항목2", value: "값2" }] };
    if (type === "Icon") return { ...common, name: "Info", size: "Medium", color: "Accent" };
    if (type === "Badge") return { ...common, title: "Badge", style: "Accent", shape: "Rounded" };
    if (type === "ProgressBar") return { ...common, value: 50, max: 100 };
    if (type === "ProgressRing") return { ...common, label: "Loading" };
    if (type === "Rating") return { ...common, value: 3, max: 5 };
    if (type === "ColumnSet") return this.createDefaultColumnSetField(common);
    if (type === "Table" || type === "Input.TableText") return this.createDefaultTableField({ ...common, type: "Table" });
    if (type === "Input.Text") return { ...common, id: "textInput", label: "입력", placeholder: "값을 입력하세요" };
    if (type === "Input.Number") return { ...common, id: "numberInput", label: "숫자", placeholder: "숫자를 입력하세요" };
    if (type === "Input.Date") return { ...common, id: "dateInput", label: "날짜", placeholder: "날짜를 선택하세요" };
    if (type === "Input.Rating") return { ...common, id: "ratingInput", label: "평점", value: 3, max: 5 };
    if (type === "Input.Time") return { ...common, id: "timeInput", label: "시간" };
    if (type === "Input.Toggle") return { ...common, id: "toggleInput", title: "토글 입력" };
    if (type === "Input.ChoiceSet") return { ...common, id: "choiceInput", label: "선택", choices: "option1:옵션 1,option2:옵션 2" };
    if (type === "Action.Submit") return { ...common, title: "제출" };
    if (type === "Action.OpenUrl") return { ...common, title: "열기", url: "https://adaptivecards.io" };
    if (type === "Action.Execute") return { ...common, title: "실행" };
    if (type === "Action.ShowCard") return { ...common, title: "카드 보기" };
    if (type === "Action.ToggleVisibility") return { ...common, title: "표시 전환" };
    if (type === "Action.ResetInputs") return { ...common, title: "입력 초기화" };
    if (type === "Action.Popover") return { ...common, title: "팝오버", card: { type: "AdaptiveCard", body: [] } };
    if (type === "Action.OpenUrlDialog") return { ...common, title: "대화상자 열기", url: "https://example.com" };
    if (type === "Action.InsertImage") return { ...common, title: "이미지 삽입", url: "https://adaptivecards.io/content/cats/1.png" };
    if (type === "Action.RunCommands") return { ...common, title: "명령 실행", commands: [] };
    if (type === "CompoundButton") return { ...common, title: "버튼", description: "설명", icon: { name: "Open" } };
    if (type === "ActionSet") return { ...common, actions: [] };
    if (type === "Chart.Donut") return { ...common, title: "Donut", data: [{ label: "A", value: 35 }, { label: "B", value: 25 }, { label: "C", value: 40 }] };
    if (type === "Chart.Gauge") return { ...common, title: "Gauge", value: 50 };
    if (type === "Chart.HorizontalBar") return { ...common, title: "Sales", data: [{ label: "Pear", value: 60 }, { label: "Banana", value: 290 }, { label: "Apple", value: 145 }, { label: "Peach", value: 100 }, { label: "Kiwi", value: 180 }, { label: "Grapefruit", value: 22 }] };
    if (type === "Chart.HorizontalBar.Stacked") return { ...common, title: "Stacked Sales", data: [{ label: "A", value: 140 }, { label: "B", value: 220 }, { label: "C", value: 180 }] };
    if (type === "Chart.Line") return { ...common, title: "Trend", data: [{ label: "Jan", value: 30 }, { label: "Feb", value: 55 }, { label: "Mar", value: 42 }, { label: "Apr", value: 80 }] };
    if (type === "Chart.Pie") return { ...common, title: "Pie", data: [{ label: "A", value: 40 }, { label: "B", value: 35 }, { label: "C", value: 25 }] };
    if (type === "Chart.VerticalBar") return { ...common, title: "Vertical Bar", data: [{ label: "A", value: 40 }, { label: "B", value: 80 }, { label: "C", value: 55 }] };
    if (type === "Chart.VerticalBar.Grouped") return { ...common, title: "Grouped Bar", data: [{ label: "A", value: 40 }, { label: "B", value: 60 }] };
    return common;
  }

  createContainerItem(type) {
    if (type === "Container") {
      return { type: "Container", style: "default", items: [] };
    }
    if (type === "Image") {
      return { type: "Image", url: "https://adaptivecards.io/content/cats/1.png", altText: "이미지" };
    }
    if (type === "ImageSet") {
      return { type: "ImageSet", images: [{ type: "Image", url: "https://adaptivecards.io/content/cats/1.png", altText: "이미지" }] };
    }
    if (type === "Media") {
      return { type: "Media", altText: "미디어", sources: [] };
    }
    if (type === "FactSet") {
      return { type: "FactSet", facts: [{ title: "항목", value: "값" }] };
    }
    if (type === "ColumnSet") {
      return {
        type: "ColumnSet",
        columns: [
          { type: "Column", width: "stretch", items: [] },
          { type: "Column", width: "stretch", items: [] },
        ],
      };
    }
    if (type === "Table" || type === "Input.TableText") {
      return this.createDefaultTableField({ type: "Table" });
    }
    if (type === "RichTextBlock") {
      return { type: "RichTextBlock", inlines: [{ type: "TextRun", text: "강조 텍스트" }] };
    }
    if (type === "Input.Text") {
      return { type: "Input.Text", id: "containerTextInput", label: "텍스트 입력" };
    }
    if (type === "Input.Number") {
      return { type: "Input.Number", id: "containerNumberInput", label: "숫자 입력" };
    }
    if (type === "Input.Date") {
      return { type: "Input.Date", id: "containerDateInput", label: "날짜 입력" };
    }
    if (type === "Input.Time") {
      return { type: "Input.Time", id: "containerTimeInput", label: "시간 입력" };
    }
    if (type === "Input.Toggle") {
      return { type: "Input.Toggle", id: "containerToggleInput", title: "토글 입력" };
    }
    if (type === "Input.ChoiceSet") {
      return { type: "Input.ChoiceSet", id: "containerChoiceInput", label: "선택 입력", choices: [{ title: "옵션 1", value: "option1" }] };
    }
    if (type?.startsWith("Action.")) {
      return { type: "ActionSet", actions: [{ type, title: "실행" }] };
    }
    return { type: "TextBlock", text: type === "TextBlock" ? "새 텍스트" : type || "TextBlock", wrap: true };
  }

  formatFactsText(facts) {
    return Array.isArray(facts)
      ? facts.map((fact) => `${fact.title || ""}:${fact.value || ""}`).join(",")
      : "";
  }

  normalizeContainerField(field) {
    field.items = Array.isArray(field.items) ? field.items : [];
    return field;
  }

  renderContainerInlineEditor(field, index, scope) {
    const container = this.normalizeContainerField(field);
    return `
      <div class="dacd-table-editor">
        <div class="dacd-empty-canvas" data-container-drop data-container-scope="${scope}" data-container-index="${index}">
          여기에 Element를 끌어다 놓습니다.
        </div>
        <div class="dacd-list">
          ${container.items.map((item, itemIndex) => `
            <div class="dacd-card">
              <div class="dacd-card-head">
                <div>
                  <div class="dacd-card-title">${escapeHtml(item.type || "TextBlock")}</div>
                  <div class="dacd-mini">Container child</div>
                </div>
                <button class="dacd-btn danger" data-container-scope="${scope}" data-container-index="${index}" data-container-remove="${itemIndex}" type="button">삭제</button>
              </div>
              <label class="dacd-field">
                <span>${item.type === "Image" ? "URL" : item.type === "FactSet" ? "FactSet 값 title:value" : "Text"}</span>
                <input
                  data-container-item-field="${item.type === "Image" ? "url" : item.type === "FactSet" ? "factsText" : "text"}"
                  data-container-scope="${scope}"
                  data-container-index="${index}"
                  data-container-item-index="${itemIndex}"
                  value="${escapeAttr(item.type === "Image" ? item.url || "" : item.type === "FactSet" ? this.formatFactsText(item.facts) : item.text || "")}"
                />
              </label>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  normalizeColumnSetField(field) {
    field.columns = Array.isArray(field.columns) && field.columns.length > 0
      ? field.columns
      : [
          { type: "Column", width: "stretch", items: [] },
          { type: "Column", width: "stretch", items: [] },
        ];
    field.columns = field.columns.map((column) => ({
      type: "Column",
      width: column?.width || "stretch",
      items: Array.isArray(column?.items) ? column.items : [],
    }));
    return field;
  }

  renderColumnSetInlineEditor(field, index, scope) {
    const columnSet = this.normalizeColumnSetField(field);
    return `
      <div class="dacd-table-editor">
        <div class="dacd-table-editor-toolbar">
          <button class="dacd-btn" data-columnset-action="add-column" data-columnset-scope="${scope}" data-columnset-index="${index}" type="button">+ Column</button>
          <button class="dacd-btn danger" data-columnset-action="delete-column" data-columnset-scope="${scope}" data-columnset-index="${index}" type="button">- Column</button>
        </div>
        <div class="dacd-columnset" style="grid-template-columns: repeat(${columnSet.columns.length}, minmax(120px, 1fr));">
          ${columnSet.columns.map((column, columnIndex) => `
            <div class="dacd-card">
              <div class="dacd-card-head">
                <div>
                  <div class="dacd-card-title">Column</div>
                  <div class="dacd-mini">${escapeHtml(column.width || "stretch")}</div>
                </div>
              </div>
              <label class="dacd-field">
                <span>Width</span>
                <input data-column-width data-column-scope="${scope}" data-columnset-index="${index}" data-column-index="${columnIndex}" value="${escapeAttr(column.width || "stretch")}" />
              </label>
              <div class="dacd-empty-canvas" data-column-drop data-column-scope="${scope}" data-columnset-index="${index}" data-column-index="${columnIndex}">
                여기에 Element를 끌어다 놓습니다.
              </div>
              <div class="dacd-list">
                ${(column.items || []).map((item, itemIndex) => `
                  <div class="dacd-card">
                    <div class="dacd-card-head">
                      <div>
                        <div class="dacd-card-title">${escapeHtml(item.type || "Element")}</div>
                        <div class="dacd-mini">Column child</div>
                      </div>
                      <button class="dacd-btn danger" data-column-item-remove data-column-scope="${scope}" data-columnset-index="${index}" data-column-index="${columnIndex}" data-column-item-index="${itemIndex}" type="button">삭제</button>
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  getTableColumnCount(table) {
    const columnCount = Array.isArray(table?.columns) ? table.columns.length : 0;
    const cellCounts = Array.isArray(table?.rows)
      ? table.rows.map((row) => Array.isArray(row?.cells) ? row.cells.length : 0)
      : [];
    return Math.max(1, columnCount, ...cellCounts);
  }

  normalizeTableField(field) {
    const columnCount = this.getTableColumnCount(field);
    field.columns = Array.from({ length: columnCount }, (_, index) => field.columns?.[index] || { width: 1 });
    field.rows = Array.isArray(field.rows) && field.rows.length > 0 ? field.rows : [{ type: "TableRow", cells: [] }];
    field.rows = field.rows.map((row, rowIndex) => {
      const nextRow = { type: "TableRow", ...row };
      const cells = Array.isArray(nextRow.cells) ? [...nextRow.cells] : [];
      while (cells.length < columnCount) {
        cells.push(this.createTableCell(rowIndex === 0 ? `Header ${cells.length + 1}` : ""));
      }
      nextRow.cells = cells.slice(0, columnCount);
      return nextRow;
    });
    return field;
  }

  getTableCellText(table, rowIndex, columnIndex) {
    return table?.rows?.[rowIndex]?.cells?.[columnIndex]?.items?.[0]?.text || "";
  }

  renderTableInlineEditor(field, index, scope) {
    const table = this.normalizeTableField(field);
    const columnCount = this.getTableColumnCount(table);
    return `
      <div class="dacd-table-editor">
        <div class="dacd-table-editor-toolbar">
          ${[
            ["행 추가", "add-row"],
            ["열 추가", "add-column"],
            ["마지막 행 삭제", "delete-row"],
            ["마지막 열 삭제", "delete-column"],
          ].map(([label, action]) => `
            <button class="dacd-btn" data-table-scope="${scope}" data-table-index="${index}" data-table-action="${action}" type="button">${label}</button>
          `).join("")}
        </div>
        <div class="dacd-table-editor-grid" style="grid-template-columns: repeat(${columnCount}, minmax(90px, 1fr));">
          ${table.rows.map((row, rowIndex) => row.cells.map((cell, columnIndex) => `
            <input
              data-table-cell
              data-table-scope="${scope}"
              data-table-index="${index}"
              data-table-row="${rowIndex}"
              data-table-column="${columnIndex}"
              placeholder="R${rowIndex + 1} C${columnIndex + 1}"
              value="${escapeAttr(cell?.items?.[0]?.text || "")}"
            />
          `).join("")).join("")}
        </div>
      </div>
    `;
  }

  renderOutputFieldEditor(field, index) {
    if (field.kind === "Element") {
      return this.renderElementFieldEditor(field, index, "output");
    }
    const selected = this.selectedOutputIndex === index;
    return `
      <div class="dacd-card ${selected ? "selected" : ""}" data-select-output-field="${index}" data-drag-output-index="${index}" draggable="true">
        <div class="dacd-card-head">
          <div>
            <div class="dacd-card-title">${escapeHtml(field.label || field.key || "Data Field")}</div>
            <div class="dacd-mini">${escapeHtml(field.key || "")} · ${escapeHtml(field.element || "Fact")}</div>
          </div>
          <button class="dacd-btn danger" data-remove-output-field="${index}" type="button">제거</button>
        </div>
        ${this.renderDataFieldCanvasBody(field)}
      </div>
    `;
  }

  renderElementFieldEditor(field, index, scope) {
    const isOutput = scope === "output";
    const selected = isOutput ? this.selectedOutputIndex === index : this.selectedInputIndex === index;
    const selectAttr = isOutput ? `data-select-output-field="${index}" data-drag-output-index="${index}"` : `data-select-input-field="${index}" data-drag-input-index="${index}"`;
    const removeAttr = isOutput ? `data-remove-output-field="${index}"` : `data-remove-field="${index}"`;
    const type = field.type || "TextBlock";
    return `
      <div class="dacd-card ${selected ? "selected" : ""}" ${selectAttr} draggable="true">
        <div class="dacd-card-head">
          <div>
            <div class="dacd-card-title">${escapeHtml(type)}</div>
            <div class="dacd-mini">${this.getElementSummary(field)}</div>
          </div>
          <button class="dacd-btn danger" ${removeAttr} type="button">${isOutput ? "제거" : "삭제"}</button>
        </div>
        ${this.renderElementCanvasBody(field, index, scope)}
      </div>
    `;
  }

  renderDataFieldCanvasBody(field) {
    const label = field.label || field.key || "Data Field";
    if (field.element === "Title") {
      return `<div class="dacd-preview-title">${escapeHtml(label)}</div>`;
    }
    if (field.element === "TextBlock") {
      return `<div class="dacd-preview-text">${escapeHtml(label)}</div>`;
    }
    return `
      <div class="dacd-fact">
        <div>${escapeHtml(label)}</div>
        <div>${escapeHtml(`{{${field.key || "key"}}}`)}</div>
      </div>
    `;
  }

  renderElementCanvasBody(field, index, scope) {
    const type = field.type || "TextBlock";
    if (type === "Container") return this.renderContainerCanvas(field, index, scope);
    if (type === "ColumnSet") return this.renderColumnSetCanvas(field, index, scope);
    if (type === "Table" || type === "Input.TableText") return this.renderTableCanvas(field);
    if (type === "FactSet") return this.renderFactSetCanvas(field);
    if (type === "Image") return this.renderImageCanvas(field);
    if (type === "ImageSet") return this.renderImageSetCanvas(field);
    if (type === "ActionSet") return this.renderActionSetCanvas(field);
    if (type?.startsWith("Action.")) return this.renderActionCanvas(field);
    if (type?.startsWith("Input.")) return this.renderInputCanvasElement(field);
    if (type?.startsWith("Chart.")) return this.renderChartCanvas(field);
    return this.renderSimpleElementCanvas(field);
  }

  renderSimpleElementCanvas(field) {
    const type = field.type || "TextBlock";
    const text = field.text || field.title || field.altText || type;
    if (type === "RichTextBlock") return `<div class="dacd-preview-text">${escapeHtml(text || "RichTextBlock")}</div>`;
    if (type === "CodeBlock") return `<pre class="dacd-code">${escapeHtml(field.code || field.text || "// code")}</pre>`;
    if (type === "Badge" || type === "Icon" || type === "ProgressBar" || type === "ProgressRing" || type === "Rating") {
      return `<div class="dacd-mini">${escapeHtml(type)}</div>`;
    }
    return `<div class="dacd-preview-text">${escapeHtml(text)}</div>`;
  }

  renderInputCanvasElement(field) {
    const label = field.label || field.id || field.type;
    if (field.type === "Input.Toggle") {
      return `<label class="dacd-row"><input style="width:auto" type="checkbox" disabled /><span>${escapeHtml(label)}</span></label>`;
    }
    if (field.type === "Input.ChoiceSet") {
      return `<label class="dacd-field"><span>${escapeHtml(label)}</span><select disabled><option>${escapeHtml(field.placeholder || "(not set)")}</option></select></label>`;
    }
    if (field.type === "Input.Rating") {
      return `<div class="dacd-preview-text">${escapeHtml(label)} ★★★★★</div>`;
    }
    return `<label class="dacd-field"><span>${escapeHtml(label)}</span><input value="${escapeAttr(field.placeholder || "")}" placeholder="${escapeAttr(field.placeholder || "")}" readonly /></label>`;
  }

  renderActionCanvas(field) {
    return `<button class="dacd-btn" type="button">${escapeHtml(field.title || "실행")}</button>`;
  }

  renderActionSetCanvas(field) {
    const actions = Array.isArray(field.actions) ? field.actions : [];
    return `
      <div class="dacd-list">
        ${actions.length ? actions.map((action) => this.renderActionCanvas(action)).join("") : `<div class="dacd-empty-canvas">Action을 추가합니다.</div>`}
      </div>
    `;
  }

  renderFactSetCanvas(field) {
    const facts = Array.isArray(field.facts) ? field.facts : [];
    if (!facts.length) return `<div class="dacd-empty-canvas">Fact를 추가합니다.</div>`;
    return facts.map((fact) => `
      <div class="dacd-fact">
        <div>${escapeHtml(fact.title || "")}</div>
        <div>${escapeHtml(fact.value || "")}</div>
      </div>
    `).join("");
  }

  renderImageCanvas(field) {
    if (!field.url) return `<div class="dacd-empty-canvas">${escapeHtml(field.altText || "Empty Image")}</div>`;
    return `<img class="dacd-preview-image" src="${escapeAttr(field.url)}" alt="${escapeAttr(field.altText || "")}" />`;
  }

  renderImageSetCanvas(field) {
    const images = Array.isArray(field.images) ? field.images : [];
    if (!images.length) return `<div class="dacd-empty-canvas">Image를 추가합니다.</div>`;
    return `<div class="dacd-columnset">${images.map((image) => this.renderImageCanvas(image)).join("")}</div>`;
  }

  renderChartCanvas(field) {
    return `<div class="dacd-empty-canvas">${escapeHtml(field.type || "Chart")}</div>`;
  }

  renderContainerCanvas(field, index, scope) {
    const container = this.normalizeContainerField(field);
    return `
      <div class="dacd-empty-canvas" data-container-drop data-container-scope="${scope}" data-container-index="${index}">
        ${container.items.length ? "" : "여기에 Element를 끌어다 놓습니다."}
        ${container.items.map((item) => `
          <div class="dacd-card">
            <div class="dacd-card-title">${escapeHtml(item.type || "Element")}</div>
            ${this.renderElementCanvasBody(item, index, scope)}
          </div>
        `).join("")}
      </div>
    `;
  }

  renderColumnSetCanvas(field, index, scope) {
    const columnSet = this.normalizeColumnSetField(field);
    return `
      <div class="dacd-columnset" style="grid-template-columns: repeat(${columnSet.columns.length}, minmax(120px, 1fr));">
        ${columnSet.columns.map((column, columnIndex) => `
          <div class="dacd-card">
            <div class="dacd-card-head">
              <div>
                <div class="dacd-card-title">Column</div>
                <div class="dacd-mini">${escapeHtml(column.width || "stretch")}</div>
              </div>
            </div>
            <div class="dacd-empty-canvas" data-column-drop data-column-scope="${scope}" data-columnset-index="${index}" data-column-index="${columnIndex}">
              ${(column.items || []).length ? "" : "여기에 Element를 끌어다 놓습니다."}
              ${(column.items || []).map((item) => `
                <div class="dacd-card">
                  <div class="dacd-card-title">${escapeHtml(item.type || "Element")}</div>
                  ${this.renderElementCanvasBody(item, index, scope)}
                </div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  renderTableCanvas(field) {
    const table = this.normalizeTableField(field);
    const columnCount = this.getTableColumnCount(table);
    return `
      <div class="dacd-table-editor-grid" style="grid-template-columns: repeat(${columnCount}, minmax(90px, 1fr));">
        ${table.rows.map((row) => row.cells.map((cell) => `
          <div class="dacd-table-cell-preview">${escapeHtml(cell?.items?.[0]?.text || "")}</div>
        `).join("")).join("")}
      </div>
    `;
  }

  getElementSummary(field) {
    if (field.type === "Container") return `${(field.items || []).length}개 child`;
    if (field.type === "ColumnSet") return `${(field.columns || []).length} columns`;
    if (field.type === "Table") return `${(field.rows || []).length} rows`;
    return "Adaptive Card Element";
  }

  renderFieldEditor(field, index) {
    return this.renderElementFieldEditor(field, index, "input");
  }

  refreshPreviewAndOutput() {
    const output = this.mode === "input" ? this.buildInputOutput() : this.buildOutputOutput();
    this.latestOutput = output;
    this.shadowRoot.querySelector("[data-output-json]").value = formatJson(output.adaptiveCard);
    this.shadowRoot.querySelector("[data-data-json-title]").textContent = this.mode === "input" ? "Submit Data JSON" : "Input Data JSON";
    this.shadowRoot.querySelector("[data-data-json]").value = formatJson(this.mode === "input" ? output.submitData : output.inputData);
    this.shadowRoot.querySelector("[data-meta-json]").value = formatJson(output);
    this.renderPreview(output.adaptiveCard);
    this.validate(output);
    this.dispatchEvent(new CustomEvent("daon-designer-change", {
      bubbles: true,
      detail: output,
    }));
  }

  buildInputOutput() {
    const bodyItems = this.inputFields.filter((field) => !field.type?.startsWith("Action.")).map((field) => this.buildInputElement(field));
    const body = this.groupElementsByRow(
      this.inputFields.filter((field) => !field.type?.startsWith("Action.")),
      bodyItems
    );

    const actions = this.inputFields
      .filter((field) => field.type?.startsWith("Action."))
      .map((field) => {
        if (field.type === "Action.OpenUrl") return { type: "Action.OpenUrl", title: field.title || "열기", url: field.url || "https://adaptivecards.io" };
        if (field.type === "Action.Execute") return { type: "Action.Execute", title: field.title || "실행", verb: field.verb || "execute" };
        if (field.type === "Action.ShowCard") return { type: "Action.ShowCard", title: field.title || "카드 보기", card: { type: "AdaptiveCard", body: [{ type: "TextBlock", text: field.text || "ShowCard" }] } };
        if (field.type === "Action.ToggleVisibility") return { type: "Action.ToggleVisibility", title: field.title || "표시 전환", targetElements: [] };
        if (field.type === "Action.ResetInputs") return { type: "Action.ResetInputs", title: field.title || "입력 초기화" };
        if (field.type === "Action.Popover") return { type: "Action.Popover", title: field.title || "팝오버", card: field.card || { type: "AdaptiveCard", body: [] } };
        if (field.type === "Action.OpenUrlDialog") return { type: "Action.OpenUrlDialog", title: field.title || "대화상자 열기", url: field.url || "https://example.com" };
        if (field.type === "Action.InsertImage") return { type: "Action.InsertImage", title: field.title || "이미지 삽입", url: field.url || "https://adaptivecards.io/content/cats/1.png" };
        if (field.type === "Action.RunCommands") return { type: "Action.RunCommands", title: field.title || "명령 실행", commands: field.commands || [] };
        return { type: "Action.Submit", title: field.title || "제출" };
      });

    const adaptiveCard = {
      type: "AdaptiveCard",
      version: "1.5",
      body,
      actions: actions.length > 0 ? actions : [{ type: "Action.Submit", title: "제출" }],
    };

    const outputSchema = Object.fromEntries([
      ...this.inputFields
        .filter((field) => field.type.startsWith("Input."))
        .map((field) => [field.id, { type: field.type, required: Boolean(field.required) }]),
    ]);
    const submitData = Object.fromEntries([
      ...this.inputFields
        .filter((field) => field.type.startsWith("Input."))
        .map((field) => [field.id, this.getInputSampleValue(field)]),
    ]);

    return {
      cardType: "input",
      adaptiveCard,
      submitData,
      outputSchema,
    };
  }

  buildInputElement(field) {
      if (!field.type?.startsWith("Input.") && !field.type?.startsWith("Action.")) {
        return this.buildOutputElement(field);
      }
      const base = {
        type: field.type,
        id: field.id,
        label: field.label || field.id,
        isRequired: Boolean(field.isRequired ?? field.required),
      };
      if (field.type === "Input.Text") return { ...base, placeholder: field.placeholder || "" };
      if (field.type === "Input.Number") return { ...base, min: 0, max: 999 };
      if (field.type === "Input.Date") return { ...base };
      if (field.type === "Input.Time") return { ...base };
      if (field.type === "Input.Rating") return { ...base, value: Number(field.value || 0), max: Number(field.max || 5) };
      if (field.type === "Input.Toggle") return { ...base, title: field.label || field.id, valueOn: "true", valueOff: "false" };
      return { ...base, choices: this.parseChoices(field.choices) };
  }

  groupElementsByRow(fields, elements) {
    const grouped = new Map();
    fields.forEach((field, index) => {
      const rowNumber = Number(field.row || 1);
      const key = Number.isFinite(rowNumber) && rowNumber > 0 ? rowNumber : 1;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(elements[index]);
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .flatMap(([, rowElements]) => {
        const validElements = rowElements.filter(Boolean);
        if (validElements.length <= 1) return validElements;
        return [{
          type: "ColumnSet",
          columns: validElements.map((item) => ({
            type: "Column",
            width: "stretch",
            items: [item],
          })),
        }];
      });
  }

  buildOutputOutput() {
    const rows = getRows(this.outputData);
    const first = rows[0] || {};
    const fields = this.outputFields.filter((field) => field.visible);
    const bodyFields = fields.filter((field) => !field.type?.startsWith("Action."));
    const actions = fields
      .filter((field) => field.type?.startsWith("Action."))
      .map((field) => {
        if (field.type === "Action.OpenUrl") return { type: "Action.OpenUrl", title: field.title || "열기", url: field.url || "https://adaptivecards.io" };
        if (field.type === "Action.Execute") return { type: "Action.Execute", title: field.title || "실행", verb: field.verb || "execute" };
        if (field.type === "Action.ShowCard") return { type: "Action.ShowCard", title: field.title || "카드 보기", card: { type: "AdaptiveCard", body: [{ type: "TextBlock", text: field.text || "ShowCard" }] } };
        if (field.type === "Action.ToggleVisibility") return { type: "Action.ToggleVisibility", title: field.title || "표시 전환", targetElements: [] };
        if (field.type === "Action.ResetInputs") return { type: "Action.ResetInputs", title: field.title || "입력 초기화" };
        if (field.type === "Action.Popover") return { type: "Action.Popover", title: field.title || "팝오버", card: field.card || { type: "AdaptiveCard", body: [] } };
        if (field.type === "Action.OpenUrlDialog") return { type: "Action.OpenUrlDialog", title: field.title || "대화상자 열기", url: field.url || "https://example.com" };
        if (field.type === "Action.InsertImage") return { type: "Action.InsertImage", title: field.title || "이미지 삽입", url: field.url || "https://adaptivecards.io/content/cats/1.png" };
        if (field.type === "Action.RunCommands") return { type: "Action.RunCommands", title: field.title || "명령 실행", commands: field.commands || [] };
        return { type: "Action.Submit", title: field.title || "제출" };
      });
    let template;

    if (this.outputLayout === "list") {
      template = {
        type: "AdaptiveCard",
        version: "1.5",
        body: rows.map((row) => ({
          type: "Container",
          separator: true,
          items: this.buildOutputItems(bodyFields, row),
        })),
        actions,
      };
    } else if (this.outputLayout === "grid") {
      template = {
        type: "AdaptiveCard",
        version: "1.5",
        body: this.buildOutputGrid(bodyFields, first, true),
        actions,
      };
    } else {
      template = {
        type: "AdaptiveCard",
        version: "1.5",
        body: this.buildOutputItems(bodyFields, first, true),
        actions,
      };
    }

    return {
      cardType: "output",
      inputData: this.outputData,
      fieldMap: fields,
      template,
      adaptiveCard: bindTemplate(template, first),
    };
  }

  buildOutputItems(fields, row, useTemplateValue = false) {
    const items = [];
    const facts = [];

    fields.forEach((field) => {
      if (field.kind === "TextBlock" || field.kind === "Element") {
        if (facts.length > 0) {
          items.push({ type: "FactSet", facts: facts.splice(0) });
        }
        items.push(this.buildOutputElement(field, row, useTemplateValue));
        return;
      }
      const value = useTemplateValue ? `\${${field.key}}` : row?.[field.key] ?? "";
      if (field.element === "Title") {
        items.push({ type: "TextBlock", text: String(value), weight: "Bolder", size: "Medium", wrap: true });
      } else if (field.element === "TextBlock") {
        items.push({ type: "TextBlock", text: `${field.label}: ${value}`, wrap: true });
      } else {
        facts.push({ title: field.label || field.key, value: String(value) });
      }
    });

    if (facts.length > 0) items.push({ type: "FactSet", facts });
    return items;
  }

  buildOutputGrid(fields, row, useTemplateValue = false) {
    const grouped = new Map();
    fields.forEach((field) => {
      const rowNumber = Number(field.row || 1);
      const key = Number.isFinite(rowNumber) && rowNumber > 0 ? rowNumber : 1;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(field);
    });
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([, rowFields]) => this.buildOutputGridRow(rowFields, row, useTemplateValue))
      .filter(Boolean);
  }

  buildOutputGridRow(fields, row, useTemplateValue = false) {
    const columns = fields.map((field) => {
      if (field.kind === "TextBlock" || field.kind === "Element") {
        return {
          type: "Column",
          width: "stretch",
          items: [this.buildOutputElement(field, row, useTemplateValue)],
        };
      }
      const value = useTemplateValue ? `\${${field.key}}` : row?.[field.key] ?? "";
      const label = field.label || field.key;
      const items = field.element === "Title"
        ? [{ type: "TextBlock", text: String(value), weight: "Bolder", size: "Medium", wrap: true }]
        : [
            { type: "TextBlock", text: label, weight: "Bolder", size: "Small", wrap: true },
            { type: "TextBlock", text: String(value), wrap: true, spacing: "Small" },
          ];
      return {
        type: "Column",
        width: "stretch",
        items,
      };
    });
    if (columns.length === 0) return null;
    return { type: "ColumnSet", columns };
  }

  buildOutputElement(field) {
    const type = field.type || "TextBlock";
    if (type === "TextBlock") {
      return this.cleanAdaptiveNode({ ...field, text: field.text || "새 텍스트", wrap: field.wrap !== false });
    }
    if (type === "RichTextBlock") {
      return this.cleanAdaptiveNode({ ...field, inlines: field.inlines || [{ type: "TextRun", text: field.text || "강조 텍스트", weight: "Bolder" }] });
    }
    if (type === "CodeBlock") {
      return this.cleanAdaptiveNode({ ...field, codeSnippet: field.codeSnippet || field.code || "", language: field.language || "" });
    }
    if (type === "ImageSet") {
      return this.cleanAdaptiveNode({ ...field, images: field.images || [{ type: "Image", url: field.url || "https://adaptivecards.io/content/cats/1.png" }] });
    }
    if (type === "Media") {
      return this.cleanAdaptiveNode({ ...field, poster: field.poster || field.url || "https://adaptivecards.io/content/cats/1.png", sources: field.sources || [] });
    }
    if (type === "Icon") {
      return this.cleanAdaptiveNode({ ...field, name: field.name || "Info" });
    }
    if (type === "Badge") {
      return this.cleanAdaptiveNode({ ...field, text: field.text || field.title || "Badge" });
    }
    if (type === "Rating") {
      return this.cleanAdaptiveNode({ ...field, value: Number(field.value || 3), max: Number(field.max || 5) });
    }
    if (type === "ProgressBar" || type === "ProgressRing" || type === "CompoundButton" || type === "ActionSet") {
      return this.cleanAdaptiveNode({ ...field });
    }
    if (type === "Table") {
      return this.buildTableElement(field, false);
    }
    if (type.startsWith("Input.")) {
      return this.buildInputElement(field);
    }
    if (type.startsWith("Chart.")) {
      return {
        type: "Image",
        url: field.url || this.buildChartDataUri(field),
        altText: field.text || type,
      };
    }
    if (type === "Container") {
      const container = this.normalizeContainerField(field);
      return this.cleanAdaptiveNode({ ...field, items: container.items });
    }
    if (type === "Image") {
      return {
        type: "Image",
        url: field.url || "https://adaptivecards.io/content/cats/1.png",
        altText: field.text || "이미지",
      };
    }
    if (type === "FactSet") {
      return {
        type: "FactSet",
        facts: Array.isArray(field.facts) ? field.facts : this.parseFacts(field.facts || "항목:값"),
      };
    }
    if (type === "ColumnSet") {
      const columnSet = this.normalizeColumnSetField(field);
      return this.cleanAdaptiveNode({ ...field, columns: columnSet.columns });
    }
    return { type: "TextBlock", text: field.text || "새 라벨", weight: "Bolder", wrap: true };
  }

  buildTableElement(field) {
    const table = this.normalizeTableField(field);
    return {
      type: "Table",
      columns: table.columns,
      rows: table.rows.map((row, rowIndex) => ({
        type: "TableRow",
        cells: row.cells.map((cell, columnIndex) => {
          const text = this.getTableCellText(table, rowIndex, columnIndex);
          return {
            type: "TableCell",
            items: [{ type: "TextBlock", text, wrap: true, ...(cell?.items?.[0]?.weight ? { weight: cell.items[0].weight } : {}) }],
          };
        }),
      })),
      showGridLines: field.showGridLines !== false,
      firstRowAsHeaders: field.firstRowAsHeaders !== false,
      gridStyle: field.gridStyle || undefined,
      horizontalCellContentAlignment: field.horizontalCellContentAlignment || undefined,
      verticalCellContentAlignment: field.verticalCellContentAlignment || undefined,
    };
  }

  cleanAdaptiveNode(node) {
    const internalKeys = new Set(["kind", "row", "visible", "required", "columns_count", "code"]);
    return Object.fromEntries(Object.entries(node).filter(([key, value]) => !internalKeys.has(key) && value !== undefined && value !== ""));
  }

  buildChartDataUri(field) {
    const type = field.type || "Chart.Bar";
    const facts = this.parseFacts(field.facts || "A:12,B:8,C:5");
    const values = facts.map((fact) => Number(fact.value) || 0);
    const max = Math.max(...values, 1);
    const title = escapeHtml(field.text || type);
    let body = `<text x="16" y="28" font-size="16" font-weight="700" fill="#172033">${title}</text>`;

    if (type === "Chart.Line") {
      const points = values.map((value, index) => {
        const x = 28 + index * (300 / Math.max(values.length - 1, 1));
        const y = 150 - (value / max) * 92;
        return `${x},${y}`;
      }).join(" ");
      body += `<polyline points="${points}" fill="none" stroke="#4f46e5" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
      facts.forEach((fact, index) => {
        const x = 28 + index * (300 / Math.max(values.length - 1, 1));
        body += `<text x="${x - 10}" y="174" font-size="11" fill="#64748b">${escapeHtml(fact.title)}</text>`;
      });
    } else if (type === "Chart.Pie") {
      body += `<circle cx="92" cy="104" r="54" fill="#4f46e5"/><path d="M92 104 L92 50 A54 54 0 0 1 144 118 Z" fill="#22c55e"/><path d="M92 104 L144 118 A54 54 0 0 1 70 154 Z" fill="#f59e0b"/>`;
      facts.slice(0, 4).forEach((fact, index) => {
        body += `<text x="178" y="${82 + index * 22}" font-size="13" fill="#172033">${escapeHtml(fact.title)} ${escapeHtml(fact.value)}</text>`;
      });
    } else {
      facts.forEach((fact, index) => {
        const y = 56 + index * 30;
        const width = Math.max(8, (Number(fact.value) || 0) / max * 220);
        body += `<text x="16" y="${y + 15}" font-size="12" fill="#334155">${escapeHtml(fact.title)}</text><rect x="96" y="${y}" width="${width}" height="18" rx="5" fill="#4f46e5"/><text x="${104 + width}" y="${y + 14}" font-size="12" fill="#334155">${escapeHtml(fact.value)}</text>`;
      });
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="190" viewBox="0 0 360 190"><rect width="360" height="190" rx="14" fill="#f8fafc"/><rect x="0.5" y="0.5" width="359" height="189" rx="13.5" fill="none" stroke="#d8e1f0"/>${body}</svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  parseChoices(value) {
    if (Array.isArray(value)) return value;
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [rawValue, rawTitle] = item.split(":");
        return { value: rawValue?.trim() || item, title: rawTitle?.trim() || rawValue?.trim() || item };
      });
  }

  parseFacts(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [title, factValue] = item.split(":");
        return { title: title?.trim() || "항목", value: factValue?.trim() || "" };
      });
  }

  getInputSampleValue(field) {
    if (field.type === "Input.Toggle") return "false";
    if (field.type === "Input.ChoiceSet") return this.parseChoices(field.choices)[0]?.value || "";
    return "";
  }

  renderPreview(card) {
    const host = this.shadowRoot.querySelector("[data-preview]");
    host.innerHTML = "";
    host.appendChild(this.renderAdaptiveCard(card));
  }

  renderAdaptiveCard(card) {
    const root = document.createElement("div");
    root.className = "dacd-preview-card";
    (card?.body || []).forEach((item) => root.appendChild(this.renderElement(item)));
    if (Array.isArray(card?.actions) && card.actions.length > 0) {
      const actions = document.createElement("div");
      actions.className = "dacd-actions";
      card.actions.forEach((action) => {
        const button = document.createElement("button");
        button.className = "dacd-action";
        button.type = "button";
        button.textContent = action.title || action.type;
        actions.appendChild(button);
      });
      root.appendChild(actions);
    }
    return root;
  }

  renderElement(item) {
    if (item.type === "TextBlock") {
      const node = document.createElement("div");
      node.className = `dacd-textblock ${item.weight === "Bolder" || item.size === "Medium" ? "title" : ""}`;
      node.textContent = item.text || "";
      return node;
    }
    if (item.type === "RichTextBlock") {
      const node = document.createElement("div");
      node.className = "dacd-textblock";
      (item.inlines || []).forEach((inline) => {
        const span = document.createElement("span");
        span.textContent = inline.text || "";
        if (inline.weight === "Bolder") span.style.fontWeight = "800";
        if (inline.italic) span.style.fontStyle = "italic";
        node.appendChild(span);
      });
      return node;
    }
    if (item.type === "Image") {
      const image = document.createElement("img");
      image.src = item.url || "";
      image.alt = item.altText || "image";
      image.style.maxWidth = "100%";
      image.style.borderRadius = "10px";
      return image;
    }
    if (item.type === "ImageSet") {
      const set = document.createElement("div");
      set.className = "dacd-columnset";
      set.style.gridTemplateColumns = `repeat(${Math.max(item.images?.length || 1, 1)}, minmax(0, 1fr))`;
      (item.images || []).forEach((imageItem) => set.appendChild(this.renderElement(imageItem)));
      return set;
    }
    if (item.type === "Media") {
      const box = document.createElement("div");
      box.className = "dacd-card";
      const title = document.createElement("div");
      title.className = "dacd-mini";
      title.textContent = "Media";
      box.appendChild(title);
      if (item.poster) box.appendChild(this.renderElement({ type: "Image", url: item.poster, altText: "media poster" }));
      return box;
    }
    if (item.type === "Icon" || item.type === "Badge") {
      const chip = document.createElement("span");
      chip.className = "dacd-chip";
      chip.textContent = item.name || item.text || item.type;
      return chip;
    }
    if (item.type === "Rating") {
      const node = document.createElement("div");
      node.className = "dacd-mini";
      const value = Math.max(0, Math.min(Number(item.value || 0), Number(item.max || 5)));
      node.textContent = `${"★".repeat(value)}${"☆".repeat(Math.max(Number(item.max || 5) - value, 0))}`;
      return node;
    }
    if (item.type === "Carousel") {
      const box = document.createElement("div");
      box.className = "dacd-card";
      (item.pages || []).forEach((page) => {
        const pageNode = document.createElement("div");
        pageNode.className = "dacd-column";
        (page.items || []).forEach((child) => pageNode.appendChild(this.renderElement(child)));
        box.appendChild(pageNode);
      });
      return box;
    }
    if (item.type === "FactSet") {
      const set = document.createElement("div");
      set.className = "dacd-factset";
      (item.facts || []).forEach((fact) => {
        const row = document.createElement("div");
        row.className = "dacd-fact";
        const title = document.createElement("strong");
        const value = document.createElement("span");
        title.textContent = fact.title || "";
        value.textContent = fact.value || "";
        row.append(title, value);
        set.appendChild(row);
      });
      return set;
    }
    if (item.type === "ColumnSet") {
      const set = document.createElement("div");
      const columns = item.columns || [];
      set.className = "dacd-columnset";
      set.style.gridTemplateColumns = `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`;
      columns.forEach((column) => set.appendChild(this.renderElement(column)));
      return set;
    }
    if (item.type === "Column") {
      const column = document.createElement("div");
      column.className = "dacd-column";
      (item.items || []).forEach((child) => column.appendChild(this.renderElement(child)));
      return column;
    }
    if (item.type === "Table") {
      const table = document.createElement("div");
      table.className = "dacd-factset";
      (item.rows || []).forEach((row) => {
        const rowNode = document.createElement("div");
        rowNode.className = "dacd-columnset";
        rowNode.style.gridTemplateColumns = `repeat(${Math.max(row.cells?.length || 1, 1)}, minmax(0, 1fr))`;
        (row.cells || []).forEach((cell) => {
          const cellNode = document.createElement("div");
          cellNode.className = "dacd-column";
          (cell.items || []).forEach((child) => cellNode.appendChild(this.renderElement(child)));
          rowNode.appendChild(cellNode);
        });
        table.appendChild(rowNode);
      });
      return table;
    }
    if (item.type === "Container") {
      const box = document.createElement("div");
      box.className = "dacd-card";
      (item.items || []).forEach((child) => box.appendChild(this.renderElement(child)));
      return box;
    }
    if (item.type?.startsWith("Input.")) {
      const label = document.createElement("label");
      label.className = "dacd-field";
      const title = item.label || item.title || item.id;
      if (item.type === "Input.ChoiceSet") {
        const span = document.createElement("span");
        const select = document.createElement("select");
        span.textContent = title;
        (item.choices || []).forEach((choice) => {
          const option = document.createElement("option");
          option.textContent = choice.title;
          select.appendChild(option);
        });
        label.append(span, select);
      } else if (item.type === "Input.Toggle") {
        label.className = "dacd-row";
        const checkbox = document.createElement("input");
        const span = document.createElement("span");
        checkbox.type = "checkbox";
        checkbox.style.width = "auto";
        span.textContent = title;
        label.append(checkbox, span);
      } else {
        const span = document.createElement("span");
        const input = document.createElement("input");
        span.textContent = title;
        input.placeholder = item.placeholder || "";
        label.append(span, input);
      }
      return label;
    }
    const fallback = document.createElement("div");
    fallback.className = "dacd-mini";
    fallback.textContent = `${item.type || "Unknown"} 미리보기`;
    return fallback;
  }

  validate(output) {
    const problems = [];
    if (output.cardType === "input") {
      const seen = new Set();
      this.inputFields.filter((field) => field.type.startsWith("Input.")).forEach((field) => {
        if (!field.id) problems.push("입력 필드 id가 비어 있습니다.");
        if (field.id && !isCamelCase(field.id)) problems.push(`'${field.id}'는 camelCase가 아닙니다.`);
        if (field.id && seen.has(field.id)) problems.push(`'${field.id}' id가 중복되었습니다.`);
        seen.add(field.id);
      });
    } else {
      const rows = getRows(this.outputData);
      const first = rows[0] || {};
      if (rows.length === 0) problems.push("Input Data JSON은 객체 또는 객체 배열이어야 합니다.");
      if (this.outputFields.filter((field) => field.visible).length === 0) problems.push("표시할 출력 필드가 없습니다.");
      Object.keys(first).forEach((key) => {
        if (!isCamelCase(key)) problems.push(`Input Data key '${key}'는 camelCase가 아닙니다.`);
      });
    }
    this.writeValidation(problems.join("\n"));
  }

  writeValidation(message) {
    const host = this.shadowRoot.querySelector("[data-validation]");
    host.innerHTML = message ? `<div class="dacd-error">${String(message).replace(/\n/g, "<br />")}</div>` : "";
  }

  addField() {
    this.inputFields.push({ id: "newField", label: "새 입력", type: "Input.Text", required: false, placeholder: "" });
    this.refreshAll();
  }

  addElement(type) {
    const count = this.inputFields.filter((field) => field.type === type).length + 1;
    const field = this.createDefaultElement(type);
    if (field.type?.startsWith("Input.")) {
      field.id = `${field.type.split(".")[1].toLowerCase()}Input${count}`;
      field.required = false;
    }
    this.inputFields.push(field);
    this.selectedInputIndex = this.inputFields.length - 1;
    this.refreshAll();
  }

  removeField(index) {
    this.inputFields.splice(index, 1);
    this.selectedInputIndex = this.inputFields[index] ? index : null;
    this.refreshAll();
  }

  clearInputFields() {
    this.inputFields = [];
    this.selectedInputIndex = null;
    this.refreshAll();
  }

  convertCsv() {
    this.outputData = csvToJson(this.csvText);
    this.outputFields = [];
    this.renderLeftPanel();
    this.refreshPreviewAndOutput();
  }

  syncOutputFields() {
    this.outputFields = normalizeOutputFields(this.outputData, this.outputFields).map((field) => ({
      ...field,
      kind: "DataField",
      row: field.row || 1,
    }));
    this.renderOutputFields();
    this.renderLeftPanel();
    this.refreshPreviewAndOutput();
  }

  addOutputField(key) {
    if (!key || this.outputFields.some((field) => field.key === key)) return;
    const [field] = normalizeOutputFields({ [key]: getRows(this.outputData)[0]?.[key] ?? "" }, this.outputFields);
    this.outputFields.push({ ...(field || { key, label: labelFromKey(key) || key, element: "Fact", visible: true }), kind: "DataField", row: field?.row || 1 });
    this.selectedOutputIndex = this.outputFields.length - 1;
    this.renderLeftPanel();
    this.refreshPreviewAndOutput();
  }

  addOutputElement(type) {
    const field = this.createDefaultElement(type, { kind: "Element", visible: true });
    this.outputFields.push(field);
    this.selectedOutputIndex = this.outputFields.length - 1;
    this.renderLeftPanel();
    this.refreshPreviewAndOutput();
  }

  getTableField(scope, index) {
    const collection = scope === "input" ? this.inputFields : this.outputFields;
    return collection?.[index] || null;
  }

  getContainerField(scope, index) {
    const collection = scope === "input" ? this.inputFields : this.outputFields;
    return collection?.[index] || null;
  }

  addContainerItem(scope, index, type) {
    const field = this.getContainerField(scope, index);
    if (!field) return;
    this.normalizeContainerField(field);
    field.items.push(this.createContainerItem(type));
    this.renderLeftPanel();
    this.refreshPreviewAndOutput();
  }

  removeContainerItem(scope, index, itemIndex) {
    const field = this.getContainerField(scope, index);
    if (!field) return;
    this.normalizeContainerField(field);
    field.items.splice(itemIndex, 1);
    this.renderLeftPanel();
    this.refreshPreviewAndOutput();
  }

  updateContainerItem(scope, index, itemIndex, prop, value) {
    const field = this.getContainerField(scope, index);
    if (!field) return;
    this.normalizeContainerField(field);
    const item = field.items[itemIndex];
    if (!item) return;
    if (prop === "factsText") {
      item.facts = this.parseFacts(value);
    } else {
      item[prop] = value;
    }
    this.refreshPreviewAndOutput();
  }

  getColumnSetField(scope, index) {
    const collection = scope === "input" ? this.inputFields : this.outputFields;
    return collection?.[index] || null;
  }

  applyColumnSetAction(scope, index, action) {
    const field = this.getColumnSetField(scope, index);
    if (!field) return;
    this.normalizeColumnSetField(field);
    if (action === "add-column") {
      field.columns.push({ type: "Column", width: "stretch", items: [] });
    }
    if (action === "delete-column" && field.columns.length > 1) {
      field.columns.pop();
    }
    this.renderLeftPanel();
    this.refreshPreviewAndOutput();
  }

  addColumnItem(scope, index, columnIndex, type) {
    const field = this.getColumnSetField(scope, index);
    if (!field) return;
    this.normalizeColumnSetField(field);
    const column = field.columns[columnIndex];
    if (!column) return;
    column.items.push(this.createContainerItem(type));
    this.renderLeftPanel();
    this.refreshPreviewAndOutput();
  }

  removeColumnItem(scope, index, columnIndex, itemIndex) {
    const field = this.getColumnSetField(scope, index);
    if (!field) return;
    this.normalizeColumnSetField(field);
    const column = field.columns[columnIndex];
    if (!column) return;
    column.items.splice(itemIndex, 1);
    this.renderLeftPanel();
    this.refreshPreviewAndOutput();
  }

  updateColumnWidth(scope, index, columnIndex, value) {
    const field = this.getColumnSetField(scope, index);
    if (!field) return;
    this.normalizeColumnSetField(field);
    const column = field.columns[columnIndex];
    if (!column) return;
    column.width = value || "stretch";
    this.refreshPreviewAndOutput();
  }

  updateFieldProperty(field, prop, value) {
    if (!field) return;
    const jsonProps = new Set([
      "actions",
      "card",
      "choices",
      "columns",
      "commands",
      "data",
      "fallback",
      "facts",
      "images",
      "inlineAction",
      "inlines",
      "items",
      "requires",
      "selectAction",
      "sources",
      "targetElements",
      "targetInputIds",
    ]);
    if (jsonProps.has(prop)) {
      try {
        field[prop] = JSON.parse(value || (["actions", "choices", "columns", "commands", "facts", "images", "inlines", "items", "sources", "targetElements", "targetInputIds"].includes(prop) ? "[]" : "{}"));
        this.writeValidation("");
      } catch {
        this.writeValidation(`${prop} JSON 형식이 올바르지 않습니다.`);
      }
      return;
    }
    if (String(prop).includes(".")) {
      const parts = String(prop).split(".");
      let target = field;
      parts.slice(0, -1).forEach((part) => {
        target[part] = target[part] && typeof target[part] === "object" ? target[part] : {};
        target = target[part];
      });
      target[parts[parts.length - 1]] = value;
      return;
    }
    if (prop === "isRequired") {
      field.isRequired = value;
      field.required = value;
      return;
    }
    if (prop === "columns_count") return;
    if (prop === "cardJson") {
      try {
        field.card = JSON.parse(value || "{}");
      } catch {
        this.writeValidation("Card JSON 형식이 올바르지 않습니다.");
      }
      return;
    }
    if (prop === "commandsJson") {
      try {
        field.commands = JSON.parse(value || "[]");
      } catch {
        this.writeValidation("Commands JSON 형식이 올바르지 않습니다.");
      }
      return;
    }
    if (prop === "facts" && field.type === "FactSet") {
      field.facts = this.parseFacts(value);
      return;
    }
    field[prop] = value;
  }

  updateTableCellText(scope, index, rowIndex, columnIndex, value) {
    const field = this.getTableField(scope, index);
    if (!field) return;
    this.normalizeTableField(field);
    const cell = field.rows?.[rowIndex]?.cells?.[columnIndex];
    if (!cell) return;
    const items = Array.isArray(cell.items) ? [...cell.items] : [];
    const first = { type: "TextBlock", wrap: true, ...(items[0] || {}) };
    first.text = value;
    items[0] = first;
    cell.items = items;
    this.refreshPreviewAndOutput();
  }

  applyTableAction(scope, index, action) {
    const field = this.getTableField(scope, index);
    if (!field) return;
    this.normalizeTableField(field);
    const columnCount = this.getTableColumnCount(field);
    if (action === "add-row") {
      field.rows = [
        ...(field.rows || []),
        {
          type: "TableRow",
          cells: Array.from({ length: columnCount }, () => this.createTableCell("")),
        },
      ];
    }
    if (action === "add-column") {
      field.columns = [...(field.columns || []), { width: 1 }];
      field.rows = (field.rows || []).map((row, rowIndex) => ({
        ...row,
        cells: [
          ...(row.cells || []),
          this.createTableCell(rowIndex === 0 ? `Header ${(row.cells || []).length + 1}` : ""),
        ],
      }));
    }
    if (action === "delete-row" && (field.rows || []).length > 1) {
      field.rows = field.rows.slice(0, -1);
    }
    if (action === "delete-column" && this.getTableColumnCount(field) > 1) {
      field.columns = (field.columns || []).slice(0, -1);
      field.rows = (field.rows || []).map((row) => ({
        ...row,
        cells: (row.cells || []).slice(0, -1),
      }));
    }
    this.renderLeftPanel();
    this.refreshPreviewAndOutput();
  }

  getDropPlacement(event, target) {
    const rect = target.getBoundingClientRect();
    const yRatio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;
    return yRatio > 0.68 ? "below" : "beside";
  }

  moveFieldByDrop(scope, fromIndex, targetIndex, placement) {
    const collection = scope === "input" ? this.inputFields : this.outputFields;
    if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= collection.length) return;
    if (fromIndex === targetIndex) return;
    const [field] = collection.splice(fromIndex, 1);
    const hasTarget = Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < collection.length + 1;
    const adjustedTargetIndex = hasTarget && fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const target = hasTarget ? collection[adjustedTargetIndex] : null;
    if (target) {
      const targetRow = Number(target.row || 1);
      field.row = placement === "below" ? targetRow + 1 : targetRow;
      collection.splice(adjustedTargetIndex + 1, 0, field);
    } else {
      const maxRow = collection.reduce((max, item) => Math.max(max, Number(item.row || 1)), 0);
      field.row = maxRow + 1;
      collection.push(field);
    }
    if (scope === "input") {
      this.selectedInputIndex = collection.indexOf(field);
      this.refreshAll();
    } else {
      this.selectedOutputIndex = collection.indexOf(field);
      this.renderLeftPanel();
      this.refreshPreviewAndOutput();
    }
  }

  removeOutputField(index) {
    this.outputFields.splice(index, 1);
    this.selectedOutputIndex = this.outputFields[index] ? index : null;
    this.renderLeftPanel();
    this.refreshPreviewAndOutput();
  }

  moveOutputField(index, direction) {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= this.outputFields.length) return;
    const [field] = this.outputFields.splice(index, 1);
    this.outputFields.splice(nextIndex, 0, field);
    this.renderOutputFields();
    this.refreshPreviewAndOutput();
  }

  async copyOutput() {
    await this.copyText(this.shadowRoot.querySelector("[data-output-json]").value);
  }

  async copyData() {
    await this.copyText(this.shadowRoot.querySelector("[data-data-json]").value);
  }

  async copyMeta() {
    await this.copyText(this.shadowRoot.querySelector("[data-meta-json]").value);
  }

  getValue() {
    return this.latestOutput || (this.mode === "input" ? this.buildInputOutput() : this.buildOutputOutput());
  }

  async copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    this.writeValidation("브라우저 보안 정책 때문에 복사가 막혔습니다. JSON 영역에서 직접 선택해 복사하세요.");
  }

  downloadOutput() {
    const blob = new Blob([this.shadowRoot.querySelector("[data-output-json]").value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${this.mode}-adaptive-card.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

customElements.define("daon-adaptive-card-designer", DaonAdaptiveCardDesigner);
