import { NextResponse } from "next/server";

type ProviderSource = "baseten" | "openrouter" | "glm" | "fallback";

type AssistantHealthStatus = "healthy" | "degraded" | "unhealthy";

interface AssistantHealthResponse {
  status: AssistantHealthStatus;
  timestamp: string;
  environment: string;
  checks: {
    providerConfigured: boolean;
    groundingConfigured: boolean;
    executeConfigured: boolean;
  };
  details: {
    providerChain: ProviderSource[];
    forcedProvider: ProviderSource | null;
    openRouterOnly: boolean;
    toolBaseUrlSource: string;
    strictMode: boolean;
  };
  warnings: string[];
}

const TRUSTED_TOOL_BASE_URL_ENV_KEYS = [
  "ASSISTANT_TOOL_BASE_URL",
  "INTERNAL_API_BASE_URL",
  "APP_BASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
  return fallback;
}

function parseProviderSource(value: string | undefined): ProviderSource | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "baseten/fp4" || normalized === "baseten-fp4" || normalized === "fp4") return "baseten";
  if (normalized === "baseten" || normalized === "openrouter" || normalized === "glm" || normalized === "fallback") {
    return normalized;
  }
  return null;
}

function normalizeBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    if (parsed.search || parsed.hash) return null;
    return value;
  } catch {
    return null;
  }
}

function resolveTrustedToolBaseUrl(): { url: string | null; source: string } {
  for (const key of TRUSTED_TOOL_BASE_URL_ENV_KEYS) {
    const candidate = normalizeBaseUrl(process.env[key]?.trim());
    if (candidate) {
      return { url: candidate, source: key };
    }
  }

  if (process.env.NODE_ENV !== "production") {
    return { url: "http://127.0.0.1:3000", source: "dev-default" };
  }

  return { url: null, source: "none" };
}

function sortByPriority(sources: ProviderSource[]): ProviderSource[] {
  const rawPriority = process.env.ASSISTANT_PROVIDER_PRIORITY?.trim().toLowerCase();
  const configuredPriority = (rawPriority || "baseten,openrouter,glm,fallback")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const order = new Map<string, number>();
  configuredPriority.forEach((item, index) => {
    order.set(item, index);
  });
  return [...sources].sort((a, b) => {
    const ai = order.has(a) ? Number(order.get(a)) : Number.MAX_SAFE_INTEGER;
    const bi = order.has(b) ? Number(order.get(b)) : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
}

function buildProviderChain(): {
  chain: ProviderSource[];
  forcedProvider: ProviderSource | null;
  openRouterOnly: boolean;
} {
  const providers: ProviderSource[] = [];
  if (process.env.OPENROUTER_API_KEY?.trim()) providers.push("openrouter");
  if (process.env.BASETEN_API_KEY?.trim()) providers.push("baseten");
  if (process.env.GLM_API_KEY?.trim()) providers.push("glm");
  if (process.env.GLM_FALLBACK_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()) providers.push("fallback");

  let chain = sortByPriority(providers);
  const forcedProvider = parseProviderSource(process.env.ASSISTANT_PROVIDER_FORCE);
  const openRouterOnly = parseBoolean(process.env.ASSISTANT_OPENROUTER_ONLY, false);

  if (forcedProvider) {
    chain = chain.filter((provider) => provider === forcedProvider);
    return { chain, forcedProvider, openRouterOnly };
  }
  if (openRouterOnly) {
    chain = chain.filter((provider) => provider === "openrouter");
  }
  return { chain, forcedProvider, openRouterOnly };
}

function evaluateStatus(options: {
  providerConfigured: boolean;
  groundingConfigured: boolean;
}): AssistantHealthStatus {
  if (!options.providerConfigured) return "unhealthy";
  if (!options.groundingConfigured) return "degraded";
  return "healthy";
}

function evaluateStrictStatus(options: {
  providerConfigured: boolean;
  groundingConfigured: boolean;
  executeConfigured: boolean;
}): AssistantHealthStatus {
  if (!options.providerConfigured || !options.groundingConfigured || !options.executeConfigured) {
    return "unhealthy";
  }
  return "healthy";
}

export async function GET(request: Request): Promise<NextResponse<AssistantHealthResponse>> {
  const strictMode = parseBoolean(new URL(request.url).searchParams.get("strict") ?? undefined, false);
  const { chain, forcedProvider, openRouterOnly } = buildProviderChain();
  const toolBase = resolveTrustedToolBaseUrl();
  const executeConfigured = Boolean(process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN?.trim());
  const providerConfigured = chain.length > 0;
  const groundingConfigured = Boolean(toolBase.url);

  const warnings: string[] = [];
  if (!providerConfigured) {
    warnings.push("No assistant providers are configured after filters.");
  }
  if (openRouterOnly && !process.env.OPENROUTER_API_KEY?.trim()) {
    warnings.push("ASSISTANT_OPENROUTER_ONLY=true but OPENROUTER_API_KEY is missing.");
  }
  if (forcedProvider && chain.length === 0) {
    warnings.push(`ASSISTANT_PROVIDER_FORCE=${forcedProvider} but matching provider key is missing.`);
  }
  if (!groundingConfigured) {
    warnings.push("Grounding disabled because trusted tool base URL is not configured.");
  }
  if (process.env.NODE_ENV === "production" && !executeConfigured) {
    warnings.push("ASSISTANT_EXECUTE_APPROVAL_TOKEN is not configured (execute endpoint will return 503).");
  }

  const status = strictMode
    ? evaluateStrictStatus({
        providerConfigured,
        groundingConfigured,
        executeConfigured,
      })
    : evaluateStatus({
        providerConfigured,
        groundingConfigured,
      });
  const response: AssistantHealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    checks: {
      providerConfigured,
      groundingConfigured,
      executeConfigured,
    },
    details: {
      providerChain: chain,
      forcedProvider,
      openRouterOnly,
      toolBaseUrlSource: toolBase.source,
      strictMode,
    },
    warnings,
  };

  const httpStatus = strictMode
    ? (status === "healthy" ? 200 : 503)
    : (status === "unhealthy" ? 503 : 200);
  return NextResponse.json(response, { status: httpStatus });
}
