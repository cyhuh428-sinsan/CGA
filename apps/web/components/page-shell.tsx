import Link from "next/link";
import { ReactNode } from "react";

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
  description: string;
  manualReferences: ManualReference[];
  status?: "placeholder" | "partial";
  quickLinks?: QuickLink[];
  notes?: string[];
  children?: ReactNode;
};

export function PageShell({
  title,
  description,
  manualReferences,
  status = "placeholder",
  quickLinks,
  notes,
  children,
}: PageShellProps) {
  return (
    <section className="content-card">
      <div className="content-header">
        <div>
          <p className="eyebrow">
            {status === "partial" ? "부분 구현" : "화면 셸"}
          </p>
          <h1>{title}</h1>
          <p className="description">{description}</p>
        </div>
      </div>

      <div className="manual-card">
        <h2>매뉴얼 대응 항목</h2>
        <ul className="manual-list">
          {manualReferences.map((item) => (
            <li key={`${item.section}-${item.title}`}>
              <strong>{item.section}</strong> {item.title}
              {item.inferred ? " (추측 포함)" : ""}
            </li>
          ))}
        </ul>
      </div>

      {notes && notes.length > 0 ? (
        <div className="manual-card">
          <h2>현재 메모</h2>
          <ul className="manual-list">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {quickLinks && quickLinks.length > 0 ? (
        <div className="manual-card">
          <h2>다음 확인 경로</h2>
          <div className="quick-links">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href} className="chip-link">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {children ? <div className="manual-card">{children}</div> : null}
    </section>
  );
}
