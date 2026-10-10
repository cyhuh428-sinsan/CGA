import assert from "node:assert/strict";
import test from "node:test";

import { INTENT_LIST_CATALOGS } from "../lib/i18n/intent-list.ts";

test("모든 지원 언어가 답변 포함 CSV와 누락 오류를 안내한다", () => {
  assert.deepEqual(Object.keys(INTENT_LIST_CATALOGS).sort(), ["de", "en", "fr", "ja", "ko", "vi", "zh-CN"]);

  for (const [language, catalog] of Object.entries(INTENT_LIST_CATALOGS)) {
    assert.match(catalog.uploadAnswerHeaderHelp, /답변/iu, `${language}: 답변 열 안내`);
    assert.ok(catalog.uploadRepeatedNameAnswerHelp.trim(), `${language}: 여러 행 처리 안내`);
    assert.match(catalog.uploadMissingAnswers, /\{names\}/u, `${language}: 누락 의도명 자리표시자`);
  }
});
