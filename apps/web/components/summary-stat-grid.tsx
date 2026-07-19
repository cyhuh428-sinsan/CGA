import Link from "next/link";

export type SummaryStatItem = {
  label: string;
  value: string;
  active?: boolean;
  href?: string;
};

type SummaryStatGridProps = {
  items: SummaryStatItem[];
};

const HIDDEN_LEGACY_LABELS = new Set(["QA"]);

function SummaryIcon({ label }: { label: string }) {
  switch (label) {
    case "의도":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 5.5h8a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3H8l-3 2v-2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Z" />
          <circle cx="7" cy="9" r="0.8" />
          <circle cx="10" cy="9" r="0.8" />
          <circle cx="13" cy="9" r="0.8" />
        </svg>
      );
    case "구성":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 5.5h5.5M4 10h8M4 14.5h5.5" />
          <path d="M14 5.5h2M14 10h2M14 14.5h2" />
          <path d="M11.5 5.5 14 5.5M11.5 14.5 14 14.5" />
        </svg>
      );
    case "개체":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="5.5" />
          <circle cx="10" cy="10" r="2" />
        </svg>
      );
    case "사전":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4.5 4.5h7.5a2 2 0 0 1 2 2v8H6.5a2 2 0 0 0-2 2V4.5Z" />
          <path d="M6.5 15.5h8v-9a2 2 0 0 0-2-2H6.5" />
          <path d="M8 8.2h4.8M8 10.5h4.8" />
        </svg>
      );
    case "평가":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 14.5V9.8M9 14.5V6.8M13 14.5V11M17 14.5V5" />
          <path d="M4 15.5h14" />
        </svg>
      );
    case "재학습":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M6.2 7.2A5.2 5.2 0 0 1 15 9h1.8l-2.3 2.4L12.2 9H14a4 4 0 0 0-6.8-1.9" />
          <path d="M13.8 12.8A5.2 5.2 0 0 1 5 11H3.2l2.3-2.4L7.8 11H6a4 4 0 0 0 6.8 1.9" />
        </svg>
      );
    case "분석":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4.5 13.5 7.5 10.5 10 12.5 15.5 7" />
          <path d="M13.8 7h1.7v1.7" />
          <path d="M4 15.5h12" />
        </svg>
      );
    default:
      return null;
  }
}

export function SummaryStatGrid({ items }: SummaryStatGridProps) {
  const visibleItems = items.filter((item) => !HIDDEN_LEGACY_LABELS.has(item.label));

  return (
    <div className="manual-main__stats">
      {visibleItems.map((item) => {
        const classes = `manual-main__stat${item.active ? " manual-main__stat--active" : ""}`;
        const content = (
          <>
            <div className="manual-main__stat-top">
              <span className="manual-main__stat-icon">
                <SummaryIcon label={item.label} />
              </span>
              <span className="manual-main__stat-label">{item.label}</span>
            </div>
            <strong>{item.value}</strong>
          </>
        );

        if (item.href) {
          return (
            <Link
              key={item.label}
              href={item.href}
              className={classes}
              aria-current={item.active ? "page" : undefined}
            >
              {content}
            </Link>
          );
        }

        return (
          <div key={item.label} className={classes}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
