import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AIDOT_API_JSON_TOP_LEVEL_KEYS, AIDOT_BOT_JSON_TOP_LEVEL_KEYS, AIDOT_DIALOG_JSON_TOP_LEVEL_KEYS, AIDOT_VERSION_JSON_TOP_LEVEL_KEYS } from "../packages/contracts/src/aidot-package-contract.js";

const port = String(4193 + Math.floor(Math.random() * 100));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-asset-api-"));
const server = spawn("node", ["scripts/serve-studio.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: port, CGA_DATA_DIR: dataDir },
  stdio: "pipe"
});

function loadJsonFixture(name) {
  return JSON.parse(readFileSync(join(process.cwd(), "scripts", "fixtures", name), "utf8"));
}

function loadTextFixture(name) {
  return readFileSync(join(process.cwd(), "scripts", "fixtures", name), "utf8");
}

function fail(message) {
  console.error(`FAIL ${message}`);
  server.kill();
  process.exit(1);
}

async function waitForServer() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  fail("asset transfer API test server did not start");
}

async function main() {
  await waitForServer();
  const prefix = `${baseUrl}/api/cga/groups/g-support/bots/supportbot-draft`;
  const botId = "supportbot-draft";
  const versionStamp = "v0_1";

  function parseContentDispositionFileName(value) {
    const match = String(value || "").match(/filename="([^"]+)"/i);
    return match?.[1] || "";
  }

  function getExpectedExportStem(scope, targetBotId = botId) {
    const safeBotId = String(targetBotId || "bot").replace(/[^a-zA-Z0-9._-]/g, "_");
    const stemMap = {
      bot: `Bot_${safeBotId}`,
      version: `Version_${safeBotId}_${versionStamp}`,
      dialog: `FlowDesign_${safeBotId}`,
      intent_utterance: `LearningExpr_${safeBotId}`,
      entity: `Entity_${safeBotId}`,
      dictionary: `Dictionary_${safeBotId}`,
      blocklist: `Blocklist_${safeBotId}`,
      rule: `Rule_${safeBotId}`,
      api: `API_${safeBotId}`
    };
    return stemMap[scope] || `${String(scope || "Asset")}_${safeBotId}`;
  }

  function assertPackageTopLevel(packageData, requiredKeys, label) {
    const missing = requiredKeys.filter((key) => !(key in packageData));
    if (missing.length > 0) {
      fail(`${label} export package did not include required keys: ${missing.join(", ")}`);
    }
  }

  function getApiList(payload) {
    const root = payload?.package || payload;
    if (Array.isArray(root?.apiList)) return root.apiList;
    if (Array.isArray(root)) return root;
    if (!Array.isArray(root?.apis)) return [];
    return root.apis.map((api) => {
      const firstMethod = Array.isArray(api?.methods) ? api.methods[0] : null;
      return {
        name: api?.name,
        endpoint_url: api?.endpoint_url || api?.baseUrl || api?.endpoint || api?.url || (firstMethod?.methodUrl || firstMethod?.url) || "",
        method: firstMethod?.httpMethod || firstMethod?.method || api?.method || "GET",
        auth_type: api?.auth_type || api?.authType || "none",
        secret_ref: api?.secret_ref || api?.secretRef || "",
        response_path: api?.response_path || api?.responsePath || "data.answer"
      };
    });
  }

  function getApiRoot(payload) {
    return payload?.package || payload;
  }

  function getApiMethodCount(api) {
    return Array.isArray(api?.methods) ? api.methods.length : 1;
  }

  function getApiMethodUrls(api) {
    return (Array.isArray(api?.methods) ? api.methods : []).map((method) => method?.methodUrl || method?.url || "");
  }

  function getApiMethodByName(api, name) {
    return (Array.isArray(api?.methods) ? api.methods : []).find((method) => String(method?.name || method?.methodName || "") === name) || null;
  }

  function findApiByName(apis, name) {
    return (Array.isArray(apis) ? apis : []).find((item) => String(item?.name || item?.apiName || "") === name) || null;
  }

  async function fetchJson(path, options) {
    const response = await fetch(`${prefix}${path}`, options);
    const body = await response.json();
    if (!response.ok) fail(`${path} returned ${response.status}`);
    return body;
  }

  async function fetchText(path) {
    const response = await fetch(`${prefix}${path}`);
    const body = await response.text();
    if (!response.ok) fail(`${path} returned ${response.status}`);
    return body;
  }

  async function fetchExportText(path, scope) {
    const response = await fetch(`${prefix}${path}`);
    const body = await response.text();
    if (!response.ok) fail(`${path} returned ${response.status}`);
    const fileName = parseContentDispositionFileName(response.headers.get("content-disposition"));
    const expectedStem = getExpectedExportStem(scope);
    if (!fileName.startsWith(`${expectedStem}_`)) {
      fail(`${scope} export file name does not follow expected stem ${expectedStem}`);
    }
    const expectedExtension = scope === "dictionary" || scope === "blocklist" ? "txt" : "json";
    if (!fileName.endsWith(`.${expectedExtension}`)) {
      fail(`${scope} export file should use ${expectedExtension} extension`);
    }
    return body;
  }

  async function fetchExportJson(path, scope) {
    const response = await fetch(`${prefix}${path}`);
    const body = await response.json();
    if (!response.ok) fail(`${path} returned ${response.status}`);
    const fileName = parseContentDispositionFileName(response.headers.get("content-disposition"));
    const expectedStem = getExpectedExportStem(scope);
    if (!fileName.startsWith(`${expectedStem}_`)) {
      fail(`${scope} export file name does not follow expected stem ${expectedStem}`);
    }
    if (!fileName.endsWith(".json")) {
      fail(`${scope} export file should use json extension`);
    }
    return body;
  }

  const manifest = await fetch(`${prefix}/assets/dictionary/manifest`).then((response) => response.json());
  if (manifest.manifest?.scope !== "dictionary") fail("manifest scope mismatch");
  if (manifest.manifest?.contract_version !== "v1.0") fail("manifest contract version mismatch");
  if (!Array.isArray(manifest.manifest?.supported_contract_versions) || !manifest.manifest.supported_contract_versions.includes("v1.0")) {
    fail("manifest supported contract versions mismatch");
  }
  if (manifest.request?.expected_file_format !== "txt") fail("manifest expected file format mismatch");
  if (!manifest.required_scopes?.importScopes?.includes("bot.configure")) fail("manifest import scope mismatch");

  const invalidScopeResponse = await fetch(`${prefix}/assets/not-a-scope/manifest`);
  const invalidScope = await invalidScopeResponse.json();
  if (invalidScopeResponse.status !== 404) fail("invalid asset scope should return 404");
  if (invalidScope.error_code !== "CGA_ASSET_SCOPE_NOT_FOUND") fail("invalid asset scope error code mismatch");
  if (invalidScope.message_key !== "errors.asset.scopeNotFound") fail("invalid asset scope message key mismatch");

  const exportedText = await fetchExportText("/assets/dictionary/export", "dictionary");
  if (!exportedText.includes("대표어")) fail("dictionary export did not return Aidot TXT");

  const imported = await fetchJson("/assets/dictionary/import", {
    method: "POST",
    headers: {
      "X-CGA-File-Name": "Dictionary_test.txt",
      "X-CGA-Target-Contract-Version": "v1.0"
    },
    body: loadTextFixture("aidot-dictionary-uploaded.txt")
  });
  if (imported.status !== "accepted") fail("dictionary import was not accepted");
  if (imported.request?.target_contract_version !== "v1.0") fail("dictionary import target contract version mismatch");
  if (imported.resolved_contract_version !== "v1.0") fail("dictionary import resolved contract version mismatch");
  if (imported.pruning_status !== "none") fail("dictionary import pruning status mismatch");
  if (!Array.isArray(imported.pruned_features) || imported.pruned_features.length !== 0) fail("dictionary import pruned features mismatch");
  if (imported.request?.upload_mode !== "merge") fail("dictionary import upload mode mismatch");

  const reExportedText = await fetchExportText("/assets/dictionary/export", "dictionary");
  if (!reExportedText.includes("password,login password")) fail("dictionary export did not return stored import body");

  const blocklistManifest = await fetchJson("/assets/blocklist/manifest");
  if (blocklistManifest.manifest?.scope !== "blocklist") fail("blocklist manifest scope mismatch");
  if (blocklistManifest.request?.expected_file_format !== "txt") fail("blocklist manifest expected file format mismatch");
  if (!blocklistManifest.required_scopes?.importScopes?.includes("bot.configure")) fail("blocklist manifest import scope mismatch");

  const blocklistExported = await fetchExportText("/assets/blocklist/export", "blocklist");
  if (!blocklistExported.includes("Blocklist 이름")) fail("blocklist export did not return Aidot TXT");

  const blocklistImported = await fetchJson("/assets/blocklist/import", {
    method: "POST",
    headers: {
      "X-CGA-File-Name": "Blocklist_test.txt",
      "X-CGA-Target-Contract-Version": "v1.0"
    },
    body: loadTextFixture("aidot-blocklist-uploaded.txt")
  });
  if (blocklistImported.status !== "accepted") fail("blocklist import was not accepted");
  if (blocklistImported.request?.upload_mode !== "merge") fail("blocklist import upload mode mismatch");

  const blocklistReExported = await fetchExportText("/assets/blocklist/export", "blocklist");
  if (!blocklistReExported.includes("ignore_hello,0,hello,Y")) fail("blocklist export did not return stored import body");

  const botManifest = await fetchJson("/assets/bot/manifest");
  if (botManifest.manifest?.scope !== "bot") fail("bot manifest scope mismatch");
  if (botManifest.request?.expected_file_format !== "json") fail("bot manifest expected file format mismatch");
  if (!botManifest.required_scopes?.importScopes?.includes("bot.create")) fail("bot manifest import scope mismatch");

  const botExported = await fetchExportJson("/assets/bot/export", "bot");
  if (!botExported.package?.botVo) fail("bot export did not return Aidot bot package");
  if (!botExported.package) fail("bot export did not return package payload");
  assertPackageTopLevel(botExported.package, AIDOT_BOT_JSON_TOP_LEVEL_KEYS, "bot");

  const botImported = await fetchJson("/assets/bot/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CGA-File-Name": "AIDOT_Bot_Uploaded.json",
      "X-CGA-Target-Contract-Version": "v1.0"
    },
    body: JSON.stringify(loadJsonFixture("aidot-bot-uploaded.json"))
  });
  if (botImported.status !== "accepted") fail("bot import was not accepted");
  if (botImported.request?.target_contract_version !== "v1.0") fail("bot import target contract version mismatch");
  if (botImported.resolved_contract_version !== "v1.0") fail("bot import resolved contract version mismatch");
  if (botImported.request?.upload_mode !== "replace") fail("bot import upload mode mismatch");
  const importedBotRecord = await fetchJson("");
  if (importedBotRecord.name !== "Uploaded Bot") fail("bot import did not update selected workspace bot metadata");
  if (importedBotRecord.version !== "v0.1") fail("bot import did not preserve imported bot version fallback");
  const importedStudioState = await fetchJson("/studio-state");
  if (importedStudioState.state?.bot?.name !== "Uploaded Bot") fail("bot import did not update studio-state bot metadata");

  const botReExported = await fetchExportJson("/assets/bot/export", "bot");
  if (botReExported.botVo?.name !== "Uploaded Bot") fail("bot export did not return stored import body");
  if (!Array.isArray(botReExported.dialogList) || !botReExported.dialogList.some((item) => item.dialogId === "uploaded_intent")) {
    fail("bot export did not preserve imported dialog list");
  }
  if (botReExported.dialogFlowGraphList?.[0]?.flowGraph?.[1]?.additionalInfo?.text !== "Uploaded bot answer") {
    fail("bot export did not preserve imported dialog flow graph");
  }
  if (!botReExported.entityTypeList?.some((item) => item.entityName === "uploaded_email")) {
    fail("bot export did not preserve imported entity assets");
  }
  if (!botReExported.ruleVoList?.some((item) => item.ruleName === "Uploaded Rule")) {
    fail("bot export did not preserve imported rule assets");
  }
  if (!botReExported.dictionaryVoList?.some((item) => item.word === "uploaded")) {
    fail("bot export did not preserve imported dictionary assets");
  }
  if (!botReExported.blacklistList?.some((item) => item.blacklistName === "uploaded_blocklist")) {
    fail("bot export did not preserve imported blocklist assets");
  }
  if (!botReExported.faqDialogList?.some((item) => item.dialogId === "faq_uploaded")) {
    fail("bot export did not preserve imported faq assets");
  }
  if (!botReExported.floatingButtonVoList?.some((item) => item.buttonId === "floating-uploaded")) {
    fail("bot export did not preserve imported floating button assets");
  }
  if (!botReExported.smallTalkVoList?.some((item) => item.trigger === "업로드 안녕")) {
    fail("bot export did not preserve imported smalltalk assets");
  }

  const apiManifest = await fetchJson("/assets/api/manifest");
  if (apiManifest.manifest?.scope !== "api") fail("api manifest scope mismatch");
  if (apiManifest.request?.expected_file_format !== "json") fail("api manifest expected file format mismatch");
  if (!apiManifest.required_scopes?.importScopes?.includes("apiAnswer.manage")) fail("api manifest import scope mismatch");

  const apiExported = await fetchExportJson("/assets/api/export", "api");
  const apiExportedPackage = getApiRoot(apiExported);
  if (!apiExportedPackage || typeof apiExportedPackage !== "object") fail("api export did not return object payload");
  assertPackageTopLevel(apiExportedPackage, AIDOT_API_JSON_TOP_LEVEL_KEYS, "api");
  const exportedApis = getApiList(apiExportedPackage);
  if (!Array.isArray(exportedApis)) fail("api export did not return API list");
  if (!exportedApis.length) fail("api export returned empty API list");
  if (!Array.isArray(apiExportedPackage.apis)) fail("api export did not include apis array");
  if (!apiExportedPackage.apis.length) fail("api export apis array is empty");

  const apiImported = await fetchJson("/assets/api/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CGA-File-Name": "API_Custom.json",
      "X-CGA-Target-Contract-Version": "v1.0"
    },
    body: JSON.stringify(loadJsonFixture("aidot-api-uploaded.json"))
  });
  if (apiImported.status !== "accepted") fail("api import was not accepted");
  if (apiImported.request?.target_contract_version !== "v1.0") fail("api import target contract version mismatch");
  if (apiImported.resolved_contract_version !== "v1.0") fail("api import resolved contract version mismatch");
  if (apiImported.request?.upload_mode !== "replace") fail("api import upload mode mismatch");

  const apiReExported = await fetchExportJson("/assets/api/export", "api");
  const apiReExportedPackage = getApiRoot(apiReExported);
  const reExportedApis = getApiList(apiReExportedPackage);
  if (!reExportedApis.some((item) => item.name === "uploaded_custom_api")) {
    fail("api export did not preserve imported api list");
  }
  if (!reExportedApis.some((item) => item.endpoint_url === "/api/v1/custom/{id}")) {
    fail("api export did not preserve imported api endpoint");
  }
  const reExportedCustomApi = (Array.isArray(apiReExportedPackage?.apis) ? apiReExportedPackage.apis : []).find((item) => item.name === "uploaded_custom_api");
  if (!reExportedCustomApi) fail("api export did not preserve uploaded api object");
  if (reExportedCustomApi.auth_type !== "bearer") fail("api export did not preserve auth_type");
  if (reExportedCustomApi.secret_ref !== "secret:group/g-support/uploaded") fail("api export did not preserve secret_ref");
  if (getApiMethodCount(reExportedCustomApi) < 2) fail("api export did not preserve imported API method count");
  const customMethodUrls = getApiMethodUrls(reExportedCustomApi);
  if (!customMethodUrls.some((item) => item.includes("/api/v1/custom/{id}"))) fail("api export did not preserve imported method URLs");

  const apiOnlyImported = await fetchJson("/assets/api/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CGA-File-Name": "API_OnlyCustom.json",
      "X-CGA-Target-Contract-Version": "v1.0"
    },
    body: JSON.stringify(loadJsonFixture("aidot-api-only-custom.json"))
  });
  if (apiOnlyImported.status !== "accepted") fail("api-only import was not accepted");
  if (apiOnlyImported.request?.upload_mode !== "replace") fail("api-only import upload mode mismatch");

  const apiOnlyReExported = await fetchExportJson("/assets/api/export", "api");
  const apiOnlyReExportedPackage = getApiRoot(apiOnlyReExported);
  const reExportedOnlyApis = getApiList(apiOnlyReExportedPackage);
  if (!reExportedOnlyApis.some((item) => item.name === "uploaded_only_custom_api")) {
    fail("api-only import did not preserve uploaded API name");
  }
  if (!reExportedOnlyApis.some((item) => item.endpoint_url === "/api/v2/custom/{id}")) {
    fail("api-only import did not preserve uploaded API endpoint");
  }
  const reExportedOnlyApi = (Array.isArray(apiOnlyReExportedPackage?.apis) ? apiOnlyReExportedPackage.apis : []).find((item) => item.name === "uploaded_only_custom_api");
  if (!reExportedOnlyApi) fail("api-only export did not preserve uploaded api object");
  if (reExportedOnlyApi.secret_ref !== "secret:group/g-support/only-uploaded") fail("api-only export did not preserve secret_ref");
  if (reExportedOnlyApi.auth_type !== "none") fail("api-only export did not preserve auth_type");

  const apiAliasImported = await fetchJson("/assets/api/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CGA-File-Name": "API_AliasCustom.json",
      "X-CGA-Target-Contract-Version": "v1.0"
    },
    body: JSON.stringify(loadJsonFixture("aidot-api-alias-custom.json"))
  });
  if (apiAliasImported.status !== "accepted") fail("api-alias import was not accepted");
  if (apiAliasImported.request?.upload_mode !== "replace") fail("api-alias import upload mode mismatch");

  const apiAliasReExported = await fetchExportJson("/assets/api/export", "api");
  const apiAliasReExportedPackage = getApiRoot(apiAliasReExported);
  const reExportedAliasApi = findApiByName(apiAliasReExportedPackage?.apis, "uploaded_alias_api");
  if (!reExportedAliasApi) fail("api-alias export did not preserve uploaded api object");
  if (reExportedAliasApi.id !== "uploaded_alias_api_id") fail("api-alias export did not preserve id");
  if ((reExportedAliasApi.apiKey || reExportedAliasApi.key) !== "uploaded_alias_api_key") fail("api-alias export did not preserve apiKey");
  if ((reExportedAliasApi.baseUrl || reExportedAliasApi.destinationBaseUrl || reExportedAliasApi.destinationUrl) !== "https://alias.example.com") fail("api-alias export did not preserve baseUrl alias");
  if (reExportedAliasApi.category !== "Alias API") fail("api-alias export did not preserve category");
  if (reExportedAliasApi.description !== "alias import payload") fail("api-alias export did not preserve description");
  if ((reExportedAliasApi.auth_type || reExportedAliasApi.authType) !== "basic") fail("api-alias export did not preserve authType alias");
  if ((reExportedAliasApi.secret_ref || reExportedAliasApi.secretRef) !== "secret:group/g-support/alias-uploaded") fail("api-alias export did not preserve secretRef alias");
  if ((reExportedAliasApi.response_path || reExportedAliasApi.responsePath) !== "payload.alias") fail("api-alias export did not preserve responsePath alias");
  if ((reExportedAliasApi.usageCount ?? reExportedAliasApi.usage_count) !== 9) fail("api-alias export did not preserve usage_count");
  if ((reExportedAliasApi.updatedAt || reExportedAliasApi.updated_at) !== "2026-06-19T01:23:45Z") fail("api-alias export did not preserve updated_at");
  if ((reExportedAliasApi.updatedBy || reExportedAliasApi.updated_by) !== "aidot-alias") fail("api-alias export did not preserve updated_by");
  const aliasMethod = getApiMethodByName(reExportedAliasApi, "aliasGet");
  if (!aliasMethod) fail("api-alias export did not preserve methodName alias");
  if ((aliasMethod.httpMethod || aliasMethod.method) !== "POST") fail("api-alias export did not preserve aliased http method");
  if ((aliasMethod.methodUrl || aliasMethod.path || aliasMethod.url) !== "/alias/{customer_id}") fail("api-alias export did not preserve aliased path");
  if ((aliasMethod.loggingEnabled ?? aliasMethod.logging) !== true) fail("api-alias export did not preserve logging alias");
  if ((aliasMethod.proxyEnabled ?? aliasMethod.proxy) !== false) fail("api-alias export did not preserve proxy alias");
  if ((aliasMethod.outputSample || aliasMethod.output_sample) !== "{\"ok\":true}") fail("api-alias export did not preserve output_sample alias");
  if (!Array.isArray(aliasMethod.parameters) || (aliasMethod.parameters[0]?.location || aliasMethod.parameters[0]?.parameterType) !== "path") fail("api-alias export did not normalize parameterType");
  if ((aliasMethod.parameters[0]?.defaultValue ?? aliasMethod.parameters[0]?.default) !== "") fail("api-alias export did not preserve parameter default alias");
  if ((aliasMethod.parameters[0]?.required ?? aliasMethod.parameters[0]?.requiredYn) !== true) fail("api-alias export did not preserve requiredYn alias");
  if ((aliasMethod.parameters[0]?.visible ?? aliasMethod.parameters[0]?.visibleYn) !== true) fail("api-alias export did not preserve visibleYn alias");
  if (!Array.isArray(aliasMethod.outputParameters) || (aliasMethod.outputParameters[0]?.path || aliasMethod.outputParameters[0]?.jsonPath) !== "payload.alias_result") fail("api-alias export did not preserve jsonPath alias");

  const versionManifest = await fetchJson("/assets/version/manifest");
  if (versionManifest.manifest?.scope !== "version") fail("version manifest scope mismatch");
  if (versionManifest.request?.expected_file_format !== "json") fail("version manifest expected file format mismatch");
  if (!versionManifest.required_scopes?.importScopes?.includes("bot.configure")) fail("version manifest import scope mismatch");

  const versionExported = await fetchExportJson("/assets/version/export", "version");
  const versionExportedPackage = versionExported.package || versionExported;
  assertPackageTopLevel(versionExportedPackage, AIDOT_VERSION_JSON_TOP_LEVEL_KEYS, "version");
  if (versionExportedPackage.contract_version !== "v1.0") fail("version export contract version mismatch");
  if (!Array.isArray(versionExportedPackage.supported_contract_versions) || !versionExportedPackage.supported_contract_versions.includes("v1.0")) {
    fail("version export supported contract versions mismatch");
  }
  if (!versionExportedPackage.system_config?.bot) fail("version export did not return Aidot version document bot config");
  if (!versionExportedPackage.version?.bot) fail("version export did not include legacy CGA version payload");

  const versionImported = await fetchJson("/assets/version/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CGA-File-Name": "CGA_Version_Uploaded.json",
      "X-CGA-Target-Contract-Version": "v1.0"
    },
    body: JSON.stringify(loadJsonFixture("aidot-version-uploaded.json"))
  });
  if (versionImported.status !== "accepted") fail("version import was not accepted");
  if (versionImported.request?.target_contract_version !== "v1.0") fail("version import target contract version mismatch");
  if (versionImported.resolved_contract_version !== "v1.0") fail("version import resolved contract version mismatch");
  if (versionImported.request?.upload_mode !== "replace") fail("version import upload mode mismatch");

  const versionReExported = await fetchExportJson("/assets/version/export", "version");
  const versionReExportedPackage = versionReExported.package || versionReExported;
  if (versionReExportedPackage.system_config?.bot?.version !== "v-uploaded") fail("version export did not preserve uploaded version");
  if (versionReExportedPackage.system_config?.bot?.botName !== "Uploaded Version Bot") fail("version export did not preserve uploaded bot name");
  if (!Array.isArray(versionReExportedPackage.dialogs) || !versionReExportedPackage.dialogs.some((item) => item.dialogId === "version_uploaded_intent")) {
    fail("version export did not preserve uploaded dialogs");
  }
  if (versionReExportedPackage.dialog_flow_graphs?.[0]?.flowGraph?.[1]?.additionalInfo?.text !== "Version uploaded answer") {
    fail("version export did not preserve uploaded dialog flow graphs");
  }
  if (!versionReExportedPackage.entities?.some((item) => item.entityName === "version_email")) fail("version export did not preserve uploaded entities");
  if (!versionReExportedPackage.dictionary?.some((item) => item.word === "version")) fail("version export did not preserve uploaded dictionary");
  if (!versionReExportedPackage.faq_dialogs?.some((item) => item.dialogId === "faq_version")) fail("version export did not preserve uploaded faq dialogs");
  if (!versionReExportedPackage.apis?.some((item) => (item.name || item.apiName) === "version_api")) fail("version export did not preserve uploaded apis");
  if (!versionReExportedPackage.floating_buttons?.some((item) => item.buttonId === "version-help")) fail("version export did not preserve uploaded floating buttons");
  if (!versionReExportedPackage.rules?.some((item) => item.ruleName === "Version Rule")) fail("version export did not preserve uploaded rules");
  if (!versionReExportedPackage.small_talk?.some((item) => item.trigger === "버전 안녕")) fail("version export did not preserve uploaded small talk");
  if (!versionReExportedPackage.blacklists?.some((item) => item.blacklistName === "version_blocklist")) fail("version export did not preserve uploaded blacklists");

  const higherVersionImported = await fetchJson("/assets/version/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CGA-File-Name": "CGA_Version_Higher.json",
      "X-CGA-Target-Contract-Version": "v1.0"
    },
    body: JSON.stringify(loadJsonFixture("aidot-version-higher-v1_1.json"))
  });
  if (higherVersionImported.status !== "accepted") fail("higher version import was not accepted");
  if (higherVersionImported.resolved_contract_version !== "v1.0") fail("higher version import resolved contract version mismatch");
  if (higherVersionImported.pruning_status !== "pruned") fail("higher version import pruning status mismatch");
  if (!Array.isArray(higherVersionImported.pruned_features) || !higherVersionImported.pruned_features.includes("advanced_analytics")) {
    fail("higher version import did not report advanced_analytics pruning");
  }
  if (!higherVersionImported.pruned_features.includes("system_config.channels.kakaoKr")) {
    fail("higher version import did not report kakaoKr pruning");
  }
  if (!higherVersionImported.pruned_features.includes("system_config.channels.teams")) {
    fail("higher version import did not report teams pruning");
  }
  if (!Array.isArray(higherVersionImported.warnings) || !higherVersionImported.warnings.length) {
    fail("higher version import did not return warnings");
  }

  const higherVersionReExported = await fetchExportJson("/assets/version/export", "version");
  const higherVersionReExportedPackage = higherVersionReExported.package || higherVersionReExported;
  if ("advanced_analytics" in higherVersionReExportedPackage) fail("higher version export should not include advanced_analytics");
  if (higherVersionReExportedPackage.custom_runtime_policy?.name !== "retain-me") {
    fail("higher version export should preserve unknown top-level fields");
  }
  if (higherVersionReExportedPackage.system_config?.custom_runtime_adapter?.mode !== "shadow") {
    fail("higher version export should preserve unknown system_config fields");
  }
  if (higherVersionReExportedPackage.version?.customVersionMarker?.enabled !== true) {
    fail("higher version export should preserve unknown legacy version fields");
  }
  if (higherVersionReExportedPackage.system_config?.channels?.kakaoKr !== "disabled") {
    fail("higher version export should force kakaoKr to disabled");
  }
  if ("teams" in (higherVersionReExportedPackage.system_config?.channels || {})) {
    fail("higher version export should remove unsupported teams channel");
  }

  const blockedHigherVersionImported = await fetchJson("/assets/version/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CGA-File-Name": "CGA_Version_Higher_Blocked.json",
      "X-CGA-Target-Contract-Version": "v1.0"
    },
    body: JSON.stringify({
      asset_format_version: 1,
      contract_version: "v1.1",
      advanced_analytics: {
        enabled: true
      },
      external_channels: {
        teams: {
          enabled: true
        }
      },
      system_config: {
        channels: {
          kakaoKr: "connected",
          teams: "connected"
        }
      }
    })
  });
  if (blockedHigherVersionImported.status !== "blocked") fail("higher version import without v1.0 core should be blocked");
  if (blockedHigherVersionImported.resolved_contract_version !== "v1.0") fail("blocked higher version import resolved contract version mismatch");
  if (blockedHigherVersionImported.pruning_status !== "blocked") fail("blocked higher version import pruning status mismatch");
  if (!Array.isArray(blockedHigherVersionImported.errors) || !blockedHigherVersionImported.errors.length) {
    fail("blocked higher version import did not return blocking reason");
  }
  if (!Array.isArray(blockedHigherVersionImported.pruned_features) || !blockedHigherVersionImported.pruned_features.includes("advanced_analytics")) {
    fail("blocked higher version import did not report advanced_analytics pruning");
  }

  const dialogManifest = await fetchJson("/assets/dialog/manifest");
  if (dialogManifest.manifest?.scope !== "dialog") fail("dialog manifest scope mismatch");
  if (dialogManifest.request?.expected_file_format !== "json") fail("dialog manifest expected file format mismatch");
  if (!dialogManifest.required_scopes?.importScopes?.includes("bot.configure")) fail("dialog manifest import scope mismatch");

  const dialogExported = await fetchExportJson("/assets/dialog/export", "dialog");
  if (!dialogExported.package?.flowGraph) fail("dialog export did not return Aidot dialog package");
  if (!dialogExported.package) fail("dialog export did not return package payload");
  assertPackageTopLevel(dialogExported.package, AIDOT_DIALOG_JSON_TOP_LEVEL_KEYS, "dialog");

  const dialogImported = await fetchJson("/assets/dialog/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CGA-File-Name": "Dialog_password_reset.json",
      "X-CGA-Target-Contract-Version": "v1.0"
    },
    body: JSON.stringify(loadJsonFixture("aidot-dialog-password-reset.json"))
  });
  if (dialogImported.status !== "accepted") fail("dialog import was not accepted");
  if (dialogImported.request?.target_contract_version !== "v1.0") fail("dialog import target contract version mismatch");
  if (dialogImported.resolved_contract_version !== "v1.0") fail("dialog import resolved contract version mismatch");
  if (dialogImported.request?.upload_mode !== "replace") fail("dialog import upload mode mismatch");

  const dialogReExported = await fetchExportJson("/assets/dialog/export", "dialog");
  if (dialogReExported.displayName !== "Password Reset") fail("dialog export did not preserve dialog displayName");
  if (dialogReExported.flowGraph?.[1]?.additionalInfo?.text !== "Reset your password from Profile Settings.") {
    fail("dialog export did not preserve imported message text");
  }

  const history = await fetchJson("/asset-transfers");
  if (!Array.isArray(history.items) || history.items.length < 15) fail("asset transfer history did not record all export/import/re-export checks");
  if (!history.items.some((item) => item.direction === "import" && item.asset_path?.includes("dictionary.txt"))) fail("asset transfer history did not record stored asset path");
  if (!history.items.some((item) => item.scope === "blocklist" && item.direction === "import" && item.asset_path?.includes("blocklist.txt"))) fail("asset transfer history did not record blocklist stored asset path");
  if (!history.items.some((item) => item.scope === "bot" && item.direction === "import" && item.asset_path?.includes("bot.json"))) fail("asset transfer history did not record bot stored asset path");
  if (!history.items.some((item) => item.scope === "api" && item.direction === "import" && item.asset_path?.includes("api.json"))) fail("asset transfer history did not record api stored asset path");
  if (!history.items.some((item) => item.scope === "version" && item.direction === "import" && item.asset_path?.includes("version.json"))) fail("asset transfer history did not record version stored asset path");
  if (!history.items.some((item) => item.scope === "version" && item.direction === "import" && item.status === "blocked" && !item.asset_path)) {
    fail("asset transfer history did not record blocked version import");
  }
  if (!history.items.some((item) => item.scope === "dialog" && item.direction === "import" && item.asset_path?.includes("dialog.json"))) fail("asset transfer history did not record dialog stored asset path");
  const historyFile = join(dataDir, "asset-transfer-history.json");
  if (!existsSync(historyFile)) fail("asset transfer history file was not created");
  const storedHistory = JSON.parse(readFileSync(historyFile, "utf8"));
  if (!Array.isArray(storedHistory) || storedHistory.length < 15) fail("asset transfer history file did not persist all transfer checks");
  console.log("OK asset transfer API endpoints passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "asset transfer API check failed"))
  .finally(() => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });
