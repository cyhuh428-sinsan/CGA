import { PageShell } from "@/components/page-shell";

type ConversationDetailPageProps = {
  params: Promise<{ botId: string; versionId: string; sessionId: string }>;
};

export default async function ConversationDetailPage({
  params,
}: ConversationDetailPageProps) {
  const { botId, versionId, sessionId } = await params;

  return (
    <PageShell
      title={`대화 상세: ${sessionId}`}
      description="대화 메시지와 실행 흐름을 검토하는 화면입니다."
      manualReferences={[
        { section: "14.6", title: "대화 이력 조회하기" },
      ]}
      quickLinks={[
        {
          href: `/studio/bots/${botId}/versions/${versionId}/conversations`,
          label: "대화 이력 목록",
        },
        {
          href: `/studio/bots/${botId}/versions/${versionId}/intents`,
          label: "메인 화면",
        },
      ]}
    />
  );
}
