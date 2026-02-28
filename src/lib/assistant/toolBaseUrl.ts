export const TRUSTED_TOOL_BASE_URL_ENV_KEYS = [
  "ASSISTANT_TOOL_BASE_URL",
  "INTERNAL_API_BASE_URL",
  "APP_BASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

interface ResolveTrustedToolBaseUrlOptions {
  env?: NodeJS.ProcessEnv;
  nodeEnv?: string;
  port?: string;
  defaultDevBaseUrl: string;
  onInvalidEnvValue?: (envKey: string) => void;
}

export interface TrustedToolBaseUrlResolution {
  baseUrl?: string;
  source: string;
}

export function resolveTrustedToolBaseUrl(
  options: ResolveTrustedToolBaseUrlOptions
): TrustedToolBaseUrlResolution {
  const env = options.env ?? process.env;
  for (const key of TRUSTED_TOOL_BASE_URL_ENV_KEYS) {
    const value = String(env[key] ?? "").trim();
    if (!value) continue;
    const normalized = normalizeToolBaseUrl(value);
    if (normalized) {
      return {
        baseUrl: normalized,
        source: `env:${key}`,
      };
    }
    options.onInvalidEnvValue?.(key);
  }

  if ((options.nodeEnv ?? env.NODE_ENV) !== "production") {
    return {
      baseUrl: resolveDevLocalhostBaseUrl(options.port ?? env.PORT, options.defaultDevBaseUrl),
      source: "dev-localhost",
    };
  }

  return { source: "none" };
}

export function normalizeToolBaseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const rawPathCandidate = String(value).split("?")[0].split("#")[0];
  if (/%2e|%2f|%5c/i.test(rawPathCandidate)) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    if (parsed.username || parsed.password) return undefined;
    if (parsed.search || parsed.hash) return undefined;
    const normalizedPath = normalizeToolBasePath(parsed.pathname);
    if (normalizedPath === undefined) return undefined;
    return `${parsed.origin}${normalizedPath}`;
  } catch {
    return undefined;
  }
}

export function normalizeToolBasePath(pathname: string): string | undefined {
  if (!pathname || pathname === "/") return "";
  if (!pathname.startsWith("/")) return undefined;

  const normalizedPath = pathname.replace(/\/{2,}/g, "/").replace(/\/+$/g, "");
  if (!normalizedPath || normalizedPath === "/") return "";

  const segments = normalizedPath.split("/").slice(1);
  for (const segment of segments) {
    if (!segment) continue;
    try {
      const decodedSegment = decodeURIComponent(segment);
      if (decodedSegment === "." || decodedSegment === "..") return undefined;
      if (decodedSegment.includes("/") || decodedSegment.includes("\\")) return undefined;
    } catch {
      return undefined;
    }
  }

  return normalizedPath;
}

export function resolveDevLocalhostBaseUrl(port: string | undefined, fallback: string): string {
  const normalizedPort = normalizePort(port);
  if (!normalizedPort) return fallback;
  return `http://127.0.0.1:${normalizedPort}`;
}

export function normalizePort(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65_535) {
    return undefined;
  }
  return String(parsed);
}
