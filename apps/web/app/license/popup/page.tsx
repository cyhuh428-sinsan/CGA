import { PageShell } from "@/components/page-shell";

export default function LicensePopupPage() {
  return (
    <main className="page">
      <PageShell
        title="라이선스 팝업"
        description="라이선스 상세 정보를 팝업 형식으로 확인하는 화면 셸입니다."
        manualReferences={[
          { section: "2.3", title: "라이선스 팝업" },
        ]}
        quickLinks={[
          { href: "/license", label: "라이선스 정보 조회" },
          { href: "/license/alert", label: "라이선스 알림창" },
        ]}
      />
    </main>
  );
}
