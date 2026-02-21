import { NextResponse } from "next/server";
import {
  getStrategyLabRunResult,
  parseResultInclude,
  StrategyLabError,
} from "@/lib/strategy-lab/orchestrator";

function parseOptionalPositiveInt(raw: string | null): number | undefined {
  if (!raw || !raw.trim()) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return parsed;
}

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
        message: "Failed to fetch run result.",
      },
    },
    { status: 500 }
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    const searchParams = new URL(request.url).searchParams;
    const include = parseResultInclude(searchParams.get("include"));
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = parseOptionalPositiveInt(searchParams.get("limit"));
    const result = await getStrategyLabRunResult(runId, include, { cursor, limit });
    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
