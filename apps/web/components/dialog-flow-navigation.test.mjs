import assert from "node:assert/strict";
import test from "node:test";

import { getDialogStartPath } from "../lib/dialog-flow-navigation.ts";

test("모듈에는 의도 시작 경로가 없다", () => {
  assert.equal(getDialogStartPath(0, "bot-1", "v1", "module-1"), null);
});

test("의도는 기존 대화 시작 경로를 유지한다", () => {
  assert.equal(
    getDialogStartPath(1, "bot-1", "v1", "intent-1"),
    "/studio/bots/bot-1/versions/v1/intents/intent-1",
  );
});
