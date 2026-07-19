import { ReactNode } from "react";

import { StudioWorkspaceProvider } from "@/components/studio-workspace-provider";

type VersionLayoutProps = {
  children: ReactNode;
};

export default function VersionLayout({ children }: VersionLayoutProps) {
  return <StudioWorkspaceProvider>{children}</StudioWorkspaceProvider>;
}
