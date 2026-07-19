import { PageShell } from "@/components/page-shell";

export default function LicenseAlertPage() {
  return (
    <main className="page">
      <PageShell
        title="라이선스 알림창"
        description="라이선스 만료 또는 상태 안내를 표시하는 화면 셸입니다."
        manualReferences={[
          { section: "2.3", title: "라이선스 알림창" },
        ]}
        quickLinks={[
          { href: "/license", label: "라이선스 정보 조회" },
          { href: "/login", label: "로그인" },
        ]}
      />
    </main>
  );
}
