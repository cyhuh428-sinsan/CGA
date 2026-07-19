import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_INTERNAL_API_BASE_URL = "http://localhost:8320";
const STORAGE_ROOT = process.env.AIDOT_FILE_STORAGE_ROOT?.trim() || "/workspace/storage";
const ALLOWED_CATEGORIES = new Set(["temp", "bot-images"]);

function resolveInternalApiBaseUrl() {
  return (
    process.env.AIDOT_INTERNAL_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULT_INTERNAL_API_BASE_URL
  ).replace(/\/+$/, "");
}

function normalizeSegments(segments: string[]) {
  return segments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.replace(/\\/g, "/"))
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
}

function hasUnsafeSegment(segments: string[]) {
  return segments.some((segment) => segment === "." || segment === ".." || segment.includes("../") || segment.includes("..\\"));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ category: string; segments: string[] }> },
) {
  const { category, segments } = await context.params;
  if (!ALLOWED_CATEGORIES.has(category)) {
    return new NextResponse("지원하지 않는 파일 경로입니다.", { status: 404 });
  }

  const normalizedSegments = normalizeSegments(Array.isArray(segments) ? segments : []);
  if (!normalizedSegments.length || hasUnsafeSegment(normalizedSegments)) {
    return new NextResponse("잘못된 파일 경로입니다.", { status: 400 });
  }

  const absolutePath = `${STORAGE_ROOT}/${category}/${normalizedSegments.join("/")}`;
  const upstreamUrl = new URL(`${resolveInternalApiBaseUrl()}/api/v1/richform/local-image`);
  upstreamUrl.searchParams.set("path", absolutePath);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl.toString(), {
      cache: "no-store",
    });
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : "이미지 조회 중 오류가 발생했습니다.",
      { status: 502 },
    );
  }

  if (!upstreamResponse.ok) {
    const detail = await upstreamResponse.text().catch(() => "");
    return new NextResponse(detail || "이미지를 불러오지 못했습니다.", {
      status: upstreamResponse.status,
    });
  }

  const headers = new Headers();
  const contentType = upstreamResponse.headers.get("content-type");
  const cacheControl = upstreamResponse.headers.get("cache-control");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  if (cacheControl) {
    headers.set("cache-control", cacheControl);
  } else {
    headers.set("cache-control", "public, max-age=300");
  }

  return new NextResponse(upstreamResponse.body, {
    status: 200,
    headers,
  });
}
