import { redirect } from "next/navigation";

type BotRedirectPageProps = {
  params: Promise<{ botId: string }>;
};

export default async function BotRedirectPage({ params }: BotRedirectPageProps) {
  const { botId } = await params;
  redirect(`/studio/bots/${botId}/versions/v1/intents`);
}
