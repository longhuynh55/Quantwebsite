import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import type { FinanceAnalysisType } from "@/lib/finance";

const VALID_SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;
const TRUSTED_BASE_URL_ENV_KEYS = [
  "ASSISTANT_TOOL_BASE_URL",
  "INTERNAL_API_BASE_URL",
  "APP_BASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;
const TYPE_SET = new Set<FinanceAnalysisType>([
  "fundamental",
  "health",
  "valuation",
  "peer",
  "sensitivity",
]);

interface ExecuteBody {
  symbol?: string;
  task?: FinanceAnalysisType;
  approvalToken?: string;
}

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

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  let body: ExecuteBody;
  try {
    body = (await request.json()) as ExecuteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const symbol = String(body.symbol ?? "").trim().toUpperCase();
  const task = String(body.task ?? "").trim().toLowerCase() as FinanceAnalysisType;
  const approvalToken = String(body.approvalToken ?? "").trim();
  const expectedApprovalToken = process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN?.trim() ?? "";
  const isProduction = process.env.NODE_ENV === "production";

  if (!VALID_SYMBOL_REGEX.test(symbol)) {
    return NextResponse.json({ error: "Invalid or missing symbol." }, { status: 400 });
  }
  if (!TYPE_SET.has(task)) {
    return NextResponse.json({ error: "Invalid task. Use fundamental|health|valuation|peer|sensitivity." }, { status: 400 });
  }
  if (!approvalToken) {
    return NextResponse.json(
      { error: "approvalToken is required for human-in-loop execution." },
      { status: 403 }
    );
  }
  if (!expectedApprovalToken) {
    return NextResponse.json(
      {
        error: isProduction
          ? "Assistant execution is temporarily unavailable."
          : "Missing ASSISTANT_EXECUTE_APPROVAL_TOKEN configuration.",
      },
      { status: 503 }
    );
  }
  if (!tokensMatch(approvalToken, expectedApprovalToken)) {
    return NextResponse.json(
      { error: "Invalid approvalToken for human-in-loop execution." },
      { status: 403 }
    );
  }

  const trustedInternalBaseUrl = resolveTrustedInternalBaseUrl();
  if (!trustedInternalBaseUrl) {
    return NextResponse.json(
      { error: "Missing trusted internal API base URL configuration." },
      { status: 503 }
    );
  }

  const endpoint = new URL("/api/finance-analysis", trustedInternalBaseUrl);
  endpoint.searchParams.set("symbol", symbol);
  endpoint.searchParams.set("type", task);

  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });

  const payload = await response.json();
  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }

  return NextResponse.json({
    success: true,
    execution: {
      symbol,
      task,
      approved: true,
      executedAt: new Date().toISOString(),
    },
    result: payload,
  });
}
