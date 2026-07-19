import { proxyRagMultipartRequest } from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return proxyRagMultipartRequest(request, "/answers/rag/embed-pdf");
}
