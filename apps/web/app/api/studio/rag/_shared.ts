import { NextResponse } from "next/server";

const DEFAULT_API_BASE_URL = "http://localhost:8320";

function resolveApiBaseUrl() {
  return (
    process.env.CGA_INTERNAL_API_BASE_URL ||
    DEFAULT_API_BASE_URL
  ).replace(/\/+$/, "");
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ detail: message }, { status });
}

export async function proxyRagMultipartRequest(
  request: Request,
  endpointPath: string,
) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return jsonError("로그인이 필요합니다.", 401);
  }

  const requestUrl = new URL(request.url);
  const botId = requestUrl.searchParams.get("botId")?.trim();
  const versionId = requestUrl.searchParams.get("versionId")?.trim();
  if (!botId || !versionId) {
    return jsonError("봇 또는 버전 정보가 없습니다.", 400);
  }

  const formData = await request.formData();
  const upstreamUrl = `${resolveApiBaseUrl()}/api/v1/bots/${encodeURIComponent(botId)}/versions/${encodeURIComponent(versionId)}${endpointPath}`;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
      },
      body: formData,
      cache: "no-store",
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "업스트림 API 호출 중 오류가 발생했습니다.",
      502,
    );
  }

  const rawText = await upstreamResponse.text();
  const contentType = upstreamResponse.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return new NextResponse(rawText, {
      status: upstreamResponse.status,
      headers: {
        "content-type": contentType,
      },
    });
  }

  return jsonError(rawText || "응답 형식이 올바르지 않습니다.", upstreamResponse.status || 502);
}
