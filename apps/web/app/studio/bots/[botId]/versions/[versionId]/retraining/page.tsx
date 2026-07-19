import { RetrainingPageClient } from "@/components/retraining-page";

export const dynamic = "force-dynamic";

type RetrainingPageProps = {
  params: Promise<{ botId: string; versionId: string }>;
};

export default async function RetrainingPage({ params }: RetrainingPageProps) {
  const { botId, versionId } = await params;

  return <RetrainingPageClient botId={botId} versionId={versionId} />;
}
