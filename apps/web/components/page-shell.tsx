"use client";

import Link from "next/link";
import { ReactNode } from "react";

import { useI18n } from "@/components/language-provider";
import { PAGE_SHELL_CATALOGS } from "@/lib/i18n/utility-pages";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";

type ManualReference = {
  section: string;
  title: string;
  inferred?: boolean;
};

type QuickLink = {
  href: string;
  label: string;
};

type PageShellProps = {
  title: string;
  titleDetail?: string;
  description: string;
  manualReferences: ManualReference[];
  status?: "placeholder" | "partial";
  quickLinks?: QuickLink[];
  notes?: string[];
  children?: ReactNode;
};

export function PageShell({
  title,
  titleDetail,
  description,
  manualReferences,
  status = "placeholder",
  quickLinks,
  notes,
  children,
}: PageShellProps) {
  const { language } = useI18n();
  const copy = PAGE_SHELL_CATALOGS[language];
  const studioCopy = STUDIO_PAGE_CATALOGS[language];
  return (
    <section className="content-card">
      <div className="content-header">
        <div>
          <p className="eyebrow">
            {status === "partial" ? copy.partial : copy.shell}
          </p>
          <h1>{getStudioPageLabel(studioCopy, title)}{titleDetail ? ": " + titleDetail : ""}</h1>
          <p className="description">{getStudioPageLabel(studioCopy, description)}</p>
        </div>
      </div>

      <div className="manual-card">
        <h2>{copy.manualItems}</h2>
        <ul className="manual-list">
          {manualReferences.map((item) => (
            <li key={`${item.section}-${item.title}`}>
              <strong>{item.section}</strong> {getStudioPageLabel(studioCopy, item.title)}
              {item.inferred ? ` (${copy.inferred})` : ""}
            </li>
          ))}
        </ul>
      </div>

      {notes && notes.length > 0 ? (
        <div className="manual-card">
          <h2>{copy.currentNotes}</h2>
          <ul className="manual-list">
            {notes.map((note) => (
              <li key={note}>{getStudioPageLabel(studioCopy, note)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {quickLinks && quickLinks.length > 0 ? (
        <div className="manual-card">
          <h2>{copy.nextPaths}</h2>
          <div className="quick-links">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href} className="chip-link">
                {getStudioPageLabel(studioCopy, link.label)}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {children ? <div className="manual-card">{children}</div> : null}
    </section>
  );
}
