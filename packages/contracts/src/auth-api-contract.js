import { USER_ROLES } from "./access-contract.js";

export const AUTH_API_ROUTES = Object.freeze({
  SIGNUP: "/api/cga/auth/signup",
  LOGIN: "/api/cga/auth/login",
  ME: "/api/cga/auth/me",
  GROUPS: "/api/cga/groups",
  GROUP_JOIN_REQUESTS: "/api/cga/groups/join-requests",
  ADMIN_PERMISSION_REQUESTS: "/api/cga/admin/permission-requests"
});

export const AUTH_API_ACTIONS = Object.freeze({
  SIGNUP_CREATE_OWN_GROUP: "signup.createOwnGroup",
  LOGIN_LOAD_MEMBERSHIPS: "login.loadMemberships",
  REQUEST_GROUP_JOIN: "group.requestJoin",
  APPROVE_GROUP_JOIN: "group.approveJoin",
  REQUEST_ADMIN_PERMISSION: "admin.requestPermission",
  APPROVE_ADMIN_PERMISSION: "admin.approvePermission",
  REMOVE_MEMBERSHIP: "group.removeMembership"
});

export function createSignupRequest({ userId, name, password, locale = "en", groupName }) {
  return {
    user_id: userId,
    name,
    password,
    locale,
    group_name: groupName
  };
}

export function createLoginRequest({ userId, password }) {
  return {
    user_id: userId,
    password
  };
}

export function createGroupJoinRequestPayload({ groupId, requestedRole = USER_ROLES.VIEWER }) {
  return {
    group_id: groupId,
    requested_role: requestedRole
  };
}

export function createAdminPermissionRequestPayload({ groupId = null, requestedRole = USER_ROLES.GROUP_ADMIN }) {
  return {
    group_id: groupId,
    requested_role: requestedRole
  };
}

export function createAuthSessionResponse({ user, memberships, groups, locale }) {
  return {
    user,
    memberships,
    groups,
    locale: locale || user?.locale || "en"
  };
}
