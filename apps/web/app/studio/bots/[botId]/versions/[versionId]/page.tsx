import { redirect } from "next/navigation";

type VersionDetailPageProps = {
  params: Promise<{ botId: string; versionId: string }>;
};

export default async function VersionDetailPage({ params }: VersionDetailPageProps) {
  const { botId, versionId } = await params;
  redirect(`/studio/bots/${botId}/versions/${versionId}/intents`);
}
