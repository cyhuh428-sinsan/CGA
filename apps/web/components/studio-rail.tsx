"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

const botVersionPathPattern = /^\/studio\/bots\/([^/]+)\/versions\/([^/]+)/;
const botSettingsPathPattern = /^\/studio\/bots\/([^/]+)\/settings(?:\/.*)?$/;

type PrimaryPanelId = "operations" | "build" | "api" | "admin";

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

const adminNavigationGroups = [
  {
    title: "사용자 관리",
    items: [
      { href: "/admin/users", label: "사용자 관리" },
      { href: "/admin/login-history", label: "로그인 이력" },
      { href: "/admin/groups", label: "그룹 관리" },
    ],
  },
  {
    title: "현황 조회",
    items: [
      { href: "/admin/operations-dashboard", label: "운영 대시보드" },
      { href: "/admin/audit-logs", label: "운영/시스템 로그 조회" },
      { href: "/admin/bot-status", label: "봇 현황 조회" },
      { href: "/admin/training-history", label: "학습 이력 조회" },
      { href: "/admin/conversations", label: "대화 이력 조회" },
      { href: "/admin/api-call-history", label: "API 호출 이력 조회" },
      { href: "/admin/queue-history", label: "Queue 이력 조회" },
      { href: "/admin/intent-feedback", label: "의도별 피드백 조회" },
    ],
  },
  {
    title: "대화 관리",
    items: [
      { href: "/admin/common-variables", label: "공통 변수 관리하기" },
      { href: "/admin/default-messages", label: "기본 메시지 관리" },
    ],
  },
  {
    title: "시스템 연계",
    items: [
      { href: "/admin/channels", label: "채널 관리" },
      { href: "/admin/botstation-status", label: "봇스테이션 연계 현황" },
    ],
  },
  {
    title: "기타 관리",
    items: [
      { href: "/admin/templates", label: "템플릿 목록" },
      { href: "/admin/license", label: "라이선스 조회" },
    ],
  },
];

export function StudioRail() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<PrimaryPanelId | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [language, setLanguage] = useState("ko");
  const [licenseStatus, setLicenseStatus] = useState<AdminLicenseStatusResponse | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const helpMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const currentSession = loadAuthSession();
    setSession(currentSession);
    setLanguage(window.localStorage.getItem("aidot.language") ?? "ko");
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
    ? adminNavigationGroups
    : adminNavigationGroups.filter((group) => group.title === "현황 조회");
  const primaryItems: Array<{ id: PrimaryPanelId; label: string; icon: string }> = [
    { id: "operations", label: "운영", icon: "operations" },
    { id: "build", label: "제작", icon: "build" },
    ...(canUseApi ? [{ id: "api" as const, label: "API", icon: "api" }] : []),
    ...(canUseAdmin ? [{ id: "admin" as const, label: "Admin", icon: "admin" }] : []),
  ];
  const isApiPath = pathname.startsWith("/studio/apis") || pathname.includes("/apis");
  const isAdminPath = pathname.startsWith("/admin");
  const isOperationPath =
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
    { code: "BM", label: "봇 관리", href: "/studio/bots" },
    { code: "BOT", label: "봇 작업공간", href: "/studio/workspace" },
    { code: "DB", label: "운영 대시보드", href: "/studio/operations-dashboard" },
    { code: "RT", label: "재학습", href: hasBotContext ? `${currentBotBasePath}/retraining` : botContextFallback },
    { code: "AN", label: "분석", href: hasBotContext ? `${currentBotBasePath}/analysis` : botContextFallback },
  ];
  const botSettingsBasePath = hasBotContext ? `/studio/bots/${currentBotId}/settings` : "";
  const botSettingsVersionQuery = `?version=${resolvedVersionId}`;
  const buildNavigationGroups: BuildNavigationGroup[] = [
    {
      code: "01",
      title: "봇 생성",
      href: "/studio/bots/new",
      active: pathname === "/studio/bots/new",
    },
    {
      code: "02",
      title: "봇 설정",
      items: [
        { label: "AI 모델 설정", path: "", active: pathname === botSettingsBasePath },
        { label: "기본값 설정", path: "/conversation-defaults", active: pathname.startsWith(`${botSettingsBasePath}/conversation-defaults`) },
        { label: "메시지 설정", path: "/messages", active: pathname.startsWith(`${botSettingsBasePath}/messages`) },
        { label: "메신저 편의 기능", path: "/messenger", active: pathname.startsWith(`${botSettingsBasePath}/messenger`) },
        { label: "제외/무시 목록 설정", path: "/blocklist", active: pathname.startsWith(`${botSettingsBasePath}/blocklist`) },
        { label: "룰 설정", path: "/rules", active: pathname.startsWith(`${botSettingsBasePath}/rules`) },
        { label: "스몰토크", path: "/smalltalk", active: pathname.startsWith(`${botSettingsBasePath}/smalltalk`) },
        { label: "봇스테이션", path: "/botstation", active: pathname.startsWith(`${botSettingsBasePath}/botstation`) },
      ].map((item) => ({
        ...item,
        href: hasBotContext ? `${botSettingsBasePath}${item.path}${botSettingsVersionQuery}` : botContextFallback,
      })),
    },
    {
      code: "03",
      title: "봇 구성",
      href: hasBotContext ? `${currentBotBasePath}/configure` : botContextFallback,
      active: pathname.includes("/configure"),
    },
    {
      code: "04",
      title: "봇 제작",
      items: [
        { label: "의도/모듈 관리", href: botWorkspaceHref, active: pathname.includes("/intents") },
        { label: "개체 관리", href: hasBotContext ? `${currentBotBasePath}/entities` : botContextFallback, active: pathname.includes("/entities") },
        { label: "사전 관리", href: hasBotContext ? `${currentBotBasePath}/dictionary` : botContextFallback, active: pathname.includes("/dictionary") },
      ],
    },
    {
      code: "05",
      title: "봇 테스트",
      href: hasBotContext ? `${currentBotBasePath}/simulator` : botContextFallback,
      active: pathname.includes("/simulator"),
    },
    {
      code: "06",
      title: "봇 평가",
      href: hasBotContext ? `${currentBotBasePath}/evaluation` : botContextFallback,
      active: pathname.includes("/evaluation"),
    },
  ];
  const panelTitle =
    activePanel === "operations" ? "봇 운영" : activePanel === "build" ? "봇 제작" : "시스템 관리";
  const panelLinks = activePanel === "operations" ? operationLinks : [];
  const currentLicense = licenseStatus?.license ?? null;
  const licenseProduct = currentLicense?.product?.trim() || "라이선스 정보 없음";
  const licenseId = currentLicense?.license_id?.trim() || "-";
  const licenseExpiresAt = currentLicense?.expires_at?.trim() || "-";

  function handleLanguageChange(value: string) {
    setLanguage(value);
    window.localStorage.setItem("aidot.language", value);
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
          aria-label="도움말"
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
                  <dt>License</dt>
                  <dd>
                    <b>{licenseProduct}</b>
                    <span>{licenseId} ({licenseExpiresAt} 만료)</span>
                  </dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>v1.1</dd>
                </div>
              </dl>
            </section>
            <section className="studio-rail__help-section studio-rail__help-section--links">
              <strong>Getting Started</strong>
              <button type="button">사용자 매뉴얼</button>
              <button type="button">NLU 학습 가이드</button>
            </section>
          </div>
        ) : null}
      </div>

      <div className="studio-rail__account" ref={accountMenuRef}>
        <button
          type="button"
          className={`studio-rail__account-button${menuOpen ? " is-active" : ""}`}
          aria-label="사용자 메뉴"
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
                    사용자 정보 수정
                  </Link>

                  <select
                    className="studio-rail__language-select"
                    value={language}
                    onChange={(event) => handleLanguageChange(event.target.value)}
                    aria-label="사용자 언어"
                  >
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                  </select>

                  <button
                    type="button"
                    className="studio-rail__account-logout"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
                  </button>
                </div>
              </>
            ) : (
              <Link href="/login" className="studio-rail__account-link" onClick={() => setMenuOpen(false)}>
                로그인
              </Link>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
