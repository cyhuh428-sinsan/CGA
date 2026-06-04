import { workflowSteps, errorSamples } from "./data/workflow.js";
import { getVisibleLayout } from "./data/layout.js";
import { sampleStudioState } from "./data/sample-state.js";
import { deriveReadiness, canGeneratePdfQa, canUseKakaoChannel, TRAINING_LOCKED_CREATE_FIELDS, RUNTIME_ADJUSTABLE_FIELDS } from "/packages/public-core/src/studio-state.js";
import { createDefaultModuleRegistry, DEFAULT_COMMERCIAL_FEATURE_CHECKS, getFeatureAvailability } from "/packages/public-core/src/module-registry.js";
import { createSampleCollaborationState, summarizeCollaboration } from "/packages/public-core/src/collaboration-state.js";
import {
  approveAdminPermissionRequest,
  approveGroupJoinRequest,
  applySignup,
  createManagedGroup,
  createSampleAccessState,
  loginAsUser,
  requestGroupJoin,
  summarizeAccess,
  summarizeAccessOperations,
  summarizeAccessPolicy,
  summarizeAdminRequests,
  summarizeAuthWorkflow,
  summarizeGroupBotAccess,
  summarizeGroupUsers,
  summarizeJoinRequests
} from "/packages/public-core/src/access-state.js";

const currentStudioState = structuredClone(sampleStudioState);
const currentCollaborationState = createSampleCollaborationState();
let currentAccessState = createSampleAccessState();
let currentApiRegistry = [
  {
    group_id: "g-support",
    bot_id: "supportbot-draft",
    name: "order_status_lookup",
    endpoint_url: "https://api.example.com/orders/{order_id}",
    response_path: "data.answer"
  }
];



function getByPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setByPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key) => {
    current[key] = current[key] || {};
    return current[key];
  }, object);
  target[last] = value;
}

function coerceFieldValue(field, value) {
  if (field === "structuralChoices.useLlm") return value === "true";
  return value;
}

function syncCreateControlsFromState() {
  document.querySelectorAll("[data-structural-field]").forEach((control) => {
    const field = control.dataset.structuralField;
    const value = getByPath(currentStudioState, field);
    if (typeof value === "boolean") control.value = String(value);
    else if (value != null) control.value = value;
  });
}

function applyStructuralSideEffects(field) {
  const choices = currentStudioState.structuralChoices;
  choices.allowPdf = choices.compositionInput === "pdf" || choices.compositionInput === "both";
  currentStudioState.counts.documents = choices.allowPdf ? 1 : 0;
  currentStudioState.llm.status = choices.useLlm ? "connected" : "not_connected";
  currentStudioState.channels.kakaoKr = currentStudioState.bot.defaultLocale === "ko" ? "not_configured" : "disabled";
}

function renderCreateSummary() {
  const container = document.querySelector("[data-create-summary]");
  if (!container) return;
  const choices = currentStudioState.structuralChoices;
  container.innerHTML = `
    <p><b data-i18n="summary.language">Language</b><span>${currentStudioState.bot.defaultLocale}</span></p>
    <p><b data-i18n="summary.input">Input</b><span>${choices.compositionInput}</span></p>
    <p><b data-i18n="summary.llm">LLM</b><span class="${choices.useLlm ? "" : "warn"}">${choices.useLlm ? "Used for composition" : "Not used"}</span></p>
    <p><b data-i18n="summary.pdfQa">PDF Q&A</b><span class="${choices.allowPdf ? "" : "warn"}">${choices.allowPdf ? "Allowed" : "Disabled"}</span></p>
    <p><b data-i18n="summary.orchestrator">Orchestrator</b><span>${choices.orchestratorMode}</span></p>
    <p><b data-i18n="summary.botServer">Bot Server</b><span>${choices.botServerLocation}</span></p>
  `;
}

function renderAllStatePanels() {
  renderCreateSummary();
  bindCreateControls();
  renderCreateSummary();
  renderStateSummary();
  renderReadinessIssues();
  document.dispatchEvent(new CustomEvent("cga:content-rendered"));
}

function bindCreateControls() {
  syncCreateControlsFromState();
  document.querySelectorAll("[data-structural-field]").forEach((control) => {
    control.addEventListener("input", () => {
      const field = control.dataset.structuralField;
      setByPath(currentStudioState, field, coerceFieldValue(field, control.value));
      applyStructuralSideEffects(field);
      renderAllStatePanels();
    });
    control.addEventListener("change", () => {
      const field = control.dataset.structuralField;
      setByPath(currentStudioState, field, coerceFieldValue(field, control.value));
      applyStructuralSideEffects(field);
      renderAllStatePanels();
    });
  });
}

function applyScreenLayout() {
  const workspace = document.querySelector(".workspace");
  if (!workspace) return;
  const sectionsById = new Map(
    Array.from(workspace.querySelectorAll("[data-screen-id]")).map((section) => [section.dataset.screenId, section])
  );
  getVisibleLayout().forEach((item) => {
    const section = sectionsById.get(item.id);
    if (!section) return;
    section.dataset.layoutGroup = item.group;
    section.dataset.layoutMode = item.mode;
    section.hidden = false;
    workspace.appendChild(section);
  });
  sectionsById.forEach((section, id) => {
    if (!getVisibleLayout().some((item) => item.id === id)) {
      section.hidden = true;
    }
  });
}

function htmlList(items) {
  return items.map((item) => `<li>${item}</li>`).join("");
}




function labelFieldPath(fieldPath) {
  const labels = {
    "structuralChoices.useLlm": "LLM usage for bot composition",
    "structuralChoices.compositionInput": "Composition input type",
    "structuralChoices.allowPdf": "PDF Q&A allowance",
    "structuralChoices.botServerLocation": "Bot Server location",
    "structuralChoices.orchestratorMode": "Orchestrator mode",
    "bot.defaultLocale": "Default language",
    "bot.selectedChannels": "Base channels",
    "llm.provider": "LLM provider",
    "llm.model": "LLM model",
    "llm.baseUrl": "LLM base URL",
    "prompt.template": "Prompt template details",
    "runtime.costLimit": "Cost limit",
    "runtime.timeout": "Runtime timeout"
  };
  return labels[fieldPath] || fieldPath;
}

function renderLockPolicy() {
  const locked = document.querySelector("[data-locked-fields]");
  const runtime = document.querySelector("[data-runtime-fields]");
  if (locked) {
    locked.innerHTML = TRAINING_LOCKED_CREATE_FIELDS.map((field) => `
      <div class="policy-row locked"><strong>${labelFieldPath(field)}</strong><span>${field}</span></div>
    `).join("");
  }
  if (runtime) {
    runtime.innerHTML = RUNTIME_ADJUSTABLE_FIELDS.map((field) => `
      <div class="policy-row runtime"><strong>${labelFieldPath(field)}</strong><span>${field}</span></div>
    `).join("");
  }
}

function renderCommercialAvailability() {
  const container = document.querySelector("[data-commercial-availability]");
  if (!container) return;
  const registry = createDefaultModuleRegistry();
  container.innerHTML = DEFAULT_COMMERCIAL_FEATURE_CHECKS.map((featureId) => {
    const availability = getFeatureAvailability(registry, featureId);
    return `
      <div class="feature-row ${availability.available ? "available" : "missing"}">
        <strong>${featureId}</strong>
        <span>${availability.available ? "Available" : "Commercial Module Required"}</span>
      </div>
    `;
  }).join("");
}

function renderCollaborationSummary() {
  const container = document.querySelector("[data-collab-summary]");
  if (!container) return;
  const summary = summarizeCollaboration(currentCollaborationState);
  container.innerHTML = `
    <div class="state-metric ok"><strong data-i18n="collab.mode">Default mode</strong><span>${summary.mode}</span></div>
    <div class="state-metric ok"><strong data-i18n="collab.targetDays">Build target</strong><span>${summary.targetDays} days</span></div>
    <div class="state-metric"><strong data-i18n="collab.totalWork">Work items</strong><span>${summary.total}</span></div>
    <div class="state-metric"><strong data-i18n="collab.reviewQueue">Review queue</strong><span>${summary.review}</span></div>
    <div class="state-metric ${summary.blocked ? "blocked" : "ok"}"><strong data-i18n="collab.blockedItems">Blocked items</strong><span>${summary.blocked}</span></div>
    <div class="state-metric ok"><strong data-i18n="collab.teamReady">Team-ready</strong><span>${summary.collaborationAvailable ? "Available" : "Disabled"}</span></div>
  `;
}

function renderAccessPanels() {
  const accessOperations = document.querySelector("[data-access-operations]");
  const loginUser = document.querySelector("[data-login-user]");
  const currentSession = document.querySelector("[data-current-session]");
  const joinGroup = document.querySelector("[data-join-group]");
  const joinRole = document.querySelector("[data-join-role]");
  const adminQueue = document.querySelector("[data-admin-action-queue]");
  const authFlow = document.querySelector("[data-auth-flow]");
  const groupUsers = document.querySelector("[data-group-users]");
  const joinRequests = document.querySelector("[data-join-requests]");
  const adminRequests = document.querySelector("[data-admin-requests]");
  const groupAccess = document.querySelector("[data-group-access]");
  const screenAccess = document.querySelector("[data-screen-access]");
  const authPolicy = document.querySelector("[data-auth-policy]");
  const adminPolicy = document.querySelector("[data-admin-policy]");
  if (!accessOperations || !loginUser || !currentSession || !joinGroup || !joinRole || !adminQueue || !authFlow || !groupUsers || !joinRequests || !adminRequests || !groupAccess || !screenAccess || !authPolicy || !adminPolicy) return;
  const current = summarizeAccess(currentAccessState);
  const operations = summarizeAccessOperations(currentAccessState);
  const policy = summarizeAccessPolicy(currentAccessState);
  loginUser.innerHTML = currentAccessState.users
    .filter((user) => user.status === "active")
    .map((user) => `<option value="${user.id}" ${user.id === currentAccessState.currentUserId ? "selected" : ""}>${user.name} · ${user.id} · ${user.locale}</option>`)
    .join("");
  currentSession.innerHTML = `
    <strong>${current.user?.name || "User"}</strong>
    <span>${current.user?.id || ""} · ${current.user?.locale || "en"} · ${current.memberships.map((item) => `${item.group_id}/${item.role}`).join(", ")}</span>
  `;
  joinGroup.innerHTML = currentAccessState.groups
    .filter((group) => group.status === "active")
    .map((group) => `<option value="${group.id}">${group.name}</option>`)
    .join("");
  joinRole.innerHTML = ["viewer", "builder", "reviewer", "operator", "group_admin"]
    .map((role) => `<option value="${role}">${role}</option>`)
    .join("");
  adminQueue.innerHTML = [
    ...summarizeJoinRequests(currentAccessState).filter((request) => request.status === "pending").map((request) => `
      <div>
        <strong>${request.user?.name || request.user_id} -> ${request.group?.name || request.group_id}</strong>
        <span>${request.requested_role} · group join</span>
        <button type="button" data-approve-join="${request.id}">Approve</button>
      </div>
    `),
    ...summarizeAdminRequests(currentAccessState).filter((request) => request.status === "pending").map((request) => `
      <div>
        <strong>${request.user?.name || request.user_id} -> ${request.group?.name || request.group_id}</strong>
        <span>${request.requested_role} · admin permission</span>
        <button type="button" data-approve-admin="${request.id}">Approve</button>
      </div>
    `)
  ].join("") || `<div><strong>No pending approval</strong><span>Queue is empty</span></div>`;
  accessOperations.innerHTML = `
    <div><strong data-i18n="access.activeUsers">Active users</strong><span>${operations.activeUsers}</span></div>
    <div><strong data-i18n="access.activeGroups">Active groups</strong><span>${operations.activeGroups}</span></div>
    <div><strong data-i18n="access.activeMemberships">Active memberships</strong><span>${operations.activeMemberships}</span></div>
    <div><strong data-i18n="access.waitingApprovals">Waiting approvals</strong><span>${operations.pendingJoinRequests + operations.pendingAdminRequests}</span></div>
    <div><strong data-i18n="access.protectedAdmin">Protected admin</strong><span>${operations.protectedAdmin ? "Yes" : "No"}</span></div>
    <div><strong data-i18n="access.userLanguages">User languages</strong><span>${operations.multilingualUsers}</span></div>
  `;
  authFlow.innerHTML = summarizeAuthWorkflow(currentAccessState).map((step, index) => `
    <div>
      <strong>${String(index + 1).padStart(2, "0")} · ${step.label}</strong>
      <span>${step.detail}</span>
    </div>
  `).join("");
  groupUsers.innerHTML = summarizeGroupUsers(currentAccessState).map((entry) => `
    <div>
      <strong>${entry.group.name}</strong>
      <span>${entry.users.map(({ user, membership }) => `${user?.name || membership.user_id} / ${membership.role} / ${user?.locale || "en"}`).join(", ") || "No active user"}</span>
    </div>
  `).join("");
  joinRequests.innerHTML = summarizeJoinRequests(currentAccessState).map((request) => `
    <div>
      <strong>${request.user?.name || request.user_id} -> ${request.group?.name || request.group_id}</strong>
      <span>${request.requested_role} · ${request.status}</span>
    </div>
  `).join("");
  adminRequests.innerHTML = summarizeAdminRequests(currentAccessState).map((request) => `
    <div>
      <strong>${request.user?.name || request.user_id} -> ${request.group?.name || request.group_id}</strong>
      <span>${request.requested_role} · ${request.status} · reviewer: admin</span>
    </div>
  `).join("");
  groupAccess.innerHTML = summarizeGroupBotAccess(currentAccessState).map((access) => `
    <div><strong>${access.group?.name || "Group"}</strong><span>${access.botId}</span></div>
    <div>${access.scopes.join(", ")}</div>
  `).join("");
  screenAccess.innerHTML = `
    <div class="current-user"><strong>${current.user?.name || "User"}</strong><span>${current.memberships.map((item) => item.group_id + " / " + item.role).join(", ")}</span></div>
    ${current.screens.map((screen) => `
      <div class="${screen.allowed ? "allowed" : "denied"}">
        <strong>${screen.screenId}</strong>
        <span>${screen.allowed ? "Allowed" : "Blocked"} · ${screen.scope}</span>
      </div>
    `).join("")}
  `;
  authPolicy.innerHTML = `
    <p><strong data-i18n="access.signupGroup">Signup creates own group</strong><span>${policy.signupCreatesOwnGroup ? "Enabled" : "Disabled"}</span></p>
    <p><strong data-i18n="access.userLocale">User language setting</strong><span>${current.user?.locale || "en"}</span></p>
    <p><strong data-i18n="access.errorLocale">Error message language</strong><span>${policy.errorLocaleSource}</span></p>
    <p><strong data-i18n="access.pendingJoin">Pending group join requests</strong><span>${policy.pendingJoinRequests}</span></p>
    <p><strong data-i18n="access.pendingAdmin">Pending admin requests</strong><span>${policy.pendingAdminRequests}</span></p>
    <p><strong data-i18n="access.emptyGroups">Empty groups auto-delete</strong><span>${policy.emptyGroupAutoDelete ? "Enabled" : "Disabled"}</span></p>
    <p><strong data-i18n="access.emptyGroupIds">Groups without users</strong><span>${policy.groupsWithoutUsers.join(", ") || "None"}</span></p>
  `;
  adminPolicy.innerHTML = `
    <p><strong data-i18n="access.systemAdmin">Base system admin</strong><span>${policy.systemAdmin?.id || "admin"}</span></p>
    <p><strong data-i18n="access.adminDeletable">Admin deletable</strong><span>${policy.systemAdmin?.deletable ? "Yes" : "No"}</span></p>
    <p><strong data-i18n="access.groupCreateAdmin">Group creation approval</strong><span>${policy.groupCreationRequiresSystemAdmin ? "System admin required" : "Open"}</span></p>
    <p><strong data-i18n="access.groupsWithoutAdmin">Groups without group admin</strong><span>${policy.groupsWithoutAdmin.join(", ") || "None"}</span></p>
  `;
  bindAdminActionButtons();
}

function renderApiRegistry() {
  const apiGroup = document.querySelector("[data-api-group]");
  const apiRegistry = document.querySelector("[data-api-registry]");
  if (!apiGroup || !apiRegistry) return;
  apiGroup.innerHTML = currentAccessState.groups
    .filter((group) => group.status === "active")
    .map((group) => `<option value="${group.id}">${group.name}</option>`)
    .join("");
  apiRegistry.innerHTML = currentApiRegistry.map((api) => `
    <div>
      <strong>${api.name}</strong>
      <span>${api.group_id} · ${api.endpoint_url} · ${api.response_path}</span>
    </div>
  `).join("") || `<div><strong>No API answer</strong><span>Register a group API answer first.</span></div>`;
}

function rerenderAdminAndAccess() {
  renderAccessPanels();
  renderApiRegistry();
  document.dispatchEvent(new CustomEvent("cga:content-rendered"));
}

function bindAdminActionButtons() {
  document.querySelectorAll("[data-approve-join]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      currentAccessState = approveGroupJoinRequest(currentAccessState, { requestId: button.dataset.approveJoin, reviewerId: "admin" });
      rerenderAdminAndAccess();
    });
  });
  document.querySelectorAll("[data-approve-admin]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      currentAccessState = approveAdminPermissionRequest(currentAccessState, { requestId: button.dataset.approveAdmin, reviewerId: "admin" });
      rerenderAdminAndAccess();
    });
  });
}

function bindAdminWorkbench() {
  const loginSubmit = document.querySelector("[data-login-submit]");
  const signupSubmit = document.querySelector("[data-signup-submit]");
  const groupCreate = document.querySelector("[data-group-create]");
  const joinSubmit = document.querySelector("[data-join-submit]");
  const apiAdd = document.querySelector("[data-api-add]");
  if (loginSubmit && loginSubmit.dataset.bound !== "true") {
    loginSubmit.dataset.bound = "true";
    loginSubmit.addEventListener("click", () => {
      currentAccessState = loginAsUser(currentAccessState, { userId: document.querySelector("[data-login-user]")?.value });
      rerenderAdminAndAccess();
    });
  }
  if (signupSubmit && signupSubmit.dataset.bound !== "true") {
    signupSubmit.dataset.bound = "true";
    signupSubmit.addEventListener("click", () => {
      const id = document.querySelector("[data-signup-id]")?.value?.trim();
      const name = document.querySelector("[data-signup-name]")?.value?.trim();
      if (!id || !name) return;
      currentAccessState = applySignup(currentAccessState, {
        userId: id,
        name,
        locale: document.querySelector("[data-signup-locale]")?.value || "en",
        groupName: document.querySelector("[data-signup-group]")?.value?.trim() || `${name} Group`
      });
      rerenderAdminAndAccess();
    });
  }
  if (groupCreate && groupCreate.dataset.bound !== "true") {
    groupCreate.dataset.bound = "true";
    groupCreate.addEventListener("click", () => {
      const id = document.querySelector("[data-group-id]")?.value?.trim();
      const name = document.querySelector("[data-group-name]")?.value?.trim();
      if (!id || !name) return;
      currentAccessState = createManagedGroup(currentAccessState, { id, name });
      rerenderAdminAndAccess();
    });
  }
  if (joinSubmit && joinSubmit.dataset.bound !== "true") {
    joinSubmit.dataset.bound = "true";
    joinSubmit.addEventListener("click", () => {
      currentAccessState = requestGroupJoin(currentAccessState, {
        id: `jr-${Date.now()}`,
        userId: currentAccessState.currentUserId,
        groupId: document.querySelector("[data-join-group]")?.value,
        requestedRole: document.querySelector("[data-join-role]")?.value || "viewer"
      });
      rerenderAdminAndAccess();
    });
  }
  if (apiAdd && apiAdd.dataset.bound !== "true") {
    apiAdd.dataset.bound = "true";
    apiAdd.addEventListener("click", () => {
      const name = document.querySelector("[data-api-name]")?.value?.trim();
      const endpoint = document.querySelector("[data-api-endpoint]")?.value?.trim();
      if (!name || !endpoint) return;
      currentApiRegistry = [
        ...currentApiRegistry,
        {
          group_id: document.querySelector("[data-api-group]")?.value || "g-support",
          bot_id: currentAccessState.botId,
          name,
          endpoint_url: endpoint,
          response_path: document.querySelector("[data-api-response-path]")?.value?.trim() || "data.answer"
        }
      ];
      rerenderAdminAndAccess();
    });
  }
}

function renderStateSummary() {
  const container = document.querySelector("[data-state-summary]");
  if (!container) return;
  const readiness = deriveReadiness(currentStudioState)
  const pdfStatus = canGeneratePdfQa(currentStudioState) ? "Available" : "Blocked: LLM required";
  const kakaoStatus = canUseKakaoChannel(currentStudioState) ? "Available for Korean locale" : "Disabled outside Korean locale";
  container.innerHTML = `
    <div class="state-metric"><strong>Bot</strong><span>${currentStudioState.bot.name || "Not named"}</span></div>
    <div class="state-metric"><strong>Locale</strong><span>${currentStudioState.bot.defaultLocale}</span></div>
    <div class="state-metric"><strong>Intents</strong><span>${currentStudioState.counts.intents}</span></div>
    <div class="state-metric"><strong>Documents</strong><span>${currentStudioState.counts.documents}</span></div>
    <div class="state-metric ${readiness.ready ? "ok" : "blocked"}"><strong>Readiness</strong><span>${readiness.ready ? "Ready" : "Blocked"}</span></div>
    <div class="state-metric blocked"><strong>PDF Q&A</strong><span>${pdfStatus}</span></div>
    <div class="state-metric"><strong>Kakao KR</strong><span>${kakaoStatus}</span></div>
  `;
}

function renderReadinessIssues() {
  const container = document.querySelector("[data-readiness-issues]");
  if (!container) return;
  const readiness = deriveReadiness(currentStudioState)
  if (readiness.ready) {
    container.innerHTML = `<p class="issue-ok">No blocking issue.</p>`;
    return;
  }
  container.innerHTML = readiness.issues.map((issue) => `
    <p><b>${issue.code}</b><span data-error-key="${issue.key}">${issue.code}</span></p>
  `).join("");
}

function renderWorkflowRail() {
  const nav = document.querySelector("[data-workflow-nav]");
  if (!nav) return;
  nav.innerHTML = workflowSteps.map((step, index) => `
    <a href="#${step.id}" class="${index === 1 ? "active" : ""}">
      <span>${step.number}</span>
      <strong data-i18n="workflow.${step.id}.title">${step.title}</strong>
      <small data-i18n="workflow.${step.id}.subtitle">${step.subtitle}</small>
    </a>
  `).join("");
}

function renderBoundaryMatrix() {
  const table = document.querySelector("[data-boundary-table]");
  if (!table) return;
  table.innerHTML = `
    <div class="boundary-head">Screen</div>
    <div class="boundary-head">Public Core</div>
    <div class="boundary-head">Commercial Candidate</div>
    ${workflowSteps.map((step) => `
      <div>${step.number} ${step.title}</div>
      <div>${step.publicCore.join(", ")}</div>
      <div>${step.commercial.join(", ")}</div>
    `).join("")}
  `;
}

function renderErrorSamples() {
  const container = document.querySelector("[data-error-samples]");
  if (!container) return;
  container.innerHTML = errorSamples.map((sample) => `
    <div>
      <strong>${sample.code}</strong>
      <span data-error-key="${sample.key}">${sample.code}</span>
    </div>
  `).join("");
}

function bootApp() {
  applyScreenLayout();
  renderWorkflowRail();
  renderBoundaryMatrix();
  renderErrorSamples();
  bindCreateControls();
  renderCreateSummary();
  renderStateSummary();
  renderReadinessIssues();
  renderCommercialAvailability();
  renderCollaborationSummary();
  renderAccessPanels();
  renderApiRegistry();
  bindAdminWorkbench();
  renderLockPolicy();
  document.dispatchEvent(new CustomEvent("cga:content-rendered"));
}

document.addEventListener("DOMContentLoaded", bootApp);
