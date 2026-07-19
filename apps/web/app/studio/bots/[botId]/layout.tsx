import { ReactNode } from "react";

type BotLayoutProps = {
  children: ReactNode;
};

export default function BotLayout({ children }: BotLayoutProps) {
  return <>{children}</>;
}
