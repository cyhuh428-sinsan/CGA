import { PageShell } from "@/components/page-shell";

export default function TenantSwitchPage() {
  return (
    <main className="page">
      <PageShell
        title="테넌트 전환"
        description="사용 가능한 테넌트를 전환하는 시작 화면 셸입니다."
        manualReferences={[
          { section: "2.2", title: "테넌트 전환하기" },
        ]}
        quickLinks={[
          { href: "/login", label: "로그인" },
          { href: "/me/profile", label: "내 정보" },
          { href: "/license", label: "라이선스 정보" },
        ]}
      />
    </main>
  );
}
