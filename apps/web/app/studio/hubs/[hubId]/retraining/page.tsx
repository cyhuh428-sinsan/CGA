import { BotHubRetrainingPage } from "@/components/bot-hub-retraining-page";

type BotHubRetrainingPageProps = {
  params: Promise<{ hubId: string }>;
};

export default async function HubRetrainingPage({ params }: BotHubRetrainingPageProps) {
  const { hubId } = await params;
  return <BotHubRetrainingPage hubId={hubId} />;
}
