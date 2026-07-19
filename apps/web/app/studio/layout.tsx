import { StudioAppShell } from "@/components/studio-app-shell";
import { ReactNode } from "react";

export default function StudioLayout({ children }: { children: ReactNode }) {
  return <StudioAppShell>{children}</StudioAppShell>;
}
