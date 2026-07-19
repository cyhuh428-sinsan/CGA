import Link from "next/link";

type ManualReference = {
  section: string;
  title: string;
  inferred?: boolean;
};

type QuickLink = {
  href: string;
  label: string;
};

type ManualTracePanelProps = {
  statusLabel?: string;
  changeScope: string[];
  impactScope: string[];
  manualReferences: ManualReference[];
  notes?: string[];
  quickLinks?: QuickLink[];
};

export function ManualTracePanel({
  statusLabel = "매뉴얼 기준 검토 중",
  changeScope,
  impactScope,
  manualReferences,
  notes,
  quickLinks,
}: ManualTracePanelProps) {
  return (
    <aside className="trace-panel">
      <div className="trace-panel__status">{statusLabel}</div>

      <section className="trace-panel__section">
        <h2>수정 범위</h2>
        <ul className="trace-list">
          {changeScope.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="trace-panel__section">
        <h2>영향 범위</h2>
        <ul className="trace-list">
          {impactScope.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="trace-panel__section">
        <h2>매뉴얼 대응</h2>
        <ul className="trace-list">
          {manualReferences.map((item) => (
            <li key={`${item.section}-${item.title}`}>
              <strong>{item.section}</strong> {item.title}
              {item.inferred ? " (추측 포함)" : ""}
            </li>
          ))}
        </ul>
      </section>

      {notes && notes.length > 0 ? (
        <section className="trace-panel__section">
          <h2>현재 메모</h2>
          <ul className="trace-list">
            {notes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {quickLinks && quickLinks.length > 0 ? (
        <section className="trace-panel__section">
          <h2>다음 확인 경로</h2>
          <div className="trace-links">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href} className="trace-link">
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
