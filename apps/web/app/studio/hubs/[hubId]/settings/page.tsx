import { BotHubSettings } from "@/components/bot-hub-settings";
type Props = { params: Promise<{ hubId: string }> };
export default async function BotHubSettingsPage({ params }: Props) { const { hubId } = await params; return <BotHubSettings hubId={hubId} />; }