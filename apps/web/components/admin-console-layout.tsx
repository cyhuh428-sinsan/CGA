"use client";

import { ReactNode, Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { CgaStudioHeader } from "@/components/cga-studio-header";
import { AuthSessionToolbar } from "@/components/auth-session-toolbar";
import { StudioRail } from "@/components/studio-rail";
import { fetchAdminLicense, type AdminLicenseStatusResponse } from "@/lib/admin-api";
import { hasAdminOperationsRole, hasAdminRole, loadAuthSession } from "@/lib/auth";
import { useI18n } from "@/components/language-provider";
import { ADMIN_NAVIGATION_CATALOGS, buildAdminNavigationGroups, type AdminNavigationCatalog } from "@/lib/i18n/admin-navigation";

type AdminConsoleLayoutProps = {
  children: ReactNode;
};
function formatLicenseSummary(status: AdminLicenseStatusResponse | null, copy: AdminNavigationCatalog) {
  const license = status?.license;
  if (!status?.installed || !license?.expires_at) {
    return status?.message || copy.licenseNotApplied;
  }
  const expiresAt = new Date(`${license.expires_at}T00:00:00`);
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.ceil((expiresAt.getTime() - todayDate.getTime()) / 86_400_000);
  const dayLabel = diffDays >= 0 ? `D-${diffDays}` : copy.expired;
  const baseText = `${license.product} | ${dayLabel} | (${license.expires_at} ${copy.expired})`;
  return status.message && status.message !== "라이선스가 적용되어 있습니다." ? `${baseText} | ${status.message}` : baseText;
}

export function AdminConsoleLayout({ children }: AdminConsoleLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { language } = useI18n();
  const adminCopy = ADMIN_NAVIGATION_CATALOGS[language];
  const adminGroups = useMemo(() => buildAdminNavigationGroups(adminCopy), [adminCopy]);
  const [authorized, setAuthorized] = useState(false);
  const [licenseSummary, setLicenseSummary] = useState(adminCopy.licenseChecking);

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
    const operationsHrefs = ["/admin/operations-dashboard", ...(adminGroups.find((group) => group.key === "status")?.items.map((item) => item.href) ?? [])];
    if (!isFullAdmin && !operationsHrefs.includes(pathname)) {
      router.replace("/admin/operations-dashboard");
      return;
    }
    setAuthorized(true);
  }, [adminGroups, pathname, router]);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      return;
    }
    void fetchAdminLicense(session.access_token)
      .then((status) => setLicenseSummary(formatLicenseSummary(status, adminCopy)))
      .catch(() => setLicenseSummary(adminCopy.licenseCheckFailed));
  }, [adminCopy]);

  if (!authorized) {
    return (
      <div className="admin-console">
        <CgaStudioHeader />
        <Suspense fallback={null}>
          <StudioRail />
        </Suspense>
        <div className="admin-console__surface">
          <main className="admin-console__main">{adminCopy.verifying}</main>
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
            <h1>{adminCopy.systemAdministration}</h1>
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
