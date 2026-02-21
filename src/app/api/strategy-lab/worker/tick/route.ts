import { NextResponse } from "next/server";
import { bootstrapStrategyLabPostgresClientFromEnv } from "@/lib/strategy-lab/postgres-bootstrap";
import { runOneStrategyLabWorkerStep } from "@/lib/strategy-lab/worker";

function parseOptionalPositiveInt(value: unknown): number | undefined {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return parsed;
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid strategy-lab admin token.",
      },
    },
    { status: 403 }
  );
}

export async function POST(request: Request) {
  const backend = String(process.env.STRATEGY_LAB_REPOSITORY_BACKEND ?? "memory").trim().toLowerCase();
  if (backend !== "postgres") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNSUPPORTED_MODE",
          message: "Worker tick requires STRATEGY_LAB_REPOSITORY_BACKEND=postgres.",
        },
      },
      { status: 409 }
    );
  }

  const adminToken = process.env.STRATEGY_LAB_ADMIN_TOKEN?.trim();
  if (adminToken) {
    const requestToken = request.headers.get("x-strategy-lab-admin-token")?.trim();
    if (!requestToken || requestToken !== adminToken) {
      return unauthorized();
    }
  }

  let body: Record<string, unknown> = {};
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      body = (await request.json()) as Record<string, unknown>;
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
  }

  await bootstrapStrategyLabPostgresClientFromEnv();
  const client = globalThis.__strategyLabPostgresClient__;
  if (!client) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "DATASET_UNAVAILABLE",
          message: "Postgres client is not available.",
        },
      },
      { status: 503 }
    );
  }

  const step = await runOneStrategyLabWorkerStep({
    client,
    workerId: String(body.workerId ?? `sl-worker-${process.pid}`),
    queueName: typeof body.queueName === "string" ? body.queueName : undefined,
    leaseMs: parseOptionalPositiveInt(body.leaseMs),
    heartbeatMs: parseOptionalPositiveInt(body.heartbeatMs),
  });

  return NextResponse.json({
    ok: true,
    data: step,
  });
}
