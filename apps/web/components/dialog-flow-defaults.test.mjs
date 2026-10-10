import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/version-document") {
      return {
        format: "module",
        shortCircuit: true,
        url: "data:text/javascript,export {}",
      };
    }
    return nextResolve(specifier, context);
  },
});

const { createDefaultDialogFlowGraph } = await import("../lib/dialog-flow.ts");

test("새 대화 설계는 시작 카드만 생성한다", () => {
  const graph = createDefaultDialogFlowGraph({
    id: "dialog-1",
    dialogNo: 1,
    dialogType: 0,
    name: "테스트 모듈",
    displayName: "테스트 모듈",
    dialogKey: "test-module",
    classificationType: "",
    transitionLocked: false,
    returnBlocked: false,
    feedbackEnabled: false,
    llmAnswerPrompt: "",
    tags: [],
    utterances: [],
    entityBindings: [],
    validationStatus: "none",
    cardCount: 0,
    hasFallbackResponse: false,
    updatedAt: "2026-10-10T00:00:00.000Z",
    updatedBy: "tester",
  });

  assert.deepEqual(graph.nodes.map((node) => node.kind), ["start"]);
  assert.deepEqual(graph.links, []);
});
