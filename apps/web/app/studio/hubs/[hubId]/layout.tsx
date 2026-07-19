import { ReactNode } from "react";

type HubLayoutProps = {
  children: ReactNode;
};

export default function HubLayout({ children }: HubLayoutProps) {
  return <>{children}</>;
}
