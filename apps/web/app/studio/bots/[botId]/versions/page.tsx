import { VersionManagementPage } from "@/components/version-management-page";

type SearchValue = string | string[] | undefined;

type VersionsPageProps = {
  params: Promise<{ botId: string }>;
  searchParams?: Promise<Record<string, SearchValue>>;
};

function getSearchValue(value: SearchValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function VersionsPage({ params, searchParams }: VersionsPageProps) {
  const { botId } = await params;
  const currentSearchParams = (await searchParams) ?? {};

  return <VersionManagementPage botId={botId} initialSelectedId={getSearchValue(currentSearchParams.selected)} />;
}
