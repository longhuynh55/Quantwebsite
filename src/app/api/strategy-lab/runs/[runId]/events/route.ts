import { NextResponse } from "next/server";
import { getStrategyLabRunEvents, StrategyLabError } from "@/lib/strategy-lab/orchestrator";

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
        message: "Failed to fetch events.",
      },
    },
    { status: 500 }
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    const searchParams = new URL(request.url).searchParams;
    const since = parseOptionalPositiveInt(searchParams.get("since"));
    const limit = parseOptionalPositiveInt(searchParams.get("limit"));
    const events = await getStrategyLabRunEvents(runId, { since, limit });
    return NextResponse.json({
      ok: true,
      data: {
        runId,
        events,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
