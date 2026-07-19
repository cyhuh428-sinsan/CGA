type StudioPageLoadingProps = {
  title?: string;
  description?: string;
};

export function StudioPageLoading({
  title = "화면을 불러오는 중입니다.",
  description = "실제 봇과 버전 정보를 확인하는 중입니다.",
}: StudioPageLoadingProps) {
  return (
    <section className="studio-page-loading" role="status" aria-live="polite">
      <div className="studio-page-loading__panel">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </section>
  );
}
