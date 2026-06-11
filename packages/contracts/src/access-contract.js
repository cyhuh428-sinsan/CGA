export const USER_ROLES = Object.freeze({
  SYSTEM_ADMIN: "system_admin",
  OWNER: "owner",
  GROUP_ADMIN: "group_admin",
  ADMIN: "admin",
  BUILDER: "builder",
  REVIEWER: "reviewer",
  OPERATOR: "operator",
  VIEWER: "viewer"
});

export const AUTH_STATUS = Object.freeze({
  ANONYMOUS: "anonymous",
  AUTHENTICATED: "authenticated",
  LOCKED: "locked"
});

export const SYSTEM_ADMIN_USER_ID = "admin";

export const USER_STATUS = Object.freeze({
  ACTIVE: "active",
  PENDING: "pending",
  LOCKED: "locked",
  DELETED: "deleted"
});

export const GROUP_STATUS = Object.freeze({
  ACTIVE: "active",
  DELETING: "deleting",
  DELETED: "deleted"
});

export const MEMBERSHIP_STATUS = Object.freeze({
  ACTIVE: "active",
  PENDING: "pending",
  REJECTED: "rejected",
  REMOVED: "removed"
});

export const GROUP_JOIN_REQUEST_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled"
});

export const ADMIN_REQUEST_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled"
});

export const ACCESS_SCOPES = Object.freeze({
  BOT_CREATE: "bot.create",
  BOT_CONFIGURE: "bot.configure",
  BOT_REVIEW: "bot.review",
  BOT_DEPLOY: "bot.deploy",
  USER_MANAGE: "user.manage",
  GROUP_CREATE: "group.create",
  GROUP_MANAGE: "group.manage",
  ADMIN_APPROVE: "admin.approve",
  API_ANSWER_MANAGE: "apiAnswer.manage",
  BOT_OPERATE: "bot.operate",
  BOT_ANALYZE: "bot.analyze",
  BOT_VIEW: "bot.view"
});

export const GROUP_TYPES = Object.freeze({
  ORGANIZATION: "organization",
  PROJECT: "project",
  TEAM: "team"
});

export const ROLE_SCOPE_DEFAULTS = Object.freeze({
  [USER_ROLES.SYSTEM_ADMIN]: Object.values(ACCESS_SCOPES),
  [USER_ROLES.OWNER]: Object.values(ACCESS_SCOPES),
  [USER_ROLES.GROUP_ADMIN]: [
    ACCESS_SCOPES.BOT_CREATE,
    ACCESS_SCOPES.BOT_CONFIGURE,
    ACCESS_SCOPES.BOT_REVIEW,
    ACCESS_SCOPES.BOT_DEPLOY,
    ACCESS_SCOPES.USER_MANAGE,
    ACCESS_SCOPES.GROUP_MANAGE,
    ACCESS_SCOPES.API_ANSWER_MANAGE,
    ACCESS_SCOPES.BOT_OPERATE,
    ACCESS_SCOPES.BOT_ANALYZE,
    ACCESS_SCOPES.BOT_VIEW
  ],
  [USER_ROLES.ADMIN]: Object.values(ACCESS_SCOPES),
  [USER_ROLES.BUILDER]: [
    ACCESS_SCOPES.BOT_CREATE,
    ACCESS_SCOPES.BOT_CONFIGURE,
    ACCESS_SCOPES.API_ANSWER_MANAGE,
    ACCESS_SCOPES.BOT_VIEW
  ],
  [USER_ROLES.REVIEWER]: [
    ACCESS_SCOPES.BOT_REVIEW,
    ACCESS_SCOPES.BOT_VIEW
  ],
  [USER_ROLES.OPERATOR]: [
    ACCESS_SCOPES.BOT_DEPLOY,
    ACCESS_SCOPES.BOT_OPERATE,
    ACCESS_SCOPES.BOT_ANALYZE,
    ACCESS_SCOPES.BOT_VIEW
  ],
  [USER_ROLES.VIEWER]: [
    ACCESS_SCOPES.BOT_VIEW
  ]
});

export const SCREEN_SCOPE_REQUIREMENTS = Object.freeze({
  "workspace-home": ACCESS_SCOPES.BOT_VIEW,
  "team-dashboard": ACCESS_SCOPES.BOT_VIEW,
  "access-management": ACCESS_SCOPES.USER_MANAGE,
  "create": ACCESS_SCOPES.BOT_CREATE,
  "configure": ACCESS_SCOPES.BOT_CONFIGURE,
  "detail": ACCESS_SCOPES.BOT_CONFIGURE,
  "api-answer-source": ACCESS_SCOPES.API_ANSWER_MANAGE,
  "build": ACCESS_SCOPES.BOT_CONFIGURE,
  "test": ACCESS_SCOPES.BOT_REVIEW,
  "operate": ACCESS_SCOPES.BOT_OPERATE,
  "state-readiness": ACCESS_SCOPES.BOT_VIEW
});

export function createUser({ id, name, locale = "en", status = USER_STATUS.ACTIVE, isSystemUser = false, deletable = true }) {
  return {
    id,
    name,
    locale,
    status,
    is_system_user: isSystemUser,
    deletable
  };
}

export function createGroup({ id, name, type = GROUP_TYPES.PROJECT }) {
  return { id, name, type, status: GROUP_STATUS.ACTIVE };
}

export function createGroupMembership({ userId, groupId, role, status = MEMBERSHIP_STATUS.ACTIVE }) {
  return {
    user_id: userId,
    group_id: groupId,
    role,
    status
  };
}

export function createGroupJoinRequest({ id, userId, groupId, requestedRole = USER_ROLES.VIEWER }) {
  return {
    id,
    user_id: userId,
    group_id: groupId,
    requested_role: requestedRole,
    status: GROUP_JOIN_REQUEST_STATUS.PENDING,
    reviewed_by: null,
    reviewed_at: null
  };
}

export function createAdminPermissionRequest({ id, userId, groupId = null, requestedRole = USER_ROLES.GROUP_ADMIN }) {
  return {
    id,
    user_id: userId,
    group_id: groupId,
    requested_role: requestedRole,
    status: ADMIN_REQUEST_STATUS.PENDING,
    reviewed_by: null,
    reviewed_at: null
  };
}

export function createSignupDraft({ userId, name, locale = "en", groupId = null, requestedRole = USER_ROLES.VIEWER }) {
  return {
    user: createUser({ id: userId, name, locale, status: USER_STATUS.ACTIVE }),
    group: null,
    membership: null,
    joinRequest: groupId
      ? createGroupJoinRequest({
          id: `jr-${userId}-${groupId}`,
          userId,
          groupId,
          requestedRole
        })
      : null
  };
}

export function createGroupBotAccess({ groupId, botId, scopes }) {
  return {
    group_id: groupId,
    bot_id: botId,
    scopes: [...new Set(scopes)]
  };
}

export function createUserBotAccessOverride({ userId, botId, allowScopes = [], denyScopes = [] }) {
  return {
    user_id: userId,
    bot_id: botId,
    allow_scopes: [...new Set(allowScopes)],
    deny_scopes: [...new Set(denyScopes)]
  };
}

export function getRoleScopes(role) {
  return ROLE_SCOPE_DEFAULTS[role] || [];
}

export function mergeScopes(...scopeLists) {
  return [...new Set(scopeLists.flat().filter(Boolean))];
}

export function hasScope(scopes, scope) {
  return scopes.includes(scope);
}
