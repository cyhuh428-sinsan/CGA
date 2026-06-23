function readMessagePayload(message = {}) {
  if (message.payload_json && typeof message.payload_json === "object" && !Array.isArray(message.payload_json)) {
    return message.payload_json;
  }
  if (message.payload && typeof message.payload === "object" && !Array.isArray(message.payload)) {
    return message.payload;
  }
  return null;
}

export function extractMessageOptions(message = {}) {
  if (Array.isArray(message.options) && message.options.length) {
    return message.options.map((item) => String(item || "").trim()).filter(Boolean);
  }
  const payload = readMessagePayload(message);
  if (Array.isArray(payload?.options) && payload.options.length) {
    return payload.options.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return [];
}

export function summarizePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  if (Array.isArray(payload.columns) && Array.isArray(payload.rows)) {
    return `표 응답: ${payload.rows.length}행`;
  }
  if (payload.richForm || payload.rawJson) {
    return "입력형 응답";
  }
  if (payload.adaptiveCard) {
    return "카드형 응답";
  }
  const keys = Object.keys(payload).filter(Boolean);
  if (!keys.length) return "";
  return `확장 응답: ${keys.slice(0, 3).join(", ")}`;
}

export function normalizeBackendMessage(message = {}) {
  const participantKind = String(message.participant_kind || message.participantKind || "bot").toLowerCase();
  const participantName = String(message.participant_name || message.participantName || (participantKind === "user" ? "사용자" : "봇"));
  const text = String(message.display_text || message.text || "").trim();
  const payload = readMessagePayload(message);
  const sourceTalkNodeId = typeof payload?.sourceTalkNodeId === "string" ? payload.sourceTalkNodeId : "";
  return {
    participantKind,
    participantName,
    text: text || summarizePayload(payload),
    payloadSummary: text ? summarizePayload(payload) : "",
    options: extractMessageOptions(message),
    sourceTalkNodeId
  };
}
