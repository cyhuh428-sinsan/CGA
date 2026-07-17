(function () {
  const SESSION_KEY = "cga-studio-session-token-v2";
  const LOGIN_ID_KEY = "cga-studio-login-id";
  const LOCALE_KEY = "cga.studio.locale";
  const LAST_SCREEN_KEY = "cga-studio-last-screen";
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
    document.querySelectorAll("[data-entry-auth-message]").forEach((node) => {
      node.hidden = false;
      node.innerHTML = `<strong>${message}</strong>`;
    });
  }

  function clearMessage() {
    document.querySelectorAll("[data-entry-auth-message]").forEach((node) => {
      node.hidden = true;
      node.textContent = "";
    });
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
  async function runFallbackLogin() {
    const loginId = $("[data-entry-login-id]")?.value?.trim() || "";
    const password = $("[data-entry-login-password]")?.value || "";
    const remember = $("[data-entry-remember-id]");
    const button = $("[data-entry-login-submit]");
    if (!loginId || !password) {
      showMessage("아이디와 비밀번호를 입력하세요.");
      return;
    }
    try {
      if (button) button.disabled = true;
      showMessage("로그인 처리 중입니다.");
      const response = await fetch("/api/cga/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ user_id: loginId, password })
      });
      const payload = await response.json().catch(() => ({}));
      // The Studio API authenticates with an HttpOnly session cookie. Older
      // development responses also contained a token, so accept either form.
      if (!response.ok || (!payload?.session_token && !payload?.user)) {
        showMessage(payload?.fallback_message || payload?.message || "로그인에 실패했습니다.");
        return;
      }
      if (payload.session_token) localStorage.setItem(SESSION_KEY, payload.session_token);
      else localStorage.removeItem(SESSION_KEY);
      if (remember?.checked) localStorage.setItem(LOGIN_ID_KEY, loginId);
      if (remember && !remember.checked) localStorage.removeItem(LOGIN_ID_KEY);
      clearMessage();
      if (!window.location.hash || window.location.hash === "#") {
        window.history.replaceState(null, "", "#workspace-home");
      }
      const shell = document.querySelector(".app-shell");
      const topbar = document.querySelector(".topbar");
      const workflow = document.querySelector(".workflow");
      const loginEntry = document.querySelector("[data-login-entry]");
      shell?.classList.remove("unauthenticated");
      if (topbar) topbar.hidden = false;
      if (workflow) workflow.hidden = false;
      if (loginEntry) loginEntry.hidden = true;
      window.dispatchEvent(new CustomEvent("cga:entry-login-success"));
    } catch {
      showMessage("로그인 요청을 처리할 수 없습니다.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function bindFallbackLoginIfNeeded() {
    const loginButton = $("[data-entry-login-submit]");
    if (!loginButton || loginButton.dataset.entryFallbackBound === "true") return;
    loginButton.dataset.entryFallbackBound = "true";
    loginButton.addEventListener("click", (event) => { event.preventDefault(); event.stopImmediatePropagation(); runFallbackLogin(); }, true);
    $("[data-entry-login-password]")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") runFallbackLogin();
    });
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

  function bootEntryAuth() {
    const loginId = $("[data-entry-login-id]");
    const localeSelect = $("[data-entry-locale]");
    const logoutButton = $("[data-top-logout-submit]");
    if (loginId && !loginId.value) loginId.value = localStorage.getItem(LOGIN_ID_KEY) || "";
    applyEntryLocale();
    if (logoutButton && logoutButton.dataset.bound !== "true") {
      logoutButton.dataset.bound = "true";
      logoutButton.addEventListener("click", runTopLogout);
    }
    localeSelect?.addEventListener("change", applyEntryLocale);
    // The main module claims the same button during normal startup. If it has
    // not done so, retain this fallback so a usable login is never left inert.
    window.setTimeout(bindFallbackLoginIfNeeded, 0);
  }

  document.addEventListener("DOMContentLoaded", bootEntryAuth);
})();
