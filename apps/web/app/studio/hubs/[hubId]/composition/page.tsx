import { BotHubComposition } from "@/components/bot-hub-composition";

type Props = { params: Promise<{ hubId: string }> };
export default async function BotHubCompositionPage({ params }: Props) { const { hubId } = await params; return <BotHubComposition hubId={hubId} />; }
