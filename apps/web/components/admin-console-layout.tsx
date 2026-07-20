"use client";

import { ReactNode, Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { CgaStudioHeader } from "@/components/cga-studio-header";
import { AuthSessionToolbar } from "@/components/auth-session-toolbar";
import { StudioRail } from "@/components/studio-rail";
import { fetchAdminLicense, type AdminLicenseStatusResponse } from "@/lib/admin-api";
import { hasAdminOperationsRole, hasAdminRole, loadAuthSession } from "@/lib/auth";

type AdminConsoleLayoutProps = {
  children: ReactNode;
};
function formatLicenseSummary(status: AdminLicenseStatusResponse | null) {
  const license = status?.license;
  if (!status?.installed || !license?.expires_at) {
    return status?.message || "라이선스 미적용";
  }
  const expiresAt = new Date(`${license.expires_at}T00:00:00`);
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.ceil((expiresAt.getTime() - todayDate.getTime()) / 86_400_000);
  const dayLabel = diffDays >= 0 ? `D-${diffDays}` : "만료";
  const baseText = `${license.product} | ${dayLabel} | (${license.expires_at} 만료)`;
  return status.message && status.message !== "라이선스가 적용되어 있습니다." ? `${baseText} | ${status.message}` : baseText;
}

const adminGroups = [
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

export function AdminConsoleLayout({ children }: AdminConsoleLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [licenseSummary, setLicenseSummary] = useState("라이선스 확인 중");

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!hasAdminOperationsRole(session.user.roles)) {
      router.replace("/studio/dashboard");
      return;
    }
    const isFullAdmin = hasAdminRole(session.user.roles);
    const operationsHrefs = ["/admin/operations-dashboard", ...(adminGroups.find((group) => group.title === "현황 조회")?.items.map((item) => item.href) ?? [])];
    if (!isFullAdmin && !operationsHrefs.includes(pathname)) {
      router.replace("/admin/operations-dashboard");
      return;
    }
    setAuthorized(true);
  }, [pathname, router]);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      return;
    }
    void fetchAdminLicense(session.access_token)
      .then((status) => setLicenseSummary(formatLicenseSummary(status)))
      .catch(() => setLicenseSummary("라이선스 확인 실패"));
  }, []);

  if (!authorized) {
    return (
      <div className="admin-console">
        <CgaStudioHeader />
        <Suspense fallback={null}>
          <StudioRail />
        </Suspense>
        <div className="admin-console__surface">
          <main className="admin-console__main">확인 중입니다...</main>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-console">
      <CgaStudioHeader />
      <Suspense fallback={null}>
        <StudioRail />
      </Suspense>

      <div className="admin-console__surface">
        <header className="admin-console__header">
          <div>
            <h1>CGA Studio 시스템 관리</h1>
            <p>{licenseSummary}</p>
          </div>
          <AuthSessionToolbar />
        </header>

        <div className="admin-console__body admin-console__body--content-only">
          <main className="admin-console__main">{children}</main>
        </div>
      </div>
    </div>
  );
}
