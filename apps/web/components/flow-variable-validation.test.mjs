import assert from "node:assert/strict";
import test from "node:test";

import {
  hasDuplicateVariableNames,
  shouldValidateVariableReferences,
} from "../lib/flow-variable-validation.ts";

test("서로 다른 카드가 같은 변수를 생성하거나 갱신할 수 있다", () => {
  assert.equal(hasDuplicateVariableNames(["$g_keyword"]), false);
  assert.equal(hasDuplicateVariableNames(["$g_keyword"]), false);
});

test("하나의 카드 안에서 같은 변수명을 두 번 지정하면 중복이다", () => {
  assert.equal(hasDuplicateVariableNames(["$g_keyword", "g_keyword"]), true);
});

test("변수명 비교는 공백, 달러 접두사, 대소문자를 정규화한다", () => {
  assert.equal(hasDuplicateVariableNames([" $Result ", "result"]), true);
});

test("모듈은 호출자가 전달하는 변수 참조를 허용한다", () => {
  assert.equal(shouldValidateVariableReferences(0), false);
});

test("의도는 정의되지 않은 변수 참조를 계속 검사한다", () => {
  assert.equal(shouldValidateVariableReferences(1), true);
});
