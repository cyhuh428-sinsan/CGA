"use client";

import { useI18n } from "@/components/language-provider";
import { PageShell } from "@/components/page-shell";
import { UTILITY_PAGE_CATALOGS } from "@/lib/i18n/utility-pages";

export default function TenantSwitchPage() {
  const { language } = useI18n();
  const copy = UTILITY_PAGE_CATALOGS[language].tenantSwitch;
  return (
    <main className="page">
      <PageShell
        title={copy.title}
        description={copy.description}
        manualReferences={[{ section: "2.2", title: copy.manualTitle }]}
        quickLinks={[
          { href: "/login", label: copy.login },
          { href: "/me/profile", label: copy.profile },
          { href: "/license", label: copy.licenseInfo },
        ]}
      />
    </main>
  );
}