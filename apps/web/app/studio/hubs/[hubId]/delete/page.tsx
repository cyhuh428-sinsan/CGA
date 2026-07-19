import { BotHubDelete } from "@/components/bot-hub-delete";

type BotHubDeletePageProps = { params: Promise<{ hubId: string }> };

export default async function BotHubDeletePage({ params }: BotHubDeletePageProps) {
  const { hubId } = await params;
  return <BotHubDelete hubId={hubId} />;
}
