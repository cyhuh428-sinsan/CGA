"use client";

import { ReactNode, Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { CgaStudioHeader } from "@/components/cga-studio-header";
import { StudioRail } from "@/components/studio-rail";
import { loadAuthSession, refreshAuthSessionCookies } from "@/lib/auth";

type StudioAppShellProps = {
  children: ReactNode;
};

export function StudioAppShell({ children }: StudioAppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const session = loadAuthSession();

    if (!session) {
      setIsAuthenticated(false);
      setAuthChecked(true);
      router.replace("/login");
      return;
    }

    refreshAuthSessionCookies();
    setIsAuthenticated(true);
    setAuthChecked(true);
  }, [pathname, router]);

  if (!authChecked || !isAuthenticated) {
    return null;
  }

  return (
    <div className="studio-app-shell theme-ink-sand">
      <CgaStudioHeader />
      <Suspense fallback={null}>
        <StudioRail />
      </Suspense>
      <main className="studio-app-main">{children}</main>
    </div>
  );
}
