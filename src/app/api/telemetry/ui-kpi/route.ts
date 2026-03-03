import { NextRequest, NextResponse } from "next/server";
import { createLogger, toErrorMeta } from "@/lib/logger";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";

const uiKpiLogger = createLogger("api.telemetry.ui_kpi");

const RATE_LIMIT_MAX = 180;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_EVENT_LENGTH = 80;
const MAX_PAGE_LENGTH = 40;
const MAX_SYMBOL_LENGTH = 10;
const MAX_SOURCE_LENGTH = 40;
const MAX_DETAIL_KEYS = 20;

const ALLOWED_METRICS = new Set([
  "preset_reuse",
  "watchlist_interaction",
  "assistant_contextual_action_ctr",
  "strategy_builder_interaction",
  "strategy_builder_ai_assist",
]);

interface UiKpiPayload {
  metric: string;
  event: string;
  ts?: string;
  page?: string;
  source?: string;
  symbol?: string;
  count?: number;
  detail?: Record<string, unknown>;
  featureFlags?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateLimitKey = createRateLimitKey("telemetry_ui_kpi", clientId);
  const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  if (!rateLimit.allowed) {
    return NextResponse.json({ accepted: false, error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    uiKpiLogger.warn("event.invalid_json", {
      ...toErrorMeta(error),
    });
    return NextResponse.json({ accepted: false, error: "invalid_json" }, { status: 400 });
  }

  const payload = sanitizePayload(body);
  if (!payload) {
    return NextResponse.json({ accepted: false, error: "invalid_payload" }, { status: 400 });
  }

  uiKpiLogger.info("event.accepted", payload as unknown as Record<string, unknown>);
  return NextResponse.json({ accepted: true }, { status: 202 });
}

function sanitizePayload(input: unknown): UiKpiPayload | null {
  if (!isRecord(input)) return null;
  const metric = normalizeText(input.metric, 40);
  const event = normalizeText(input.event, MAX_EVENT_LENGTH);
  if (!metric || !event) return null;
  if (!ALLOWED_METRICS.has(metric)) return null;

  return {
    metric,
    event,
    ts: normalizeIsoTimestamp(input.ts),
    page: normalizeText(input.page, MAX_PAGE_LENGTH),
    source: normalizeText(input.source, MAX_SOURCE_LENGTH),
    symbol: normalizeSymbol(input.symbol),
    count: normalizeCount(input.count),
    detail: sanitizeDetail(input.detail),
    featureFlags: sanitizeDetail(input.featureFlags),
  };
}

function sanitizeDetail(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).slice(0, MAX_DETAIL_KEYS);
  const detail: Record<string, unknown> = {};
  for (const [key, raw] of entries) {
    const normalizedKey = normalizeText(key, 40);
    if (!normalizedKey) continue;
    detail[normalizedKey] = sanitizeScalar(raw);
  }
  return Object.keys(detail).length > 0 ? detail : undefined;
}

function sanitizeScalar(value: unknown): string | number | boolean | null {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value.trim().slice(0, 120);
  return String(value).slice(0, 120);
}

function normalizeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || undefined;
}

function normalizeSymbol(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, MAX_SYMBOL_LENGTH);
  return normalized || undefined;
}

function normalizeIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function normalizeCount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.trunc(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
