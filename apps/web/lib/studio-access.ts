import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_GROUP_CODE_COOKIE } from "@/lib/auth";

export async function getCurrentStudioGroupCode() {
  const cookieStore = await cookies();
  const groupCode = cookieStore.get(AUTH_GROUP_CODE_COOKIE)?.value;

  if (!groupCode) {
    redirect("/login");
  }

  return groupCode;
}
