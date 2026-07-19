import { AnalysisPageClient } from "@/components/analysis-page";

export const dynamic = "force-dynamic";

type AnalysisPageProps = {
  params: Promise<{ botId: string; versionId: string }>;
};

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { botId, versionId } = await params;

  return <AnalysisPageClient botId={botId} versionId={versionId} />;
}
