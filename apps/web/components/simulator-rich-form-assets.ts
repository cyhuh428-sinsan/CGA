import { resolveApiPublicUrl } from "@/lib/api";

const STORAGE_ROOT_PATTERNS = [
  /^\/?home\/ubuntu\/deploy\/Aidot\/(storage\/)?temp\/(.+)$/i,
  /^\/?home\/ubuntu\/deploy\/Aidot\/(storage\/)?bot-images\/(.+)$/i,
];

function encodeAssetPathSegments(value: string) {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function toRemoteImageProxyUrl(value: string) {
  return resolveApiPublicUrl(`/api/v1/richform/image?url=${encodeURIComponent(value)}`);
}

function normalizeRemoteMediaProtocol(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (/^https?::\/\//i.test(trimmed)) {
    return trimmed.replace(/^((?:https?))::\/\//i, "$1://");
  }
  if (/^https?:\/(?!\/)/i.test(trimmed)) {
    return trimmed.replace(/^((?:https?)):\/(?!\/)/i, "$1://");
  }
  if (/^https?:\/\/\/+/i.test(trimmed)) {
    return trimmed.replace(/^((?:https?)):\/{3,}/i, "$1://");
  }
  return trimmed;
}

export function isSimulatorRichFormLocalFilePath(value: string) {
  const raw = value.trim();
  return /^[a-zA-Z]:[\\/]/.test(raw) || /^file:\/\//i.test(raw) || raw.startsWith("/");
}

export function normalizeSimulatorRichFormAssetUrl(value: string, options?: { proxyRemote?: boolean }) {
  const raw = normalizeRemoteMediaProtocol(value);
  if (!raw) return "";
  const slashNormalized = raw.replace(/\\/g, "/");
  const shouldProxyRemote = options?.proxyRemote !== false;

  if (slashNormalized.startsWith("data:")) return slashNormalized;
  if (/^https?:\/\//i.test(slashNormalized)) {
    return shouldProxyRemote ? toRemoteImageProxyUrl(slashNormalized) : slashNormalized;
  }
  if (/^\/\//.test(slashNormalized)) {
    const protocolRelativeUrl = `https:${slashNormalized}`;
    return shouldProxyRemote ? toRemoteImageProxyUrl(protocolRelativeUrl) : protocolRelativeUrl;
  }

  const normalized = slashNormalized.replace(/\/{2,}/g, "/");

  if (normalized.startsWith("data:")) return normalized;

  if (/^\/files\/(temp|bot-images)\//i.test(normalized)) {
    return resolveApiPublicUrl(normalized.replace(
      /^\/files\/(temp|bot-images)\/(.+)$/i,
      (_match, category: string, filePath: string) => `/files/${category}/${encodeAssetPathSegments(filePath)}`,
    ));
  }

  for (const pattern of STORAGE_ROOT_PATTERNS) {
    const storageMatch = normalized.match(pattern);
    if (storageMatch === null) {
      continue;
    }
    const filePath = encodeAssetPathSegments(storageMatch[2]);
    if (patternHasTemp(pattern)) {
      return resolveApiPublicUrl(`/files/temp/${filePath}`);
    }
    if (patternHasBotImages(pattern)) {
      return resolveApiPublicUrl(`/files/bot-images/${filePath}`);
    }
  }

  if (isSimulatorRichFormLocalFilePath(raw)) {
    return resolveApiPublicUrl(`/api/v1/richform/local-image?path=${encodeURIComponent(raw)}`);
  }
  if (/^(?:\/)?(?:assets|uploads|files)\//i.test(normalized)) {
    return resolveApiPublicUrl(`/${normalized.replace(/^\/+/, "")}`);
  }
  return normalized;
}

function patternHasTemp(pattern: RegExp): boolean {
  const source = pattern.source;
  return /storage\/temp\//i.test(source);
}

function patternHasBotImages(pattern: RegExp): boolean {
  const source = pattern.source;
  return /storage\/bot-images\//i.test(source);
}
