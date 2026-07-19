import { NextRequest, NextResponse } from "next/server";

const LEGACY_STUDIO_ORIGIN = (process.env.CGA_LEGACY_STUDIO_ORIGIN || "http://127.0.0.1:4173").replace(/\/$/, "");

function legacyStateUrl(groupId: string, botId: string) {
  return `${LEGACY_STUDIO_ORIGIN}/api/cga/groups/${encodeURIComponent(groupId)}/bots/${encodeURIComponent(botId)}/collaboration-state`;
}

async function forwardJson(response: Response) {
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { detail: text || "4173 CGA 응답을 읽지 못했습니다." };
  }
  return NextResponse.json(payload, { status: response.status });
}

export async function GET(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get("group_id")?.trim() || "";
  const botId = request.nextUrl.searchParams.get("bot_id")?.trim() || "";
  if (!groupId || !botId) {
    return NextResponse.json({ detail: "group_id와 bot_id가 필요합니다." }, { status: 400 });
  }

  try {
    return forwardJson(await fetch(legacyStateUrl(groupId, botId), { cache: "no-store" }));
  } catch {
    return NextResponse.json({ detail: "4173 CGA 운영 상태에 연결할 수 없습니다." }, { status: 502 });
  }
}

