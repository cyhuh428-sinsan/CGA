(function () {
  const SESSION_KEY = "cga-studio-session-token-v2";
  const LOGIN_ID_KEY = "cga-studio-login-id";
  const LOCALE_KEY = "cga.studio.locale";
  const LAST_SCREEN_KEY = "cga-studio-last-screen";
  const DEFAULT_POST_LOGIN_SCREEN = "workspace-home";
  const copy = {
    en: {
      eyebrow: "CGA STUDIO",
      loginId: "user-id",
      password: "password",
      login: "Login",
      remember: "Remember ID",
      noAccount: "No account yet?",
      signup: "Signup",
      failed: "User ID or password is incorrect.",
      required: "Enter user ID and password."
    },
    ko: {
      eyebrow: "CGA STUDIO",
      loginId: "아이디",
      password: "비밀번호",
      login: "로그인",
      remember: "아이디 저장",
      noAccount: "아직 계정이 없으신가요?",
      signup: "회원가입",
      failed: "아이디 또는 비밀번호가 올바르지 않습니다.",
      required: "아이디와 비밀번호를 입력하세요."
    },
    ja: {
      eyebrow: "CGA STUDIO",
      loginId: "ユーザーID",
      password: "パスワード",
      login: "ログイン",
      remember: "IDを保存",
      noAccount: "まだアカウントがありませんか？",
      signup: "登録",
      failed: "ユーザーIDまたはパスワードが正しくありません。",
      required: "ユーザーIDとパスワードを入力してください。"
    },
    "zh-CN": {
      eyebrow: "CGA STUDIO",
      loginId: "用户ID",
      password: "密码",
      login: "登录",
      remember: "记住ID",
      noAccount: "还没有账号？",
      signup: "注册",
      failed: "用户ID或密码不正确。",
      required: "请输入用户ID和密码。"
    },
    vi: {
      eyebrow: "CGA STUDIO",
      loginId: "ID người dùng",
      password: "mật khẩu",
      login: "Đăng nhập",
      remember: "Ghi nhớ ID",
      noAccount: "Chưa có tài khoản?",
      signup: "Đăng ký",
      failed: "ID người dùng hoặc mật khẩu không đúng.",
      required: "Nhập ID người dùng và mật khẩu."
    },
    de: {
      eyebrow: "CGA STUDIO",
      loginId: "Benutzer-ID",
      password: "Passwort",
      login: "Anmelden",
      remember: "ID speichern",
      noAccount: "Noch kein Konto?",
      signup: "Registrierung",
      failed: "Benutzer-ID oder Passwort ist falsch.",
      required: "Benutzer-ID und Passwort eingeben."
    },
    fr: {
      eyebrow: "CGA STUDIO",
      loginId: "ID utilisateur",
      password: "mot de passe",
      login: "Connexion",
      remember: "Mémoriser l'ID",
      noAccount: "Pas encore de compte ?",
      signup: "Inscription",
      failed: "L'ID utilisateur ou le mot de passe est incorrect.",
      required: "Saisissez l'ID utilisateur et le mot de passe."
    }
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function locale() {
    return $("[data-entry-locale]")?.value || "ko";
  }

  function text() {
    return copy[locale()] || copy.ko;
  }

  function showMessage(message) {
    const node = $("[data-entry-auth-message]");
    if (!node) return;
    node.hidden = false;
    node.innerHTML = `<strong>${message}</strong>`;
  }

  function clearMessage() {
    const node = $("[data-entry-auth-message]");
    if (!node) return;
    node.hidden = true;
    node.textContent = "";
  }

  function enterAuthenticatedShell() {
    const shell = $(".app-shell");
    const topbar = $(".topbar");
    const workflow = $(".workflow");
    const loginEntry = $("[data-login-entry]");
    if (shell) shell.classList.remove("unauthenticated");
    if (topbar) topbar.hidden = false;
    if (workflow) workflow.hidden = false;
    if (loginEntry) loginEntry.hidden = true;
    const nextScreen = DEFAULT_POST_LOGIN_SCREEN;
    localStorage.setItem(LAST_SCREEN_KEY, nextScreen);
    window.history.replaceState(null, "", `#${nextScreen}`);
    window.dispatchEvent(new CustomEvent("cga:entry-login-success"));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  function enterLoginShell() {
    const shell = $(".app-shell");
    const topbar = $(".topbar");
    const workflow = $(".workflow");
    const loginEntry = $("[data-login-entry]");
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_SCREEN_KEY);
    if (shell) shell.classList.add("unauthenticated");
    if (topbar) topbar.hidden = true;
    if (workflow) workflow.hidden = true;
    if (loginEntry) loginEntry.hidden = false;
    window.history.replaceState(null, "", window.location.pathname || "/");
  }

  async function runTopLogout() {
    try {
      await fetch("/api/cga/auth/logout", { method: "POST" });
    } catch {
    }
    enterLoginShell();
  }

  function applyEntryLocale() {
    const c = text();
    const eyebrow = $(".brand-wordmark span");
    const loginId = $("[data-entry-login-id]");
    const password = $("[data-entry-login-password]");
    const loginButton = $("[data-entry-login-submit]");
    const remember = $(".login-meta .check-row span");
    const noAccount = $(".login-signup-row span");
    const signup = $("[data-entry-open-signup]");
    if (eyebrow) eyebrow.textContent = c.eyebrow;
    if (loginId) loginId.placeholder = c.loginId;
    if (password) password.placeholder = c.password;
    if (loginButton) loginButton.textContent = c.login;
    if (remember) remember.textContent = c.remember;
    if (noAccount) noAccount.textContent = c.noAccount;
    if (signup) signup.textContent = c.signup;
  }

  async function runEntryLogin() {
    const userId = $("[data-entry-login-id]")?.value?.trim();
    const password = $("[data-entry-login-password]")?.value || "";
    const remember = $("[data-entry-remember-id]")?.checked;
    const loginButton = $("[data-entry-login-submit]");
    const c = text();
    if (!userId || !password) {
      showMessage(c.required);
      return;
    }
    clearMessage();
    if (loginButton) loginButton.disabled = true;
    try {
      const response = await fetch("/api/cga/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ user_id: userId, password })
      });
      if (!response.ok) {
        showMessage(c.failed);
        return;
      }
      const session = await response.json();
      if (session.session_token) localStorage.setItem(SESSION_KEY, session.session_token);
      localStorage.setItem(LOCALE_KEY, locale());
      if (remember) localStorage.setItem(LOGIN_ID_KEY, userId);
      if (!remember) localStorage.removeItem(LOGIN_ID_KEY);
      enterAuthenticatedShell();
    } catch {
      showMessage(c.failed);
    } finally {
      if (loginButton) loginButton.disabled = false;
    }
  }

  function bootEntryAuth() {
    const loginId = $("[data-entry-login-id]");
    const loginButton = $("[data-entry-login-submit]");
    const password = $("[data-entry-login-password]");
    const localeSelect = $("[data-entry-locale]");
    const logoutButton = $("[data-top-logout-submit]");
    if (loginId && !loginId.value) loginId.value = localStorage.getItem(LOGIN_ID_KEY) || "";
    applyEntryLocale();
    if (loginButton && loginButton.dataset.bound !== "true") {
      loginButton.dataset.bound = "true";
      loginButton.addEventListener("click", runEntryLogin);
    }
    if (password && password.dataset.bound !== "true") {
      password.dataset.bound = "true";
      password.addEventListener("keydown", (event) => {
        if (event.key === "Enter") runEntryLogin();
      });
    }
    if (logoutButton && logoutButton.dataset.bound !== "true") {
      logoutButton.dataset.bound = "true";
      logoutButton.addEventListener("click", runTopLogout);
    }
    localeSelect?.addEventListener("change", applyEntryLocale);
  }

  document.addEventListener("DOMContentLoaded", bootEntryAuth);
})();
