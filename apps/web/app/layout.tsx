import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

import { LanguageProvider } from "@/components/language-provider";

export const metadata: Metadata = {
  title: "CGA Studio",
  description: "Aidot 제작/운영 콘솔",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
