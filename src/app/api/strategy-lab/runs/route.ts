import { NextResponse } from "next/server";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import { createStrategyLabRun, StrategyLabError } from "@/lib/strategy-lab/orchestrator";

const RATE_LIMIT_MAX = 30;

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof StrategyLabError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status }
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create run.",
      },
    },
    { status: 500 }
  );
}

export async function POST(request: Request) {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/strategy-lab/runs", clientId), RATE_LIMIT_MAX, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
        },
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    );
  }

  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: "Content-Type must be application/json.",
        },
      },
      { status: 415 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: "Invalid JSON body.",
        },
      },
      { status: 400 }
    );
  }

  try {
    const created = await createStrategyLabRun(body, {
      idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
    });
    return NextResponse.json(
      {
        ok: true,
        data: created,
      },
      { status: 202 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
