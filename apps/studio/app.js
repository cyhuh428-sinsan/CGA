import { workflowSteps, productionLinks, systemAdminLinks, referenceLinks, errorSamples } from "./data/workflow.js";
import { getVisibleLayout } from "./data/layout.js";
import { sampleStudioState } from "./data/sample-state.js";
import { deriveReadiness, canGeneratePdfQa, canUseKakaoChannel, TRAINING_LOCKED_CREATE_FIELDS, RUNTIME_ADJUSTABLE_FIELDS } from "/packages/public-core/src/studio-state.js";
import { createDefaultModuleRegistry, DEFAULT_COMMERCIAL_FEATURE_CHECKS, getFeatureAvailability } from "/packages/public-core/src/module-registry.js";
import { createGroupManagedApiAnswerDraft } from "/packages/contracts/src/api-answer-contract.js";
import { createSampleCollaborationState, lockWorkItem, releaseWorkItemLock, submitReviewDecision, summarizeCollaboration, summarizeTeamDashboard } from "/packages/public-core/src/collaboration-state.js";
import {
  approveAdminPermissionRequest,
  approveGroupJoinRequest,
  applySignup,
  canApproveAdminPermissionRequest,
  canApproveGroupJoinRequest,
  canCreateManagedGroup,
  createManagedGroup,
  createSampleAccessState,
  loginAsUser,
  getEffectiveGroupScopes,
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
let currentCollaborationState = createSampleCollaborationState();
let currentAccessState = createSampleAccessState();
let currentWorkspaceGroupId = "g-support";
let currentWorkspaceBotId = "supportbot-draft";
let currentWorkspaceBots = [
  {
    id: "supportbot-draft",
    group_id: "g-support",
    name: "SupportBot Draft",
    version: "v0.1",
    status: "draft",
    locale: "ko",
    updated_at: "2026-06-04"
  },
  {
    id: "faqbot-v1",
    group_id: "g-support",
    name: "FAQ Bot v1",
    version: "v1.0",
    status: "ready",
    locale: "en",
    updated_at: "2026-06-03"
  },
  {
    id: "ops-assistant",
    group_id: "g-ops",
    name: "Ops Assistant",
    version: "v0.3",
    status: "operating",
    locale: "en",
    updated_at: "2026-06-02"
  }
];
let currentApiRegistry = [
  {
    group_id: "g-support",
    bot_id: "supportbot-draft",
    name: "order_status_lookup",
    endpoint_url: "https://api.example.com/orders/{order_id}",
    method: "GET",
    auth_type: "bearer",
    secret_ref: "secret:group/g-support/order-status",
    response_path: "data.answer"
  }
];
let currentApiGroupId = "g-support";
let currentApiBotId = "supportbot-draft";

function getActiveGroupsForCurrentUser() {
  const memberships = currentAccessState.memberships.filter((membership) => membership.user_id === currentAccessState.currentUserId && membership.status === "active");
  return currentAccessState.groups.filter((group) => group.status === "active" && memberships.some((membership) => membership.group_id === group.id));
}

function getCurrentWorkspaceGroup() {
  return currentAccessState.groups.find((group) => group.id === currentWorkspaceGroupId) || getActiveGroupsForCurrentUser()[0] || null;
}

function getCurrentWorkspaceBot() {
  return currentWorkspaceBots.find((bot) => bot.id === currentWorkspaceBotId) || currentWorkspaceBots.find((bot) => bot.group_id === currentWorkspaceGroupId) || null;
}

function getBotsForGroup(groupId) {
  return currentWorkspaceBots.filter((bot) => bot.group_id === groupId);
}

function canManageApiAnswerForCurrentSelection() {
  return getEffectiveGroupScopes(currentAccessState, currentAccessState.currentUserId, currentApiGroupId, currentApiBotId).includes("apiAnswer.manage");
}

function canCreateBotInCurrentWorkspace() {
  return getEffectiveGroupScopes(currentAccessState, currentAccessState.currentUserId, currentWorkspaceGroupId, currentWorkspaceBotId).includes("bot.create");
}

function getCurrentAccessUser() {
  return currentAccessState.users.find((user) => user.id === currentAccessState.currentUserId) || null;
}

function syncStudioLocaleToCurrentUser() {
  const locale = getCurrentAccessUser()?.locale || "en";
  if (window.cgaStudioI18n?.setLocale) {
    window.cgaStudioI18n.setLocale(locale);
    return;
  }
  const select = document.querySelector("[data-locale-select]");
  if (select) select.value = locale;
  localStorage.setItem("cga.studio.locale", locale);
}



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
  renderTopContext();
  bindCreateControls();
  renderCreateSummary();
  renderTopContext();
  renderErrorSamples();
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

function renderTeamDashboard() {
  const myTasks = document.querySelector("[data-team-my-tasks]");
  const reviewQueue = document.querySelector("[data-team-review-queue]");
  const blockedItems = document.querySelector("[data-team-blocked-items]");
  const statusStrip = document.querySelector("[data-team-status-strip]");
  if (!myTasks || !reviewQueue || !blockedItems || !statusStrip) return;
  const dashboard = summarizeTeamDashboard(currentCollaborationState, { currentUserId: currentAccessState.currentUserId });
  const renderItems = (items, emptyText, mode) => items.map((item) => {
    const lockOwner = item.lock?.user_id;
    const isMine = item.assignee_id === currentAccessState.currentUserId;
    const canUnlock = lockOwner === currentAccessState.currentUserId;
    return `
    <div class="team-task-row ${item.status}">
      <strong>${item.title}</strong>
      <span>${item.type} · ${item.status} · ${item.assignee?.name || item.assignee_id || "unassigned"}${lockOwner ? ` · locked by ${lockOwner}` : ""}</span>
      <div class="team-task-actions">
        ${mode === "mine" && !lockOwner && isMine ? `<button type="button" data-lock-work="${item.id}">Lock</button>` : ""}
        ${mode === "mine" && canUnlock ? `<button type="button" data-unlock-work="${item.id}">Unlock</button>` : ""}
        ${mode === "review" ? `<button type="button" data-approve-work="${item.id}">Approve</button><button type="button" data-request-change="${item.id}">Request changes</button>` : ""}
        ${mode === "blocked" ? `<button type="button" data-request-change="${item.id}">Move to todo</button>` : ""}
      </div>
    </div>
  `;
  }).join("") || `<div class="team-task-empty"><strong>${emptyText}</strong><span>Current user: ${dashboard.currentUser?.name || currentAccessState.currentUserId}</span></div>`;
  myTasks.innerHTML = renderItems(dashboard.myTasks, "No assigned task", "mine");
  reviewQueue.innerHTML = renderItems(dashboard.reviewQueue, "No review waiting", "review");
  blockedItems.innerHTML = renderItems(dashboard.blockedItems, "No blocked item", "blocked");
  statusStrip.innerHTML = dashboard.byStatus.map((entry) => `
    <div class="team-status-card ${entry.status}">
      <strong>${entry.status}</strong>
      <span>${entry.count}</span>
    </div>
  `).join("");
  bindTeamDashboardActions();
}

function bindTeamDashboardActions() {
  document.querySelectorAll("[data-lock-work]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      currentCollaborationState = lockWorkItem(currentCollaborationState, { workItemId: button.dataset.lockWork, userId: currentAccessState.currentUserId });
      renderTeamDashboard();
      renderCollaborationSummary();
    });
  });
  document.querySelectorAll("[data-unlock-work]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      currentCollaborationState = releaseWorkItemLock(currentCollaborationState, { workItemId: button.dataset.unlockWork, userId: currentAccessState.currentUserId });
      renderTeamDashboard();
      renderCollaborationSummary();
    });
  });
  document.querySelectorAll("[data-approve-work]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      currentCollaborationState = submitReviewDecision(currentCollaborationState, { workItemId: button.dataset.approveWork, reviewerId: currentAccessState.currentUserId, decision: "approve" });
      renderTeamDashboard();
      renderCollaborationSummary();
    });
  });
  document.querySelectorAll("[data-request-change]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      currentCollaborationState = submitReviewDecision(currentCollaborationState, { workItemId: button.dataset.requestChange, reviewerId: currentAccessState.currentUserId, decision: "request_changes" });
      renderTeamDashboard();
      renderCollaborationSummary();
    });
  });
}

function renderWorkspaceHome() {
  const groupSelect = document.querySelector("[data-workspace-group]");
  const summary = document.querySelector("[data-workspace-summary]");
  const botList = document.querySelector("[data-workspace-bots]");
  const createButton = document.querySelector("[data-workspace-create]");
  const transfer = document.querySelector("[data-workspace-transfer]");
  const currentBotName = document.querySelector("[data-current-bot-name]");
  const currentGroupName = document.querySelector("[data-current-group-name]");
  if (!groupSelect || !summary || !botList) return;
  const groups = getActiveGroupsForCurrentUser();
  if (!groups.some((group) => group.id === currentWorkspaceGroupId)) {
    currentWorkspaceGroupId = groups[0]?.id || currentWorkspaceGroupId;
  }
  const group = getCurrentWorkspaceGroup();
  const bots = currentWorkspaceBots.filter((bot) => bot.group_id === currentWorkspaceGroupId);
  const currentBot = getCurrentWorkspaceBot();
  const canCreateBot = canCreateBotInCurrentWorkspace();
  groupSelect.innerHTML = groups.map((item) => `<option value="${item.id}" ${item.id === currentWorkspaceGroupId ? "selected" : ""}>${item.name}</option>`).join("");
  summary.innerHTML = `
    <div><strong>${group?.name || "No group"}</strong><span>${bots.length} bot(s) · ${currentAccessState.currentUserId} · ${canCreateBot ? "bot.create" : "blocked: bot.create"}</span></div>
  `;
  if (createButton) createButton.disabled = !canCreateBot;
  botList.innerHTML = bots.map((bot) => `
    <button type="button" class="bot-list-row ${bot.id === currentWorkspaceBotId ? "selected" : ""}" data-open-bot="${bot.id}">
      <strong>${bot.name}</strong>
      <span>${bot.status} · ${bot.locale} · ${bot.updated_at}</span>
    </button>
  `).join("") || `<div class="empty-list"><strong>No bot in this group</strong><span>Create a bot to start the workflow.</span></div>`;
  if (transfer) {
    const currentVersion = currentStudioState.bot.version || currentBot?.version || "v0.1";
    transfer.innerHTML = `
      <div class="workspace-list-head">
        <h4 data-i18n="transfer.botPackageTitle">Bot Version / Package</h4>
        <button type="button" ${canCreateBot ? "" : "disabled"} data-i18n="transfer.copyBot">Copy Bot</button>
      </div>
      <p data-i18n="transfer.botPackageBody">Manage the current bot by version, and exchange Aidot-compatible bot packages with Aidot or CGA.</p>
      <p class="compat-note" data-i18n="transfer.aidotLocaleBoundary">Aidot upload compatibility uses a single selected bot language. CGA multilingual packages require a CGA-only import path or an Aidot compatibility update.</p>
      <div class="version-strip">
        <span><b data-i18n="transfer.currentVersion">Current version</b>${currentVersion}</span>
        <span><b data-i18n="transfer.compatibility">Compatibility</b>Aidot / CGA</span>
        <span><b data-i18n="transfer.botPackageFormat">Bot package</b>JSON · replace</span>
        <span><b data-i18n="transfer.assetPackageFormat">Text assets</b>TXT · merge</span>
      </div>
      <div class="button-row">
        <button type="button" data-i18n="transfer.downloadBot">Download Bot</button>
        <button type="button" class="ghost-btn" data-i18n="transfer.uploadBot">Upload Bot</button>
        <button type="button" class="ghost-btn" data-i18n="transfer.downloadVersion">Download Version</button>
        <button type="button" class="ghost-btn" data-i18n="transfer.uploadVersion">Upload Version</button>
      </div>
    `;
  }
  if (currentBotName) currentBotName.textContent = currentBot?.name || "No bot selected";
  if (currentGroupName) currentGroupName.textContent = group?.name || "No group selected";
  renderTopContext();
  bindWorkspaceActions();
}

function renderTopContext() {
  const current = summarizeAccess(currentAccessState);
  const group = getCurrentWorkspaceGroup();
  const bot = getCurrentWorkspaceBot();
  const currentUserBadge = document.querySelector("[data-current-user-badge]");
  const currentGroupBadge = document.querySelector("[data-current-group-badge]");
  const currentBotBadge = document.querySelector("[data-current-bot-badge]");
  const currentVersionBadge = document.querySelector("[data-current-version-badge]");
  if (currentUserBadge) {
    const roles = current.memberships.map((item) => item.role).join(", ") || "no role";
    currentUserBadge.textContent = `${current.user?.name || "User"} · ${current.user?.locale || "en"} · ${roles}`;
  }
  if (currentGroupBadge) currentGroupBadge.textContent = `Group: ${group?.name || "None"}`;
  if (currentBotBadge) currentBotBadge.textContent = `Bot: ${currentStudioState.bot.name || bot?.name || "None"}`;
  if (currentVersionBadge) currentVersionBadge.textContent = `Version: ${currentStudioState.bot.version || "v0.1"}`;
}

function bindWorkspaceActions() {
  const groupSelect = document.querySelector("[data-workspace-group]");
  const createButton = document.querySelector("[data-workspace-create]");
  if (groupSelect && groupSelect.dataset.bound !== "true") {
    groupSelect.dataset.bound = "true";
    groupSelect.addEventListener("change", () => {
      currentWorkspaceGroupId = groupSelect.value;
      currentWorkspaceBotId = currentWorkspaceBots.find((bot) => bot.group_id === currentWorkspaceGroupId)?.id || "";
      currentApiGroupId = currentWorkspaceGroupId;
      currentApiBotId = currentWorkspaceBotId;
      renderWorkspaceHome();
      rerenderAdminAndAccess();
    });
  }
  if (createButton && createButton.dataset.bound !== "true") {
    createButton.dataset.bound = "true";
    createButton.addEventListener("click", () => {
      if (!canCreateBotInCurrentWorkspace()) return;
      const nextNumber = currentWorkspaceBots.length + 1;
      const id = `bot-${Date.now()}`;
      const bot = {
        id,
        group_id: currentWorkspaceGroupId,
        name: `New Bot ${nextNumber}`,
        status: "draft",
        locale: currentStudioState.bot.defaultLocale,
        updated_at: "2026-06-04"
      };
      currentWorkspaceBots = [...currentWorkspaceBots, bot];
      currentWorkspaceBotId = id;
      currentApiGroupId = currentWorkspaceGroupId;
      currentApiBotId = id;
      currentStudioState.bot.name = bot.name;
      currentStudioState.bot.version = "v0.1";
      renderWorkspaceHome();
      renderCreateSummary();
      renderTopContext();
      document.dispatchEvent(new CustomEvent("cga:content-rendered"));
    });
  }
  document.querySelectorAll("[data-open-bot]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const bot = currentWorkspaceBots.find((item) => item.id === button.dataset.openBot);
      if (!bot) return;
      currentWorkspaceBotId = bot.id;
      currentWorkspaceGroupId = bot.group_id;
      currentApiGroupId = bot.group_id;
      currentApiBotId = bot.id;
      currentStudioState.bot.name = bot.name;
      currentStudioState.bot.defaultLocale = bot.locale;
      currentStudioState.bot.version = bot.version || currentStudioState.bot.version || "v0.1";
      renderWorkspaceHome();
      renderCreateSummary();
      renderTopContext();
      document.dispatchEvent(new CustomEvent("cga:content-rendered"));
    });
  });
}

function renderAccessPanels() {
  const currentUserBadge = document.querySelector("[data-current-user-badge]");
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
  renderTopContext();
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
    ...summarizeJoinRequests(currentAccessState).filter((request) => request.status === "pending").map((request) => {
      const canApprove = canApproveGroupJoinRequest(currentAccessState, { requestId: request.id, reviewerId: currentAccessState.currentUserId });
      return `
      <div class="${canApprove ? "" : "blocked-action"}">
        <strong>${request.user?.name || request.user_id} -> ${request.group?.name || request.group_id}</strong>
        <span>${request.requested_role} · group join · ${canApprove ? "group admin approval" : "requires group admin"}</span>
        <button type="button" data-approve-join="${request.id}" ${canApprove ? "" : "disabled"}>Approve</button>
      </div>
    `;
    }),
    ...summarizeAdminRequests(currentAccessState).filter((request) => request.status === "pending").map((request) => {
      const canApprove = canApproveAdminPermissionRequest(currentAccessState, { requestId: request.id, reviewerId: currentAccessState.currentUserId });
      return `
      <div class="${canApprove ? "" : "blocked-action"}">
        <strong>${request.user?.name || request.user_id} -> ${request.group?.name || request.group_id}</strong>
        <span>${request.requested_role} · admin permission · ${canApprove ? "system admin approval" : "requires system admin"}</span>
        <button type="button" data-approve-admin="${request.id}" ${canApprove ? "" : "disabled"}>Approve</button>
      </div>
    `;
    })
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
    <p><strong data-i18n="access.currentGroupCreate">Current user can create group</strong><span>${canCreateManagedGroup(currentAccessState, currentAccessState.currentUserId) ? "Yes" : "No"}</span></p>
    <p><strong data-i18n="access.groupsWithoutAdmin">Groups without group admin</strong><span>${policy.groupsWithoutAdmin.join(", ") || "None"}</span></p>
  `;
  bindAdminActionButtons();
  applyAccessToNavigation(current);
}

function applyAccessToNavigation(current = summarizeAccess(currentAccessState)) {
  const screenAccess = new Map(current.screens.map((screen) => [screen.screenId, screen]));
  document.querySelectorAll(".management-nav a, [data-workflow-nav] a").forEach((link) => {
    const id = link.getAttribute("href")?.replace("#", "");
    const access = screenAccess.get(id);
    const allowed = access ? access.allowed : true;
    link.classList.toggle("access-blocked", !allowed);
    link.classList.toggle("access-allowed", allowed);
    link.setAttribute("aria-disabled", allowed ? "false" : "true");
    link.dataset.accessLabel = allowed ? "Allowed" : `Blocked · ${access?.scope || "no scope"}`;
  });
}

function renderApiRegistry() {
  const apiGroup = document.querySelector("[data-api-group]");
  const apiBot = document.querySelector("[data-api-bot]");
  const apiRegistry = document.querySelector("[data-api-registry]");
  const apiOwnerMeta = document.querySelector("[data-api-owner-meta]");
  const apiAdd = document.querySelector("[data-api-add]");
  if (!apiGroup || !apiBot || !apiRegistry) return;
  const groups = getActiveGroupsForCurrentUser();
  if (!groups.some((group) => group.id === currentApiGroupId)) {
    currentApiGroupId = groups[0]?.id || currentWorkspaceGroupId;
  }
  const bots = getBotsForGroup(currentApiGroupId);
  if (!bots.some((bot) => bot.id === currentApiBotId)) {
    currentApiBotId = bots[0]?.id || currentWorkspaceBotId;
  }
  const canManageApi = canManageApiAnswerForCurrentSelection();
  apiGroup.innerHTML = groups
    .map((group) => `<option value="${group.id}" ${group.id === currentApiGroupId ? "selected" : ""}>${group.name}</option>`)
    .join("");
  apiBot.innerHTML = bots
    .map((bot) => `<option value="${bot.id}" ${bot.id === currentApiBotId ? "selected" : ""}>${bot.name}</option>`)
    .join("");
  if (apiOwnerMeta) {
    apiOwnerMeta.textContent = `group_id: ${currentApiGroupId} · bot_id: ${currentApiBotId || "none"} · ${canManageApi ? "scope: apiAnswer.manage" : "blocked: apiAnswer.manage"}`;
  }
  if (apiAdd) {
    apiAdd.disabled = !canManageApi || !currentApiBotId;
  }
  const filteredApis = currentApiRegistry.filter((api) => api.group_id === currentApiGroupId && api.bot_id === currentApiBotId);
  apiRegistry.innerHTML = filteredApis.map((api) => `
    <div>
      <strong>${api.name}</strong>
      <span>${api.group_id} · ${api.bot_id} · ${api.method || "GET"} · ${api.endpoint_url} · ${api.response_path}</span>
    </div>
  `).join("") || `<div><strong>No API answer</strong><span>Register a group API answer for the selected bot.</span></div>`;
}

function rerenderAdminAndAccess() {
  syncStudioLocaleToCurrentUser();
  renderWorkspaceHome();
  renderTeamDashboard();
  renderAccessPanels();
  renderApiRegistry();
  document.dispatchEvent(new CustomEvent("cga:content-rendered"));
}

function bindAdminActionButtons() {
  document.querySelectorAll("[data-approve-join]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      currentAccessState = approveGroupJoinRequest(currentAccessState, { requestId: button.dataset.approveJoin, reviewerId: currentAccessState.currentUserId });
      rerenderAdminAndAccess();
    });
  });
  document.querySelectorAll("[data-approve-admin]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      currentAccessState = approveAdminPermissionRequest(currentAccessState, { requestId: button.dataset.approveAdmin, reviewerId: currentAccessState.currentUserId });
      rerenderAdminAndAccess();
    });
  });
}

function bindAdminWorkbench() {
  const loginSubmit = document.querySelector("[data-login-submit]");
  const signupSubmit = document.querySelector("[data-signup-submit]");
  const groupCreate = document.querySelector("[data-group-create]");
  const joinSubmit = document.querySelector("[data-join-submit]");
  const apiGroup = document.querySelector("[data-api-group]");
  const apiBot = document.querySelector("[data-api-bot]");
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
      currentAccessState = createManagedGroup(currentAccessState, { id, name, actorId: currentAccessState.currentUserId });
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
      if (!canManageApiAnswerForCurrentSelection()) return;
      const name = document.querySelector("[data-api-name]")?.value?.trim();
      const endpoint = document.querySelector("[data-api-endpoint]")?.value?.trim();
      if (!name || !endpoint) return;
      const draft = createGroupManagedApiAnswerDraft({ groupId: currentApiGroupId, botId: currentApiBotId });
      currentApiRegistry = [
        ...currentApiRegistry,
        {
          ...draft,
          name,
          endpoint_url: endpoint,
          method: "GET",
          auth_type: "none",
          response_path: document.querySelector("[data-api-response-path]")?.value?.trim() || "data.answer"
        }
      ];
      rerenderAdminAndAccess();
    });
  }
  if (apiGroup && apiGroup.dataset.bound !== "true") {
    apiGroup.dataset.bound = "true";
    apiGroup.addEventListener("change", () => {
      currentApiGroupId = apiGroup.value;
      currentApiBotId = getBotsForGroup(currentApiGroupId)[0]?.id || "";
      renderApiRegistry();
    });
  }
  if (apiBot && apiBot.dataset.bound !== "true") {
    apiBot.dataset.bound = "true";
    apiBot.addEventListener("change", () => {
      currentApiBotId = apiBot.value;
      renderApiRegistry();
    });
  }
}

function bindAccessNavigationGuard() {
  document.querySelectorAll(".management-nav a, [data-workflow-nav] a").forEach((link) => {
    if (link.dataset.guardBound === "true") return;
    link.dataset.guardBound = "true";
    link.addEventListener("click", (event) => {
      if (link.classList.contains("access-blocked")) {
        event.preventDefault();
      }
    });
  });
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

function renderLinkRail(selector, links) {
  const nav = document.querySelector(selector);
  if (!nav) return;
  nav.innerHTML = links.map((link) => `
    <a href="#${link.id}">
      <span>${link.code}</span>
      <strong data-i18n="${link.titleKey}">${link.title}</strong>
      <small data-i18n="${link.subtitleKey}">${link.subtitle}</small>
    </a>
  `).join("");
}

function renderNavigationRails() {
  renderLinkRail("[data-production-nav]", productionLinks);
  renderLinkRail("[data-system-admin-nav]", systemAdminLinks);
  renderLinkRail("[data-reference-nav]", referenceLinks);
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
  const cgaErrors = errorSamples.filter((sample) => sample.localeSource === "user.locale");
  const botErrors = errorSamples.filter((sample) => sample.localeSource === "bot.defaultLocale");
  const botLocale = currentStudioState.bot.defaultLocale || "en";
  const resolveBotMessage = (sample) => window.cgaStudioI18n?.resolveMessage(botLocale, sample.key, sample.code) || sample.code;
  container.innerHTML = `
    <div class="error-sample-group">
      <strong><span data-i18n="i18n.cgaErrorGroup">CGA Error</span> · user.locale</strong>
      ${cgaErrors.map((sample) => `
        <p>
          <b>${sample.code}</b>
          <span data-error-key="${sample.key}">${sample.code}</span>
        </p>
      `).join("")}
    </div>
    <div class="error-sample-group">
      <strong><span data-i18n="i18n.botErrorGroup">Bot Error</span> · ${botLocale}</strong>
      ${botErrors.map((sample) => `
        <p>
          <b>${sample.code}</b>
          <span data-bot-error-key="${sample.key}">${resolveBotMessage(sample)}</span>
        </p>
      `).join("")}
    </div>
  `;
}

function bootApp() {
  applyScreenLayout();
  renderNavigationRails();
  renderWorkflowRail();
  bindAccessNavigationGuard();
  renderBoundaryMatrix();
  renderErrorSamples();
  bindCreateControls();
  renderCreateSummary();
  renderStateSummary();
  renderReadinessIssues();
  renderCommercialAvailability();
  renderCollaborationSummary();
  renderWorkspaceHome();
  renderTeamDashboard();
  renderAccessPanels();
  renderApiRegistry();
  bindAdminWorkbench();
  renderLockPolicy();
  syncStudioLocaleToCurrentUser();
  document.dispatchEvent(new CustomEvent("cga:content-rendered"));
}

document.addEventListener("DOMContentLoaded", bootApp);
document.addEventListener("cga:i18n-ready", syncStudioLocaleToCurrentUser);
