"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { apiRequest } from "@/lib/api";
import { fetchAdminLicense, type AdminLicenseStatusResponse } from "@/lib/admin-api";
import {
  clearAuthSession,
  loadAuthSession,
  loadLastBotScreen,
  refreshAuthSessionCookies,
  hasAdminOperationsRole,
  hasAdminRole,
  hasApiRole,
  roleLabel,
  type AuthSession,
} from "@/lib/auth";
import { prefetchStudioBots } from "@/lib/studio-bots-api";
import { useI18n } from "@/components/language-provider";
import { normalizeSupportedLanguage, SUPPORTED_LANGUAGES } from "@/lib/language";
import { SHELL_NAVIGATION } from "@/lib/i18n/shell-navigation";
import { ADMIN_NAVIGATION_CATALOGS, buildAdminNavigationGroups } from "@/lib/i18n/admin-navigation";

const botVersionPathPattern = /^\/studio\/bots\/([^/]+)\/versions\/([^/]+)/;
const botSettingsPathPattern = /^\/studio\/bots\/([^/]+)\/settings(?:\/.*)?$/;

type PrimaryPanelId = "operations" | "build" | "api" | "admin";

type GettingStartedMode = "explore" | "create" | "sample";

const gettingStartedSlides = [
  {
    title: "쉽고 빠르게 AI 챗봇을 만들 수 있습니다.",
    description: "캔버스에 대화 흐름을 설계하는 직관적이고 쉬운 대화 설계툴을 제공하여 누구나 쉽고 빠르게 챗봇을 만들 수 있습니다. 또한 설계한 대화 시나리오는 바로 테스트하며 수정할 수 있습니다.",
    variant: "design",
  },
  {
    title: "Enterprise 전용 챗봇 구축에 최적화되어 있습니다.",
    description: "Bot Station과 API Store를 통해 사내 시스템과 RPA 솔루션을 연계할 수 있으며, 다양한 메신저와 보이스 채널 연계를 통해 업무의 E2E 자동화를 구현할 수 있습니다.",
    variant: "enterprise",
  },
  {
    title: "운영 데이터를 바탕으로 챗봇을 지속 개선할 수 있습니다.",
    description: "분석·평가·대화 이력을 확인하고 실패 발화를 다시 학습 데이터로 반영하여 챗봇 품질을 반복적으로 개선할 수 있습니다.",
    variant: "improve",
  },
] as const;

type BuildNavigationItem = {
  label: string;
  href: string;
  active: boolean;
};

type BuildNavigationGroup = {
  code: string;
  title: string;
  href?: string;
  active?: boolean;
  items?: BuildNavigationItem[];
};

export function StudioRail() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, setLanguage, t } = useI18n();
  const navigation = SHELL_NAVIGATION[language];
  const adminGroups = useMemo(
    () => buildAdminNavigationGroups(ADMIN_NAVIGATION_CATALOGS[language]),
    [language],
  );
  const [session, setSession] = useState<AuthSession | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<PrimaryPanelId | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [gettingStartedOpen, setGettingStartedOpen] = useState(false);
  const [gettingStartedSlide, setGettingStartedSlide] = useState(0);
  const [gettingStartedMode, setGettingStartedMode] = useState<GettingStartedMode>("explore");
  const [hideGettingStarted, setHideGettingStarted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<AdminLicenseStatusResponse | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const helpMenuRef = useRef<HTMLDivElement | null>(null);

  const currentGettingStartedSlide = gettingStartedSlides[gettingStartedSlide];

  useEffect(() => {
    const currentSession = loadAuthSession();
    setSession(currentSession);
    refreshAuthSessionCookies();
    if (currentSession) {
      prefetchStudioBots(currentSession.access_token);
      fetchAdminLicense(currentSession.access_token)
        .then(setLicenseStatus)
        .catch(() => setLicenseStatus(null));
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!helpOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!helpMenuRef.current?.contains(event.target as Node)) {
        setHelpOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [helpOpen]);

  useEffect(() => {
    if (!gettingStartedOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setGettingStartedOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [gettingStartedOpen]);

  useEffect(() => {
    setActivePanel(null);
  }, [pathname]);

  async function handleLogout() {
    if (!session || isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      const lastBotScreen = loadLastBotScreen(session.user.login_id);
      await apiRequest<{ message: string }>(
        "/api/v1/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({
            last_bot_screen: lastBotScreen,
          }),
        },
        session.access_token,
      );
    } catch {
      // 서버 요청이 실패해도 로컬 세션은 정리한다.
    } finally {
      clearAuthSession();
      setSession(null);
      setMenuOpen(false);
      setIsLoggingOut(false);
      router.push("/login");
      router.refresh();
    }
  }

  function openGettingStarted(slide = 0) {
    setHelpOpen(false);
    setGettingStartedSlide(slide);
    setGettingStartedMode("explore");
    setHideGettingStarted(window.localStorage.getItem("cga.getting-started.hidden") === "true");
    setGettingStartedOpen(true);
  }

  function closeGettingStarted(savePreference = false) {
    if (savePreference) {
      window.localStorage.setItem("cga.getting-started.hidden", "true");
    }
    setGettingStartedOpen(false);
  }

  function startGettingStarted() {
    closeGettingStarted(hideGettingStarted);
    if (gettingStartedMode === "create") {
      router.push("/studio/bots/new");
    } else if (gettingStartedMode === "sample") {
      router.push("/studio/bots");
    }
  }

  const accountInitial = session?.user.name?.trim().charAt(0) || session?.user.login_id?.trim().charAt(0) || "A";
  const roles = session?.user.roles ?? [];
  const roleSummary = session ? roles.map(roleLabel).join(", ") : "";
  const canUseApi = hasApiRole(roles);
  const canUseAdmin = hasAdminOperationsRole(roles);
  const groupSummary = session?.user.group_name ?? "-";
  const organizationSummary = session?.user.organization_name ?? "기본 서버";
  const lastBotScreen = session ? loadLastBotScreen(session.user.login_id) : null;
  const botVersionMatch = pathname.match(botVersionPathPattern);
  const botSettingsMatch = pathname.match(botSettingsPathPattern);
  const lastBotVersionMatch = lastBotScreen?.match(botVersionPathPattern);
  const routeVersionHint = searchParams.get("version")?.trim() || "";
  const currentBotId = botVersionMatch?.[1] ?? botSettingsMatch?.[1] ?? lastBotVersionMatch?.[1] ?? "";
  const currentVersionId =
    botVersionMatch?.[2] ||
    (botSettingsMatch ? routeVersionHint : "") ||
    (lastBotVersionMatch?.[1] === currentBotId ? lastBotVersionMatch[2] : "") ||
    "";
  const hasBotContext = Boolean(currentBotId);
  const resolvedVersionId = currentVersionId || "v1";
  const currentBotBasePath = hasBotContext ? `/studio/bots/${currentBotId}/versions/${resolvedVersionId}` : "";
  const botContextFallback = "/studio/bots";
  const botWorkspaceHref = hasBotContext ? `${currentBotBasePath}/intents` : botContextFallback;
  const visibleAdminGroups = hasAdminRole(roles)
    ? adminGroups
    : adminGroups.filter((group) => group.key === "status");
  const primaryItems: Array<{ id: PrimaryPanelId; label: string; icon: string }> = [
    { id: "operations", label: t("nav.operations"), icon: "operations" },
    { id: "build", label: t("nav.build"), icon: "build" },
    ...(canUseApi ? [{ id: "api" as const, label: "API", icon: "api" }] : []),
    ...(canUseAdmin ? [{ id: "admin" as const, label: "Admin", icon: "admin" }] : []),
  ];
  const isApiPath = pathname.startsWith("/studio/apis") || pathname.includes("/apis");
  const isDbOperationsDashboardPath = pathname === "/admin/operations-dashboard";
  const isAdminPath = pathname.startsWith("/admin") && !isDbOperationsDashboardPath;
  const isOperationPath =
    isDbOperationsDashboardPath ||
    pathname === "/studio/bots" ||
    pathname === "/studio/workspace" ||
    pathname === "/studio/operations-dashboard" ||
    pathname.startsWith("/studio/hubs") ||
    pathname.includes("/retraining") ||
    pathname.includes("/analysis");
  const activePrimaryId: PrimaryPanelId = isAdminPath
    ? "admin"
    : isApiPath
      ? "api"
      : isOperationPath
        ? "operations"
        : "build";
  const operationLinks = [
    { code: "BM", label: navigation.botManagement, href: "/studio/bots" },
    { code: "BOT", label: navigation.botWorkspace, href: "/studio/workspace" },
    { code: "DB", label: navigation.dbDashboard, href: "/admin/operations-dashboard" },
    { code: "RT", label: navigation.retraining, href: hasBotContext ? `${currentBotBasePath}/retraining` : botContextFallback },
    { code: "AN", label: navigation.analysis, href: hasBotContext ? `${currentBotBasePath}/analysis` : botContextFallback },
  ];
  const botSettingsBasePath = hasBotContext ? `/studio/bots/${currentBotId}/settings` : "";
  const botSettingsVersionQuery = `?version=${resolvedVersionId}`;
  const buildNavigationGroups: BuildNavigationGroup[] = [
    {
      code: "01",
      title: navigation.botCreate,
      href: "/studio/bots/new",
      active: pathname === "/studio/bots/new",
    },
    {
      code: "02",
      title: navigation.botSettings,
      items: [
        { label: navigation.aiModelSettings, path: "", active: pathname === botSettingsBasePath },
        { label: navigation.defaultsSettings, path: "/conversation-defaults", active: pathname.startsWith(`${botSettingsBasePath}/conversation-defaults`) },
        { label: navigation.messageSettings, path: "/messages", active: pathname.startsWith(`${botSettingsBasePath}/messages`) },
        { label: navigation.messengerFeatures, path: "/messenger", active: pathname.startsWith(`${botSettingsBasePath}/messenger`) },
        { label: navigation.blocklistSettings, path: "/blocklist", active: pathname.startsWith(`${botSettingsBasePath}/blocklist`) },
        { label: navigation.ruleSettings, path: "/rules", active: pathname.startsWith(`${botSettingsBasePath}/rules`) },
        { label: navigation.smalltalk, path: "/smalltalk", active: pathname.startsWith(`${botSettingsBasePath}/smalltalk`) },
        { label: navigation.botstation, path: "/botstation", active: pathname.startsWith(`${botSettingsBasePath}/botstation`) },
      ].map((item) => ({
        ...item,
        href: hasBotContext ? `${botSettingsBasePath}${item.path}${botSettingsVersionQuery}` : botContextFallback,
      })),
    },
    {
      code: "03",
      title: navigation.botConfigure,
      href: hasBotContext ? `${currentBotBasePath}/configure` : botContextFallback,
      active: pathname.includes("/configure"),
    },
    {
      code: "04",
      title: navigation.botBuild,
      items: [
        { label: navigation.intentManagement, href: botWorkspaceHref, active: pathname.includes("/intents") },
        { label: navigation.entityManagement, href: hasBotContext ? `${currentBotBasePath}/entities` : botContextFallback, active: pathname.includes("/entities") },
        { label: navigation.dictionaryManagement, href: hasBotContext ? `${currentBotBasePath}/dictionary` : botContextFallback, active: pathname.includes("/dictionary") },
      ],
    },
    {
      code: "05",
      title: navigation.botTest,
      href: hasBotContext ? `${currentBotBasePath}/simulator` : botContextFallback,
      active: pathname.includes("/simulator"),
    },
    {
      code: "06",
      title: navigation.botEvaluation,
      href: hasBotContext ? `${currentBotBasePath}/evaluation` : botContextFallback,
      active: pathname.includes("/evaluation"),
    },
  ];
  const panelTitle =
    activePanel === "operations" ? navigation.operationsPanel : activePanel === "build" ? navigation.buildPanel : navigation.systemPanel;
  const panelLinks = activePanel === "operations" ? operationLinks : [];
  const currentLicense = licenseStatus?.license ?? null;
  const licenseProduct = currentLicense?.product?.trim() || "라이선스 정보 없음";
  const licenseId = currentLicense?.license_id?.trim() || "-";
  const licenseExpiresAt = currentLicense?.expires_at?.trim() || "-";

  function handleLanguageChange(value: string) {
    setLanguage(normalizeSupportedLanguage(value));
  }

  return (
    <aside className="studio-rail">
      <nav className="studio-rail__menu" aria-label="스튜디오 주요 메뉴">
        {primaryItems.map((item) => {
          const isActive = activePrimaryId === item.id;

          return (
            <button
              type="button"
              key={item.id}
              className={`studio-rail__item${isActive ? " is-active" : ""}`}
              aria-label={item.label}
              title={item.label}
              aria-expanded={item.id === "api" ? undefined : activePanel === item.id}
              onClick={() => {
                if (item.id === "api") {
                  setActivePanel(null);
                  router.push("/studio/apis");
                  return;
                }

                setActivePanel((current) => (current === item.id ? null : item.id));
              }}
            >
              <span className={`studio-rail__glyph studio-rail__glyph--${item.icon}`} aria-hidden="true">
                <span className={`studio-rail__icon studio-rail__icon--${item.icon}`} />
              </span>
              <span className="studio-rail__label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {activePanel ? (
        <section
          className={`studio-rail__context-panel${
            activePanel === "admin"
              ? " studio-rail__context-panel--admin"
              : activePanel === "build"
                ? " studio-rail__context-panel--build"
                : ""
          }`}
          aria-label={`${panelTitle} 메뉴`}
        >
          <header>
            <strong>{panelTitle}</strong>
            <button type="button" onClick={() => setActivePanel(null)} aria-label="메뉴 닫기">×</button>
          </header>
          {activePanel === "build" ? (
            <div className="studio-rail__build-groups">
              {buildNavigationGroups.map((group) => {
                const groupActive = Boolean(group.active || group.items?.some((item) => item.active));

                return (
                  <section key={`${group.code}:${group.title}`} className={`studio-rail__build-group${groupActive ? " is-active" : ""}`}>
                    {group.href ? (
                      <Link
                        href={group.href}
                        className={`studio-rail__build-heading${group.active ? " is-active" : ""}`}
                        onClick={() => setActivePanel(null)}
                      >
                        <span>{group.code}</span>
                        <strong>{group.title}</strong>
                      </Link>
                    ) : (
                      <div className="studio-rail__build-heading">
                        <span>{group.code}</span>
                        <strong>{group.title}</strong>
                      </div>
                    )}
                    {group.items ? (
                      <nav aria-label={group.title}>
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={item.active ? "is-active" : ""}
                            onClick={() => setActivePanel(null)}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </nav>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : activePanel === "admin" ? (
            <div className="studio-rail__admin-groups">
              {visibleAdminGroups.map((group) => (
                <section key={group.title} className="studio-rail__admin-group">
                  <h3>{group.title}</h3>
                  <nav aria-label={group.title}>
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setActivePanel(null)}>
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                </section>
              ))}
            </div>
          ) : (
            <nav>
              {panelLinks.map((item, index) => (
                <Link key={`${item.code}:${item.href}:${index}`} href={item.href} onClick={() => setActivePanel(null)}>
                  <span>{item.code}</span>
                  <strong>{item.label}</strong>
                </Link>
              ))}
            </nav>
          )}
        </section>
      ) : null}

      <div className="studio-rail__menu studio-rail__menu--bottom" ref={helpMenuRef}>
        <button
          type="button"
          className={`studio-rail__help-button${helpOpen ? " is-active" : ""}`}
          aria-label={t("nav.help")}
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen((current) => !current)}
        >
          ?
        </button>
        {helpOpen ? (
          <div className="studio-rail__help-popover">
            <section className="studio-rail__help-section">
              <strong>About CGA Studio</strong>
              <dl className="studio-rail__help-meta">
                <div>
                  <dt>{t("help.license")}</dt>
                  <dd>
                    <b>{licenseProduct}</b>
                    <span>{licenseId} ({licenseExpiresAt} {t("help.expires")})</span>
                  </dd>
                </div>
                <div>
                  <dt>{t("help.version")}</dt>
                  <dd>v1.1</dd>
                </div>
              </dl>
            </section>
            <section className="studio-rail__help-section studio-rail__help-section--links">
              <button
                type="button"
                className="studio-rail__help-title"
                aria-haspopup="dialog"
                onClick={() => openGettingStarted()}
              >
                {t("gettingStarted.title")}
              </button>
              <a href="/manuals/cga-user-manual.pdf" target="_blank" rel="noreferrer">
                {t("help.userManual")}
              </a>
              <a href="/manuals/cga-nlu-guide.pdf" target="_blank" rel="noreferrer">
                {t("help.nluGuide")}
              </a>
            </section>
          </div>
        ) : null}
      </div>

      {gettingStartedOpen ? (
        <div
          className="studio-getting-started__backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeGettingStarted(hideGettingStarted);
            }
          }}
        >
          <section
            className="studio-getting-started"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cga-getting-started-title"
          >
            <header className="studio-getting-started__header">
              <strong id="cga-getting-started-title">{t("gettingStarted.title")}</strong>
              <button type="button" aria-label={`${t("gettingStarted.title")} ${t("common.close")}`} onClick={() => closeGettingStarted(hideGettingStarted)}>
                ×
              </button>
            </header>

            <div className={`studio-getting-started__hero is-${currentGettingStartedSlide.variant}`}>
              <div className="studio-getting-started__illustration" aria-hidden="true">
                <div className="studio-getting-started__bot">
                  <span className="studio-getting-started__bot-eye" />
                  <span className="studio-getting-started__bot-eye" />
                </div>
                <div className="studio-getting-started__cards">
                  <span>Intent</span>
                  <span>Bot Station</span>
                  <span>Analytics</span>
                </div>
              </div>
              <div className="studio-getting-started__copy">
                <h2>{currentGettingStartedSlide.title}</h2>
                <p>{currentGettingStartedSlide.description}</p>
              </div>
              <button
                type="button"
                className="studio-getting-started__next"
                aria-label="다음 소개 보기"
                onClick={() => setGettingStartedSlide((current) => (current + 1) % gettingStartedSlides.length)}
              >
                ›
              </button>
              <div className="studio-getting-started__dots" aria-label="소개 슬라이드 선택">
                {gettingStartedSlides.map((slide, index) => (
                  <button
                    key={slide.variant}
                    type="button"
                    className={index === gettingStartedSlide ? "is-active" : ""}
                    aria-label={`${index + 1}번째 소개 보기`}
                    aria-current={index === gettingStartedSlide ? "step" : undefined}
                    onClick={() => setGettingStartedSlide(index)}
                  />
                ))}
              </div>
            </div>

            <div className="studio-getting-started__body">
              <h3>{t("gettingStarted.choose")}</h3>
              <div className="studio-getting-started__modes" role="radiogroup" aria-label="Getting Started 체험 방법">
                <label className={gettingStartedMode === "explore" ? "is-selected" : ""}>
                  <input type="radio" name="getting-started-mode" value="explore" checked={gettingStartedMode === "explore"} onChange={() => setGettingStartedMode("explore")} />
                  <span>{t("gettingStarted.explore")}</span>
                </label>
                <label className={gettingStartedMode === "create" ? "is-selected" : ""}>
                  <input type="radio" name="getting-started-mode" value="create" checked={gettingStartedMode === "create"} onChange={() => setGettingStartedMode("create")} />
                  <span>{t("gettingStarted.create")}</span>
                </label>
                <label className={gettingStartedMode === "sample" ? "is-selected" : ""}>
                  <input type="radio" name="getting-started-mode" value="sample" checked={gettingStartedMode === "sample"} onChange={() => setGettingStartedMode("sample")} />
                  <span>{t("gettingStarted.sample")}</span>
                </label>
              </div>
              <div className="studio-getting-started__actions">
                <button type="button" className="studio-getting-started__secondary" onClick={() => closeGettingStarted(hideGettingStarted)}>
                  {t("gettingStarted.freeStart")}
                </button>
                <button type="button" className="studio-getting-started__primary" onClick={startGettingStarted}>
                  {t("gettingStarted.start")}
                </button>
              </div>
              <label className="studio-getting-started__remember">
                <input type="checkbox" checked={hideGettingStarted} onChange={(event) => setHideGettingStarted(event.target.checked)} />
                <span>{t("gettingStarted.hide")}</span>
              </label>
            </div>
          </section>
        </div>
      ) : null}

      <div className="studio-rail__account" ref={accountMenuRef}>
        <button
          type="button"
          className={`studio-rail__account-button${menuOpen ? " is-active" : ""}`}
          aria-label={t("nav.userMenu")}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span>{accountInitial}</span>
        </button>

        {menuOpen ? (
          <div className="studio-rail__account-popover">
            <button
              type="button"
              className="studio-rail__account-close"
              onClick={() => setMenuOpen(false)}
              aria-label="사용자 메뉴 닫기"
            >
              ×
            </button>
            {session ? (
              <>
                <div className="studio-rail__account-header">
                  <div className="studio-rail__account-avatar">{accountInitial}</div>
                  <div className="studio-rail__account-meta">
                    <strong>
                      {session.user.name} / {session.user.login_id}
                    </strong>
                    <span>
                      {roleSummary || "권한 없음"} / {groupSummary} / {organizationSummary}
                    </span>
                  </div>
                </div>

                <div className="studio-rail__account-actions">
                  <Link
                    href="/me/profile"
                    className="studio-rail__account-link"
                    onClick={() => setMenuOpen(false)}
                  >
                    {navigation.editProfile}
                  </Link>

                  <select
                    className="studio-rail__language-select"
                    value={language}
                    onChange={(event) => handleLanguageChange(event.target.value)}
                    aria-label={navigation.userLanguage}
                  >
                    {SUPPORTED_LANGUAGES.map((option) => (
                      <option key={option.code} value={option.code}>{option.label}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="studio-rail__account-logout"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? t("common.loggingOut") : t("common.logout")}
                  </button>
                </div>
              </>
            ) : (
              <Link href="/login" className="studio-rail__account-link" onClick={() => setMenuOpen(false)}>
                {t("common.login")}
              </Link>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
