import assert from "node:assert/strict";
import test from "node:test";

test("봇 관리와 봇 작업공간의 선택값을 현재 제작 컨텍스트로 해석한다", async () => {
  let subject;
  try {
    subject = await import("./studio-work-context.ts");
  } catch (error) {
    assert.fail(`제작 작업 컨텍스트 해석기가 필요합니다: ${error}`);
  }

  assert.deepEqual(
    subject.resolveStudioWorkContext({
      pathname: "/studio/bots",
      selectedBotId: "bot-management",
      selectedVersionId: "v3",
      lastBotScreen: "/studio/bots/bot-old/versions/v1/intents",
    }),
    { botId: "bot-management", versionId: "v3" },
  );

  assert.deepEqual(
    subject.resolveStudioWorkContext({
      pathname: "/studio/workspace",
      selectedBotId: "bot-workspace",
      selectedVersionId: "v2",
      lastBotScreen: null,
    }),
    { botId: "bot-workspace", versionId: "v2" },
  );
});

test("봇 전용 화면 경로가 쿼리와 마지막 선택보다 우선한다", async () => {
  const { resolveStudioWorkContext } = await import("./studio-work-context.ts");

  assert.deepEqual(
    resolveStudioWorkContext({
      pathname: "/studio/bots/bot-route/versions/v7/intents",
      selectedBotId: "bot-query",
      selectedVersionId: "v6",
      lastBotScreen: "/studio/bots/bot-last/versions/v5/intents",
    }),
    { botId: "bot-route", versionId: "v7" },
  );
});

test("선택 URL은 기존 제작 모드를 유지하면서 봇과 버전을 기록한다", async () => {
  const { buildStudioSelectionHref } = await import("./studio-work-context.ts");

  assert.equal(
    buildStudioSelectionHref("/studio/workspace", "mode=build", "bot-1", "v4"),
    "/studio/workspace?mode=build&bot=bot-1&version=v4",
  );
});

test("저장된 버전은 활성 버전보다 우선하며 ID와 이름으로 찾을 수 있다", async () => {
  const { resolveStudioVersionId } = await import("./studio-work-context.ts");
  const versions = [
    { id: "version-active", name: "v1", is_active: true },
    { id: "version-selected", name: "v2", is_active: false },
  ];

  assert.equal(resolveStudioVersionId(versions, "v2"), "version-selected");
  assert.equal(resolveStudioVersionId(versions, "version-selected"), "version-selected");
  assert.equal(resolveStudioVersionId(versions, ""), "version-active");
});

test("다른 봇의 URL 버전은 새로 선택한 봇에 적용하지 않는다", async () => {
  const { resolveStudioQueryVersion } = await import("./studio-work-context.ts");

  assert.equal(resolveStudioQueryVersion("bot=bot-old&version=v8", "bot-new"), "");
  assert.equal(resolveStudioQueryVersion("bot=bot-new&version=v3", "bot-new"), "v3");
});

test("제작 선택 화면이 아닌 곳의 bot 쿼리는 작업 컨텍스트로 사용하지 않는다", async () => {
  const { resolveStudioWorkContext } = await import("./studio-work-context.ts");

  assert.deepEqual(
    resolveStudioWorkContext({
      pathname: "/admin/bot-status",
      selectedBotId: "admin-filter-bot",
      selectedVersionId: "v9",
      lastBotScreen: "/studio/bots/bot-last/versions/v2/intents",
    }),
    { botId: "bot-last", versionId: "v2" },
  );
});
