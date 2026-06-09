import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = String(4293 + Math.floor(Math.random() * 100));
const baseUrl = `http://localhost:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "cga-auth-api-"));
const server = spawn("node", ["scripts/serve-studio.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: port, CGA_DATA_DIR: dataDir },
  stdio: "pipe"
});

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
  fail("auth API test server did not start");
}

async function requestJson(path, { method = "GET", userId = "u-builder", sessionToken = "", cookie = "", body } = {}) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "X-CGA-User-Id": userId
  };
  if (sessionToken) headers["X-CGA-Session-Token"] = sessionToken;
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  return { response, payload, setCookie: response.headers.get("set-cookie") || "" };
}

async function expectOk(path, options, message) {
  const result = await requestJson(path, options);
  if (!result.response.ok) fail(`${message}: ${result.response.status}`);
  return result;
}

async function expectStatus(path, options, expectedStatus, message) {
  const result = await requestJson(path, options);
  if (result.response.status !== expectedStatus) fail(`${message}: expected ${expectedStatus}, got ${result.response.status}`);
  return result.payload;
}

async function main() {
  await waitForServer();

  const meResult = await expectOk("/api/cga/auth/me", { userId: "u-builder" }, "me endpoint failed");
  const me = meResult.payload;
  if (me.user?.id !== "u-builder") fail("me endpoint did not resolve header user");
  if (!Array.isArray(me.memberships) || !me.memberships.some((item) => item.group_id === "g-support")) fail("me endpoint did not return active memberships");

  const signup = await expectStatus("/api/cga/auth/signup", {
    method: "POST",
    body: {
      user_id: "u-api",
      name: "API User",
      password: "api-pass-1",
      locale: "vi",
      group_name: "API User Group"
    }
  }, 201, "signup endpoint failed");
  if (signup.user?.id !== "u-api" || signup.locale !== "vi") fail("signup endpoint did not return created user session");
  if (!signup.groups?.some((group) => group.id === "g-u-api")) fail("signup endpoint did not create personal group");

  const loginResult = await expectOk("/api/cga/auth/login", {
    method: "POST",
    body: { user_id: "u-api", password: "api-pass-1" }
  }, "login endpoint failed");
  const login = loginResult.payload;
  if (login.user?.id !== "u-api") fail("login endpoint did not switch current user");
  if (!login.session_token) fail("login endpoint did not return session token");
  if (!loginResult.setCookie.includes("cga_session=")) fail("login endpoint did not set session cookie");

  const tokenMeResult = await expectOk("/api/cga/auth/me", {
    userId: "admin",
    sessionToken: login.session_token
  }, "me endpoint with session token failed");
  if (tokenMeResult.payload.user?.id !== "u-api") fail("me endpoint did not resolve session token user");

  await expectStatus("/api/cga/auth/me", {
    userId: "admin",
    sessionToken: "expired-or-invalid-token"
  }, 401, "invalid session token should not fall back to header user");

  await expectStatus("/api/cga/auth/login", {
    method: "POST",
    body: { user_id: "u-api", password: "wrong-password" }
  }, 401, "wrong password should be blocked");

  const groupsResult = await expectOk("/api/cga/groups", { userId: "u-api" }, "groups endpoint failed");
  const groups = groupsResult.payload;
  if (!groups.groups?.some((group) => group.id === "g-u-api")) fail("groups endpoint did not return persisted signup group");

  const joinRequest = await expectStatus("/api/cga/groups/join-requests", {
    method: "POST",
    userId: "u-api",
    body: {
      id: "jr-api-support",
      group_id: "g-support",
      requested_role: "builder"
    }
  }, 202, "join request endpoint failed");
  if (joinRequest.request?.status !== "pending") fail("join request endpoint did not create pending request");

  await expectStatus("/api/cga/groups/join-requests/jr-api-support/approve", {
    method: "POST",
    userId: "u-builder"
  }, 403, "unauthorized join approval should be blocked");

  const approvedJoinResult = await expectOk("/api/cga/groups/join-requests/jr-api-support/approve", {
    method: "POST",
    userId: "u-group-admin"
  }, "authorized join approval failed");
  const approvedJoin = approvedJoinResult.payload;
  if (approvedJoin.request?.status !== "approved") fail("join request was not approved");

  const joinedMeResult = await expectOk("/api/cga/auth/me", { userId: "u-api" }, "me after join failed");
  const joinedMe = joinedMeResult.payload;
  if (!joinedMe.memberships?.some((item) => item.group_id === "g-support" && item.role === "builder")) fail("approved join did not create group membership");

  await expectStatus("/api/cga/groups", {
    method: "POST",
    userId: "u-api",
    body: { group_id: "g-forbidden", name: "Forbidden Group" }
  }, 403, "non-admin group create should be blocked");

  const createdGroup = await expectStatus("/api/cga/groups", {
    method: "POST",
    userId: "admin",
    body: { group_id: "g-admin-api", name: "Admin API Group" }
  }, 201, "admin group create failed");
  if (createdGroup.group?.id !== "g-admin-api") fail("admin group create did not return new group");

  const adminRequest = await expectStatus("/api/cga/admin/permission-requests", {
    method: "POST",
    userId: "u-api",
    body: {
      id: "ar-api-admin",
      group_id: "g-support",
      requested_role: "group_admin"
    }
  }, 202, "admin permission request failed");
  if (adminRequest.request?.status !== "pending") fail("admin permission request did not create pending request");

  await expectStatus("/api/cga/admin/permission-requests/ar-api-admin/approve", {
    method: "POST",
    userId: "u-group-admin"
  }, 403, "group admin should not approve admin permission request");

  const approvedAdminResult = await expectOk("/api/cga/admin/permission-requests/ar-api-admin/approve", {
    method: "POST",
    userId: "admin"
  }, "system admin approval failed");
  const approvedAdmin = approvedAdminResult.payload;
  if (approvedAdmin.request?.status !== "approved") fail("admin permission request was not approved");

  const logoutResult = await expectOk("/api/cga/auth/logout", {
    method: "POST",
    userId: "admin",
    sessionToken: login.session_token
  }, "logout endpoint failed");
  if (logoutResult.payload.status !== "logged_out") fail("logout endpoint did not return logged_out");
  if (!logoutResult.setCookie.includes("Max-Age=0")) fail("logout endpoint did not clear session cookie");

  const accessStateFile = join(dataDir, "access-state.json");
  if (!existsSync(accessStateFile)) fail("access state file was not created");
  const stored = JSON.parse(readFileSync(accessStateFile, "utf8"));
  if (!stored.users?.some((user) => user.id === "u-api")) fail("access state file did not persist signup user");
  if (!stored.groups?.some((group) => group.id === "g-admin-api")) fail("access state file did not persist created group");
  if (!stored.adminRequests?.some((request) => request.id === "ar-api-admin" && request.status === "approved")) fail("access state file did not persist approved admin request");

  const authCredentialsFile = join(dataDir, "auth-credentials.json");
  if (!existsSync(authCredentialsFile)) fail("auth credentials file was not created");
  const storedCredentialText = readFileSync(authCredentialsFile, "utf8");
  if (storedCredentialText.includes("api-pass-1")) fail("auth credentials file stores a raw password");
  const storedCredentials = JSON.parse(storedCredentialText);
  if (!storedCredentials.users?.["u-api"]?.hash) fail("auth credentials file did not persist password hash");
  const authSessionsFile = join(dataDir, "auth-sessions.json");
  if (!existsSync(authSessionsFile)) fail("auth sessions file was not created");
  const storedSessions = JSON.parse(readFileSync(authSessionsFile, "utf8"));
  if (storedSessions.sessions?.[login.session_token]) fail("logout did not remove the session token");

  console.log("OK auth and group API endpoints passed");
}

main()
  .catch((error) => fail(error instanceof Error ? error.message : "auth API check failed"))
  .finally(() => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });
