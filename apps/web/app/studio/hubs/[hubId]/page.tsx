import { BotHubHome } from "@/components/bot-hub-home";
type Props = { params: Promise<{ hubId: string }> };
export default async function BotHubDetailPage({ params }: Props) { const { hubId } = await params; return <BotHubHome hubId={hubId} />; }
