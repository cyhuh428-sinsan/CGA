import {
  ACCESS_SCOPES,
  SYSTEM_ADMIN_USER_ID,
  SYSTEM_ADMIN_GROUP_ID,
  SCREEN_SCOPE_REQUIREMENTS,
  USER_ROLES,
  createGroup,
  createGroupBotAccess,
  createAdminPermissionRequest,
  createGroupJoinRequest,
  createGroupMembership,
  createUser,
  createUserBotAccessOverride,
  getRoleScopes,
  hasScope,
  mergeScopes
} from "../../contracts/src/access-contract.js";

export function createSampleAccessState() {
  return {
    botId: "supportbot-draft",
    currentUserId: "u-builder",
    users: [
      createUser({ id: SYSTEM_ADMIN_USER_ID, name: "admin", locale: "en", isSystemUser: true, deletable: false }),
      createUser({ id: "u-group-admin", name: "그룹관리자", locale: "ko" }),
      createUser({ id: "u-builder", name: "제작자", locale: "ko" }),
      createUser({ id: "u-reviewer", name: "검수자", locale: "ko" }),
      createUser({ id: "u-operator", name: "운영자", locale: "ko" }),
      createUser({ id: "u-viewer", name: "조회자", locale: "ko" })
    ],
    groups: [
      createGroup({ id: SYSTEM_ADMIN_GROUP_ID, name: "시스템관리자 그룹" }),
      createGroup({ id: "g-support", name: "기본그룹" }),
      createGroup({ id: "g-ops", name: "운영그룹" })
    ],
    memberships: [
      createGroupMembership({ userId: SYSTEM_ADMIN_USER_ID, groupId: SYSTEM_ADMIN_GROUP_ID, role: USER_ROLES.SYSTEM_ADMIN }),
      createGroupMembership({ userId: "u-group-admin", groupId: "g-support", role: USER_ROLES.GROUP_ADMIN }),
      createGroupMembership({ userId: "u-builder", groupId: "g-support", role: USER_ROLES.BUILDER }),
      createGroupMembership({ userId: "u-reviewer", groupId: "g-support", role: USER_ROLES.REVIEWER }),
      createGroupMembership({ userId: "u-operator", groupId: "g-ops", role: USER_ROLES.OPERATOR }),
      createGroupMembership({ userId: "u-viewer", groupId: "g-support", role: USER_ROLES.VIEWER })
    ],
    groupBotAccess: [
      createGroupBotAccess({ groupId: "g-support", botId: "supportbot-draft", scopes: mergeScopes(getRoleScopes(USER_ROLES.BUILDER), getRoleScopes(USER_ROLES.REVIEWER), getRoleScopes(USER_ROLES.VIEWER)) }),
      createGroupBotAccess({ groupId: "g-ops", botId: "supportbot-draft", scopes: getRoleScopes(USER_ROLES.OPERATOR) })
    ],
    userOverrides: [
      createUserBotAccessOverride({ userId: SYSTEM_ADMIN_USER_ID, botId: "supportbot-draft", allowScopes: getRoleScopes(USER_ROLES.SYSTEM_ADMIN) })
    ],
    joinRequests: [
      createGroupJoinRequest({ id: "jr-ops-builder", userId: "u-builder", groupId: "g-ops", requestedRole: USER_ROLES.OPERATOR })
    ],
    adminRequests: [
      createAdminPermissionRequest({ id: "ar-reviewer-admin", userId: "u-reviewer", groupId: "g-support", requestedRole: USER_ROLES.GROUP_ADMIN })
    ],
    loginHistory: [],
    policy: {
      signupCreatesOwnGroup: false,
      signupDefaultGroupId: "g-support",
      signupDefaultRole: USER_ROLES.VIEWER,
      groupCreationRequiresSystemAdmin: true,
      systemAdminUserId: SYSTEM_ADMIN_USER_ID,
      systemAdminDeletable: false,
      emptyGroupAutoDelete: true,
      oneGroupAdminRequired: true,
      userLocalePreference: true,
      errorLocaleSource: "user.locale"
    }
  };
}

export function applySignup(state, { userId, name, locale = "en", groupId, requestedRole = USER_ROLES.VIEWER }) {
  const targetGroupId = groupId || state.policy?.signupDefaultGroupId || state.groups.find((group) => group.status === "active")?.id;
  const requestExists = state.joinRequests.some((request) => (
    request.user_id === userId &&
    request.group_id === targetGroupId &&
    request.status === "pending"
  ));
  return {
    ...state,
    users: [...state.users, createUser({ id: userId, name, locale })],
    joinRequests: targetGroupId && !requestExists
      ? [
          ...state.joinRequests,
          createGroupJoinRequest({
            id: `jr-${userId}-${targetGroupId}`,
            userId,
            groupId: targetGroupId,
            requestedRole
          })
        ]
      : state.joinRequests
  };
}

export function normalizeAccessState(state) {
  const policy = {
    ...state.policy,
    signupCreatesOwnGroup: false,
    signupDefaultGroupId: state.policy?.signupDefaultGroupId || "g-support",
    signupDefaultRole: state.policy?.signupDefaultRole || USER_ROLES.VIEWER
  };
  const usersById = new Map((state.users || []).map((user) => [user.id, user]));
  const autoPersonalGroupIds = new Set((state.groups || [])
    .filter((group) => {
      if (!group?.id?.startsWith("g-")) return false;
      const userId = group.id.slice(2);
      const user = usersById.get(userId);
      if (!user || user.id === SYSTEM_ADMIN_USER_ID) return false;
      const activeMemberships = (state.memberships || []).filter((membership) => membership.group_id === group.id && membership.status === "active");
      return activeMemberships.length === 1
        && activeMemberships[0].user_id === userId
        && activeMemberships[0].role === USER_ROLES.GROUP_ADMIN;
    })
    .map((group) => group.id));
  const loginHistory = Array.isArray(state.loginHistory) ? state.loginHistory : [];
  if (!autoPersonalGroupIds.size) return { ...state, loginHistory, policy };
  const defaultGroupId = policy.signupDefaultGroupId;
  const groups = state.groups.map((group) => (
    autoPersonalGroupIds.has(group.id) ? { ...group, status: "deleted" } : group
  ));
  const memberships = state.memberships.map((membership) => (
    autoPersonalGroupIds.has(membership.group_id) ? { ...membership, status: "removed" } : membership
  ));
  const joinRequests = [...state.joinRequests];
  for (const groupId of autoPersonalGroupIds) {
    const userId = groupId.slice(2);
    const hasActiveTargetMembership = memberships.some((membership) => (
      membership.user_id === userId &&
      membership.group_id === defaultGroupId &&
      membership.status === "active"
    ));
    const hasPendingTargetRequest = joinRequests.some((request) => (
      request.user_id === userId &&
      request.group_id === defaultGroupId &&
      request.status === "pending"
    ));
    if (!hasActiveTargetMembership && !hasPendingTargetRequest) {
      joinRequests.push(createGroupJoinRequest({
        id: `jr-${userId}-${defaultGroupId}`,
        userId,
        groupId: defaultGroupId,
        requestedRole: policy.signupDefaultRole
      }));
    }
  }
  return { ...state, groups, memberships, joinRequests, loginHistory, policy };
}

export function loginAsUser(state, { userId }) {
  const user = state.users.find((item) => item.id === userId && item.status === "active");
  if (!user) return state;
  return { ...state, currentUserId: user.id };
}

export function isSystemAdmin(state, userId) {
  return getUserGroupMemberships(state, userId).some((membership) => membership.group_id === SYSTEM_ADMIN_GROUP_ID && membership.role === USER_ROLES.SYSTEM_ADMIN);
}

export function isGroupAdminForGroup(state, userId, groupId) {
  return getUserGroupMemberships(state, userId).some((membership) => (
    membership.group_id === groupId &&
    [USER_ROLES.GROUP_ADMIN, USER_ROLES.OWNER].includes(membership.role)
  ));
}

export function canCreateManagedGroup(state, userId = state?.currentUserId) {
  if (!state?.policy?.groupCreationRequiresSystemAdmin) return true;
  return isSystemAdmin(state, userId);
}

export function canManageGroupMembership(state, { actorId = state?.currentUserId, groupId }) {
  return isSystemAdmin(state, actorId) || isGroupAdminForGroup(state, actorId, groupId);
}

export function updateGroupMembershipRole(state, { actorId = state?.currentUserId, userId, groupId, role }) {
  if (!userId || !groupId || !role || !canManageGroupMembership(state, { actorId, groupId })) return state;
  const membership = state.memberships.find((item) => item.user_id === userId && item.group_id === groupId && item.status === "active");
  if (!membership || membership.role === USER_ROLES.SYSTEM_ADMIN) return state;
  if (role === USER_ROLES.SYSTEM_ADMIN && !isSystemAdmin(state, actorId)) return state;
  const activeGroupAdmins = state.memberships.filter((item) => (
    item.group_id === groupId &&
    item.status === "active" &&
    [USER_ROLES.GROUP_ADMIN, USER_ROLES.OWNER, USER_ROLES.SYSTEM_ADMIN].includes(item.role)
  ));
  if (
    state.policy?.oneGroupAdminRequired &&
    [USER_ROLES.GROUP_ADMIN, USER_ROLES.OWNER].includes(membership.role) &&
    ![USER_ROLES.GROUP_ADMIN, USER_ROLES.OWNER].includes(role) &&
    activeGroupAdmins.length <= 1
  ) {
    return state;
  }
  return {
    ...state,
    memberships: state.memberships.map((item) => (
      item.user_id === userId && item.group_id === groupId && item.status === "active"
        ? { ...item, role }
        : item
    ))
  };
}

export function canApproveGroupJoinRequest(state, { requestId, reviewerId = state?.currentUserId }) {
  const request = state.joinRequests.find((item) => item.id === requestId);
  if (!request || request.status !== "pending") return false;
  return isGroupAdminForGroup(state, reviewerId, request.group_id) || isSystemAdmin(state, reviewerId);
}

export function canApproveAdminPermissionRequest(state, { requestId, reviewerId = state?.currentUserId }) {
  const request = state.adminRequests.find((item) => item.id === requestId);
  if (!request || request.status !== "pending") return false;
  return isSystemAdmin(state, reviewerId);
}

export function createManagedGroup(state, { id, name, actorId = state?.currentUserId }) {
  if (!id || state.groups.some((group) => group.id === id) || !canCreateManagedGroup(state, actorId)) return state;
  return {
    ...state,
    groups: [...state.groups, createGroup({ id, name })]
  };
}

export function requestGroupJoin(state, { id, userId, groupId, requestedRole = USER_ROLES.VIEWER }) {
  return {
    ...state,
    joinRequests: [
      ...state.joinRequests,
      createGroupJoinRequest({ id, userId, groupId, requestedRole })
    ]
  };
}

export function approveGroupJoinRequest(state, { requestId, reviewerId, groupId = null, requestedRole = null }) {
  const request = state.joinRequests.find((item) => item.id === requestId);
  if (!request || request.status !== "pending" || !canApproveGroupJoinRequest(state, { requestId, reviewerId })) return state;
  const approvedGroupId = groupId || request.group_id;
  const approvedRole = requestedRole || request.requested_role;
  return {
    ...state,
    joinRequests: state.joinRequests.map((item) => item.id === requestId ? { ...item, group_id: approvedGroupId, requested_role: approvedRole, status: "approved", reviewed_by: reviewerId, reviewed_at: new Date(0).toISOString() } : item),
    memberships: [
      ...state.memberships,
      createGroupMembership({ userId: request.user_id, groupId: approvedGroupId, role: approvedRole })
    ]
  };
}

export function approveAdminPermissionRequest(state, { requestId, reviewerId, groupId = null, requestedRole = null }) {
  const request = state.adminRequests.find((item) => item.id === requestId);
  if (!request || request.status !== "pending" || !canApproveAdminPermissionRequest(state, { requestId, reviewerId })) return state;
  const approvedGroupId = groupId || request.group_id;
  const approvedRole = requestedRole || request.requested_role;
  const memberships = state.memberships.map((membership) => {
    if (membership.user_id === request.user_id && membership.group_id === approvedGroupId && membership.status === "active") {
      return { ...membership, role: approvedRole };
    }
    return membership;
  });
  const hasMembership = memberships.some((membership) => membership.user_id === request.user_id && membership.group_id === approvedGroupId && membership.status === "active");
  return {
    ...state,
    adminRequests: state.adminRequests.map((item) => item.id === requestId ? { ...item, group_id: approvedGroupId, requested_role: approvedRole, status: "approved", reviewed_by: reviewerId, reviewed_at: new Date(0).toISOString() } : item),
    memberships: hasMembership ? memberships : [
      ...memberships,
      createGroupMembership({ userId: request.user_id, groupId: approvedGroupId, role: approvedRole })
    ]
  };
}

export function removeMembershipAndDeleteEmptyGroups(state, { userId, groupId }) {
  const memberships = state.memberships.map((membership) => {
    if (membership.user_id === userId && membership.group_id === groupId && membership.status === "active") {
      return { ...membership, status: "removed" };
    }
    return membership;
  });
  const groups = state.groups.map((group) => {
    const hasActiveUser = memberships.some((membership) => membership.group_id === group.id && membership.status === "active");
    if (group.id === groupId && !hasActiveUser && state.policy.emptyGroupAutoDelete) {
      return { ...group, status: "deleted" };
    }
    return group;
  });
  return { ...state, memberships, groups };
}

export function getUserGroupMemberships(state, userId = state?.currentUserId) {
  return state?.memberships?.filter((membership) => membership.user_id === userId && membership.status === "active") || [];
}

export function getEffectiveUserScopes(state, userId = state?.currentUserId, botId = state?.botId) {
  const memberships = getUserGroupMemberships(state, userId);
  const groupScopes = memberships.flatMap((membership) => {
    const groupAccess = state.groupBotAccess.find((access) => access.group_id === membership.group_id && access.bot_id === botId);
    return mergeScopes(getRoleScopes(membership.role), groupAccess?.scopes || []);
  });
  const override = state.userOverrides.find((item) => item.user_id === userId && item.bot_id === botId);
  const allowed = mergeScopes(groupScopes, override?.allow_scopes || []);
  const denied = new Set(override?.deny_scopes || []);
  return allowed.filter((scope) => !denied.has(scope));
}

export function getEffectiveGroupScopes(state, userId = state?.currentUserId, groupId, botId = state?.botId) {
  const memberships = getUserGroupMemberships(state, userId).filter((membership) => membership.group_id === groupId);
  const groupAccess = state.groupBotAccess.find((access) => access.group_id === groupId && access.bot_id === botId);
  const systemAdmin = isSystemAdmin(state, userId);
  const roleScopes = memberships.flatMap((membership) => getRoleScopes(membership.role));
  const override = state.userOverrides.find((item) => item.user_id === userId && item.bot_id === botId);
  const scopedGroupAccess = memberships.length > 0 || systemAdmin ? groupAccess?.scopes || [] : [];
  const systemScopes = systemAdmin ? getRoleScopes(USER_ROLES.SYSTEM_ADMIN) : [];
  const allowed = mergeScopes(roleScopes, scopedGroupAccess, systemScopes, override?.allow_scopes || []);
  const denied = new Set(override?.deny_scopes || []);
  return allowed.filter((scope) => !denied.has(scope));
}

export function summarizeAccess(state, userId = state?.currentUserId) {
  const user = state?.users?.find((item) => item.id === userId) || null;
  const memberships = getUserGroupMemberships(state, userId);
  const scopes = getEffectiveUserScopes(state, userId);
  const screens = Object.entries(SCREEN_SCOPE_REQUIREMENTS).map(([screenId, scope]) => ({
    screenId,
    scope,
    allowed: hasScope(scopes, scope)
  }));
  return { user, memberships, scopes, screens };
}

export function summarizeGroupBotAccess(state) {
  return state.groupBotAccess.map((access) => ({
    group: state.groups.find((group) => group.id === access.group_id),
    botId: access.bot_id,
    scopes: access.scopes
  }));
}

export function summarizeAccessOperations(state) {
  const activeUsers = state.users.filter((user) => user.status === "active");
  const activeGroups = state.groups.filter((group) => group.status === "active");
  const activeMemberships = state.memberships.filter((membership) => membership.status === "active");
  const systemAdmin = state.users.find((user) => user.id === state.policy.systemAdminUserId);
  return {
    activeUsers: activeUsers.length,
    activeGroups: activeGroups.length,
    activeMemberships: activeMemberships.length,
    pendingJoinRequests: state.joinRequests.filter((request) => request.status === "pending").length,
    pendingAdminRequests: state.adminRequests.filter((request) => request.status === "pending").length,
    protectedAdmin: Boolean(systemAdmin && systemAdmin.deletable === false),
    multilingualUsers: new Set(activeUsers.map((user) => user.locale)).size
  };
}

export function summarizeAuthWorkflow(state) {
  return [
    { id: "signup", label: "Signup", detail: "Creates user and viewer join request" },
    { id: "login", label: "Login", detail: "Loads user locale and active memberships" },
    { id: "join-request", label: "Join request", detail: `${state.joinRequests.filter((request) => request.status === "pending").length} pending group request(s)` },
    { id: "approval", label: "Approval", detail: "Group membership is created after approval" },
    { id: "work", label: "Bot work", detail: "Screens open from group role and scopes" }
  ];
}

export function summarizeGroupUsers(state) {
  return state.groups
    .filter((group) => group.status === "active")
    .map((group) => ({
      group,
      users: state.memberships
        .filter((membership) => membership.group_id === group.id && membership.status === "active")
        .map((membership) => ({
          membership,
          user: state.users.find((user) => user.id === membership.user_id)
        }))
    }));
}

export function summarizeJoinRequests(state) {
  return state.joinRequests.map((request) => ({
    ...request,
    user: state.users.find((user) => user.id === request.user_id),
    group: state.groups.find((group) => group.id === request.group_id)
  }));
}

export function summarizeAdminRequests(state) {
  return state.adminRequests.map((request) => ({
    ...request,
    user: state.users.find((user) => user.id === request.user_id),
    group: state.groups.find((group) => group.id === request.group_id)
  }));
}

export function summarizeAccessPolicy(state) {
  const activeGroups = state.groups.filter((group) => group.status === "active");
  const groupsWithoutUsers = activeGroups.filter((group) => !state.memberships.some((membership) => membership.group_id === group.id && membership.status === "active"));
  const groupsWithoutAdmin = activeGroups.filter((group) => !state.memberships.some((membership) => membership.group_id === group.id && membership.status === "active" && [USER_ROLES.GROUP_ADMIN, USER_ROLES.OWNER].includes(membership.role)));
  return {
    systemAdmin: state.users.find((user) => user.id === state.policy.systemAdminUserId),
    pendingJoinRequests: state.joinRequests.filter((request) => request.status === "pending").length,
    pendingAdminRequests: state.adminRequests.filter((request) => request.status === "pending").length,
    groupsWithoutUsers: groupsWithoutUsers.map((group) => group.id),
    groupsWithoutAdmin: groupsWithoutAdmin.map((group) => group.id),
    signupCreatesOwnGroup: state.policy.signupCreatesOwnGroup,
    emptyGroupAutoDelete: state.policy.emptyGroupAutoDelete,
    groupCreationRequiresSystemAdmin: state.policy.groupCreationRequiresSystemAdmin,
    userLocalePreference: state.policy.userLocalePreference,
    errorLocaleSource: state.policy.errorLocaleSource
  };
}


