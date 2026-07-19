import { SimulatorPage as SimulatorClientPage } from "@/components/simulator-page";

export const dynamic = "force-dynamic";

type SimulatorPageProps = {
  params: Promise<{ botId: string; versionId: string }>;
};

export default async function Page({ params }: SimulatorPageProps) {
  await params;

  return <SimulatorClientPage />;
}
