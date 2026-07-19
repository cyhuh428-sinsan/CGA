import { apiRequest } from "@/lib/api";
import { type AuthUser } from "@/lib/auth";

type PreferencePayload = {
  favorite_bot_ids?: string[];
};

export async function updateAuthPreferences(token: string, payload: PreferencePayload) {
  return apiRequest<AuthUser>(
    "/api/v1/auth/preferences",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    token,
  );
}
