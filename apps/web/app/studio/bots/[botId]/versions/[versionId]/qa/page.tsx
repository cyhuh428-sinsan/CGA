import { redirect } from "next/navigation";

type QaPageProps = {
  params: Promise<{ botId: string; versionId: string }>;
};

export default async function QaPage({ params }: QaPageProps) {
  const { botId, versionId } = await params;
  redirect(`/studio/bots/${botId}/versions/${versionId}/intents`);
}
