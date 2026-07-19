import { redirect } from "next/navigation";

type EntityPageProps = {
  params: Promise<{ botId: string; versionId: string; entityId: string }>;
};

export default async function EntityPage({ params }: EntityPageProps) {
  const { botId, versionId } = await params;
  redirect(`/studio/bots/${botId}/versions/${versionId}/entities`);
}
