import { AdminConsoleLayout } from "@/components/admin-console-layout";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminConsoleLayout>{children}</AdminConsoleLayout>;
}
