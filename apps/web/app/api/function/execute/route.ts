import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { joinApiUrl, normalizeApiAsset, type VersionApiMethod } from "@/lib/api-assets";

export const runtime = "nodejs";

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function writeFunctionLog(payload: Record<string, unknown>) {
  const now = new Date();
  const logDir = path.join(process.cwd(), "logs", "api-function");
  const logPath = path.join(logDir, `api-function-${toDateKey(now)}.log`);
  await mkdir(logDir, { recursive: true });
  await appendFile(logPath, `${JSON.stringify({ serverTime: now.toISOString(), payload })}\n`, "utf8");
}

function clipText(value: string, maxLength = 20000) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...<truncated:${value.length - maxLength}>` : value;
}

function headersToRecord(headers: Headers) {
  return Object.fromEntries(headers.entries());
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function replaceVariables(value: string, variables: Record<string, string>) {
  return value.replace(/\{\{\s*\$?([\p{ID_Start}_][$_\u200C\u200D\p{ID_Continue}]*)\s*\}\}/gu, (_token, name: string) => {
    return variables[name] ?? "";
  });
}

function coerceValue(value: string, dataType: string) {
  if (dataType === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (dataType === "boolean") {
    return value === "true" || value === "Y" || value === "1";
  }
  if (dataType === "object" || dataType === "array") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function buildRequest(method: VersionApiMethod, url: string, parameterValues: Record<string, string>) {
  const headers = new Headers();
  const query = new URL(url);
  const body: Record<string, unknown> = {};

  for (const parameter of method.parameters) {
    const rawValue = parameterValues[parameter.name] ?? parameter.defaultValue;
    const value = rawValue.trim();
    if (!value && parameter.required) {
      throw new Error(`필수 파라미터 '${parameter.name}' 값이 없습니다.`);
    }
    if (!value) {
      continue;
    }

    if (parameter.location === "query") {
      query.searchParams.set(parameter.name, value);
    } else if (parameter.location === "header") {
      headers.set(parameter.name, value);
    } else if (parameter.location === "body") {
      body[parameter.name] = coerceValue(value, parameter.dataType);
    }
  }

  const init: RequestInit = {
    method: method.httpMethod,
    headers,
    cache: "no-store",
  };

  if (method.httpMethod === "POST") {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(body);
  }

  return { url: query.toString(), init };
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  let logPayload: Record<string, unknown> = {};

  try {
    const payload = await request.json();
    const source = asRecord(payload);
    const api = normalizeApiAsset(source.api);
    const methodId = typeof source.methodId === "string" ? source.methodId : "";
    const variables = asRecord(source.variables) as Record<string, string>;
    const rawParameterValues = asRecord(source.parameterValues);

    if (!api) {
      throw new Error("API 정보가 없습니다.");
    }

    const method = api.methods.find((item) => item.id === methodId);
    if (!method) {
      throw new Error("Method 정보가 없습니다.");
    }

    const parameterValues = Object.fromEntries(
      Object.entries(rawParameterValues).map(([key, value]) => [key, replaceVariables(String(value ?? ""), variables)]),
    );
    const pathValues = Object.fromEntries(
      method.parameters
        .filter((parameter) => parameter.location === "path")
        .map((parameter) => [parameter.name, parameterValues[parameter.name] ?? parameter.defaultValue]),
    );
    const baseUrl = joinApiUrl(api.baseUrl, method.methodUrl, pathValues);
    const requestConfig = buildRequest(method, baseUrl, parameterValues);

    logPayload = {
      requestId,
      simulatorSessionId: typeof source.simulatorSessionId === "string" ? source.simulatorSessionId : "",
      analysisId: typeof source.analysisId === "string" ? source.analysisId : "",
      apiId: api.id,
      apiName: api.name,
      methodId: method.id,
      methodName: method.name,
      httpMethod: method.httpMethod,
      requestUrl: requestConfig.url,
      requestHeaders: headersToRecord(new Headers(requestConfig.init.headers)),
      parameterValues,
    };

    const response = await fetch(requestConfig.url, requestConfig.init);
    const responseText = await response.text();
    let responseBody: unknown = responseText;

    try {
      responseBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseBody = responseText;
    }

    const result = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      elapsedMs: Date.now() - startedAt,
      body: responseBody,
      text: responseText,
    };

    await writeFunctionLog({
      ...logPayload,
      response: {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: headersToRecord(response.headers),
        body: responseBody,
        text: clipText(responseText),
      },
      elapsedMs: result.elapsedMs,
      level: response.ok ? "info" : "error",
      event: "function_api.execute",
    });

    return NextResponse.json(result, { status: response.ok ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "API 호출 중 오류가 발생했습니다.";
    await writeFunctionLog({
      requestId,
      ...logPayload,
      level: "error",
      event: "function_api.execute_failed",
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      elapsedMs: Date.now() - startedAt,
    }).catch(() => undefined);

    return NextResponse.json(
      {
        ok: false,
        status: 500,
        statusText: "Function Execute Error",
        elapsedMs: Date.now() - startedAt,
        body: null,
        text: "",
        message,
      },
      { status: 500 },
    );
  }
}
