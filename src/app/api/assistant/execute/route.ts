import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { createLogger, toErrorMeta } from "@/lib/logger";
import {
  buildAssistantExecutePlan,
  validateAssistantExecuteRequest,
} from "@/lib/assistant/executeTools";

const TRUSTED_BASE_URL_ENV_KEYS = [
  "ASSISTANT_TOOL_BASE_URL",
  "INTERNAL_API_BASE_URL",
  "APP_BASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;
const DEFAULT_EXECUTE_TIMEOUT_MS = 15_000;

const assistantExecuteLogger = createLogger("api.assistant.execute");

type DownstreamContext = {
  requestId: string;
  toolName: string;
  method: string;
  path: string;
  baseUrl: string;
  endpoint: string;
};

type ErrorPayload = {
  requestId: string;
  toolName: string;
  error: string;
  downstream: {
    url: string;
    method: string;
    path: string;
    status: number;
    statusText?: string | null;
    bodyPreview?: string;
  };
};

function hashToken(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function tokensMatch(providedToken: string, expectedToken: string): boolean {
  return timingSafeEqual(hashToken(providedToken), hashToken(expectedToken));
}

function normalizeBaseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    if (parsed.username || parsed.password) return undefined;
    if (parsed.search || parsed.hash) return undefined;
    const normalizedPath = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/g, "");
    return `${parsed.origin}${normalizedPath}`;
  } catch {
    return undefined;
  }
}

function resolveTrustedInternalBaseUrl(): string | null {
  for (const key of TRUSTED_BASE_URL_ENV_KEYS) {
    const candidate = normalizeBaseUrl(process.env[key]?.trim());
    if (candidate) return candidate;
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:3000";
  }

  return null;
}

function resolveExecuteTimeoutMs(): number {
  const parsed = Number(process.env.ASSISTANT_EXECUTE_FETCH_TIMEOUT_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_EXECUTE_TIMEOUT_MS;
  const normalized = Math.trunc(parsed);
  if (normalized < 1_000) return 1_000;
  if (normalized > 120_000) return 120_000;
  return normalized;
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function isAbortError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("name" in error && (error as { name?: unknown }).name === "AbortError") return true;
  if ("message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
    return message.includes("abort");
  }
  return false;
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json", requestId }, { status: 415 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", requestId }, { status: 400 });
  }
  const validation = validateAssistantExecuteRequest(rawBody);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error, requestId }, { status: validation.status });
  }
  const { toolName, args, approvalToken } = validation;
  const expectedApprovalToken = process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN?.trim() ?? "";
  const isProduction = process.env.NODE_ENV === "production";

  if (!expectedApprovalToken) {
    return NextResponse.json(
      {
        error: isProduction
          ? "Assistant execution is temporarily unavailable."
          : "Missing ASSISTANT_EXECUTE_APPROVAL_TOKEN configuration.",
        requestId,
      },
      { status: 503 }
    );
  }
  if (!tokensMatch(approvalToken, expectedApprovalToken)) {
    return NextResponse.json(
      { error: "Invalid approvalToken for human-in-loop execution.", requestId },
      { status: 403 }
    );
  }

  const trustedInternalBaseUrl = resolveTrustedInternalBaseUrl();
  if (!trustedInternalBaseUrl) {
    return NextResponse.json(
      { error: "Missing trusted internal API base URL configuration.", requestId },
      { status: 503 }
    );
  }

  const plan = buildAssistantExecutePlan(toolName, args);
  const endpoint = new URL(plan.path, trustedInternalBaseUrl);
  if (plan.query) {
    for (const [key, value] of Object.entries(plan.query)) {
      endpoint.searchParams.set(key, value);
    }
  }

  const downstreamContext: DownstreamContext = {
    requestId,
    toolName,
    method: plan.method,
    path: plan.path,
    baseUrl: trustedInternalBaseUrl,
    endpoint: endpoint.toString(),
  };

  const timeoutMs = resolveExecuteTimeoutMs();
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  const fetchInit: RequestInit = {
    method: plan.method,
    headers: { "content-type": "application/json" },
    ...(plan.body ? { body: JSON.stringify(plan.body) } : {}),
    cache: "no-store",
    signal: abortController.signal,
  };

  let downstreamResponse: Response;
  try {
    downstreamResponse = await fetch(endpoint.toString(), fetchInit);
  } catch (error) {
    const timedOut = isAbortError(error);
    assistantExecuteLogger.error("downstream.fetch_failure", {
      ...downstreamContext,
      timedOut,
      ...toErrorMeta(error),
    });
    const payload = buildErrorPayload(
      timedOut
        ? "Downstream tool request timed out while waiting for the internal API."
        : "Downstream tool request failed to reach the internal API.",
      downstreamContext,
      timedOut ? 504 : 502,
      null
    );
    return NextResponse.json(payload, { status: timedOut ? 504 : 502 });
  } finally {
    clearTimeout(timeoutId);
  }

  const responseClone = downstreamResponse.clone();
  let payload: unknown;
  try {
    payload = await downstreamResponse.json();
  } catch (error) {
    const rawBody = await responseClone.text().catch(() => "");
    const bodyPreview = previewBody(rawBody);
    assistantExecuteLogger.error("downstream.invalid_json", {
      ...downstreamContext,
      ...toErrorMeta(error),
      status: downstreamResponse.status,
      statusText: downstreamResponse.statusText,
      bodyPreview,
    });
    const errorPayload = buildErrorPayload(
      "Downstream service returned an invalid JSON payload.",
      downstreamContext,
      downstreamResponse.status,
      downstreamResponse.statusText,
      bodyPreview
    );
    return NextResponse.json(errorPayload, { status: 502 });
  }

  if (!downstreamResponse.ok) {
    assistantExecuteLogger.warn("downstream.error_response", {
      ...downstreamContext,
      status: downstreamResponse.status,
      statusText: downstreamResponse.statusText,
    });
    return NextResponse.json(payload, { status: downstreamResponse.status });
  }

  return NextResponse.json({
    success: true,
    requestId,
    execution: {
      toolName,
      args,
      approved: true,
      trace: {
        method: plan.method,
        path: plan.path,
      },
      executedAt: new Date().toISOString(),
    },
    result: payload,
  });
}

function buildErrorPayload(
  message: string,
  context: DownstreamContext,
  status: number,
  statusText?: string | null,
  bodyPreview?: string
): ErrorPayload {
  const payload: ErrorPayload = {
    requestId: context.requestId,
    toolName: context.toolName,
    error: message,
    downstream: {
      url: context.endpoint,
      method: context.method,
      path: context.path,
      status,
    },
  };

  payload.downstream.statusText = statusText ?? null;
  if (bodyPreview) {
    payload.downstream.bodyPreview = bodyPreview;
  }

  return payload;
}

function previewBody(value: string, maxLength = 1024): string {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}
