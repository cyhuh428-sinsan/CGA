import assert from "node:assert/strict";

import { extractMessageOptions, normalizeBackendMessage, summarizePayload } from "../apps/webchat/message-shape.js";

assert.deepEqual(
  extractMessageOptions({
    payload_json: {
      options: ["예", "아니오", ""]
    }
  }),
  ["예", "아니오"]
);

assert.equal(
  summarizePayload({
    columns: ["name"],
    rows: [{ name: "a" }, { name: "b" }]
  }),
  "표 응답: 2행"
);

assert.equal(
  summarizePayload({
    richForm: { type: "form" }
  }),
  "입력형 응답"
);

assert.equal(
  summarizePayload({
    adaptiveCard: { type: "AdaptiveCard" }
  }),
  "카드형 응답"
);

const normalizedRichMessage = normalizeBackendMessage({
  participant_kind: "bot",
  participant_name: "SupportBot",
  display_text: "다음 중 선택하세요",
  payload_json: {
    richForm: { type: "form" },
    options: ["예금", "대출"],
    sourceTalkNodeId: "talk-node-1"
  }
});

assert.deepEqual(normalizedRichMessage, {
  participantKind: "bot",
  participantName: "SupportBot",
  text: "다음 중 선택하세요",
  payloadSummary: "입력형 응답",
  options: ["예금", "대출"],
  sourceTalkNodeId: "talk-node-1"
});

const normalizedTableMessage = normalizeBackendMessage({
  participantKind: "bot",
  participantName: "SupportBot",
  payload: {
    columns: ["상품명"],
    rows: [{ name: "예금" }]
  }
});

assert.deepEqual(normalizedTableMessage, {
  participantKind: "bot",
  participantName: "SupportBot",
  text: "표 응답: 1행",
  payloadSummary: "",
  options: [],
  sourceTalkNodeId: ""
});

const normalizedFallbackMessage = normalizeBackendMessage({
  participant_kind: "user",
  text: "안녕하세요"
});

assert.deepEqual(normalizedFallbackMessage, {
  participantKind: "user",
  participantName: "사용자",
  text: "안녕하세요",
  payloadSummary: "",
  options: [],
  sourceTalkNodeId: ""
});

console.log("webchat message shape check passed");
