"use client";

import { useI18n } from "@/components/language-provider";
import { PageShell } from "@/components/page-shell";
import { UTILITY_PAGE_CATALOGS } from "@/lib/i18n/utility-pages";

export default function LicensePopupPage() {
  const { language } = useI18n();
  const copy = UTILITY_PAGE_CATALOGS[language].licensePopup;
  return (
    <main className="page">
      <PageShell
        title={copy.title}
        description={copy.description}
        manualReferences={[{ section: "2.3", title: copy.title }]}
        quickLinks={[
          { href: "/license", label: copy.licenseInfo },
          { href: "/license/alert", label: copy.alert },
        ]}
      />
    </main>
  );
}