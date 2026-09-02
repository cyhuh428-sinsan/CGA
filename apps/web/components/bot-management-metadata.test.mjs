import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("봇 목록 메타데이터에는 내부 봇 ID를 표시하지 않는다", async () => {
  let subject;
  try {
    subject = await import("./bot-management-metadata.ts");
  } catch (error) {
    assert.fail(`봇 목록 메타데이터 컴포넌트가 필요합니다: ${error}`);
  }

  const markup = renderToStaticMarkup(createElement(subject.BotManagementMetadata, {
    bot: {
      id: "internal-bot-id-123",
      active_version: { name: "v1" },
    },
    statusLabel: "운영",
  }));

  assert.match(markup, />v1 · 운영<\/span>/);
  assert.doesNotMatch(markup, /internal-bot-id-123/);
});
