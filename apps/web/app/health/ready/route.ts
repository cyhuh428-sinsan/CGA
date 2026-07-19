import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_INTERNAL_API_BASE_URL = "http://localhost:8320";

function resolveInternalApiBaseUrl() {
  return (
    process.env.AIDOT_INTERNAL_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULT_INTERNAL_API_BASE_URL
  ).replace(/\/+$/, "");
}

export async function GET() {
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(`${resolveInternalApiBaseUrl()}/health/ready`, {
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unavailable",
        database: "unknown",
        message: error instanceof Error ? error.message : "API readiness check failed.",
      },
      { status: 502 },
    );
  }

  const headers = new Headers();
  const contentType = upstreamResponse.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers,
  });
}
