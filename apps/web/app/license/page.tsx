import { PageShell } from "@/components/page-shell";

export default function LicensePage() {
  return (
    <main className="page">
      <PageShell
        title="라이선스 정보 조회"
        description="도움말 아이콘을 통해 진입하는 라이선스 정보 중심 화면 셸입니다."
        manualReferences={[
          { section: "2.3", title: "라이선스 정보 조회" },
          { section: "2.3", title: "라이선스 팝업" },
          { section: "2.3", title: "라이선스 알림창" },
        ]}
        quickLinks={[
          { href: "/license/popup", label: "라이선스 팝업" },
          { href: "/license/alert", label: "라이선스 알림창" },
          { href: "/login", label: "로그인" },
        ]}
      />
    </main>
  );
}
