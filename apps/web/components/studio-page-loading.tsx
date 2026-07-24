"use client";

import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";

type StudioPageLoadingProps = {
  title?: string;
  description?: string;
};

export function StudioPageLoading({
  title = "화면을 불러오는 중입니다.",
  description = "실제 봇과 버전 정보를 확인하는 중입니다.",
}: StudioPageLoadingProps) {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  return (
    <section className="studio-page-loading" role="status" aria-live="polite">
      <div className="studio-page-loading__panel">
        <strong>{getStudioPageLabel(copy, title)}</strong>
        <span>{getStudioPageLabel(copy, description)}</span>
      </div>
    </section>
  );
}
