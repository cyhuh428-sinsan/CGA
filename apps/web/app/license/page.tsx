"use client";

import { useI18n } from "@/components/language-provider";
import { PageShell } from "@/components/page-shell";
import { UTILITY_PAGE_CATALOGS } from "@/lib/i18n/utility-pages";

export default function LicensePage() {
  const { language } = useI18n();
  const copy = UTILITY_PAGE_CATALOGS[language].license;
  return (
    <main className="page">
      <PageShell
        title={copy.title}
        description={copy.description}
        manualReferences={[
          { section: "2.3", title: copy.title },
          { section: "2.3", title: copy.popup },
          { section: "2.3", title: copy.alert },
        ]}
        quickLinks={[
          { href: "/license/popup", label: copy.popup },
          { href: "/license/alert", label: copy.alert },
          { href: "/login", label: copy.login },
        ]}
      />
    </main>
  );
}