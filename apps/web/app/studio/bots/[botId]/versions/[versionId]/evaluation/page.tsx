import { EvaluationPageClient } from "@/components/evaluation-page";

export const dynamic = "force-dynamic";

type EvaluationPageProps = {
  params: Promise<{ botId: string; versionId: string }>;
};

export default async function EvaluationPage({ params }: EvaluationPageProps) {
  const { botId, versionId } = await params;

  return <EvaluationPageClient botId={botId} versionId={versionId} />;
}
