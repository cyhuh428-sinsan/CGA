import Link from "next/link";

import { StudioTablePage } from "@/components/studio-table-page";
import { SortHeaderLabel } from "@/components/sort-header-label";

export const dynamic = "force-dynamic";

type FlowListPageProps = {
  params: Promise<{ botId: string; versionId: string }>;
};

export default async function FlowListPage({ params }: FlowListPageProps) {
  const { botId, versionId } = await params;

  return (
    <StudioTablePage
      title="대화 설계"
      searchPlaceholder="의도명 또는 표시명을 검색하세요."
      totalText="전체 6"
      pageSizeText="10개씩 보기"
      template="90px 1fr 220px 120px 180px 120px"
      columns={["ID", <SortHeaderLabel key="name" label="의도/모듈명" />, "표시명", "학습문장", "최종수정일시", "열기"]}
      rows={[
        {
          key: "flow-1",
          cells: [
            "100145",
            "휴가 신청 안내",
            "휴가 신청",
            "52",
            "2026-04-24 14:20",
            <Link key="link" href={`/studio/bots/${botId}/versions/${versionId}/flows/leave-request`}>
              대화 설계
            </Link>,
          ],
        },
        {
          key: "flow-2",
          cells: [
            "100146",
            "근무시간 기준",
            "근무시간 안내",
            "23",
            "2026-04-24 12:10",
            <Link key="link" href={`/studio/bots/${botId}/versions/${versionId}/flows/work-hours`}>
              대화 설계
            </Link>,
          ],
        },
      ]}
      simulatorHref={`/studio/bots/${botId}/versions/${versionId}/simulator`}
    />
  );
}
