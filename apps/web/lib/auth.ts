export type AuthUser = {
  id: string;
  login_id: string;
  name: string;
  email: string | null;
  roles: string[];
  group_id: string | null;
  group_code: string | null;
  group_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  last_bot_screen?: string | null;
  favorite_bot_ids?: string[];
};

export type AuthSession = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

const AUTH_STORAGE_KEY = "aidot.auth.session";
const LAST_BOT_SCREEN_STORAGE_PREFIX = "aidot.last_bot_screen";
export const AUTH_GROUP_ID_COOKIE = "aidot.group_id";
export const AUTH_GROUP_CODE_COOKIE = "aidot.group_code";

function buildLastBotScreenKey(loginId: string) {
  return `${LAST_BOT_SCREEN_STORAGE_PREFIX}.${loginId}`;
}

function normalizeBotScreenPath(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^\/studio\/bots\/([^/]+)\/versions\/([^/?#]+)(?:\/[^?#]*)?(?:\?.*)?$/);
  if (!match) {
    return null;
  }

  return `/studio/bots/${match[1]}/versions/${match[2]}/intents`;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

function syncAuthSessionCookies(session: AuthSession | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!session?.user.group_id || !session.user.group_code) {
    clearCookie(AUTH_GROUP_ID_COOKIE);
    clearCookie(AUTH_GROUP_CODE_COOKIE);
    return;
  }

  writeCookie(AUTH_GROUP_ID_COOKIE, session.user.group_id);
  writeCookie(AUTH_GROUP_CODE_COOKIE, session.user.group_code);
}

export function saveAuthSession(session: AuthSession) {
  if (typeof window === "undefined") {
    return;
  }
  const lastBotScreenKey = buildLastBotScreenKey(session.user.login_id);
  const normalized =
    normalizeBotScreenPath(window.localStorage.getItem(lastBotScreenKey)) ??
    normalizeBotScreenPath(session.user.last_bot_screen);
  const nextSession: AuthSession = {
    ...session,
    user: {
      ...session.user,
      last_bot_screen: normalized,
    },
  };

  if (normalized) {
    window.localStorage.setItem(lastBotScreenKey, normalized);
  } else {
    window.localStorage.removeItem(lastBotScreenKey);
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
  syncAuthSessionCookies(nextSession);
}

export function loadAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  syncAuthSessionCookies(null);
}

export function redirectToLogin() {
  if (typeof window === "undefined") {
    return;
  }

  clearAuthSession();
  window.location.replace("/login");
}

export function saveLastBotScreen(path: string, loginId?: string) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeBotScreenPath(path);
  if (!normalized) {
    return;
  }

  const session = loadAuthSession();
  const resolvedLoginId = loginId ?? session?.user.login_id;
  if (!resolvedLoginId) {
    return;
  }

  window.localStorage.setItem(buildLastBotScreenKey(resolvedLoginId), normalized);

  if (session && session.user.login_id === resolvedLoginId) {
    saveAuthSession({
      ...session,
      user: {
        ...session.user,
        last_bot_screen: normalized,
      },
    });
  }
}

export function loadLastBotScreen(loginId?: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const session = loadAuthSession();
  const resolvedLoginId = loginId ?? session?.user.login_id;

  if (resolvedLoginId) {
    const fromLocal = normalizeBotScreenPath(window.localStorage.getItem(buildLastBotScreenKey(resolvedLoginId)));
    if (fromLocal) {
      return fromLocal;
    }
  }

  const fromSession = normalizeBotScreenPath(session?.user.last_bot_screen);
  if (fromSession && (!resolvedLoginId || session?.user.login_id === resolvedLoginId)) {
    return fromSession;
  }

  return null;
}

export function resolvePostLoginPath(session: AuthSession | null) {
  if (!session) {
    return "/studio/dashboard";
  }

  return loadLastBotScreen(session.user.login_id) ?? "/studio/dashboard";
}

export function refreshAuthSessionCookies() {
  if (typeof window === "undefined") {
    return;
  }

  syncAuthSessionCookies(loadAuthSession());
}

export function updateAuthSessionUser(updater: (user: AuthUser) => AuthUser) {
  const session = loadAuthSession();
  if (!session) {
    return null;
  }

  const nextSession: AuthSession = {
    ...session,
    user: updater(session.user),
  };
  saveAuthSession(nextSession);
  return nextSession;
}

export function hasApiRole(roles: string[]) {
  return (
    roles.includes("curator") ||
    roles.includes("operation_manager") ||
    roles.includes("system_manager") ||
    roles.includes("it_admin")
  );
}

export function hasApiWriteRole(roles: string[]) {
  return roles.includes("operation_manager") || roles.includes("system_manager") || roles.includes("it_admin");
}

export function hasAdminRole(roles: string[]) {
  return roles.includes("system_manager") || roles.includes("it_admin");
}

export function hasAdminOperationsRole(roles: string[]) {
  return roles.includes("operation_manager") || hasAdminRole(roles);
}

export function roleLabel(roleCode: string) {
  switch (roleCode) {
    case "operation_manager":
      return "운영관리자";
    case "system_manager":
      return "시스템관리자";
    case "it_admin":
      return "IT관리자";
    case "reviewer":
      return "검토자";
    case "viewer":
      return "조회자";
    case "curator":
    default:
      return "큐레이터";
  }
}
