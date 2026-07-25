"use client";

import Link from "next/link";
import { useI18n } from "@/components/language-provider";
import { getStudioRuntimeMessage } from "@/lib/i18n/studio-runtime-native";

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
  statusLabel,
  changeScope,
  impactScope,
  manualReferences,
  notes,
  quickLinks,
}: ManualTracePanelProps) {
  const { language } = useI18n();
  const displayedStatusLabel = statusLabel ?? getStudioRuntimeMessage(language, "매뉴얼 기준 검토 중");
  return (
    <aside className="trace-panel">
      <div className="trace-panel__status">{displayedStatusLabel}</div>

      <section className="trace-panel__section">
        <h2>{getStudioRuntimeMessage(language, "수정 범위")}</h2>
        <ul className="trace-list">
          {changeScope.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="trace-panel__section">
        <h2>{getStudioRuntimeMessage(language, "영향 범위")}</h2>
        <ul className="trace-list">
          {impactScope.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="trace-panel__section">
        <h2>{getStudioRuntimeMessage(language, "매뉴얼 대응")}</h2>
        <ul className="trace-list">
          {manualReferences.map((item) => (
            <li key={`${item.section}-${item.title}`}>
              <strong>{item.section}</strong> {item.title}
              {item.inferred ? ` (${getStudioRuntimeMessage(language, "추측 포함")})` : ""}
            </li>
          ))}
        </ul>
      </section>

      {notes && notes.length > 0 ? (
        <section className="trace-panel__section">
          <h2>{getStudioRuntimeMessage(language, "현재 메모")}</h2>
          <ul className="trace-list">
            {notes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {quickLinks && quickLinks.length > 0 ? (
        <section className="trace-panel__section">
          <h2>{getStudioRuntimeMessage(language, "다음 확인 경로")}</h2>
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
