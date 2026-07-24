import Link from "next/link";

import { StudioPageText, StudioTablePage } from "@/components/studio-table-page";
import { SortHeaderLabel } from "@/components/sort-header-label";

export const dynamic = "force-dynamic";

type ConversationListPageProps = {
  params: Promise<{ botId: string; versionId: string }>;
};

export default async function ConversationListPage({ params }: ConversationListPageProps) {
  const { botId, versionId } = await params;

  return (
    <StudioTablePage
      title="대화 이력"
      searchPlaceholder="사용자 발화 또는 의도명을 검색하세요."
      totalText="전체 12"
      pageSizeText="20개씩 보기"
      template="180px 240px 220px 180px 160px 150px"
      columns={[
        "발화일시",
        "사용자 발화",
        <SortHeaderLabel key="intent" label="의도/모듈명" />,
        "채널",
        "실행 결과",
        "상세",
      ]}
      rows={[
        {
          key: "conv-1",
          cells: [
            "2026-04-25 14:22:11",
            "연차 신청은 어디서 하나요?",
            "휴가 신청 안내",
            "Simulator",
            <StudioPageText key="status">응답완료</StudioPageText>,
            <Link key="link" href={`/studio/bots/${botId}/versions/${versionId}/conversations/session-001`}>
              <StudioPageText>보기</StudioPageText>
            </Link>,
          ],
        },
        {
          key: "conv-2",
          cells: [
            "2026-04-25 14:10:43",
            "근무시간 알려줘",
            "근무시간 기준",
            "Webchat",
            <StudioPageText key="status">응답완료</StudioPageText>,
            <Link key="link" href={`/studio/bots/${botId}/versions/${versionId}/conversations/session-002`}>
              <StudioPageText>보기</StudioPageText>
            </Link>,
          ],
        },
      ]}
      simulatorHref={`/studio/bots/${botId}/versions/${versionId}/simulator`}
    />
  );
}
