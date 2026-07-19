import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_INTERNAL_API_BASE_URL = "http://localhost:8320";
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function resolveInternalApiBaseUrl() {
  return (
    process.env.AIDOT_INTERNAL_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULT_INTERNAL_API_BASE_URL
  ).replace(/\/+$/, "");
}

function buildUpstreamHeaders(request: Request) {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      return;
    }
    headers.set(key, value);
  });
  return headers;
}

async function proxyApiRequest(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const upstreamUrl = new URL(`${resolveInternalApiBaseUrl()}/api/v1/${(Array.isArray(path) ? path : []).join("/")}`);
  const requestUrl = new URL(request.url);
  requestUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });

  let upstreamResponse: Response;
  try {
    const fetchOptions: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers: buildUpstreamHeaders(request),
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      cache: "no-store",
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      fetchOptions.duplex = "half";
    }
    upstreamResponse = await fetch(upstreamUrl.toString(), {
      ...fetchOptions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "업스트림 API 호출 중 오류가 발생했습니다.",
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstreamResponse.headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      return;
    }
    responseHeaders.set(key, value);
  });

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxyApiRequest(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxyApiRequest(request, context);
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxyApiRequest(request, context);
}

export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxyApiRequest(request, context);
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxyApiRequest(request, context);
}

export async function OPTIONS(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxyApiRequest(request, context);
}
